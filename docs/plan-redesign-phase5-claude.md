# Redesign Phase 5: Theory and Control Design (Claude)

## Context
Andrew confirmed the 3D fix works ("it works now, start phase 5"). Phase 5 from the master plan
(`docs/plan-redesign-master-claude.md` §3) and ChatGPT's brief (§3–4 of `docs/redesign-brief-chatgpt.md`):
- **Theory** becomes an "interactive technical publication" with the brief's 5 chapters, a chapter navigator and
  editorial headings.
- **Control Design** becomes an "engineering workspace" in the brief's 8 sections. The **block diagram** gets the most
  attention: clearer, interactive, and a real phone layout.
- Added after the Phase 3 review: the same phone treatment for the **Overview loop diagram**.

Presentation only: `model.js`, `data.js` and `site/gemini/**` are untouched. Every equation, unit, meaning, chart,
control and tested id stays (`#theory-cards`, `#design-cards`, `#design-ctl`, `#block-diagram`, `#tauc-guideline`,
`#ds-margins`, `#mpc-case` stays a `<select>`, `#p4`–`#p9`, `#p-bolus`). On approval, save this as
`docs/plan-redesign-phase5-claude.md`, build, and stop for review.

## Shared: chapter navigator (Theory and Control Design)
- **Desktop (≥ 1100 px):** a sticky list of numbered chapters beside the content, highlighting the chapter in view
  (IntersectionObserver).
- **Narrower screens:** a compact "Jump to…" `<select>` that sticks under the header.
- Built from **buttons, not `<nav>` links**: the smoke test counts `nav a[href^="#"]` as tabs.
- Clicking scrolls to the chapter. Built once per tab from a list of `{id, num, title}`.

## Theory (`buildTheory` in `site/js/app.js`)
- **Editorial chapters:** a large number ("01"), the title, a 1–2 sentence intro, then the existing cards in the same
  two-up grids. The brief's chapter names, regrouping today's 5 sections without dropping any card:
  1. **Nonlinear glucose–insulin model:** ODEs (`th-ode`) and the parameter table.
  2. **Units and physical interpretation:** `th-units`, basal state (`th-basal`), steady state (`th-ss`).
  3. **Linearization and transfer functions:** `th-abc`, `th-tf`.
  4. **Nonlinear gain and half-rule analysis:** `th-gain` with P4, `th-half`, `th-fits`, P5.
  5. **Feedforward and bolus:** `th-ff`, `th-bolus`, bolus chart.
- **Equation containers:** cards get a distinct equation well (tinted surface, more padding, larger KaTeX). Units and
  meaning stay visible directly under each equation.
- **Charts sit beside their equations** (already two-up); the P4/P5 slider block is restyled like the Simulator rail.
- The two callouts ("Why real systems are harder", "Glucagon and split-range") close chapter 5.
- Every equation stays visible: no derivation is hidden, because the brief requires it.

## Control Design (`buildDesign` / `renderDesign` / `diagramSVG`)
The brief's 8 sections, each with a numbered editorial header:
1. **Controller configuration:** `#design-ctl` becomes a full-width config bar. The controls sit in a responsive grid
   instead of one tall column, with IMC/Manual as the first control and the τc = θ guideline button and note kept.
2. **IMC tuning methodology:** Steps 1–3 (`ds-step1..3`) as a numbered three-step sequence with connectors (stacked on
   phones).
3. **Discrete PID implementation** (`ds-pid`) and 4. **Anti-windup** (`ds-aw`), two-up.
5. **Block diagram as a viewer frame:**
   - **Redrawn SVG:** more spacing, consistent arrowheads, labelled signals (e, u, U, G, G_m, D); feedback,
     disturbance and feedforward paths in distinct colours with a small legend.
   - **Interactive:** hover, tap or focus a block (they are buttons) to highlight it and its signal path. A side panel
     shows that block's transfer function (KaTeX) and live numbers: Gc with Kc/τI/τD, pump limits, Gp with Kp and
     the three lags from `linearModel()`, Gd with Kd, Gff with Kf and t_pre, the sensor delay and Ts, the set point.
   - **Phone (< 700 px):** a purpose-drawn **vertical** diagram with the same blocks, interactions and numbers,
     instead of a sideways-scrolling wide one. It switches with a `matchMedia` listener.
6. **Stability margins:**
   - a metric strip on top: PM with delay, GM, ω_c, total tolerable delay. Big numbers, flagged when PM < 30° or
     GM < 1.7 (textbook rule-of-thumb ranges, cited to Seborg [TO VERIFY]).
   - the existing margin **cards stay below**, with their equations, units and meanings.
7. **Bode and Nyquist:** two-up, unchanged.
8. **PID vs MPC:** the `#mpc-case` select restyled as a labelled control in the panel header; the offline-computation
   note kept.
- The sampled-data callout stays after section 7.

## Overview loop diagram on phones (`buildLoop`)
Below 560 px, a vertical cycle replaces the ellipse:
- The six blocks are stacked in loop order with down-arrows: Meal → Glucose → Sensor → Controller → Pump → Insulin.
- A return arrow on the side closes the loop.
- The text is readable (≥ 13 px) and the info card works the same; desktop is unchanged.

## Files
- `site/js/app.js`: `buildTheory`, `buildDesign`, `renderDesign`, `diagramSVG` (wide and vertical), new block-info
  data and handlers, a `chapterNav()` helper, and the `buildLoop` phone variant. Reuse `card()`, `renderTex()`, `T()`,
  `tf()`, `fmt()`, `buildControls()`, `effective()`, `tuningOf()` and `LM`.
- `site/css/style.css`: chapter headers, navigator, equation well, config bar, stepper, diagram frame and info panel,
  margin metric strip, phone loop.
- `tests/browser-content.mjs`: new checks:
  - the Theory navigator lists 5 chapters and jumps to each;
  - the Control Design navigator lists 8;
  - tapping each diagram block fills the info panel, and the controller block shows the current Kc (it follows a
    τc change);
  - the vertical diagram renders at 375 px with no horizontal scroll;
  - the margin metric strip shows the reference PM and GM;
  - the Overview's vertical loop renders at 375 px.
- Records: plan doc, process log Part 20, comparison note.

## Verification
- `npm test` (65); smoke on `/`, `/?theme=light` and `/gemini/` with the device in light and dark.
- Content test in both themes; the extended slider/preset/manual check, which also covers the Theory and Design
  sliders.
- Screenshots of Theory, Control Design and the Overview loop at 1280/1024/768/375 in both themes, reviewed.
- Then commit, push `claude/site-build`, fast-forward `main`, and wait for the CI deploy and live tests.
