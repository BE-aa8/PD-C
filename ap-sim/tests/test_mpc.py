from dataclasses import replace

import numpy as np
import pytest

from apsim.mpc import MPC, MPCConfig
from apsim.params import DEFAULT_PARAMS as P
from apsim.presets import SCENARIOS, build_config
from apsim.sensor import SensorConfig
from apsim.simulate import SimConfig, simulate

BASE = SCENARIOS["IMC-PID with 10-min sensor delay (Ex. 23.6e)"][0]


def test_basal_stays_basal():
    r = simulate(SimConfig(controller="mpc", mpc=MPCConfig(), meals=()))
    assert np.allclose(r.U, P.U_basal, atol=1e-6)
    assert np.allclose(r.G_true, P.G_basal, atol=1e-6)


@pytest.mark.parametrize("dm", ["output", "meal"])
def test_prediction_matrices_match_model(dm):
    """Phi must reproduce the linear model response to a unit input sequence at the sample instants."""
    m = MPC(MPCConfig(dist_model=dm), P, 5.0, 10.0, P.U_min, P.U_max)
    u = np.ones(m.cfg.horizon)
    xi = np.zeros_like(m.xi)
    G = []
    for k in range(m.cfg.horizon):
        xi = m.A @ xi + m.Bu * u[k]
        G.append(xi[0])
    assert np.allclose(m.Phi @ u, G)


def test_bounds_and_beats_pid_on_nadir():
    rp = simulate(build_config(BASE))
    rm = simulate(build_config(replace(BASE, controller="mpc", mpc=MPCConfig())))
    assert np.all((rm.U >= 0) & (rm.U <= 115))
    assert rm.G_true.min() > rp.G_true.min() + 10
    assert rm.G_true[-1] == pytest.approx(P.G_basal, abs=1.0)


def test_announced_meal_used_in_prediction():
    a = simulate(build_config(replace(BASE, controller="mpc", mpc=MPCConfig())))
    b = simulate(build_config(replace(BASE, controller="mpc", mpc=MPCConfig(),
                                      ff=replace(BASE.ff, enabled=True))))
    assert b.G_true.max() < a.G_true.max() - 30
    assert np.all(b.U_ff == 0)


def test_dropout_handled():
    r = simulate(build_config(replace(BASE, controller="mpc", mpc=MPCConfig(),
                                      sensor=SensorConfig(delay=10.0, fault="dropout", t_fault=80.0))))
    assert r.valid and np.all(np.isfinite(r.U))
