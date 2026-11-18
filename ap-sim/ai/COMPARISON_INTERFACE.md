# Comparison interface (shared contract for both AI implementations)

**Purpose:** let the Claude implementation (`ap-sim/apsim`) and the Gemini implementation
(`gemini-impl/gemsim`) run **identical inputs**, so that differences in output can be traced to
implementation choices rather than to different scenarios.

This contract specifies *inputs and outputs only*. It says nothing about how either
implementation works internally. Each implementation provides a thin adapter module that
satisfies it. The Claude adapter will be written in completion Phase C, and the Gemini adapter is
part of the Gemini implementation prompt.

## Why explicit gains are allowed

A scenario may give the PID gains **explicitly** (`pid.mode = "explicit"`). This separates two
questions:
1. Do the two simulators produce the same trajectory for the *same* controller?
   (Tests the simulation engine, PID, sensor and feedforward.)
2. Do the two implementations compute the same controller from the plan?
   (Tests model reduction and tuning: `pid.mode = "design"`.)

## Python API (module `<package>.compare_api`)

All quantities are in plan units (min, mg/dL, mU/min, mU/L). All return values are plain
Python types (dict / list / float / str / bool), so they serialize to JSON.

```python
def linear_model() -> dict
    # {"Kp": float, "Kd": float, "taus": [tau_G, tau_X, tau_I], "U_basal": float,
    #  "A": [[...],[...],[...]]}

def reduced_models() -> dict
    # {"half_sopdt": {"K","tau1","tau2","theta"}, "half_fopdt": {"K","tau","theta"},
    #  "fit_sopdt": {...}, "fit_fopdt": {...}}     (fits: nonlinear dU=+1 step, 0-600 min)

def imc_pid(theta_sensor: float, tau_c: float, include_zoh: bool, Ts: float = 5.0,
            model: str = "fit_sopdt") -> dict
    # {"Kc","tauI","tauD","theta_total"}

def margins(Kc: float, tauI: float, tauD: float, N: float = 10.0,
            theta_loop: float = 0.0) -> dict
    # {"wc","PM_deg","GM","dtheta_max","total_tolerable_delay"}
    # full 3rd-order linear Gp, filtered PID, delay e^{-s theta_loop} in the loop.
    # total_tolerable_delay = theta_loop + dtheta_max

def run_scenario(spec: dict) -> dict
    # returns {"t": [...], "G_true": [...], "G_meas": [...], "U": [...], "U_fb": [...],
    #          "U_ff": [...], "valid": bool, "message": str}
    # G_true / G_meas absolute mg/dL; G_meas held between samples (NaN on dropout -> null in JSON)
```

## Scenario spec (JSON)

```json
{
  "name": "ex23_6e_feedback_only",
  "t_end": 660.0,
  "dt": 0.1,
  "Ts": 5.0,
  "controller": "pid",
  "pid": {
    "mode": "explicit",
    "Kc": -0.4256, "tauI": 70.297, "tauD": 17.574,
    "N": 10.0, "beta": 1.0, "anti_windup": "clamp"
  },
  "sensor": {"delay": 10.0, "lag": 0.0, "noise_sd": 0.0, "seed": 0,
             "fault": "none", "t_fault": 60.0, "drift_rate": 0.0, "dropout_duration": 30.0},
  "meals": [[60.0, 1.0]],
  "ff": {"enabled": false, "f_bolus": 1.0, "est_error": 0.0, "t_pre": 0.0},
  "setpoint": 81.0,
  "setpoint_steps": [],
  "sensitivity_change": null,
  "saturation": true,
  "U_open_loop": null
}
```

Field rules:
- `controller`: `"pid"` or `"none"` (open loop at `U_open_loop`, or basal if null).
- `pid.mode`: `"explicit"` (use the Kc/tauI/tauD given) or `"design"`, with
  `{"theta_sensor","tau_c","include_zoh","model"}` instead of the gains.
- `pid.anti_windup`: `"clamp"` | `"backcalc"` | `"off"`.
- `sensor.fault`: `"none"` | `"stuck"` | `"drift"` (`drift_rate` in mg/dL per hour) | `"dropout"`.
- `meals`: list of `[t_meal_min, multiplier]`; textbook meal D = 9.0·mult·exp(-0.05 (t - t_meal)).
- `ff`: static bolus per plan §10.2, delivered at the remaining pump capacity.
- `sensitivity_change`: null or `[t_s, factor]` (p3 multiplied by factor from t_s on).
- `setpoint_steps`: list of `[t, new_absolute_setpoint]`.

**Known non-comparable item:** with `noise_sd > 0` the two implementations use different random
number streams, so noisy runs can only be compared statistically (for example, mean and spread of
the metrics over many seeds), not sample by sample.

## Metrics computed by the harness (not by the implementations)

The comparison harness computes every metric from the returned arrays using one shared function:
peak and time, nadir and time, % time in 54–144, % < 54, % < 70, IAE, total insulin. So metric
definitions cannot differ between the two implementations.
