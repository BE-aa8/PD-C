"""Streamlit UI (thin).  All physics/control lives in apsim/ (no Streamlit imports there).

Run:  streamlit run app.py
"""
from __future__ import annotations

import math
from dataclasses import replace

import numpy as np
import plotly.graph_objects as go
import streamlit as st
from plotly.subplots import make_subplots

from apsim import DISCLAIMER
from apsim.design import METHODS, design, reduced_models
from apsim.disturbance import Meal
from apsim.feedforward import FFConfig, bolus_total, ideal_ff_coefficients, static_ff_gain
from apsim.linearize import linear_step, linearize, nonlinear_gain_curve
from apsim.metrics import compute_metrics
from apsim.params import BAND_TEXTBOOK, CLINICAL_BAND, CLINICAL_BAND_SOURCE, PARAM_TABLE, DEFAULT_PARAMS as P
from apsim.presets import SCENARIOS, Scenario, build_config, design_spec, scenario_pid
from apsim.reduce import fopdt_step, sopdt_step
from apsim.sensor import SensorConfig
from apsim.simulate import simulate
from apsim.stability import bode_data, empirical_max_delay, margins

st.set_page_config(page_title="Closing the Loop — AP control simulator", layout="wide")
st.warning(DISCLAIMER)
st.title("Closing the Loop: artificial-pancreas control simulator")
st.caption("Seborg et al., Process Dynamics and Control, 4th ed., Example 23.3 / Exercise 23.6 "
           "(model from Bequette, 2002). CHEE 4071.")

LM = linearize(P)


@st.cache_data(show_spinner=False)
def run(cfg):
    return simulate(cfg)


@st.cache_data(show_spinner=False)
def rm_cached():
    return reduced_models(P)


@st.cache_data(show_spinner=False)
def emp_delay(pid_cfg, Ts):
    return empirical_max_delay(pid_cfg, lo=0.0, hi=150.0, tol=0.5, t_end=2500.0, Ts=Ts)


def parse_meals(text: str):
    meals = []
    for part in text.split(","):
        part = part.strip()
        if not part:
            continue
        t, _, m = part.partition(":")
        meals.append(Meal(float(t), float(m) if m else 1.0))
    return tuple(meals)


# ------------------------------------------------------------------ sidebar
sb = st.sidebar
preset = sb.selectbox("Preset", list(SCENARIOS))
sc0, desc = SCENARIOS[preset]
sb.caption(desc)
K = lambda name: f"{preset}::{name}"   # widget keys reset when the preset changes

sb.header("Controller")
ctrl_opts = ["pid", "none"]
try:
    import apsim.mpc  # noqa: F401
    ctrl_opts.append("mpc")
except ImportError:
    pass
controller = sb.selectbox("Controller", ctrl_opts, index=ctrl_opts.index(sc0.controller),
                          format_func={"pid": "PID", "none": "Open loop (basal)", "mpc": "MPC (stretch)"}.get,
                          key=K("ctrl"))
methods = list(METHODS) + ["manual"]
method = sb.selectbox("Tuning method", methods, index=methods.index(sc0.method), key=K("method"))
auto_tc = sb.checkbox("tau_c = theta_total (default guideline)", value=sc0.tau_c is None, key=K("autotc"))
tau_c = None if auto_tc else sb.slider("tau_c [min]", 1.0, 120.0, float(sc0.tau_c or 20.0), 1.0, key=K("tc"))
include_zoh = sb.checkbox("Include Ts/2 (ZOH) in theta_total", value=sc0.include_zoh, key=K("zoh"))
dd_on = sb.checkbox("Tune for a different delay than the actual one", value=sc0.design_delay is not None,
                    key=K("ddon"))
design_delay = sb.slider("Delay assumed in tuning [min]", 0.0, 40.0, float(sc0.design_delay or 0.0), 0.5,
                         key=K("dd")) if dd_on else None
if method == "manual":
    c1, c2, c3 = sb.columns(3)
    manual = (c1.number_input("Kc", value=sc0.manual[0], step=0.05, format="%.3f", key=K("kc")),
              c2.number_input("tauI", value=sc0.manual[1], min_value=0.1, step=5.0, key=K("ti")),
              c3.number_input("tauD", value=sc0.manual[2], min_value=0.0, step=1.0, key=K("td")))
else:
    manual = sc0.manual
N = sb.slider("Derivative filter N", 5.0, 20.0, float(sc0.N), 1.0, key=K("N"))
beta = sb.slider("Set-point weight beta", 0.0, 1.0, float(sc0.beta), 0.1, key=K("beta"))
aw_opts = ["clamp", "backcalc", "off"]
anti_windup = sb.selectbox("Anti-windup", aw_opts, index=aw_opts.index(sc0.anti_windup), key=K("aw"))
Ts_opts = [1.0, 2.0, 5.0, 10.0]
Ts = sb.selectbox("Sample period Ts [min]", Ts_opts, index=Ts_opts.index(sc0.Ts), key=K("Ts"))

sb.header("Sensor (CGM)")
s0 = sc0.sensor
delay = sb.slider("Sensor delay [min]", 0.0, 40.0, float(s0.delay), 0.5, key=K("delay"))
lag = sb.slider("Sensor lag tau_s [min]", 0.0, 15.0, float(s0.lag), 0.5, key=K("lag"))
noise = sb.slider("Noise sigma [mg/dL]", 0.0, 10.0, float(s0.noise_sd), 0.5, key=K("noise"))
seed = sb.number_input("Noise seed", value=int(s0.seed), step=1, key=K("seed"))
faults = ["none", "stuck", "drift", "dropout"]
fault = sb.selectbox("Fault", faults, index=faults.index(s0.fault), key=K("fault"))
t_fault = sb.number_input("Fault time [min]", value=float(s0.t_fault), step=10.0, key=K("tf")) if fault != "none" else s0.t_fault
drift = sb.number_input("Drift [mg/dL per h]", value=float(s0.drift_rate or 10.0), key=K("drift")) if fault == "drift" else s0.drift_rate
drop_d = sb.number_input("Dropout duration [min]", value=float(s0.dropout_duration), key=K("dropd")) if fault == "dropout" else s0.dropout_duration

sb.header("Meals (model units)")
meals_txt = sb.text_input("Meals 't_min:multiplier, ...'", ", ".join(f"{m.t_meal:g}:{m.multiplier:g}" for m in sc0.meals),
                          key=K("meals"))
try:
    meals = parse_meals(meals_txt)
except ValueError:
    sb.error("Could not parse meals; using preset meals.")
    meals = sc0.meals
sens_on = sb.checkbox("Insulin-sensitivity change (illustrative mismatch)", value=sc0.sensitivity_change is not None,
                      key=K("senson"))
sens = None
if sens_on:
    sc_t, sc_f = sc0.sensitivity_change or (120.0, 1.5)
    sens = (sb.number_input("at t [min]", value=float(sc_t), key=K("senst")),
            sb.slider("p3 factor", 0.25, 3.0, float(sc_f), 0.05, key=K("sensf")))

sb.header("Feedforward / meal announcement")
f0 = sc0.ff
ff_on = sb.checkbox("Announce meals (feedforward)", value=f0.enabled, key=K("ffon"))
ff_mode = sb.selectbox("FF type", ["bolus", "leadlag"], index=["bolus", "leadlag"].index(f0.mode), key=K("ffmode"))
f_bolus = sb.slider("f_bolus", 0.0, 1.2, float(f0.f_bolus), 0.05, key=K("fb"))
est_err = sb.slider("Meal estimate error [%]", -50, 50, int(round(f0.est_error * 100)), 5, key=K("eps")) / 100
t_pre = sb.slider("Pre-bolus time [min before meal]", 0.0, 30.0, float(f0.t_pre), 1.0, key=K("tpre"))
susp = sb.checkbox("Suspend integral during bolus window", value=f0.suspend_integral, key=K("susp"))
susp_x = sb.slider("...and for this long after delivery [min]", 0.0, 120.0, float(f0.suspend_extra), 5.0,
                   key=K("suspx")) if susp else 0.0
tau_lg = sb.slider("Lead-lag lag tau_lg [min] (user choice)", 1.0, 60.0, float(f0.tau_lg), 1.0,
                   key=K("tlg")) if ff_mode == "leadlag" else f0.tau_lg

sb.header("Run")
sp = sb.number_input("Set point [mg/dL]", value=float(sc0.setpoint or P.G_basal), step=1.0, key=K("sp"))
sps_txt = sb.text_input("Set-point steps 't:value, ...'", ", ".join(f"{t:g}:{v:g}" for t, v in sc0.setpoint_steps),
                        key=K("sps"))
try:
    sp_steps = tuple((float(a), float(b)) for a, b in (x.split(":") for x in sps_txt.split(",") if x.strip()))
except ValueError:
    sb.error("Could not parse set-point steps.")
    sp_steps = sc0.setpoint_steps
t_end = sb.slider("Horizon [min]", 120.0, 1440.0, float(sc0.t_end), 30.0, key=K("tend"))
dt_opts = [0.05, 0.1, 0.25, 0.5]
dt = sb.selectbox("RK4 step dt [min] (advanced)", dt_opts, index=dt_opts.index(sc0.dt), key=K("dt"))
band_name = sb.radio("Safety band", ["Textbook 54-144", "Clinical 70-180 [to verify]"], key=K("band"))
band = BAND_TEXTBOOK if band_name.startswith("Textbook") else CLINICAL_BAND

mpc_cfg = sc0.mpc
if controller == "mpc":
    from apsim.mpc import MPCConfig
    m0 = sc0.mpc or MPCConfig()
    mpc_cfg = MPCConfig(horizon=sb.slider("MPC horizon [samples]", 6, 48, m0.horizon, 1, key=K("mh")),
                        w_hypo=sb.slider("Hypo weight / hyper weight", 1.0, 50.0, m0.w_hypo, 1.0, key=K("mw")),
                        g_min=sb.slider("Soft lower limit [mg/dL]", 54.0, 90.0, m0.g_min, 1.0, key=K("mg")),
                        dist_model=sb.selectbox("Disturbance model", ["meal", "output"],
                                                ["meal", "output"].index(m0.dist_model), key=K("mdm")),
                        r_du=sb.number_input("Move suppression r_du", value=m0.r_du, min_value=0.0, step=0.01,
                                             format="%.3f", key=K("mrdu")),
                        r_u=m0.r_u)

sc = Scenario(controller=controller, method=method, tau_c=tau_c, include_zoh=include_zoh,
              design_delay=design_delay, manual=tuple(float(x) for x in manual), N=N, beta=beta,
              anti_windup=anti_windup, Ts=float(Ts), dt=float(dt), t_end=float(t_end),
              sensor=SensorConfig(delay=delay, lag=lag, noise_sd=noise, seed=int(seed), fault=fault,
                                  t_fault=float(t_fault), drift_rate=float(drift),
                                  dropout_duration=float(drop_d)),
              meals=meals, ff=FFConfig(enabled=ff_on, mode=ff_mode, f_bolus=f_bolus, est_error=est_err,
                                       t_pre=t_pre, suspend_integral=susp, suspend_extra=susp_x, tau_lg=tau_lg),
              setpoint=sp, setpoint_steps=sp_steps, sensitivity_change=sens, mpc=mpc_cfg)
cfg = build_config(sc)
res = run(cfg)
t_ref = meals[0].t_meal if meals else (sp_steps[0][0] if sp_steps else 0.0)
met = compute_metrics(res, band=band, t_ref=t_ref)

tabs = st.tabs(["Simulation", "Model & Linearization", "Model Reduction", "Tuning & Stability",
                "Compare runs", "About / Sources"])

# ------------------------------------------------------------------ 1. Simulation
with tabs[0]:
    if res.message:
        st.warning(res.message)
    mt = met["true"]
    if mt["stayed_in_band"]:
        st.success(f"PASS: true glucose stayed inside {band[0]:g}-{band[1]:g} mg/dL")
    else:
        st.error(f"FAIL: true glucose left {band[0]:g}-{band[1]:g} mg/dL")
    fig = make_subplots(rows=3, cols=1, shared_xaxes=True, vertical_spacing=0.06,
                        row_heights=[0.5, 0.3, 0.2],
                        subplot_titles=("Glucose [mg/dL]", "Insulin infusion U [mU/min]", "Meal D(t) [mg/dL/min]"))
    fig.add_hrect(y0=band[0], y1=band[1], fillcolor="green", opacity=0.08, line_width=0, row=1, col=1)
    for y in band:
        fig.add_hline(y=y, line_dash="dot", line_color="green", row=1, col=1)
    fig.add_trace(go.Scatter(x=res.t, y=res.G_true, name="true glucose"), row=1, col=1)
    fig.add_trace(go.Scatter(x=res.t, y=res.G_meas, name="CGM (measured, held)", line=dict(dash="dot")), row=1, col=1)
    fig.add_trace(go.Scatter(x=res.t, y=res.setpoint, name="set point", line=dict(color="gray", width=1)), row=1, col=1)
    U_fb_eff = res.U - res.U_ff
    fig.add_trace(go.Scatter(x=res.t, y=np.minimum(U_fb_eff, res.U_basal), name="basal part (cut when PID < basal)",
                             stackgroup="u"), row=2, col=1)
    fig.add_trace(go.Scatter(x=res.t, y=np.maximum(U_fb_eff - res.U_basal, 0.0), name="feedback above basal",
                             stackgroup="u"), row=2, col=1)
    fig.add_trace(go.Scatter(x=res.t, y=res.U_ff, name="bolus / feedforward", stackgroup="u"), row=2, col=1)
    fig.add_hline(y=P.U_max, line_dash="dot", line_color="red", row=2, col=1)
    fig.add_trace(go.Scatter(x=res.t, y=res.D, name="D(t)"), row=3, col=1)
    fig.update_layout(height=750, xaxis3_title="time [min]")
    st.plotly_chart(fig, width="stretch")

    mm = met["measured"]
    rows = [("Peak [mg/dL]", "peak"), ("time of peak [min]", "t_peak"), ("Nadir [mg/dL]", "nadir"),
            ("time of nadir [min]", "t_nadir"), (f"% time in {band[0]:g}-{band[1]:g}", "pct_in_band"),
            ("% time in 70-180 [to verify]", "pct_in_70_180"), ("% time < 54", "pct_below_54"),
            ("% time < 70", "pct_below_70"), (f"% time > {band[1]:g}", "pct_above_band_high"),
            ("% time > 180", "pct_above_180"), ("IAE [mg/dL min]", "IAE"), ("ISE", "ISE"),
            ("settling time to +/-5 [min after event]", "settling_time")]
    c1, c2 = st.columns(2)
    c1.table({"metric": [r[0] for r in rows], "true": [f"{mt[k]:.2f}" for _, k in rows],
              "measured": [f"{mm[k]:.2f}" for _, k in rows]})
    c2.table({"insulin": ["total delivered [mU]", "feedback (incl. basal) [mU]", "feedforward [mU]",
                          "above basal [mU]", "time at U_max [min]", "time at U_min = 0 [min]",
                          "bolus planned [mU]", "effective sensor delay [min]"],
              "value": [f"{met['insulin_total']:.0f}", f"{met['insulin_feedback']:.0f}",
                        f"{met['insulin_feedforward']:.0f}", f"{met['insulin_above_basal']:.0f}",
                        f"{met['time_at_U_max']:.1f}", f"{met['time_at_U_min']:.1f}",
                        f"{res.bolus_planned:.0f}" if ff_on else "n/a", f"{res.sensor_delay_effective:.1f}"]})
    if controller == "mpc":
        st.caption("MPC is a STRETCH feature: illustrative, not a real device algorithm. With meals announced, the "
                   "announced estimate enters the prediction instead of a bolus.")
    if cfg.pid is not None:
        st.caption(f"PID in use: Kc = {cfg.pid.Kc:.4f} (mU/min)/(mg/dL), tauI = {cfg.pid.tauI:.2f} min, "
                   f"tauD = {cfg.pid.tauD:.2f} min, N = {cfg.pid.N:g}, anti-windup = {cfg.pid.anti_windup}")
    name = st.text_input("Name this run to save it for comparison", value=preset)
    if st.button("Save run for comparison (max 4)"):
        saved = st.session_state.setdefault("saved", [])
        saved.append((name, res))
        st.session_state["saved"] = saved[-4:]

# ------------------------------------------------------------------ 2. Model & linearization
with tabs[1]:
    st.subheader("Nonlinear model (deviation variables, Seborg Eqs. 23-16 to 23-18)")
    st.latex(r"\frac{dG}{dt} = -p_1 G - X\,(G + G_b) + D(t)")
    st.latex(r"\frac{dX}{dt} = -p_2 X + p_3 I")
    st.latex(r"\frac{dI}{dt} = -n\,(I + I_b) + \frac{U(t)}{V_1}")
    st.table({"symbol": list(PARAM_TABLE), "value": [f"{v.value:g}" for v in PARAM_TABLE.values()],
              "units": [v.units for v in PARAM_TABLE.values()], "meaning": [v.meaning for v in PARAM_TABLE.values()],
              "source": [v.source for v in PARAM_TABLE.values()]})
    st.markdown("**Units check (p3):** X multiplies G in dG/dt, so X has units 1/min. Then "
                "dX/dt = -p2 X + p3 I requires p3 in 1/min² per (mU/L), not the 1/min printed in the textbook. "
                "The value is used unchanged.")
    st.subheader("Basal steady state = controller bias")
    st.latex(rf"U_{{basal}} = n\,I_b\,V_1 = {P.n}\times{P.I_basal:g}\times{P.V1:g} = {P.U_basal:.3f}\ \mathrm{{mU/min}}")
    st.markdown(f"Pump can add **{P.upward_authority:.1f}** mU/min above basal but cut only "
                f"**{P.downward_authority:.2f}** mU/min below it: downward/upward authority = "
                f"**{P.authority_ratio:.2f}**. Insulin cannot be taken back, so overdelivery (integral windup, "
                "'insulin stacking') cannot be undone.")
    st.subheader("Linearization about the basal state")
    st.latex(r"A=\begin{bmatrix}-p_1 & -G_b & 0\\0&-p_2&p_3\\0&0&-n\end{bmatrix},\;"
             r"B_u=\begin{bmatrix}0\\0\\1/V_1\end{bmatrix},\;B_d=\begin{bmatrix}1\\0\\0\end{bmatrix},\;C=[1\;0\;0]")
    st.write("A =", LM.A)
    st.latex(r"G_p(s)=\frac{-G_b p_3/V_1}{(s+p_1)(s+p_2)(s+n)}=\frac{K_p}{(\tau_G s+1)(\tau_X s+1)(\tau_I s+1)},\quad "
             r"G_d(s)=\frac{1}{s+p_1}")
    st.table({"quantity": ["Kp [(mg/dL)/(mU/min)]", "tau_G = 1/p1 [min]", "tau_X = 1/p2 [min]",
                           "tau_I = 1/n [min]", "Kd [(mg/dL)/(mg/dL/min)]"],
              "value": [f"{LM.Kp:.4f}", f"{LM.tau_G:.2f}", f"{LM.tau_X:.2f}", f"{LM.tau_I:.2f}", f"{LM.Kd:.2f}"]})
    st.subheader("Nonlinearity: steady-state gain vs. step size")
    dUs = np.linspace(-16.0, 98.0, 229)
    dUs = dUs[np.abs(dUs) > 1e-9]
    fg = go.Figure(go.Scatter(x=dUs, y=nonlinear_gain_curve(P, dUs), name="nonlinear dG_ss/dU"))
    fg.add_hline(y=LM.Kp, line_dash="dash", annotation_text=f"linear Kp = {LM.Kp:.3f}")
    fg.update_layout(xaxis_title="step size dU [mU/min]", yaxis_title="dG_ss/dU", height=400)
    st.plotly_chart(fg, width="stretch")
    st.caption("At steady state G = -X·G_b/(p1 + X): the effective gain shrinks as insulin rises. "
               "At dU = +1 the gain is -4.27, not -4.506.")

# ------------------------------------------------------------------ 3. Model reduction
with tabs[2]:
    rm = rm_cached()
    t, y = rm["t"], rm["y"]
    fr = go.Figure()
    fr.add_trace(go.Scatter(x=t, y=y, name="nonlinear model (dU=+1)", line=dict(width=4)))
    fr.add_trace(go.Scatter(x=t, y=linear_step(LM, t), name="linear 3rd order"))
    h, hf = rm["half_sopdt"], rm["half_fopdt"]
    s, f = rm["fit_sopdt"], rm["fit_fopdt"]
    fr.add_trace(go.Scatter(x=t, y=sopdt_step(t, h.K, h.tau1, h.tau2, h.theta), name="half-rule SOPDT", line=dict(dash="dot")))
    fr.add_trace(go.Scatter(x=t, y=fopdt_step(t, hf.K, hf.tau, hf.theta), name="half-rule FOPDT", line=dict(dash="dot")))
    fr.add_trace(go.Scatter(x=t, y=sopdt_step(t, s.K, s.tau1, s.tau2, s.theta), name="LSQ SOPDT", line=dict(dash="dash")))
    fr.add_trace(go.Scatter(x=t, y=fopdt_step(t, f.K, f.tau, f.theta), name="LSQ FOPDT", line=dict(dash="dash")))
    fr.update_layout(xaxis_title="time [min]", yaxis_title="glucose deviation per mU/min", height=450)
    st.plotly_chart(fr, width="stretch")
    fs, ff_ = rm["fit_sopdt_stats"], rm["fit_fopdt_stats"]
    st.table({"model": ["half-rule SOPDT", "half-rule FOPDT", "LSQ SOPDT", "LSQ FOPDT"],
              "K": [f"{h.K:.3f}", f"{hf.K:.3f}", f"{s.K:.3f}", f"{f.K:.3f}"],
              "tau1 / tau": [f"{h.tau1:.2f}", f"{hf.tau:.2f}", f"{s.tau1:.2f}", f"{f.tau:.2f}"],
              "tau2": [f"{h.tau2:.2f}", "-", f"{s.tau2:.2f}", "-"],
              "theta": [f"{h.theta:.2f}", f"{hf.theta:.2f}", f"{s.theta:.2f}", f"{f.theta:.2f}"],
              "RMSE vs nonlinear": ["-", "-", f"{fs.rmse:.4f}", f"{ff_.rmse:.4f}"],
              "max error": ["-", "-", f"{fs.max_err:.4f}", f"{ff_.max_err:.4f}"]})
    st.caption("The LSQ SOPDT fit converges to tau1 = tau2 (critically damped); the equal-tau limit is "
               "handled analytically. Half-rule models use the LINEAR gain -4.506; fits see the nonlinear -4.27.")

# ------------------------------------------------------------------ 4. Tuning & stability
with tabs[3]:
    if method == "manual" or controller != "pid":
        st.info("Step-by-step IMC calculation shown for the selected IMC method; manual / non-PID selected.")
    else:
        tun, info = design(design_spec(sc), P)
        m = info["model"]
        st.subheader(f"{tun.rule} from the {info['model_name']} model")
        st.markdown(f"theta_total = theta_model + theta_sensor + (Ts/2 if enabled) = {info['theta_model']:.2f} + "
                    f"{info['theta_sensor']:.2f} + {info['theta_zoh']:.2f} = **{info['theta_total']:.2f} min**; "
                    f"tau_c = **{info['tau_c']:.2f} min**")
        if hasattr(m, "tau1") and tun.rule.startswith("IMC SOPDT"):
            st.latex(rf"K_c=\frac{{\tau_1+\tau_2}}{{K(\tau_c+\theta)}}=\frac{{{m.tau1:.2f}+{m.tau2:.2f}}}"
                     rf"{{{m.K:.3f}\,({info['tau_c']:.2f}+{info['theta_total']:.2f})}}={tun.Kc:.4f}")
            st.latex(rf"\tau_I=\tau_1+\tau_2={tun.tauI:.2f},\quad \tau_D=\frac{{\tau_1\tau_2}}{{\tau_1+\tau_2}}={tun.tauD:.2f}")
        else:
            st.write({"Kc": tun.Kc, "tauI": tun.tauI, "tauD": tun.tauD})
    pc = scenario_pid(sc)
    st.subheader("Loop frequency response (full 3rd-order linear Gp, filtered PID)")
    st.caption(f"Kc = {pc.Kc:.4f}, tauI = {pc.tauI:.2f}, tauD = {pc.tauD:.2f}, N = {pc.N:g}")
    try:
        m0 = margins(LM, pc.Kc, pc.tauI, pc.tauD, pc.N, 0.0)
        md = margins(LM, pc.Kc, pc.tauI, pc.tauD, pc.N, delay)
        st.table({"": ["crossover wc [rad/min]", "phase margin [deg]", "gain margin", "max additional delay [min]",
                       "total tolerable delay [min]", "minus Ts/2 sampling allowance [min]"],
                  "no delay in loop": [f"{m0.wc:.4f}", f"{m0.PM_deg:.1f}", f"{m0.GM:.2f}", f"{m0.dtheta_max:.1f}",
                                       f"{m0.total_tolerable_delay:.1f}", f"{m0.total_tolerable_delay - Ts / 2:.1f}"],
                  f"with sensor delay {delay:g} min": [f"{md.wc:.4f}", f"{md.PM_deg:.1f}", f"{md.GM:.2f}",
                                                       f"{md.dtheta_max:.1f}", f"{md.total_tolerable_delay:.1f}",
                                                       f"{md.total_tolerable_delay - Ts / 2:.1f}"]})
        w, mag, ph, L = bode_data(LM, pc.Kc, pc.tauI, pc.tauD, pc.N, delay)
        fb = make_subplots(rows=1, cols=2, subplot_titles=("Bode", "Nyquist"))
        fb.add_trace(go.Scatter(x=w, y=20 * np.log10(mag), name="|L| [dB]"), row=1, col=1)
        fb.add_trace(go.Scatter(x=w, y=ph, name="phase [deg]", yaxis="y3"), row=1, col=1)
        fb.add_trace(go.Scatter(x=L.real, y=L.imag, name="L(jw)"), row=1, col=2)
        fb.add_trace(go.Scatter(x=[-1], y=[0], mode="markers", name="-1", marker=dict(size=10, color="red")), row=1, col=2)
        fb.update_xaxes(type="log", title="w [rad/min]", row=1, col=1)
        fb.update_xaxes(range=[-3, 1], row=1, col=2)
        fb.update_yaxes(range=[-3, 1], row=1, col=2)
        fb.update_layout(height=450, yaxis3=dict(overlaying="y", side="right", title="phase"))
        st.plotly_chart(fb, width="stretch")
    except ValueError as e:
        st.error(f"Margins not computed: {e}")
    if st.button("Run empirical delay sweep (nonlinear sampled loop, unbounded pump; ~10 s)"):
        with st.spinner("bisecting on sensor delay..."):
            ed = emp_delay(pc, float(Ts))
        st.write(f"Smallest sensor delay giving sustained oscillation: **{ed:.1f} min** "
                 f"(continuous-time prediction {m0.total_tolerable_delay:.1f} min). The sampled loop goes unstable "
                 "earlier because of the ZOH (~Ts/2) and the discrete derivative.")

# ------------------------------------------------------------------ 5. Compare
with tabs[4]:
    saved = st.session_state.get("saved", [])
    if not saved:
        st.info("Save runs from the Simulation tab to overlay up to 4 of them here.")
    else:
        fc = make_subplots(rows=2, cols=1, shared_xaxes=True, subplot_titles=("Glucose", "U"))
        fc.add_hrect(y0=band[0], y1=band[1], fillcolor="green", opacity=0.08, line_width=0, row=1, col=1)
        for nm, r in saved:
            fc.add_trace(go.Scatter(x=r.t, y=r.G_true, name=nm), row=1, col=1)
            fc.add_trace(go.Scatter(x=r.t, y=r.U, name=nm + " U", showlegend=False), row=2, col=1)
        fc.update_layout(height=650)
        st.plotly_chart(fc, width="stretch")
        tbl = {"run": [], "peak": [], "nadir": [], "% in band": [], "insulin [mU]": []}
        for nm, r in saved:
            mm_ = compute_metrics(r, band=band)
            tbl["run"].append(nm)
            tbl["peak"].append(f"{mm_['true']['peak']:.1f}")
            tbl["nadir"].append(f"{mm_['true']['nadir']:.1f}")
            tbl["% in band"].append(f"{mm_['true']['pct_in_band']:.1f}")
            tbl["insulin [mU]"].append(f"{mm_['insulin_total']:.0f}")
        st.table(tbl)
        if st.button("Clear saved runs"):
            st.session_state["saved"] = []

# ------------------------------------------------------------------ 6. About
with tabs[5]:
    st.warning(DISCLAIMER)
    st.subheader("Feedforward: why ideal FF is impossible")
    num, _ = ideal_ff_coefficients(P)
    st.latex(r"G_f(s)=-\frac{G_d(s)}{G_p(s)}=\frac{V_1\,(s+p_2)(s+n)}{G_b\,p_3}")
    st.markdown("Numerator order 2 > denominator order 0: **improper**, needs the 2nd derivative of D. "
                "The meal hits glucose directly while insulin acts through two lags, so perfect cancellation is "
                "physically unrealizable (Seborg Ch. 15).")
    st.markdown(f"Static gain Kf = -Kd/Kp = **{static_ff_gain(P):.3f}** (mU/min)/(mg/dL/min); "
                f"textbook meal bolus = Kf · A/k = **{bolus_total(Meal(0.0), FFConfig(enabled=True), P):.0f} mU**.")
    st.subheader("Sources")
    st.markdown("""
- Seborg, Edgar, Mellichamp & Doyle, *Process Dynamics and Control*, 4th ed., Wiley. Ch. 8, 12 (Table 12.1), 15, 16,
  **Ch. 23 Sec. 23.2.1, Example 23.3; Exercises 23.6, 23.7**.
- Bequette (2002): model source cited in Seborg Example 23.3 *(full citation from Seborg's reference list)*.
- Bergman et al. (1979): minimal model *[TO VERIFY]*.
- Doyle III et al. (2014), as cited in Seborg Sec. 23.2.
- Skogestad (2003), *J. Process Control*: half rule / SIMC *[TO VERIFY]*.
- """ + CLINICAL_BAND_SOURCE + """
- ADA (2014) targets as quoted in Seborg Sec. 23.2.
""")
    st.subheader("Assignment sections (placeholders)")
    st.markdown("- **YouTube link:** _TBD_\n- **Verbatim transcript:** _TBD_\n- **AI process (multi-model plan → critique → build):** "
                "see BUILD_LOG.md and NOTES_FOR_ANDREW.md in the repo\n- **Attribution:** _TBD_")
