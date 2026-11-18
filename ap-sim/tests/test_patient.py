import numpy as np
import pytest
from scipy.integrate import solve_ivp

from apsim.disturbance import Meal, meal_rate
from apsim.params import DEFAULT_PARAMS as P
from apsim.patient import patient_rhs
from apsim.simulate import SimConfig, simulate


def open_loop(**kw):
    return simulate(SimConfig(controller="none", **kw))


def test_U_basal():
    assert P.U_basal == pytest.approx(16.668, abs=1e-3)
    assert P.authority_ratio == pytest.approx(16.668 / (115 - 16.668), rel=1e-9)


def test_basal_steady_state():
    r = open_loop(meals=(), t_end=1000.0)
    assert np.max(np.abs(r.G_true - P.G_basal)) < 1e-9
    assert np.max(np.abs(r.X)) < 1e-9
    assert np.max(np.abs(r.I)) < 1e-9


def test_open_loop_meal_peak():
    r = open_loop()
    i = np.argmax(r.G_true)
    assert r.G_true[i] - P.G_basal == pytest.approx(85.15, abs=0.2)
    assert r.t[i] == pytest.approx(26.0, abs=0.3)


def test_open_loop_analytic():
    """X == 0 open loop, so G(t) = 9/(0.05 - p1) (e^{-p1 t} - e^{-0.05 t})."""
    r = open_loop()
    G = 9.0 / (0.05 - P.p1) * (np.exp(-P.p1 * r.t) - np.exp(-0.05 * r.t))
    assert np.max(np.abs(r.G_true - P.G_basal - G)) < 0.01
    assert np.max(np.abs(r.X)) == 0.0


def _lsoda(U_const, t_end):
    meals = (Meal(0.0),)
    sol = solve_ivp(lambda t, x: patient_rhs(x, U_const, meal_rate(t, meals), P), (0, t_end),
                    [0, 0, 0], method="LSODA", rtol=1e-8, atol=1e-10, dense_output=True)
    return sol


def test_rk4_vs_lsoda_open_loop():
    r = open_loop()
    sol = _lsoda(P.U_basal, 600.0)
    assert np.max(np.abs(sol.sol(r.t)[0] + P.G_basal - r.G_true)) < 0.05


def test_rk4_vs_lsoda_nonzero_insulin():
    """Exercise the bilinear X*G term too: constant U above basal plus a meal."""
    U = P.U_basal + 20.0
    r = open_loop(U_open_loop=U)
    sol = _lsoda(U, 600.0)
    assert np.max(np.abs(sol.sol(r.t)[0] + P.G_basal - r.G_true)) < 0.05


def test_d_mode_hold_vs_substep():
    a = open_loop(d_mode="substep")
    b = open_loop(d_mode="hold_mid")
    assert np.max(np.abs(a.G_true - b.G_true)) < 0.1
    # left-endpoint hold is first order: error ~0.21 at dt=0.1, halves with dt
    c1 = np.max(np.abs(open_loop(d_mode="hold").G_true - a.G_true))
    c2 = np.max(np.abs(open_loop(d_mode="hold", dt=0.05).G_true - open_loop(dt=0.05).G_true))
    assert 0.15 < c1 < 0.3 and c2 / c1 == pytest.approx(0.5, abs=0.05)


def test_dt_convergence():
    a = open_loop(dt=0.1)
    b = open_loop(dt=0.05)
    assert np.max(np.abs(a.G_true - b.G_true[::2])) < 1e-4


def test_meal_area():
    assert Meal(0.0).area == pytest.approx(180.0)
    assert Meal(0.0, 0.5).area == pytest.approx(90.0)
