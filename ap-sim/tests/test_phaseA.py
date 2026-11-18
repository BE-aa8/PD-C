"""Tests added in completion Phase A (audit fixes B3, B4, B8)."""
from dataclasses import replace

import numpy as np
import pytest

from apsim.disturbance import Meal
from apsim.feedforward import FFConfig, static_ff_gain
from apsim.metrics import compute_metrics
from apsim.params import DEFAULT_PARAMS as P, G_VALIDITY_LOW, Params
from apsim.presets import SCENARIOS, build_config
from apsim.sensor import SensorConfig
from apsim.simulate import SimConfig, simulate

BASE = SCENARIOS["IMC-PID with 10-min sensor delay (Ex. 23.6e)"][0]


def test_metrics_use_param_pump_limits():
    """B3: time-at-U_max must follow params.U_max, not a hard-coded 115."""
    p = Params(U_max=60.0)
    r = simulate(build_config(replace(BASE, params=p, meals=(Meal(60.0, 2.0),))))
    assert r.U.max() == pytest.approx(60.0)
    m = compute_metrics(r)
    assert m["time_at_U_max"] > 0
    assert m["time_at_U_max"] == pytest.approx(float(np.sum(np.diff(r.t)[(r.U >= 60.0 - 1e-9)[:-1]])))


def test_validity_warning_on_deep_low():
    """B4: a drift fault drives glucose far below the model's meaningful range -> warning."""
    r = simulate(build_config(replace(BASE, sensor=SensorConfig(delay=10.0, fault="drift", t_fault=60.0,
                                                                 drift_rate=30.0))))
    assert r.G_true.min() < G_VALIDITY_LOW
    assert "qualitative only" in r.message


def test_no_validity_warning_normally():
    r = simulate(build_config(BASE))
    assert "qualitative" not in r.message


def test_leadlag_preserves_static_gain_when_unclipped():
    """B8: with tau_ld < tau_lg the lead-lag output never goes negative and stays below the pump
    capacity, so total FF insulin equals Kf * meal area (minus the small tail after t_end)."""
    sc = replace(BASE, t_end=1000.0, meals=(Meal(60.0, 0.2),),
                 ff=FFConfig(enabled=True, mode="leadlag", tau_ld=5.0, tau_lg=10.0))
    r = simulate(build_config(sc))
    total = float(np.sum(r.U_ff[:-1] * np.diff(r.t)))
    assert total == pytest.approx(static_ff_gain(P) * 0.2 * 9.0 / 0.05, rel=0.01)


def test_leadlag_default_overdelivers_due_to_clipping():
    """Documented finding: the default lead (1/p2 + 1/n ~ 46 min) >> lag (10 min) makes the
    filter output swing negative after the meal. The pump clips at zero, so total FF insulin
    EXCEEDS the static-gain match. This test pins that behaviour so it is not silently lost."""
    sc = replace(BASE, meals=(Meal(60.0, 0.2),), ff=FFConfig(enabled=True, mode="leadlag"))
    r = simulate(build_config(sc))
    total = float(np.sum(r.U_ff[:-1] * np.diff(r.t)))
    static = static_ff_gain(P) * 0.2 * 9.0 / 0.05
    assert np.all(r.U_ff >= 0) and np.all(r.U <= P.U_max + 1e-9)
    assert total > 1.3 * static
