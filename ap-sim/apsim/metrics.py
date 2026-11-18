"""Performance / safety metrics (Sec. 12).

Time fractions use the trapezoid rule on the dt grid: an indicator signal
1[condition] is integrated with np.trapezoid and divided by the horizon.
"""
from __future__ import annotations

import math

import numpy as np

from .params import BAND_TEXTBOOK, CLINICAL_BAND


def _trapz(y, t):
    return float(np.trapezoid(y, t)) if hasattr(np, "trapezoid") else float(np.trapz(y, t))


def time_fraction(t, mask) -> float:
    T = t[-1] - t[0]
    return _trapz(mask.astype(float), t) / T if T > 0 else float(mask[0])


def settling_time(t, G, sp, t_ref, tol=5.0) -> float:
    """Time after t_ref until G stays within +/- tol of the set point for the rest of
    the run.  NaN if it never settles (still outside at the end)."""
    m = t >= t_ref
    tt, err = t[m], np.abs(G[m] - sp[m])
    out = np.where(err > tol)[0]
    if len(out) == 0:
        return 0.0
    if out[-1] == len(tt) - 1:
        return math.nan
    return float(tt[out[-1] + 1] - t_ref)


def glucose_metrics(t, G, sp, band=BAND_TEXTBOOK, clinical=CLINICAL_BAND, t_ref=0.0) -> dict:
    lo, hi = band
    ok = ~np.isnan(G)
    t, G, sp = t[ok], G[ok], sp[ok]
    ipk, imin = int(np.argmax(G)), int(np.argmin(G))
    e = G - sp
    return {
        "peak": float(G[ipk]), "t_peak": float(t[ipk]),
        "nadir": float(G[imin]), "t_nadir": float(t[imin]),
        "pct_in_band": 100 * time_fraction(t, (G > lo) & (G < hi)),
        "pct_in_70_180": 100 * time_fraction(t, (G >= clinical[0]) & (G <= clinical[1])),
        "pct_below_54": 100 * time_fraction(t, G < 54.0),
        "pct_below_70": 100 * time_fraction(t, G < 70.0),
        "pct_above_band_high": 100 * time_fraction(t, G > hi),
        "pct_above_180": 100 * time_fraction(t, G > 180.0),
        "IAE": _trapz(np.abs(e), t), "ISE": _trapz(e ** 2, t),
        "settling_time": settling_time(t, G, sp, t_ref),
        "stayed_in_band": bool(np.all((G > lo) & (G < hi))),
    }


def compute_metrics(r, band=BAND_TEXTBOOK, clinical=CLINICAL_BAND, t_ref=None) -> dict:
    """Metrics on TRUE glucose and on MEASURED glucose, plus insulin totals."""
    if t_ref is None:
        t_ref = 0.0
    true = glucose_metrics(r.t, r.G_true, r.setpoint, band, clinical, t_ref)
    meas = glucose_metrics(r.t, r.G_meas, r.setpoint, band, clinical, t_ref)
    # insulin: U is held constant over [t_i, t_i+dt) -> rectangle rule is exact
    dt = np.diff(r.t)
    ins = lambda u: float(np.sum(u[:-1] * dt))
    U_max_hit = r.U >= r.U_max - 1e-9
    U_min_hit = r.U <= r.U_min + 1e-9
    return {
        "true": true, "measured": meas,
        "insulin_total": ins(r.U), "insulin_feedback": ins(r.U - r.U_ff),
        "insulin_feedforward": ins(r.U_ff),
        "insulin_above_basal": ins(r.U - r.U_basal),
        "time_at_U_max": float(np.sum(dt[U_max_hit[:-1]])),
        "time_at_U_min": float(np.sum(dt[U_min_hit[:-1]])),
    }
