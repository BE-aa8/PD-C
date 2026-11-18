# Plan: redesign Phase 1 (design foundation) — audit and plan

**Author:** Claude Code (Opus 5.5) · **Date:** 2026-11-18 · **Status: APPROVED by Andrew** · Brief: `docs/redesign-brief-chatgpt.md` (ChatGPT)


## Context
ChatGPT (third model) wrote a 7-phase redesign brief for Claude's site from `docs/ux-brief-for-chatgpt.md`. Its first task
for Claude: audit the codebase and present a Phase 1 plan before touching code. Andrew's decisions are fixed (dark primary,
designed light mode, moderate motion, visualization-first simulator, no framework). Andrew also chose: **dark by default for
everyone, with a header toggle to light that is remembered.** Phase 1 = design foundation only (tokens, type, shape, themes,
chart theming); no page-structure changes. On approval, this plan is saved as `docs/plan-redesign-phase1-claude.md` and
ChatGPT's brief verbatim as `docs/redesign-brief-chatgpt.md`.

## 1. What the audit found
- **Shell:** `site/index.html` (193 lines): header (title, subtitle, disclaimer, `nav.tabs` with 7 `button[role=tab][data-tab]`),
  7 `section[role=tabpanel]` panels, a phone `#jump-btn`, footer disclaimer. Static prose lives here (Overview, placeholders).
- **Styling:** `site/css/style.css` (207 lines). ~25 CSS variables on `:root` (`--bg --surface --surface-2 --border --text
  --text-2 --muted --accent --s1…--s8 --band --grid --good/bad/warn-*`), dark mode via `prefers-color-scheme` with a
  `:root[data-theme]` override already scaffolded. System font stack; one radius (10 px); one shadow. No spacing/type scale.
- **Behaviour (`site/js/app.js`, 972 lines):** one `state` object → `setState()` → rAF render of the active tab only
  (`dirty` flags). Controls are generated from `SIM_SPEC` / `DESIGN_SPEC` / Theory spec tables by `buildControls()` (ids
  `sim-* ds-* th-* thff-*`, `details.grp` groups, `.seg` buttons). Theory/Design cards are HTML strings from `card()` +
  `renderTex()` (KaTeX). All charts go through `plot()` → `Plotly.react` with `baseLayout()`, whose colours come from CSS
  variables via `C()` (s1–s8, text, grid, band…) and whose font is a hard-coded system stack. Block diagram = SVG string
  from `diagramSVG()` styled by `.diagram` CSS classes. Theme change → `matchMedia` listener marks all tabs dirty.
- **Engine/data:** `model.js` (474 lines, pure), `data.js` (generated) — untouched by the redesign.
- **Things in ChatGPT's brief that don't match the code (to settle in later phases, not Phase 1):**
  - There is **no "?" help toggle** today (that was the separations site). Long explanations would need a *new* disclosure
    component (Phase 4), keeping all text.
  - **Imagery:** the repo has no photos and none may be stock/patient/device imagery. Proposed for Phase 3: the "cinematic"
    hero visual is generated in SVG/canvas from the model's real trajectories (layered glucose curves, the band, a
    sensor-sample rhythm), no raster images — to confirm with Andrew at Phase 3.
  - Theory chapter list in the brief merges/renames today's 5 sections; content is kept either way (Phase 5).
  - Google-hosted fonts: self-hosting instead (below) avoids a third-party request and keeps the tests deterministic.

## 2. Phase 1 design system (what gets built)
**Tokens in `style.css`** (new layer at the top; old variable names kept as aliases so `app.js` and every existing rule keep
working until later phases replace them):
- *Colour:* the brief's palettes as `--bg --surface --surface-elev --text --text-2 --text-3 --accent --data --warn --crit`,
  plus `--line` (hairline borders), `--band` (54–144 shading), `--focus`. **Contrast fix needed:** in light mode the brief's
  accent/blue/amber/red reach only 3.4–4.5:1 on the background (fails 4.5:1 for text). They stay as fill/line colours;
  darker `--*-ink` variants are added for text so all text passes WCAG AA. Dark-mode values all pass (4.7–15.7:1).
- *Chart palette:* 6–8 categorical series derived from the brief's hues (accent green, data blue, amber, red + muted
  partners), checked with the dataviz skill's `validate_palette.js` for both themes (P5 and P8 draw 5–6 series).
- *Type:* **Manrope** (display) and **Inter** (body), **self-hosted** variable `woff2` from npm `@fontsource-variable/*`
  (OFL-1.1; licence files committed), `font-display: swap`, preloaded. Fluid scale with `clamp()`: hero 44→76, page 32→52,
  section 26→36, card 18→22, body 16→17, small 13–14 px. KaTeX keeps its own fonts.
- *Space/shape/depth:* 4-px spacing scale (`--sp-1…--sp-10`), radii (`--r-xl 24`, `--r-lg 18`, `--r-md 14`, `--r-sm 10`,
  pill), 3 shadow levels tuned per theme, one restrained translucent surface (`--glass`, used later only on simulator
  controls and floating elements).
- *Motion:* `--dur-fast/med/slow`, one easing; a global `prefers-reduced-motion` block that zeroes transitions/animations.
- *Base styles:* body/headings/links/code/tables/focus ring, and today's components (`.card .panel .btn .seg .badge .kpi
  .callout .warn .placeholder details.grp .diagram`) re-skinned with the tokens — same markup, no layout changes.

**Theme mechanism:** `<html data-theme="dark">` by default. A tiny inline script in `<head>` (before CSS paints) applies a
saved choice (`localStorage`, wrapped in try/catch) or a `?theme=light|dark` URL parameter. A small theme toggle button goes
in the current header (restyled properly in Phase 2). The `prefers-color-scheme` rules are removed. `app.js`: a
`MutationObserver` on `data-theme` replaces the `matchMedia` listener so charts re-theme instantly.

**Charts (`app.js`, presentation only):** `baseLayout()` uses Inter, the new text/grid tokens, lighter gridlines, consistent
legend/hover styling; `C()` reads the new tokens. No trace data, ranges or calculations change.

## 3. Elements that need special protection
- Every id/selector listed in §6 of the brief and Part 7 of ChatGPT's prompt (tabs `#tab-*`/`#panel-*`/`data-tab`,
  `#sim-*`, `#p1`–`#p11`, `#p-bolus`, `#ds-margins`, `#mpc-case`, `#jump-btn`, `.seg button[data-v]`, `#sim-kpis .kpi .v`…).
- The theme toggle must be a plain `button` with no `role="tab"`/`data-tab`, outside `nav`, and must not contain text that
  could read as a tab label.
- The disclaimer text (header and footer) — restyled, never shortened.
- `model.js`, `data.js`, `site/gemini/**` — not touched.

## 4. Files Phase 1 changes
- `site/css/style.css` — token layer + re-skinned base components (largest change).
- `site/index.html` — font preloads, inline theme bootstrap, theme toggle button.
- `site/js/app.js` — `C()`/`baseLayout()` tokens and font, theme observer, toggle handler. No logic changes.
- `site/fonts/` — Inter and Manrope variable `woff2` + `OFL.txt` (new).
- `.github/workflows/ci.yml` — one extra smoke run of `/?theme=light` so light mode stays covered (the smoke runs with
  `--scheme light` will now render dark, since the site no longer follows the device).
- `tests/browser-content.mjs` — add: default is dark; toggle switches to light and persists after reload; P1 re-themes.
- Docs: the two plan/brief files above, process log Part 15.

## 5. Risks to the automated tests (and mitigations)
- **Light-mode coverage silently lost** (site ignores the device setting) → `?theme=light` smoke run in CI + toggle test.
- **Console errors from fonts** (smoke fails on any) → self-hosted files with correct relative paths; byte check already
  covers deployed files.
- **Horizontal scroll at 375 px** from bigger type → `clamp()` sizes, `overflow-wrap`, equations and tables keep their own
  scroll boxes; checked on every tab at 375 px.
- **Chart re-theme** relies on `getComputedStyle` at render time → all tabs marked dirty on toggle; content test checks it.
- **Text checks** (`NaN/undefined/Infinity`) → toggle label is "Light"/"Dark" only.
- **Contrast regressions** → script check of token pairs (AA for text) in both themes before commit.

## Verification
`npm test` 65/65; local smoke (dark default, `/?theme=light`, `/gemini/`) and content test with the CDN served locally;
screenshots of every tab at 1280 and 375 px in both themes reviewed; then push → CI deploy → live tests green.
Stop after Phase 1 and show screenshots for review before Phase 2.
