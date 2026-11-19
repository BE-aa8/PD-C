// Content test for Claude's site (site/): checks that charts and numbers show the RIGHT data, not just that they render.
// The smoke test (tests/browser-smoke.mjs) only checks that each chart has an SVG; a chart fed the wrong data passes it
// (the build comparison found exactly that in another build). Added after the comparison (docs/plan-simulator-round1-claude.md).
//
// Usage:
//   python3 -m http.server 8000 -d site &
//   node tests/browser-content.mjs --base http://localhost:8000          # also: --theme light, --scheme dark
// Exit code 1 if any check fails.
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
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
// 5a. Theory and Control Design layout (redesign Phase 5): chapter navigators, interactive block diagram, margin strip
const mstrip = await page.locator('#ds-margin-strip').innerText();
check('Margin strip shows the reference PM and GM', mstrip.includes(m10.PM_deg.toFixed(1)) && mstrip.includes(m10.GM.toFixed(2)), mstrip.replace(/\s+/g, ' ').slice(0, 120));
check('Control Design navigator lists 8 chapters', (await page.locator('#design-nav button[data-chap]').count()) === 8, '');
const blocks = await page.locator('#block-diagram .blk').evaluateAll((els) => els.map((e) => e.dataset.k));
const seen = new Set();
for (const k of blocks) {
  await page.locator(`#block-diagram .blk[data-k="${k}"]`).click();
  seen.add((await page.locator('#block-info h4').innerText()).trim());
}
check('Each diagram block opens its own details', blocks.length >= 7 && seen.size === blocks.length && (await page.locator('#block-info .katex').count()) > 0, `${blocks.length} blocks, ${seen.size} titles`);
await page.locator('#block-diagram .blk[data-k="ctrl"]').click();
await page.locator('#ds-tau_c').evaluate((el) => { el.value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(700);
const kc40 = await page.evaluate(async () => {
  const M = await import(new URL('js/model.js', location.href));
  return Math.abs(M.imcTuning({ model: 'fit_sopdt', tau_c: 40, theta_sensor: 10, Ts: 5, include_zoh: false }).Kc).toFixed(4);
});
const ctrlInfo = await page.locator('#block-info').innerText();
check('Controller block follows a τc change (live Kc)', ctrlInfo.includes(kc40) && (await page.locator('#block-diagram .blk[data-k="ctrl"]').getAttribute('aria-pressed')) === 'true', `Kc ${kc40}`);
await page.locator('#ds-tau_c').evaluate((el) => { el.value = '20'; el.dispatchEvent(new Event('input', { bubbles: true })); });
await page.waitForTimeout(500);
await page.click('[data-tab="theory"]');
await page.waitForTimeout(700);
const thChaps = await page.locator('#theory-nav button[data-chap]').evaluateAll((els) => els.map((e) => e.dataset.chap));
let jumps = 0;
for (const id of thChaps) {
  await page.locator(`#theory-nav button[data-chap="${id}"]`).click();
  await page.waitForTimeout(900);
  const top = await page.locator(`#${id}`).evaluate((el) => el.getBoundingClientRect().top);
  if (top >= 0 && top < 260) jumps++;
}
check('Theory navigator lists 5 chapters and jumps to each', thChaps.length === 5 && jumps === 5, `${jumps}/${thChaps.length}`);
check('Theory navigator marks the chapter in view', (await page.locator('#theory-nav button[aria-current]').getAttribute('data-chap')) === thChaps[4], '');
await page.click('[data-tab="design"]');
await page.waitForTimeout(500);

// 5c. AI Workflow, Video, References (redesign Phase 6): content must match the project records, nothing invented
await page.click('[data-tab="ai"]');
await page.waitForTimeout(500);
const stagesUI = await page.locator('#ai-timeline .tl-step').evaluateAll((els) => els.map((e) => e.dataset.stage));
const stageTitles = new Set();
for (const id of stagesUI) {
  await page.locator(`#ai-timeline .tl-step[data-stage="${id}"]`).click();
  stageTitles.add((await page.locator('#tl-panel h4').innerText()).trim());
}
check('AI timeline: 7 stages, each opens its own details', stagesUI.length === 7 && stageTitles.size === 7, `${stagesUI.length} stages, ${stageTitles.size} titles`);
const wf = await page.evaluate(async () => import(new URL('js/workflow.js', location.href)).then((m) => ({ STAGES: m.STAGES, PROMPTS: m.PROMPTS, DECISIONS: m.DECISIONS })));
const evPaths = [...new Set(wf.STAGES.flatMap((st) => st.evidence.map((e) => e.path)))];
const missing = evPaths.filter((pth) => !existsSync(join(ROOT, pth)));
check('Every evidence link points to a file in the repository', evPaths.length >= 10 && missing.length === 0, missing.join(', ') || `${evPaths.length} files`);
const logTxt = readFileSync(join(ROOT, 'docs/process-log.md'), 'utf8');
const quotes = [...wf.PROMPTS.map((x) => x.q), ...wf.STAGES.filter((st) => st.quote).map((st) => st.quote.q)];
const notFound = quotes.filter((q) => !logTxt.includes(q));
check('Every quoted prompt appears verbatim in docs/process-log.md', quotes.length >= 10 && notFound.length === 0, notFound.map((q) => q.slice(0, 40)).join(' | ') || `${quotes.length} quotes`);
const mdRows = readFileSync(join(ROOT, 'docs/critique-decisions.md'), 'utf8').split('\n').filter((l) => /^\| \d+ \|/.test(l));
const mdDec = mdRows.map((l) => l.split(' | ')[3].replace(/\*\*/g, '').trim());
const uiDec = await page.locator('#ai-dec-table tbody tr td:nth-child(4)').allTextContents(); // inside a closed disclosure: textContent
check('Decision table = docs/critique-decisions.md (26 rows, same decisions, all approved)', mdRows.length === 26 && uiDec.length === 26 && uiDec.every((d, i) => d.trim() === mdDec[i]) && mdRows.every((l) => l.includes('✅')), `${uiDec.length} rows`);
check('Gemini build link points to /gemini/', (await page.locator('#ai-gemini-link').getAttribute('href')) === 'gemini/', '');
check('Andrew\'s conclusions are placeholders (not written by AI)', (await page.locator('.own-box[data-owner="andrew"] .tag').allInnerTexts()).every((t) => /To be written by Andrew/.test(t)) && (await page.locator('.own-box').count()) === 2, '');
await page.click('[data-tab="video"]');
await page.waitForTimeout(400);
const vcfg = await page.evaluate(async () => import(new URL('js/video.js', location.href)).then((m) => m.VIDEO));
const vstate = await page.locator('#video-stage').getAttribute('data-state');
check('Video: placeholder until a YouTube id is set', vcfg.youtubeId ? vstate === 'poster' : (vstate === 'placeholder' && (await page.locator('#video-stage iframe').count()) === 0), `state ${vstate}`);
await page.locator('#transcript summary').click();
const tOpen = await page.locator('#transcript').evaluate((el) => el.open);
const tText = await page.locator('#transcript-body').innerText();
check('Transcript reader opens; empty transcript is labelled, not invented', tOpen && (vcfg.transcript.trim() ? tText.includes(vcfg.transcript.trim().slice(0, 40)) : /Placeholder/.test(tText)), '');
await page.click('[data-tab="refs"]');
await page.waitForTimeout(400);
const nSources = await page.evaluate(async () => Object.keys((await import(new URL('js/data.js', location.href))).DATA.sources).length);
check('References: one #ref-list item per DATA.sources entry', (await page.locator('#ref-list li').count()) === nSources, `${nSources} sources`);
check('References keep the [TO VERIFY] flags', (await page.locator('#panel-refs .tv').count()) >= 4, `${await page.locator('#panel-refs .tv').count()} flags`);
await page.click('[data-tab="design"]');
await page.waitForTimeout(300);

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
// phones get purpose-drawn vertical diagrams and a chapter select instead of the sticky list
await m.click('#tab-design');
await m.waitForTimeout(900);
const tallD = await m.locator('#block-diagram svg.tall-d').count();
const swd = await m.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
check('Phone: vertical block diagram, no horizontal scroll', tallD === 1 && swd[0] <= swd[1] + 1, `tall ${tallD}, ${swd}`);
check('Phone: chapter select instead of the list', await m.locator('#design-nav select').isVisible() && !(await m.locator('#design-nav .chapnav-list').isVisible()), '');
await m.click('#tab-overview');
await m.waitForTimeout(600);
await m.click('#tab-ai');
await m.waitForTimeout(500);
const railCols = await m.locator('.tl-rail').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
const swa = await m.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
check('Phone: AI timeline is vertical, no horizontal scroll', railCols === 1 && swa[0] <= swa[1] + 1, `${railCols} columns, ${swa}`);
await m.click('#tab-overview');
await m.waitForTimeout(400);
check('Phone: Overview loop drawn vertically', await m.locator('#loop-svg').evaluate((el) => el.classList.contains('vertical') && el.getAttribute('viewBox') === '0 0 330 540'), '');
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
// 3D, default page: live only with a hardware renderer (CI's headless browser has none, like a laptop with
// hardware acceleration off); otherwise a still image and no WebGL context at all. The glucose trace animates either way.
const canvases = (pg) => pg.locator('canvas.viewer-canvas').count();
await ov.waitForFunction(() => document.getElementById('hero-stage').dataset.live !== undefined, null, { timeout: 15000 }).catch(() => {});
const heroLive = (await ov.locator('#hero-stage').getAttribute('data-live')) === 'true';
if (heroLive) {
  await ov.waitForSelector('#hero-stage[data-ready="true"]', { timeout: 30000 }).catch(() => {});
  check('Hero 3D: live on a hardware renderer', (await ov.locator('#hero-stage').getAttribute('data-ready')) === 'true', '');
} else {
  const still = await ov.locator('#hero-stage img.viewer-still').evaluate((im) => im.complete && im.naturalWidth > 0 && getComputedStyle(im).visibility === 'visible');
  check('Hero 3D: software renderer → still image, no WebGL context', still && (await canvases(ov)) === 0, `still ${still}, canvases ${await canvases(ov)}`);
  check('Viewer offers "Try live 3D anyway" with the reason', (await ov.locator('#organ-explore').innerText()).includes('anyway') && await ov.locator('#organ-note').isVisible(), '');
}
const phX = async () => ov.locator('#hero-ph').getAttribute('x1');
const x0 = await phX(); await ov.waitForTimeout(700);
check('Hero glucose playhead animates', x0 !== (await phX()), `${x0} → ${await phX()}`);
check('Viewer tools disabled until the viewer starts', await ov.locator('.tool[data-tool="wireframe"]').isDisabled(), '');
await ov.close();

// 6b. Live viewer (?3d=force skips the hardware check, as "Try anyway" does): tap to start, one GPU context at a time,
// tools, hotspots, and everything released when the Overview is left
const fv = await browser.newPage({ colorScheme: SCHEME, viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
fv.on('pageerror', (e) => ovErrors.push(String(e)));
await setup(fv);
await fv.goto(`${BASE}/${Q ? Q + '&' : '?'}3d=force#overview`, { waitUntil: 'networkidle' });
await fv.waitForSelector('#hero-stage[data-ready="true"]', { timeout: 30000 }).catch(() => {});
check('Hero 3D pancreas loads (forced live)', (await fv.locator('#hero-stage').getAttribute('data-ready')) === 'true', '');
await fv.locator('#organ').scrollIntoViewIfNeeded();
check('Organ viewer waits for a tap (no canvas yet)', (await fv.locator('#organ-stage canvas').count()) === 0 && await fv.locator('#organ-explore').isVisible(), '');
await fv.click('#organ-explore');
await fv.waitForSelector('#organ-stage[data-ready="true"]', { timeout: 30000 }).catch(() => {});
check('Organ viewer starts on tap', (await fv.locator('#organ-stage').getAttribute('data-ready')) === 'true' && !(await fv.locator('#organ-start').isVisible()), '');
check('Only one live 3D view (hero released)', (await canvases(fv)) === 1 && (await fv.locator('#hero-stage canvas').count()) === 0, `canvases ${await canvases(fv)}`);
// each toggle tool flips aria-pressed; reset clears them
const toggles = ['wireframe', 'section', 'isolate', 'context'];
const flips = [];
for (const t of toggles) {
  const before = await fv.locator(`.tool[data-tool="${t}"]`).getAttribute('aria-pressed');
  await fv.locator(`.tool[data-tool="${t}"]`).click();
  flips.push(before === 'false' && (await fv.locator(`.tool[data-tool="${t}"]`).getAttribute('aria-pressed')) === 'true');
}
check('Viewer tools toggle aria-pressed', flips.every(Boolean), JSON.stringify(Object.fromEntries(toggles.map((t, i) => [t, flips[i]]))));
await fv.locator('.tool[data-tool="reset"]').click();
const after = await Promise.all(toggles.map((t) => fv.locator(`.tool[data-tool="${t}"]`).getAttribute('aria-pressed')));
check('Reset clears the viewer tools', after.every((v) => v === 'false'), after.join(','));
// hotspots open their part in the info panel and the breadcrumb
await fv.waitForTimeout(500);
const spots = await fv.locator('#organ-stage .hotspot:not(.behind)').evaluateAll((els) => els.map((e) => e.dataset.key));
let spotOk = spots.length >= 3;
const spotDetail = [];
for (const k of spots) {
  await fv.locator(`#organ-stage .hotspot[data-key="${k}"]`).evaluate((el) => el.click());
  const h = (await fv.locator('#organ-info h4').innerText()).trim();
  const crumb = (await fv.locator('#organ-crumb').innerText()).trim();
  const ok = h.length > 0 && h !== 'Pancreas' && crumb.endsWith(h);
  spotOk = spotOk && ok; spotDetail.push(`${k}→${h}`);
}
check('Hotspots open their label (info panel + breadcrumb)', spotOk, spotDetail.join(', ') || 'no visible hotspots');
await fv.click('#tab-simulator');
await fv.waitForTimeout(500);
check('Leaving the Overview releases every 3D view', (await canvases(fv)) === 0 && (await fv.locator('#organ-stage .hotspot').count()) === 0, `canvases ${await canvases(fv)}`);
await fv.click('#tab-overview');
await fv.waitForSelector('#hero-stage[data-ready="true"]', { timeout: 30000 }).catch(() => {});
check('Returning restarts the hero; the viewer waits for a tap again', (await fv.locator('#hero-stage').getAttribute('data-ready')) === 'true' && await fv.locator('#organ-explore').isEnabled() && (await canvases(fv)) === 1, '');
await fv.close();
check('No page errors (Overview)', ovErrors.length === 0, ovErrors.join(' | '));

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
check('No WebGL: still image and a notice, viewer not offered', (await ng.locator('#hero-stage').getAttribute('data-fallback')) === 'true' && await ng.locator('#organ-explore').isDisabled() && (await ng.locator('#organ-note').innerText()).includes('WebGL'), '');
check('No WebGL: chapters still render', (await ng.locator('#ch-late-metrics .metric').count()) === 3, '');
check('No page errors (no WebGL)', ngErrors.length === 0, ngErrors.join(' | '));
await nctx.close();
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`# Content test (site theme ${THEME || 'dark default'}, device ${SCHEME}) — ${BASE}/`);
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail && !r.ok ? ` — ${r.detail}` : ''}`);
console.log(`${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
