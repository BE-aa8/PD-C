# Redesign Phase 4: Simulator workspace (Claude)

## Context
Phase 3 (Overview + 3D pancreas) is live and every CI job passed (run 44431523300, including the live-site tests). Andrew
chose to fold the phone loop-diagram fix into Phase 5, so next is **Phase 4** from the approved master plan
(`docs/plan-redesign-master-claude.md` §3): turn the Simulator from a long stack of equal cards into a workspace where
the glucose response is the subject and the controls are quieter. Presentation and layout only: `model.js`, `data.js`,
`site/gemini/**`, every control, preset, chart id, equation, unit and the disclaimer stay. On approval, save this plan as
`docs/plan-redesign-phase4-claude.md`, then build and stop for review.

## Today (site/index.html `#panel-simulator`, site/js/app.js)
Controls column (`#sim-controls`, built by `buildControls(SIM_SPEC)`, 6 `details.grp` groups, Preset first) | right
column: `#sim-top`, warnings, badge + band select, 5 KPI tiles, P1 (420 px), P2/P3 two-up, 12-row metrics table, P8 saved
runs, P10/P11 sweeps, "Why real systems are harder" callout. Phone: charts first, floating `#jump-btn`.

## Changes
1. **Workspace header** (top of the right column, in `#sim-top`): the Preset select (the existing `#sim-preset` node,
   moved out of the controls after `buildControls`, so its handler and id are unchanged), status badge `#sim-badge`, band
   select `#band-select`, and a compact toolbar: **Save run** (`#save-run`, moved), **Reset** (new: `applyPreset('default')`),
   **?** (new help disclosure, see 6). Wraps to two rows on phones.
2. **KPI strip:** same 5 tiles in the same order (tests read `.kpi .v` by index); Peak and Nadir larger, tinted
   `--crit`/`--good` ink when outside/inside the band, each with its time; the other three smaller.
3. **One instrument:** P1 at ≈ 520 px (360 px on phones), P2 and P3 stacked directly below it (≈ 190 px each) in the same
   panel, same left margin and same x range, hairline separators, titles as small in-chart labels; captions (with their
   equations) kept under each. Zoom/pan on any of the three updates the other two (`plotly_relayout` → shared x range).
   Separate divs `#p1 #p2 #p3` kept (tests and smoke check them by id).
4. **Quieter controls rail:** glass surface on desktop (sticky, as now); each group gets a one-line description under its
   summary (new `desc` field in `SIM_SPEC`, e.g. "How the controller is tuned"); tighter spacing; Preset group removed
   from the rail (now in the header). Phone: unchanged order (charts first) and `#jump-btn` kept.
5. **Below the instrument, three sections with eyebrows:**
   - **Compare runs:** P8 with the saved runs as removable chips (`#saved-list` kept, styled as chips) and `#clear-runs`.
   - **Analysis:** P10/P11 two-up, unchanged content (kept open, not collapsed: Plotly can't size charts inside closed
     disclosures, and the smoke test should still see them).
   - **Detailed metrics:** the 12-row table (`#metrics-table`) inside a `<details>` disclosure ("Detailed metrics: 12
     measures with equations and units"), open by default on desktop, closed on phones.
   The "Why real systems are harder" callout stays at the end.
6. **Help "?" disclosure** (first use of the master plan's pattern; reused in Phase 5): a small button toggling an inline
   panel (`aria-expanded`/`aria-controls`) with how to read the workspace and the numerical method sentence now in the
   lead (RK4, dt = 0.1 min, Ts = 5 min, ZOH). The lead shortens to one sentence; nothing is deleted.

## Files
- `site/index.html`: restructure `#panel-simulator` markup (all ids kept).
- `site/css/style.css`: workspace header, KPI emphasis, instrument stack, glass rail, chips, disclosure + help styles,
  phone rules.
- `site/js/app.js`: move the preset node after `buildControls`; `desc` in `SIM_SPEC` + render in `buildControls`; Reset
  and help handlers; KPI emphasis classes in `renderSimulator`; P1/P2/P3 sizes, margins and synced x range; chip list in
  `renderSaved` (remove one run); open state of the metrics disclosure by width. Reuse `baseLayout`, `plot`, `bandOf`,
  `applyPreset`, `decimate`.
- `tests/browser-content.mjs`: add checks: Reset restores the default peak; help toggles `aria-expanded`; P1/P2/P3 share
  the x range after a zoom on P1; removing a saved-run chip removes its P8 trace; KPI peak tile flags out-of-band.
- Records: `docs/plan-redesign-phase4-claude.md`, process log Part 18, comparison post-change note; master plan §3
  Phase 5 line gains "phone layout for both loop diagrams (Overview + Control Design)".

## Verification
`npm test` (65); smoke `/`, `/?theme=light`, `/gemini/` in both device schemes; content test both themes (39 + new);
extended slider/preset/manual check; screenshots of the Simulator at 1280/1024/768/375 in both themes, reviewed; no
horizontal scroll at 375; then commit, push `claude/site-build`, fast-forward `main`, wait for CI deploy + live tests.
