#!/usr/bin/env python3
"""Generate tests/expected.json from the Python reference (ap-sim). Never hand-edit it.

    python3 tools/build_expected.py           # write tests/expected.json
    python3 tools/build_expected.py --check   # CI: regenerate in memory and compare (numeric tolerance)

The scenarios use the `simulate(inputs)` contract of plan-v2-final.md §9.1 (overrides of
DEFAULT_INPUTS). Both website builds are graded against this file by tests/model.test.mjs.
"""
from __future__ import annotations

import json
import math
import sys

import numpy as np

from _ref import DEFAULT_INPUTS, P, ROOT, compare, imc, reduced_models, run
from apsim.linearize import linearize, nonlinear_gain_curve
from apsim.metrics import compute_metrics
from apsim.stability import margins

OUT = ROOT / "tests" / "expected.json"
TOL = {"scalar_rel": 0.005, "G_abs": 0.05, "U_abs": 0.05, "peak_nadir_abs": 0.05,
       "pct_abs": 0.1, "IAE_rel": 0.005, "insulin_rel": 0.005}

T60 = imc(theta_sensor=10.0)        # = DEFAULT_INPUTS gains
T0 = imc(theta_sensor=0.0)          # tuned for an ideal sensor (Ex. 23.6d)
G_b = P.G_basal

SCENARIOS = {
    # name: (overrides, note)
    "open_loop_meal_at_0": ({"controller": "none", "meals": [[0.0, 1.0]], "t_end": 600.0, "sensor_delay": 0.0},
                            "Analytic case: peak 166.15 mg/dL at t = 26.0 min (meal at t = 0)"),
    "ex23_6d_no_delay": ({"sensor_delay": 0.0, "Kc": T0["Kc"], "tauI": T0["tauI"], "tauD": T0["tauD"]},
                         "IMC-PID tuned for theta_s = 0, ideal sensor"),
    "ex23_6e_feedback_only": ({}, "Defaults: IMC-PID tuned for the 10-min sensor delay"),
    "delay_unaware_tuning": ({"Kc": T0["Kc"], "tauI": T0["tauI"], "tauD": T0["tauD"]},
                             "Tuned for theta_s = 0 but the sensor delay is 10 min"),
    "aggressive_tau_c_2": ({**{k: imc(tau_c=2.0)[k] for k in ("Kc", "tauI", "tauD")}}, "tau_c = 2 min"),
    "bolus_at_meal": ({"ff_enabled": True}, "Static bolus at the meal"),
    "prebolus_15": ({"ff_enabled": True, "t_pre": 15.0}, "15-min pre-bolus (stays in band)"),
    "overestimate_40": ({"ff_enabled": True, "t_pre": 15.0, "est_error": 0.4}, "+40 % meal estimate"),
    "windup_off_2x": ({"anti_windup": "off", "meals": [[60.0, 2.0]]}, "Anti-windup off, 2x meal"),
    "windup_clamp_2x": ({"anti_windup": "clamp", "meals": [[60.0, 2.0]]}, "Clamping, 2x meal"),
    "windup_backcalc_2x": ({"anti_windup": "backcalc", "meals": [[60.0, 2.0]]}, "Back-calculation, 2x meal"),
    "sp_step_minus20": ({"meals": [], "setpoint_steps": [[60.0, G_b - 20.0]]}, "Ex. 23.6(c), beta = 1"),
    "sp_step_minus20_beta_half": ({"meals": [], "beta": 0.5, "setpoint_steps": [[60.0, G_b - 20.0]]},
                                  "Set-point weighting on deviations (critique row 13)"),
    "beta_half_steady_state": ({"meals": [], "beta": 0.5}, "Must stay exactly at basal (critique row 13)"),
    "p_only_offset": ({"meals": [], "mode": "P", "setpoint_steps": [[60.0, G_b - 20.0]]},
                      "P-only: steady-state offset"),
    "pi_mode": ({"mode": "PI"}, "PI: tauD = 0"),
    "sensor_lag_5": ({"sensor_lag": 5.0}, "First-order sensor lag 5 min plus 10-min delay"),
    "sensor_stuck_60": ({"fault": "stuck", "t_fault": 60.0}, "Stuck sensor at the meal"),
    "sensor_drift": ({"fault": "drift", "t_fault": 60.0, "drift_rate": 10.0}, "+10 mg/dL per h drift"),
    "sensor_dropout": ({"fault": "dropout", "t_fault": 100.0, "dropout_duration": 30.0}, "Dropout 100-130 min"),
    "sensitivity_x1_5": ({"sensitivity_change": [120.0, 1.5]}, "p3 x 1.5 from t = 120 (plant-model mismatch)"),
    "three_meals_24h": ({"t_end": 1440.0, "meals": [[480.0, 1.0], [780.0, 1.0], [1140.0, 1.0]]}, "Three meals"),
    "suspend_integral": ({"ff_enabled": True, "t_pre": 15.0, "suspend_integral": True, "suspend_extra": 60.0},
                         "Integral frozen during the bolus + 60 min"),
    "bolus_before_t0": ({"ff_enabled": True, "t_pre": 15.0, "meals": [[0.0, 1.0]], "t_end": 600.0},
                        "Bolus scheduled at t = -15: delivered from t = 0 with a warning"),
    "backcalc_small_tauD": ({"anti_windup": "backcalc", "tauD": 0.05, "meals": [[60.0, 2.0]]},
                            "Tt guard: Tt = max(sqrt(tauI tauD), Ts) (critique row 3)"),
}


def r6(x):
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else float(f"{x:.10g}")


def scenario(name, overrides, note):
    r = run(overrides)
    t_end = overrides.get("t_end", DEFAULT_INPUTS["t_end"])
    step = 15.0 if t_end <= 700 else 30.0
    times = [float(x) for x in np.arange(0.0, t_end + 1e-9, step)]
    dt = DEFAULT_INPUTS["dt"]
    idx = [int(round(t / dt)) for t in times]
    m = compute_metrics(r)
    mt = m["true"]
    return {
        "name": name, "note": note, "inputs": overrides, "times": times,
        "G": [r6(r.G_true[i]) for i in idx], "U": [r6(r.U[i]) for i in idx],
        "metrics": {"peak": r6(mt["peak"]), "nadir": r6(mt["nadir"]), "pct_in_band": r6(mt["pct_in_band"]),
                    "pct_below_70": r6(mt["pct_below_70"]), "IAE": r6(mt["IAE"]),
                    "insulin_total": r6(m["insulin_total"]), "insulin_ff": r6(m["insulin_feedforward"]),
                    "stayed_in_band": bool(mt["stayed_in_band"])},
        "valid": bool(r.valid), "hasWarning": bool(r.message),
        "bolusDelivered": r6(r.bolus_delivered),
    }


def build() -> dict:
    lm = linearize(P)
    rm = reduced_models(P)
    hs, hf = rm["half_sopdt"], rm["half_fopdt"]
    tuning = []
    for model in ("fit_sopdt", "half_sopdt", "fit_fopdt_pi", "fit_fopdt_pid", "half_fopdt_pi"):
        for ths in (0.0, 10.0):
            for zoh in (False, True):
                for tc in (2.0, 20.0, 60.0):
                    inp = {"model": model, "tau_c": tc, "theta_sensor": ths, "Ts": 5.0, "include_zoh": zoh}
                    tuning.append({"inputs": inp, "expect": {k: r6(v) for k, v in imc(**inp).items()}})
    marg = []
    for label, tun, theta in (("design10_loop0", T60, 0.0), ("design10_loop10", T60, 10.0),
                              ("design0_loop0", T0, 0.0), ("pi_design10", {**T60, "tauD": 0.0}, 10.0)):
        mg = margins(lm, tun["Kc"], tun["tauI"], tun["tauD"], 10.0, theta)
        marg.append({"name": label, "inputs": {"Kc": tun["Kc"], "tauI": tun["tauI"], "tauD": tun["tauD"],
                                               "N": 10.0, "theta": theta},
                     "expect": {"wc": r6(mg.wc), "PM_deg": r6(mg.PM_deg), "GM": r6(mg.GM),
                                "dtheta_max": r6(mg.dtheta_max),
                                "total_tolerable_delay": r6(mg.total_tolerable_delay)}})
    dUs = [-10.0, 0.01, 1.0, 10.0, 50.0, 98.0]
    return {
        "meta": {"generatedBy": "tools/build_expected.py (Python reference, ap-sim/)",
                 "spec": "docs/plan-v2-final.md", "tolerances": TOL,
                 "note": "Do not edit by hand. Regenerate with python3 tools/build_expected.py."},
        "defaultInputs": DEFAULT_INPUTS,
        "linearModel": {"U_basal": r6(P.U_basal), "Kp": r6(lm.Kp), "Kd": r6(lm.Kd), "tauG": r6(lm.tau_G),
                        "tauX": r6(lm.tau_X), "tauI": r6(lm.tau_I),
                        "Kf": r6(P.V1 * P.p2 * P.n / (P.G_basal * P.p3)),
                        "authorityRatio": r6(P.authority_ratio)},
        "nonlinearGain": [{"dU": d, "gain": r6(g)} for d, g in zip(dUs, nonlinear_gain_curve(P, np.array(dUs)))],
        "halfRule": {"sopdt": {"K": r6(hs.K), "tau1": r6(hs.tau1), "tau2": r6(hs.tau2), "theta": r6(hs.theta)},
                     "fopdt": {"K": r6(hf.K), "tau": r6(hf.tau), "theta": r6(hf.theta)}},
        "imcTuning": tuning,
        "margins": marg,
        "scenarios": [scenario(n, o, note) for n, (o, note) in SCENARIOS.items()],
    }


if __name__ == "__main__":
    data = build()
    if "--check" in sys.argv:
        errs = compare(json.loads(json.dumps(data)), json.loads(OUT.read_text()), rel=1e-5, abs_=1e-3)
        if errs:
            print("tests/expected.json is out of date with the reference:\n  " + "\n  ".join(errs[:30]))
            sys.exit(1)
        print("tests/expected.json matches the reference.")
    else:
        OUT.write_text(json.dumps(data, indent=1) + "\n")
        print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes), {len(data['scenarios'])} scenarios, "
              f"{len(data['imcTuning'])} tuning cases, {len(data['margins'])} margin cases")
