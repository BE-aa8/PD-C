# Model comparison: Claude vs Gemini (website build)

Assignment item 5: *"Implement the plan using at least 2 different AI models and compare."* Every number below has a
source in this repo or in the run records. The **"My conclusions"** section at the end is Andrew's.

> **Who wrote this:** Claude (Opus 5.5), which also built one of the two websites being compared. To limit that bias,
> every claim below comes from a test, a script output (`tools/compare-builds.mjs` → `docs/comparison-data.json`),
> a file count, or a line of code that is cited. Each section lists problems in **both** builds. Andrew should check
> the claims before he relies on them.

## 1. Setup: what was held equal

| | Claude | Gemini |
|---|---|---|
| Model | Claude **Opus 5.5** (`claude-opus-5-5`, confirmed as the served model by the session record) | Requested **gemini-3.5-flash**; Google served **gemini-3.8-flash** (plus a small gemini-3-flash-preview call) |
| Harness | Claude Code, fresh cloud session (started 17:56 UTC), plan mode | Gemini CLI 0.68.0, headless, on GitHub Actions (`.github/workflows/gemini-build.yml`) |
| Inputs | `docs/build-prompt.md` + `docs/plan-v2-final.md` + `site/js/data.js` + `tests/` | identical (only the output folder differs: `site/gemini/`) |
| Steps | Plan mode → Andrew approves → build | Read-only plan → Andrew answers 3 questions → build |
| Grading | `npm test` (25 golden scenarios, 60 tuning cases, 4 margin cases from the independent Python reference) + `tests/browser-smoke.mjs`, both written **before** either build | identical |
| Date | 2026-11-18 | 2026-11-18 |
| Branch | `claude/site-build` (`site/`) | `gemini/pro` (`site/gemini/`) |

Neither build read `ap-sim/` (Gemini: its logs; Claude: the build prompt told it not to, and the plan it wrote lists
only the allowed files).

## 2. Results

| Metric | Claude (Opus 5.5) | Gemini (3.8-flash) | Source |
|---|---|---|---|
| Plan step | 0 questions; derived the model, half-rule and IMC formulas itself and checked them against `expected.json` before coding | 3 questions (6 min 38 s, 39 tool calls) | session; `docs/gemini-build/runs.md` |
| Build time | ≈ 27 min from session start to the site commit (17:56 → `8636e2f` 18:24 UTC), including its own browser checks | **16 min 19 s**, 73 tool calls | session record, git log; `runs.md` |
| Tokens / cost | Whole session so far (build **and** this comparison): 9.94 M cache-read, 255 k cache-write, 100 k output, **$6.05** (reported by the session). The build alone was less; not separable. | 9.29 M input (8.93 M cached), 93 k output; **$38.84** conservative estimate for the build run, ≈ $2.70 at the separations price basis (unverified; check the AI Studio bill) | session record; `docs/gemini-build/costs.tsv`, process log Part 7 |
| `npm test`, first run | **33/33** | **33/33** | run logs; re-run for this comparison |
| Precision vs the reference (worst error ÷ tolerance, all 25 scenarios) | 0.0012 (max \|ΔG\| 4 × 10⁻⁵ mg/dL) | **1 × 10⁻⁶** (max \|ΔG\| 5 × 10⁻⁸ mg/dL) | `tools/compare-builds.mjs` |
| Browser smoke test, light and dark | 7 tabs, 10 sliders, 0 failures, 0 console errors | 7 tabs, 9 sliders, 0 failures, 0 console errors | `docs/screenshots/comparison/smoke-*.md` |
| Charts that show wrong content (the smoke test can't see this) | none found | **P9 (PID vs MPC) shows no real data**: it reads `mpc.G_PID`, `mpc.G_MPC`, `U_PID`, `U_MPC`, keys that don't exist in `data.js` (`site/gemini/js/app.js:1160–1190`) | code; screenshot |
| Other visible defects | none found | Block diagram drawn with **black filled triangles** (SVG paths without `fill="none"`, `index.html:582–629`); Bode axis shows `&omega;` / `&ang;` as literal text; P10 sweep uses `sensor_delay \|\| 10`, so a 0-min delay is swept as 10 min (`app.js:1236`); no current-τc marker on P10 | screenshot; code |
| Follow-up fix prompts from Andrew | 0 for correctness; 1 layout request (charts above controls on phones) | 0 | process log |
| Bugs the builder found and fixed itself | 2 (a fault-time slider that did nothing at drift rate 0; Theory bolus sliders that changed only text) | none reported | process log Part 9; Gemini's report |
| Equations (rendered KaTeX blocks): Simulator / Theory / Control Design | **12 / 21 / 18** | **0 / 6 / 3** | smoke-test counts |
| Plots: Simulator / Theory / Control Design | 6 / 3 / 3 | 3 (+P8 hidden until a run is saved) / 2 / 5 | smoke-test counts |
| Sliders on Theory and Control Design | 4 and 4 (ΔU, bolus inputs; τc, θ, N, delay) | 0 and 0 (P4, P5, Bode, Nyquist only follow the Simulator) | smoke-test counts |
| Tuning control | τc, tuning model, design delay, ZOH toggle; Kc/τI/τD computed by IMC and shown step by step | Kc, τI, τD set directly by sliders; **no τc control and no step-by-step IMC calculation** (plan §10 item 4) | page, code |
| Presets | 22 | 22 | page |
| Placeholder tabs (prompt: "clearly labeled placeholders") | AI Workflow, Video, References are placeholders | Wrote its own AI Workflow history and filled References. Its text says Gemini's critique identified **"26 potential pitfalls"**; the critique has **11 findings** plus answers to Q1–Q7 (26 is the number of rows in Claude's decision table). It lists only Gemini's build ("Phase 5"), not the two-model comparison. | `docs/critique-v1-gemini.md`; page text |
| [TO VERIFY] flags | Kept (Battelino 2019, Table 12.1 rows, τc guideline) | **Removed** all; added volume/pages for Battelino 2019 that are not in `data.js` | page text |
| Banned content (drug names, carb ratios, dosing guidance) | none | none | text search |
| Code size | 1,740 lines / 110 KB | 3,582 lines / 122 KB (2.1× the lines) | `wc` |
| Stayed inside its folder / `data.js` unchanged | yes / yes | yes / yes (runner guard: 0 violations) | git diff, `cmp` |
| Self-reporting | Listed its assumptions and what it skipped (process log, CDN not reachable in the container) | Report says all P1–P11 "rendered with valid SVG geometry", which is true but misses that P9 has no data | final reports |

## 3. Beyond the tests (`tools/compare-builds.mjs`)

**Agreement on inputs that are not in `expected.json`** (max difference between the two builds over the run):

| Case | max \|G_C − G_G\| (mg/dL) | Why |
|---|---|---|
| Seeded noise, 24 h with three meals and back-calculation, odd delay + lag, PI with set-point step, p3 × 0.6, late/over-sized bolus, Kc × 3, dropout at t = 0, negative drift, suspend with FF off | ≤ 2 × 10⁻⁴ | Same algorithm. The residual 10⁻⁵ comes from the default-tuning precision below. |
| Noise + stuck sensor | 3 × 10⁻⁵ | same |
| **Noise + dropout** | **6.5** | Plan v2 §6 says "one draw per sample read" without saying whether a failed read counts. Claude draws noise at every sample; Gemini skips the draw during the dropout, so the random streams diverge afterwards. Both are valid readings; noise is "UI only, never compared across languages". |
| **Pump limits off, 2× meal** | **16** | Plan §8 step 5: "no clip when saturation = false". Claude removes all pump limits (feedback and total). Gemini still clips the PID output to 0–115 and only removes the clip on feedback + bolus. Different readings of the plan. |

**Why Gemini is closer to the reference:** Gemini copied the reference's full-precision default gains from
`tests/expected.json` into `DEFAULT_INPUTS` (`Kc = −0.4256497891832498`). Claude computes them with `imcTuning()`
from the fits in `data.js`, which are rounded to 6 significant figures, giving Kc = −0.42564951 (6.5 × 10⁻⁷ relative).
Every scenario that passes Kc explicitly matches the reference to 10⁻⁸ in both builds. The plan says
"= imcTuning(default), full precision", so both approaches are defensible.

**Invalid or extreme inputs to `simulate()`** (the sliders can't produce most of these; they matter for anyone calling
the engine directly):

| Input | Claude | Gemini |
|---|---|---|
| Kc = NaN or a string | replaces with default, warns | returns NaN glucose, no warning |
| t_end = −10, dt = 0 | replaces with default, warns | **throws** (`Invalid typed array length`) |
| t_end = 0 | replaces with default 660, warns | returns one point (arguably more literal) |
| Ts = 0, τI = 0, N = 0, sensor lag 0.2, delay 10⁶, noise σ < 0, sensitivity factor < 0 | replaces or rejects, warns | runs with the value, no warning |
| Set point −5 mg/dL | **drops the step silently (no warning)** | warns |
| Kc > 0 (wrong sign), unknown controller or fault name | runs, no warning | runs, no warning |

**Speed** (median of 15 runs, this container): Gemini is about **2× faster** (default 660-min run 2.2 ms vs 5.3 ms;
24-h run 7.7 vs 14.9 ms; margins 0.8 vs 2.4 ms; exact values vary a little between runs, see `comparison-data.json`). It uses typed arrays and no per-step allocations. Both are fast
enough for live sliders.

## 4. Findings

1. **Both models got the numerics right on the first try.** Both passed 33/33 with no fix prompts, and both match
   the reference far inside the tolerances. As in separations, the pinned plan, the API contract and the tests did most
   of the work.
2. **The differences are in the website, and the smoke test missed the biggest one.** Gemini's PID-vs-MPC chart
   (P9) plots no data because it reads keys that don't exist, and its block diagram has black filled shapes over it.
   Both builds pass the smoke test, which only checks that charts *render*, not that they show the right thing.
3. **Following the presentation rules:** the prompt asked that every calculation shown have an equation, units and an
   interpretation. Claude's build shows 51 equation blocks (12 on the Simulator); Gemini's shows 9 (none on the
   Simulator) and has no step-by-step IMC calculation or τc control.
4. **Data honesty:** Gemini filled the AI Workflow tab instead of leaving a placeholder, and its text overstates its
   own critique ("26 potential pitfalls" vs 11 findings). It also dropped every [TO VERIFY] flag. This repeats the
   pattern from separations (an invented claim about the course instructor there).
5. **Engine quality favours Gemini on precision and speed, Claude on input checking.** Gemini's engine is 2× faster
   and matches the reference to 10⁻⁸, but it throws or returns NaN on some bad inputs. Claude's engine sanitizes
   every input and warns, but one case (a negative set point) is dropped silently, and its default gains carry the
   rounding of `data.js`.
6. **Gemini was faster and Claude cost less, roughly.** Gemini's build took 16 min against about 27 min for Claude's
   build and self-checks. The costs aren't comparable (see caveats).

## 5. Fairness caveats
- **Home-field advantage, and the author:** Claude wrote plan v1, merged plan v2, wrote the tests (before either
  build), built one site, and wrote this comparison. Mitigations: Andrew approved every critique decision, the tests
  encode the reference's numbers, the Claude build ran in a fresh session, and the claims above are tied to code and
  script output that Andrew can re-run.
- **Different harnesses:** Claude Code (interactive, plan mode, could run a browser) vs Gemini CLI headless in CI
  (fresh context per stage). Claude found two of its own bugs by driving a browser beyond the smoke test; Gemini's
  report says it ran the smoke test (light and dark), but nothing more.
- **Different price tiers:** Opus is Anthropic's top tier; Gemini Flash is Google's fast tier (the key offered no
  3.x Pro). Google served a newer Flash than requested.
- **One build each:** no repeated trials, so run-to-run variation is unknown.
- **Costs are not like-for-like:** Claude's number is the session total (build plus this comparison) as reported by
  the session; Gemini's is a conservative estimate from token counts, and the AI Studio bill is the real figure.
- **CDN:** this container's proxy blocks the Plotly/KaTeX CDNs, so the browser tests here served the same pinned
  library versions from local npm copies. Both sites still load them from the CDN; the live Netlify test will confirm.
- **Gemini's files were not changed** for this comparison. They were read from a scratch checkout of `gemini/pro`.

## 5b. Post-comparison changes
This comparison describes Claude's build at `ce6a77f` and Gemini's at `871f361` (the `comparison-data.json` numbers are from
those versions). After it, Andrew chose to continue with **Claude's build only**; Gemini's stays frozen at `/gemini/`.
Later changes to Claude's site (listed so the comparison stays honest):
- Round 1 (`docs/plan-simulator-round1-claude.md`): phone access to the controls, a manual tuning mode, input warnings in
  the engine (invalid set-point step, Kc > 0, unknown option names; this changes three rows of the robustness table in
  Claude's favour), β shown only when a set-point step exists, and a chart-content test (`tests/browser-content.mjs`).
  The default gains are still computed from `data.js`, not copied from the test file.
- Redesign Phase 1 (`docs/plan-redesign-phase1-claude.md`, brief by ChatGPT in `docs/redesign-brief-chatgpt.md`): new
  design tokens, self-hosted fonts, dark-by-default theme with a toggle, re-themed charts. Presentation only.
- Redesign Phase 2 (`docs/plan-redesign-phase2-claude.md`): sticky top bar with sliding tab indicator, disclaimer strip,
  page headers, footer, custom sliders and selects. Presentation only.
- Redesign Phase 3 (`docs/plan-redesign-master-claude.md`, references in `docs/redesign-references-chatgpt.md`): new
  Overview (hero, loop diagram, four chapters with model numbers, concepts, AI strip) and an interactive **3D pancreas**
  (BodyParts3D mesh, three.js) whose schematic islet glow follows U(t) of the default run. Adds one library (three.js) and
  15 content-test checks. The engine is unchanged.
- Redesign Phase 4 (`docs/plan-redesign-phase4-claude.md`): Simulator as a workspace (preset, status and actions in a
  header; peak and nadir as lead KPIs; P1–P3 stacked on one linked time axis; quieter controls rail; compare, analysis
  and detailed-metrics sections; a help panel). Adds a Reset button and removable saved-run chips. Presentation only.
- 3D performance fix (`docs/plan-3d-performance-claude.md`): live 3D only with a hardware renderer (otherwise still
  images), the full viewer starts on tap, one WebGL context at a time, both released when leaving the Overview.
- Redesign Phase 5 (`docs/plan-redesign-phase5-claude.md`): Theory in the brief's 5 chapters and Control Design in its 8,
  each with a chapter navigator; an interactive block diagram (select a block for its transfer function and live
  numbers) with a purpose-drawn vertical version for phones; a margin metric strip; the Overview loop drawn vertically
  on phones. Presentation only; every equation stays visible.

## 6. Process lessons
- **"Renders" is not "correct":** the smoke test checks that each chart has an SVG, so a chart with no data passes.
  A content check (for example, P9's first glucose value equals `DATA.mpcComparison.unannounced.pid.G_true[0]`) would
  have caught Gemini's P9 bug. Worth adding to the tests before any follow-up run.
- **Ambiguities still slip through a pinned plan:** "no clip when saturation = false" and "one draw per sample read"
  were read two ways. Neither is tested, so both builds pass.
- **Copying the expected values is allowed, and it shows:** Gemini took the default gains straight from the test file;
  Claude recomputed them. Graders should know that the precision gap comes from this, not from the integrator.

## 7. My conclusions (Andrew, to write)
> _Left blank on purpose. Questions to consider:_
> - Which build would I ship, and why? (Fix Gemini's P9 and diagram, or use Claude's?)
> - Which difference surprised me most: the chart the tests couldn't catch, the missing equations, or the overstated
>   AI Workflow text?
> - What would I change next time (content checks in the browser test, the same harness for both, a Pro-tier Gemini,
>   repeat runs)?

## Screenshots
Same viewport (1280 px), `docs/screenshots/comparison/`:
`claude-simulator-light.jpg`, `gemini-simulator-light.jpg`, `claude-simulator-dark.jpg`, `gemini-simulator-dark.jpg`,
`claude-control-design-light.jpg`, `gemini-control-design-light.jpg` (full page: shows Gemini's P9 and block diagram).
Smoke-test reports for both builds: `smoke-light.md/json`, `smoke-dark.md/json`.

**Reproduce:** `node tools/compare-builds.mjs <path to gemini/pro's site/gemini/js/model.js>` (writes
`docs/comparison-data.json` and prints the tables); smoke test as in `tests/browser-smoke.mjs` with `--paths /,/gemini/`.
