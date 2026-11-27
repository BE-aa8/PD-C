# Embed the presentation slides under the video (Claude)

## Context
Andrew wants the class deck (`closing-the-loop-slides-updated.pptx`, 18 slides, the version with this session's fixes:
40 prompts, 2× meal, 43.4 min, his conclusions on slide 17) shown on the website, right under the video embed on the
**Video & Transcript** tab. The site is static on GitHub Pages, so there's no Office/Google embed to rely on (those need the
file uploaded to another service, and the PDF-in-iframe approach is poor on phones). Instead: render each slide to an
image and add a small, accessible slide viewer, plus download links for the PDF and PPTX.

## Changes
1. **Assets** in a new `site/slides/` folder:
   - `slide-01.webp` … `slide-18.webp` (1600 px wide). Rendered from the PDF we already made and checked
     (`$SP/deck/closing-the-loop-slides-updated.pdf`) using `pdftoppm` and then a WebP conversion. JPG is the fallback if
     WebP is too large. Target total size is about 2 MB, and the images are lazy-loaded.
   - `closing-the-loop-slides.pdf` and `closing-the-loop-slides.pptx` for download.
   - A small build script, `tools/build_slides.sh`, so the images can be regenerated when the deck changes.
2. **`site/js/slides.js`** (new, data only, the same pattern as `video.js`): one entry per slide with its file and title.
   Titles come from `slide_text.py` and are used as alt text and captions.
3. **`site/index.html`**:
   - Add a section after `.video-layout` and before the transcript `<details>`: an eyebrow "Slides", an h3 "Presentation
     slides", and a `#slides-viewer` container.
   - Update the tab lead sentence to mention the slides.
4. **`site/js/app.js`**: a new `buildSlides()`, called next to `buildVideo()`.
   - A 16:9 stage that shows one `<img>` with alt text = the slide title.
   - Prev / Next buttons and a "3 / 18" counter in an `aria-live="polite"` region.
   - Left/Right arrow keys while the viewer has focus.
   - A horizontally scrollable thumbnail strip of buttons with `aria-current` on the active slide. The strip is focusable,
     to avoid the scrollable-region-focusable failure seen earlier.
   - A Fullscreen button using `requestFullscreen` (hidden if the browser doesn't support it).
   - Download links for the PDF and PPTX.
   - Preload the next slide only. The thumbnails use `loading="lazy"`.
5. **`site/css/`**: viewer styles that reuse the existing video tokens (`--r-xl`, `--line`, `--shadow-2`, the accent
   colours). They must work in light and dark themes and at phone width (16 px gutter, no horizontal page scroll).
6. **Tests**: add the following checks to `tests/browser-content.mjs`.
   - The viewer shows 18 slides, starting on 1/18.
   - Next goes to 2/18 and changes the image `src`; Prev returns to 1/18.
   - The ArrowRight key advances the slide.
   - Every image has non-empty alt text.
   - The PDF and PPTX links return 200.

   The a11y test already covers the video tab.
7. **Docs**:
   - Save this plan as `docs/plan-slides-embed-claude.md`.
   - Add a Part to `docs/process-log.md`.
   - Commit to `claude/site-build`, fast-forward `main`, and push. CI deploys and runs the live tests.

No changes to `model.js`, `data.js`, or `site/gemini/**`. The disclaimer already appears on every page.

## Verification
- `npm test`, plus the local wrappers `content-local.mjs`, `a11y-local.mjs` (including the slow-fonts variant) and
  `smoke-local.mjs`, run against `python3 -m http.server 8768 -d site`.
- Playwright screenshots of the Video tab at desktop and phone width, in light and dark themes. Click through a few
  slides and check that the thumbnails, the counter and fullscreen work.
- Watch CI (`waitsha.sh <sha>`) until it's green, including the live-site tests. Then check the live page once.
