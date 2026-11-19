# Fix: 3D pancreas makes the Overview lag and crash on desktop (Claude)

## Context
Andrew: "is there anyway we can make the website less laggy, with the 3D models, my website is crashing everytime".
Details from his answers: it only happens on the Overview, on his **desktop/laptop**. Phones work. The hero pancreas
is **still** (no rotation), and the lower viewer works but is **very slow**. He chose: **hero live, full viewer
starts on tap**, and only one 3D view running at a time.

**Diagnosis (from the code):** a still hero on desktop means `site/js/pancreas.js` switched to its low-power mode. That
happens only when (a) the browser reports a **software WebGL renderer**, meaning hardware acceleration is off or the GPU
is blocklisted, so the CPU draws every pixel (the same SwiftShader path our headless tests use: about 1 frame every
7 s), or (b) the first 24 frames each take more than 45 ms. Either way his laptop draws 3D very slowly, and the page
makes it worse:
- **Two WebGL contexts** (hero + organ viewer) are created on the Overview and are never released.
- They render at **devicePixelRatio up to 2 with antialiasing**, so a retina laptop draws ~4× the pixels.
- **Backdrop blur over the canvas:** the glass glucose card (`.hero-trace`, blur 10 px) and the sticky header (blur
  14 px) must re-blur the 3D canvas every frame.
- **Per-frame layout work:** `frame()` calls `getBoundingClientRect()` (via `resize()`), writes 5 hotspot transforms and
  class toggles, and `animateHero()` rewrites the readout's `innerHTML` 60×/s and keeps its rAF loop running on every tab.

## Fix
1. **Don't run live 3D on a software renderer.** Create the context with `failIfMajorPerformanceCaveat: true`, and keep
   the existing renderer-name check. When either fails, show a **pre-rendered still** of the pancreas (transparent
   WebP/PNG, works in both themes) instead of a canvas. The hero's glucose trace, playhead and readout keep animating
   (SVG only). The viewer shows the still plus one line: "Live 3D is off because this browser is drawing graphics without
   the graphics card (hardware acceleration). [Try anyway]". Try anyway starts it at reduced resolution (pixel ratio 0.75).
2. **Full viewer starts on tap** (all devices): the `#organ` section shows the still and an "Explore in 3D" button. On
   tap, the viewer is created and the **hero is paused**, so only one view renders. Tools and hotspots work as now once
   it's live.
3. **Release GPU memory when leaving the Overview:** dispose both viewers with `forceContextLoss()` and cancel the hero
   animation loop. Coming back recreates the hero; the mesh is cached in memory, so no re-download.
4. **Cheaper frames on real GPUs:**
   - pixel ratio capped at 1.5, with antialiasing only when the ratio is below 1.5;
   - auto-rotate throttled to 30 fps;
   - `resize()` only from the ResizeObserver, no longer every frame;
   - hotspot positions written only when the camera moved, and classes toggled only when they change;
   - the hero readout text updated about 5×/s; the hero loop stops when the Overview isn't shown.
5. **No blur over the 3D canvas:** `.hero-trace` becomes a solid card, and the header uses an opaque background on the
   Overview.
6. **Stills:** a small script, `tools/render_pancreas_stills.mjs` (Playwright), renders the hero pose and the viewer pose
   once to `site/models/pancreas-hero.webp` and `pancreas-viewer.webp` (transparent). It is re-runnable, the stills are
   committed, and they are credited the same way as the mesh (BodyParts3D, CC BY-SA 2.1 JP).

## Files
- `site/js/pancreas.js`: context options, capability check exported (`liveCapable()`), pixel-ratio / antialias / 30 fps,
  no per-frame resize, dirty-checked hotspots, `pause()`/`resume()`, `dispose()` with `forceContextLoss`.
- `site/js/app.js`: `initViewers()` (hero live or still; organ viewer on tap; pause the hero; dispose on tab leave in
  `showTab`); `animateHero()` (throttled readout, stoppable loop).
- `site/index.html`: still `<img>` elements in `#hero-stage` and `#organ-stage`, the "Explore in 3D" button and the
  notice line.
- `site/css/style.css`: remove the blur from `.hero-trace`; header background on the Overview; still and button styles.
- `tools/render_pancreas_stills.mjs` + two `.webp` stills.
- `tests/browser-content.mjs`: the CI browser uses software WebGL, so the default run now checks the **still path** (hero
  still shown, glucose trace still animating, no WebGL context created, Explore button present). A second page with
  `?3d=force` (test-only switch) taps "Explore in 3D" and runs the existing tool, hotspot and reset checks, and checks
  that the hero is paused while the viewer runs. The no-WebGL check stays.
- Records: `docs/plan-3d-performance-claude.md`, process log Part 19, References line for the stills.

## Verification
- **His slow path, reproduced here:** our headless Chromium uses the same software renderer. Measure the Overview
  before and after with Chrome performance metrics: main-thread busy time and long tasks over 10 s, scrolling to the
  viewer and back, and the number of live WebGL contexts (target: 0 on software, 1 on GPU). Measure with `?3d=force` too.
- `npm test` (65); smoke `/`, `/?theme=light`, `/gemini/`; content test both themes; Overview screenshots at 1280 and
  375 in both themes; then commit, push, fast-forward `main`, CI deploy and live tests.
- **Ask Andrew to confirm on his laptop.** If it still says hardware acceleration is off, `chrome://gpu` (or Safari's
  equivalent) shows why; turning acceleration on in browser settings brings back the live hero.
