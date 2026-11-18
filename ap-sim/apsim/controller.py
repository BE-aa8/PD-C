"""Discrete position-form PID (ISA/standard form), Sec. 7.

Runs only at sample instants (every Ts) and its output is held in between (ZOH).

At sample k (measurement m_k, set point r_k, e_k = r_k - m_k):

    P_k = Kc (beta r_k - m_k)
    S_k = S_{k-1} + e_k Ts                    (integral state, subject to anti-windup)
    I_k = Kc/tauI * S_k
    d_k = alpha d_{k-1} + (1-alpha)(m_k - m_{k-1})/Ts   (filtered derivative of MEASUREMENT)
    D_k = -Kc tauD d_k
    alpha = tau_f/(tau_f + Ts),  tau_f = tauD/N
    u_k = U_bias + P_k + I_k + D_k;   U_k = clip(u_k, U_min, U_max)

Derivative acts on the measurement, not the error, so a set-point step causes no
derivative kick (Seborg Ch. 8).  The feedforward/bolus is added *outside* this
object (see simulate.py), so anti-windup here judges saturation of the feedback
output only.

Anti-windup
-----------
'clamp'  conditional integration.  The direction test uses the sign of Kc*e_k, not
         e_k: Kc < 0 for this process, so high glucose (e < 0) means Kc*e > 0 -> MORE
         insulin.  Reject the integral update if (u_trial > U_max and Kc*e > 0) or
         (u_trial < U_min and Kc*e < 0).
'backcalc' back-calculation: dI/dt = (Kc/tauI) e + (U - u)/Tt, i.e. with I = (Kc/tauI) S
         S_k = S_{k-1} + Ts [ e_k + tauI (U_k - u_k) / (Kc Tt) ],
         Tt = sqrt(tauI tauD) (PID) or tauI (PI).  u_k is evaluated with
         S_{k-1} + e_k Ts; the correction removes a fraction Ts/Tt of the excess per sample.
'off'    no protection (insulin-stacking demo).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .pump import saturate


@dataclass(frozen=True)
class PIDConfig:
    Kc: float                 # (mU/min)/(mg/dL), negative for this process
    tauI: float               # min (math.inf disables integral action)
    tauD: float = 0.0         # min
    N: float = 10.0           # derivative filter, tau_f = tauD/N
    beta: float = 1.0         # set-point weight on P
    anti_windup: str = "clamp"  # clamp | backcalc | off
    Tt: float | None = None   # back-calculation tracking time (None -> default rule)


class PID:
    def __init__(self, cfg: PIDConfig, Ts: float, U_bias: float, U_min: float, U_max: float):
        self.cfg = cfg
        self.Ts = Ts
        self.U_bias = U_bias
        self.U_min = U_min
        self.U_max = U_max
        self.S = 0.0
        self.d = 0.0
        self.m_prev: float | None = None
        self.u_raw = U_bias
        self.U = saturate(U_bias, U_min, U_max)
        self.saturated = False
        self.integral_frozen = False   # external freeze (e.g. during a bolus window)
        if cfg.tauD > 0:
            tau_f = cfg.tauD / cfg.N
            self.alpha = tau_f / (tau_f + Ts)
        else:
            self.alpha = 0.0
        if cfg.Tt is not None:
            self.Tt = cfg.Tt
        elif cfg.tauD > 0 and math.isfinite(cfg.tauI):
            self.Tt = math.sqrt(cfg.tauI * cfg.tauD)
        else:
            self.Tt = cfg.tauI

    @property
    def integral_term(self) -> float:
        c = self.cfg
        return 0.0 if not math.isfinite(c.tauI) else c.Kc / c.tauI * self.S

    def _parts(self, r: float, m: float, S: float) -> float:
        c = self.cfg
        P = c.Kc * (c.beta * r - m)
        I = 0.0 if not math.isfinite(c.tauI) else c.Kc / c.tauI * S
        D = -c.Kc * c.tauD * self.d
        return self.U_bias + P + I + D

    def update(self, r: float, m: float) -> float:
        """One controller execution. Returns the clipped feedback output U_k.

        A NaN measurement (sensor dropout) holds the previous output and leaves all
        controller states untouched.
        """
        if math.isnan(m):
            return self.U
        c, Ts = self.cfg, self.Ts
        e = r - m
        if self.m_prev is None:          # bumpless start: m_{-1} = m_0
            self.m_prev = m
        self.d = self.alpha * self.d + (1.0 - self.alpha) * (m - self.m_prev) / Ts
        self.m_prev = m

        integrate = math.isfinite(c.tauI) and not self.integral_frozen
        S_trial = self.S + e * Ts if integrate else self.S
        u_trial = self._parts(r, m, S_trial)

        if c.anti_windup == "clamp" and integrate:
            ke = c.Kc * e
            if (u_trial > self.U_max and ke > 0) or (u_trial < self.U_min and ke < 0):
                S_trial = self.S
            self.S = S_trial
            u = self._parts(r, m, self.S)
            U = saturate(u, self.U_min, self.U_max)
        elif c.anti_windup == "backcalc" and integrate:
            u = u_trial
            U = saturate(u, self.U_min, self.U_max)
            self.S = S_trial + Ts * c.tauI * (U - u) / (c.Kc * self.Tt)
        else:
            self.S = S_trial
            u = u_trial
            U = saturate(u, self.U_min, self.U_max)

        self.u_raw = u
        self.U = U
        self.saturated = (u > self.U_max) or (u < self.U_min)
        return U
