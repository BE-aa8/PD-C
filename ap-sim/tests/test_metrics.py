import numpy as np
import pytest

from apsim.metrics import glucose_metrics, settling_time, time_fraction


def test_time_fraction_exact():
    t = np.linspace(0, 100, 1001)
    G = np.where((t >= 20) & (t < 50), 200.0, 100.0)    # 30 % above band
    m = glucose_metrics(t, G, np.full_like(t, 100.0))
    assert m["pct_above_band_high"] == pytest.approx(30.0, abs=0.1)
    assert m["pct_in_band"] == pytest.approx(70.0, abs=0.1)
    assert m["pct_above_180"] == pytest.approx(30.0, abs=0.1)
    assert m["stayed_in_band"] is False


def test_sine_fraction():
    t = np.linspace(0, 1000, 100001)
    G = 100 + 50 * np.sin(2 * np.pi * t / 100)      # above 144 when sin > 0.88
    frac = (np.pi - 2 * np.arcsin(44 / 50)) / (2 * np.pi)
    m = glucose_metrics(t, G, np.full_like(t, 100.0))
    assert m["pct_above_band_high"] == pytest.approx(100 * frac, abs=0.02)


def test_peak_nadir_iae():
    t = np.linspace(0, 10, 101)
    G = 100 + t
    m = glucose_metrics(t, G, np.full_like(t, 100.0))
    assert m["peak"] == 110 and m["t_peak"] == 10
    assert m["IAE"] == pytest.approx(50.0)


def test_settling():
    t = np.linspace(0, 100, 1001)
    G = np.where(t < 40, 120.0, 100.0)
    assert settling_time(t, G, np.full_like(t, 100.0), 0.0) == pytest.approx(40.0, abs=0.11)
