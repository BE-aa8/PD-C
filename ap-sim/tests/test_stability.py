import math

import pytest

from apsim.design import DesignSpec, design, pid_config
from apsim.linearize import linearize
from apsim.params import DEFAULT_PARAMS as P
from apsim.stability import empirical_max_delay, margins

LM = linearize(P)


def _m(theta_s, theta_loop=0.0):
    tun, _ = design(DesignSpec(tau_c=20.0, theta_sensor=theta_s, include_zoh=False))
    return tun, margins(LM, tun.Kc, tun.tauI, tun.tauD, 10.0, theta_loop)


def test_reference_theta0():
    tun, m = _m(0.0)
    assert tun.Kc == pytest.approx(-0.574, rel=0.05)
    assert m.wc == pytest.approx(0.0358, rel=0.05)
    assert m.PM_deg == pytest.approx(68, rel=0.05)
    assert m.total_tolerable_delay == pytest.approx(33, rel=0.05)


def test_reference_theta10():
    tun, m = _m(10.0)
    assert tun.Kc == pytest.approx(-0.426, rel=0.05)
    assert m.wc == pytest.approx(0.0269, rel=0.05)
    assert m.PM_deg == pytest.approx(74, rel=0.05)
    assert m.total_tolerable_delay == pytest.approx(48, rel=0.05)


def test_delay_in_loop_consistent():
    _, m0 = _m(10.0, 0.0)
    _, m10 = _m(10.0, 10.0)
    assert m10.wc == pytest.approx(m0.wc)
    assert m10.total_tolerable_delay == pytest.approx(m0.total_tolerable_delay)
    assert m10.dtheta_max == pytest.approx(m0.dtheta_max - 10.0)


def test_margin_definition_at_limit():
    """Adding exactly d_theta_max of delay must put the loop on the stability boundary."""
    tun, m = _m(10.0)
    mm = margins(LM, tun.Kc, tun.tauI, tun.tauD, 10.0, m.dtheta_max)
    assert mm.PM_deg == pytest.approx(0.0, abs=1e-6)


def test_empirical_close_to_analytic():
    pc = pid_config(DesignSpec(tau_c=20.0, theta_sensor=10.0, include_zoh=False))
    emp = empirical_max_delay(pc, lo=20.0, hi=80.0, tol=1.0, t_end=2500.0)
    _, m = _m(10.0)
    # sampling adds ~Ts/2 = 2.5 min of delay, so the sampled loop goes unstable earlier
    assert math.isfinite(emp)
    assert m.total_tolerable_delay - 10.0 < emp < m.total_tolerable_delay + 2.0
