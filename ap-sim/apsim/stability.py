"""Frequency-response stability analysis (Sec. 13, Seborg Exercise 23.6(e)).

L(jw) = Gc(jw) Gp(jw) e^{-jw theta},  Gp = FULL 3rd-order linear model (not the fit),
Gc = filtered PID  Kc [1 + 1/(tauI s) + tauD s/(tau_f s + 1)],  tau_f = tauD/N.

Max additional tolerable delay: d_theta_max = PM [rad] / wc [rad/min].
Sampling adds ~Ts/2 of effective delay that the continuous calculation ignores.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
from scipy.optimize import brentq

from .linearize import LinearModel


def pid_freq(w, Kc, tauI, tauD, N=10.0):
    s = 1j * np.asarray(w, float)
    integ = 0.0 if not math.isfinite(tauI) else 1.0 / (tauI * s)
    deriv = 0.0 if tauD <= 0 else tauD * s / (tauD / N * s + 1.0)
    return Kc * (1.0 + integ + deriv)


def loop_freq(w, lm: LinearModel, Kc, tauI, tauD, N=10.0, theta=0.0):
    w = np.asarray(w, float)
    return pid_freq(w, Kc, tauI, tauD, N) * lm.Gp(1j * w) * np.exp(-1j * w * theta)


def _phase(w, lm, Kc, tauI, tauD, N, theta):
    """Continuous (unwrapped) phase of L in radians, built analytically from factors so
    no numerical unwrapping is needed.  Includes the 180 deg from Kc*Kp > 0 -> 0."""
    w = np.asarray(w, float)
    ph = np.angle(pid_freq(w, abs(Kc), tauI, tauD, N))           # PID factor in (-90, +90)
    for tau in lm.taus:
        ph = ph - np.arctan(w * tau)
    if Kc * lm.Kp < 0:      # positive-feedback sign: shift by pi
        ph = ph + math.pi
    return ph - w * theta


@dataclass(frozen=True)
class Margins:
    wc: float          # gain crossover [rad/min]
    PM_deg: float
    w180: float        # phase crossover [rad/min] (nan if none)
    GM: float          # gain margin (ratio; inf if no phase crossover)
    dtheta_max: float  # additional delay tolerable [min]
    theta_in_loop: float

    @property
    def total_tolerable_delay(self) -> float:
        return self.theta_in_loop + self.dtheta_max


def margins(lm: LinearModel, Kc, tauI, tauD, N=10.0, theta=0.0,
            w_lo=1e-5, w_hi=10.0) -> Margins:
    mag = lambda w: abs(loop_freq(w, lm, Kc, tauI, tauD, N, theta)) - 1.0
    ws = np.logspace(math.log10(w_lo), math.log10(w_hi), 4000)
    m = np.array([mag(w) for w in ws])
    idx = np.where(np.sign(m[:-1]) != np.sign(m[1:]))[0]
    if len(idx) == 0:
        raise ValueError("no gain crossover in range")
    k = idx[-1]
    wc = brentq(mag, ws[k], ws[k + 1], xtol=1e-14)
    ph_c = float(_phase(wc, lm, Kc, tauI, tauD, N, theta))
    PM = math.pi + ph_c
    phf = lambda w: float(_phase(w, lm, Kc, tauI, tauD, N, theta)) + math.pi
    p = np.array([phf(w) for w in ws])
    j = np.where(np.sign(p[:-1]) != np.sign(p[1:]))[0]
    if len(j):
        w180 = brentq(phf, ws[j[0]], ws[j[0] + 1], xtol=1e-14)
        GM = 1.0 / abs(loop_freq(w180, lm, Kc, tauI, tauD, N, theta))
    else:
        w180, GM = math.nan, math.inf
    return Margins(wc, math.degrees(PM), w180, GM, PM / wc, theta)


def bode_data(lm, Kc, tauI, tauD, N=10.0, theta=0.0, w=None):
    w = np.logspace(-4, 0, 600) if w is None else w
    L = loop_freq(w, lm, Kc, tauI, tauD, N, theta)
    return w, np.abs(L), np.degrees(_phase(w, lm, Kc, tauI, tauD, N, theta)), L


# ---------------------------------------------------------------------------------
# Empirical cross-check: closed-loop nonlinear sim, unbounded actuator, small SP step.
# ---------------------------------------------------------------------------------
def _decay_ratio(t, y, t0):
    """Ratio of the last to the first well-formed oscillation peak of |y| after t0
    (> 1 growing, < 1 decaying)."""
    m = t >= t0
    yy = y[m]
    pk = [i for i in range(1, len(yy) - 1) if abs(yy[i]) >= abs(yy[i - 1]) and abs(yy[i]) > abs(yy[i + 1])
          and abs(yy[i]) > 1e-9]
    if len(pk) < 4:
        return 0.0
    a = np.abs(yy[pk])
    return float(a[-1] / a[1])


def oscillation_ratio(pid_cfg, theta_s, sp_step=-1.0, t_end=3000.0, dt=0.1, Ts=5.0, params=None):
    from .params import DEFAULT_PARAMS
    from .sensor import SensorConfig
    from .simulate import SimConfig, simulate
    p = params or DEFAULT_PARAMS
    th = round(theta_s / dt) * dt
    r = simulate(SimConfig(params=p, t_end=t_end, dt=dt, Ts=Ts, controller="pid", pid=pid_cfg,
                           meals=(), sensor=SensorConfig(delay=th), saturation=False,
                           setpoint_steps=((0.0, p.G_basal + sp_step),)))
    e = r.G_true - (p.G_basal + sp_step)
    return _decay_ratio(r.t, e, 0.0)


def empirical_max_delay(pid_cfg, lo=0.0, hi=150.0, tol=0.5, **kw) -> float:
    """Smallest sensor delay giving sustained (non-decaying) oscillation, by bisection."""
    if oscillation_ratio(pid_cfg, hi, **kw) < 1.0:
        return math.inf
    while hi - lo > tol:
        mid = 0.5 * (lo + hi)
        if oscillation_ratio(pid_cfg, mid, **kw) >= 1.0:
            hi = mid
        else:
            lo = mid
    return 0.5 * (lo + hi)
