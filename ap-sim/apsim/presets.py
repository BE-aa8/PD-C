"""Named scenarios (Sec. 14).  Each preset returns a full SimConfig.

Meals are placed at t = 60 min (not 0) so that a pre-bolus of up to 30 min starts
inside the simulated window and the pre-meal basal steady state is visible.
"""
from __future__ import annotations

from dataclasses import replace

from .design import DesignSpec, pid_config
from .disturbance import Meal
from .feedforward import FFConfig
from .params import DEFAULT_PARAMS
from .sensor import SensorConfig
from .simulate import SimConfig

T_MEAL = 60.0
TAU_C = 20.0


def _pid(theta_s=10.0, tau_c=TAU_C, aw="clamp", **kw):
    return pid_config(DesignSpec(tau_c=tau_c, theta_sensor=theta_s, anti_windup=aw, **kw))


def _base(theta_s=10.0, **kw):
    cfg = dict(t_end=660.0, meals=(Meal(T_MEAL),), sensor=SensorConfig(delay=theta_s),
               pid=_pid(theta_s))
    cfg.update(kw)
    return SimConfig(**cfg)


def _presets():
    G_b = DEFAULT_PARAMS.G_basal
    return {
        "Open loop (basal only)": (
            replace(_base(), controller="none"),
            "Meal pushes glucose to ~166 mg/dL ~26 min after the meal; above 144 for ~42 min."),
        "Textbook IMC-PID, no sensor delay (Ex. 23.6d)": (
            _base(0.0),
            "IMC-PID (SOPDT fit, tau_c = 20 min) with an ideal, undelayed sensor."),
        "IMC-PID with 10-min sensor delay (Ex. 23.6e)": (
            _base(10.0),
            "Same design re-tuned for a 10-min CGM delay. Feedback alone peaks high, then dips low."),
        "Aggressive (tau_c = 2 min)": (
            _base(pid=_pid(tau_c=2.0)),
            "Turning up the gain does not cut the peak much (insulin lag) but deepens the low."),
        "Sluggish (tau_c = 60 min)": (
            _base(pid=_pid(tau_c=60.0)),
            "Safe on the low side but slow."),
        "Windup demo (anti-windup off, 2x meal)": (
            _base(pid=_pid(aw="off"), meals=(Meal(T_MEAL, 2.0),)),
            "Integral keeps charging while the pump is pinned -> insulin stacking -> later low. "
            "Compare against the same preset with anti-windup on."),
        "Windup demo (anti-windup ON, 2x meal)": (
            _base(meals=(Meal(T_MEAL, 2.0),)),
            "Same as the windup demo but with conditional integration."),
        "Meal announced, no pre-bolus": (
            _base(ff=FFConfig(enabled=True)),
            "Static feedforward bolus (~1390 mU) delivered at the meal."),
        "Meal announced + 15-min pre-bolus": (
            _base(ff=FFConfig(enabled=True, t_pre=15.0)),
            "Same bolus 15 min earlier: insulin lag means WHEN matters as much as HOW MUCH."),
        "Overestimated meal (+40%)": (
            _base(ff=FFConfig(enabled=True, t_pre=15.0, est_error=0.4)),
            "Same 15-min pre-bolus as the wow preset but sized for a meal 40% bigger than the real one: "
            "the nadir falls from ~63 to ~58 mg/dL (below 70, still above 54)."),
        "Sensor stuck at t = 60 min": (
            _base(sensor=SensorConfig(delay=10.0, fault="stuck", t_fault=60.0)),
            "CGM freezes at the meal: the controller never sees the rise, so it behaves exactly like open loop (no fault detection)."),
        "Set-point step -20 mg/dL (Ex. 23.6c)": (
            _base(meals=(), setpoint_steps=((T_MEAL, G_b - 20.0),)),
            "Closed-loop response to a -20 mg/dL set-point change, no meal."),
        "Three meals / 24 h": (
            _base(t_end=1440.0, meals=(Meal(8 * 60.0), Meal(13 * 60.0), Meal(19 * 60.0))),
            "Repeated daily disturbance (t = 0 is midnight) -> run-to-run discussion (Seborg Sec. 23.2)."),
    }


PRESETS = _presets()
