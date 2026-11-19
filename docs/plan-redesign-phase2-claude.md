# Plan: redesign Phase 2 — global navigation and layout

**Author:** Claude Code (Opus 5.5) · **Date:** 2026-11-18 · **Status: APPROVED by Andrew** · Brief: `docs/redesign-brief-chatgpt.md`


## Context
Phase 1 (design tokens, fonts, dark-by-default theme) is live and green on CI, including the light-theme runs on the live
site. Andrew asked to start Phase 2 of ChatGPT's brief (`docs/redesign-brief-chatgpt.md`): header, navigation, active-tab
indicator, main page containers, disclaimer, footer, shared component styling. Tab ids and behaviour stay; no page content
is redesigned yet (that is Phases 3–6). On approval this plan is saved as `docs/plan-redesign-phase2-claude.md`.

## Design
**1. Top bar (sticky, all widths).** One slim translucent bar (`--glass` + `backdrop-filter: blur`, hairline bottom border
that appears once the page scrolls) holding: a wordmark (a small abstract loop glyph in inline SVG — a circle with an
arrow, no medical imagery — plus "Closing the Loop" in Manrope), the 7 tabs, and the theme toggle on the right.
- ≥ 1100 px: tabs sit inline in the bar, centred-right.
- < 1100 px: the bar keeps wordmark + toggle; the tabs move to a second row directly below, a horizontally scrollable
  segmented strip with scroll-snap (the active tab scrolls into view). **No hamburger menu:** a hidden menu would make the
  smoke test find 0 visible tabs on phones and silently skip its mobile checks.
- On phones the toggle shows its icon only (label kept for screen readers).
- The course line ("An artificial-pancreas control simulator · CHEE 4071 … Ex. 23.3 / Exercise 23.6") leaves the bar
  and moves into the footer (and into the Overview hero in Phase 3) — nothing is lost.

**2. Active-tab indicator.** A single pill behind the active tab that slides between tabs (JS sets `--ind-x/--ind-w` on
the nav from the active button's position; recomputed on resize, font load and tab change). Hover = text brightens.
Under reduced motion it jumps instead of sliding.

**3. Disclaimer.** A slim full-width strip directly under the top bar on every tab (not sticky, so it doesn't eat the
screen while scrolling): a small "educational model" glyph + the **full unchanged sentence**, warm-amber ink on a faint
amber tint, AA contrast in both themes. Also repeated in the footer. Switching tabs scrolls to the top, so the strip is
in view every time a page opens.

**4. Page containers.** Every panel gets the same page header: an eyebrow (`01 — Overview` … `07 — References`, static
markup), the existing `h2` page title, and the existing `.lead`, with consistent top spacing. Prose capped at ~68ch;
charts and grids keep the full 1240 px. Section headings (`.section > h2`) get a quieter rule and spacing. A short
fade-and-rise entrance (opacity + 8 px, 240 ms) when a panel opens; none under reduced motion. Anchors used by the phone
button (`#sim-top`, `#sim-controls`) get `scroll-margin-top` equal to the bar height, and the sticky simulator controls
move down by the bar height so the bar never covers them.

**5. Footer.** Three columns (one on phones): wordmark + course line + disclaimer; "Explore" (buttons that open each tab,
using the existing `data-goto` handler — **not** `<a href="#…">` inside a `<nav>`, which the smoke test would count as
tabs); "Project" (public repo link, Gemini's frozen build at `/gemini/` labelled "comparison build, frozen", hosting and
licence notes: Plotly, KaTeX, Inter/Manrope OFL, GitHub Pages). No personal details.

**6. Shared components.** Custom-styled range sliders (track, filled portion via a CSS variable updated on input, round
thumb, focus ring) and selects (custom chevron) using tokens; consistent card hover (border brightens, no movement);
`.placeholder` restyled as an intentional "coming soon" panel; consistent `:focus-visible`.

## Files
- `site/index.html` — new header/top-bar markup (same 7 `button[role=tab]` with the same ids, `data-tab`, `aria-*`),
  disclaimer strip, eyebrow per panel, new footer. Panel content untouched.
- `site/css/style.css` — top bar, nav + indicator, disclaimer strip, page header, footer, sliders/selects, motion.
- `site/js/app.js` — in `showTab()`: indicator position, scroll-to-top on user tab change, active tab into view on the
  mobile strip, panel entrance class; a scroll listener (passive, rAF) that toggles the bar's hairline; slider fill
  variable set in `syncControls()`. No calculation or state changes.
- Docs: `docs/plan-redesign-phase2-claude.md`, process log Part 16, comparison post-change note.

## Protected (unchanged)
`#tab-<name>` / `#panel-<name>` / `data-tab` / `role="tab"` on exactly the 7 tab buttons; `#theme-toggle`; `#lib-warning`;
`#jump-btn`; every `#sim-*`, chart and design id; disclaimer wording; `model.js`, `data.js`, `site/gemini/`.

## Risks to the tests
- Extra elements matching the tab selector (`nav a[href^="#"]`, `[data-tab]`) → footer uses `data-goto` buttons outside
  any `nav`; the indicator is a pseudo-element.
- Sticky bar covering targets → `scroll-margin-top`; the content test's "button scrolls to the controls" bound
  (top < 400 px) still holds with a ~100 px bar.
- Horizontal scroll at 375 px → the tab strip scrolls inside itself; footer columns stack.
- `backdrop-filter` cost on phones → only on the bar; solid fallback where unsupported.

## Verification
`npm test`; local smoke on `/`, `/?theme=light`, `/gemini/`; content test both themes; extended slider/preset check;
screenshots of every tab at 1280, 1024 (tabs on the second row), 768 and 375 px in both themes, plus a scrolled state
(bar hairline, disclaimer) — review and fix before committing; then push → CI deploy → live tests green.
