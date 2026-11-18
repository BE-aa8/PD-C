"""Actuator model: saturation (and optional rate quantization)."""
from __future__ import annotations

import math


def saturate(u: float, u_min: float, u_max: float) -> float:
    """Clip the requested rate to the pump range [u_min, u_max]."""
    return min(max(u, u_min), u_max)


def quantize(u: float, step: float) -> float:
    """Optional pump resolution (mU/min). step <= 0 means no quantization. Rounds down
    so quantization never delivers more than requested."""
    if step <= 0:
        return u
    return math.floor(u / step + 1e-12) * step
