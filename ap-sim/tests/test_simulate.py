import numpy as np
import pytest

from apsim.design import DesignSpec, pid_config
from apsim.disturbance import Meal
from apsim.feedforward import FFConfig, static_ff_gain
from apsim.params import DEFAULT_PARAMS as P
from apsim.presets import PRESETS
from apsim.sensor import SensorConfig
from apsim.simulate import SimConfig, simulate

PID10 = pid_config(DesignSpec(tau_c=20.0, theta_sensor=10.0, include_zoh=False))


def run(**kw):
    base = dict(pid=PID10, meals=(Meal(60.0),), t_end=660.0, sensor=SensorConfig(delay=10.0))
    base.update(kw)
    return simulate(SimConfig(**base))


def test_sensor_delay_shift():
    for delay in (0.0, 10.0, 7.3):
        r = simulate(SimConfig(controller="none", sensor=SensorConfig(delay=delay)))
        n = int(round(delay / r.t[1]))
        samples = np.arange(0, len(r.t), 50)          # sample instants
        samples = samples[samples >= n]
        assert np.allclose(r.G_meas[samples], r.G_true[samples - n], atol=1e-12)
        assert r.sensor_delay_effective == pytest.approx(n * 0.1)


def test_sensor_prefilled_basal():
    r = simulate(SimConfig(controller="none", sensor=SensorConfig(delay=10.0)))
    assert np.all(r.G_meas[r.t < 10.0 - 1e-9] == P.G_basal)


def test_measurement_held_between_samples():
    r = run()
    for k in range(0, 600, 50):
        assert np.all(r.G_meas[k:k + 50] == r.G_meas[k])


def test_saturation_all_presets():
    for name, (cfg, _) in PRESETS.items():
        r = simulate(cfg)
        assert r.valid, name
        assert np.all(r.U >= 0.0) and np.all(r.U <= 115.0), name


def test_bolus_total_and_limit():
    for tp in (0.0, 15.0, 30.0):
        for eps in (-0.5, 0.0, 0.5):
            r = run(ff=FFConfig(enabled=True, t_pre=tp, est_error=eps))
            target = static_ff_gain(P) * (1 + eps) * 9.0 / 0.05
            delivered = float(np.sum(r.U_ff[:-1] * np.diff(r.t)))
            assert delivered == pytest.approx(target, abs=1.0)
            assert r.bolus_delivered == pytest.approx(target, abs=1.0)
            assert np.all(r.U_fb + r.U_ff <= 115.0 + 1e-9)
            assert r.bolus_log[0][0] == pytest.approx(60.0 - tp)


def test_bolus_size_textbook():
    assert static_ff_gain(P) == pytest.approx(7.72, abs=0.01)
    assert static_ff_gain(P) * 180 == pytest.approx(1390, abs=1)


def test_prebolus_before_t0_warns():
    r = simulate(SimConfig(pid=PID10, ff=FFConfig(enabled=True, t_pre=15.0)))
    assert "before t=0" in r.message


def test_reproducibility_with_noise():
    a = run(sensor=SensorConfig(delay=10.0, noise_sd=5.0, seed=42))
    b = run(sensor=SensorConfig(delay=10.0, noise_sd=5.0, seed=42))
    c = run(sensor=SensorConfig(delay=10.0, noise_sd=5.0, seed=43))
    for k in ("G_true", "G_meas", "U"):
        assert np.array_equal(getattr(a, k), getattr(b, k))
    assert not np.array_equal(a.G_meas, c.G_meas)


def test_config_hashable():
    hash(SimConfig(pid=PID10))


def test_sanity_targets():
    """Plan Sec. 14 sanity targets (+/- 5 mg/dL)."""
    fb = run()
    assert fb.G_true.max() == pytest.approx(163, abs=5)
    assert fb.G_true.min() == pytest.approx(52, abs=5)
    pre = run(ff=FFConfig(enabled=True, t_pre=15.0))
    assert pre.G_true.max() == pytest.approx(108, abs=5)
    assert pre.G_true.min() == pytest.approx(63, abs=5)
    assert pre.G_true.min() > 54 and pre.G_true.max() < 144
    at = run(ff=FFConfig(enabled=True, t_pre=0.0))
    assert at.G_true.max() == pytest.approx(139, abs=5)
    assert at.G_true.min() == pytest.approx(50, abs=5)


def test_dropout_holds_output():
    r = run(sensor=SensorConfig(delay=10.0, fault="dropout", t_fault=100.0, dropout_duration=30.0))
    m = (r.t >= 100.0) & (r.t < 130.0)
    assert np.all(np.isnan(r.G_meas[m]))
    assert np.all(r.U_fb[m] == r.U_fb[np.argmax(m) - 1])
    assert r.dropout[m].any()


def test_stuck_sensor():
    r = run(sensor=SensorConfig(delay=10.0, fault="stuck", t_fault=200.0))
    assert np.all(r.G_meas[r.t >= 200.0] == r.G_meas[np.argmax(r.t >= 200.0) - 1])


def test_sensor_lag_steady_state():
    r = run(sensor=SensorConfig(delay=0.0, lag=10.0), meals=())
    assert np.allclose(r.G_meas, P.G_basal)


def test_sensitivity_change_runs():
    r = run(sensitivity_change=(120.0, 1.5))
    assert r.valid


def test_model_invalid_guard():
    r = simulate(SimConfig(controller="none", U_open_loop=1e6, meals=(), saturation=False,
                           t_end=600.0))
    assert not r.valid and "invalid" in r.message
