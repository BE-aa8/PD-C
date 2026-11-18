"""Glue: model reduction -> IMC tuning -> PIDConfig.  Pure Python, cached."""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache

from .controller import PIDConfig
from .linearize import linearize
from .params import DEFAULT_PARAMS, Params
from .reduce import effective_dead_time, fit_nonlinear_step, half_rule
from .tuning import (PIDTuning, cohen_coon_pid, imc_fopdt_pi, imc_fopdt_pid, imc_sopdt_pid,
                     ziegler_nichols_reaction_curve_pid)

METHODS = ("imc_fit_sopdt", "imc_half_sopdt", "imc_fit_fopdt_pi", "imc_fit_fopdt_pid",
           "imc_half_fopdt_pi", "zn_fit_fopdt", "cohen_coon_fit_fopdt")


@lru_cache(maxsize=8)
def reduced_models(p: Params = DEFAULT_PARAMS):
    lm = linearize(p)
    sop_h, fop_h = half_rule(lm.Kp, lm.taus)
    t, y, sop_f, fop_f = fit_nonlinear_step(1.0, 600.0, 0.1, p)
    return {"half_sopdt": sop_h, "half_fopdt": fop_h, "fit_sopdt": sop_f.model,
            "fit_fopdt": fop_f.model, "fit_sopdt_stats": sop_f, "fit_fopdt_stats": fop_f,
            "t": t, "y": y}


@dataclass(frozen=True)
class DesignSpec:
    method: str = "imc_fit_sopdt"
    tau_c: float | None = None      # None -> tau_c = theta_total
    theta_sensor: float = 10.0
    Ts: float = 5.0
    include_zoh: bool = True        # add Ts/2 to theta_total (Sec. 5.3)
    N: float = 10.0
    beta: float = 1.0
    anti_windup: str = "clamp"


def design(spec: DesignSpec, p: Params = DEFAULT_PARAMS) -> tuple[PIDTuning, dict]:
    rm = reduced_models(p)
    src, kind = {
        "imc_fit_sopdt": ("fit_sopdt", "sopdt"), "imc_half_sopdt": ("half_sopdt", "sopdt"),
        "imc_fit_fopdt_pi": ("fit_fopdt", "pi"), "imc_fit_fopdt_pid": ("fit_fopdt", "fpid"),
        "imc_half_fopdt_pi": ("half_fopdt", "pi"), "zn_fit_fopdt": ("fit_fopdt", "zn"),
        "cohen_coon_fit_fopdt": ("fit_fopdt", "cc"),
    }[spec.method]
    m = rm[src]
    dt_info = effective_dead_time(m.theta, spec.theta_sensor, spec.Ts, spec.include_zoh)
    th = dt_info["theta_total"]
    tau_c = th if spec.tau_c is None else spec.tau_c
    fn = {"sopdt": imc_sopdt_pid, "pi": imc_fopdt_pi, "fpid": imc_fopdt_pid}.get(kind)
    if fn is not None:
        tun = fn(m, tau_c, th)
    elif kind == "zn":
        tun = ziegler_nichols_reaction_curve_pid(m, th)
    else:
        tun = cohen_coon_pid(m, th)
    return tun, {"model": m, "model_name": src, **dt_info, "tau_c": tau_c}


def pid_config(spec: DesignSpec, p: Params = DEFAULT_PARAMS) -> PIDConfig:
    tun, _ = design(spec, p)
    return PIDConfig(Kc=float(tun.Kc), tauI=float(tun.tauI), tauD=float(tun.tauD), N=spec.N,
                     beta=spec.beta, anti_windup=spec.anti_windup)
