import { DATA } from './data.js';

// Physical constants from DATA.params
const p1 = DATA.params.p1.value;
const p2 = DATA.params.p2.value;
const p3 = DATA.params.p3.value;
const n = DATA.params.n.value;
const V1 = DATA.params.V1.value;
const Gb = DATA.params.G_basal.value;
const Ib = DATA.params.I_basal.value;
const Umax = DATA.params.U_max.value;
const Umin = DATA.params.U_min.value;
const meal_A = DATA.params.meal_A.value;
const meal_k = DATA.params.meal_k.value;

// Derived quantities
const U_basal = n * Ib * V1;
const Kp = -Gb * p3 / (V1 * p1 * p2 * n);
const Kd = 1.0 / p1;
const tauG = 1.0 / p1;
const tauX = 1.0 / p2;
const tauI = 1.0 / n;
const Kf = (V1 * p2 * n) / (Gb * p3);
const authorityRatio = U_basal / (Umax - U_basal);

export const DEFAULT_INPUTS = {
  t_end: 660.0,
  dt: 0.1,
  Ts: 5.0,
  controller: 'pid',
  mode: 'PID',
  Kc: -0.4256497891832498,
  tauI: 70.2969953858151,
  tauD: 17.57424884645377,
  N: 10.0,
  beta: 1.0,
  anti_windup: 'clamp',
  U_open_loop: null,
  setpoint: 81.0,
  setpoint_steps: [],
  sensor_delay: 10.0,
  sensor_lag: 0.0,
  noise_sd: 0.0,
  seed: 0,
  fault: 'none',
  t_fault: 60.0,
  drift_rate: 0.0,
  dropout_duration: 30.0,
  meals: [
    [60.0, 1.0]
  ],
  ff_enabled: false,
  f_bolus: 1.0,
  est_error: 0.0,
  t_pre: 0.0,
  suspend_integral: false,
  suspend_extra: 0.0,
  sensitivity_change: null,
  saturation: true
};

export function linearModel() {
  return {
    U_basal,
    Kp,
    Kd,
    tauG,
    tauX,
    tauI,
    Kf,
    authorityRatio
  };
}

export function nonlinearGain(dU) {
  if (Math.abs(dU) < 1e-12) {
    return Kp;
  }
  const I = dU / (n * V1);
  const X = (p3 * I) / p2;
  const G = -(X * Gb) / (p1 + X);
  return G / dU;
}

export function halfRule() {
  const lags = [tauX, tauG, tauI].sort((a, b) => b - a);
  const tau1_star = lags[0];
  const tau2_star = lags[1];
  const tau3_star = lags[2];

  return {
    sopdt: {
      K: Kp,
      tau1: tau1_star,
      tau2: tau2_star + tau3_star / 2.0,
      theta: tau3_star / 2.0
    },
    fopdt: {
      K: Kp,
      tau: tau1_star + tau2_star / 2.0,
      theta: tau2_star / 2.0 + tau3_star
    }
  };
}

export function imcTuning({ model = 'fit_sopdt', tau_c = 20.0, theta_sensor = 0.0, Ts = 5.0, include_zoh = false } = {}) {
  let K, tau1, tau2, tau, theta_model;

  if (model === 'fit_sopdt') {
    const f = DATA.fits.fit_sopdt;
    K = f.K;
    tau1 = f.tau1;
    tau2 = f.tau2;
    theta_model = f.theta;
  } else if (model === 'half_sopdt') {
    const hr = halfRule().sopdt;
    K = hr.K;
    tau1 = hr.tau1;
    tau2 = hr.tau2;
    theta_model = hr.theta;
  } else if (model === 'fit_fopdt_pi' || model === 'fit_fopdt_pid') {
    const f = DATA.fits.fit_fopdt;
    K = f.K;
    tau = f.tau;
    theta_model = f.theta;
  } else if (model === 'half_fopdt_pi') {
    const hr = halfRule().fopdt;
    K = hr.K;
    tau = hr.tau;
    theta_model = hr.theta;
  } else {
    throw new Error(`Unknown model: ${model}`);
  }

  const theta_total = theta_model + theta_sensor + (include_zoh ? Ts / 2.0 : 0.0);

  if (model === 'fit_sopdt' || model === 'half_sopdt') {
    const tauI = tau1 + tau2;
    const tauD = (tau1 * tau2) / (tau1 + tau2);
    const Kc = (1.0 / K) * (tau1 + tau2) / (tau_c + theta_total);
    return { Kc, tauI, tauD, theta_total };
  } else if (model === 'fit_fopdt_pi' || model === 'half_fopdt_pi') {
    const tauI = tau;
    const tauD = 0.0;
    const Kc = (1.0 / K) * tau / (tau_c + theta_total);
    return { Kc, tauI, tauD, theta_total };
  } else {
    // fit_fopdt_pid
    const tauI = tau + theta_total / 2.0;
    const tauD = (tau * (theta_total / 2.0)) / (tau + theta_total / 2.0);
    const Kc = (1.0 / K) * (tau + theta_total / 2.0) / (tau_c + theta_total / 2.0);
    return { Kc, tauI, tauD, theta_total };
  }
}

function loopResponse(w, Kc, tauI, tauD, N, theta) {
  // Gp(jw) = Kp / ((1 + j w tauG)(1 + j w tauX)(1 + j w tauI))
  const mag_Gp = Math.abs(Kp) / (
    Math.sqrt(1.0 + Math.pow(w * tauG, 2)) *
    Math.sqrt(1.0 + Math.pow(w * tauX, 2)) *
    Math.sqrt(1.0 + Math.pow(w * tauI_proc, 2))
  );
  const phase_Gp = -Math.atan(w * tauG) - Math.atan(w * tauX) - Math.atan(w * tauI_proc);

  // Gc(jw) = Kc * [1 + 1/(j w tauI) + (j w tauD) / (1 + j w tauD / N)]
  let re_bracket = 1.0;
  let im_bracket = 0.0;

  if (Number.isFinite(tauI) && tauI > 0) {
    im_bracket -= 1.0 / (w * tauI);
  }
  if (tauD > 0 && N > 0) {
    const wtauD = w * tauD;
    const denom = 1.0 + Math.pow(wtauD / N, 2);
    re_bracket += (Math.pow(wtauD, 2) / N) / denom;
    im_bracket += wtauD / denom;
  }

  const mag_bracket = Math.hypot(re_bracket, im_bracket);
  const phase_bracket = Math.atan2(im_bracket, re_bracket);

  const mag_L = Math.abs(Kc) * mag_bracket * mag_Gp;
  // Delay phase: -w * theta
  const phase_L = phase_bracket + phase_Gp - w * theta;

  return { mag: mag_L, phase: phase_L };
}
const tauI_proc = tauI; // process tauI = 1/n

export function margins({ Kc, tauI, tauD, N = 10, theta = 0 } = {}) {
  const w_min = 1e-5;
  const w_max = 10.0;
  const steps = 3000;

  // Find wc: highest-frequency |L| = 1 crossing in [1e-5, 10]
  let wc = null;
  for (let k = steps; k >= 0; k--) {
    const w1 = w_min * Math.pow(w_max / w_min, k / steps);
    const w2 = w_min * Math.pow(w_max / w_min, (k - 1) / steps);
    const res1 = loopResponse(w1, Kc, tauI, tauD, N, theta);
    const res2 = loopResponse(w2, Kc, tauI, tauD, N, theta);

    if ((res1.mag - 1.0) * (res2.mag - 1.0) <= 0) {
      // Bisect between w2 and w1
      let low = w2;
      let high = w1;
      for (let iter = 0; iter < 60; iter++) {
        const mid = (low + high) / 2.0;
        const mid_res = loopResponse(mid, Kc, tauI, tauD, N, theta);
        if ((res2.mag - 1.0) * (mid_res.mag - 1.0) <= 0) {
          high = mid;
        } else {
          low = mid;
        }
      }
      wc = (low + high) / 2.0;
      break;
    }
  }

  if (wc === null) {
    wc = w_min;
  }

  const resp_wc = loopResponse(wc, Kc, tauI, tauD, N, theta);
  const PM_deg = 180.0 + resp_wc.phase * (180.0 / Math.PI);
  const PM_rad = PM_deg * (Math.PI / 180.0);
  const dtheta_max = PM_rad / wc;
  const total_tolerable_delay = theta + dtheta_max;

  // Find GM: lowest-frequency -180 deg (-PI) crossing in [1e-5, 10]
  let w180 = null;
  for (let k = 0; k < steps; k++) {
    const w1 = w_min * Math.pow(w_max / w_min, k / steps);
    const w2 = w_min * Math.pow(w_max / w_min, (k + 1) / steps);
    const res1 = loopResponse(w1, Kc, tauI, tauD, N, theta);
    const res2 = loopResponse(w2, Kc, tauI, tauD, N, theta);

    if ((res1.phase + Math.PI) * (res2.phase + Math.PI) <= 0) {
      let low = w1;
      let high = w2;
      for (let iter = 0; iter < 60; iter++) {
        const mid = (low + high) / 2.0;
        const mid_res = loopResponse(mid, Kc, tauI, tauD, N, theta);
        if ((res1.phase + Math.PI) * (mid_res.phase + Math.PI) <= 0) {
          high = mid;
        } else {
          low = mid;
        }
      }
      w180 = (low + high) / 2.0;
      break;
    }
  }

  let GM = Infinity;
  if (w180 !== null) {
    const resp_180 = loopResponse(w180, Kc, tauI, tauD, N, theta);
    if (resp_180.mag > 0) {
      GM = 1.0 / resp_180.mag;
    }
  }

  return {
    wc,
    PM_deg,
    GM,
    dtheta_max,
    total_tolerable_delay
  };
}

function createMulberry32(seed) {
  let a = (seed >>> 0);
  return function() {
    let t = (a += 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296.0;
  };
}

export function simulate(inputs = {}) {
  const cfg = { ...DEFAULT_INPUTS, ...inputs };
  const t_end = cfg.t_end;
  const dt = cfg.dt;
  const Ts = cfg.Ts;
  const N = Math.round(t_end / dt);
  const steps_per_sample = Math.round(Ts / dt);

  let Kc = cfg.Kc;
  let tauI = cfg.tauI;
  let tauD = cfg.tauD;
  if (cfg.mode === 'PI') {
    tauD = 0.0;
  } else if (cfg.mode === 'P') {
    tauI = Infinity;
    tauD = 0.0;
  }
  const N_filter = cfg.N;
  const beta = cfg.beta;
  const anti_windup = cfg.anti_windup;

  const sensor_delay = cfg.sensor_delay;
  const sensor_lag = cfg.sensor_lag;
  const delay_steps = Math.round(sensor_delay / dt);
  const noise_sd = cfg.noise_sd;
  const seed = cfg.seed;
  const fault = cfg.fault;
  const t_fault = cfg.t_fault;
  const drift_rate = cfg.drift_rate;
  const dropout_duration = cfg.dropout_duration;

  const rng = createMulberry32(seed);
  function nextGaussian() {
    let u1 = rng();
    while (u1 <= 1e-15) u1 = rng();
    const u2 = rng();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  const meals = cfg.meals || [];
  const ff_enabled = cfg.ff_enabled;
  const f_bolus = cfg.f_bolus;
  const est_error = cfg.est_error;
  const t_pre = cfg.t_pre;
  const suspend_integral = cfg.suspend_integral;
  const suspend_extra = cfg.suspend_extra;

  let bolusPlanned = 0.0;
  const boluses = [];
  const warnings = [];

  if (ff_enabled) {
    for (const [t_m, mult] of meals) {
      const amt = f_bolus * Kf * (1.0 + est_error) * meal_A * mult / meal_k;
      bolusPlanned += amt;
      let t_start = t_m - t_pre;
      if (t_start < 0) {
        t_start = 0;
        warnings.push('Bolus scheduled before t = 0 was delivered starting at t = 0.');
      }
      boluses.push({ start: t_start, total: amt, queued: false });
    }
  }

  function evalD(t) {
    let sum = 0.0;
    for (const [t_m, mult] of meals) {
      if (t >= t_m - 1e-9) {
        sum += meal_A * mult * Math.exp(-meal_k * (t - t_m));
      }
    }
    return sum;
  }

  const t_arr = new Float64Array(N + 1);
  const G_arr = new Float64Array(N + 1);
  const Gm_arr = new Array(N + 1);
  const U_arr = new Float64Array(N + 1);
  const Ufb_arr = new Float64Array(N + 1);
  const Uff_arr = new Float64Array(N + 1);
  const D_arr = new Float64Array(N + 1);
  const sp_arr = new Float64Array(N + 1);

  // Sensor ring buffer
  const ring_buffer = delay_steps > 0 ? new Float64Array(delay_steps).fill(Gb) : null;
  let ring_idx = 0;

  // States
  let G = 0.0;
  let X = 0.0;
  let I = 0.0;
  let Gl = Gb;

  let S = 0.0;
  let d_prev = 0.0;
  let m_prev = Gb;
  let last_good_Gm = Gb;
  let remaining_bolus = 0.0;
  let freeze_until = -1.0;
  let bolusDelivered = 0.0;
  let U_fb = (cfg.controller === 'none') ? (cfg.U_open_loop !== null ? cfg.U_open_loop : U_basal) : U_basal;
  let Gm = Gb;
  let valid = true;

  const tau_f = (tauD > 0 && N_filter > 0) ? (tauD / N_filter) : 0.0;
  const alpha = (tauD > 0) ? (tau_f / (tau_f + Ts)) : 0.0;

  for (let i = 0; i <= N; i++) {
    const t = i * dt;

    // 1. Current setpoint sp
    let sp = cfg.setpoint;
    if (cfg.setpoint_steps && cfg.setpoint_steps.length > 0) {
      for (const [t_step, val] of cfg.setpoint_steps) {
        if (t + 1e-9 >= t_step) {
          sp = val;
        }
      }
    }
    sp_arr[i] = sp;

    // Current p3 sensitivity scale
    let p3_scale = 1.0;
    if (cfg.sensitivity_change && cfg.sensitivity_change.length === 2) {
      const [t_s, factor] = cfg.sensitivity_change;
      if (t + 1e-9 >= t_s) {
        p3_scale = factor;
      }
    }

    // 2. Validity check
    if (G + Gb <= 0) {
      valid = false;
      warnings.push('Glucose reached non-physical value <= 0 mg/dL.');
      for (let rem = i; rem <= N; rem++) {
        t_arr[rem] = rem * dt;
        G_arr[rem] = G + Gb;
        Gm_arr[rem] = Gm;
        U_arr[rem] = U_fb;
        Ufb_arr[rem] = U_fb;
        Uff_arr[rem] = 0.0;
        D_arr[rem] = evalD(rem * dt);
        sp_arr[rem] = sp;
      }
      break;
    }

    // 3. Sensor push into delay buffer
    let delayed_Gl;
    if (delay_steps > 0) {
      delayed_Gl = ring_buffer[ring_idx];
      ring_buffer[ring_idx] = Gl;
      ring_idx = (ring_idx + 1) % delay_steps;
    } else {
      delayed_Gl = Gl;
    }

    // 4. Sample instant
    if (i % steps_per_sample === 0) {
      // Evaluate frozen condition before this step's bolus queue update
      const is_frozen = ff_enabled && suspend_integral && (remaining_bolus > 1e-9 || t < freeze_until);

      // Sensor read
      const is_dropout = (fault === 'dropout' && t >= t_fault - 1e-9 && t < t_fault + dropout_duration - 1e-9);
      if (is_dropout) {
        Gm = NaN;
      } else if (fault === 'stuck' && t >= t_fault - 1e-9) {
        Gm = last_good_Gm;
      } else {
        let s = delayed_Gl;
        if (fault === 'drift' && t >= t_fault - 1e-9) {
          s += drift_rate * (t - t_fault) / 60.0;
        }
        if (noise_sd > 0) {
          s += nextGaussian() * noise_sd;
        }
        Gm = s;
        last_good_Gm = s;
      }

      // Controller update
      if (cfg.controller === 'pid') {
        if (!Number.isNaN(Gm)) {
          const m_k = Gm;
          const e_k = sp - m_k;
          const y_nom = Gb;
          const P_k = Kc * (beta * (sp - y_nom) - (m_k - y_nom));

          let d_k;
          if (i === 0) {
            d_k = 0.0;
          } else {
            d_k = alpha * d_prev + (1.0 - alpha) * (m_k - m_prev) / Ts;
          }
          const D_k = (tauD > 0) ? (-Kc * tauD * d_k) : 0.0;
          d_prev = d_k;
          m_prev = m_k;

          const has_integral = (cfg.mode !== 'P') && Number.isFinite(tauI) && (tauI > 0);
          const integrate = has_integral && !is_frozen;
          const S_trial = integrate ? (S + e_k * Ts) : S;

          const u_fn = (S_val) => U_basal + P_k + (has_integral ? (Kc / tauI) * S_val : 0.0) + D_k;

          if (anti_windup === 'clamp') {
            const u_trial = u_fn(S_trial);
            if (integrate && ((u_trial > Umax && Kc * e_k > 0) || (u_trial < Umin && Kc * e_k < 0))) {
              S = S; // frozen
            } else {
              S = S_trial;
            }
            const u_k = u_fn(S);
            U_fb = Math.max(Umin, Math.min(Umax, u_k));
          } else if (anti_windup === 'backcalc') {
            const u_trial = u_fn(S_trial);
            U_fb = Math.max(Umin, Math.min(Umax, u_trial));
            const Tt = (tauD > 0) ? Math.max(Math.sqrt(tauI * tauD), Ts) : tauI;
            if (integrate) {
              S = S_trial + Ts * tauI * (U_fb - u_trial) / (Kc * Tt);
            } else {
              S = S_trial;
            }
          } else {
            // off
            S = S_trial;
            U_fb = Math.max(Umin, Math.min(Umax, u_fn(S)));
          }
        }
      }
    }

    // 5. Feedforward bolus step
    if (ff_enabled) {
      for (const b of boluses) {
        if (!b.queued && t >= b.start - 1e-9) {
          b.queued = true;
          remaining_bolus += b.total;
        }
      }
    }

    let U_ff = 0.0;
    if (remaining_bolus > 1e-9) {
      const cap = Math.max(0.0, Umax - U_fb);
      U_ff = Math.min(cap, remaining_bolus / dt);
      remaining_bolus -= U_ff * dt;
      bolusDelivered += U_ff * dt;
      if (remaining_bolus <= 1e-9) {
        remaining_bolus = 0.0;
        freeze_until = t + dt + suspend_extra;
      }
    }

    let U = U_fb + U_ff;
    if (cfg.saturation) {
      U = Math.max(Umin, Math.min(Umax, U));
    }

    // 6. Evaluate D at RK4 stages
    const D1 = evalD(t);
    const D2 = evalD(t + 0.5 * dt);
    const D3 = evalD(t + dt);

    // 7. Log states at step i
    t_arr[i] = t;
    G_arr[i] = G + Gb;
    Gm_arr[i] = Gm;
    U_arr[i] = U;
    Ufb_arr[i] = U_fb;
    Uff_arr[i] = U_ff;
    D_arr[i] = D1;

    // 8. RK4 integration step if i < N
    if (i < N) {
      const p3_eff = p3 * p3_scale;

      const deriv = (G_c, X_c, I_c, Gl_c, D_val) => [
        -p1 * G_c - X_c * (G_c + Gb) + D_val,
        -p2 * X_c + p3_eff * I_c,
        -n * I_c + (U - U_basal) / V1,
        (sensor_lag > 0) ? (G_c + Gb - Gl_c) / sensor_lag : 0.0
      ];

      const [k1_G, k1_X, k1_I, k1_Gl] = deriv(G, X, I, Gl, D1);

      const G2 = G + 0.5 * dt * k1_G;
      const X2 = X + 0.5 * dt * k1_X;
      const I2 = I + 0.5 * dt * k1_I;
      const Gl2 = (sensor_lag > 0) ? Gl + 0.5 * dt * k1_Gl : (G2 + Gb);
      const [k2_G, k2_X, k2_I, k2_Gl] = deriv(G2, X2, I2, Gl2, D2);

      const G3 = G + 0.5 * dt * k2_G;
      const X3 = X + 0.5 * dt * k2_X;
      const I3 = I + 0.5 * dt * k2_I;
      const Gl3 = (sensor_lag > 0) ? Gl + 0.5 * dt * k2_Gl : (G3 + Gb);
      const [k3_G, k3_X, k3_I, k3_Gl] = deriv(G3, X3, I3, Gl3, D2);

      const G4 = G + dt * k3_G;
      const X4 = X + dt * k3_X;
      const I4 = I + dt * k3_I;
      const Gl4 = (sensor_lag > 0) ? Gl + dt * k3_Gl : (G4 + Gb);
      const [k4_G, k4_X, k4_I, k4_Gl] = deriv(G4, X4, I4, Gl4, D3);

      G += (dt / 6.0) * (k1_G + 2.0 * k2_G + 2.0 * k3_G + k4_G);
      X += (dt / 6.0) * (k1_X + 2.0 * k2_X + 2.0 * k3_X + k4_X);
      I += (dt / 6.0) * (k1_I + 2.0 * k2_I + 2.0 * k3_I + k4_I);
      if (sensor_lag > 0) {
        Gl += (dt / 6.0) * (k1_Gl + 2.0 * k2_Gl + 2.0 * k3_Gl + k4_Gl);
      } else {
        Gl = G + Gb;
      }
    }
  }

  let min_G = Infinity;
  for (let k = 0; k <= N; k++) {
    if (G_arr[k] < min_G) {
      min_G = G_arr[k];
    }
  }
  if (min_G < 40.0) {
    warnings.push('Glucose dropped below 40 mg/dL: minimal model has no counter-regulation, so this part of the trajectory is qualitative only.');
  }

  return {
    t: Array.from(t_arr),
    G: Array.from(G_arr),
    Gm: Gm_arr,
    U: Array.from(U_arr),
    Ufb: Array.from(Ufb_arr),
    Uff: Array.from(Uff_arr),
    D: Array.from(D_arr),
    sp: Array.from(sp_arr),
    valid,
    warnings,
    bolusPlanned,
    bolusDelivered
  };
}

export function metrics(result, band = { low: 54, high: 144 }) {
  const t = result.t;
  const G = result.G;
  const U = result.U;
  const Uff = result.Uff;
  const sp = result.sp;
  const N = G.length - 1;
  const total_time = t[N] - t[0];

  let peak = -Infinity;
  let t_peak = t[0];
  let nadir = Infinity;
  let t_nadir = t[0];

  for (let i = 0; i <= N; i++) {
    if (G[i] > peak) {
      peak = G[i];
      t_peak = t[i];
    }
    if (G[i] < nadir) {
      nadir = G[i];
      t_nadir = t[i];
    }
  }

  function calcTimeFraction(condFn) {
    let sum = 0.0;
    for (let i = 0; i < N; i++) {
      const v0 = condFn(G[i]) ? 1.0 : 0.0;
      const v1 = condFn(G[i + 1]) ? 1.0 : 0.0;
      const dt_i = t[i + 1] - t[i];
      sum += 0.5 * (v0 + v1) * dt_i;
    }
    return (sum / total_time) * 100.0;
  }

  const pct_in_band = calcTimeFraction((g) => g > band.low && g < band.high);
  const pct_in_70_180 = calcTimeFraction((g) => g >= 70.0 && g <= 180.0);
  const pct_below_54 = calcTimeFraction((g) => g < 54.0);
  const pct_below_70 = calcTimeFraction((g) => g < 70.0);
  const pct_above_high = calcTimeFraction((g) => g > band.high);
  const pct_above_180 = calcTimeFraction((g) => g > 180.0);

  let IAE = 0.0;
  for (let i = 0; i < N; i++) {
    const sp0 = Array.isArray(sp) ? sp[i] : (sp ?? 81.0);
    const sp1 = Array.isArray(sp) ? sp[i + 1] : (sp ?? 81.0);
    const err0 = Math.abs(G[i] - sp0);
    const err1 = Math.abs(G[i + 1] - sp1);
    const dt_i = t[i + 1] - t[i];
    IAE += 0.5 * (err0 + err1) * dt_i;
  }

  let insulin_total = 0.0;
  let insulin_ff = 0.0;
  let time_at_Umax = 0.0;
  let time_at_Umin = 0.0;

  for (let i = 0; i < N; i++) {
    const dt_i = t[i + 1] - t[i];
    insulin_total += U[i] * dt_i;
    if (Uff) {
      insulin_ff += Uff[i] * dt_i;
    }
    if (U[i] >= Umax - 1e-9) {
      time_at_Umax += dt_i;
    }
    if (U[i] <= Umin + 1e-9) {
      time_at_Umin += dt_i;
    }
  }

  const stayed_in_band = (nadir > band.low && peak < band.high);

  return {
    peak,
    t_peak,
    nadir,
    t_nadir,
    pct_in_band,
    pct_in_70_180,
    pct_below_54,
    pct_below_70,
    pct_above_high,
    pct_above_180,
    IAE,
    insulin_total,
    insulin_ff,
    time_at_Umax,
    time_at_Umin,
    stayed_in_band
  };
}
