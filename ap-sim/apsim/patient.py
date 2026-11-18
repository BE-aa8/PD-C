"""Nonlinear glucose-insulin model, Seborg Eqs. 23-16 to 23-18 (deviation variables).

    dG/dt = -p1 G - X (G + G_basal) + D(t)
    dX/dt = -p2 X + p3 I
    dI/dt = -n (I + I_basal) + U(t)/V1

G [mg/dL] glucose deviation, X [1/min] remote insulin effect, I [mU/L] plasma
insulin deviation, U [mU/min] ABSOLUTE pump rate, D [mg/dL/min] meal appearance.
Nothing is clamped here: saturation lives in pump.py.
"""
from __future__ import annotations

import numpy as np

from .params import Params


def patient_rhs(state, U: float, D: float, p: Params, p3_scale: float = 1.0) -> np.ndarray:
    """Pure right-hand side. ``p3_scale`` multiplies p3 (insulin-sensitivity mismatch)."""
    G, X, I = state[0], state[1], state[2]
    return np.array([
        -p.p1 * G - X * (G + p.G_basal) + D,
        -p.p2 * X + p3_scale * p.p3 * I,
        -p.n * (I + p.I_basal) + U / p.V1,
    ])


def rhs_scalar(G: float, X: float, I: float, U: float, D: float, p: Params,
               p3_scale: float = 1.0) -> tuple[float, float, float]:
    """Same equations as :func:`patient_rhs` on plain floats (fast path for the RK4 loop)."""
    return (-p.p1 * G - X * (G + p.G_basal) + D,
            -p.p2 * X + p3_scale * p.p3 * I,
            -p.n * (I + p.I_basal) + U / p.V1)


def steady_state(dU: float, p: Params, p3_scale: float = 1.0) -> tuple[float, float, float]:
    """Analytic nonlinear steady state for a constant U = U_basal + dU and D = 0.

    I = dU/(n V1);  X = p3 I / p2;  G = -X G_basal / (p1 + X).
    """
    I = dU / (p.n * p.V1)
    X = p3_scale * p.p3 * I / p.p2
    G = -X * p.G_basal / (p.p1 + X)
    return G, X, I
