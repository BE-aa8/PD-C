// Content test for Claude's site (site/): checks that charts and numbers show the RIGHT data, not just that they render.
// The smoke test (tests/browser-smoke.mjs) only checks that each chart has an SVG; a chart fed the wrong data passes it
// (the build comparison found exactly that in another build). Added after the comparison (docs/plan-simulator-round1-claude.md).
//
// Usage:
//   python3 -m http.server 8000 -d site &
//   node tests/browser-content.mjs --base http://localhost:8000          # also: --theme light, --scheme dark
// Exit code 1 if any check fails.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const E = JSON.parse(readFileSync(join(ROOT, 'tests/expected.json'), 'utf8'));
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
  return acc;
}, []));
const BASE = (args.base || 'http://localhost:8000').replace(/\/$/, '');
const SCHEME = args.scheme === 'dark' ? 'dark' : 'light';   // the device setting (the site defaults to dark regardless)
const THEME = args.theme === 'light' ? 'light' : '';         // force the site theme with ?theme=light
const Q = THEME ? `?theme=${THEME}` : '';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };
const num = (txt) => parseFloat(String(txt).replace('−', '-').replace(/[^0-9.+-eE]/g, ''));

async function setup(page) {
  if (globalThis.__routeCdn) await globalThis.__routeCdn(page); // hook for sandboxes without CDN access
}

const browser = await chromium.launch();
const page = await browser.newPage({ colorScheme: SCHEME, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await setup(page);
await page.goto(`${BASE}/${Q}#simulator`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
check(`Theme on load is ${THEME || 'dark (the default)'}`, theme === (THEME || 'dark'), `data-theme = ${theme}`);
const kpi = async (i) => num(await page.locator('#sim-kpis .kpi .v').nth(i).innerText());

// 1. P1 shows simulate() for the default inputs; KPIs show metrics()
const p1 = await page.evaluate(async () => {
  const M = await import(new URL('js/model.js', location.href));
  const r = M.simulate({});
  const m = M.metrics(r);
  const tr = document.getElementById('p1').data[0];
  let maxErr = 0;
  tr.y.forEach((y, k) => { maxErr = Math.max(maxErr, Math.abs(y - r.G[Math.min(5 * k, r.G.length - 1)])); });
  return { maxErr, n: tr.y.length, peak: m.peak, nadir: m.nadir };
});
check('P1 true glucose = simulate(DEFAULT_INPUTS)', p1.maxErr < 1e-9 && p1.n > 100, `max diff ${p1.maxErr}, ${p1.n} points`);
check('KPI peak = metrics().peak', Math.abs((await kpi(0)) - p1.peak) <= 0.051, `${await kpi(0)} vs ${p1.peak}`);
check('KPI nadir = metrics().nadir', Math.abs((await kpi(1)) - p1.nadir) <= 0.051, `${await kpi(1)} vs ${p1.nadir}`);

// 2. A preset reproduces the independent Python reference (tests/expected.json)
await page.selectOption('#sim-preset', 'pre15');
await page.waitForTimeout(700);
const ref = E.scenarios.find((s) => s.name === 'prebolus_15').metrics;
check('Preset "15-min pre-bolus": peak = reference', Math.abs((await kpi(0)) - ref.peak) <= 0.06, `${await kpi(0)} vs ${ref.peak}`);
check('Preset "15-min pre-bolus": nadir = reference', Math.abs((await kpi(1)) - ref.nadir) <= 0.06, `${await kpi(1)} vs ${ref.nadir}`);
await page.selectOption('#sim-preset', 'default');
await page.waitForTimeout(900);

// 3. P10 marks the current operating point; manual mode with the copied gains changes nothing; Kc then matters
const p10x = async () => page.evaluate(() => document.getElementById('p10').data[2].x[0]);
check('P10 marker at the current τc (20 min)', (await p10x()) === 20, `x = ${await p10x()}`);
const peakImc = await kpi(0);
await page.locator('#sim-controls .seg button[data-v="manual"]').click();
await page.waitForTimeout(900);
check('Manual mode starts from the IMC gains (same peak)', (await kpi(0)) === peakImc, `${await kpi(0)} vs ${peakImc}`);
check('P10 marker at the current Kc in manual mode', Math.abs((await p10x()) - E.defaultInputs.Kc) < 1e-3, `x = ${await p10x()}`);
await page.locator('#sim-Kc_man').evaluate((el) => { el.value = '-1'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(700);
check('Changing manual Kc changes the result', (await kpi(0)) !== peakImc, `${await kpi(0)} vs ${peakImc}`);
await page.locator('#sim-controls .seg button[data-v="imc"]').click();
await page.waitForTimeout(500);

// 4. Theory: P4 = nonlinearGain()
await page.click('[data-tab="theory"]');
await page.waitForTimeout(900);
const p4 = await page.evaluate(async () => {
  const M = await import(new URL('js/model.js', location.href));
  const tr = document.getElementById('p4').data[0];
  return Math.max(...tr.x.map((x, i) => Math.abs(tr.y[i] - M.nonlinearGain(x))));
});
check('P4 curve = nonlinearGain(ΔU)', p4 < 1e-12, `max diff ${p4}`);

// 5. Control Design: margins text matches the reference; P9 shows DATA.mpcComparison for both cases
await page.click('[data-tab="design"]');
await page.waitForTimeout(1000);
const mtxt = await page.locator('#ds-margins').innerText();
const m10 = E.margins.find((m) => m.name === 'design10_loop10').expect;
const m0 = E.margins.find((m) => m.name === 'design10_loop0').expect;
for (const [label, v] of [['PM with delay', m10.PM_deg.toFixed(1)], ['PM delay-free', m0.PM_deg.toFixed(1)], ['GM', m10.GM.toFixed(2)]]) {
  check(`Margins card shows ${label} = ${v}`, mtxt.includes(v), '');
}
for (const cs of ['unannounced', 'announced']) {
  await page.selectOption('#mpc-case', cs);
  await page.waitForTimeout(500);
  const p9 = await page.evaluate(async (cs) => {
    const { DATA } = await import(new URL('js/data.js', location.href));
    const d = document.getElementById('p9').data;
    const mc = DATA.mpcComparison[cs];
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    return [same(d[0].y, mc.pid.G_true), same(d[1].y, mc.mpc.G_true), same(d[2].y, mc.pid.U), same(d[3].y, mc.mpc.U)];
  }, cs);
  check(`P9 (${cs}) = DATA.mpcComparison`, p9.every(Boolean), JSON.stringify(p9));
}
// 5b. Simulator workspace (redesign Phase 4): KPI flag, Reset, help, linked time axes, saved-run chips
await page.click('#tab-simulator');
await page.waitForTimeout(800);
const defPeak = E.scenarios.find((x) => x.name === 'ex23_6e_feedback_only').metrics.peak;
check('KPI peak tile flags the out-of-band default peak', await page.locator('#sim-kpis .kpi').nth(0).evaluate((el) => el.classList.contains('out')), '');
await page.selectOption('#sim-preset', 'pre15');
await page.waitForTimeout(700);
check('KPI peak tile shows in band for the pre-bolus case', await page.locator('#sim-kpis .kpi').nth(0).evaluate((el) => el.classList.contains('in')), '');
await page.click('#sim-reset');
await page.waitForTimeout(800);
check('Reset restores the default case', (await page.locator('#sim-preset').inputValue()) === 'default' && Math.abs((await kpi(0)) - defPeak) <= 0.06, `${await kpi(0)} vs ${defPeak}`);
const helpState = async () => [await page.locator('#sim-help-btn').getAttribute('aria-expanded'), await page.locator('#sim-help').isVisible()];
const h0 = await helpState();
await page.click('#sim-help-btn');
const h1 = await helpState();
await page.click('#sim-help-btn');
const h2 = await helpState();
check('Help button opens and closes its panel', h0[0] === 'false' && !h0[1] && h1[0] === 'true' && h1[1] && h2[0] === 'false' && !h2[1], JSON.stringify([h0, h1, h2]));
await page.evaluate(() => window.Plotly.relayout('p1', { 'xaxis.range': [100, 300] }));
await page.waitForTimeout(500);
const ranges = await page.evaluate(() => ['p1', 'p2', 'p3'].map((id) => document.getElementById(id).layout.xaxis.range.map((v) => Math.round(v))));
check('P1 zoom moves P2 and P3 to the same time range', ranges.every((r) => r[0] === 100 && r[1] === 300), JSON.stringify(ranges));
await page.click('#save-run');
await page.selectOption('#sim-preset', 'pre15');
await page.waitForTimeout(600);
await page.click('#save-run');
await page.waitForTimeout(300);
const p8n = async () => page.evaluate(() => document.getElementById('p8').data.length);
const before = [await page.locator('#saved-list li').count(), await p8n()];
await page.locator('#saved-list li').nth(0).locator('button.chip-x').click();
await page.waitForTimeout(300);
const after1 = [await page.locator('#saved-list li').count(), await p8n()];
const leftLabel = await page.evaluate(() => document.getElementById('p8').data[0].name);
check('Removing a saved-run chip removes its P8 trace', before[0] === 2 && before[1] === 3 && after1[0] === 1 && after1[1] === 2 && leftLabel.includes('pre-bolus'), `${JSON.stringify(before)} → ${JSON.stringify(after1)}, left: ${leftLabel}`);
await page.click('#clear-runs');
await page.click('#sim-reset');
await page.waitForTimeout(500);
check('No page errors (desktop)', errors.length === 0, errors.join(' | '));
await page.close();

// 5b. Theme toggle: switches, re-themes the charts, and is remembered after a reload (fresh context, no ?theme)
const tctx = await browser.newContext({ colorScheme: SCHEME, viewport: { width: 1280, height: 900 } });
const tp = await tctx.newPage();
await setup(tp);
await tp.goto(`${BASE}/#simulator`, { waitUntil: 'networkidle' });
await tp.waitForTimeout(1000);
const p1Colour = () => tp.evaluate(() => document.getElementById('p1').data[0].line.color);
const cssS1 = () => tp.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--s1').trim());
const darkColour = await p1Colour();
check('Fresh visit starts dark', (await tp.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark', '');
await tp.locator('#theme-toggle').click();
await tp.waitForTimeout(900);
const lightTheme = await tp.evaluate(() => document.documentElement.getAttribute('data-theme'));
const lightColour = await p1Colour();
check('Toggle switches to light', lightTheme === 'light', `data-theme = ${lightTheme}`);
check('P1 re-themes with the toggle', lightColour !== darkColour && lightColour === (await cssS1()), `${darkColour} → ${lightColour}`);
await tp.reload({ waitUntil: 'networkidle' });
await tp.waitForTimeout(800);
check('Light choice remembered after reload', (await tp.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'light', '');
await tp.locator('#theme-toggle').click();
await tp.waitForTimeout(500);
check('Toggle switches back to dark', (await tp.evaluate(() => document.documentElement.getAttribute('data-theme'))) === 'dark', '');
await tctx.close();

// 6. Phones: the floating button reaches the controls; no horizontal scroll
const m = await browser.newPage({ colorScheme: SCHEME, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
await setup(m);
await m.goto(`${BASE}/${Q}#simulator`, { waitUntil: 'networkidle' });
await m.waitForTimeout(1200);
check('Phone: floating Controls button visible', await m.locator('#jump-btn').isVisible(), '');
await m.locator('#jump-btn').click();
await m.waitForTimeout(1200);
const top = await m.evaluate(() => document.getElementById('sim-controls').getBoundingClientRect().top);
check('Phone: button scrolls to the controls', top < 400 && top > -50, `controls top at ${Math.round(top)} px`);
const sw = await m.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
check('Phone: no horizontal scroll', sw[0] <= sw[1] + 1, `${sw[0]} > ${sw[1]}`);
await m.close();

// 6. Overview (redesign Phase 3): the hero trace and the chapter numbers are the model's output, and the 3D viewer works
const ov = await browser.newPage({ colorScheme: SCHEME, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const ovErrors = [];
ov.on('pageerror', (e) => ovErrors.push(String(e)));
await setup(ov);
await ov.goto(`${BASE}/${Q}#overview`, { waitUntil: 'networkidle' });
await ov.waitForTimeout(1200);
// hero trace: invert the SVG mapping (y in 30..180 mg/dL over 6..114 px, one point every 20 steps) and compare to simulate()
const hero = await ov.evaluate(async () => {
  const M = await import(new URL('js/model.js', location.href));
  const r = M.simulate({});
  const d = document.querySelector('#hero-trace path.svg-g').getAttribute('d');
  const ys = [...d.matchAll(/[ML][-\d.]+,([-\d.]+)/g)].map((x) => 30 + 150 * (1 - (parseFloat(x[1]) - 6) / 108));
  let maxErr = 0;
  ys.forEach((g, k) => { maxErr = Math.max(maxErr, Math.abs(g - r.G[20 * k])); });
  return { maxErr, n: ys.length };
});
check('Overview hero trace = simulate(DEFAULT_INPUTS) G(t)', hero.n > 100 && hero.maxErr < 0.1, `max diff ${hero.maxErr.toFixed(3)} mg/dL, ${hero.n} points`);
const metricVals = async (id) => (await ov.locator(`#${id} .metric .mv`).allInnerTexts()).map(num);
const fb = E.scenarios.find((x) => x.name === 'ex23_6e_feedback_only').metrics;
const pb = E.scenarios.find((x) => x.name === 'prebolus_15').metrics;
const mg10 = E.margins.find((x) => x.name === 'design10_loop10').expect;
const LMr = E.linearModel;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const late = await metricVals('ch-late-metrics');
check('Chapter 1 numbers = reference (peak, nadir, % in band)', near(late[0], fb.peak, 0.06) && near(late[1], fb.nadir, 0.06) && near(late[2], fb.pct_in_band, 0.1), `${late} vs ${fb.peak}, ${fb.nadir}, ${fb.pct_in_band}`);
const auth = await metricVals('ch-auth-metrics');
check('Chapter 2 numbers = reference (room up, room down, ratio)', near(auth[0], 115 - LMr.U_basal, 0.06) && near(Math.abs(auth[1]), LMr.U_basal, 0.06) && near(auth[2], LMr.authorityRatio, 0.006), `${auth} vs U_basal ${LMr.U_basal}, ratio ${LMr.authorityRatio}`);
const ffm = await metricVals('ch-ff-metrics');
check('Chapter 3 numbers = reference (pre-bolus peak, nadir, % in band)', near(ffm[0], pb.peak, 0.06) && near(ffm[1], pb.nadir, 0.06) && near(ffm[2], pb.pct_in_band, 0.1), `${ffm} vs ${pb.peak}, ${pb.nadir}, ${pb.pct_in_band}`);
const stab = await metricVals('ch-stab-metrics');
const sampledRef = await ov.evaluate(async () => (await import(new URL('js/data.js', location.href))).DATA.empiricalDelay.design_theta_s_10.value);
check('Chapter 4 numbers = reference (PM, tolerable delay, sampled limit)', near(stab[0], mg10.PM_deg, 0.06) && near(stab[1], mg10.total_tolerable_delay, 0.06) && near(stab[2], sampledRef, 0.06), `${stab} vs ${mg10.PM_deg}, ${mg10.total_tolerable_delay}, ${sampledRef}`);
// 3D viewers load the mesh
await ov.waitForSelector('#hero-stage[data-ready="true"]', { timeout: 30000 }).catch(() => {});
check('Hero 3D pancreas loads', (await ov.locator('#hero-stage').getAttribute('data-ready')) === 'true', '');
await ov.locator('#organ').scrollIntoViewIfNeeded();
await ov.waitForSelector('#organ-stage[data-ready="true"]', { timeout: 30000 }).catch(() => {});
check('Organ viewer loads', (await ov.locator('#organ-stage').getAttribute('data-ready')) === 'true', '');
// each toggle tool flips aria-pressed; reset clears them
const toggles = ['wireframe', 'section', 'isolate', 'context'];
const flips = [];
for (const t of toggles) {
  const before = await ov.locator(`.tool[data-tool="${t}"]`).getAttribute('aria-pressed');
  await ov.locator(`.tool[data-tool="${t}"]`).click();
  flips.push(before === 'false' && (await ov.locator(`.tool[data-tool="${t}"]`).getAttribute('aria-pressed')) === 'true');
}
check('Viewer tools toggle aria-pressed', flips.every(Boolean), JSON.stringify(Object.fromEntries(toggles.map((t, i) => [t, flips[i]]))));
await ov.locator('.tool[data-tool="reset"]').click();
const after = await Promise.all(toggles.map((t) => ov.locator(`.tool[data-tool="${t}"]`).getAttribute('aria-pressed')));
check('Reset clears the viewer tools', after.every((v) => v === 'false'), after.join(','));
// hotspots open their part in the info panel and the breadcrumb
await ov.waitForTimeout(500);
const spots = await ov.locator('#organ-stage .hotspot:not(.behind)').evaluateAll((els) => els.map((e) => e.dataset.key));
let spotOk = spots.length >= 3;
const spotDetail = [];
for (const k of spots) {
  await ov.locator(`#organ-stage .hotspot[data-key="${k}"]`).evaluate((el) => el.click());
  const h = (await ov.locator('#organ-info h4').innerText()).trim();
  const crumb = (await ov.locator('#organ-crumb').innerText()).trim();
  const ok = h.length > 0 && h !== 'Pancreas' && crumb.endsWith(h);
  spotOk = spotOk && ok; spotDetail.push(`${k}→${h}`);
}
check('Hotspots open their label (info panel + breadcrumb)', spotOk, spotDetail.join(', ') || 'no visible hotspots');
check('No page errors (Overview)', ovErrors.length === 0, ovErrors.join(' | '));
await ov.close();

// 7. Without WebGL the viewers show a notice and the rest of the Overview still works
const nctx = await browser.newContext({ colorScheme: SCHEME, viewport: { width: 1280, height: 900 } });
await nctx.addInitScript(() => {
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...a) { return /webgl/i.test(type) ? null : orig.call(this, type, ...a); };
});
const ng = await nctx.newPage();
const ngErrors = [];
ng.on('pageerror', (e) => ngErrors.push(String(e)));
await setup(ng);
await ng.goto(`${BASE}/${Q}#overview`, { waitUntil: 'networkidle' });
await ng.waitForTimeout(1500);
check('No WebGL: hero shows the fallback notice', (await ng.locator('#hero-stage').getAttribute('data-fallback')) === 'true' && (await ng.locator('#hero-stage .viewer-fallback').count()) === 1, '');
check('No WebGL: chapters still render', (await ng.locator('#ch-late-metrics .metric').count()) === 3, '');
check('No page errors (no WebGL)', ngErrors.length === 0, ngErrors.join(' | '));
await nctx.close();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`# Content test (site theme ${THEME || 'dark default'}, device ${SCHEME}) — ${BASE}/`);
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail && !r.ok ? ` — ${r.detail}` : ''}`);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
