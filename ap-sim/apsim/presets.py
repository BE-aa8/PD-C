"""Named scenarios (Sec. 14).

A :class:`Scenario` holds the user-level knobs (tuning method, tau_c, sensor, meals,
feedforward, ...).  :func:`build_config` turns it into a full :class:`SimConfig`,
computing the PID tuning from the reduced model (never hard-coded).

Meals are placed at t = 60 min (not 0) so that a pre-bolus of up to 30 min starts
inside the simulated window and the pre-meal basal steady state is visible.
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace

from .controller import PIDConfig
from .design import DesignSpec, pid_config
from .disturbance import Meal
from .feedforward import FFConfig
from .params import DEFAULT_PARAMS, Params
from .sensor import SensorConfig
from .simulate import SimConfig

T_MEAL = 60.0


@dataclass(frozen=True)
class Scenario:
    controller: str = "pid"                 # pid | none | mpc
    method: str = "imc_fit_sopdt"           # see design.METHODS, or "manual"
    tau_c: float | None = 20.0              # None -> tau_c = theta_total
    include_zoh: bool = True
    design_delay: float | None = None       # delay assumed in tuning; None -> actual sensor delay
    manual: tuple[float, float, float] = (-0.4, 70.0, 17.5)   # Kc, tauI, tauD for "manual"
    N: float = 10.0
    beta: float = 1.0
    anti_windup: str = "clamp"
    Ts: float = 5.0
    dt: float = 0.1
    t_end: float = 660.0
    sensor: SensorConfig = field(default_factory=SensorConfig)
    meals: tuple[Meal, ...] = (Meal(T_MEAL),)
    ff: FFConfig = field(default_factory=FFConfig)
    setpoint: float | None = None
    setpoint_steps: tuple[tuple[float, float], ...] = ()
    sensitivity_change: tuple[float, float] | None = None
    saturation: bool = True
    mpc: object | None = None
    params: Params = DEFAULT_PARAMS


def design_spec(sc: Scenario) -> DesignSpec:
    th = sc.sensor.delay if sc.design_delay is None else sc.design_delay
    return DesignSpec(method=sc.method, tau_c=sc.tau_c, theta_sensor=th, Ts=sc.Ts,
                      include_zoh=sc.include_zoh, N=sc.N, beta=sc.beta,
                      anti_windup=sc.anti_windup)


def scenario_pid(sc: Scenario) -> PIDConfig:
    if sc.method == "manual":
        Kc, tI, tD = sc.manual
        return PIDConfig(Kc, tI, tD, sc.N, sc.beta, sc.anti_windup)
    return pid_config(design_spec(sc), sc.params)


def build_config(sc: Scenario) -> SimConfig:
    return SimConfig(params=sc.params, t_end=sc.t_end, dt=sc.dt, Ts=sc.Ts,
                     controller=sc.controller,
                     pid=scenario_pid(sc) if sc.controller == "pid" else None,
                     mpc=sc.mpc, setpoint=sc.setpoint, setpoint_steps=sc.setpoint_steps,
                     sensor=sc.sensor, meals=sc.meals, ff=sc.ff,
                     sensitivity_change=sc.sensitivity_change, saturation=sc.saturation)


def _mpc_cfg():
    from .mpc import MPCConfig
    return MPCConfig()


def _scenarios() -> dict[str, tuple[Scenario, str]]:
    b = Scenario()
    G_b = DEFAULT_PARAMS.G_basal
    return {
        "Open loop (basal only)": (
            replace(b, controller="none"),
            "Meal pushes glucose to ~166 mg/dL ~26 min after the meal; above 144 for ~42 min."),
        "Textbook IMC-PID, no sensor delay (Ex. 23.6d)": (
            replace(b, sensor=SensorConfig(delay=0.0)),
            "IMC-PID (SOPDT fit, tau_c = 20 min) with an ideal, undelayed sensor. "
            "Peaks ~151 mg/dL: does NOT stay inside 54-144."),
        "IMC-PID with 10-min sensor delay (Ex. 23.6e)": (
            b, "Same design re-tuned for a 10-min CGM delay. Feedback alone peaks high (~163), "
               "then dips toward the low limit (~50)."),
        "Delay-unaware tuning (tuned for 0, actual 10 min)": (
            replace(b, design_delay=0.0),
            "Controller tuned assuming no delay, but the CGM lags 10 min."),
        "Aggressive (tau_c = 2 min)": (
            replace(b, tau_c=2.0),
            "Turning up the gain barely cuts the peak (insulin lag) but deepens the low."),
        "Sluggish (tau_c = 60 min)": (
            replace(b, tau_c=60.0), "Safe on the low side but slow."),
        "Windup demo (anti-windup off, 2x meal)": (
            replace(b, anti_windup="off", meals=(Meal(T_MEAL, 2.0),)),
            "Integral keeps charging while the pump is pinned at U_max -> insulin stacking -> "
            "deeper later low. Compare with the anti-windup-ON preset."),
        "Windup demo (anti-windup ON, 2x meal)": (
            replace(b, meals=(Meal(T_MEAL, 2.0),)),
            "Same as the windup demo but with conditional integration."),
        "Meal announced, no pre-bolus": (
            replace(b, ff=FFConfig(enabled=True)),
            "Static feedforward bolus (~1390 mU) delivered at the meal."),
        "Meal announced + 15-min pre-bolus": (
            replace(b, ff=FFConfig(enabled=True, t_pre=15.0)),
            "Same bolus 15 min earlier: stays in band. Because insulin lags, WHEN matters as "
            "much as HOW MUCH."),
        "Overestimated meal (+40%)": (
            replace(b, ff=FFConfig(enabled=True, t_pre=15.0, est_error=0.4)),
            "Same 15-min pre-bolus but sized for a meal 40% bigger than the real one: the nadir "
            "falls from ~63 to ~58 mg/dL (below 70, still above 54)."),
        "Sensor stuck at t = 60 min": (
            replace(b, sensor=SensorConfig(delay=10.0, fault="stuck", t_fault=60.0)),
            "CGM freezes at the meal: the controller never sees the rise, so it behaves "
            "exactly like open loop (no fault detection)."),
        "Set-point step -20 mg/dL (Ex. 23.6c)": (
            replace(b, meals=(), setpoint_steps=((T_MEAL, G_b - 20.0),)),
            "Closed-loop response to a -20 mg/dL set-point change, no meal."),
        "MPC, unannounced meal (stretch)": (
            replace(b, controller="mpc", mpc=_mpc_cfg()),
            "Linear MPC with a delay-augmented model, Kalman filter, meal-shaped disturbance "
            "state and asymmetric (hypo-weighted) cost. Same peak as PID (physics limit), "
            "much higher nadir."),
        "MPC + meal announcement (stretch)": (
            replace(b, controller="mpc", mpc=_mpc_cfg(), ff=FFConfig(enabled=True)),
            "The announced meal enters the MPC prediction (no separate bolus)."),
        "Three meals / 24 h": (
            replace(b, t_end=1440.0, meals=(Meal(480.0), Meal(780.0), Meal(1140.0))),
            "Repeated daily disturbance (t = 0 is midnight) -> run-to-run discussion "
            "(Seborg Sec. 23.2)."),
    }


SCENARIOS = _scenarios()
PRESETS = {k: (build_config(sc), d) for k, (sc, d) in SCENARIOS.items()}
