// model.js — pure simulation engine for "Closing the Loop" (plan v2 §3–§9). No DOM.
// Educational process-control model of an illustrative textbook patient. Not medical advice. Not for dosing decisions.
// Imports in Node 18+: import { simulate, DEFAULT_INPUTS } from './js/model.js'
import { DATA } from './data.js';

const P = Object.fromEntries(Object.entries(DATA.params).map(([k, v]) => [k, v.value]));
export const PARAMS = P;

const clip = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const finite = (x) => typeof x === 'number' && Number.isFinite(x);

// ---------------------------------------------------------------- linear model (§2, §3)
export function linearModel() {
  const { p1, p2, p3, n, V1, G_basal, I_basal, U_max } = P;
  const U_basal = n * I_basal * V1;
  const Kp = -G_basal * p3 / (V1 * p1 * p2 * n);
  const Kd = 1 / p1;
  return {
    U_basal, Kp, Kd,
    tauG: 1 / p1, tauX: 1 / p2, tauI: 1 / n,
    Kf: -Kd / Kp,
    authorityRatio: U_basal / (U_max - U_basal),
  };
}

// State-space matrices of the linearized model (deviation variables x = [G, X, I], u = U − U_basal).
export function stateSpace() {
  const { p1, p2, p3, n, V1, G_basal } = P;
  return {
    A: [[-p1, -G_basal, 0], [0, -p2, p3], [0, 0, -n]],
    B: [0, 0, 1 / V1],
    C: [1, 0, 0],
  };
}

// Analytic nonlinear steady-state gain G_ss/ΔU (§3).
export function nonlinearGain(dU) {
  const { p1, p2, p3, n, V1, G_basal } = P;
  if (!finite(dU) || dU === 0) return linearModel().Kp;
  const I = dU / (n * V1);
  const X = p3 * I / p2;
  const G = -X * G_basal / (p1 + X);
  return G / dU;
}

// Skogestad half rule (§3): sort time constants, split the smallest.
export function halfRule() {
  const lm = linearModel();
  const tau = [lm.tauG, lm.tauX, lm.tauI].sort((a, b) => b - a);
  return {
    sopdt: { K: lm.Kp, tau1: tau[0], tau2: tau[1] + tau[2] / 2, theta: tau[2] / 2 },
    fopdt: { K: lm.Kp, tau: tau[0] + tau[1] / 2, theta: tau[1] / 2 + tau[2] },
  };
}

// The reduced model behind each tuning choice (§4).
export function reducedModel(model) {
  const hr = halfRule();
  switch (model) {
    case 'half_sopdt': return { type: 'sopdt', ...hr.sopdt };
    case 'fit_fopdt_pi':
    case 'fit_fopdt_pid': { const f = DATA.fits.fit_fopdt; return { type: 'fopdt', K: f.K, tau: f.tau, theta: f.theta }; }
    case 'half_fopdt_pi': return { type: 'fopdt', ...hr.fopdt };
    case 'fit_sopdt':
    default: { const f = DATA.fits.fit_sopdt; return { type: 'sopdt', K: f.K, tau1: f.tau1, tau2: f.tau2, theta: f.theta }; }
  }
}

// IMC tuning (Seborg Table 12.1) on θ_total = θ_model + θ_sensor + (include_zoh ? Ts/2 : 0).
export function imcTuning({ model = 'fit_sopdt', tau_c = 20, theta_sensor = 10, Ts = 5, include_zoh = false } = {}) {
  const m = reducedModel(model);
  const theta_total = m.theta + theta_sensor + (include_zoh ? Ts / 2 : 0);
  let Kc, tauI, tauD;
  if (model === 'fit_fopdt_pi' || model === 'half_fopdt_pi') {
    Kc = m.tau / (m.K * (tau_c + theta_total)); tauI = m.tau; tauD = 0;
  } else if (model === 'fit_fopdt_pid') {
    Kc = (m.tau + theta_total / 2) / (m.K * (tau_c + theta_total / 2));
    tauI = m.tau + theta_total / 2;
    tauD = m.tau * theta_total / (2 * m.tau + theta_total);
  } else {
    Kc = (m.tau1 + m.tau2) / (m.K * (tau_c + theta_total));
    tauI = m.tau1 + m.tau2;
    tauD = m.tau1 * m.tau2 / (m.tau1 + m.tau2);
  }
  return { Kc, tauI, tauD, theta_total };
}

// ---------------------------------------------------------------- frequency response (§9.4)
// L(jω) = Gc(jω)·Gp(jω)·e^(−jωθ); phase built analytically from the factors (radians, no unwrapping).
export function loopFreq(w, { Kc, tauI, tauD = 0, N = 10, theta = 0 }) {
  const lm = linearModel();
  const taus = [lm.tauG, lm.tauX, lm.tauI];
  let magP = Math.abs(lm.Kp), phP = 0;
  for (const t of taus) { magP /= Math.hypot(1, w * t); phP -= Math.atan(w * t); }
  const td = tauD > 0 ? tauD : 0;
  const tf = td > 0 ? td / N : 0;
  const hasI = finite(tauI) && tauI > 0;
  let magC, phC;
  if (hasI) {
    const re = 1 - tauI * tf * w * w - tauI * td * w * w;
    const im = w * (tauI + tf);
    magC = Math.abs(Kc) * Math.hypot(re, im) / (w * tauI * Math.hypot(1, w * tf));
    phC = Math.atan2(im, re) - Math.PI / 2 - Math.atan(w * tf);
  } else {
    magC = Math.abs(Kc) * Math.hypot(1, w * (tf + td)) / Math.hypot(1, w * tf);
    phC = Math.atan(w * (tf + td)) - Math.atan(w * tf);
  }
  const sign = (Kc * lm.Kp) >= 0 ? 0 : -Math.PI;
  return { mag: magC * magP, phase: phC + phP - w * theta + sign, magC, phC, magP, phP };
}

export function margins({ Kc, tauI, tauD = 0, N = 10, theta = 0 }) {
  const args = { Kc, tauI, tauD, N, theta };
  const lo = Math.log10(1e-5), hi = Math.log10(10), M = 6000;
  const ws = Array.from({ length: M + 1 }, (_, k) => 10 ** (lo + (hi - lo) * k / M));
  const f = (w) => Math.log(loopFreq(w, args).mag);
  const g = (w) => loopFreq(w, args).phase + Math.PI;
  const bisect = (fn, a, b) => {
    let fa = fn(a);
    for (let it = 0; it < 80; it++) {
      const m = Math.sqrt(a * b), fm = fn(m);
      if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m;
    }
    return Math.sqrt(a * b);
  };
  let wc = NaN;
  for (let k = M; k > 0; k--) {
    const a = f(ws[k - 1]), b = f(ws[k]);
    if ((a > 0) !== (b > 0)) { wc = bisect(f, ws[k - 1], ws[k]); break; }
  }
  let GM = Infinity;
  for (let k = 0; k < M; k++) {
    const a = g(ws[k]), b = g(ws[k + 1]);
    if (a > 0 && b <= 0) { const w180 = bisect(g, ws[k], ws[k + 1]); GM = 1 / loopFreq(w180, args).mag; break; }
  }
  if (!finite(wc)) return { wc: NaN, PM_deg: NaN, GM, dtheta_max: NaN, total_tolerable_delay: NaN };
  const PM = Math.PI + loopFreq(wc, args).phase;
  const dtheta_max = PM / wc;
  return { wc, PM_deg: PM * 180 / Math.PI, GM, dtheta_max, total_tolerable_delay: theta + dtheta_max };
}

// ---------------------------------------------------------------- step responses (§3, for P5)
// Unit-ΔU step of the 3rd-order linear model, closed-form partial fractions over three distinct real poles.
export function linearStep(t, dU = 1) {
  const lm = linearModel();
  const tau = [lm.tauG, lm.tauX, lm.tauI];
  let s = 0;
  for (let i = 0; i < 3; i++) {
    let den = 1;
    for (let j = 0; j < 3; j++) if (j !== i) den *= tau[i] - tau[j];
    s += tau[i] * tau[i] * Math.exp(-t / tau[i]) / den;
  }
  return lm.Kp * dU * (1 - s);
}
export function sopdtStep(t, { K, tau1, tau2, theta }, dU = 1) {
  const tt = t - theta;
  if (tt <= 0) return 0;
  let y;
  if (Math.abs(tau1 - tau2) < 1e-6 * tau1) y = 1 - (1 + tt / tau1) * Math.exp(-tt / tau1);
  else y = 1 - (tau1 * Math.exp(-tt / tau1) - tau2 * Math.exp(-tt / tau2)) / (tau1 - tau2);
  return K * dU * y;
}
export function fopdtStep(t, { K, tau, theta }, dU = 1) {
  const tt = t - theta;
  return tt <= 0 ? 0 : K * dU * (1 - Math.exp(-tt / tau));
}

// ---------------------------------------------------------------- meals, bolus, noise (§6, §7)
export function mealD(t, meals) {
  let D = 0;
  for (const [ti, mult] of meals) if (t >= ti) D += P.meal_A * mult * Math.exp(-P.meal_k * (t - ti));
  return D;
}
export function bolusSize({ f_bolus = 1, est_error = 0, mult = 1 } = {}) {
  return f_bolus * linearModel().Kf * (1 + est_error) * P.meal_A * mult / P.meal_k;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng) {
  let u1 = rng();
  if (u1 < 1e-300) u1 = 1e-300;
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---------------------------------------------------------------- defaults (§9.1)
const DEFAULT_TUNING = imcTuning({ model: 'fit_sopdt', tau_c: 20, theta_sensor: 10, Ts: 5, include_zoh: false });
export const DEFAULT_INPUTS = Object.freeze({
  t_end: 660, dt: 0.1, Ts: 5,
  controller: 'pid', mode: 'PID', Kc: DEFAULT_TUNING.Kc, tauI: DEFAULT_TUNING.tauI, tauD: DEFAULT_TUNING.tauD,
  N: 10, beta: 1, anti_windup: 'clamp', U_open_loop: null,
  setpoint: 81, setpoint_steps: [],
  sensor_delay: 10, sensor_lag: 0, noise_sd: 0, seed: 0,
  fault: 'none', t_fault: 60, drift_rate: 0, dropout_duration: 30,
  meals: [[60, 1]],
  ff_enabled: false, f_bolus: 1, est_error: 0, t_pre: 0, suspend_integral: false, suspend_extra: 0,
  sensitivity_change: null,
  saturation: true,
});

// Replace non-finite / out-of-range inputs with safe values and say so (never fires for valid inputs).
function sanitize(inp, warnings) {
  const x = { ...inp };
  const fix = (k, ok, fallback, msg) => {
    if (!ok(x[k])) { warnings.push(`Input ${k} = ${String(x[k])} is invalid (${msg}); using ${fallback}.`); x[k] = fallback; }
  };
  const pos = (v) => finite(v) && v > 0;
  const nonneg = (v) => finite(v) && v >= 0;
  fix('dt', pos, DEFAULT_INPUTS.dt, 'must be > 0');
  fix('t_end', (v) => finite(v) && v > 0 && v <= 10080, DEFAULT_INPUTS.t_end, 'must be in (0, 10080] min');
  fix('Ts', (v) => pos(v) && v >= x.dt, DEFAULT_INPUTS.Ts, 'must be ≥ dt');
  fix('Kc', finite, DEFAULT_INPUTS.Kc, 'must be a finite number');
  if (x.mode !== 'P') fix('tauI', pos, DEFAULT_INPUTS.tauI, 'must be > 0');
  fix('tauD', nonneg, 0, 'must be ≥ 0');
  fix('N', pos, DEFAULT_INPUTS.N, 'must be > 0');
  fix('beta', finite, 1, 'must be finite');
  fix('setpoint', pos, P.G_basal, 'must be > 0');
  fix('sensor_delay', (v) => nonneg(v) && v <= 120, 0, 'must be in [0, 120] min');
  fix('sensor_lag', (v) => v === 0 || (finite(v) && v >= 0.5 && v <= 15), 0, 'allowed: 0 or 0.5–15 min');
  fix('noise_sd', nonneg, 0, 'must be ≥ 0');
  fix('seed', finite, 0, 'must be finite');
  fix('t_fault', finite, 60, 'must be finite');
  fix('drift_rate', finite, 0, 'must be finite');
  fix('dropout_duration', nonneg, 0, 'must be ≥ 0');
  fix('f_bolus', nonneg, 1, 'must be ≥ 0');
  fix('est_error', (v) => finite(v) && v >= -1, 0, 'must be ≥ −1');
  fix('t_pre', finite, 0, 'must be finite');
  fix('suspend_extra', nonneg, 0, 'must be ≥ 0');
  if (x.U_open_loop !== null && x.U_open_loop !== undefined) fix('U_open_loop', finite, null, 'must be finite');
  if (!Array.isArray(x.meals)) x.meals = [];
  x.meals = x.meals.filter((m) => {
    const ok = Array.isArray(m) && finite(m[0]) && finite(m[1]) && m[1] >= 0;
    if (!ok) warnings.push(`Ignored invalid meal ${JSON.stringify(m)}.`);
    return ok;
  });
  if (!Array.isArray(x.setpoint_steps)) x.setpoint_steps = [];
  x.setpoint_steps = x.setpoint_steps.filter((s) => {
    const ok = Array.isArray(s) && finite(s[0]) && pos(s[1]);
    if (!ok) warnings.push(`Ignored invalid set-point step ${JSON.stringify(s)} (needs a finite time and a set point > 0 mg/dL).`);
    return ok;
  }).slice().sort((a, b) => a[0] - b[0]);
  if (x.sensitivity_change !== null && x.sensitivity_change !== undefined) {
    const s = x.sensitivity_change;
    if (!(Array.isArray(s) && finite(s[0]) && pos(s[1]))) {
      warnings.push('Ignored invalid sensitivity change.'); x.sensitivity_change = null;
    }
  }
  const choice = (k, allowed) => {
    if (!allowed.includes(x[k])) {
      warnings.push(`Unknown ${k} "${String(x[k])}"; using "${DEFAULT_INPUTS[k]}" (allowed: ${allowed.join(', ')}).`);
      x[k] = DEFAULT_INPUTS[k];
    }
  };
  choice('controller', ['pid', 'none']);
  choice('mode', ['P', 'PI', 'PID']);
  choice('anti_windup', ['clamp', 'backcalc', 'off']);
  choice('fault', ['none', 'stuck', 'drift', 'dropout']);
  if (x.controller === 'pid' && x.Kc > 0) {
    warnings.push('Kc > 0 is positive feedback for this reverse-acting process (more insulin lowers glucose, so Kc must be negative).');
  }
  return x;
}

// ---------------------------------------------------------------- simulation engine (§8)
export function simulate(inputs = {}) {
  const warnings = [];
  const x = sanitize({ ...DEFAULT_INPUTS, ...inputs }, warnings);
  const { p1, p2, p3, n, V1, G_basal: Gb } = P;
  const { U_basal } = linearModel();
  const dt = x.dt, Ts = x.Ts;
  const N = Math.round(x.t_end / dt);
  const sps = Math.max(1, Math.round(Ts / dt));
  const Umax = x.saturation ? P.U_max : Infinity;
  const Umin = x.saturation ? P.U_min : -Infinity;
  const isPID = x.controller === 'pid';

  // controller constants (§5)
  const mode = x.mode;
  const useI = mode !== 'P';
  const tauD = mode === 'PID' ? x.tauD : 0;
  const tauf = tauD / x.N;
  const alpha = tauD > 0 ? tauf / (tauf + Ts) : 0;
  const Tt = tauD > 0 ? Math.max(Math.sqrt(x.tauI * tauD), Ts) : x.tauI;
  const Kc = x.Kc, tauI = x.tauI, beta = x.beta;
  let S = 0, dfilt = 0, mPrev = null;

  // sensor (§6)
  const delaySteps = Math.round(x.sensor_delay / dt);
  const hist = new Float64Array(N + 1);
  const tauS = x.sensor_lag;
  const rng = mulberry32(x.seed);
  let lastGood = Gb;
  const read = (i, t) => {
    let v = i - delaySteps >= 0 ? hist[i - delaySteps] : Gb;
    if (x.noise_sd > 0) v += x.noise_sd * gaussian(rng);
    if (x.fault === 'stuck') {
      if (t + 1e-9 >= x.t_fault) return lastGood;
      lastGood = v;
    } else if (x.fault === 'drift') {
      if (t + 1e-9 >= x.t_fault) v += x.drift_rate * (t - x.t_fault) / 60;
    } else if (x.fault === 'dropout') {
      if (t + 1e-9 >= x.t_fault && t + 1e-9 < x.t_fault + x.dropout_duration) return NaN;
    }
    return v;
  };

  // meals and feedforward (§7)
  const meals = x.meals;
  const boluses = x.ff_enabled
    ? meals.map(([tm, mult]) => ({ start: tm - x.t_pre, total: bolusSize({ f_bolus: x.f_bolus, est_error: x.est_error, mult }), queued: false }))
    : [];
  if (boluses.some((b) => b.start < 0)) warnings.push('A bolus was scheduled before t = 0; it is delivered starting at t = 0.');
  const bolusPlanned = boluses.reduce((s, b) => s + b.total, 0);
  let remaining = 0, freezeUntil = -Infinity, bolusDelivered = 0;
  const deliveries = [];

  // state y = [G, X, I, Gl]  (G, X, I deviations; Gl absolute)
  let y = [0, 0, 0, Gb];
  let Ufb = isPID ? U_basal : (finite(x.U_open_loop) ? x.U_open_loop : U_basal);
  let Gmeas = Gb;
  const f = (t, s, U, scale) => {
    const [G, X, I, Gl] = s;
    return [
      -p1 * G - X * (G + Gb) + mealD(t, meals),
      -p2 * X + p3 * scale * I,
      -n * (I + P.I_basal) + U / V1,
      tauS > 0 ? (G + Gb - Gl) / tauS : 0,
    ];
  };

  const T = [], Ga = [], Gm = [], Ua = [], Ufba = [], Uffa = [], Da = [], SP = [];
  let valid = true;
  for (let i = 0; i <= N; i++) {
    const t = i * dt;
    // 1. set point and p3 scale
    let sp = x.setpoint;
    for (const [ts, v] of x.setpoint_steps) if (t + 1e-9 >= ts) sp = v;
    const scale = x.sensitivity_change && t + 1e-9 >= x.sensitivity_change[0] ? x.sensitivity_change[1] : 1;
    // 2. validity
    if (!(y[0] + Gb > 0) || !y.every(finite)) {
      valid = false;
      warnings.push(`Simulation stopped at t = ${t.toFixed(1)} min: glucose reached zero or became non-finite (outside the model's range).`);
      break;
    }
    // 3. push the (lagged) glucose into the delay buffer
    hist[i] = y[3];
    // 4. sample: sensor read + PID
    if (i % sps === 0) {
      Gmeas = read(i, t);
      if (isPID && finite(Gmeas)) {
        const m = Gmeas;
        if (mPrev === null) mPrev = m;
        const e = sp - m;
        const Pk = Kc * (beta * (sp - Gb) - (m - Gb));
        dfilt = tauD > 0 ? alpha * dfilt + (1 - alpha) * (m - mPrev) / Ts : 0;
        const Dk = -Kc * tauD * dfilt;
        const frozen = x.ff_enabled && x.suspend_integral && (remaining > 1e-9 || t < freezeUntil);
        const integrate = useI && !frozen;
        const Strial = integrate ? S + e * Ts : S;
        const u = (Sv) => U_basal + Pk + (useI ? (Kc / tauI) * Sv : 0) + Dk;
        let Sk, uk;
        if (x.anti_windup === 'clamp') {
          const ut = u(Strial);
          Sk = integrate && ((ut > Umax && Kc * e > 0) || (ut < Umin && Kc * e < 0)) ? S : Strial;
          uk = u(Sk);
          Ufb = clip(uk, Umin, Umax);
        } else if (x.anti_windup === 'backcalc') {
          uk = u(Strial);
          Ufb = clip(uk, Umin, Umax);
          Sk = integrate ? Strial + Ts * tauI * (Ufb - uk) / (Kc * Tt) : Strial;
        } else {
          Sk = Strial;
          Ufb = clip(u(Sk), Umin, Umax);
        }
        S = Sk;
        mPrev = m;
      }
    }
    // 5. feedforward bolus
    let Uff = 0;
    for (const b of boluses) {
      if (!b.queued && b.start <= t + 1e-9) {
        if (remaining <= 1e-9) deliveries.push({ start: t, end: null });
        remaining += b.total; b.queued = true;
      }
    }
    if (remaining > 1e-9) {
      const cap = Math.max(0, Umax - Ufb);
      Uff = Math.min(cap, remaining / dt);
      remaining -= Uff * dt;
      if (remaining <= 1e-9) {
        remaining = 0;
        if (deliveries.length) deliveries[deliveries.length - 1].end = t + dt;
        freezeUntil = t + dt + x.suspend_extra;
      }
    }
    const U = x.saturation ? clip(Ufb + Uff, Umin, Umax) : Ufb + Uff;
    // 7. log, then one RK4 step
    T.push(t); Ga.push(y[0] + Gb); Gm.push(finite(Gmeas) ? Gmeas : null);
    Ua.push(U); Ufba.push(Ufb); Uffa.push(Uff); Da.push(mealD(t, meals)); SP.push(sp);
    if (i < N) {
      bolusDelivered += Uff * dt;
      const k1 = f(t, y, U, scale);
      const y2 = y.map((v, j) => v + dt / 2 * k1[j]);
      const k2 = f(t + dt / 2, y2, U, scale);
      const y3 = y.map((v, j) => v + dt / 2 * k2[j]);
      const k3 = f(t + dt / 2, y3, U, scale);
      const y4 = y.map((v, j) => v + dt * k3[j]);
      const k4 = f(t + dt, y4, U, scale);
      y = y.map((v, j) => v + dt / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      if (!(tauS > 0)) y[3] = y[0] + Gb;
    }
  }
  const minG = Ga.length ? Math.min(...Ga) : Gb;
  if (minG < DATA.validityLow.value) {
    warnings.push(`Glucose fell below ${DATA.validityLow.value} mg/dL. The model has no counter-regulation (no glucagon), so this part is qualitative only.`);
  }
  if (!x.saturation && Ua.some((u) => u < 0)) warnings.push('Unbounded pump: the controller asked for negative insulin, which a real pump cannot deliver.');
  return {
    t: T, G: Ga, Gm, U: Ua, Ufb: Ufba, Uff: Uffa, D: Da, sp: SP,
    valid, warnings, bolusPlanned, bolusDelivered, deliveries, inputs: x,
  };
}

// ---------------------------------------------------------------- metrics (§9.3), on true glucose
export function metrics(result, band = { low: P.band_low, high: P.band_high }) {
  const { t, G, U, Uff } = result;
  const n = G.length;
  const sp = result.sp || G.map(() => P.G_basal);
  if (n < 2) {
    return { peak: G[0] ?? P.G_basal, t_peak: 0, nadir: G[0] ?? P.G_basal, t_nadir: 0, pct_in_band: 0, pct_in_70_180: 0,
      pct_below_54: 0, pct_below_70: 0, pct_above_high: 0, pct_above_180: 0, IAE: 0, insulin_total: 0, insulin_ff: 0,
      time_at_Umax: 0, time_at_Umin: 0, stayed_in_band: false };
  }
  const H = t[n - 1] - t[0];
  const frac = (ind) => {
    let s = 0;
    for (let i = 0; i < n - 1; i++) s += (ind(G[i]) + ind(G[i + 1])) / 2 * (t[i + 1] - t[i]);
    return 100 * s / H;
  };
  let peak = -Infinity, nadir = Infinity, ip = 0, inad = 0;
  for (let i = 0; i < n; i++) {
    if (G[i] > peak) { peak = G[i]; ip = i; }
    if (G[i] < nadir) { nadir = G[i]; inad = i; }
  }
  let IAE = 0, ins = 0, insff = 0, tmax = 0, tmin = 0;
  for (let i = 0; i < n - 1; i++) {
    const h = t[i + 1] - t[i];
    IAE += (Math.abs(G[i] - sp[i]) + Math.abs(G[i + 1] - sp[i + 1])) / 2 * h;
    ins += U[i] * h;
    insff += (Uff ? Uff[i] : 0) * h;
    if (U[i] >= P.U_max - 1e-9) tmax += h;
    if (U[i] <= P.U_min + 1e-9) tmin += h;
  }
  const [c70, c180] = DATA.clinicalBand.value;
  return {
    peak, t_peak: t[ip], nadir, t_nadir: t[inad],
    pct_in_band: frac((g) => (g > band.low && g < band.high ? 1 : 0)),
    pct_in_70_180: frac((g) => (g >= c70 && g <= c180 ? 1 : 0)),
    pct_below_54: frac((g) => (g < P.band_low ? 1 : 0)),
    pct_below_70: frac((g) => (g < 70 ? 1 : 0)),
    pct_above_high: frac((g) => (g >= band.high ? 1 : 0)),
    pct_above_180: frac((g) => (g > c180 ? 1 : 0)),
    IAE, insulin_total: ins, insulin_ff: insff, time_at_Umax: tmax, time_at_Umin: tmin,
    stayed_in_band: nadir > band.low && peak < band.high,
  };
}
