# Redesign Phase 7: final polish and validation (Claude)

## Context
Andrew: "start phase 7". This is the last phase of ChatGPT's brief (`docs/redesign-brief-chatgpt.md`, Phase 7). The
brief asks for a review of:
- desktop and mobile; light and dark themes;
- typography, contrast, accessibility;
- animations and performance;
- all existing tests,

and to resolve visual inconsistencies. Phases 1–6 are live and green.

This phase is an **audit first, fixes second**: measure, list the findings, fix them, then re-measure. It is
presentation only: `model.js`, `data.js` and `site/gemini/**` are untouched, and every id, equation, chart, control,
[TO VERIFY] flag and the disclaimer stays. On approval, save this as `docs/plan-redesign-phase7-claude.md`.

## 1. Audit (measured, before any change)
- **Accessibility:** run axe-core on all 7 tabs in both themes, at 1280 and 375 px. Also check by hand:
  - keyboard: Tab order, visible focus, arrow keys in the tab list, the chapter navigators, diagram blocks, timeline and
    viewer tools;
  - screen-reader labels; heading order per tab.
- **Contrast:** axe's colour-contrast rule, plus the token pairs checked in Phase 1 re-run for the components added since
  (chips, step numbers, metric strip, timeline, `.tv` flags, placeholder tags).
- **Performance** (headless Chromium, 4× CPU throttle, phone viewport):
  - first contentful paint and the time to an interactive Simulator;
  - bytes loaded per tab;
  - long tasks while dragging the τc slider (the brief warns that about 25 simulations run per slider move);
  - scroll smoothness past the sticky controls rail.
- **Motion:** with `prefers-reduced-motion: reduce`, nothing may animate (checked via `document.getAnimations()`).
- **Visual consistency:**
  - a screenshot matrix of 7 tabs × 4 widths × 2 themes, reviewed as contact sheets;
  - checks on page-title length and style, section spacing, card and table styles, button styles, and the empty or
    leftover CSS rules from before the redesign.

## 2. Fixes already identified from the code (to be confirmed by the audit)
- **Render-blocking libraries:** Plotly (~3.6 MB) and KaTeX load as blocking scripts in `<head>`. Add `defer`. Module
  scripts run after deferred classic scripts, in order, so `app.js` still sees `window.Plotly`/`katex`. Expected: much
  faster first paint, above all on the Overview, which needs neither.
- **Skip link:** add "Skip to content", the first focusable element, jumping to `<main>`.
- **Favicon** (the loop glyph as an inline SVG data URL), which also removes a 404 on every load. Add Open Graph and
  Twitter meta with a 1200×630 preview image rendered from the live Overview hero (for sharing the link, e.g. in the
  YouTube description).
- **Dead CSS:** remove rules left from replaced components (old block-diagram `.box/.sum/.wire` rules, the unused
  `.placeholder` tab layout, the old `.section` headings) after a selector-usage check.
- **Page titles:** Theory and Control Design titles run to three lines; shorten them to match the others ("Theory",
  "Control design") and move the detail into the lead.

## 3. Fixes from the audit
Each finding becomes a row in the process log: what it was, the fix, and before/after numbers. Expected kinds of fix:
- missing labels or roles;
- contrast tweaks to tokens, without changing the design;
- focus styles;
- `content-visibility` / lazy rendering for off-screen charts if the measurements show it is needed;
- spacing and typography alignment across tabs.

Anything that would change the look in a noticeable way gets a screenshot pair in the log.

## 4. Lasting checks (CI)
- New `tests/browser-a11y.mjs`:
  - injects axe-core from jsDelivr (pinned version, no npm dependency added; locally routed like Plotly);
  - runs on every tab in both themes and at phone width;
  - fails on any "serious" or "critical" violation;
  - any rule excluded for Plotly's own SVG internals is listed in the file with the reason.
- Added to CI's local and live jobs next to the content test.
- Content test additions:
  - with reduced motion, nothing animates;
  - the skip link focuses `<main>`;
  - Plotly and KaTeX scripts are deferred and the charts still render;
  - the favicon and preview image return 200.

## Files
- `site/index.html` (head, skip link, titles), `site/css/style.css` (fixes, dead-rule removal), `site/js/app.js` (only
  if a fix needs it), `site/og-preview.png`.
- `tests/browser-a11y.mjs` (new), `tests/browser-content.mjs`, `.github/workflows/ci.yml`.
- Records: plan doc, process log Part 22 (audit table with before/after), comparison note.

## Verification
- `npm test`; smoke on `/`, `/?theme=light` and `/gemini/` in both device schemes.
- Content test in both themes; the new a11y test (0 serious/critical); extended check.
- Before/after performance table; the full screenshot matrix reviewed.
- Commit, push, fast-forward `main`, and wait for the CI deploy and live tests, which include the a11y test on the
  live site.
