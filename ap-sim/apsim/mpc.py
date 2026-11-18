"""Linear MPC (STRETCH, Phase 7).  Illustrative; not a real device algorithm.

Model
-----
The linear model (linearize.py) is discretized with a zero-order hold at Ts.  The sensor
delay is augmented as d = round(theta_s/Ts) extra states (a shift register on G), and a
random-walk output disturbance w gives offset-free control against plant-model mismatch:

    xi = [G, X, I, z_1..z_d, w]
    x(k+1) = Ad x + Bu u + Bdd D_k          (u = U - U_basal, D_k = mean meal rate over the step)
    z_1(k+1) = G(k), z_j(k+1) = z_{j-1}(k)
    w(k+1) = w(k)
    y(k) = z_d(k) + w(k)                      (CGM reading, deviation from G_basal)

A steady-state Kalman filter estimates xi from the delayed CGM.

Optimisation (horizon H samples, all H moves free)
--------------------------------------------------
    min_u  sum_k  q(e_k) e_k^2  +  w_soft max(0, g_min - G_k)^2  +  r_du (du_k)^2  +  r_u u_k^2
    s.t.   U_min - U_basal <= u_k <= U_max - U_basal
    e_k = G_k - r,  q(e) = w_hypo if e < 0 else 1     (asymmetric: lows cost more than highs)

The cost is piecewise quadratic and C1, so it is solved with L-BFGS-B (box bounds) using an
analytic gradient.  If meals are announced (cfg.ff.enabled) the announced meal estimate
(with the same estimate error as the bolus) is used in the prediction instead of a bolus.

Seborg notes that PID, MPC and fuzzy-logic algorithms have all been clinically tested
(Doyle III et al., 2014).  No claim is made about which commercial devices use which
algorithm.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.linalg import solve_discrete_are
from scipy.optimize import minimize
from scipy.signal import cont2discrete

from .disturbance import Meal, meal_rate
from .linearize import linearize
from .params import Params


@dataclass(frozen=True)
class MPCConfig:
    horizon: int = 24          # samples (2 h at Ts = 5)
    w_hypo: float = 10.0       # weight on below-set-point error relative to above (user choice)
    g_min: float = 70.0        # soft lower limit [mg/dL]
    w_soft: float = 100.0      # soft-constraint weight (user choice)
    r_du: float = 0.05         # move suppression (user choice)
    r_u: float = 0.0           # input penalty (user choice)
    q_w: float = 0.01          # Kalman: output-disturbance random-walk variance
    q_x: float = 1e-3          # Kalman: process noise on G
    r_meas: float = 4.0        # Kalman: measurement noise variance
    dist_model: str = "meal"    # output (random-walk offset) | meal (decaying input dist. + offset)
    q_meal: float = 0.5        # Kalman: variance driving the decaying meal-disturbance state
    meal_decay: float = 0.05   # 1/min, decay assumed for unannounced-meal state (textbook k)


class MPC:
    def __init__(self, cfg: MPCConfig | None, p: Params, Ts: float, delay: float,
                 U_lo: float, U_hi: float, meals: tuple[Meal, ...] = (), ff=None):
        self.cfg = cfg = cfg or MPCConfig()
        self.p, self.Ts = p, Ts
        lm = linearize(p)
        Ad, Bd, *_ = cont2discrete((lm.A, np.hstack([lm.B_u, lm.B_d]), lm.C, np.zeros((1, 2))), Ts, "zoh")
        self.d = d = int(round(delay / Ts))
        meal = cfg.dist_model == "meal"
        n = 3 + d + 1 + (1 if meal else 0)
        iw = 3 + d                      # index of output disturbance w
        A = np.zeros((n, n))
        A[:3, :3] = Ad
        if d > 0:
            A[3, 0] = 1.0
            for j in range(1, d):
                A[3 + j, 3 + j - 1] = 1.0
        A[iw, iw] = 1.0
        Bu = np.zeros(n); Bu[:3] = Bd[:, 0]
        BD = np.zeros(n); BD[:3] = Bd[:, 1]
        if meal:                        # delta(k+1) = a delta(k), enters like a meal rate D
            A[-1, -1] = math.exp(-cfg.meal_decay * Ts)
            A[:3, -1] = Bd[:, 1]
        C = np.zeros(n); C[3 + d - 1 if d > 0 else 0] = 1.0; C[iw] = 1.0
        self.A, self.Bu, self.BD, self.C = A, Bu, BD, C
        # steady-state Kalman gain (predictor form, then filter correction)
        Q = np.zeros((n, n)); Q[0, 0] = cfg.q_x; Q[iw, iw] = cfg.q_w
        if meal:
            Q[-1, -1] = cfg.q_meal
        P = solve_discrete_are(A.T, C[:, None], Q, np.array([[cfg.r_meas]]))
        self.L = (P @ C) / (C @ P @ C + cfg.r_meas)
        self.xi = np.zeros(n)
        self.u_prev = 0.0
        self.U_basal = p.U_basal
        self.lo, self.hi = U_lo - p.U_basal, U_hi - p.U_basal
        # prediction matrices for actual glucose G_k + w  (k = 1..H)
        H = cfg.horizon
        Cg = np.zeros(n); Cg[0] = 1.0; Cg[iw] = 1.0
        self.F = np.zeros((H, n)); self.Phi = np.zeros((H, H)); self.Psi = np.zeros((H, H))
        Ak = np.eye(n)
        powers = [np.eye(n)]
        for _ in range(H):
            powers.append(A @ powers[-1])
        for k in range(1, H + 1):
            self.F[k - 1] = Cg @ powers[k]
            for j in range(k):
                self.Phi[k - 1, j] = Cg @ powers[k - 1 - j] @ Bu
                self.Psi[k - 1, j] = Cg @ powers[k - 1 - j] @ BD
        self.ann = ()
        if ff is not None and ff.enabled:
            self.ann = tuple(Meal(m.t_meal, m.multiplier * (1 + ff.est_error), m.A, m.k) for m in meals)
        self.last_pred = None

    def _D_future(self, t: float) -> np.ndarray:
        """Mean announced meal rate over each future sample interval (Simpson's rule)."""
        H, Ts = self.cfg.horizon, self.Ts
        out = np.zeros(H)
        if not self.ann:
            return out
        for j in range(H):
            a = t + j * Ts
            out[j] = (meal_rate(a, self.ann) + 4 * meal_rate(a + Ts / 2, self.ann)
                      + meal_rate(a + Ts - 1e-9, self.ann)) / 6
        return out

    def update(self, r_abs: float, m_abs: float, t: float, ff=None) -> float:
        c, p = self.cfg, self.p
        # measurement update (skip on dropout)
        if not math.isnan(m_abs):
            y = m_abs - p.G_basal
            self.xi = self.xi + self.L * (y - self.C @ self.xi)
        r = r_abs - p.G_basal
        Df = self._D_future(t)
        free = self.F @ self.xi + self.Psi @ Df
        Phi, H = self.Phi, c.horizon
        gmin = c.g_min - p.G_basal

        def cost(u):
            G = free + Phi @ u
            e = G - r
            q = np.where(e < 0, c.w_hypo, 1.0)
            s = np.maximum(gmin - G, 0.0)
            du = np.diff(np.concatenate([[self.u_prev], u]))
            J = np.sum(q * e * e) + c.w_soft * np.sum(s * s) + c.r_du * np.sum(du * du) + c.r_u * np.sum(u * u)
            gG = 2 * q * e - 2 * c.w_soft * s
            gdu = 2 * c.r_du * du
            g_du = gdu - np.concatenate([gdu[1:], [0.0]])
            g = Phi.T @ gG + g_du + 2 * c.r_u * u
            return J, g

        u0 = np.clip(np.full(H, self.u_prev), self.lo, self.hi)
        sol = minimize(cost, u0, jac=True, method="L-BFGS-B", bounds=[(self.lo, self.hi)] * H,
                       options={"maxiter": 500, "ftol": 1e-12, "gtol": 1e-8})
        u = float(np.clip(sol.x[0], self.lo, self.hi))
        self.last_pred = free + Phi @ sol.x
        # time update with the applied move and current meal estimate
        self.xi = self.A @ self.xi + self.Bu * u + self.BD * Df[0]
        self.u_prev = u
        return u + self.U_basal
