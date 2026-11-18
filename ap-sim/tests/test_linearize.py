import numpy as np
import pytest

from apsim.linearize import (linear_step, linearize, nonlinear_gain_curve, nonlinear_step,
                             numerical_jacobian)
from apsim.params import DEFAULT_PARAMS as P

LM = linearize(P)


def test_gain_and_time_constants():
    assert LM.Kp == pytest.approx(-4.506, abs=1e-3)
    assert LM.tau_G == pytest.approx(34.80, abs=0.01)
    assert LM.tau_X == pytest.approx(35.28, abs=0.01)
    assert LM.tau_I == pytest.approx(10.80, abs=0.01)
    assert LM.Kd == pytest.approx(34.80, abs=0.01)


def test_poles():
    poles = np.sort(np.linalg.eigvals(LM.A).real)
    assert np.allclose(poles, np.sort([-P.p1, -P.p2, -P.n]))
    assert np.allclose(np.sort(np.roots(LM.den_p).real), np.sort([-P.p1, -P.p2, -P.n]))


def test_A_matches_numerical_jacobian():
    assert np.allclose(numerical_jacobian(P), LM.A, atol=1e-8)


def test_tf_dc_gain_matches_state_space():
    ss_gain = (LM.C @ np.linalg.solve(-LM.A, LM.B_u))[0, 0]
    assert LM.Gp(0.0) == pytest.approx(LM.Kp)
    assert ss_gain == pytest.approx(LM.Kp)
    assert LM.Gd(0.0) == pytest.approx(LM.Kd)


def test_linear_step_final_value():
    t = np.linspace(0, 2000, 4001)
    assert linear_step(LM, t)[-1] == pytest.approx(LM.Kp, rel=1e-4)


def test_nonlinear_gain_unit_step():
    t, y = nonlinear_step(1.0, t_end=1500.0)
    assert y[-1] / 1.0 == pytest.approx(-4.27, abs=0.02)
    assert nonlinear_gain_curve(P, np.array([1.0]))[0] == pytest.approx(y[-1], abs=1e-3)


def test_linear_vs_nonlinear_small_step():
    t, y = nonlinear_step(0.01, t_end=1500.0)
    assert y[-1] / 0.01 == pytest.approx(LM.Kp, rel=0.005)


def test_gain_shrinks_with_insulin():
    g = nonlinear_gain_curve(P, np.array([-16.0, -5.0, 5.0, 50.0, 98.0]))
    assert np.all(np.diff(np.abs(g)) < 0)
