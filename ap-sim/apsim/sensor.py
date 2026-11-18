"""CGM model (Sec. 8): delay, optional first-order lag, Gaussian noise, faults.

Implementation notes
--------------------
* Lag and delay are both LTI, so they commute.  The first-order lag
  (tau_s dGl/dt = G - Gl) is integrated as a 4th state inside the main RK4 loop
  on the *true* glucose; the delay is then applied to the lagged signal with a
  history buffer sampled every dt.  delay_steps = round(theta_s / dt).
* The buffer is pre-filled with basal glucose, so before t = theta_s the sensor
  reads basal.
* Noise uses a seeded numpy Generator, one draw per sample instant.
* Faults: 'stuck' holds the last pre-fault reading; 'drift' adds rate*(t - t_fault)/60;
  'dropout' returns NaN for t_fault <= t < t_fault + duration.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class SensorConfig:
    delay: float = 10.0          # min (Seborg Ex. 23.6(e) default)
    lag: float = 0.0             # min, first-order lag time constant (0 = none)
    noise_sd: float = 0.0        # mg/dL
    seed: int = 0
    fault: str = "none"          # none | stuck | drift | dropout
    t_fault: float = 60.0        # min
    drift_rate: float = 0.0      # mg/dL per hour (for 'drift')
    dropout_duration: float = 30.0  # min (for 'dropout')


class Sensor:
    def __init__(self, cfg: SensorConfig, dt: float, G_init_abs: float):
        self.cfg = cfg
        self.dt = dt
        self.delay_steps = int(round(cfg.delay / dt))
        self.effective_delay = self.delay_steps * dt
        # ring buffer of length delay_steps+1, pre-filled at the initial (basal) value
        self._buf = np.full(self.delay_steps + 1, G_init_abs, dtype=float)
        self._idx = 0
        self._rng = np.random.default_rng(cfg.seed)
        self._last_good: float | None = None

    def push(self, G_abs: float) -> None:
        """Store the (lagged) true glucose for the current dt step."""
        self._idx = (self._idx + 1) % self._buf.size
        self._buf[self._idx] = G_abs

    def delayed(self) -> float:
        """Signal from delay_steps ago (oldest entry in the ring)."""
        return float(self._buf[(self._idx + 1) % self._buf.size])

    def read(self, t: float) -> float:
        """Sample the CGM at time t (called only at sample instants)."""
        c = self.cfg
        y = self.delayed()
        if c.noise_sd > 0:
            y += float(self._rng.normal(0.0, c.noise_sd))
        if c.fault == "stuck" and t >= c.t_fault:
            if self._last_good is None:
                self._last_good = y
            return self._last_good
        if c.fault == "drift" and t >= c.t_fault:
            y += c.drift_rate * (t - c.t_fault) / 60.0
        if c.fault == "dropout" and c.t_fault <= t < c.t_fault + c.dropout_duration:
            return math.nan
        self._last_good = y
        return y
