import numpy as np
import pytest

from apsim.design import reduced_models
from apsim.linearize import linearize
from apsim.params import DEFAULT_PARAMS as P
from apsim.reduce import effective_dead_time, half_rule, sopdt_step


def test_half_rule():
    lm = linearize(P)
    s, f = half_rule(lm.Kp, lm.taus)
    assert (s.tau1, s.tau2, s.theta) == pytest.approx((35.28, 40.20, 5.40), abs=0.01)
    assert (f.tau, f.theta) == pytest.approx((52.68, 28.20), abs=0.01)
    assert s.K == f.K == pytest.approx(-4.506, abs=1e-3)


def test_fits():
    rm = reduced_models(P)
    s, f = rm["fit_sopdt"], rm["fit_fopdt"]
    rel = 0.03
    assert s.K == pytest.approx(-4.27, rel=rel)
    assert s.tau1 == pytest.approx(35.1, rel=rel)
    assert s.tau2 == pytest.approx(35.1, rel=rel)
    assert s.theta == pytest.approx(8.7, rel=rel)
    assert f.K == pytest.approx(-4.29, rel=rel)
    assert f.tau == pytest.approx(56.6, rel=rel)
    assert f.theta == pytest.approx(25.6, rel=rel)
    # SOPDT should fit far better than FOPDT
    assert rm["fit_sopdt_stats"].rmse < rm["fit_fopdt_stats"].rmse


def test_sopdt_equal_tau_limit_is_continuous():
    t = np.linspace(0, 300, 301)
    a = sopdt_step(t, -4.0, 35.0, 35.0, 5.0)
    b = sopdt_step(t, -4.0, 35.0 * (1 + 1e-4), 35.0, 5.0)
    assert np.max(np.abs(a - b)) < 1e-3
    assert np.all(np.isfinite(a))


def test_effective_dead_time():
    assert effective_dead_time(8.7, 10.0, 5.0)["theta_total"] == pytest.approx(18.7)
    d = effective_dead_time(8.7, 10.0, 5.0, include_zoh=True)
    assert d["theta_total"] == pytest.approx(21.2)
    assert d["theta_zoh"] == 2.5
