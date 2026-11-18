import math

import numpy as np
import pytest

from apsim.controller import PID, PIDConfig
from apsim.params import DEFAULT_PARAMS as P

KC, TI, TD = -0.426, 70.3, 17.6


def make(aw="clamp", **kw):
    cfg = PIDConfig(Kc=KC, tauI=TI, tauD=TD, anti_windup=aw, **kw)
    return PID(cfg, 5.0, P.U_basal, P.U_min, P.U_max)


def test_sign_high_glucose_raises_insulin():
    c = make()
    U = c.update(P.G_basal, P.G_basal + 10.0)
    assert U > P.U_basal
    c = make()
    assert c.update(P.G_basal, P.G_basal - 10.0) < P.U_basal


def test_output_always_within_limits():
    c = make()
    rng = np.random.default_rng(1)
    for m in rng.uniform(0, 500, 500):
        U = c.update(P.G_basal, m)
        assert P.U_min <= U <= P.U_max


def _saturate_high(aw, n=200):
    """Glucose stuck at 400 mg/dL -> feedback wants far more than U_max."""
    c = make(aw)
    S = []
    for _ in range(n):
        c.update(P.G_basal, 400.0)
        S.append(c.S)
    return c, np.array(S)


def test_clamp_stops_integrating_when_saturated_high():
    c, S = _saturate_high("clamp")
    assert c.saturated
    # integral state must stop moving in the saturating direction (S decreasing => more insulin)
    assert np.all(np.diff(S[5:]) == 0.0)


def test_backcalc_stops_integrating_when_saturated_high():
    c, S = _saturate_high("backcalc")
    assert np.max(np.abs(np.diff(S[-50:]))) < 1e-6
    _, S_off = _saturate_high("off")
    assert abs(S[-1]) < 0.2 * abs(S_off[-1])


def test_off_winds_up():
    _, S = _saturate_high("off")
    assert np.all(np.diff(S) < 0)


def test_clamp_low_saturation():
    """Glucose very low -> PID wants U < 0 -> integral (which would push lower) frozen."""
    c = make("clamp")
    S = []
    for _ in range(100):
        c.update(P.G_basal, 20.0)
        S.append(c.S)
    assert c.U == P.U_min
    assert np.all(np.diff(S[5:]) == 0.0)


def test_clamp_uses_sign_of_Kc_e_not_e():
    """Saturated HIGH with e < 0 (high glucose).  Because Kc < 0, Kc*e > 0 pushes further
    into saturation -> must be rejected.  A naive 'e > 0' test would let it integrate."""
    c = make("clamp")
    c.update(P.G_basal, 400.0)
    S0 = c.S
    c.update(P.G_basal, 400.0)
    assert c.u_raw > P.U_max and c.S == S0
    # Now glucose drops below set point while still saturated (possible via big S):
    # Kc*e < 0 means the update would REDUCE insulin, so it must be accepted.
    c.S = -2e5
    c.update(P.G_basal, P.G_basal - 5.0)
    assert c.u_raw > P.U_max
    assert c.S == pytest.approx(-2e5 + 5.0 * 5.0)


def test_backcalc_unwinds_when_saturated():
    c = make("backcalc")
    c.S = -2e5   # hugely wound up toward more insulin
    S0 = c.S
    c.update(P.G_basal, P.G_basal + 10.0)
    assert c.S > S0   # pulled back toward the limit


def test_no_derivative_kick_on_setpoint_step():
    c = make()
    for _ in range(5):
        c.update(P.G_basal, P.G_basal)
    U0 = c.U
    dr = -20.0
    U1 = c.update(P.G_basal + dr, P.G_basal)
    # only the P term (and one sample of integral) respond; no tauD/Ts-sized spike
    expected = U0 + KC * dr + KC / TI * dr * 5.0
    assert U1 == pytest.approx(expected, abs=1e-9)
    assert c.d == 0.0


def test_derivative_filter_and_bumpless_start():
    c = make()
    U = c.update(P.G_basal, P.G_basal + 30.0)  # first sample: m_{-1} = m_0 -> no D kick
    assert c.d == 0.0
    tau_f = TD / 10
    assert c.alpha == pytest.approx(tau_f / (tau_f + 5.0))


def test_nan_measurement_holds_output():
    c = make()
    U = c.update(P.G_basal, 150.0)
    S = c.S
    assert c.update(P.G_basal, math.nan) == U
    assert c.S == S


def test_pi_mode():
    cfg = PIDConfig(Kc=KC, tauI=TI, tauD=0.0, anti_windup="backcalc")
    c = PID(cfg, 5.0, P.U_basal, P.U_min, P.U_max)
    assert c.Tt == TI
    c.update(P.G_basal, 100.0)
    assert c.U > P.U_basal
