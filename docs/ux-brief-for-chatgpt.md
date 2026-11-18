# Project brief for a UI/UX redesign plan (for ChatGPT)

You are helping **Andrew**, a 4th-year chemical engineering student at the University of Cincinnati, plan a **UI/UX
redesign** of a finished, working, tested static website. The engineering model, numbers and tests are done and verified.
Your job is a **design plan** (how it looks, reads and feels). **Claude Code will implement your plan later**, in small
phases, and every phase must keep the automated tests below passing. Please plan first; don't write the full code.

Andrew's goal, in his words to you: a cohesive design direction combining **visual storytelling**, **sophisticated technical
presentation**, and **minimalist typography and scroll interactions**, so it looks like a **professionally designed technology
company's website, not a student website with a dark theme**.

## 1. What the class project is

**Closing the Loop** is an interactive teaching website for **CHEE 4071 Process Dynamics and Control** (University of
Cincinnati, Fall 2026, Prof. Carlos Co; textbook Seborg, Edgar, Mellichamp & Doyle, *Process Dynamics and Control*, 4th ed.).
It treats an **artificial pancreas** (an automated insulin pump driven by a glucose sensor) as a **chemical-process control
problem**, using the glucose–insulin model of **Seborg Example 23.3 / Exercise 23.6** — an *illustrative textbook patient*:

| Process-control idea | In this project |
|---|---|
| Process | Three-state nonlinear glucose–insulin model (glucose G, remote insulin effect X, plasma insulin I) |
| Manipulated variable | Insulin infusion rate U from a pump limited to **0–115 mU/min** (it can't remove insulin) |
| Disturbance | A meal, D(t) = 9·e^(−0.05 t) mg/dL/min |
| Measurement | A glucose sensor sampled every **5 min** with a **10-min delay** (plus optional lag, noise, faults) |
| Controller | Discrete PID tuned by IMC (τc is the one tuning knob), anti-windup; optional static feedforward (a "bolus" pulse) |
| Goal | Keep glucose in Seborg's band **54 < G < 144 mg/dL** |

The teaching story the site should tell, in order:
1. Feedback alone reacts late (sensor delay + three lags), so the meal overshoots: **peak 163.4 mg/dL, nadir 49.4 mg/dL**,
   it leaves the band (default case, Ex. 23.6(e)).
2. The pump's authority is lopsided: it can add **98 mU/min** above basal but remove only **16.7 mU/min** → windup and
   undershoot.
3. Feedforward fixes what feedback can't: a **15-min pre-bolus** keeps glucose in band (**peak 107.9, nadir 62.2**).
4. Stability limits: the loop tolerates about **48 min** of total delay in theory (phase margin 58.6°), but only
   **43.4 min** once 5-min sampling is included (found by the Python reference).
(All four numbers are computed by the site's engine or shipped from the independent Python reference; use only these, or
ask Andrew.)

It is also an **AI project** (the assignment's main point): Claude wrote the plan, Gemini critiqued it, Andrew decided each
critique point, then **two models built the site independently** from the same spec and were graded by the same tests.
Andrew chose Claude's build (the site root); Gemini's is kept frozen at `/gemini/` as evidence.

**Audience:** Prof. Co and classmates, on a laptop/projector during a presented video and Q&A, and on phones. The rubric
weighs resourcefulness/creativity, artifacts (plan/comparison, web app, PowerPoint), the presentation, and Q&A equally.

## 2. Links and files

- **Live site:** https://be-aa8.github.io/PD-C/ (Claude's build; redeployed automatically on every push to `main`)
- **Gemini's build (frozen, don't redesign):** https://be-aa8.github.io/PD-C/gemini/
- **Repository (public):** https://github.com/BE-aa8/PD-C — the site is in `site/`
- **Uploaded with this brief:** `chatgpt-ux-bundle.txt` (this brief + the UI source files) and `screenshots/`
  (desktop light/dark and phone, current state).

## 3. Current structure: one page, 7 tabs (`site/index.html`)

| Tab | Content now | Size |
|---|---|---|
| **Overview** | Text intro, 3 cards, "course concepts" lists, "why it's an AI project", a scope callout | text only, no visuals |
| **Simulator** | Left: control panel (22 presets + ~25 controls in 6 collapsible groups, sticky on desktop). Right: warnings, pass/fail badge, 5 KPI tiles, P1 glucose chart, P2 insulin (stacked), P3 meal, metrics table (12 rows with equations), P8 saved-runs overlay, P10 and P11 live sweeps, a "why real systems are harder" callout | 12 equations, 6 charts |
| **Theory** | 5 numbered sections of equation cards (model, units check, linearization, transfer functions, nonlinear gain + P4, half rule vs fits + P5, feedforward/bolus + chart), callouts | 21 equations, 3 charts |
| **Control Design** | Tuning inputs (IMC or manual gains), IMC step-by-step cards, discrete PID and anti-windup cards, live SVG block diagram, stability-margin cards, P6 Bode, P7 Nyquist, sampled-data note, P9 PID vs MPC (precomputed) | 18 equations, 3 charts, 1 diagram |
| **AI Workflow** | Placeholder (will hold the plan → critique → decisions → two builds → comparison story) | — |
| **Video & Transcript** | Placeholder (YouTube embed + verbatim auto-transcript after recording) | — |
| **References** | Placeholder list of sources + contributions | — |

Every page has the disclaimer banner under the title and in the footer.

## 4. Stack and what may change

Plain HTML/CSS/JS (ES modules). **No framework, no build step, no backend.** CDN libraries pinned: **Plotly 2.35.2** and
**KaTeX 0.16.11**. Hosted on GitHub Pages from `site/`.

| File | Role | Can the redesign change it? |
|---|---|---|
| `site/index.html` | Header, tabs, panels, static text | **Yes** (keep the IDs in §6) |
| `site/css/style.css` | All styling; colors are CSS variables on `:root`, dark mode via `prefers-color-scheme` | **Yes, freely** |
| `site/js/app.js` | Builds the controls (from `SIM_SPEC`/`DESIGN_SPEC` tables), cards, charts, diagram, tabs | **Yes, for presentation** (layout, markup, chart styling); keep the behavior and data |
| `site/js/model.js` | The simulation engine (pure functions) | **No** |
| `site/js/data.js` | Generated parameters with citations | **No** |
| `site/gemini/**` | Gemini's build (comparison evidence) | **No, never** |

## 5. Rules the design must respect

- **Disclaimer on every page, clearly visible:** "Educational process-control model of an illustrative textbook patient.
  Not medical advice. Not for dosing decisions." A polished "tech company" look must **not** make it read like a real
  medical device or product: no product names, device mock-ups, health claims, stock photos of patients, drug names,
  carb ratios or dosing guidance.
- Every calculation shown keeps its **equation (KaTeX), units, and a one-line physical interpretation** visible. You can
  restyle, group, or progressively disclose the worked numbers, but the equation itself stays visible on each card.
- **Every calculation has a chart**, and the site should invite "what if?" exploration. Keep all charts (P1–P11 plus the
  bolus chart) and the block diagram.
- **No new numbers or claims.** Use only what's on the site or in `data.js`; `[TO VERIFY]` marks must stay visible.
- Math stays at a 3rd/4th-year ChemE undergraduate level.
- Accessibility: keyboard navigation, visible focus, sufficient contrast in light **and** dark, `prefers-reduced-motion`
  respected (scroll effects must switch off), works at 375 px.
- Performance: the engine runs ~25 full simulations per slider move for the live sweeps (≈ 5 ms each); heavy scroll
  effects or many animated layers can make sliders laggy on phones.
- Fonts: system stack or at most one or two web fonts. No new JS libraries unless clearly worth it (and pinned).

## 6. Automated tests (run on every push; a redesign phase only ships if they pass)

**`tests/browser-smoke.mjs`** (on `/` and `/gemini/`, 1280×800 and 375×812, light and dark):
- At least **7 visible tab controls**, matched by `[role="tab"]`, `nav a[href^="#"]`, `button[data-tab]` or `a[data-tab]`;
  clicking each shows its content. Don't put those attributes on non-tab elements.
- Every visible `input[type=range]` must change a chart or visible text when moved (no decorative sliders).
- No visible `NaN`, `undefined` or `Infinity`; no `.katex-error`; the Theory tab shows KaTeX; every visible
  `.js-plotly-plot` renders; zero console errors; **no horizontal page scroll at 375 px** (wide things scroll inside
  their own box).

**`tests/browser-content.mjs`** (Claude's site, light and dark) checks the charts show the right data. It relies on:
`[data-tab="theory"]`, `[data-tab="design"]`, `#sim-preset`, `#sim-kpis .kpi .v` (first = peak, second = nadir),
`#sim-controls .seg button[data-v="manual"|"imc"]`, `#sim-Kc_man`, chart divs `#p1 #p4 #p9 #p10`, `#ds-margins`,
`#mpc-case`, `#jump-btn` (phone button that scrolls to `#sim-controls`).

**Other IDs the JS uses (keep):** tab buttons `#tab-<name>` with `data-tab`, panels `#panel-<name>`; `#sim-controls`,
`#sim-top`, `#sim-warnings`, `#sim-badge`, `#band-select`, `#sim-kpis`, `#metrics-table`, `#save-run`, `#clear-runs`,
`#saved-list`, `#p11-cap`, chart divs `#p1`–`#p11` and `#p-bolus`, `#theory-cards`, `#design-cards`, `#design-ctl`,
`#block-diagram`, `#tauc-guideline`, `#ref-list`, `#lib-warning`. Generated controls use ids `sim-<key>`, `ds-<key>`,
`th-<key>`, `thff-<key>`.

**Engine tests (`npm test`, 65 checks)** don't touch the UI but must stay green.

## 7. Known UX problems (a starting list; please add your own from the screenshots)

1. **No visual story.** Overview is text-only; nothing shows the loop, the meal spike, or the headline result before the
   user reaches the Simulator. A hero that tells the §1 story (e.g. glucose curve without vs with feedforward, the
   lopsided pump authority) would carry the presentation.
2. **Simulator is one long page.** Cause and effect are far apart for the lower charts; KPI tiles, badge and warnings
   compete; the 12-row metrics table is dense.
3. **Visual hierarchy and typography:** plain header and tabs, no clear type scale; cards are dense and equal-weight.
4. **Theory and Control Design are long lists of cards** with no table of contents or narrative grouping.
5. **Block diagram** is functional but plain; labels crowd on phones.
6. **Placeholders** (AI Workflow, Video, References) look unfinished; they'll be filled later, but their layout can be
   designed now.
7. **Gemini's build isn't linked** from the site yet (it should be reachable from AI Workflow, clearly labelled).
8. **Projector use:** check contrast and font sizes at 1280×720.
9. Dark mode exists but is just inverted colors; it should feel designed (or the design could pick one primary theme and
   make the other follow).

## 8. What Andrew needs back from you

1. A **design direction**: concept, layout system, type scale, color tokens for light and dark, chart styling (Plotly
   colors, fonts, gridlines), component styles (cards, KPI tiles, controls, callouts, tabs or navigation), motion rules.
2. A **page-by-page plan** for the 7 tabs (what moves where, what becomes a story section, what gets collapsed).
3. **Phases**, each small enough to implement and test on its own, in order, with what each phase may break among the
   tests in §6.
4. Anything you need clarified, as questions to Andrew.

## 9. How it's tested and shipped (for reference)

```
python3 -m http.server 8000 -d site          # open http://localhost:8000
npm test                                       # engine: 65 checks
node tests/browser-smoke.mjs --base http://localhost:8000 --paths /,/gemini/ --out /tmp/smoke
node tests/browser-content.mjs --base http://localhost:8000
```
GitHub Actions runs all of this on every push, deploys `site/` to GitHub Pages only if everything passes, then re-runs the
browser tests on the live URL.
