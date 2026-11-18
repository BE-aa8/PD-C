import pytest

from apsim.design import DesignSpec, design, reduced_models
from apsim.reduce import FOPDT, SOPDT
from apsim.tuning import imc_fopdt_pi, imc_fopdt_pid, imc_sopdt_pid


def test_imc_reference_sopdt_fit():
    """Plan Sec. 6 reference: SOPDT fit, theta_s = 10, tau_c = 20 (theta_total WITHOUT Ts/2)."""
    tun, info = design(DesignSpec(tau_c=20.0, theta_sensor=10.0, include_zoh=False))
    assert tun.Kc == pytest.approx(-0.426, rel=0.01)
    assert tun.tauI == pytest.approx(70.3, rel=0.01)
    assert tun.tauD == pytest.approx(17.6, rel=0.01)


def test_formulas():
    s = SOPDT(-2.0, 30.0, 10.0, 5.0)
    t = imc_sopdt_pid(s, 15.0)
    assert t.Kc == pytest.approx(40 / (-2 * 20)) and t.tauI == 40 and t.tauD == pytest.approx(7.5)
    f = FOPDT(-2.0, 30.0, 6.0)
    t = imc_fopdt_pi(f, 14.0)
    assert t.Kc == pytest.approx(30 / (-2 * 20)) and t.tauI == 30 and t.tauD == 0
    t = imc_fopdt_pid(f, 7.0)
    assert t.Kc == pytest.approx(33 / (-2 * 10)) and t.tauI == 33
    assert t.tauD == pytest.approx(30 * 6 / 66)


def test_default_tau_c_is_theta_total():
    tun, info = design(DesignSpec(tau_c=None, theta_sensor=10.0))
    assert info["tau_c"] == pytest.approx(info["theta_total"])
    assert info["theta_total"] == pytest.approx(reduced_models()["fit_sopdt"].theta + 12.5)


def test_negative_gain():
    for m in ("imc_fit_sopdt", "imc_half_sopdt", "imc_fit_fopdt_pi", "imc_fit_fopdt_pid",
              "zn_fit_fopdt", "cohen_coon_fit_fopdt"):
        tun, _ = design(DesignSpec(method=m, tau_c=20.0))
        assert tun.Kc < 0
