"""Reduced-order models (Sec. 5, Seborg Exercise 23.6(a)).

* Skogestad half rule (analytic) from the three time constants.
* Least-squares FOPDT / SOPDT fits to the simulated NONLINEAR step (dU = +1, 0-600 min).
* Effective dead time seen by the controller: theta_model + theta_sensor + Ts/2.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.optimize import least_squares


@dataclass(frozen=True)
class FOPDT:
    K: float
    tau: float
    theta: float


@dataclass(frozen=True)
class SOPDT:
    K: float
    tau1: float
    tau2: float
    theta: float


def half_rule(K: float, taus) -> tuple[SOPDT, FOPDT]:
    """Skogestad (2003) half rule.  The largest neglected time constant is split half to
    the dead time and half to the smallest retained time constant; smaller neglected
    constants go entirely into the dead time."""
    t = sorted(taus, reverse=True)
    sop = SOPDT(K, t[0], t[1] + t[2] / 2, t[2] / 2 + sum(t[3:]))
    fop = FOPDT(K, t[0] + t[1] / 2, t[1] / 2 + sum(t[2:]))
    return sop, fop


def fopdt_step(t, K, tau, theta):
    tp = np.maximum(np.asarray(t, float) - theta, 0.0)
    return K * (1.0 - np.exp(-tp / tau))


def sopdt_step(t, K, tau1, tau2, theta):
    """SOPDT step; the tau1 == tau2 (critically damped) limit is handled analytically:
    y = K [1 - (1 + t'/tau) exp(-t'/tau)] -- never divide by (tau1 - tau2) near 0."""
    tp = np.maximum(np.asarray(t, float) - theta, 0.0)
    if abs(tau1 - tau2) <= 1e-6 * max(tau1, tau2):
        tau = 0.5 * (tau1 + tau2)
        return K * (1.0 - (1.0 + tp / tau) * np.exp(-tp / tau))
    return K * (1.0 - (tau1 * np.exp(-tp / tau1) - tau2 * np.exp(-tp / tau2)) / (tau1 - tau2))


@dataclass(frozen=True)
class FitResult:
    model: object
    rmse: float
    max_err: float


def _stats(res):
    return float(np.sqrt(np.mean(res ** 2))), float(np.max(np.abs(res)))


def fit_fopdt(t, y) -> FitResult:
    K0 = y[-1]
    sol = least_squares(lambda q: fopdt_step(t, *q) - y, x0=[K0, 50.0, 20.0],
                        bounds=([-np.inf, 1e-3, 0.0], [np.inf, 1e4, 300.0]),
                        x_scale=[1.0, 10.0, 10.0], xtol=1e-12, ftol=1e-12, gtol=1e-12)
    return FitResult(FOPDT(*sol.x), *_stats(sol.fun))


def fit_sopdt(t, y) -> FitResult:
    """Parameterised as tau1 = tau_a, tau2 = r * tau_a with 0 < r <= 1 so that the
    optimiser can reach the critically damped limit r = 1 without a singularity."""
    def model(q):
        K, ta, r, th = q
        return sopdt_step(t, K, ta, r * ta, th)
    K0 = y[-1]
    best = None
    for r0 in (0.3, 0.7, 0.99):
        sol = least_squares(lambda q: model(q) - y, x0=[K0, 35.0, r0, 5.0],
                            bounds=([-np.inf, 1e-3, 1e-4, 0.0], [np.inf, 1e4, 1.0, 300.0]),
                            x_scale=[1.0, 10.0, 0.1, 5.0], xtol=1e-12, ftol=1e-12, gtol=1e-12)
        if best is None or sol.cost < best.cost:
            best = sol
    K, ta, r, th = best.x
    return FitResult(SOPDT(K, ta, r * ta, th), *_stats(best.fun))


def fit_nonlinear_step(dU: float = 1.0, t_end: float = 600.0, dt: float = 0.1, p=None):
    """Fit both reduced models to the nonlinear step response, per unit dU.
    Returns (t, y_per_unit, sopdt_fit, fopdt_fit)."""
    from .linearize import nonlinear_step
    t, y = nonlinear_step(dU, t_end, dt, p)
    y = y / dU
    return t, y, fit_sopdt(t, y), fit_fopdt(t, y)


def effective_dead_time(theta_model: float, theta_sensor: float, Ts: float,
                        include_zoh: bool = True) -> dict:
    """theta_total = theta_model + theta_sensor + Ts/2 (ZOH approximation)."""
    zoh = Ts / 2 if include_zoh else 0.0
    return {"theta_model": theta_model, "theta_sensor": theta_sensor, "theta_zoh": zoh,
            "theta_total": theta_model + theta_sensor + zoh}
