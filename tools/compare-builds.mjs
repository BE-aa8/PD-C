// Compare the Claude and Gemini model.js builds beyond the pass/fail tests (docs/comparison.md).
// Usage: node tools/compare-builds.mjs [path/to/gemini/site/gemini/js/model.js] [--out docs/comparison-data.json]
// Default Gemini path: site/gemini/js/model.js (present on branch gemini/pro or a merged branch).
// No dependencies. Prints Markdown tables and writes the raw numbers as JSON.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args[outIdx + 1] : join(ROOT, 'docs/comparison-data.json');
const gemPath = resolve(args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out') || join(ROOT, 'site/gemini/js/model.js'));
const claudePath = join(ROOT, 'site/js/model.js');
if (!existsSync(gemPath)) { console.error(`Gemini model.js not found at ${gemPath}`); process.exit(1); }

const E = JSON.parse(readFileSync(join(ROOT, 'tests/expected.json'), 'utf8'));
const TOL = E.meta.tolerances;
const BAND = { low: 54, high: 144 };
const builds = {
  claude: await import(pathToFileURL(claudePath)),
  gemini: await import(pathToFileURL(gemPath)),
};
const names = Object.keys(builds);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const r3 = (v) => (fin(v) ? +v.toPrecision(3) : v);

// ---------- 1. precision headroom against the reference (error / tolerance; 1.0 = at the limit)
const headroom = [];
for (const sc of E.scenarios) {
  const row = { scenario: sc.name };
  for (const b of names) {
    const M = builds[b];
    const r = M.simulate(sc.inputs);
    const dt = { ...E.defaultInputs, ...sc.inputs }.dt;
    let gErr = 0, uErr = 0;
    sc.times.forEach((t, j) => {
      const i = Math.round(t / dt);
      gErr = Math.max(gErr, Math.abs(r.G[i] - sc.G[j]));
      uErr = Math.max(uErr, Math.abs(r.U[i] - sc.U[j]));
    });
    const m = M.metrics(r, BAND);
    const ratios = {
      G: gErr / TOL.G_abs,
      U: uErr / TOL.U_abs,
      peak: Math.abs(m.peak - sc.metrics.peak) / TOL.peak_nadir_abs,
      nadir: Math.abs(m.nadir - sc.metrics.nadir) / TOL.peak_nadir_abs,
      pct_in_band: Math.abs(m.pct_in_band - sc.metrics.pct_in_band) / TOL.pct_abs,
      IAE: Math.abs(m.IAE - sc.metrics.IAE) / Math.abs(sc.metrics.IAE || 1) / TOL.IAE_rel,
      insulin: Math.abs(m.insulin_total - sc.metrics.insulin_total) / sc.metrics.insulin_total / TOL.insulin_rel,
    };
    row[b] = { maxGerr: gErr, maxUerr: uErr, worstRatio: Math.max(...Object.values(ratios)), worstKey: Object.entries(ratios).sort((a, c) => c[1] - a[1])[0][0] };
  }
  headroom.push(row);
}

// ---------- 2. agreement between the builds on inputs that are NOT in expected.json
const extra = [
  ['noise_seed7', 'Noise σ = 5, seed 7', { noise_sd: 5, seed: 7 }],
  ['noise_stuck', 'Noise σ = 5 + stuck sensor at 100 min', { noise_sd: 5, seed: 3, fault: 'stuck', t_fault: 100 }],
  ['noise_dropout', 'Noise σ = 5 + dropout 100–130 min', { noise_sd: 5, seed: 3, fault: 'dropout', t_fault: 100 }],
  ['no_saturation_2x', 'Pump limits off, 2× meal', { saturation: false, meals: [[60, 2]] }],
  ['day_ff_backcalc', '24 h, 3 meals, pre-bolus 15, back-calculation', { t_end: 1440, meals: [[480, 1], [780, 1.5], [1140, 1]], ff_enabled: true, t_pre: 15, anti_windup: 'backcalc' }],
  ['odd_delay_lag', 'Delay 7.3 min + lag 0.5 min', { sensor_delay: 7.3, sensor_lag: 0.5 }],
  ['pi_beta03_step', 'PI, β = 0.3, set point 81 → 100 at 30 min, meal at 200', { mode: 'PI', beta: 0.3, setpoint_steps: [[30, 100]], meals: [[200, 1]] }],
  ['sens_06', 'p3 × 0.6 from t = 0', { sensitivity_change: [0, 0.6] }],
  ['ff_under_over', 'Bolus f = 1.5, estimate −50 %, late by 20 min', { ff_enabled: true, f_bolus: 1.5, est_error: -0.5, t_pre: -20 }],
  ['aggressive_Kc3', 'Kc × 3 (oscillatory)', { Kc: 3 * E.defaultInputs.Kc }],
  ['dropout_at_0', 'Dropout from t = 0 for 30 min', { fault: 'dropout', t_fault: 0, dropout_duration: 30 }],
  ['negative_drift', 'Drift −20 mg/dL per h from 60 min', { fault: 'drift', t_fault: 60, drift_rate: -20 }],
  ['suspend_noff', 'Suspend integral with feedforward OFF (should be a no-op)', { suspend_integral: true, suspend_extra: 60 }],
];
const agreement = [];
for (const [id, label, inputs] of extra) {
  const out = { id, label, inputs };
  const res = {};
  for (const b of names) {
    try { res[b] = builds[b].simulate(inputs); } catch (e) { res[b] = { error: String(e.message || e) }; }
  }
  if (res.claude.error || res.gemini.error) {
    out.error = { claude: res.claude.error || null, gemini: res.gemini.error || null };
  } else {
    const n = Math.min(res.claude.G.length, res.gemini.G.length);
    let dG = 0, dU = 0, dGm = 0;
    for (let i = 0; i < n; i++) {
      dG = Math.max(dG, Math.abs(res.claude.G[i] - res.gemini.G[i]));
      dU = Math.max(dU, Math.abs(res.claude.U[i] - res.gemini.U[i]));
      const a = res.claude.Gm[i], c = res.gemini.Gm[i];
      const aOk = fin(a), cOk = fin(c);
      if (aOk && cOk) dGm = Math.max(dGm, Math.abs(a - c));
      else if (aOk !== cOk) dGm = Infinity;
    }
    const mc = builds.claude.metrics(res.claude, BAND), mg = builds.gemini.metrics(res.gemini, BAND);
    Object.assign(out, {
      maxAbsDiffG: dG, maxAbsDiffU: dU, maxAbsDiffGm: dGm,
      peak: { claude: mc.peak, gemini: mg.peak }, nadir: { claude: mc.nadir, gemini: mg.nadir },
      warnings: { claude: res.claude.warnings, gemini: res.gemini.warnings },
      length: { claude: res.claude.G.length, gemini: res.gemini.G.length },
      Umin: { claude: Math.min(...res.claude.U), gemini: Math.min(...res.gemini.U) },
    });
  }
  agreement.push(out);
}

// ---------- 3. robustness: invalid or extreme inputs
const bad = [
  ['Kc = NaN', { Kc: NaN }], ['Kc = "abc" (string)', { Kc: 'abc' }], ['Kc = +0.5 (wrong sign)', { Kc: 0.5 }],
  ['t_end = 0', { t_end: 0 }], ['t_end = −10', { t_end: -10 }], ['dt = 0', { dt: 0 }], ['Ts = 0', { Ts: 0 }],
  ['tauI = 0 (PID)', { tauI: 0 }], ['N = 0', { N: 0 }], ['sensor_delay = 1e6', { sensor_delay: 1e6 }],
  ['sensor_lag = 0.2 (not allowed)', { sensor_lag: 0.2 }], ['meals = null', { meals: null }], ['meals = [[NaN, 1]]', { meals: [[NaN, 1]] }],
  ['setpoint_steps = [[60, −5]]', { setpoint_steps: [[60, -5]] }], ['controller = "xyz"', { controller: 'xyz' }],
  ['fault = "abc"', { fault: 'abc' }], ['sensitivity_change = [120, −1]', { sensitivity_change: [120, -1] }],
  ['noise_sd = −3', { noise_sd: -3 }],
];
const robustness = [];
for (const [label, inputs] of bad) {
  const row = { label };
  for (const b of names) {
    try {
      const r = builds[b].simulate(inputs);
      const nonFinite = r.G.some((v) => !fin(v)) || r.U.some((v) => !fin(v));
      const outOfRange = r.U.some((u) => u < -1e-9 || u > 115 + 1e-9);
      row[b] = { outcome: nonFinite ? 'non-finite output' : 'ok', length: r.G.length, warnings: r.warnings.length, valid: r.valid, UoutOfRange: outOfRange };
    } catch (e) {
      row[b] = { outcome: 'threw', message: String(e.message || e).slice(0, 120) };
    }
  }
  robustness.push(row);
}

// ---------- 4. speed
function bench(fn, reps = 15) {
  fn(); fn();
  const ts = [];
  for (let k = 0; k < reps; k++) { const t0 = performance.now(); fn(); ts.push(performance.now() - t0); }
  ts.sort((a, b) => a - b);
  return ts[Math.floor(reps / 2)];
}
const speed = {};
for (const b of names) {
  speed[b] = {
    default_660min_ms: bench(() => builds[b].simulate({})),
    day_1440min_ms: bench(() => builds[b].simulate({ t_end: 1440, meals: [[480, 1], [780, 1], [1140, 1]] })),
    margins_ms: bench(() => builds[b].margins({ Kc: E.defaultInputs.Kc, tauI: E.defaultInputs.tauI, tauD: E.defaultInputs.tauD, N: 10, theta: 10 })),
  };
}

const data = { generatedBy: 'tools/compare-builds.mjs', node: process.version, gemini_model_js: gemPath.includes('site/gemini/') ? 'site/gemini/' + gemPath.split('site/gemini/')[1] : gemPath, headroom, agreement, robustness, speed };
writeFileSync(OUT, JSON.stringify(data, (k, v) => (v === Infinity ? 'Infinity' : (typeof v === 'number' && !Number.isInteger(v) ? r3(v) : v)), 1) + '\n');

// ---------- Markdown
const md = [];
md.push('### Precision against the reference (worst error ÷ tolerance; 1.0 = at the pass limit)\n');
md.push('| Scenario | Claude max |ΔG| (mg/dL) | Claude worst ratio | Gemini max |ΔG| (mg/dL) | Gemini worst ratio |');
md.push('|---|---|---|---|---|');
for (const h of headroom) md.push(`| ${h.scenario} | ${h.claude.maxGerr.toExponential(1)} | ${h.claude.worstRatio.toFixed(3)} (${h.claude.worstKey}) | ${h.gemini.maxGerr.toExponential(1)} | ${h.gemini.worstRatio.toFixed(3)} (${h.gemini.worstKey}) |`);
const worst = (b) => Math.max(...headroom.map((h) => h[b].worstRatio));
md.push(`\nWorst over all 25 scenarios: Claude ${worst('claude').toFixed(3)}, Gemini ${worst('gemini').toFixed(3)}.\n`);
md.push('### Agreement between the builds on inputs not in the tests\n');
md.push('| Case | max |G_C − G_G| | max |U_C − U_G| | max |Gm_C − Gm_G| | warnings C / G |');
md.push('|---|---|---|---|---|');
for (const a of agreement) {
  if (a.error) { md.push(`| ${a.label} | error: C ${a.error.claude ?? 'ok'}; G ${a.error.gemini ?? 'ok'} | | | |`); continue; }
  const g = (v) => (v === Infinity ? 'one is missing' : v.toExponential(1));
  md.push(`| ${a.label} | ${g(a.maxAbsDiffG)} | ${g(a.maxAbsDiffU)} | ${g(a.maxAbsDiffGm)} | ${a.warnings.claude.length} / ${a.warnings.gemini.length} |`);
}
md.push('\n### Robustness: invalid or extreme inputs to simulate()\n');
md.push('| Input | Claude | Gemini |');
md.push('|---|---|---|');
const cell = (x) => (x.outcome === 'threw' ? `throws: ${x.message}` : `${x.outcome}, ${x.warnings} warning(s), length ${x.length}${x.valid === false ? ', valid=false' : ''}${x.UoutOfRange ? ', U outside [0,115]' : ''}`);
for (const r of robustness) md.push(`| ${r.label} | ${cell(r.claude)} | ${cell(r.gemini)} |`);
md.push('\n### Speed (median ms, this machine)\n');
md.push('| | Claude | Gemini |');
md.push('|---|---|---|');
for (const k of Object.keys(speed.claude)) md.push(`| ${k} | ${speed.claude[k].toFixed(1)} | ${speed.gemini[k].toFixed(1)} |`);
console.log(md.join('\n'));
console.error(`\nWrote ${OUT}`);
