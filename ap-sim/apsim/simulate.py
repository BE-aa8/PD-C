"""Fixed-step RK4 simulation engine (Sec. 11).

Why fixed-step RK4 instead of solve_ivp: the sampled controller, zero-order hold and
sensor delay buffer need deterministic, aligned time steps.  Sample instants are found
with integer step counters (i % steps_per_sample == 0), never float modulo.

Event order within each dt step i (t = i*dt):
  1. Record the true state; push (lagged) true glucose into the sensor history.
  2. If i is a sample instant: read the sensor, run the controller, latch U_fb.
  3. Compute the feedforward/bolus contribution U_ff for this step.
  4. U = clip(U_fb + U_ff, U_min, U_max)  (optionally quantized); log U_fb, U_ff, U.
  5. D(t): evaluated at the RK4 substep times (d_mode='substep', default), held at the
     mid-step value D(t_i + dt/2) (d_mode='hold_mid'), or held at D(t_i) (d_mode='hold').
     'hold_mid' agrees with 'substep' to < 0.1 mg/dL (test).  The left-endpoint 'hold'
     is only first-order accurate in D and differs by ~0.21 mg/dL at dt = 0.1 (logged).
  6. RK4 step of [G, X, I, G_lag] with U held (ZOH) over the step.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .controller import PID, PIDConfig
from .disturbance import Meal, meal_rate
from .feedforward import Feedforward, FFConfig
from .params import DEFAULT_PARAMS, G_VALIDITY_LOW, Params
from .patient import rhs_scalar
from .pump import quantize, saturate
from .sensor import Sensor, SensorConfig


@dataclass(frozen=True)
class SimConfig:
    """Fully defines one run.  Frozen + tuples only -> hashable (Streamlit cache key)."""
    params: Params = DEFAULT_PARAMS
    t_end: float = 600.0
    dt: float = 0.1
    Ts: float = 5.0
    controller: str = "pid"          # pid | none (basal only) | mpc (stretch)
    pid: PIDConfig | None = None
    mpc: object | None = None        # apsim.mpc.MPCConfig (stretch)
    U_open_loop: float | None = None  # constant pump rate when controller='none' (None -> basal)
    setpoint: float | None = None    # absolute mg/dL; None -> G_basal
    setpoint_steps: tuple[tuple[float, float], ...] = ()  # (t, new absolute set point)
    sensor: SensorConfig = field(default_factory=SensorConfig)
    meals: tuple[Meal, ...] = (Meal(0.0),)
    ff: FFConfig = field(default_factory=FFConfig)
    sensitivity_change: tuple[float, float] | None = None  # (t_s, factor on p3)
    saturation: bool = True          # False -> unbounded actuator (stability sweep)
    U_quant: float = 0.0             # pump resolution, mU/min (0 = continuous)
    d_mode: str = "substep"          # substep | hold_mid | hold


@dataclass
class Result:
    t: np.ndarray
    G_true: np.ndarray       # absolute mg/dL
    G_meas: np.ndarray       # absolute mg/dL, held between samples (NaN on dropout)
    G_sensor_lag: np.ndarray  # lagged true glucose (before delay/noise)
    X: np.ndarray
    I: np.ndarray            # deviation mU/L
    U: np.ndarray
    U_fb: np.ndarray
    U_ff: np.ndarray
    D: np.ndarray
    S: np.ndarray            # PID integral state
    setpoint: np.ndarray
    saturated: np.ndarray    # bool: total U at a limit (U_max or U_min)
    fb_saturated: np.ndarray  # bool: unclipped PID output outside limits
    bolus_active: np.ndarray
    dropout: np.ndarray
    valid: bool = True
    message: str = ""
    sensor_delay_effective: float = 0.0
    bolus_planned: float = 0.0
    bolus_delivered: float = 0.0
    bolus_log: list = field(default_factory=list)
    U_basal: float = 0.0
    U_min: float = 0.0
    U_max: float = 115.0
    G_validity_low: float = G_VALIDITY_LOW


def _rk4(y, U, D0, Dm, D1, p, p3s, tau_s, dt):
    G, X, I, Gl = y

    def f(G, X, I, Gl, D):
        dG, dX, dI = rhs_scalar(G, X, I, U, D, p, p3s)
        dGl = ((G + p.G_basal) - Gl) / tau_s if tau_s > 0 else 0.0
        return dG, dX, dI, dGl

    h = dt
    k1 = f(G, X, I, Gl, D0)
    k2 = f(G + h / 2 * k1[0], X + h / 2 * k1[1], I + h / 2 * k1[2], Gl + h / 2 * k1[3], Dm)
    k3 = f(G + h / 2 * k2[0], X + h / 2 * k2[1], I + h / 2 * k2[2], Gl + h / 2 * k2[3], Dm)
    k4 = f(G + h * k3[0], X + h * k3[1], I + h * k3[2], Gl + h * k3[3], D1)
    out = [y[j] + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]) for j in range(4)]
    if tau_s <= 0:
        out[3] = out[0] + p.G_basal
    return out


def simulate(cfg: SimConfig) -> Result:
    p = cfg.params
    dt = cfg.dt
    n_steps = int(round(cfg.t_end / dt))
    sps = int(round(cfg.Ts / dt))
    if abs(sps * dt - cfg.Ts) > 1e-9:
        raise ValueError(f"Ts={cfg.Ts} must be a whole multiple of dt={dt}")
    U_lo, U_hi = (p.U_min, p.U_max) if cfg.saturation else (-math.inf, math.inf)
    U_basal = p.U_basal
    sp0 = p.G_basal if cfg.setpoint is None else cfg.setpoint
    sp_steps = sorted(cfg.setpoint_steps)

    sensor = Sensor(cfg.sensor, dt, p.G_basal)
    pid = None
    mpc = None
    if cfg.controller == "pid":
        if cfg.pid is None:
            raise ValueError("controller='pid' needs cfg.pid")
        pid = PID(cfg.pid, cfg.Ts, U_basal, U_lo, U_hi)
    elif cfg.controller == "mpc":
        from .mpc import MPC
        mpc = MPC(cfg.mpc, p, cfg.Ts, cfg.sensor.delay, U_lo, U_hi, cfg.meals, cfg.ff)
    ff = Feedforward(cfg.ff, cfg.meals, p, dt)
    U_ol = U_basal if cfg.U_open_loop is None else cfg.U_open_loop

    N = n_steps + 1
    arr = {k: np.zeros(N) for k in ("t", "G", "Gm", "Gl", "X", "I", "U", "Ufb", "Uff",
                                    "D", "S", "sp")}
    flags = {k: np.zeros(N, dtype=bool) for k in ("sat", "fbsat", "bolus", "drop")}

    y = [0.0, 0.0, 0.0, p.G_basal]   # G, X, I deviations; G_lag absolute
    U_fb = U_ol if cfg.controller == "none" else saturate(U_basal, U_lo, U_hi)
    G_meas = p.G_basal
    valid, msg = True, ""
    last = n_steps
    for i in range(N):
        t = i * dt
        sp = sp0
        for ts, v in sp_steps:
            if t + 1e-9 >= ts:
                sp = v
        p3s = 1.0
        if cfg.sensitivity_change is not None and t + 1e-9 >= cfg.sensitivity_change[0]:
            p3s = cfg.sensitivity_change[1]

        # 1. record true state, push into sensor history
        if y[0] + p.G_basal <= 0 or not all(map(math.isfinite, y)):
            valid, msg, last = False, f"model invalid: glucose <= 0 at t={t:.1f} min", i - 1
            break
        sensor.push(y[3])

        # 2. sample instant -> sensor read + controller update
        drop = False
        if i % sps == 0:
            G_meas = sensor.read(t)
            drop = math.isnan(G_meas)
            if pid is not None:
                pid.integral_frozen = cfg.ff.enabled and cfg.ff.suspend_integral and ff.bolus_active(t)
                U_fb = pid.update(sp, G_meas)
            elif mpc is not None:
                U_fb = mpc.update(sp, G_meas, t, ff)
        # 3. feedforward, 4. total input
        # (with MPC, an announced meal enters the MPC prediction instead of a bolus)
        U_ff = ff.step(t, U_fb) if mpc is None else 0.0
        U = quantize(saturate(U_fb + U_ff, U_lo, U_hi), cfg.U_quant)

        # 5. disturbance
        D0 = meal_rate(t, cfg.meals)
        if cfg.d_mode == "hold":            # left-endpoint hold: 1st-order accurate in D
            Dm = D1 = D0
        elif cfg.d_mode == "hold_mid":      # hold the mid-step value: 2nd-order accurate
            Dm = D1 = D0 = meal_rate(t + dt / 2, cfg.meals)
        else:
            Dm = meal_rate(t + dt / 2, cfg.meals)
            D1 = meal_rate(t + dt, cfg.meals)

        arr["t"][i] = t
        arr["G"][i] = y[0] + p.G_basal
        arr["Gm"][i] = G_meas
        arr["Gl"][i] = y[3]
        arr["X"][i] = y[1]
        arr["I"][i] = y[2]
        arr["U"][i] = U
        arr["Ufb"][i] = U_fb
        arr["Uff"][i] = U_ff
        arr["D"][i] = D0
        arr["S"][i] = pid.S if pid is not None else 0.0
        arr["sp"][i] = sp
        flags["sat"][i] = cfg.saturation and (U >= p.U_max - 1e-9 or U <= p.U_min + 1e-9)
        flags["fbsat"][i] = pid.saturated if pid is not None else False
        flags["bolus"][i] = U_ff > 0
        flags["drop"][i] = drop

        # 6. integrate
        if i < n_steps:
            y = _rk4(y, U, D0, Dm, D1, p, p3s, cfg.sensor.lag, dt)

    early = ([b for b, _ in ff.boluses if b < 0]
             if cfg.ff.enabled and cfg.ff.mode == "bolus" and mpc is None else [])
    if early:
        msg = (msg + " " if msg else "") + (
            f"warning: {len(early)} bolus(es) scheduled before t=0 (meal earlier than the "
            "pre-bolus time); delivery started at t=0 instead.")
    sl = slice(0, last + 1)
    G_lo = float(np.min(arr["G"][sl])) if last >= 0 else math.nan
    if G_lo < G_VALIDITY_LOW:
        msg = (msg + " " if msg else "") + (
            f"warning: true glucose fell to {G_lo:.1f} mg/dL (< {G_VALIDITY_LOW:g}). The minimal model has "
            "no counter-regulation (no glucagon), so this part of the trajectory is qualitative only.")
    return Result(
        t=arr["t"][sl], G_true=arr["G"][sl], G_meas=arr["Gm"][sl], G_sensor_lag=arr["Gl"][sl],
        X=arr["X"][sl], I=arr["I"][sl], U=arr["U"][sl], U_fb=arr["Ufb"][sl], U_ff=arr["Uff"][sl],
        D=arr["D"][sl], S=arr["S"][sl], setpoint=arr["sp"][sl], saturated=flags["sat"][sl],
        fb_saturated=flags["fbsat"][sl], bolus_active=flags["bolus"][sl], dropout=flags["drop"][sl],
        valid=valid, message=msg, sensor_delay_effective=sensor.effective_delay,
        bolus_planned=ff.planned_total, bolus_delivered=ff.delivered, bolus_log=ff.delivery_log,
        U_basal=U_basal, U_min=p.U_min, U_max=p.U_max,
    )
