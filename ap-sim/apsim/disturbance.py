"""Meal disturbance profiles (Sec. 9). Everything stays in model units (mg/dL/min).

Deliberately NO conversion to grams of carbohydrate: the source gives no such mapping
and adding one would drift toward dosing advice.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .params import PARAM_TABLE

A_TEXTBOOK = PARAM_TABLE["meal_A"].value   # 9.0 mg/dL/min
K_TEXTBOOK = PARAM_TABLE["meal_k"].value   # 0.05 1/min


@dataclass(frozen=True)
class Meal:
    t_meal: float           # min
    multiplier: float = 1.0  # scales A (0-2x in the UI)
    A: float = A_TEXTBOOK
    k: float = K_TEXTBOOK

    @property
    def amplitude(self) -> float:
        return self.A * self.multiplier

    @property
    def area(self) -> float:
        """Total glucose 'area' = A/k  [mg/dL]; 180 for the textbook meal."""
        return self.amplitude / self.k


def meal_rate(t: float, meals: tuple[Meal, ...]) -> float:
    """D(t) = sum_i A_i exp(-k_i (t - t_i)) for t >= t_i."""
    D = 0.0
    for m in meals:
        if t >= m.t_meal:
            D += m.amplitude * math.exp(-m.k * (t - m.t_meal))
    return D
