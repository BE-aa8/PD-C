# Plan: simulator improvements, round 1 (Claude's site only)

**Author:** Claude Code (Opus 5.5) · **Date:** 2026-11-18 · **Status: APPROVED by Andrew**

## Context
Andrew prefers Claude's build and wants to move forward with it alone. Gemini's build stays **frozen at `/gemini/`**
(deployed, unchanged, the comparison artefact, as in separations). He chose to improve the simulator before writing the
content tabs, and picked all four candidate improvements: phone access to the controls, a manual tuning mode, input-warning
fixes in the engine, and browser tests that check chart *content* (the gap the comparison exposed). Every push to `main`
redeploys GitHub Pages and re-tests the live site automatically.

Per `CLAUDE.md`, the plan is also saved as `docs/plan-simulator-round1-claude.md`.

## 1. Phones: controls reachable (`site/css/style.css`, `site/js/app.js`, `site/index.html`)
- A floating button (fixed, bottom-right, ≤ 900 px wide only, Simulator tab only): "⚙ Controls" scrolls to the control
  panel; while the controls are on screen it becomes "📈 Charts" and scrolls back to the badge/KPIs. `IntersectionObserver`
  switches the label. No `data-tab`/`nav` markup, so the smoke test doesn't mistake it for a tab.
- Control groups become `<details><summary>` (built in `buildControls()`): all open on desktop; on narrow screens only
  "Preset" and "Controller" start open. Hidden sliders stay in the DOM and keep their values.

## 2. Manual tuning mode (`site/js/app.js`)
- New state `tuning_mode: 'imc' | 'manual'` plus `Kc_man`, `tauI_man`, `tauD_man`. A segmented toggle "Tuning: IMC | Manual"
  in the Controller group (Simulator) and in the Control Design inputs.
- Switching to Manual copies the current IMC gains into the manual sliders (so nothing jumps). Sliders: Kc −2.00…+0.50
  (step 0.01, so a wrong sign can be tried and gets a warning), τI 5…300 min, τD 0…60 min (τD hidden in PI/P, τI in P).
  τc / model / design-delay / ZOH controls hide in Manual mode.
- One function `gainsOf(state)` feeds `inputsOf()`, `effective()`, the margins, Bode/Nyquist, and the block diagram.
- Control Design in Manual mode: the IMC step cards stay, labelled "IMC values for reference; the loop uses your manual
  gains", with a card showing the manual Kc/τI/τD and the IMC ratio Kc/Kc,IMC.
- P10 in Manual mode sweeps **Kc from 0.25× to 3× the current value** (peak and nadir vs Kc, current marked); in IMC mode it
  stays the τc sweep. Title/caption/axis switch with the mode.
- Presets reset to IMC mode.

## 3. Engine input warnings (`site/js/model.js`; must keep `npm test` 65/65)
- Invalid set-point steps (non-finite time, value ≤ 0) → warning instead of being dropped silently.
- `controller: 'pid'` with Kc > 0 → warning ("Kc > 0 is positive feedback for this reverse-acting process…").
- Unknown `controller`, `mode`, `anti_windup` or `fault` names → warning and the default is used.
- **Not done:** copying the reference's full-precision default gains from `tests/expected.json`. Plan v2 §13 forbids
  hard-coding computed values (only `DATA` may be); the computed gains differ by 6.5 × 10⁻⁷ relative, far inside every
  tolerance. Recorded as a deliberate choice.
- Re-run `tools/compare-builds.mjs` and check the robustness rows change only where intended.

## 4. Chart-content tests (`tests/browser-content.mjs`, new; Claude's site only)
Playwright, `--base` like the smoke test, light + dark. In the page it imports `./js/model.js` and `./js/data.js` and checks
what the charts and text actually show:
- P1 true-glucose trace equals `simulate()` for the default inputs (sampled points); KPI peak/nadir text equals `metrics()`.
- Preset "15-min pre-bolus": KPI peak and nadir equal `tests/expected.json` (`prebolus_15`) within the test tolerances.
- P4 nonlinear-gain curve equals `nonlinearGain()`; P9 traces equal `DATA.mpcComparison` (both cases, via the toggle).
- Control Design default: PM text 58.6°, delay-free 74.0°, GM 3.47 (from `expected.json` margins).
- P10 current marker sits at the current τc (IMC) / current Kc (Manual); Manual mode with the copied gains gives the same
  peak as IMC, and changing Kc changes it.
- 375 px: the floating button exists, opens the controls, and the page still has no horizontal scroll.
CI: added to the `browser` job (local server) and the `live` job (live URL). `tests/browser-smoke.mjs` is unchanged.

## 5. Records
- `docs/comparison.md`: a short "Post-comparison changes" note (as separations did): the comparison describes Claude's
  build at `ce6a77f`; later changes are listed with commits.
- `docs/process-log.md` Part 13: prompts verbatim, the choices above (including the skipped full-precision item), results.

## Verification
- `npm test` 65/65; `node tools/compare-builds.mjs …` re-run.
- Local (CDN served from the scratch npm copies, as before): smoke test 0 failures on `/` and `/gemini/`, light + dark;
  `browser-content` passes; my extended slider/preset check (all sliders incl. manual ones, every preset, both tuning modes)
  finds no NaN, console errors or dead sliders; screenshots reviewed at 1280 px and 375 px.
- Push `claude/site-build`, fast-forward `main` → CI deploys → `live` job green (byte check, smoke, content test).
