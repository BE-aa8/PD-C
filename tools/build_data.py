#!/usr/bin/env python3
"""Generate site/js/data.js from the Python reference (ap-sim). Never hand-edit data.js.

    python3 tools/build_data.py           # write site/js/data.js
    python3 tools/build_data.py --check   # CI: regenerate in memory and compare (numeric tolerance)

Every value object carries a sourceId that must exist in DATA.sources (checked by npm test).
"""
from __future__ import annotations

import json
import sys
from dataclasses import replace

from _ref import P, ROOT, reduced_models, compare
from apsim.mpc import MPCConfig
from apsim.params import CLINICAL_BAND, G_VALIDITY_LOW, PARAM_TABLE
from apsim.presets import SCENARIOS, build_config, scenario_pid
from apsim.feedforward import FFConfig
from apsim.simulate import simulate
from apsim.stability import empirical_max_delay, margins
from apsim.linearize import linearize

OUT = ROOT / "site" / "js" / "data.js"


def sig(x, n=6):
    return float(f"{x:.{n}g}")


SOURCES = {
    "seborg_ex23_3": "Seborg, Edgar, Mellichamp & Doyle, Process Dynamics and Control, 4th ed., Wiley, Example 23.3 "
                     "(model from Bequette, 2002)",
    "seborg_23_2": "Seborg et al., 4th ed., Sec. 23.2 (CGM sample period; cites Harvey et al., 2010)",
    "seborg_ex23_6": "Seborg et al., 4th ed., Exercise 23.6 (sensor delay of 10 min in part e)",
    "battelino_2019": "Battelino T, et al. Clinical Targets for Continuous Glucose Monitoring Data Interpretation: Recommendations From the International Consensus on Time in Range. Diabetes Care 2019;42(8):1593-1603. doi:10.2337/dci19-0028",
    "reference": "Computed offline by the Python reference implementation (ap-sim/, this repository); "
                 "see tools/build_data.py",
    "display_threshold": "Display threshold chosen by the project (not from a source): below this the model, which has "
                         "no counter-regulation, is qualitative only",
}
SRC = {"p1": "seborg_ex23_3", "p2": "seborg_ex23_3", "p3": "seborg_ex23_3", "n": "seborg_ex23_3",
       "V1": "seborg_ex23_3", "G_basal": "seborg_ex23_3", "I_basal": "seborg_ex23_3", "U_max": "seborg_ex23_3",
       "U_min": "seborg_ex23_3", "band_low": "seborg_ex23_3", "band_high": "seborg_ex23_3",
       "meal_A": "seborg_ex23_3", "meal_k": "seborg_ex23_3", "Ts": "seborg_23_2", "sensor_delay": "seborg_ex23_6"}


def series(r, keys=("G_true", "U"), step=10):
    return {k: [round(float(v), 3) for v in getattr(r, k)[::step]] for k in keys}


def build() -> dict:
    rm = reduced_models(P)
    fits = {}
    for name in ("fit_sopdt", "fit_fopdt"):
        m, st = rm[name], rm[name + "_stats"]
        d = {k: sig(getattr(m, k)) for k in ("K", "tau1", "tau2", "tau", "theta") if hasattr(m, k)}
        fits[name] = {**d, "rmse": sig(st.rmse, 4), "maxErr": sig(st.max_err, 4), "sourceId": "reference",
                      "method": "scipy.optimize.least_squares on the nonlinear dU=+1 mU/min step, 0-600 min, dt=0.1, K free"}

    # empirical (sampled, nonlinear, unbounded pump) delay limit vs the continuous estimate
    lm = linearize(P)
    emp = {}
    for label, ths in (("design_theta_s_10", 10.0), ("design_theta_s_0", 0.0)):
        sc = replace(SCENARIOS["IMC-PID with 10-min sensor delay (Ex. 23.6e)"][0], sensor=replace(
            SCENARIOS["IMC-PID with 10-min sensor delay (Ex. 23.6e)"][0].sensor, delay=ths))
        pc = scenario_pid(sc)
        m0 = margins(lm, pc.Kc, pc.tauI, pc.tauD, pc.N, 0.0)
        e = empirical_max_delay(pc, lo=0.0, hi=120.0, tol=0.5, t_end=2500.0)
        emp[label] = {"value": round(e, 1), "continuous_estimate": round(m0.total_tolerable_delay, 2),
                      "units": "min", "sourceId": "reference",
                      "meaning": "smallest sensor delay giving sustained oscillation in the sampled nonlinear loop "
                                 "(tau_c = 20, unbounded pump, -1 mg/dL set-point step); bisection, +/-0.25 min"}

    # PID vs MPC, precomputed (MPC is not implemented in the websites)
    base = SCENARIOS["IMC-PID with 10-min sensor delay (Ex. 23.6e)"][0]
    runs = {
        "unannounced": (base, replace(base, controller="mpc", mpc=MPCConfig())),
        "announced": (replace(base, ff=FFConfig(enabled=True, t_pre=15.0)),
                      replace(base, controller="mpc", mpc=MPCConfig(), ff=FFConfig(enabled=True))),
    }
    mpc = {"sourceId": "reference",
           "note": "Python reference, Ex. 23.6(e) setup (10-min sensor delay, meal at 60 min). PID = IMC-PID (tau_c = 20). "
                   "MPC = linear MPC with a delay-augmented model, Kalman filter, meal-shaped disturbance state, "
                   "2-h horizon, asymmetric (hypo-weighted) cost; weights are project choices, not from a source. "
                   "'announced': PID gets a 15-min pre-bolus; MPC gets the meal estimate in its prediction.",
           "t": None}
    for key, (pid_sc, mpc_sc) in runs.items():
        rp, rmpc = simulate(build_config(pid_sc)), simulate(build_config(mpc_sc))
        if mpc["t"] is None:
            mpc["t"] = [round(float(v), 1) for v in rp.t[::10]]
        mpc[key] = {"pid": series(rp), "mpc": series(rmpc)}

    params = {k: {"value": v.value, "units": v.units, "meaning": v.meaning, "sourceId": SRC[k]}
              for k, v in PARAM_TABLE.items()}
    return {
        "meta": {"generatedBy": "tools/build_data.py", "doNotEdit": True,
                 "note": "Educational process-control model of an illustrative textbook patient. "
                         "Not medical advice. Not for dosing decisions."},
        "sources": SOURCES,
        "params": params,
        "clinicalBand": {"value": list(CLINICAL_BAND), "units": "mg/dL", "sourceId": "battelino_2019"},
        "validityLow": {"value": G_VALIDITY_LOW, "units": "mg/dL", "sourceId": "display_threshold"},
        "fits": fits,
        "empiricalDelay": emp,
        "mpcComparison": mpc,
    }


def render(data: dict) -> str:
    return ("// GENERATED by tools/build_data.py from the Python reference (ap-sim/). DO NOT EDIT.\n"
            "// Educational process-control model of an illustrative textbook patient. "
            "Not medical advice. Not for dosing decisions.\n"
            f"export const DATA = {json.dumps(data, indent=1)};\n")


def parse(js: str) -> dict:
    return json.loads(js[js.index("{"): js.rindex("}") + 1])


if __name__ == "__main__":
    data = build()
    if "--check" in sys.argv:
        errs = compare(data, parse(OUT.read_text()), rel=1e-4, abs_=0.02)
        if errs:
            print("site/js/data.js is out of date with the reference:\n  " + "\n  ".join(errs[:30]))
            sys.exit(1)
        print("site/js/data.js matches the reference.")
    else:
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(render(data))
        print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")
