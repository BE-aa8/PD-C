"""Analytic linearization about the basal steady state (Sec. 4).

The only nonlinear term is X (G + G_basal).  At G = X = 0: d/dG = X = 0, d/dX = G_basal:

    dG/dt = -p1 G - G_basal X + D
    dX/dt = -p2 X + p3 I
    dI/dt = -n I + u/V1,          u = U - U_basal

    Gp(s) = -(G_basal p3 / V1) / [(s+p1)(s+p2)(s+n)]
          = Kp / [(tau_G s+1)(tau_X s+1)(tau_I s+1)],  Kp = -G_basal p3/(V1 p1 p2 n)
    Gd(s) = 1/(s+p1) = Kd/(tau_G s+1),  Kd = 1/p1
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import signal

from .params import Params


@dataclass(frozen=True)
class LinearModel:
    A: np.ndarray
    B_u: np.ndarray
    B_d: np.ndarray
    C: np.ndarray
    Kp: float
    Kd: float
    tau_G: float
    tau_X: float
    tau_I: float
    num_p: np.ndarray
    den_p: np.ndarray
    num_d: np.ndarray
    den_d: np.ndarray

    @property
    def taus(self) -> tuple[float, float, float]:
        return (self.tau_G, self.tau_X, self.tau_I)

    def Gp(self, s):
        return np.polyval(self.num_p, s) / np.polyval(self.den_p, s)

    def Gd(self, s):
        return np.polyval(self.num_d, s) / np.polyval(self.den_d, s)


def linearize(p: Params) -> LinearModel:
    A = np.array([[-p.p1, -p.G_basal, 0.0],
                  [0.0, -p.p2, p.p3],
                  [0.0, 0.0, -p.n]])
    B_u = np.array([[0.0], [0.0], [1.0 / p.V1]])
    B_d = np.array([[1.0], [0.0], [0.0]])
    C = np.array([[1.0, 0.0, 0.0]])
    Kp = -p.G_basal * p.p3 / (p.V1 * p.p1 * p.p2 * p.n)
    num_p = np.array([-p.G_basal * p.p3 / p.V1])
    den_p = np.poly([-p.p1, -p.p2, -p.n])
    return LinearModel(A, B_u, B_d, C, Kp, 1.0 / p.p1, 1.0 / p.p1, 1.0 / p.p2, 1.0 / p.n,
                       num_p, den_p, np.array([1.0]), np.array([1.0, p.p1]))


def numerical_jacobian(p: Params, eps: float = 1e-6) -> np.ndarray:
    """Finite-difference Jacobian of patient_rhs at the origin (used to verify A)."""
    from .patient import patient_rhs
    J = np.zeros((3, 3))
    for j in range(3):
        e = np.zeros(3)
        e[j] = eps
        J[:, j] = (patient_rhs(e, p.U_basal, 0.0, p) - patient_rhs(-e, p.U_basal, 0.0, p)) / (2 * eps)
    return J


def linear_step(lm: LinearModel, t: np.ndarray, dU: float = 1.0) -> np.ndarray:
    """Linear glucose deviation for a step dU in U (scipy.signal)."""
    _, y = signal.step(signal.lti(lm.num_p, lm.den_p), T=t)
    return dU * y


def nonlinear_step(dU: float, t_end: float = 600.0, dt: float = 0.1, p: Params | None = None):
    """Open-loop nonlinear response to U = U_basal + dU (no meal). Returns (t, G deviation)."""
    from .params import DEFAULT_PARAMS
    from .simulate import SimConfig, simulate
    p = p or DEFAULT_PARAMS
    r = simulate(SimConfig(params=p, t_end=t_end, dt=dt, controller="none",
                           U_open_loop=p.U_basal + dU, meals=(), saturation=False))
    return r.t, r.G_true - p.G_basal


def nonlinear_gain_curve(p: Params, dUs: np.ndarray) -> np.ndarray:
    """Steady-state gain dG_ss/dU of the NONLINEAR model (analytic steady state).
    G_ss = -X G_basal/(p1 + X): the gain shrinks as insulin rises."""
    from .patient import steady_state
    out = np.empty(len(dUs))
    for k, dU in enumerate(dUs):
        out[k] = np.nan if dU == 0 else steady_state(dU, p)[0] / dU
    return out
