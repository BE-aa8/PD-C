"""Shared helpers for the generator scripts: import the Python reference (ap-sim/apsim) and map
the website's `simulate(inputs)` contract (plan-v2-final.md §9.1) onto it."""
from __future__ import annotations

import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "ap-sim"))

from apsim.controller import PIDConfig            # noqa: E402
from apsim.design import DesignSpec, design, reduced_models  # noqa: E402
from apsim.disturbance import Meal                 # noqa: E402
from apsim.feedforward import FFConfig             # noqa: E402
from apsim.params import DEFAULT_PARAMS as P       # noqa: E402
from apsim.sensor import SensorConfig              # noqa: E402
from apsim.simulate import SimConfig, simulate     # noqa: E402

MODEL_TO_METHOD = {"fit_sopdt": "imc_fit_sopdt", "half_sopdt": "imc_half_sopdt",
                   "fit_fopdt_pi": "imc_fit_fopdt_pi", "fit_fopdt_pid": "imc_fit_fopdt_pid",
                   "half_fopdt_pi": "imc_half_fopdt_pi"}


def imc(model="fit_sopdt", tau_c=20.0, theta_sensor=10.0, Ts=5.0, include_zoh=False):
    tun, info = design(DesignSpec(method=MODEL_TO_METHOD[model], tau_c=tau_c, theta_sensor=theta_sensor,
                                  Ts=Ts, include_zoh=include_zoh), P)
    return {"Kc": float(tun.Kc), "tauI": float(tun.tauI), "tauD": float(tun.tauD),
            "theta_total": float(info["theta_total"])}


DEFAULT_TUNING = imc()

DEFAULT_INPUTS = {
    "t_end": 660.0, "dt": 0.1, "Ts": 5.0,
    "controller": "pid", "mode": "PID",
    "Kc": DEFAULT_TUNING["Kc"], "tauI": DEFAULT_TUNING["tauI"], "tauD": DEFAULT_TUNING["tauD"],
    "N": 10.0, "beta": 1.0, "anti_windup": "clamp", "U_open_loop": None,
    "setpoint": 81.0, "setpoint_steps": [],
    "sensor_delay": 10.0, "sensor_lag": 0.0, "noise_sd": 0.0, "seed": 0,
    "fault": "none", "t_fault": 60.0, "drift_rate": 0.0, "dropout_duration": 30.0,
    "meals": [[60.0, 1.0]],
    "ff_enabled": False, "f_bolus": 1.0, "est_error": 0.0, "t_pre": 0.0,
    "suspend_integral": False, "suspend_extra": 0.0,
    "sensitivity_change": None, "saturation": True,
}


def to_simconfig(overrides: dict) -> SimConfig:
    x = {**DEFAULT_INPUTS, **overrides}
    tauI, tauD = x["tauI"], x["tauD"]
    if x["mode"] == "PI":
        tauD = 0.0
    elif x["mode"] == "P":
        tauI, tauD = math.inf, 0.0
    pid = PIDConfig(Kc=x["Kc"], tauI=tauI, tauD=tauD, N=x["N"], beta=x["beta"], anti_windup=x["anti_windup"])
    return SimConfig(
        params=P, t_end=x["t_end"], dt=x["dt"], Ts=x["Ts"], controller=x["controller"],
        pid=pid if x["controller"] == "pid" else None, U_open_loop=x["U_open_loop"],
        setpoint=x["setpoint"], setpoint_steps=tuple(tuple(s) for s in x["setpoint_steps"]),
        sensor=SensorConfig(delay=x["sensor_delay"], lag=x["sensor_lag"], noise_sd=x["noise_sd"], seed=x["seed"],
                            fault=x["fault"], t_fault=x["t_fault"], drift_rate=x["drift_rate"],
                            dropout_duration=x["dropout_duration"]),
        meals=tuple(Meal(float(t), float(m)) for t, m in x["meals"]),
        ff=FFConfig(enabled=x["ff_enabled"], f_bolus=x["f_bolus"], est_error=x["est_error"], t_pre=x["t_pre"],
                    suspend_integral=x["suspend_integral"], suspend_extra=x["suspend_extra"]),
        sensitivity_change=tuple(x["sensitivity_change"]) if x["sensitivity_change"] else None,
        saturation=x["saturation"],
    )


def run(overrides: dict):
    return simulate(to_simconfig(overrides))


def compare(new, old, rel=1e-6, abs_=1e-6, path="") -> list[str]:
    """Numeric-tolerant structural comparison used by the --check modes."""
    errs = []
    if isinstance(new, dict) and isinstance(old, dict):
        for k in set(new) | set(old):
            if k not in new or k not in old:
                errs.append(f"{path}.{k}: key only in {'new' if k in new else 'committed'}")
            else:
                errs += compare(new[k], old[k], rel, abs_, f"{path}.{k}")
    elif isinstance(new, list) and isinstance(old, list):
        if len(new) != len(old):
            errs.append(f"{path}: length {len(new)} vs {len(old)}")
        else:
            for i, (a, b) in enumerate(zip(new, old)):
                errs += compare(a, b, rel, abs_, f"{path}[{i}]")
    elif isinstance(new, (int, float)) and isinstance(old, (int, float)) and not isinstance(new, bool):
        if not (abs(new - old) <= abs_ + rel * abs(old)):
            errs.append(f"{path}: {new} vs committed {old}")
    elif new != old:
        errs.append(f"{path}: {new!r} vs committed {old!r}")
    return errs
