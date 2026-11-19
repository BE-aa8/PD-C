# Redesign master plan (4 visual references + 3D pancreas) and Phase 3 (Overview)

## Context
Andrew gave ChatGPT four screen recordings he likes (Harley-Davidson, Rivian, Nutrien, an interactive 3D pancreas
viewer); ChatGPT turned them into reference notes and asked for (1) a design analysis of the current site against them and
(2) a tab-by-tab plan, before any code. Andrew overrode one line of those notes: **the 3D pancreas is required** ("I 100%
NEED that"). He chose: the pancreas in the **Overview hero and a full viewer section**, and the model **driven by real
simulation data**. Claude can't watch the recordings; this plan relies on ChatGPT's descriptions of them. Phases 1–2
(tokens, theme, top bar, footer) are live and green. On approval: save ChatGPT's notes verbatim as
`docs/redesign-references-chatgpt.md`, this plan as `docs/plan-redesign-master-claude.md`, then build **Phase 3** and stop
for review.

**3D source (checked):** BodyParts3D (Database Center for Life Science; Mitsuhashi et al., *Nucleic Acids Res.* 2009,
doi:10.1093/nar/gkn613), CC BY-SA 2.1 Japan, real segmented anatomy. Meshes reachable here: pancreas `FMA7198nsn`
(11,414 triangles, 570 KB STL), pancreatic duct `FMA10419` (4,128), duodenum `FMA7206` (11,950). Renderer: **three.js
0.170.0** (MIT), pinned on jsDelivr, loaded only when needed. This is the one new library; the requirement justifies it.

## 1. Design analysis — current site vs the references
| Reference quality | Current site | Gap |
|---|---|---|
| Harley: cinematic opening, few big statements | Overview opens with "What this is" + a 110-word paragraph + 3 equal cards | No opening moment; text first, no visual |
| Rivian: one purpose per section, alternating visual/text | Every tab is a stack of equal-weight cards in 2–3-column grids | No chaptering; nothing is "big" |
| Rivian configurator: input → central visual updates | Simulator works this way, but P1 is one chart among six in a long column; controls are as loud as results | The subject (glucose response) isn't dominant |
| Nutrien: clean light theme, strong spacing, simple metrics | Light theme is designed (Phase 1) but layouts are dense; metrics live in a 12-row table | Metrics not "presented"; spacing too uniform |
| Pancreas viewer: subject = interface, tool rail, hotspots, progressive disclosure | Block diagram is a small SVG in a card; explanations always visible; no 3D | Visuals are small; no direct manipulation beyond sliders |

## 2. Reusable patterns (built once, used on every tab)
- **Story section**: eyebrow · one-line headline · ≤ 2 sentences · one large visual; alternates left/right on desktop,
  stacks on phones. Reveal on scroll (opacity + 12 px, once; off under reduced motion).
- **Viewer frame**: a large visual on a clean stage + a compact **vertical tool rail** (icon + short label, `aria-pressed`)
  + a caption line + optional breadcrumb. Used for the pancreas, the block diagram and P1.
- **Metric**: big number + unit + label + one-line meaning (same rule: equation/units/meaning stays reachable).
- **Help disclosure "?"**: a small button that opens the longer explanation in place (new; the site has none today).
- **Chapter navigator**: sticky list on desktop, compact select on phones (Theory, Control Design).

## 3. Tab-by-tab plan
**Overview (Phase 3, next):** a directed sequence instead of paragraph + cards.
1. *Hero* — "Closing the loop." (Manrope, hero scale); one statement linking process control and glucose regulation; the
   course line as small context; two actions (Open the simulator · Explore the organ). Right side: the **3D pancreas**
   (slow auto-rotate, drag to turn) with a **schematic islet layer** whose glow follows **U(t) of the default simulation**,
   and an overlaid **glucose trace** (SVG, the real `simulate()` G(t) with the band) whose playhead loops over 0–660 min,
   with a readout (t, G, U from the arrays). Caption: "Schematic islets, not to scale. In an artificial pancreas the pump
   takes over this insulin release." Reduced motion: still frame at the glucose peak.
2. *The loop* — full-width interactive loop diagram (meal → glucose → sensor → controller → pump → insulin → back);
   tapping a node highlights it and shows one line; replaces the 110-word paragraph.
3. *Four chapters* (alternating, real numbers only): feedback reacts late (default run, peak 163.4 / nadir 49.4, leaves the
   band); lopsided authority (98.3 vs 16.7 mU/min from `linearModel()`); feedforward (default vs 15-min pre-bolus overlaid,
   107.9 / 62.2, stays in band); delay limits stability (PM 58.6°, tolerable delay 48.1 min continuous vs 43.4 min
   sampled, `margins()` + `DATA.empiricalDelay`). Each links to the tab that goes deeper.
4. *Explore the organ* — the full **viewer frame**: tool rail (auto-rotate, zoom in, zoom out, wireframe, cross-section,
   isolate duct, show duodenum for context, reset), hotspots (head, neck, body, tail, main pancreatic duct, islets —
   schematic), breadcrumb "Abdomen › Pancreas › <part>". Region names are standard anatomy; the one physiology sentence
   (β-cells in the islets release insulin) is cited to Seborg Ch. 23 **[TO VERIFY]** and the mesh to BodyParts3D.
5. *Course concepts* — grouped into 4 visual clusters (Modelling · Analysis · Control design · Implementation) instead of
   two bullet lists. 6. *AI story strip* → AI Workflow. 7. *Final call to action* → Simulator. Footer as Phase 2.

**Simulator (Phase 4):** visualization-first workspace. Header row: preset select, status badge, band, a compact toolbar
(save run, compare, reset, "?"). KPI strip with peak/nadir emphasized. **P1 large (≈ 520 px)** with P2 and P3 attached
below on the same time axis (visually one instrument). Controls become a quieter rail (glass panel on desktop; the phone
button stays) with one-line group descriptions; long explanations move behind "?". Metrics table → "Detailed metrics"
disclosure; saved runs → a compare tray over P8; sweeps P10/P11 → an "Analysis" section. Every control, chart, preset and
id kept.

**Theory (Phase 5):** editorial chapters with the chapter navigator; each chapter = short intro + large equation block +
its chart side by side; derivation details in disclosures; light theme in the Nutrien spirit (clean, sage accents).
Brief's chapter names used as headings; all equations, units, meanings and charts kept.

**Control Design (Phase 5):** the **block diagram as a viewer frame**, full width, interactive (hover/tap a block → its
transfer function and live numbers; signal path highlights); a purpose-built vertical layout of the diagram on phones
instead of shrinking it. Compact tuning bar with distinct IMC / Manual states; margins as metrics; Bode and Nyquist
two-up; PID vs MPC two-up with the announced toggle.

**AI Workflow (Phase 6):** horizontal journey (vertical on phones): plan → critique → human decisions → two independent
builds → tests and comparison → selection; each stage with a short text and evidence links (docs, CI runs); a clear
card for Gemini's frozen build. Only facts from `docs/process-log.md` and `docs/comparison.md`.
**Video & Transcript (Phase 6):** a large 16:9 stage (placeholder until recording), details beside it, transcript in an
expandable reader. **References (Phase 6):** grouped (textbook and theory · model and parameters · 3D data · software ·
AI contributions · project contributions), consistent citation style, [TO VERIFY] kept.

## 4. Phase 3 implementation (what gets built after approval)
- `tools/build_pancreas_mesh.mjs` (Node, no deps): reads the three BodyParts3D STLs, merges duplicate vertices, applies one
  shared centring/scale, writes `site/models/pancreas.bin` (Float32 positions + Uint32 indices per part) and a small
  `pancreas.json` header; `site/models/LICENSE-BodyParts3D.txt` (attribution, CC BY-SA 2.1 JP, adaptations listed).
  Source STLs are fetched by the script, not committed.
- `site/js/pancreas.js` (new ES module): lazy-imports three.js + OrbitControls from jsDelivr (pinned), builds the scene
  (soft studio lighting, sage/clay material, duct and duodenum materials, schematic islet points seeded from a fixed list
  inside the mesh bounds — labelled schematic), viewer API (tools, hotspots, U-driven glow), renders only while visible
  (IntersectionObserver + tab visibility), caps pixel ratio at 2, and falls back to a labelled still/notice without WebGL.
- `site/index.html` / `site/css/style.css` / `site/js/app.js`: new Overview markup and story/viewer/metric styles; the hero
  trace and chapter visuals drawn from `M.simulate()` / `M.linearModel()` / `M.margins()` / `DATA` at load.
- **Tests:** tool buttons are buttons (no range inputs, since a canvas-only change would fail the smoke test's "slider
  changed nothing"); content test adds: hero trace = `simulate()` G, the four chapter numbers equal the engine's values, the
  viewer loads the mesh (a `data-ready` flag), each tool toggles `aria-pressed`, hotspots open their label, and a no-WebGL
  run shows the fallback. CI routes nothing new (runners reach jsDelivr). Locally three.js is served from the npm copy.
- **Records:** References and footer credit BodyParts3D and three.js; process log Part 17.

## Verification
`npm test`; smoke (`/`, `/?theme=light`, `/gemini/`); content test both themes; extended check; WebGL frame rate and CPU
check on a throttled phone profile; screenshots of the Overview at 1280/1024/768/375 in both themes plus the viewer tools;
then push → CI deploy → live tests (real CDN, real WebGL in CI's Chromium).

---
## As built (Phase 3, 2026-11-19)
Differences from §4 above, decided during the build:
- Indices are stored as **Uint16** (every part has fewer than 65,535 vertices), not Uint32; the mesh is **Taubin-smoothed**
  (12 iterations; duct 6) to remove the faceted look of the segmentation without shrinking it. Output is deterministic.
- three.js is loaded through an **importmap** (jsDelivr, pinned 0.170.0) by a dynamic `import('./pancreas.js')`, so pages
  that never show the Overview never download it.
- **Low-power mode**: if the GPU is software (SwiftShader/llvmpipe) or frames are slow, auto-rotate stops and the scene
  renders only on interaction. Found because CI-style headless Chromium rendered at ~1 frame per 7 s.
- The duct label shows only when the duct is exposed (Isolate duct or Cross-section); narrow stages widen the view instead
  of cropping the organ.
