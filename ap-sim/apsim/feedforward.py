"""Meal announcement / feedforward (Sec. 10).

Why ideal feedforward is impossible
-----------------------------------
Gf(s) = -Gd(s)/Gp(s) = V1 (s + p2)(s + n) / (G_basal p3).  The numerator has order 2
and the denominator order 0, so Gf is improper: it would need the 2nd derivative of
D(t).  Physically, the meal enters glucose directly while insulin acts through two
first-order lags (plasma insulin, then remote effect X), so perfect cancellation is
unrealizable (Seborg Ch. 15).

Static feedforward -> bolus
---------------------------
Kf = -Kd/Kp = V1 p2 n / (G_basal p3) ~ 7.72 (mU/min)/(mg/dL/min).
Matching the total insulin to the meal's total area A/k:
    Bolus_total = f_bolus * Kf * A_est / k,   A_est = (1 + eps) A_true.
Textbook meal: 7.72 * 180 ~ 1390 mU.  Delivered at the remaining pump capacity
(U_max - U_fb) starting t_pre minutes before the meal until the total is delivered,
so total U never exceeds U_max.

Dynamic feedforward (STRETCH): lead-lag Kf (tau_ld s + 1)/(tau_lg s + 1) driven by the
*announced* (estimated) meal profile, shifted earlier by t_pre.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .disturbance import Meal, meal_rate
from .params import Params


def static_ff_gain(p: Params) -> float:
    """Kf = -Kd/Kp = V1 p2 n / (G_basal p3)  [(mU/min)/(mg/dL/min)]."""
    return p.V1 * p.p2 * p.n / (p.G_basal * p.p3)


def ideal_ff_coefficients(p: Params) -> tuple[list[float], list[float]]:
    """Numerator / denominator polynomials (descending powers of s) of the ideal,
    improper Gf(s) = V1 (s+p2)(s+n) / (G_basal p3)."""
    c = p.V1 / (p.G_basal * p.p3)
    num = [c, c * (p.p2 + p.n), c * p.p2 * p.n]
    return num, [1.0]


@dataclass(frozen=True)
class FFConfig:
    enabled: bool = False
    mode: str = "bolus"             # bolus | leadlag (stretch)
    f_bolus: float = 1.0            # 0-1.2
    est_error: float = 0.0          # eps, -0.5..+0.5  (A_est = (1+eps) A_true)
    t_pre: float = 0.0              # min before the meal (0-30)
    suspend_integral: bool = False  # freeze PID integral during the bolus window
    suspend_extra: float = 0.0      # min the freeze continues after delivery ends
    tau_ld: float | None = None     # lead-lag lead [min]; None -> 1/p2 + 1/n
    tau_lg: float = 10.0            # lead-lag lag [min] -- user choice, not from a source


def bolus_total(meal: Meal, ff: FFConfig, p: Params) -> float:
    A_est = (1.0 + ff.est_error) * meal.amplitude
    return ff.f_bolus * static_ff_gain(p) * A_est / meal.k


class Feedforward:
    """Stateful helper called once per dt step by the simulator."""

    def __init__(self, ff: FFConfig, meals: tuple[Meal, ...], p: Params, dt: float):
        self.ff = ff
        self.p = p
        self.dt = dt
        self.Kf = static_ff_gain(p)
        # (start_time, total) for each announced meal, sorted
        self.boluses = sorted((m.t_meal - ff.t_pre, bolus_total(m, ff, p)) for m in meals)
        self.planned_total = sum(b for _, b in self.boluses)
        self.remaining = 0.0
        self._next = 0
        self.delivered = 0.0
        self.delivery_log: list[tuple[float, float]] = []   # (t_start, t_end) per bolus
        self._cur_start: float | None = None
        self._freeze_until = -math.inf
        # announced meals for lead-lag mode (estimate, shifted earlier by t_pre)
        self._ann = tuple(Meal(m.t_meal - ff.t_pre, m.multiplier * (1 + ff.est_error), m.A, m.k)
                          for m in meals)
        self._z = 0.0
        self.tau_ld = ff.tau_ld if ff.tau_ld is not None else 1.0 / p.p2 + 1.0 / p.n

    def bolus_active(self, t: float) -> bool:
        return self.remaining > 1e-9 or t < self._freeze_until

    def step(self, t: float, U_fb: float) -> float:
        """Feedforward rate [mU/min] for the step [t, t+dt)."""
        if not self.ff.enabled:
            return 0.0
        cap = max(self.p.U_max - U_fb, 0.0)
        if self.ff.mode == "leadlag":
            return self._leadlag(t, cap)
        eps = 1e-9
        while self._next < len(self.boluses) and t + eps >= self.boluses[self._next][0]:
            if self.remaining <= 1e-9:
                self._cur_start = t
            self.remaining += self.boluses[self._next][1]
            self._next += 1
        if self.remaining <= 1e-9:
            return 0.0
        rate = min(cap, self.remaining / self.dt)
        self.remaining -= rate * self.dt
        self.delivered += rate * self.dt
        if self.remaining <= 1e-9:
            self.remaining = 0.0
            self.delivery_log.append((self._cur_start, t + self.dt))
            self._freeze_until = t + self.dt + self.ff.suspend_extra
        return rate

    def _leadlag(self, t: float, cap: float) -> float:
        x = meal_rate(t, self._ann) * self.ff.f_bolus
        r = self.tau_ld / self.ff.tau_lg
        y = self.Kf * (r * x + (1.0 - r) * self._z)
        a = math.exp(-self.dt / self.ff.tau_lg)
        self._z = a * self._z + (1 - a) * x
        rate = min(max(y, 0.0), cap)
        self.delivered += rate * self.dt
        return rate
