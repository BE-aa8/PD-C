// app.js — UI for "Closing the Loop" (Claude build). All numbers come from model.js / data.js.
// Educational process-control model of an illustrative textbook patient. Not medical advice. Not for dosing decisions.
import { DATA } from './data.js';
import * as M from './model.js';

const P = M.PARAMS;
const LM = M.linearModel();
const HAS_PLOTLY = typeof window.Plotly !== 'undefined';
const HAS_KATEX = typeof window.katex !== 'undefined';

// ------------------------------------------------------------------ formatting helpers
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
function fmt(v, d = 2) {
  if (v === Infinity) return '∞';
  if (v === -Infinity) return '−∞';
  if (!fin(v)) return '—';
  const s = v.toFixed(d);
  return s.startsWith('-') ? '−' + s.slice(1) : s;
}
const tf = (v, d = 3) => (fin(v) ? v.toFixed(d) : (v === Infinity ? '\\infty' : '\\text{—}'));
const short = (x, n = 70) => (x.length > n ? x.slice(0, n - 1) + '…' : x);
const sci = (v, d = 3) => { const [m, e] = v.toExponential(d).split('e'); return `${m}\\times10^{${+e}}`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function renderTex(root) {
  root.querySelectorAll('[data-tex]').forEach((el) => {
    const tex = el.getAttribute('data-tex');
    const display = el.hasAttribute('data-display');
    if (HAS_KATEX) window.katex.render(tex, el, { throwOnError: false, displayMode: display });
    else el.textContent = tex;
  });
}
const T = (tex, display = true) => `<div class="eq" data-tex="${esc(tex)}"${display ? ' data-display' : ''}></div>`;
const Ti = (tex) => `<span data-tex="${esc(tex)}"></span>`;
function card({ title, tex, units, meaning, extra = '', id = '' }) {
  const eqs = (Array.isArray(tex) ? tex : tex ? [tex] : []).map((t) => T(t)).join('');
  return `<div class="card"${id ? ` id="${id}"` : ''}><h3>${title}</h3>${eqs}
    ${units ? `<p class="units"><b>Units:</b> ${units}</p>` : ''}
    ${meaning ? `<p class="meaning"><b>Meaning:</b> ${meaning}</p>` : ''}${extra}</div>`;
}

// ------------------------------------------------------------------ colours and Plotly theme
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const C = () => ({
  s1: css('--s1'), s2: css('--s2'), s3: css('--s3'), s4: css('--s4'), s5: css('--s5'), s6: css('--s6'), s7: css('--s7'), s8: css('--s8'),
  text: css('--text'), text2: css('--text-2'), muted: css('--text-3'), grid: css('--grid'), band: css('--band'), surface: css('--surface'),
  line: css('--line-strong'), elev: css('--surface-elev'), accent: css('--accent'), data: css('--data'), warn: css('--warn'), crit: css('--crit'),
});
const FONT_BODY = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
function baseLayout(extra = {}) {
  const c = C();
  const ax = {
    gridcolor: c.grid, gridwidth: 1, zeroline: false, showline: true, linecolor: c.line, linewidth: 1, ticks: 'outside', ticklen: 4,
    tickcolor: c.line, tickfont: { size: 11, color: c.muted }, automargin: true, title: { font: { size: 12, color: c.text2 }, standoff: 10 },
  };
  const lay = {
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: c.text, family: FONT_BODY, size: 12 },
    margin: { l: 56, r: 14, t: 30, b: 44 },
    legend: { orientation: 'h', x: 0, y: 1.02, yanchor: 'bottom', font: { size: 11, color: c.text2 }, bgcolor: 'rgba(0,0,0,0)' },
    hovermode: 'x unified', hoverlabel: { bgcolor: c.elev, bordercolor: c.line, font: { color: c.text, family: FONT_BODY, size: 12 } },
    xaxis: { ...ax }, yaxis: { ...ax },
  };
  for (const [k, v] of Object.entries(extra)) {
    lay[k] = (k.startsWith('xaxis') || k.startsWith('yaxis')) ? { ...ax, ...v, title: { ...ax.title, ...(v.title || {}) } } : v;
  }
  return lay;
}
const PCONF = { responsive: true, displaylogo: false, displayModeBar: false };
function plot(id, data, layout) {
  const el = document.getElementById(id);
  if (!el || !HAS_PLOTLY) return;
  window.Plotly.react(el, data, layout, PCONF);
  if (LINKED.has(id) && !el.dataset.linked && el.on) { el.dataset.linked = 'true'; el.on('plotly_relayout', (ev) => syncTimeAxis(id, ev)); }
}
// charts that share one time axis (the Simulator's P1-P3): zooming or panning one moves the others
const LINKED = new Set();
let syncing = false;
function linkTimeAxes(ids) { ids.forEach((i) => LINKED.add(i)); }
function syncTimeAxis(src, ev) {
  if (syncing) return;
  let upd = null;
  if ('xaxis.range[0]' in ev) upd = { 'xaxis.range': [ev['xaxis.range[0]'], ev['xaxis.range[1]']] };
  else if (Array.isArray(ev['xaxis.range'])) upd = { 'xaxis.range': ev['xaxis.range'].slice() };
  else if (ev['xaxis.autorange']) { const r = document.getElementById(src).layout.xaxis.range; upd = { 'xaxis.range': r.slice() }; }
  if (!upd) return;
  syncing = true;
  Promise.all([...LINKED].filter((i) => i !== src).map((i) => window.Plotly.relayout(i, upd))).finally(() => { syncing = false; });
}

// ------------------------------------------------------------------ state, presets
const BASE = {
  preset: 'default',
  controller: 'pid', mode: 'PID', model: 'fit_sopdt', tau_c: 20, theta_design: 10, include_zoh: false,
  N: 10, beta: 1, anti_windup: 'clamp',
  meal_plan: 'one', meal_t: 60, meal_mult: 1,
  ff_enabled: false, f_bolus: 1, est_error: 0, t_pre: 0, suspend_integral: false, suspend_extra: 0,
  sensor_delay: 10, sensor_lag: 0, noise_sd: 0, seed: 0, fault: 'none', t_fault: 60, drift_rate: 0, dropout_duration: 30,
  sp_on: false, sp_t: 60, sp_val: 61, sens_on: false, sens_t: 120, sens_factor: 1.5, saturation: true, t_end: 660,
  tuning_mode: 'imc', Kc_man: null, tauI_man: null, tauD_man: null,
  dU: 1, band: 'seborg', mpc_case: 'unannounced',
};
const PRESETS = [
  { id: 'default', label: 'Ex. 23.6(e) feedback only (default)', s: {} },
  { id: 'ex23_6d', label: 'Ex. 23.6(d) no sensor delay', s: { theta_design: 0, sensor_delay: 0 } },
  { id: 'unaware', label: 'Delay-unaware tuning (tuned for θs = 0)', s: { theta_design: 0 } },
  { id: 'aggr', label: 'Aggressive τc = 2 min', s: { tau_c: 2 } },
  { id: 'open', label: 'Open loop (basal only)', s: { controller: 'none' } },
  { id: 'bolus', label: 'Static bolus at the meal', s: { ff_enabled: true } },
  { id: 'pre15', label: '15-min pre-bolus', s: { ff_enabled: true, t_pre: 15 } },
  { id: 'over40', label: '+40 % meal overestimate (pre-bolus 15)', s: { ff_enabled: true, t_pre: 15, est_error: 0.4 } },
  { id: 'wu_off', label: 'Windup: anti-windup off, 2× meal', s: { anti_windup: 'off', meal_mult: 2 } },
  { id: 'wu_clamp', label: 'Windup: clamping, 2× meal', s: { anti_windup: 'clamp', meal_mult: 2 } },
  { id: 'wu_bc', label: 'Windup: back-calculation, 2× meal', s: { anti_windup: 'backcalc', meal_mult: 2 } },
  { id: 'sp', label: 'Ex. 23.6(c) set-point step −20, β = 1', s: { meal_plan: 'none', sp_on: true } },
  { id: 'sp_b', label: 'Set-point step −20, β = 0.5', s: { meal_plan: 'none', sp_on: true, beta: 0.5 } },
  { id: 'ponly', label: 'P-only: steady-state offset', s: { meal_plan: 'none', sp_on: true, mode: 'P' } },
  { id: 'pi', label: 'PI (τD = 0)', s: { mode: 'PI' } },
  { id: 'lag5', label: 'Sensor lag 5 min + 10-min delay', s: { sensor_lag: 5 } },
  { id: 'stuck', label: 'Sensor stuck at the meal', s: { fault: 'stuck', t_fault: 60 } },
  { id: 'drift', label: 'Sensor drift +10 mg/dL per h', s: { fault: 'drift', t_fault: 60, drift_rate: 10 } },
  { id: 'dropout', label: 'Sensor dropout 100–130 min', s: { fault: 'dropout', t_fault: 100, dropout_duration: 30 } },
  { id: 'sens', label: 'Plant–model mismatch: p3 × 1.5 from 120 min', s: { sens_on: true, sens_t: 120, sens_factor: 1.5 } },
  { id: 'three', label: 'Three meals in 24 h', s: { meal_plan: 'three', t_end: 1440 } },
  { id: 'suspend', label: 'Pre-bolus 15 + integral suspended (bolus + 60 min)', s: { ff_enabled: true, t_pre: 15, suspend_integral: true, suspend_extra: 60 } },
];
let state = { ...BASE };

function tuningOf(s) {
  return M.imcTuning({ model: s.model, tau_c: s.tau_c, theta_sensor: s.theta_design, Ts: 5, include_zoh: s.include_zoh });
}
function mealsOf(s) {
  if (s.meal_plan === 'none') return [];
  if (s.meal_plan === 'three') return [[480, s.meal_mult], [780, s.meal_mult], [1140, s.meal_mult]];
  return [[s.meal_t, s.meal_mult]];
}
// Controller gains actually used: IMC (from τc) or the manual sliders.
function gainsOf(s) {
  const tu = tuningOf(s);
  if (s.tuning_mode !== 'manual' || !fin(s.Kc_man)) return tu;
  return { Kc: s.Kc_man, tauI: s.tauI_man, tauD: s.tauD_man, theta_total: tu.theta_total };
}
function inputsOf(s) {
  const tu = gainsOf(s);
  return {
    t_end: s.t_end, dt: 0.1, Ts: 5,
    controller: s.controller, mode: s.mode, Kc: tu.Kc, tauI: tu.tauI, tauD: tu.tauD,
    N: s.N, beta: s.beta, anti_windup: s.anti_windup, U_open_loop: null,
    setpoint: P.G_basal, setpoint_steps: s.sp_on ? [[s.sp_t, s.sp_val]] : [],
    sensor_delay: s.sensor_delay, sensor_lag: s.sensor_lag, noise_sd: s.noise_sd, seed: s.seed,
    fault: s.fault, t_fault: s.t_fault, drift_rate: s.drift_rate, dropout_duration: s.dropout_duration,
    meals: mealsOf(s),
    ff_enabled: s.ff_enabled, f_bolus: s.f_bolus, est_error: s.est_error, t_pre: s.t_pre,
    suspend_integral: s.suspend_integral, suspend_extra: s.suspend_extra,
    sensitivity_change: s.sens_on ? [s.sens_t, s.sens_factor] : null,
    saturation: s.saturation,
  };
}
// effective controller settings used by the simulation (mode applied)
function effective(s) {
  const tu = gainsOf(s);
  return { Kc: tu.Kc, tauI: s.mode === 'P' ? null : tu.tauI, tauD: s.mode === 'PID' ? tu.tauD : 0, N: s.N, theta_total: tu.theta_total };
}
const bandOf = (s) => (s.band === 'clinical' ? { low: DATA.clinicalBand.value[0], high: DATA.clinicalBand.value[1], name: '70–180 mg/dL' }
  : { low: P.band_low, high: P.band_high, name: '54 < G < 144 mg/dL' });

// ------------------------------------------------------------------ controls
const MODEL_OPTS = [
  ['fit_sopdt', 'SOPDT fit → PID (default)'], ['half_sopdt', 'Half-rule SOPDT → PID'],
  ['fit_fopdt_pid', 'FOPDT fit → PID'], ['fit_fopdt_pi', 'FOPDT fit → PI'], ['half_fopdt_pi', 'Half-rule FOPDT → PI'],
];
const TUNING_MODE_ITEM = (cond) => ({ key: 'tuning_mode', type: 'seg', label: 'Tuning', opts: [['imc', 'IMC (from τc)'], ['manual', 'Manual gains']], show: cond || undefined });
const MANUAL_ITEMS = (cond) => {
  const c = cond || (() => true);
  return [
    { key: 'Kc_man', type: 'range', label: 'Kc (mU/min per mg/dL)', min: -2, max: 0.5, step: 0.01, unit: '', d: 3, show: (s) => c(s) && s.tuning_mode === 'manual' },
    { key: 'tauI_man', type: 'range', label: 'τI integral time', min: 5, max: 300, step: 1, unit: 'min', d: 1, show: (s) => c(s) && s.tuning_mode === 'manual' && s.mode !== 'P' },
    { key: 'tauD_man', type: 'range', label: 'τD derivative time', min: 0, max: 60, step: 0.5, unit: 'min', d: 1, show: (s) => c(s) && s.tuning_mode === 'manual' && s.mode === 'PID' },
  ];
};
// the preset menu sits in the workspace header, not in the controls rail
const SIM_PRESET_SPEC = [{ legend: null, items: [
  { key: 'preset', type: 'select', label: 'Scenario', opts: [['custom', 'Custom (modified)'], ...PRESETS.map((p) => [p.id, p.label])] },
] }];
const SIM_SPEC = [
  { legend: 'Controller', desc: 'Loop on or off, PID mode, and how the gains are tuned.', openMobile: true, items: [
    { key: 'controller', type: 'select', label: 'Loop', opts: [['pid', 'Closed loop (PID)'], ['none', 'Open loop (basal infusion only)']] },
    { key: 'mode', type: 'seg', label: 'Mode', opts: [['P', 'P'], ['PI', 'PI'], ['PID', 'PID']], show: (s) => s.controller === 'pid' },
    TUNING_MODE_ITEM((s) => s.controller === 'pid'),
    { key: 'model', type: 'select', label: 'Tuning model (IMC)', opts: MODEL_OPTS, show: (s) => s.controller === 'pid' && s.tuning_mode !== 'manual' },
    { key: 'tau_c', type: 'range', label: 'τc closed-loop time constant', min: 2, max: 100, step: 1, unit: 'min', d: 0, show: (s) => s.controller === 'pid' && s.tuning_mode !== 'manual' },
    { key: 'theta_design', type: 'range', label: 'Sensor delay assumed in tuning', min: 0, max: 40, step: 0.5, unit: 'min', d: 1, show: (s) => s.controller === 'pid' && s.tuning_mode !== 'manual' },
    { key: 'include_zoh', type: 'check', label: 'Add Ts/2 (ZOH) to θ in tuning', show: (s) => s.controller === 'pid' && s.tuning_mode !== 'manual' },
    ...MANUAL_ITEMS((s) => s.controller === 'pid'),
    { key: 'N', type: 'range', label: 'Derivative filter N', min: 2, max: 20, step: 1, unit: '', d: 0, show: (s) => s.controller === 'pid' && s.mode === 'PID' },
    // β only weights set-point changes, so it is shown only when there is a set-point step to act on
    { key: 'beta', type: 'range', label: 'Set-point weight β', min: 0, max: 1, step: 0.05, unit: '', d: 2, show: (s) => s.controller === 'pid' && s.sp_on },
    { key: 'anti_windup', type: 'select', label: 'Anti-windup', opts: [['clamp', 'Clamping (conditional integration)'], ['backcalc', 'Back-calculation'], ['off', 'Off']], show: (s) => s.controller === 'pid' && s.mode !== 'P' },
  ] },
  { legend: 'Meal disturbance', desc: 'When the meal arrives and how large it is.', items: [
    { key: 'meal_plan', type: 'select', label: 'Meals', opts: [['one', 'One meal'], ['three', 'Three meals (480, 780, 1140 min)'], ['none', 'No meal']] },
    { key: 'meal_t', type: 'range', label: 'Meal time', min: 0, max: 300, step: 5, unit: 'min', d: 0, show: (s) => s.meal_plan === 'one' },
    { key: 'meal_mult', type: 'range', label: 'Meal size (× textbook meal)', min: 0, max: 3, step: 0.1, unit: '×', d: 1, show: (s) => s.meal_plan !== 'none' },
  ] },
  { legend: 'Feedforward (static bolus)', desc: 'Act on the meal before glucose rises.', items: [
    { key: 'ff_enabled', type: 'check', label: 'Feedforward bolus on', show: (s) => s.meal_plan !== 'none' },
    { key: 'f_bolus', type: 'range', label: 'Bolus fraction f', min: 0, max: 1.5, step: 0.05, unit: '', d: 2, show: (s) => s.ff_enabled && s.meal_plan !== 'none' },
    { key: 'est_error', type: 'range', label: 'Meal estimate error', min: -0.5, max: 0.8, step: 0.05, unit: '', d: 2, pct: true, show: (s) => s.ff_enabled && s.meal_plan !== 'none' },
    { key: 't_pre', type: 'range', label: 'Pre-bolus time (bolus starts before meal)', min: -30, max: 60, step: 5, unit: 'min', d: 0, show: (s) => s.ff_enabled && s.meal_plan !== 'none' },
    { key: 'suspend_integral', type: 'check', label: 'Suspend integral during bolus', show: (s) => s.ff_enabled && s.meal_plan !== 'none' && s.controller === 'pid' },
    { key: 'suspend_extra', type: 'range', label: 'Extra suspend time after bolus', min: 0, max: 120, step: 10, unit: 'min', d: 0, show: (s) => s.ff_enabled && s.suspend_integral && s.meal_plan !== 'none' && s.controller === 'pid' },
  ] },
  { legend: 'Sensor (CGM)', desc: 'Delay, lag, noise and faults in what the controller sees.', items: [
    { key: 'sensor_delay', type: 'range', label: 'Actual sensor delay θs', min: 0, max: 40, step: 0.5, unit: 'min', d: 1 },
    { key: 'sensor_lag', type: 'range', label: 'Sensor lag τs (0 or 0.5–15)', min: 0, max: 15, step: 0.5, unit: 'min', d: 1 },
    { key: 'noise_sd', type: 'range', label: 'Noise σ (display / control)', min: 0, max: 10, step: 0.5, unit: 'mg/dL', d: 1 },
    { key: 'seed', type: 'number', label: 'Noise seed', min: 0, max: 99999, step: 1, show: (s) => s.noise_sd > 0 },
    { key: 'fault', type: 'select', label: 'Fault', opts: [['none', 'None'], ['stuck', 'Stuck reading'], ['drift', 'Drift'], ['dropout', 'Dropout (no reading)']] },
    { key: 't_fault', type: 'range', label: 'Fault starts at', min: 0, max: 600, step: 5, unit: 'min', d: 0, show: (s) => s.fault !== 'none' },
    { key: 'drift_rate', type: 'range', label: 'Drift rate', min: -30, max: 30, step: 1, unit: 'mg/dL per h', d: 0, show: (s) => s.fault === 'drift' },
    { key: 'dropout_duration', type: 'range', label: 'Dropout length', min: 5, max: 120, step: 5, unit: 'min', d: 0, show: (s) => s.fault === 'dropout' },
  ] },
  { legend: 'Set point, plant, horizon', desc: 'Set-point step, sensitivity change, pump limits, run length.', items: [
    { key: 'sp_on', type: 'check', label: 'Set-point step', show: (s) => s.controller === 'pid' },
    { key: 'sp_t', type: 'range', label: 'Step time', min: 0, max: 600, step: 10, unit: 'min', d: 0, show: (s) => s.sp_on && s.controller === 'pid' },
    { key: 'sp_val', type: 'range', label: 'New set point', min: 55, max: 143, step: 1, unit: 'mg/dL', d: 0, show: (s) => s.sp_on && s.controller === 'pid' },
    { key: 'sens_on', type: 'check', label: 'Insulin sensitivity change (p3 × factor)' },
    { key: 'sens_t', type: 'range', label: 'Change at', min: 0, max: 600, step: 10, unit: 'min', d: 0, show: (s) => s.sens_on },
    { key: 'sens_factor', type: 'range', label: 'Factor on p3', min: 0.5, max: 2, step: 0.05, unit: '×', d: 2, show: (s) => s.sens_on },
    { key: 'saturation', type: 'check', label: 'Pump limits 0–115 mU/min' },
    { key: 't_end', type: 'range', label: 'Simulated time', min: 120, max: 1440, step: 60, unit: 'min', d: 0 },
  ] },
];
const DESIGN_SPEC = [
  { legend: 'Tuning inputs (shared with the Simulator)', items: [
    TUNING_MODE_ITEM(null),
    { key: 'model', type: 'select', label: 'Reduced model → controller', opts: MODEL_OPTS, show: (s) => s.tuning_mode !== 'manual' },
    { key: 'tau_c', type: 'range', label: 'τc closed-loop time constant', min: 2, max: 100, step: 1, unit: 'min', d: 0, show: (s) => s.tuning_mode !== 'manual' },
    { key: 'theta_design', type: 'range', label: 'Sensor delay assumed in tuning', min: 0, max: 40, step: 0.5, unit: 'min', d: 1, show: (s) => s.tuning_mode !== 'manual' },
    { key: 'include_zoh', type: 'check', label: 'Add Ts/2 (ZOH) to θ', show: (s) => s.tuning_mode !== 'manual' },
    { key: 'mode', type: 'seg', label: 'Mode', opts: [['P', 'P'], ['PI', 'PI'], ['PID', 'PID']] },
    ...MANUAL_ITEMS(null),
    { key: 'N', type: 'range', label: 'Derivative filter N', min: 2, max: 20, step: 1, unit: '', d: 0, show: (s) => s.mode === 'PID' },
    { key: 'sensor_delay', type: 'range', label: 'Actual sensor delay in the loop θs', min: 0, max: 40, step: 0.5, unit: 'min', d: 1 },
  ] },
];
const THEORY_SPEC_GAIN = [{ legend: null, items: [
  { key: 'dU', type: 'range', label: 'Insulin step ΔU', min: -16, max: 98, step: 1, unit: 'mU/min', d: 0 },
] }];
const THEORY_SPEC_FF = [{ legend: null, items: [
  { key: 'est_error', type: 'range', label: 'Meal estimate error', min: -0.5, max: 0.8, step: 0.05, unit: '', d: 2, pct: true },
  { key: 'meal_mult', type: 'range', label: 'Meal size (× textbook meal)', min: 0, max: 3, step: 0.1, unit: '×', d: 1 },
  { key: 'f_bolus', type: 'range', label: 'Bolus fraction f', min: 0, max: 1.5, step: 0.05, unit: '', d: 2 },
] }];

const controlEls = []; // {item, wrap, input, out, prefix}
function valText(item, v) {
  if (item.pct) return `${v > 0 ? '+' : ''}${fmt(v * 100, 0)} %`;
  return `${fmt(v, item.d ?? 1)}${item.unit ? ' ' + item.unit : ''}`;
}
function buildControls(container, spec, prefix) {
  for (const g of spec) {
    const fs = document.createElement(g.legend ? 'details' : 'div');
    if (g.legend) {
      fs.className = 'grp';
      const narrow = window.matchMedia('(max-width: 900px)').matches;
      fs.open = !narrow || !!g.openMobile || spec.length === 1;
      fs.innerHTML = g.desc ? `<summary><span class="grp-name">${g.legend}<small class="grp-desc">${g.desc}</small></span></summary>` : `<summary>${g.legend}</summary>`;
    }
    for (const it of g.items) {
      const id = `${prefix}-${it.key}`;
      const wrap = document.createElement('div');
      wrap.className = 'ctl' + (it.type === 'check' ? ' check' : '');
      let input, out = null;
      if (it.type === 'range') {
        wrap.innerHTML = `<label for="${id}"><span>${it.label}</span><output id="${id}-out"></output></label>
          <input type="range" id="${id}" name="${it.key}" min="${it.min}" max="${it.max}" step="${it.step}">`;
        input = wrap.querySelector('input'); out = wrap.querySelector('output');
        input.addEventListener('input', () => setState({ [it.key]: +input.value }, true));
      } else if (it.type === 'number') {
        wrap.innerHTML = `<label for="${id}"><span>${it.label}</span></label><input type="number" id="${id}" min="${it.min}" max="${it.max}" step="${it.step}">`;
        input = wrap.querySelector('input');
        input.addEventListener('change', () => {
          const v = Math.round(+input.value);
          if (fin(v) && v >= it.min && v <= it.max) setState({ [it.key]: v }, true);
          else { showUiWarning(`${it.label}: enter a whole number from ${it.min} to ${it.max}.`); input.value = state[it.key]; }
        });
      } else if (it.type === 'select') {
        wrap.innerHTML = `<label for="${id}"><span>${it.label}</span></label><select id="${id}">${it.opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>`;
        input = wrap.querySelector('select');
        input.addEventListener('change', () => {
          if (it.key === 'preset') return applyPreset(input.value);
          const patch = { [it.key]: input.value };
          // a drift fault with zero rate would do nothing: start from the drift preset's +10 mg/dL per h
          if (it.key === 'fault' && input.value === 'drift' && state.drift_rate === 0) patch.drift_rate = 10;
          setState(patch, true);
        });
      } else if (it.type === 'check') {
        wrap.innerHTML = `<label for="${id}"><input type="checkbox" id="${id}">&nbsp;${it.label}</label>`;
        input = wrap.querySelector('input');
        input.addEventListener('change', () => setState({ [it.key]: input.checked }, true));
      } else if (it.type === 'seg') {
        wrap.innerHTML = `<label><span>${it.label}</span></label><div class="seg" role="group" aria-label="${it.label}">${it.opts.map(([v, l]) => `<button type="button" data-v="${v}">${l}</button>`).join('')}</div>`;
        input = wrap.querySelector('.seg');
        input.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
          const patch = { [it.key]: b.dataset.v };
          if (it.key === 'tuning_mode' && b.dataset.v === 'manual' && state.tuning_mode !== 'manual') {
            const tu = tuningOf(state); // start from the current IMC gains, so nothing jumps
            Object.assign(patch, { Kc_man: tu.Kc, tauI_man: tu.tauI, tauD_man: tu.tauD });
          }
          setState(patch, true);
        }));
      }
      fs.appendChild(wrap);
      controlEls.push({ it, wrap, input, out });
    }
    container.appendChild(fs);
  }
}
function syncControls() {
  for (const { it, wrap, input, out } of controlEls) {
    const v = state[it.key];
    if (it.type === 'range') {
      if (fin(v) && +input.value !== v) input.value = v;
      out.textContent = valText(it, v);
      const lo = +input.min, hi = +input.max;
      input.style.setProperty('--fill', `${hi > lo ? Math.min(100, Math.max(0, ((+input.value - lo) / (hi - lo)) * 100)) : 0}%`);
    }
    else if (it.type === 'number') { if (+input.value !== v) input.value = v; }
    else if (it.type === 'select') input.value = v;
    else if (it.type === 'check') input.checked = !!v;
    else if (it.type === 'seg') input.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === v)));
    wrap.hidden = it.show ? !it.show(state) : false;
  }
}

// ------------------------------------------------------------------ state updates / scheduling
let activeTab = 'overview';
const dirty = { simulator: true, theory: true, design: true, refs: true };
let rafId = 0;
let uiWarnings = [];
function showUiWarning(msg) { uiWarnings = [msg]; dirty.simulator = true; schedule(); }
function setState(patch, user = false) {
  state = { ...state, ...patch };
  if (user && !('preset' in patch) && !('band' in patch) && !('dU' in patch) && !('mpc_case' in patch)) state.preset = 'custom';
  for (const k of Object.keys(dirty)) dirty[k] = true;
  syncControls();
  schedule();
}
function applyPreset(id) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) { setState({ preset: 'custom' }); return; }
  uiWarnings = [];
  const keep = { band: state.band, dU: state.dU, mpc_case: state.mpc_case };
  state = { ...BASE, ...keep, ...p.s, preset: id };
  for (const k of Object.keys(dirty)) dirty[k] = true;
  syncControls();
  schedule();
}
function schedule() {
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => renderTab(activeTab));
}
function renderTab(tab) {
  if (!dirty[tab]) return;
  dirty[tab] = false;
  try {
    if (tab === 'simulator') renderSimulator();
    else if (tab === 'theory') renderTheory();
    else if (tab === 'design') renderDesign();
    else if (tab === 'refs') renderRefs();
  } catch (e) {
    console.warn(e);
    const box = document.getElementById(tab === 'simulator' ? 'sim-warnings' : 'lib-warning');
    if (box) box.innerHTML = `<p class="warn">Something went wrong while computing this view (${esc(e.message)}). Try another setting or reload.</p>`;
  }
}

// ------------------------------------------------------------------ SIMULATOR
let savedRuns = [];
let sweepTimer = 0;
let lastResult = null;
function bandShapes(c, band, x1) {
  return [
    { type: 'rect', xref: 'x', yref: 'y', x0: 0, x1, y0: P.band_low, y1: P.band_high, fillcolor: c.band, line: { width: 0 }, layer: 'below' },
    { type: 'line', xref: 'x', yref: 'y', x0: 0, x1, y0: DATA.clinicalBand.value[0], y1: DATA.clinicalBand.value[0], line: { color: c.muted, width: 1, dash: 'dash' } },
    { type: 'line', xref: 'x', yref: 'y', x0: 0, x1, y0: DATA.clinicalBand.value[1], y1: DATA.clinicalBand.value[1], line: { color: c.muted, width: 1, dash: 'dash' } },
  ];
}
function decimate(arr, step = 5) { const o = []; for (let i = 0; i < arr.length; i += step) o.push(arr[i]); if ((arr.length - 1) % step) o.push(arr[arr.length - 1]); return o; }

const METRIC_ROWS = [
  ['peak', 'Peak glucose', 'mg/dL', 'G_{\\max} = \\max_t G(t)', 'Highest true glucose: how far the meal pushes G up.', 1],
  ['nadir', 'Nadir glucose', 'mg/dL', 'G_{\\min} = \\min_t G(t)', 'Lowest true glucose: the undershoot after the controller reacts.', 1],
  ['pct_in_band', 'Time in chosen band', '%', '\\tfrac{100}{t_f}\\int_0^{t_f} \\mathbf{1}[\\text{in band}]\\,dt', 'Share of the horizon inside the band (strict limits for 54–144).', 1],
  ['pct_in_70_180', 'Time in 70–180', '%', '\\tfrac{100}{t_f}\\int_0^{t_f} \\mathbf{1}[70\\le G\\le 180]\\,dt', 'Secondary clinical-style metric (source marked to verify).', 1],
  ['pct_below_54', 'Time below 54', '%', '\\tfrac{100}{t_f}\\int_0^{t_f} \\mathbf{1}[G<54]\\,dt', 'Time under the lower safety limit.', 1],
  ['pct_below_70', 'Time below 70', '%', '\\tfrac{100}{t_f}\\int_0^{t_f} \\mathbf{1}[G<70]\\,dt', 'Time in the low range.', 1],
  ['pct_above_high', 'Time at/above upper limit', '%', '\\tfrac{100}{t_f}\\int_0^{t_f} \\mathbf{1}[G\\ge G_{high}]\\,dt', 'Time over the chosen band’s upper limit.', 1],
  ['IAE', 'IAE', 'mg/dL·min', '\\int_0^{t_f} |G - G_{sp}|\\,dt', 'Total area between glucose and set point; smaller is tighter control.', 0],
  ['insulin_total', 'Insulin delivered', 'mU', '\\sum_i U_i\\,\\Delta t', 'Total model insulin infused over the horizon (basal included).', 0],
  ['insulin_ff', 'of which bolus (feedforward)', 'mU', '\\sum_i U_{ff,i}\\,\\Delta t', 'Insulin delivered by the feedforward pulse.', 0],
  ['time_at_Umax', 'Time at U_max', 'min', '\\sum_i \\Delta t\\;[U_i \\ge 115]', 'How long the pump is saturated high (windup risk).', 1],
  ['time_at_Umin', 'Time at U_min = 0', 'min', '\\sum_i \\Delta t\\;[U_i \\le 0]', 'How long the pump is shut off: the only way to “remove” insulin.', 1],
];

const INST_MARGIN = { l: 66, r: 14, t: 34, b: 44 };
function renderSimulator() {
  const inputs = inputsOf(state);
  const r = M.simulate(inputs);
  lastResult = r;
  const band = bandOf(state);
  const m = M.metrics(r, band);
  const c = C();
  const tEnd = r.t[r.t.length - 1] ?? state.t_end;

  // warnings
  const w = [...uiWarnings, ...r.warnings];
  if (state.controller === 'pid' && state.mode === 'PID' && (state.model === 'fit_fopdt_pi' || state.model === 'half_fopdt_pi')) w.push('This tuning model gives τD = 0, so PID mode behaves as PI.');
  if (state.controller === 'pid' && state.mode === 'P') w.push('P-only control has no integral action: expect a steady-state offset after a set-point change or a sustained disturbance.');
  if (state.fault === 'drift' && state.drift_rate !== 0) w.push('Sensor drift: the controller regulates the wrong (drifting) reading, so true glucose is pushed away from the set point.');
  if (inputs.meals.some(([tm]) => tm > state.t_end)) w.push('A meal is after the end of the simulated time, so it does not appear.');
  document.getElementById('sim-warnings').innerHTML = w.map((x) => `<p class="warn">⚠ ${esc(x)}</p>`).join('');

  // badge + kpis
  const badge = document.getElementById('sim-badge');
  badge.className = 'badge ' + (m.stayed_in_band ? 'pass' : 'fail');
  badge.textContent = m.stayed_in_band ? `✓ Stayed inside ${band.name}` : `✗ Left ${band.name}`;
  // peak and nadir lead, flagged when they leave the band; the other three are secondary
  const peakOut = m.peak >= band.high, nadirOut = m.nadir <= band.low;
  const kp = [
    ['Peak', `${fmt(m.peak, 1)} mg/dL`, `at ${fmt(m.t_peak, 0)} min · ${peakOut ? `above ${band.high}` : `below ${band.high}`}`, `kpi-key ${peakOut ? 'out' : 'in'}`],
    ['Nadir', `${fmt(m.nadir, 1)} mg/dL`, `at ${fmt(m.t_nadir, 0)} min · ${nadirOut ? `below ${band.low}` : `above ${band.low}`}`, `kpi-key ${nadirOut ? 'out' : 'in'}`],
    ['Time in band', `${fmt(m.pct_in_band, 1)} %`, band.name, ''],
    ['IAE', `${fmt(m.IAE, 0)}`, 'mg/dL·min', ''],
    ['Bolus', `${fmt(r.bolusDelivered, 0)} mU`, `planned ${fmt(r.bolusPlanned, 0)} mU`, ''],
  ];
  document.getElementById('sim-kpis').innerHTML = kp.map(([k, v, s, cls]) => `<div class="kpi ${cls}"><div class="k">${k}</div><div class="v">${v}</div><div class="k">${esc(s)}</div></div>`).join('');

  // metrics table
  const tbl = document.getElementById('metrics-table');
  tbl.innerHTML = `<thead><tr><th>Metric</th><th>Value</th><th>Units</th><th>Equation</th><th>Meaning</th></tr></thead><tbody>${
    METRIC_ROWS.map(([k, name, u, tex, mean, d]) => `<tr><td>${name}</td><td class="num">${fmt(m[k], d)}</td><td>${u}</td><td>${Ti(tex)}</td><td>${mean}</td></tr>`).join('')
  }</tbody>`;
  renderTex(tbl);

  // P1
  const t = decimate(r.t), G = decimate(r.G), Gm = decimate(r.Gm), SP = decimate(r.sp);
  plot('p1', [
    { x: t, y: G, name: 'True glucose G', mode: 'lines', line: { color: c.s1, width: 2 }, hovertemplate: '%{y:.1f} mg/dL' },
    { x: t, y: Gm, name: 'Measured (sensor)', mode: 'lines', line: { color: c.s2, width: 2, shape: 'hv' }, connectgaps: false, hovertemplate: '%{y:.1f} mg/dL' },
    { x: t, y: SP, name: 'Set point', mode: 'lines', line: { color: c.muted, width: 1.5, dash: 'dot' }, hovertemplate: '%{y:.0f} mg/dL' },
  ], baseLayout({ margin: INST_MARGIN, shapes: bandShapes(c, band, tEnd), xaxis: { title: { text: 'time (min)' }, range: [0, tEnd] }, yaxis: { automargin: false, title: { text: 'glucose (mg/dL)' } } }));

  // P2: U = basal part + feedback above basal + bolus
  const Ub = LM.U_basal;
  const fb = r.U.map((u, i) => Math.min(r.Ufb[i], u));
  const basalPart = fb.map((f) => Math.min(f, Ub));
  const above = fb.map((f) => Math.max(f - Ub, 0));
  const bol = r.U.map((u, i) => u - fb[i]);
  plot('p2', [
    { x: t, y: decimate(basalPart), name: 'Basal (reduced when feedback cuts)', stackgroup: 'u', line: { color: c.s3, width: 0.5, shape: 'hv' }, fillcolor: c.s3, hovertemplate: '%{y:.1f}' },
    { x: t, y: decimate(above), name: 'Feedback above basal', stackgroup: 'u', line: { color: c.s1, width: 0.5, shape: 'hv' }, fillcolor: c.s1, hovertemplate: '%{y:.1f}' },
    { x: t, y: decimate(bol), name: 'Bolus (feedforward)', stackgroup: 'u', line: { color: c.s2, width: 0.5, shape: 'hv' }, fillcolor: c.s2, hovertemplate: '%{y:.1f}' },
    { x: [0, tEnd], y: [Ub, Ub], name: 'U_basal', mode: 'lines', line: { color: c.text2, width: 1, dash: 'dash' }, hoverinfo: 'skip' },
  ], baseLayout({ margin: INST_MARGIN, xaxis: { title: { text: 'time (min)' }, range: [0, tEnd] }, yaxis: { automargin: false, title: { text: 'U (mU/min)' }, rangemode: 'tozero' } }));

  // P3
  plot('p3', [{ x: t, y: decimate(r.D), name: 'D(t)', mode: 'lines', line: { color: c.s3, width: 2 }, fill: 'tozeroy', fillcolor: c.band, hovertemplate: '%{y:.2f} mg/dL/min' }],
    baseLayout({ showlegend: false, margin: { ...INST_MARGIN, t: 12 }, xaxis: { title: { text: 'time (min)' }, range: [0, tEnd] }, yaxis: { automargin: false, title: { text: 'D (mg/dL/min)' }, rangemode: 'tozero' } }));

  renderSaved();
  clearTimeout(sweepTimer);
  sweepTimer = setTimeout(renderSweeps, 150);
}

function presetLabel() {
  const p = PRESETS.find((x) => x.id === state.preset);
  const base = p ? p.label : 'Custom';
  if (state.controller !== 'pid') return `${base} · open loop`;
  const tun = state.tuning_mode === 'manual' ? `manual Kc=${fmt(state.Kc_man, 3)}` : `τc=${state.tau_c}`;
  return `${base} · ${state.mode}, ${tun}, θs=${state.sensor_delay}`;
}
function renderSaved() {
  const c = C();
  const cols = [c.s3, c.s4, c.s5, c.s6];
  const r = lastResult;
  const traces = savedRuns.map((s, k) => ({ x: s.t, y: s.G, name: `#${k + 1} ${s.label}`.slice(0, 60), mode: 'lines', line: { color: cols[k], width: 2 }, hovertemplate: '%{y:.1f}' }));
  if (r) traces.push({ x: decimate(r.t), y: decimate(r.G), name: 'Current run', mode: 'lines', line: { color: c.s1, width: 2.5 }, hovertemplate: '%{y:.1f}' });
  const tMax = Math.max(r ? r.t[r.t.length - 1] : 0, ...savedRuns.map((s) => s.t[s.t.length - 1]));
  plot('p8', traces, baseLayout({ shapes: bandShapes(c, null, tMax), xaxis: { title: { text: 'time (min)' } }, yaxis: { title: { text: 'true glucose (mg/dL)' } } }));
  document.getElementById('saved-list').innerHTML = savedRuns.map((s, k) => `<li style="--chip:${cols[k]}"><span class="chip-sw" aria-hidden="true"></span>#${k + 1}: ${esc(s.label)} (peak ${fmt(s.peak, 1)}, nadir ${fmt(s.nadir, 1)} mg/dL)<button type="button" class="chip-x" data-rm="${k}" aria-label="Remove saved run ${k + 1}">×</button></li>`).join('');
  document.getElementById('clear-runs').disabled = savedRuns.length === 0;
  document.getElementById('save-run').disabled = savedRuns.length >= 4;
}

function renderSweeps() {
  if (activeTab !== 'simulator') { dirty.simulator = true; return; }
  const c = C();
  const base = inputsOf(state);
  // P10: IMC mode sweeps τc; manual mode sweeps Kc around the current value
  const manual = state.tuning_mode === 'manual' && fin(state.Kc_man);
  const pk = [], nd = [];
  let xs, xr, curX, curName;
  if (manual) {
    const factors = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
    xs = factors.map((f) => f * state.Kc_man);
    for (const k of xs) {
      const mm = M.metrics(M.simulate({ ...base, Kc: k }));
      pk.push(mm.peak); nd.push(mm.nadir);
    }
    xr = { title: { text: 'Kc (mU/min per mg/dL)' } };
    curX = state.Kc_man; curName = 'Current Kc';
  } else {
    xs = [2, 4, 6, 8, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100];
    for (const tc of xs) {
      const tu = M.imcTuning({ model: state.model, tau_c: tc, theta_sensor: state.theta_design, Ts: 5, include_zoh: state.include_zoh });
      const mm = M.metrics(M.simulate({ ...base, Kc: tu.Kc, tauI: tu.tauI, tauD: tu.tauD }));
      pk.push(mm.peak); nd.push(mm.nadir);
    }
    xr = { title: { text: 'τc (min)' }, type: 'log', tickvals: [2, 5, 10, 20, 50, 100] };
    curX = state.tau_c; curName = 'Current τc';
  }
  const cur = M.metrics(lastResult || M.simulate(base));
  const bandLines = (x0, x1, xref = 'paper') => [P.band_low, P.band_high].map((y) => ({ type: 'line', xref, yref: 'y', x0, x1, y0: y, y1: y, line: { color: c.muted, width: 1, dash: 'dot' } }));
  plot('p10', [
    { x: xs, y: pk, name: 'Peak', mode: 'lines+markers', line: { color: c.s2, width: 2 }, marker: { size: 8 } },
    { x: xs, y: nd, name: 'Nadir', mode: 'lines+markers', line: { color: c.s1, width: 2 }, marker: { size: 8 } },
    { x: [curX, curX], y: [cur.peak, cur.nadir], name: curName, mode: 'markers', marker: { symbol: 'diamond', size: 13, color: c.text, line: { color: c.surface, width: 2 } } },
  ], baseLayout({ hovermode: 'closest', shapes: bandLines(0, 1), xaxis: xr, yaxis: { title: { text: 'glucose (mg/dL)' } } }));
  const p10panel = document.querySelector('#p10').closest('.panel');
  p10panel.querySelector('.chart-title').innerHTML = manual ? 'P10 · Peak and nadir vs K<sub>c</sub> (live sweep, manual gains)' : 'P10 · Peak and nadir vs τ<sub>c</sub> (live sweep)';
  p10panel.querySelector('.chart-cap').innerHTML = state.controller !== 'pid'
    ? 'Open loop is selected, so the controller has no effect (flat lines). Switch to closed loop to see the trade-off.'
    : manual
      ? 'Manual gains: each point is a full simulation with K<sub>c</sub> scaled from 0.25× to 3× your value (τ<sub>I</sub>, τ<sub>D</sub> fixed). Diamond = current K<sub>c</sub>. Dotted: 54 and 144 mg/dL.'
      : 'Each point is a full simulation with the current settings and IMC tuning at that τ<sub>c</sub>. Diamond = current τ<sub>c</sub>. Dotted: 54 and 144 mg/dL.';

  // P11: pre-bolus sweep
  const pres = [-30, -15, 0, 5, 10, 15, 20, 30, 45, 60];
  const pk2 = [], nd2 = [];
  const mealsExist = base.meals.length > 0;
  for (const tp of pres) {
    const mm = M.metrics(M.simulate({ ...base, ff_enabled: true, t_pre: tp }));
    pk2.push(mm.peak); nd2.push(mm.nadir);
  }
  const traces = [
    { x: pres, y: pk2, name: 'Peak (with bolus)', mode: 'lines+markers', line: { color: c.s2, width: 2 }, marker: { size: 8 } },
    { x: pres, y: nd2, name: 'Nadir (with bolus)', mode: 'lines+markers', line: { color: c.s1, width: 2 }, marker: { size: 8 } },
  ];
  if (state.ff_enabled) {
    traces.push({ x: [state.t_pre, state.t_pre], y: [cur.peak, cur.nadir], name: 'Current t_pre', mode: 'markers', marker: { symbol: 'diamond', size: 13, color: c.text, line: { color: c.surface, width: 2 } } });
  } else {
    traces.push({ x: [pres[0], pres[pres.length - 1]], y: [cur.peak, cur.peak], name: 'No bolus (current): peak', mode: 'lines', line: { color: c.s2, width: 1.5, dash: 'dash' } });
    traces.push({ x: [pres[0], pres[pres.length - 1]], y: [cur.nadir, cur.nadir], name: 'No bolus: nadir', mode: 'lines', line: { color: c.s1, width: 1.5, dash: 'dash' } });
  }
  plot('p11', traces, baseLayout({ hovermode: 'closest', shapes: bandLines(0, 1), xaxis: { title: { text: 'pre-bolus time t_pre (min; negative = late)' } }, yaxis: { title: { text: 'glucose (mg/dL)' } } }));
  document.getElementById('p11-cap').innerHTML = !mealsExist ? 'No meal is selected, so there is no bolus to time (flat lines).'
    : state.ff_enabled ? 'Each point is a simulation with the static bolus started t<sub>pre</sub> min before each meal (bolus size from the current f and estimate error). Diamond = current t<sub>pre</sub>.'
      : 'Feedforward is off in the current run (dashed = current peak and nadir without a bolus). Points show what a static bolus at each t<sub>pre</sub> would do.';
}

// ------------------------------------------------------------------ THEORY
let theoryBuilt = false;
function buildTheory() {
  const root = document.getElementById('theory-cards');
  root.innerHTML = `
  <div class="section"><h2>1 · The process model</h2></div>
  <div class="grid two">
    <div id="th-ode"></div><div id="th-units"></div>
  </div>
  <div class="panel" style="margin-top:14px"><h3>Parameters (Seborg Ex. 23.3)</h3><div class="table-wrap"><table id="param-table"></table></div></div>
  <div class="grid two" style="margin-top:14px"><div id="th-basal"></div><div id="th-ss"></div></div>

  <div class="section"><h2>2 · Linearization and transfer functions</h2></div>
  <div class="grid two"><div id="th-abc"></div><div id="th-tf"></div></div>

  <div class="section"><h2>3 · Nonlinear steady-state gain</h2></div>
  <div class="grid two"><div id="th-gain"></div>
    <div class="panel"><div id="th-gain-ctl"></div><p class="chart-title">P4 · Steady-state gain vs ΔU</p><div id="p4" class="chart"></div>
    <p class="chart-cap">The linear model uses one gain K<sub>p</sub> for every step size; the real (nonlinear) gain shrinks for large insulin increases and grows for cuts. Diamond = current ΔU.</p></div></div>

  <div class="section"><h2>4 · Model reduction: half rule vs least-squares fits</h2></div>
  <div class="grid two"><div id="th-half"></div><div id="th-fits"></div></div>
  <div class="panel" style="margin-top:14px"><p class="chart-title">P5 · Step responses to ΔU (same slider as P4)</p><div id="p5" class="chart tall"></div>
    <p class="chart-cap">Nonlinear = RK4 simulation of the full model (open loop, no meal); linear = 3rd-order transfer function; the fits were made offline at ΔU = +1 mU/min by the Python reference, so they drift from the nonlinear curve for large steps.</p></div>

  <div class="section"><h2>5 · Feedforward: why the ideal controller is improper, and the static bolus</h2></div>
  <div class="grid two"><div id="th-ff"></div><div><div id="th-bolus"></div><div class="panel" style="margin-top:10px"><div id="th-ff-ctl"></div><p class="chart-title">Bolus size vs meal-estimate error</p><div id="p-bolus" class="chart short"></div>
    <p class="chart-cap">Linear in the estimate error: a 40 % overestimate gives 40 % more bolus insulin than the ideal static feedforward. Diamond = current setting.</p></div></div></div>

  <div class="grid two" style="margin-top:14px">
    <div class="callout"><h4>Why real systems are harder</h4><ul class="clean">
      <li>The meal appears in the blood instantly here (D(t) jumps at t<sub>meal</sub>); real absorption has its own delay.</li>
      <li>Insulin absorption is lumped into one compartment, I.</li>
      <li>No counter-regulation (no glucagon): once insulin is in, the only “brake” is U = 0, and the model is qualitative below about 40 mg/dL.</li></ul></div>
    <div class="callout"><h4>Glucagon and split-range control (concept only)</h4>
      <p>Because the pump cannot remove insulin, a second manipulated variable that raises glucose would let the loop act in both
      directions: one controller output split into two ranges, insulin above a split point and the counter-acting hormone below it.
      This is the classic split-range idea from the course. It is not modelled here, and no numbers are given.</p></div>
  </div>`;
  buildControls(document.getElementById('th-gain-ctl'), THEORY_SPEC_GAIN, 'th');
  buildControls(document.getElementById('th-ff-ctl'), THEORY_SPEC_FF, 'thff');
  theoryBuilt = true;
}
function renderTheory() {
  if (!theoryBuilt) { buildTheory(); syncControls(); }
  const c = C();
  const { p1, p2, p3, n, V1, G_basal: Gb, I_basal: Ib, U_max } = P;
  const hr = M.halfRule();
  const fs = DATA.fits.fit_sopdt, ff = DATA.fits.fit_fopdt;
  const set = (id, html) => { const el = document.getElementById(id); el.innerHTML = html; renderTex(el); };

  set('th-ode', card({
    title: 'Nonlinear glucose–insulin model (Bequette, in Seborg Ex. 23.3)',
    tex: '\\begin{aligned}\\frac{dG}{dt}&=-p_1G-X\\,(G+G_b)+D(t)\\\\ \\frac{dX}{dt}&=-p_2X+p_3I\\\\ \\frac{dI}{dt}&=-n\\,(I+I_b)+\\frac{U(t)}{V_1}\\end{aligned}',
    units: 'G deviation glucose (mg/dL); X remote insulin effect (1/min); I deviation plasma insulin (mU/L); U pump rate, absolute (mU/min); D meal appearance (mg/dL/min).',
    meaning: 'Insulin I acts on glucose only through the slow “remote” effect X, and X multiplies (G + G_b): a bilinear term, so the process is nonlinear.',
  }));
  set('th-units', card({
    title: 'Units check of p₃',
    tex: ['\\underbrace{\\tfrac{dX}{dt}}_{\\mathrm{min^{-2}}} = p_3\\,\\underbrace{I}_{\\mathrm{mU/L}} \\;\\Rightarrow\\; [p_3] = \\mathrm{\\frac{1}{min^{2}}\\Big/\\frac{mU}{L}}',
      `p_3 = ${sci(p3, 3)}\\ \\mathrm{min^{-2}\\,(mU/L)^{-1}}`],
    units: 'X is a rate (1/min), so dX/dt is 1/min². The textbook prints p₃ in 1/min; dimensional consistency needs the extra 1/min per (mU/L).',
    meaning: 'Checking units is how we catch printing errors before they become simulation errors.',
  }));
  document.getElementById('param-table').innerHTML = `<thead><tr><th>Symbol</th><th>Value</th><th>Units</th><th>Meaning</th><th>Source</th></tr></thead><tbody>${
    Object.entries(DATA.params).map(([k, v]) => `<tr><td><code>${k}</code></td><td class="num">${v.value}</td><td>${esc(v.units)}</td><td>${esc(v.meaning)}</td><td>${esc(short(DATA.sources[v.sourceId] || v.sourceId))}</td></tr>`).join('')}</tbody>`;
  set('th-basal', card({
    title: 'Basal insulin and actuator asymmetry',
    tex: [`U_b = n\\,I_b\\,V_1 = ${n}\\times${Ib}\\times${V1} = ${tf(LM.U_basal, 3)}\\ \\mathrm{mU/min}`,
      `\\frac{U_b-U_{min}}{U_{max}-U_b} = \\frac{${tf(LM.U_basal, 2)}}{${U_max}-${tf(LM.U_basal, 2)}} = ${tf(LM.authorityRatio, 4)}`],
    units: 'mU/min; the ratio is dimensionless.',
    meaning: `At steady state the pump must replace the insulin that is cleared. Downward authority is only ${fmt(LM.authorityRatio * 100, 0)} % of upward authority: the controller can add a lot of insulin but can only cut ${fmt(LM.U_basal, 1)} mU/min.`,
  }));
  set('th-ss', card({
    title: 'Steady state (deviation variables)',
    tex: '\\bar G = \\bar X = \\bar I = 0 \\;\\text{ when }\\; U = U_b,\\; D = 0 \\quad(\\text{i.e. } G_{abs}=G_b=81\\ \\mathrm{mg/dL})',
    units: 'mg/dL, 1/min, mU/L.',
    meaning: 'Deviation variables are measured from the fasting basal state, so the linear model below describes changes around 81 mg/dL.',
  }));
  const A = M.stateSpace().A;
  set('th-abc', card({
    title: 'Linearized state-space model',
    tex: [`A=\\begin{pmatrix}-p_1 & -G_b & 0\\\\ 0 & -p_2 & p_3\\\\ 0&0&-n\\end{pmatrix}=\\begin{pmatrix}${tf(A[0][0], 4)} & ${tf(A[0][1], 0)} & 0\\\\ 0 & ${tf(A[1][1], 4)} & ${sci(p3, 2)}\\\\ 0&0&${tf(A[2][2], 4)}\\end{pmatrix}`,
      `B=\\begin{pmatrix}0\\\\0\\\\1/V_1\\end{pmatrix}=\\begin{pmatrix}0\\\\0\\\\${tf(1 / V1, 4)}\\end{pmatrix},\\quad B_d=\\begin{pmatrix}1\\\\0\\\\0\\end{pmatrix},\\quad C=\\begin{pmatrix}1&0&0\\end{pmatrix}`],
    units: 'A in 1/min (row 1 col 2 in mg/dL); B in 1/L; state x = (G, X, I), input u = U − U_b (mU/min), disturbance D.',
    meaning: 'Linearizing the bilinear term X(G + G_b) at the basal point leaves −G_b·X: near basal, a unit of remote insulin effect removes glucose at 81 mg/dL per min.',
  }));
  set('th-tf', card({
    title: 'Process and disturbance transfer functions',
    tex: [`G_p(s)=\\frac{G(s)}{U'(s)}=\\frac{K_p}{(\\tau_G s+1)(\\tau_X s+1)(\\tau_I s+1)},\\quad K_p=-\\frac{G_b\\,p_3}{V_1\\,p_1p_2n}=${tf(LM.Kp, 4)}`,
      `\\tau_G=\\tfrac1{p_1}=${tf(LM.tauG, 2)},\\;\\tau_X=\\tfrac1{p_2}=${tf(LM.tauX, 2)},\\;\\tau_I=\\tfrac1n=${tf(LM.tauI, 2)}\\ \\mathrm{min}`,
      `G_d(s)=\\frac{G(s)}{D(s)}=\\frac{K_d}{\\tau_G s+1},\\quad K_d=\\tfrac1{p_1}=${tf(LM.Kd, 2)}\\ \\mathrm{min}`],
    units: 'K_p in (mg/dL)/(mU/min); K_d in (mg/dL)/(mg/dL/min) = min; time constants in min.',
    meaning: 'Insulin reaches glucose through three lags (I, then X, then G) while the meal hits G through one lag: the disturbance is faster than the manipulated variable, which is why feedback alone struggles.',
  }));

  // nonlinear gain
  const dU = state.dU;
  const g = M.nonlinearGain(dU);
  set('th-gain', card({
    title: 'Analytic nonlinear steady-state gain',
    tex: ['\\bar I=\\frac{\\Delta U}{n V_1},\\quad \\bar X=\\frac{p_3\\bar I}{p_2},\\quad \\bar G=-\\frac{\\bar X\\,G_b}{p_1+\\bar X},\\quad K(\\Delta U)=\\frac{\\bar G}{\\Delta U}',
      `\\Delta U=${tf(dU, 0)}\\ \\mathrm{mU/min}:\\; K=${tf(g, 4)}\\ \\text{vs. } K_p=${tf(LM.Kp, 4)}\\ \\mathrm{\\tfrac{mg/dL}{mU/min}}`],
    units: 'ΔU in mU/min; gain in (mg/dL)/(mU/min); Ḡ in mg/dL.',
    meaning: `A ${dU >= 0 ? 'rise' : 'cut'} of ${fmt(Math.abs(dU), 0)} mU/min moves steady glucose by ${fmt(g * dU, 1)} mg/dL. Glucose can never go below zero, so large insulin increases have diminishing effect (the gain magnitude falls).`,
  }));
  const dUs = []; for (let u = -16; u <= 98; u += 1) if (u !== 0) dUs.push(u);
  plot('p4', [
    { x: dUs, y: dUs.map(M.nonlinearGain), name: 'Nonlinear K(ΔU)', mode: 'lines', line: { color: c.s1, width: 2 } },
    { x: [-16, 98], y: [LM.Kp, LM.Kp], name: 'Linear Kp', mode: 'lines', line: { color: c.s2, width: 2, dash: 'dash' } },
    { x: [dU], y: [g], name: 'Current ΔU', mode: 'markers', marker: { symbol: 'diamond', size: 13, color: c.text, line: { color: c.surface, width: 2 } } },
  ], baseLayout({ hovermode: 'closest', xaxis: { title: { text: 'ΔU (mU/min)' } }, yaxis: { title: { text: 'gain (mg/dL per mU/min)' } } }));

  set('th-half', card({
    title: 'Skogestad half rule',
    tex: [`\\text{SOPDT: }\\tau_1=${tf(hr.sopdt.tau1, 2)},\\;\\tau_2=\\tau_G+\\tfrac{\\tau_I}{2}=${tf(hr.sopdt.tau2, 2)},\\;\\theta=\\tfrac{\\tau_I}{2}=${tf(hr.sopdt.theta, 2)}`,
      `\\text{FOPDT: }\\tau=\\tau_X+\\tfrac{\\tau_G}{2}=${tf(hr.fopdt.tau, 2)},\\;\\theta=\\tfrac{\\tau_G}{2}+\\tau_I=${tf(hr.fopdt.theta, 2)}`],
    units: 'min; K = K_p = ' + fmt(LM.Kp, 3) + ' (mg/dL)/(mU/min).',
    meaning: 'Sort the lags (35.3, 34.8, 10.8 min); half of the first neglected lag goes to the kept one, the rest becomes apparent dead time.',
  }));
  set('th-fits', card({
    title: 'Least-squares fits (fitted offline by the Python reference)',
    tex: [`\\text{SOPDT: }K=${tf(fs.K, 3)},\\;\\tau_1=\\tau_2=${tf(fs.tau1, 2)},\\;\\theta=${tf(fs.theta, 2)}\\;(\\text{RMSE } ${tf(fs.rmse, 4)})`,
      `\\text{FOPDT: }K=${tf(ff.K, 3)},\\;\\tau=${tf(ff.tau, 2)},\\;\\theta=${tf(ff.theta, 2)}\\;(\\text{RMSE } ${tf(ff.rmse, 4)})`],
    units: 'K in (mg/dL)/(mU/min); τ, θ in min; RMSE in mg/dL for a +1 mU/min step.',
    meaning: 'The fits match the nonlinear step much better than the half rule, and the FOPDT needs a large apparent dead time to mimic three lags. The website does not refit; these numbers come from data.js.',
  }));
  const ts = []; for (let k = 0; k <= 300; k++) ts.push(k * 2);
  const nl = M.simulate({ controller: 'none', U_open_loop: LM.U_basal + dU, meals: [], sensor_delay: 0, t_end: 600 });
  plot('p5', [
    { x: decimate(nl.t, 20), y: decimate(nl.G, 20).map((v) => v - Gb), name: 'Nonlinear', mode: 'lines', line: { color: c.s1, width: 2.5 } },
    { x: ts, y: ts.map((t) => M.linearStep(t, dU)), name: 'Linear 3rd order', mode: 'lines', line: { color: c.s2, width: 2 } },
    { x: ts, y: ts.map((t) => M.sopdtStep(t, hr.sopdt, dU)), name: 'Half-rule SOPDT', mode: 'lines', line: { color: c.s3, width: 2, dash: 'dash' } },
    { x: ts, y: ts.map((t) => M.fopdtStep(t, hr.fopdt, dU)), name: 'Half-rule FOPDT', mode: 'lines', line: { color: c.s4, width: 2, dash: 'dash' } },
    { x: ts, y: ts.map((t) => M.sopdtStep(t, fs, dU)), name: 'Fit SOPDT', mode: 'lines', line: { color: c.s5, width: 2, dash: 'dot' } },
    { x: ts, y: ts.map((t) => M.fopdtStep(t, ff, dU)), name: 'Fit FOPDT', mode: 'lines', line: { color: c.s6, width: 2, dash: 'dot' } },
  ], baseLayout({ xaxis: { title: { text: 'time after step (min)' } }, yaxis: { title: { text: 'ΔG (mg/dL)' } } }));

  set('th-ff', card({
    title: 'Ideal feedforward is improper',
    tex: ['G_f(s)=-\\frac{G_d(s)}{G_p(s)}=-\\frac{K_d}{K_p}\\,(\\tau_X s+1)(\\tau_I s+1)',
      `\\text{static part: } K_f=-\\frac{K_d}{K_p}=\\frac{V_1p_2n}{G_bp_3}=${tf(LM.Kf, 4)}`],
    units: 'K_f in (mU/min) per (mg/dL/min).',
    meaning: 'The ideal G_f has a numerator of order 2 and a denominator of order 0: it would need to predict (differentiate) the meal. It cannot be built, so we keep only its steady-state gain and deliver it as a pulse.',
  }));
  const bol = M.bolusSize({ f_bolus: state.f_bolus, est_error: state.est_error, mult: state.meal_mult });
  set('th-bolus', card({
    title: 'Static feedforward bolus (model quantity)',
    tex: ['B = f\\,K_f\\,(1+\\varepsilon)\\int_0^{\\infty} D\\,dt = f\\,K_f\\,(1+\\varepsilon)\\,\\frac{A\\,m}{k}',
      `B = ${tf(state.f_bolus, 2)}\\times${tf(LM.Kf, 3)}\\times${tf(1 + state.est_error, 2)}\\times\\frac{9\\times${tf(state.meal_mult, 1)}}{0.05} = ${tf(bol, 1)}\\ \\mathrm{mU}`],
    units: 'B in mU of model insulin; A in mg/dL/min; k in 1/min; ∫D dt in mg/dL.',
    meaning: `The bolus cancels the meal’s total glucose load at steady state. It is delivered as fast as the pump allows (up to 115 mU/min), so this bolus takes about ${fmt(bol / (U_max - LM.U_basal), 0)} min on top of basal. Feeds charts P2 and P11 on the Simulator tab.`,
  }));
  const errs = []; for (let k = -50; k <= 80; k += 5) errs.push(k / 100);
  plot('p-bolus', [
    { x: errs.map((x) => x * 100), y: errs.map((x) => M.bolusSize({ f_bolus: state.f_bolus, est_error: x, mult: state.meal_mult })), name: 'Bolus B', mode: 'lines', line: { color: c.s2, width: 2 }, hovertemplate: '%{y:.0f} mU' },
    { x: [state.est_error * 100], y: [bol], name: 'Current', mode: 'markers', marker: { symbol: 'diamond', size: 13, color: c.text, line: { color: c.surface, width: 2 } }, hovertemplate: '%{y:.0f} mU' },
  ], baseLayout({ hovermode: 'closest', showlegend: false, margin: { l: 56, r: 14, t: 10, b: 44 }, xaxis: { title: { text: 'meal-estimate error (%)' } }, yaxis: { title: { text: 'bolus B (mU)' }, rangemode: 'tozero' } }));
}

// ------------------------------------------------------------------ CONTROL DESIGN
let designBuilt = false;
function buildDesign() {
  const root = document.getElementById('design-cards');
  root.innerHTML = `
  <div class="grid two">
    <div class="panel" id="design-ctl"><div class="row" style="margin-top:6px"><button class="btn" id="tauc-guideline">Set τc = θ_total (SIMC guideline)</button></div>
      <p class="chart-cap">Guideline: Skogestad SIMC suggests τc = θ; Rivera et al. suggest τc &gt; 0.8θ [TO VERIFY in Seborg Ch. 12]. The tests and presets use τc = 20 min.</p></div>
    <div id="ds-step1"></div>
  </div>
  <div class="grid two" style="margin-top:14px"><div id="ds-step2"></div><div id="ds-step3"></div></div>
  <div class="grid two" style="margin-top:14px"><div id="ds-pid"></div><div id="ds-aw"></div></div>

  <div class="section"><h2>Closed-loop block diagram (live numbers)</h2></div>
  <div class="panel"><div class="diagram-scroll" id="block-diagram"></div></div>

  <div class="section"><h2>Frequency response and stability margins</h2></div>
  <div class="grid three" id="ds-margins"></div>
  <div class="grid two" style="margin-top:14px">
    <div class="panel"><p class="chart-title">P6 · Bode plot of L(jω)</p><div id="p6" class="chart tall"></div>
      <p class="chart-cap">Top: |L|; bottom: phase. Solid = with the sensor delay; dashed = delay-free. Markers at ω<sub>c</sub>.</p></div>
    <div class="panel"><p class="chart-title">P7 · Nyquist plot of L(jω)</p><div id="p7" class="chart tall"></div>
      <p class="chart-cap">Stable if the curve does not encircle −1 (open loop is stable). The unit circle marks where |L| = 1.</p></div>
  </div>
  <div class="callout"><h4>Sampled-data note</h4><p id="ds-sampled"></p></div>

  <div class="section"><h2>PID vs MPC (precomputed)</h2></div>
  <div class="panel"><div class="row" style="justify-content:space-between"><p class="chart-title" style="margin:0">P9 · PID vs MPC, Ex. 23.6(e) setup</p>
    <select id="mpc-case" aria-label="Meal announcement"><option value="unannounced">Unannounced meal</option><option value="announced">Announced meal</option></select></div>
    <div id="p9" class="chart tall"></div>
    <p class="chart-cap"><b>Computed offline by the Python reference; MPC is not implemented in this website.</b> <span id="mpc-note"></span></p></div>`;
  buildControls(document.getElementById('design-ctl'), DESIGN_SPEC, 'ds');
  document.getElementById('design-ctl').append(document.querySelector('#design-ctl .row'), document.querySelector('#design-ctl .chart-cap'));
  document.getElementById('tauc-guideline').addEventListener('click', () => {
    const th = tuningOf(state).theta_total;
    setState({ tau_c: Math.min(100, Math.max(2, Math.round(th))), tuning_mode: 'imc' }, true);
  });
  document.getElementById('mpc-case').addEventListener('change', (e) => setState({ mpc_case: e.target.value }));
  document.getElementById('mpc-note').textContent = DATA.mpcComparison.note;
  designBuilt = true;
  syncControls();
}

function diagramSVG(e, s) {
  const lbl = (x, y, t, cls = '') => `<text x="${x}" y="${y}" text-anchor="middle" class="${cls}">${esc(t)}</text>`;
  const box = (x, y, w, h, t1, t2) => `<rect class="box" x="${x}" y="${y}" width="${w}" height="${h}" rx="6"/>${lbl(x + w / 2, y + h / 2 - 3, t1)}${t2 ? lbl(x + w / 2, y + h / 2 + 12, t2, 'small') : ''}`;
  const sum = (x, y) => `<circle class="sum" cx="${x}" cy="${y}" r="11"/>${lbl(x, y + 4, 'Σ')}`;
  const arr = (d, cls = '') => `<path class="wire ${cls}" d="${d}" marker-end="url(#ah)"/>`;
  const ctrl = s.controller === 'pid' ? `${s.mode}: Kc=${fmt(e.Kc, 3)}` : 'open loop';
  const ctrl2 = s.controller === 'pid' ? (s.mode === 'P' ? 'no integral' : `τI=${fmt(e.tauI, 1)}${s.mode === 'PID' ? `, τD=${fmt(e.tauD, 1)}` : ''} min`) : 'U = U_b';
  const ffOn = s.ff_enabled;
  const umax = s.saturation ? '[0, 115]' : 'unbounded';
  return `<svg class="diagram" viewBox="0 0 860 270" role="img" aria-label="Closed-loop block diagram: set point, controller, pump saturation, process, disturbance, feedforward and sensor">
  <defs><marker id="ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="currentColor" style="color:var(--text-2)"/></marker></defs>
  ${lbl(30, 145, 'G_sp')}${lbl(30, 160, `${fmt(s.sp_on ? s.sp_val : 81, 0)} mg/dL`, 'small')}
  ${arr('M55,150 L94,150')}${sum(106, 150)}${lbl(96, 175, '−', 'small')}
  ${arr('M117,150 L150,150')}${box(150, 125, 150, 50, ctrl, ctrl2)}
  ${arr('M300,150 L330,150')}${box(330, 125, 100, 50, 'Pump limits', umax + ' mU/min')}
  ${arr('M430,150 L476,150')}${sum(488, 150)}
  ${arr('M499,150 L530,150')}${box(530, 120, 140, 60, 'Gp(s)', `Kp=${fmt(LM.Kp, 2)}, 3 lags`)}
  ${arr('M670,150 L736,150')}${sum(748, 150)}
  ${arr('M759,150 L840,150')}${lbl(830, 140, 'G')}
  ${box(560, 20, 100, 44, 'D(t) meal', `A=9, k=0.05`)}
  ${arr('M660,42 L715,42 L715,75', 'dist')}${box(680, 75, 70, 38, 'Gd(s)', `Kd=${fmt(LM.Kd, 1)}`)}${arr('M748,113 L748,138', 'dist')}
  ${ffOn ? `${arr('M560,42 L420,42 L420,62', 'ff')}${box(370, 62, 100, 40, 'Gff = Kf', `${fmt(LM.Kf, 2)}, t_pre=${fmt(s.t_pre, 0)}`)}${arr('M470,82 L488,82 L488,138', 'ff')}`
    : lbl(450, 50, 'feedforward off', 'small')}
  ${arr('M800,150 L800,235 L520,235')}${box(380, 212, 140, 46, 'Sensor', `e^(−${fmt(s.sensor_delay, 1)}s), Ts=5${s.sensor_lag > 0 ? `, τs=${fmt(s.sensor_lag, 1)}` : ''}`)}
  ${arr('M380,235 L106,235 L106,162')}${lbl(240, 228, 'G_m (sampled every 5 min)', 'small')}
  </svg>`;
}

function renderDesign() {
  if (!designBuilt) buildDesign();
  const c = C();
  const set = (id, html) => { const el = document.getElementById(id); el.innerHTML = html; renderTex(el); };
  const rm = M.reducedModel(state.model);
  const tu = tuningOf(state);
  const e = effective(state);
  const isPI = state.model === 'fit_fopdt_pi' || state.model === 'half_fopdt_pi';
  const src = state.model.startsWith('fit') ? 'least-squares fit (offline, Python reference)' : 'half rule';
  set('ds-step1', card({
    title: 'Step 1 · Reduced model',
    tex: rm.type === 'sopdt'
      ? [`\\tilde G_p(s)=\\frac{K e^{-\\theta_m s}}{(\\tau_1 s+1)(\\tau_2 s+1)}`, `K=${tf(rm.K, 3)},\\;\\tau_1=${tf(rm.tau1, 2)},\\;\\tau_2=${tf(rm.tau2, 2)},\\;\\theta_m=${tf(rm.theta, 2)}`]
      : [`\\tilde G_p(s)=\\frac{K e^{-\\theta_m s}}{\\tau s+1}`, `K=${tf(rm.K, 3)},\\;\\tau=${tf(rm.tau, 2)},\\;\\theta_m=${tf(rm.theta, 2)}`],
    units: 'K in (mg/dL)/(mU/min); τ and θ in min.',
    meaning: `From the ${src}. IMC tuning needs a low-order model with dead time.`,
  }));
  set('ds-step2', card({
    title: 'Step 2 · Total effective dead time',
    tex: `\\theta=\\theta_m+\\theta_s+${state.include_zoh ? '\\tfrac{T_s}{2}' : '0'}=${tf(rm.theta, 2)}+${tf(state.theta_design, 1)}${state.include_zoh ? '+2.5' : ''}=${tf(tu.theta_total, 2)}\\ \\mathrm{min}`,
    units: 'min.',
    meaning: 'The sensor delay assumed in tuning adds directly to the process dead time; the zero-order hold of a 5-min sampler adds about Ts/2 more (off by default).',
  }));
  set('ds-step3', card({
    title: 'Step 3 · IMC tuning (Seborg Table 12.1)',
    tex: rm.type === 'sopdt'
      ? [`K_c=\\frac{\\tau_1+\\tau_2}{K(\\tau_c+\\theta)}=\\frac{${tf(rm.tau1 + rm.tau2, 2)}}{${tf(rm.K, 3)}(${tf(state.tau_c, 0)}+${tf(tu.theta_total, 2)})}=${tf(tu.Kc, 4)}`,
        `\\tau_I=\\tau_1+\\tau_2=${tf(tu.tauI, 2)},\\quad \\tau_D=\\frac{\\tau_1\\tau_2}{\\tau_1+\\tau_2}=${tf(tu.tauD, 2)}`]
      : isPI
        ? [`K_c=\\frac{\\tau}{K(\\tau_c+\\theta)}=\\frac{${tf(rm.tau, 2)}}{${tf(rm.K, 3)}(${tf(state.tau_c, 0)}+${tf(tu.theta_total, 2)})}=${tf(tu.Kc, 4)}`, `\\tau_I=\\tau=${tf(tu.tauI, 2)},\\quad \\tau_D=0`]
        : [`K_c=\\frac{\\tau+\\theta/2}{K(\\tau_c+\\theta/2)}=${tf(tu.Kc, 4)}`, `\\tau_I=\\tau+\\tfrac{\\theta}{2}=${tf(tu.tauI, 2)},\\quad \\tau_D=\\frac{\\tau\\theta}{2\\tau+\\theta}=${tf(tu.tauD, 2)}`],
    units: 'K_c in (mU/min)/(mg/dL); τ_I, τ_D, τ_c in min.',
    meaning: `K_c is negative because insulin lowers glucose (reverse-acting process). Larger τ_c → smaller |K_c| → slower, safer loop. Mode ${state.mode}${state.mode !== 'PID' ? ' drops ' + (state.mode === 'P' ? 'the integral and derivative' : 'the derivative') : ''}. Row numbers in Table 12.1 [TO VERIFY].`,
    extra: state.tuning_mode === 'manual' && fin(state.Kc_man) ? `<div class="callout"><h4>Manual mode: IMC values above are for reference</h4>${T(`\\text{loop uses } K_c=${tf(state.Kc_man, 3)},\\;\\tau_I=${tf(state.tauI_man, 1)},\\;\\tau_D=${tf(state.tauD_man, 1)};\\quad \\frac{K_c}{K_{c,IMC}}=${tf(state.Kc_man / tu.Kc, 2)}`)}<p class="units"><b>Units:</b> K_c in (mU/min)/(mg/dL); τ in min; the ratio is dimensionless.</p><p class="meaning"><b>Meaning:</b> ${state.Kc_man > 0 ? 'K<sub>c</sub> > 0 has the wrong sign for this reverse-acting process: the loop adds insulin when glucose is low.' : state.Kc_man / tu.Kc > 1 ? 'Your loop is more aggressive than the IMC design (larger |K<sub>c</sub>|): faster, but closer to oscillation.' : 'Your loop is gentler than the IMC design (smaller |K<sub>c</sub>|): slower, but more robust to the sensor delay.'}</p></div>` : '',
  }));
  set('ds-pid', card({
    title: 'Discrete PID used in the simulator (every Ts = 5 min)',
    tex: ['P_k=K_c\\left[\\beta(r_k-G_b)-(m_k-G_b)\\right],\\quad D_k=-K_c\\tau_D d_k',
      'd_k=\\alpha d_{k-1}+(1-\\alpha)\\frac{m_k-m_{k-1}}{T_s},\\;\\alpha=\\frac{\\tau_D/N}{\\tau_D/N+T_s}',
      'u_k=U_b+P_k+\\frac{K_c}{\\tau_I}S_k+D_k,\\quad S_k=S_{k-1}+e_kT_s'],
    units: 'u in mU/min; m, r in mg/dL; S in mg/dL·min; T_s = 5 min.',
    meaning: `Derivative acts on the measurement (no kick on set-point steps); β = ${fmt(state.beta, 2)} weights the set point in the proportional term on deviations from basal, so β only changes set-point response, never the steady state.`,
  }));
  const Tt = e.tauD > 0 ? Math.max(Math.sqrt(e.tauI * e.tauD), 5) : e.tauI;
  set('ds-aw', card({
    title: 'Anti-windup (judged on the feedback output only)',
    tex: ['\\text{clamp: } S_k=S_{k-1}\\;\\text{if } u>U_{max},\\,K_ce_k>0 \\text{ or } u<U_{min},\\,K_ce_k<0',
      `\\text{back-calc: } S_k=S_k^{trial}+\\frac{T_s\\tau_I(U_{fb}-u_k)}{K_cT_t},\\;T_t=\\max(\\sqrt{\\tau_I\\tau_D},T_s)=${tf(Tt, 2)}\\ \\mathrm{min}`],
    units: 'S in mg/dL·min; T_t in min.',
    meaning: 'When the pump is pinned at 0 or 115 mU/min, an unchecked integral keeps growing and later causes a deep undershoot; both methods stop that.',
  }));

  document.getElementById('block-diagram').innerHTML = diagramSVG(e, state);

  // margins
  const theta = state.sensor_delay;
  const ok = state.controller === 'pid';
  const mg = ok ? M.margins({ Kc: e.Kc, tauI: e.tauI, tauD: e.tauD, N: e.N, theta }) : null;
  const m0 = ok ? M.margins({ Kc: e.Kc, tauI: e.tauI, tauD: e.tauD, N: e.N, theta: 0 }) : null;
  const mcard = (title, tex, units, meaning) => card({ title, tex, units, meaning });
  const marginsEl = document.getElementById('ds-margins');
  if (!ok) {
    marginsEl.innerHTML = '<div class="card"><h3>Open loop selected</h3><p>Stability margins describe the feedback loop; switch the Simulator to closed loop (PID).</p></div>';
  } else {
    const pmTxt = (x) => (fin(x.PM_deg) ? tf(x.PM_deg, 1) + '^\\circ' : '\\text{no crossover}');
    marginsEl.innerHTML = [
      mcard('Loop transfer function', [`L(j\\omega)=G_c(j\\omega)\\,G_p(j\\omega)\\,e^{-j\\omega\\theta_s}`, `G_c(s)=K_c\\Big[1+\\tfrac{1}{\\tau_I s}+\\tfrac{\\tau_D s}{\\tfrac{\\tau_D}{N}s+1}\\Big]`], 'ω in rad/min; θ_s in min.', 'The full 3rd-order linear model is used here (not the reduced model), with the actual sensor delay.'),
      mcard('Crossover frequency', `\\omega_c=${tf(mg.wc, 4)}\\ \\mathrm{rad/min}\\;(|L(j\\omega_c)|=1)`, 'rad/min; period 2π/ω_c = ' + fmt(2 * Math.PI / mg.wc, 0) + ' min.', 'Roughly the speed of the closed loop: slower than the meal (k = 0.05 1/min).'),
      mcard('Phase margin (with and without the delay)', [`PM=180^\\circ+\\angle L(j\\omega_c)=${pmTxt(mg)}\\ (\\theta_s=${tf(theta, 1)})`, `PM_0=${pmTxt(m0)}\\ (\\text{delay-free})`], 'degrees.', 'The sensor delay eats phase at ω_c: each minute of delay costs ω_c·(180/π) degrees.'),
      mcard('Gain margin', `GM=\\frac{1}{|L(j\\omega_{180})|}=${tf(mg.GM, 2)}`, 'dimensionless (×).', `K_c could be multiplied by ${fmt(mg.GM, 2)} before sustained oscillation (linear, continuous-time estimate).`),
      mcard('Extra delay the loop tolerates', [`\\Delta\\theta_{max}=\\frac{PM\\,[\\mathrm{rad}]}{\\omega_c}=${tf(mg.dtheta_max, 1)}\\ \\mathrm{min}`, `\\theta_s+\\Delta\\theta_{max}=${tf(mg.total_tolerable_delay, 1)}\\ \\mathrm{min}`], 'min.', 'More sensor delay than this (at fixed tuning) makes the continuous loop unstable.'),
    ].join('');
    renderTex(marginsEl);
  }
  const ed = DATA.empiricalDelay;
  document.getElementById('ds-sampled').innerHTML = `The margins above treat the controller as continuous. Sampling every 5 min with a zero-order hold adds about Ts/2 = 2.5 min of lag, and the discrete derivative adds more, so the real limit is lower. The Python reference found sustained oscillation in the sampled nonlinear loop at a sensor delay of ${fmt(ed.design_theta_s_10.value, 1)} min for the θs = 10 design (continuous estimate ${fmt(ed.design_theta_s_10.continuous_estimate, 1)} min) and ${fmt(ed.design_theta_s_0.value, 1)} min for the θs = 0 design (continuous ${fmt(ed.design_theta_s_0.continuous_estimate, 1)} min); τc = 20, unbounded pump.`;

  // P6 Bode, P7 Nyquist
  if (ok) {
    const ws = []; for (let k = 0; k <= 300; k++) ws.push(10 ** (-4 + 4 * k / 300));
    const args = { Kc: e.Kc, tauI: e.tauI, tauD: e.tauD, N: e.N };
    const L1 = ws.map((w) => M.loopFreq(w, { ...args, theta }));
    const L0 = ws.map((w) => M.loopFreq(w, { ...args, theta: 0 }));
    const deg = (x) => x * 180 / Math.PI;
    const tr = [
      { x: ws, y: L1.map((l) => l.mag), name: `|L|, θs=${fmt(theta, 1)}`, mode: 'lines', line: { color: c.s1, width: 2 }, xaxis: 'x', yaxis: 'y' },
      { x: ws, y: L1.map((l) => deg(l.phase)), name: `phase, θs=${fmt(theta, 1)}`, mode: 'lines', line: { color: c.s1, width: 2 }, xaxis: 'x2', yaxis: 'y2', showlegend: false },
      { x: ws, y: L0.map((l) => deg(l.phase)), name: 'delay-free', mode: 'lines', line: { color: c.s2, width: 2, dash: 'dash' }, xaxis: 'x2', yaxis: 'y2' },
    ];
    if (fin(mg.wc)) {
      tr.push({ x: [mg.wc], y: [1], name: 'ω_c', mode: 'markers', marker: { size: 10, symbol: 'diamond', color: c.text }, xaxis: 'x', yaxis: 'y', showlegend: false });
      tr.push({ x: [mg.wc], y: [deg(M.loopFreq(mg.wc, { ...args, theta }).phase)], name: 'PM point', mode: 'markers', marker: { size: 10, symbol: 'diamond', color: c.text }, xaxis: 'x2', yaxis: 'y2', showlegend: false });
    }
    const lay = baseLayout({
      hovermode: 'closest',
      grid: { rows: 2, columns: 1, roworder: 'top to bottom' },
      xaxis: { type: 'log', domain: [0, 1], anchor: 'y', showticklabels: false },
      yaxis: { type: 'log', domain: [0.55, 1], title: { text: '|L|' } },
      xaxis2: { type: 'log', domain: [0, 1], anchor: 'y2', matches: 'x', title: { text: 'ω (rad/min)' } },
      yaxis2: { domain: [0, 0.45], title: { text: 'phase (deg)' }, range: [-400, 0] },
      shapes: [
        { type: 'line', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: 1, y1: 1, line: { color: c.muted, width: 1, dash: 'dot' } },
        { type: 'line', xref: 'paper', yref: 'y2', x0: 0, x1: 1, y0: -180, y1: -180, line: { color: c.muted, width: 1, dash: 'dot' } },
      ],
    });
    plot('p6', tr, lay);
    const wn = ws.filter((w) => w >= 3e-3);
    const ny = (th) => wn.map((w) => M.loopFreq(w, { ...args, theta: th })).map((l) => [l.mag * Math.cos(l.phase), l.mag * Math.sin(l.phase)]);
    const n1 = ny(theta), n0 = ny(0);
    const circ = Array.from({ length: 121 }, (_, k) => [Math.cos(k * Math.PI / 60), Math.sin(k * Math.PI / 60)]);
    plot('p7', [
      { x: circ.map((p) => p[0]), y: circ.map((p) => p[1]), name: 'unit circle', mode: 'lines', line: { color: c.muted, width: 1, dash: 'dot' }, hoverinfo: 'skip' },
      { x: n1.map((p) => p[0]), y: n1.map((p) => p[1]), name: `L, θs=${fmt(theta, 1)}`, mode: 'lines', line: { color: c.s1, width: 2 } },
      { x: n0.map((p) => p[0]), y: n0.map((p) => p[1]), name: 'delay-free', mode: 'lines', line: { color: c.s2, width: 2, dash: 'dash' } },
      { x: [-1], y: [0], name: '−1 point', mode: 'markers', marker: { symbol: 'x', size: 12, color: c.crit } },
    ], baseLayout({ hovermode: 'closest', xaxis: { title: { text: 'Re L' }, range: [-2.5, 1], zeroline: true, zerolinecolor: c.grid }, yaxis: { title: { text: 'Im L' }, range: [-2.5, 1], zeroline: true, zerolinecolor: c.grid, scaleanchor: 'x' } }));
  } else {
    plot('p6', [], baseLayout({ annotations: [{ text: 'Open loop selected: no feedback loop to analyse', showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5 }], xaxis: { visible: false }, yaxis: { visible: false } }));
    plot('p7', [], baseLayout({ annotations: [{ text: 'Open loop selected', showarrow: false, xref: 'paper', yref: 'paper', x: 0.5, y: 0.5 }], xaxis: { visible: false }, yaxis: { visible: false } }));
  }

  // P9 PID vs MPC
  const mc = DATA.mpcComparison;
  const cs = mc[state.mpc_case];
  document.getElementById('mpc-case').value = state.mpc_case;
  plot('p9', [
    { x: mc.t, y: cs.pid.G_true, name: 'PID: glucose', mode: 'lines', line: { color: c.s1, width: 2 }, xaxis: 'x', yaxis: 'y' },
    { x: mc.t, y: cs.mpc.G_true, name: 'MPC: glucose', mode: 'lines', line: { color: c.s2, width: 2 }, xaxis: 'x', yaxis: 'y' },
    { x: mc.t, y: cs.pid.U, name: 'PID: U', mode: 'lines', line: { color: c.s1, width: 1.5, dash: 'dot' }, xaxis: 'x2', yaxis: 'y2', showlegend: false },
    { x: mc.t, y: cs.mpc.U, name: 'MPC: U', mode: 'lines', line: { color: c.s2, width: 1.5, dash: 'dot' }, xaxis: 'x2', yaxis: 'y2', showlegend: false },
  ], baseLayout({
    shapes: [{ type: 'rect', xref: 'paper', yref: 'y', x0: 0, x1: 1, y0: P.band_low, y1: P.band_high, fillcolor: c.band, line: { width: 0 }, layer: 'below' }],
    xaxis: { domain: [0, 1], anchor: 'y', showticklabels: false }, yaxis: { domain: [0.42, 1], title: { text: 'G (mg/dL)' } },
    xaxis2: { domain: [0, 1], anchor: 'y2', matches: 'x', title: { text: 'time (min)' } }, yaxis2: { domain: [0, 0.34], title: { text: 'U (mU/min)' }, rangemode: 'tozero' },
  }));
}

// ------------------------------------------------------------------ REFERENCES
function renderRefs() {
  document.getElementById('ref-list').innerHTML = Object.entries(DATA.sources).map(([k, v]) => `<li><code>${esc(k)}</code>: ${esc(v)}</li>`).join('');
}

// ------------------------------------------------------------------ OVERVIEW (story + 3D pancreas)
// Every number on the Overview is computed here from the engine (simulate, metrics, linearModel, margins) or DATA.
const OV = {};
function ovData() {
  if (OV.data) return OV.data;
  const base = M.simulate({});
  const pre = M.simulate({ ff_enabled: true, t_pre: 15 });
  const d = M.DEFAULT_INPUTS;
  OV.data = {
    base, pre, mBase: M.metrics(base), mPre: M.metrics(pre),
    mg: M.margins({ Kc: d.Kc, tauI: d.tauI, tauD: d.tauD, N: d.N, theta: d.sensor_delay }),
    sampled: DATA.empiricalDelay.design_theta_s_10.value,
  };
  return OV.data;
}
// line chart in SVG user units; returns markup + scales
function svgChart({ W, H, pad, tmax, ymin, ymax, series, band = true, xticks = [], yticks = [], xlab = '', ylab = '' }) {
  const X = (t) => pad.l + (t / tmax) * (W - pad.l - pad.r);
  const Y = (y) => pad.t + (1 - (y - ymin) / (ymax - ymin)) * (H - pad.t - pad.b);
  let s = '';
  if (band) s += `<rect class="svg-band" x="${X(0)}" y="${Y(P.band_high)}" width="${X(tmax) - X(0)}" height="${Y(P.band_low) - Y(P.band_high)}"/>`;
  for (const y of yticks) s += `<line class="svg-grid" x1="${X(0)}" x2="${X(tmax)}" y1="${Y(y)}" y2="${Y(y)}"/><text class="svg-tick" x="${X(0) - 8}" y="${Y(y) + 4}" text-anchor="end">${y}</text>`;
  for (const t of xticks) s += `<text class="svg-tick" x="${X(t)}" y="${H - pad.b + 16}" text-anchor="middle">${t}</text>`;
  if (xticks.length) s += `<line class="svg-axis" x1="${X(0)}" x2="${X(tmax)}" y1="${H - pad.b}" y2="${H - pad.b}"/>`;
  if (xlab) s += `<text class="svg-tick" x="${X(tmax)}" y="${H - 4}" text-anchor="end">${xlab}</text>`;
  if (ylab) s += `<text class="svg-tick" x="${X(0) - 8}" y="${pad.t - 8}" text-anchor="end">${ylab}</text>`;
  for (const se of series) {
    const step = se.step || 10;
    let d = '';
    for (let i = 0; i < se.t.length; i += step) {
      if (!fin(se.y[i])) continue;
      d += `${d ? 'L' : 'M'}${X(se.t[i]).toFixed(1)},${Y(se.y[i]).toFixed(1)}`;
    }
    s += `<path class="${se.cls}" d="${d}"/>`;
  }
  return { s, X, Y };
}
const metricHTML = (v, unit, label, cls = '') => `<div class="metric ${cls}"><div class="mv">${v}<small>${unit}</small></div><div class="ml">${label}</div></div>`;

function buildOverview() {
  const D = ovData();
  const { base, pre, mBase, mPre, mg, sampled } = D;
  const tEnd = base.t[base.t.length - 1];

  // hero trace (true glucose of the default run + band); playhead moved by animateHero()
  const ht = svgChart({ W: 320, H: 120, pad: { l: 2, r: 2, t: 6, b: 6 }, tmax: tEnd, ymin: 30, ymax: 180, series: [{ t: base.t, y: base.G, cls: 'svg-g', step: 20 }] });
  document.getElementById('hero-trace').innerHTML = `${ht.s}<line id="hero-ph" class="svg-playhead" x1="0" x2="0" y1="0" y2="120"/><circle id="hero-dot" class="svg-dot" r="4.5" cx="0" cy="0"/>`;
  OV.heroScale = ht;

  // chapter 1: feedback only
  const c1 = svgChart({ W: 480, H: 260, pad: { l: 40, r: 14, t: 26, b: 34 }, tmax: tEnd, ymin: 30, ymax: 180, xticks: [0, 120, 240, 360, 480, 600], yticks: [50, 100, 150], xlab: 'time (min)', ylab: 'mg/dL',
    series: [{ t: base.t, y: base.Gm.map((v) => (v === null ? NaN : v)), cls: 'svg-gm', step: 5 }, { t: base.t, y: base.G, cls: 'svg-g', step: 5 }] });
  const ip = base.G.indexOf(mBase.peak), inad = base.G.indexOf(mBase.nadir);
  document.getElementById('ch-late-svg').innerHTML = c1.s +
    `<circle class="svg-dot" cx="${c1.X(base.t[ip])}" cy="${c1.Y(mBase.peak)}" r="4.5"/><text class="svg-label" x="${c1.X(base.t[ip]) + 10}" y="${c1.Y(mBase.peak) + 4}">peak ${fmt(mBase.peak, 1)}</text>` +
    `<circle class="svg-dot" cx="${c1.X(base.t[inad])}" cy="${c1.Y(mBase.nadir)}" r="4.5"/><text class="svg-label" x="${c1.X(base.t[inad]) + 10}" y="${c1.Y(mBase.nadir) + 14}">nadir ${fmt(mBase.nadir, 1)}</text>` +
    `<text class="svg-label" x="${c1.X(tEnd) - 4}" y="${c1.Y(P.band_high) - 6}" text-anchor="end">54–144 band</text>` +
    `<line class="svg-g" x1="270" x2="292" y1="16" y2="16"/><text class="svg-tick" x="298" y="20">true glucose</text><line class="svg-gm" x1="392" x2="414" y1="16" y2="16"/><text class="svg-tick" x="420" y="20">sensor</text>`;
  document.getElementById('ch-late-metrics').innerHTML =
    metricHTML(fmt(mBase.peak, 1), 'mg/dL', 'peak, above the 144 limit', mBase.peak >= P.band_high ? 'bad' : '') +
    metricHTML(fmt(mBase.nadir, 1), 'mg/dL', 'nadir, below the 54 limit', mBase.nadir <= P.band_low ? 'bad' : '') +
    metricHTML(fmt(mBase.pct_in_band, 1), '%', 'of the time inside the band');

  // chapter 2: lopsided pump authority around the basal rate
  const up = P.U_max - LM.U_basal, down = LM.U_basal - P.U_min;
  const AX = (u) => 40 + (u / P.U_max) * 400;
  document.getElementById('ch-auth-svg').innerHTML =
    `<text class="svg-tick" x="40" y="44">0</text><text class="svg-tick" x="440" y="44" text-anchor="end">${fmt(P.U_max, 0)} mU/min</text>` +
    `<rect x="${AX(0)}" y="60" width="${AX(P.U_max) - AX(0)}" height="56" rx="10" fill="var(--surface-elev)"/>` +
    `<rect x="${AX(0)}" y="60" width="${AX(LM.U_basal) - AX(0)}" height="56" rx="10" fill="var(--crit-soft)" stroke="var(--crit)" stroke-width="1.2"/>` +
    `<rect x="${AX(LM.U_basal)}" y="60" width="${AX(P.U_max) - AX(LM.U_basal)}" height="56" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="1.2"/>` +
    `<line x1="${AX(LM.U_basal)}" x2="${AX(LM.U_basal)}" y1="48" y2="128" stroke="var(--text)" stroke-width="2"/>` +
    `<text class="svg-label-strong" x="${AX(LM.U_basal)}" y="150" text-anchor="middle">basal ${fmt(LM.U_basal, 1)}</text>` +
    `<text class="svg-label" x="${(AX(LM.U_basal) + AX(P.U_max)) / 2}" y="93" text-anchor="middle">can add ${fmt(up, 1)} mU/min</text>` +
    `<text class="svg-label" x="${AX(0) + 4}" y="190">can remove only ${fmt(down, 1)} mU/min (the pump can't go below 0)</text>` +
    `<path d="M${AX(LM.U_basal) - 4},176 L${AX(0) + 8},176" stroke="var(--crit)" stroke-width="1.6" fill="none" marker-end="url(#arr)"/>` +
    `<defs><marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--crit)"/></marker></defs>`;
  document.getElementById('ch-auth-metrics').innerHTML =
    metricHTML(`+${fmt(up, 1)}`, 'mU/min', 'room to add insulin above basal', 'good') +
    metricHTML(`−${fmt(down, 1)}`, 'mU/min', 'room to remove it', 'bad') +
    metricHTML(fmt(LM.authorityRatio, 2), '', 'down ÷ up authority ratio');

  // chapter 3: feedback only vs 15-min pre-bolus
  const c3 = svgChart({ W: 480, H: 260, pad: { l: 40, r: 14, t: 26, b: 34 }, tmax: tEnd, ymin: 30, ymax: 180, xticks: [0, 120, 240, 360, 480, 600], yticks: [50, 100, 150], xlab: 'time (min)', ylab: 'mg/dL',
    series: [{ t: base.t, y: base.G, cls: 'svg-alt', step: 5 }, { t: pre.t, y: pre.G, cls: 'svg-g', step: 5 }] });
  document.getElementById('ch-ff-svg').innerHTML = c3.s +
    `<line class="svg-alt" x1="250" x2="272" y1="16" y2="16"/><text class="svg-tick" x="278" y="20">feedback only</text><line class="svg-g" x1="370" x2="392" y1="16" y2="16"/><text class="svg-tick" x="398" y="20">+ pre-bolus</text>`;
  document.getElementById('ch-ff-metrics').innerHTML =
    metricHTML(fmt(mPre.peak, 1), 'mg/dL', `peak (was ${fmt(mBase.peak, 1)})`, 'good') +
    metricHTML(fmt(mPre.nadir, 1), 'mg/dL', `nadir (was ${fmt(mBase.nadir, 1)})`, 'good') +
    metricHTML(fmt(mPre.pct_in_band, 1), '%', 'of the time inside the band');

  // chapter 4: delay axis — current sensor delay vs tolerable delay (continuous) and the sampled limit
  const dmax = 60, DX = (d) => 40 + (d / dmax) * 400;
  const cont = mg.total_tolerable_delay, theta = M.DEFAULT_INPUTS.sensor_delay;
  let ticks = '';
  for (let d = 0; d <= dmax; d += 10) ticks += `<line class="svg-grid" x1="${DX(d)}" x2="${DX(d)}" y1="70" y2="150"/><text class="svg-tick" x="${DX(d)}" y="172" text-anchor="middle">${d}</text>`;
  document.getElementById('ch-stab-svg').innerHTML = ticks +
    `<rect x="${DX(0)}" y="96" width="${DX(sampled) - DX(0)}" height="28" rx="8" fill="var(--accent-soft)"/>` +
    `<rect x="${DX(sampled)}" y="96" width="${DX(cont) - DX(sampled)}" height="28" fill="var(--warn-soft)"/>` +
    `<rect x="${DX(cont)}" y="96" width="${DX(dmax) - DX(cont)}" height="28" rx="8" fill="var(--crit-soft)"/>` +
    `<line x1="${DX(theta)}" x2="${DX(theta)}" y1="84" y2="136" stroke="var(--text)" stroke-width="2.5"/>` +
    `<text class="svg-label-strong" x="${DX(theta)}" y="76" text-anchor="middle">sensor ${fmt(theta, 0)} min</text>` +
    `<line x1="${DX(sampled)}" x2="${DX(sampled)}" y1="90" y2="130" stroke="var(--warn)" stroke-width="2"/>` +
    `<text class="svg-label" x="${DX(sampled) - 4}" y="146" text-anchor="end">sampled ${fmt(sampled, 1)}</text>` +
    `<line x1="${DX(cont)}" x2="${DX(cont)}" y1="90" y2="130" stroke="var(--crit)" stroke-width="2"/>` +
    `<text class="svg-label" x="${DX(cont) + 4}" y="146">continuous ${fmt(cont, 1)}</text>` +
    `<text class="svg-tick" x="${DX(dmax)}" y="196" text-anchor="end">total delay in the loop (min)</text>` +
    `<text class="svg-label" x="${DX(2)}" y="230">stable</text><text class="svg-label" x="${DX(dmax) - 2}" y="230" text-anchor="end">sustained oscillation</text>`;
  document.getElementById('ch-stab-metrics').innerHTML =
    metricHTML(`${fmt(mg.PM_deg, 1)}°`, '', 'phase margin with the 10-min sensor delay') +
    metricHTML(fmt(cont, 1), 'min', 'tolerable delay, continuous estimate') +
    metricHTML(fmt(sampled, 1), 'min', 'limit in the sampled loop (Python reference)');

  buildLoop();
  initOrganUI();
}

// interactive loop diagram (numbers from DATA / the engine)
function buildLoop() {
  const d = M.DEFAULT_INPUTS;
  const nodes = [
    { k: 'controller', t: 'Controller', s: 'discrete PID', x: 90, y: 180, role: 'Controller',
      p: `Discrete PID, IMC-tuned with τc = 20 min: Kc = ${fmt(d.Kc, 3)} (mU/min)/(mg/dL), τI = ${fmt(d.tauI, 1)} min, τD = ${fmt(d.tauD, 1)} min. It runs every ${fmt(P.Ts, 0)} min.` },
    { k: 'pump', t: 'Pump', s: `0–${fmt(P.U_max, 0)} mU/min`, x: 210, y: 60, role: 'Final control element',
      p: `Sets the insulin infusion rate U between ${fmt(P.U_min, 0)} and ${fmt(P.U_max, 0)} mU/min; the basal rate is ${fmt(LM.U_basal, 1)} mU/min.` },
    { k: 'insulin', t: 'Insulin', s: 'two lags', x: 430, y: 60, role: 'Manipulated path',
      p: `Plasma insulin I acts through the remote effect X: two lags with time constants τI = ${fmt(LM.tauI, 1)} min and τX = ${fmt(LM.tauX, 1)} min.` },
    { k: 'glucose', t: 'Glucose', s: 'the process', x: 550, y: 180, role: 'Process',
      p: `The controlled variable: the three-state nonlinear model of Seborg Ex. 23.3 (glucose, remote insulin effect, plasma insulin), basal ${fmt(P.G_basal, 0)} mg/dL. Target band ${fmt(P.band_low, 0)}–${fmt(P.band_high, 0)} mg/dL.` },
    { k: 'sensor', t: 'Sensor', s: `every ${fmt(P.Ts, 0)} min`, x: 320, y: 300, role: 'Measurement',
      p: `A glucose sensor sampled every ${fmt(P.Ts, 0)} min that reports with a ${fmt(P.sensor_delay, 0)}-min delay: the controller always sees the past.` },
  ];
  const meal = { k: 'meal', t: 'Meal', s: 'disturbance', x: 560, y: 46, role: 'Disturbance',
    p: `D(t) = A·e^(−kt) with A = ${fmt(P.meal_A, 0)} mg/dL/min and k = ${fmt(P.meal_k, 2)} 1/min: glucose appears in the blood faster than insulin can act.` };
  const all = [...nodes, meal];
  const box = (n) => `<g class="node" data-k="${n.k}" tabindex="0" role="button" aria-label="${n.t}: ${n.role}">
    <rect x="${n.x - 62}" y="${n.y - 26}" width="124" height="52" rx="14"/>
    <text class="nt" x="${n.x}" y="${n.y - 2}" text-anchor="middle">${n.t}</text><text class="ns" x="${n.x}" y="${n.y + 15}" text-anchor="middle">${n.s}</text></g>`;
  const svg = document.getElementById('loop-svg');
  svg.innerHTML = `<ellipse class="ring" cx="320" cy="180" rx="230" ry="120"/><ellipse class="flow" cx="320" cy="180" rx="230" ry="120" transform="rotate(180 320 180)"/>
    <path d="M560,72 L556,140" stroke="var(--warn)" stroke-width="2" fill="none" marker-end="url(#arrw)"/>
    <defs><marker id="arrw" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--warn)"/></marker></defs>
    <text class="center" x="320" y="176" text-anchor="middle">closed loop</text><text class="center" x="320" y="196" text-anchor="middle">feedback</text>
    ${all.map(box).join('')}`;
  const info = document.getElementById('loop-info');
  const show = (k) => {
    const n = all.find((x) => x.k === k);
    svg.querySelectorAll('.node').forEach((g) => g.classList.toggle('active', g.dataset.k === k));
    info.innerHTML = `<p class="role">${n.role}</p><h4>${n.t}</h4><p>${esc(n.p)}</p>`;
  };
  svg.querySelectorAll('.node').forEach((g) => {
    g.addEventListener('click', () => show(g.dataset.k));
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show(g.dataset.k); } });
  });
  show('glucose');
}

// 3D pancreas: hero viewer (driven by the default run's U(t)) + full viewer with tools and hotspots
const ORGAN_TEXT = {
  null: ['Pancreas', 'Select a label on the model to explore its parts. The anatomy is real, segmented 3D data (BodyParts3D); the glowing islets are schematic.'],
  head: ['Head', 'The widest part, lying in the C-shaped curve of the duodenum (switch on Duodenum to see it).'],
  neck: ['Neck', 'The short, narrow part joining the head to the body.'],
  body: ['Body', 'The main length of the gland, running across the abdomen behind the stomach.'],
  tail: ['Tail', 'The narrow end, reaching toward the spleen.'],
  duct: ['Main pancreatic duct', 'Runs along the gland and drains into the duodenum. Shown alone, with the rest of the pancreas faded.'],
};
const ISLET_NOTE = 'Islets (schematic): small clusters of cells scattered through the pancreas whose β-cells release insulin when glucose rises — the body\'s own glucose controller, which an artificial pancreas replaces with a sensor, an algorithm and a pump. [Seborg et al., Ch. 23 — TO VERIFY]';
function organInfo(key) {
  const [h, p] = ORGAN_TEXT[key] || ORGAN_TEXT.null;
  document.getElementById('organ-info').innerHTML = `<h4>${h}</h4><p>${p}</p><p class="src">${ISLET_NOTE}</p>`;
  document.getElementById('organ-crumb').innerHTML = `Abdomen <span aria-hidden="true">›</span> Pancreas${key ? ` <span aria-hidden="true">›</span> ${h}` : ''}`;
}
function initOrganUI() {
  organInfo(null);
  document.getElementById('ov-explore').addEventListener('click', () => document.getElementById('organ').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const rail = document.querySelector('#organ-viewer .viewer-rail');
  rail.addEventListener('click', (e) => {
    const b = e.target.closest('.tool');
    if (!b || !OV.organ) return;
    const t = b.dataset.tool;
    if (t === 'zoom-in') OV.organ.zoom(0.85);
    else if (t === 'zoom-out') OV.organ.zoom(1 / 0.85);
    else if (t === 'reset') { OV.organ.reset(); rail.querySelectorAll('[aria-pressed]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tool === 'rotate' && OV.organ.rotating))); }
    else {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      OV.organ.setTool(t, on);
    }
  });
}
async function initViewers() {
  if (OV.started) return;
  OV.started = true;
  let mod;
  try { mod = await import('./pancreas.js'); } catch (e) { console.warn('3D viewer unavailable', e); return; }
  try {
    OV.hero = await mod.createPancreasViewer(document.getElementById('hero-stage'), { mode: 'hero' });
  } catch (e) { console.warn('hero viewer failed', e); }
  animateHero();
  const organStage = document.getElementById('organ-stage');
  const startOrgan = async () => {
    if (OV.organ !== undefined) return;
    OV.organ = null;
    try {
      OV.organ = await mod.createPancreasViewer(organStage, {
        mode: 'full',
        onSelect: (k) => {
          organInfo(k);
          if (k === 'duct') document.querySelector('.tool[data-tool="isolate"]').setAttribute('aria-pressed', 'true');
        },
        onLowPower: () => document.querySelector('.tool[data-tool="rotate"]').setAttribute('aria-pressed', 'false'),
      });
      // the Rotate button shows what the viewer actually does (off under reduced motion or on a software renderer)
      if (OV.organ) document.querySelector('.tool[data-tool="rotate"]').setAttribute('aria-pressed', String(OV.organ.rotating));
    } catch (e) { console.warn('organ viewer failed', e); }
  };
  new IntersectionObserver((es, obs) => { if (es.some((x) => x.isIntersecting)) { obs.disconnect(); startOrgan(); } }, { rootMargin: '600px' }).observe(organStage);
}
// hero playhead: loops over the default run; islet glow follows U(t)
function animateHero() {
  const { base } = ovData();
  const N = base.t.length;
  const uMax = Math.max(...base.U);
  const ph = document.getElementById('hero-ph'), dot = document.getElementById('hero-dot'), out = document.getElementById('hero-readout');
  const S = OV.heroScale;
  const setAt = (i) => {
    const t = base.t[i], g = base.G[i], u = base.U[i];
    ph.setAttribute('x1', S.X(t)); ph.setAttribute('x2', S.X(t));
    dot.setAttribute('cx', S.X(t)); dot.setAttribute('cy', S.Y(g));
    out.innerHTML = `t = <b>${fmt(t, 0)}</b> min · G = <b>${fmt(g, 1)}</b> mg/dL · U = <b>${fmt(u, 1)}</b> mU/min`;
    if (OV.hero) OV.hero.setActivity(u / uMax);
  };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const iPeak = base.G.indexOf(ovData().mBase.peak);
  if (reduced) { setAt(iPeak); return; }
  const PERIOD = 14000;
  const t0 = performance.now();
  const loop = (now) => {
    OV.heroRaf = requestAnimationFrame(loop);
    if (activeTab !== 'overview' || document.hidden) return;
    const f = ((((now - t0) % PERIOD) + PERIOD) % PERIOD) / PERIOD; // rAF time can precede t0 on the first frame
    setAt(Math.max(0, Math.min(N - 1, Math.floor(f * N))));
  };
  setAt(iPeak);
  OV.heroRaf = requestAnimationFrame(loop);
}
function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}

// ------------------------------------------------------------------ tabs, init
// sliding pill behind the active tab (CSS reads --ind-x / --ind-w on the nav)
function positionIndicator(animate = true) {
  const nav = document.querySelector('.tabs');
  const btn = nav && nav.querySelector('[role="tab"][aria-selected="true"]');
  if (!btn) return;
  nav.classList.toggle('no-anim', !animate);
  nav.style.setProperty('--ind-x', `${btn.offsetLeft}px`);
  nav.style.setProperty('--ind-w', `${btn.offsetWidth}px`);
  // keep the active tab visible in the scrollable strip (narrow screens), without moving the page
  const left = btn.offsetLeft - nav.scrollLeft, right = left + btn.offsetWidth;
  if (left < 0 || right > nav.clientWidth) nav.scrollTo({ left: btn.offsetLeft - (nav.clientWidth - btn.offsetWidth) / 2, behavior: animate ? 'smooth' : 'auto' });
}
function showTab(tab, focus = false, user = false) {
  if (!document.getElementById(`panel-${tab}`)) tab = 'overview';
  const changed = tab !== activeTab;
  activeTab = tab;
  document.querySelectorAll('[role="tab"]').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    if (on && focus) b.focus();
  });
  document.querySelectorAll('[role="tabpanel"]').forEach((p) => { p.hidden = p.id !== `panel-${tab}`; });
  positionIndicator(user);
  if (user && changed) {
    window.scrollTo({ top: 0, behavior: 'auto' }); // each page opens at its top, with the disclaimer strip in view
    const panel = document.getElementById(`panel-${tab}`);
    panel.classList.remove('enter'); void panel.offsetWidth; panel.classList.add('enter');
  }
  if (location.hash !== `#${tab}`) history.replaceState(null, '', `#${tab}`);
  const jb = document.getElementById('jump-btn');
  if (jb) jb.hidden = tab !== 'simulator';
  renderTab(tab);
  if (tab === 'overview') initViewers();
  if (HAS_PLOTLY) document.querySelectorAll(`#panel-${tab} .js-plotly-plot`).forEach((el) => window.Plotly.Plots.resize(el));
}

function init() {
  const libw = [];
  if (!HAS_PLOTLY) libw.push('The chart library (Plotly) could not be loaded, so charts are not shown. Check the network connection and reload.');
  if (!HAS_KATEX) libw.push('The equation library (KaTeX) could not be loaded, so equations are shown as plain LaTeX.');
  document.getElementById('lib-warning').innerHTML = libw.map((x) => `<p class="warn">⚠ ${x}</p>`).join('');

  buildControls(document.getElementById('sim-preset-slot'), SIM_PRESET_SPEC, 'sim');
  buildControls(document.getElementById('sim-controls'), SIM_SPEC, 'sim');
  document.getElementById('sim-reset').addEventListener('click', () => applyPreset('default'));
  const helpBtn = document.getElementById('sim-help-btn');
  helpBtn.addEventListener('click', () => {
    const open = helpBtn.getAttribute('aria-expanded') !== 'true';
    helpBtn.setAttribute('aria-expanded', String(open));
    document.getElementById('sim-help').hidden = !open;
  });
  // the long metrics table starts closed on phones
  if (window.matchMedia('(max-width: 900px)').matches) document.getElementById('metrics-details').open = false;
  linkTimeAxes(['p1', 'p2', 'p3']);
  syncControls();
  document.getElementById('band-select').addEventListener('change', (e) => setState({ band: e.target.value }));
  document.getElementById('save-run').addEventListener('click', () => {
    if (!lastResult || savedRuns.length >= 4) return;
    const mm = M.metrics(lastResult);
    savedRuns.push({ label: presetLabel(), t: decimate(lastResult.t), G: decimate(lastResult.G), peak: mm.peak, nadir: mm.nadir });
    renderSaved();
  });
  document.getElementById('clear-runs').addEventListener('click', () => { savedRuns = []; renderSaved(); });
  document.getElementById('saved-list').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-rm]');
    if (!b) return;
    savedRuns.splice(+b.dataset.rm, 1);
    renderSaved();
  });

  // phones: one floating button that jumps to the controls, or back to the charts while the controls are in view
  const jump = document.getElementById('jump-btn');
  const ctlPanel = document.getElementById('sim-controls');
  let ctlInView = false;
  const setJump = () => { jump.textContent = ctlInView ? '↑ Charts' : '⚙ Controls'; };
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => { ctlInView = entries.some((en) => en.isIntersecting); setJump(); }, { threshold: 0.05 }).observe(ctlPanel);
  }
  jump.addEventListener('click', () => {
    const target = ctlInView ? document.getElementById('sim-top') : ctlPanel;
    // the simulator page is long: jump instantly over long distances, glide over short ones
    const far = Math.abs(target.getBoundingClientRect().top) > 2500;
    target.scrollIntoView({ behavior: far ? 'auto' : 'smooth', block: 'start' });
  });

  const tabs = [...document.querySelectorAll('[role="tab"]')];
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => showTab(b.dataset.tab, false, true));
    b.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        const j = (i + (ev.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        showTab(tabs[j].dataset.tab, true, true);
      }
    });
  });
  document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => { showTab(b.dataset.goto, false, true); window.scrollTo(0, 0); }));
  window.addEventListener('hashchange', () => showTab(location.hash.slice(1), false, true));
  // top bar: hairline once the page scrolls; indicator follows layout changes
  const header = document.getElementById('site-header');
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { header.classList.toggle('scrolled', window.scrollY > 4); ticking = false; });
  }, { passive: true });
  let resizeRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(() => positionIndicator(false)); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => positionIndicator(false));
  // theme: dark by default (set in <head> before paint); the toggle switches and remembers the choice
  const root = document.documentElement;
  const toggle = document.getElementById('theme-toggle');
  const syncToggle = () => {
    const light = root.getAttribute('data-theme') === 'light';
    toggle.setAttribute('aria-pressed', String(light));
    toggle.querySelector('.theme-label').textContent = light ? 'Dark' : 'Light';
    toggle.title = light ? 'Switch to the dark theme' : 'Switch to the light theme';
  };
  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('ctl-theme', next); } catch (e) { /* private mode: the choice lasts for this page only */ }
  });
  // charts read colours from CSS variables at render time, so re-render everything when the theme changes
  new MutationObserver(() => { syncToggle(); for (const k of Object.keys(dirty)) dirty[k] = true; renderTab(activeTab); })
    .observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  syncToggle();
  try { buildOverview(); } catch (e) { console.warn('overview visuals failed', e); }
  initReveal();
  showTab(location.hash ? location.hash.slice(1) : 'overview');
}

init();
