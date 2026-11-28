# Process Log

Running record of AI tools, prompts, decisions, and iterations for the AI project. Requirement #4 asks for the planning and iteration steps where I provided guidance and my reasoning, so append an entry after every session.

Entry template:
```
## YYYY-MM-DD — <tool / model> — <what this session was for>
**Prompts (key ones, verbatim):**
**What the AI produced:**
**What I accepted / changed / rejected, and why:**
**Problems hit:**
**Next step:**
```

---

## Before 2026-11-18 — Claude Opus 5.5 — plan v1

**Note on the record:** plan v1 (`docs/plan-v1-claude.md`) is headed "Plan author (Model 1): Claude Opus 5.5 · Date: 2026-11-18". The conversation that produced it is not in this repository and was not visible to the Claude Code session below. *[Andrew: add where the plan was generated and the key prompts, if you have them.]*

## 2026-11-18 — Claude Code (Opus 5.5, cloud session) — Python build of plan v1, audit, workflow setup

Reconstructed by Claude Code at the end of the session from the session's own conversation. Prompts are quoted verbatim; long ones are shortened, with the omission marked.

### Part 1: building plan v1 in Python

**Prompts (verbatim):**
1. The full text of plan v1 (now `docs/plan-v1-claude.md`), pasted as the first message. Its header says: "Status: First plan. This goes to a second AI model for critique before anything is built."
2. "Turn off the Ts/2 term by default to match references"

**What the AI produced:**
- `ap-sim/`: the full plan-v1 implementation in Python (numpy/scipy, Streamlit UI): nonlinear model, RK4 engine, linearization, half-rule and least-squares model reduction, IMC tuning, discrete PID with anti-windup, sensor faults, feedforward bolus/pre-bolus, metrics, stability margins, 16 presets, and a linear MPC (stretch). 67 tests at this point.
- Reproduced the plan's reference numbers (open-loop peak 166.2 mg/dL at 26 min, Kp = −4.506, nonlinear gain −4.27, the fits, phase margins 68°/74°, max delay 33.4/48.1 min) and the §14 sanity targets (15-min pre-bolus: peak 108, nadir 62, stays in the 54–144 band).
- Logged deviations in `ap-sim/BUILD_LOG.md` and open questions in `ap-sim/NOTES_FOR_ANDREW.md`.

**What I accepted / changed / rejected, and why:**
- The plan was inconsistent about Ts/2: §5.3 adds Ts/2 to the dead time, but the §6/§13 reference values only come out without it. **I chose to turn Ts/2 off by default** so the tuning matches the reference values. It is still a toggle.

**Problems hit:**
- **Process deviation:** plan v1 said it would be critiqued *before* anything was built. Claude Code built it straight away, so the critique comes after a first implementation. This is recorded here and in `docs/PROJECT_STATUS.md`, not hidden.
- The same model wrote the plan and built it, so this build does not count as the "second model".
- Bugs and plan issues found by testing: a pre-bolus scheduled before t = 0 was silently delivered at t = 0 (presets moved the meal to t = 60 min; the simulator now warns); holding D(t) at the start of each RK4 step failed the plan's 0.1 mg/dL criterion (0.21 mg/dL; a midpoint hold added).

### Part 2: completion audit and Phase A

**Prompts (verbatim, shortened):**
3. "# PROJECT COMPLETION DIRECTIVE — Closing the Loop … Your first responsibility is to independently establish the actual current state. … Do not start modifying the repository immediately." *(long directive: audit, roadmap, multi-AI requirement with Gemini, website, presentation, checklist)*
4. "Approved — start Phase A, I'll run Gemini myself. On the last method, we used a key from Google AI Studio that worked through Gemini. I liked that method and lets do it again"

**What the AI produced:**
- `docs/PROJECT_STATUS.md` (audit). Findings: no Gemini work anywhere; `main` held only the initial commit; no deployment; 4 code issues (B1–B4).
- Phase A: fixed B1 (the stability tab showed PID margins when MPC was selected), B2 (crash path in the delay-sweep button), B3 (a hard-coded pump limit in the metrics), B4 (no warning when glucose goes non-physical), each with a test. Lead-lag feedforward test (B8) found that, with the default settings, it over-delivers by 48%, because the pump cannot deliver the negative insulin the filter asks for. 98 tests.
- A local Gemini API runner script and prompts.

**What I accepted / changed / rejected, and why:**
- Phase A's local runner was based on a misunderstanding of how I had used my AI Studio key before. I then described the actual separations workflow (GitHub Actions + Gemini CLI, key as a repo secret), and the runner was **removed** (it is in git history).

### Part 3: switching to the separations pathway

**Prompts (verbatim, shortened):**
5. "HOW THIS PROJECT USES GITHUB + CLAUDE CODE + GEMINI (API KEY) TOGETHER (read this before planning; it describes how the previous project was actually built) …" *(full description of the separations workflow)*
6. "follow exactly what we did in the separations repo. that pathway worked great for me all week, I don't want to switch it up."
7. "why am I seeing nothing in our git repo?"
8. "approved, same assignment, individual, you can push to main, yes the HW text is the exact same so you can copy"

**What the AI produced:**
- Read the separations repo's workflow, scripts, CI and docs, then drafted `docs/plan-gemini-workflow-claude.md`. The first draft proposed variations (a critique stage in the workflow, a spec-only Gemini branch, a different budget, stlite hosting).
- After prompt 6, rewrote the plan as a one-to-one mapping of the separations pathway. The website becomes a static JS site on Netlify, built by both models, and the Python `ap-sim` becomes the independent reference that generates the expected test values (the role `handcalc_reference.py` played in separations).
- Answered prompt 7: GitHub shows `main` by default, and all work was on the `claude/pancreas-control-simulator-w1e3tl` branch.
- Setup (step 1 of the plan): `CLAUDE.md`, `context/assignment.md` and `context/professor-guidance.md` copied from separations, this log, `package.json`, `ci.yml`, `gemini-build.yml` + `run-gemini.sh` (copied; only the base branch and project wording changed), and the critique paste file for the Gemini web app.

**What I accepted / changed / rejected, and why:**
- **Rejected all of Claude's proposed variations to the workflow.** The separations pathway worked all week; keep it identical.
- **Same assignment text** as separations; **individual** project.
- Allowed Claude to push to `main`.

**Next step:** paste `docs/gemini-critique-all-in-one.txt` into the Gemini web app and commit the reply verbatim as `docs/critique-v1-gemini.md`.

### Part 4: Gemini critique and Claude's fact-checks

**Prompts (verbatim):**
9. "nice. thanks. can you put exactly what needs put into gemini into the chat please" (Claude printed the full contents of `docs/gemini-critique-all-in-one.txt`)
10. Andrew pasted Gemini's full reply from the Gemini web app, with no other text.

**What the AI produced:**
- Gemini (web app; exact model name to be added by Andrew): an 11-finding critique plus answers to plan §19 Q1–Q7. Saved verbatim as `docs/critique-v1-gemini.md`.
- Claude: fact-checked the checkable claims against the Python reference and drafted `docs/critique-decisions.md` (26 rows, each needing Andrew's decision).

**Key fact-check results:**
- **Gemini found a real bug that Claude's plan and code both missed:** setpoint weighting β was applied to absolute glucose. With β = 0.5 and no meal, the controller output starts at 33.9 instead of 16.7 mU/min, and glucose falls to 57 mg/dL from a resting steady state.
- Gemini's back-calculation guard (Tt ≥ Ts) prevents a real divergence when τD is small (Ts/Tt > 2).
- Gemini overstated one finding (it called the back-calculation formula an "algebraic error", though its own derivation shows it is correct), made two small arithmetic slips (Kp −4.505925 vs −4.506298; bolus 1390.13 vs 1390.09), and underestimated the D-hold error 12× (0.018 vs a measured 0.213 mg/dL).

**What I accepted / changed / rejected, and why:**
11. "approve all, go with your recommendations. let me know when i need to add the API key"
- All 26 rows approved. For the two rows with a choice, I took Claude's recommendation: the least-squares fits are computed offline by the Python reference and shipped in `data.js` (row 7), and the Python MPC results are shown as a precomputed, labelled figure (row 19).

### Part 5: plan v2 and the shared tests

**What the AI produced:**
- Fixed the two reference bugs Gemini found (set-point weighting, back-calculation Tt guard), with tests (100 Python tests).
- `docs/plan-v2-final.md`: plan v1 + all approved critique items, re-targeted at the static website. Every numerical detail the two builds must agree on is pinned (PID and anti-windup, sensor, bolus, RK4 event order), plus the `model.js` API contract.
- `tools/build_data.py` → `site/js/data.js` (parameters with sources, offline fits, empirical delay limits, precomputed PID vs MPC). `tools/build_expected.py` → `tests/expected.json` (25 golden closed-loop scenarios, 60 tuning cases, 4 margin cases). CI regenerates both and fails if they drift.
- `tests/model.test.mjs` (`npm test`, grades `site/` and `site/gemini/`), self-tested with a throwaway replay stub: the exact reference passes 33/33; a 0.06 mg/dL error at one time point fails. `tests/browser-smoke.mjs` copied unchanged from separations.
- `docs/build-prompt.md` (identical prompt for both models; only the output folder differs) and `docs/gemini-build/prompt.txt` (Gemini's copy).

**Next step:** Andrew adds the `GEMINI_API_KEY` repository secret and runs the Gemini workflow (`models`, then `plan`). In parallel, Claude's website build runs in a **fresh** Claude Code session in plan mode, from `docs/build-prompt.md`.

### Part 6: Gemini plan stage

**Prompts (verbatim):**
12. "im not sure how to run stage = models, but the api key should be added now" (Claude triggered `stage=models`; key works; models offered: gemini-2.5-pro, gemini-3.5-flash, gemini-3.1-flash-lite, auto)
13. "run plan with 3.5-flash"
14. "Budget $20 send it"

**What the AI produced:**
- Gemini plan run `20261118T171557Z` (requested gemini-3.5-flash; Google served gemini-3.8-flash plus a small gemini-3-flash-preview call): 6 min 38 s, 39 tool calls, no files changed, no reads of `ap-sim/` or Claude-side docs found in its logs. Plan in `docs/gemini-build/plan.md` on `gemini/pro`. It reproduces the pinned numerics of plan v2 and asked 3 questions.
- Pessimistic cost estimate $7.44 (all 1.65M input tokens at $4/M; 1.51M were actually cached), which is over the $6 budget. At the separations comparison's price basis it is about $0.86 (unverified; check the AI Studio bill).
- Claude found that Gemini's plan exposed an ambiguity in plan v2 §5: whether the integral term leaves the output while "frozen". Clarified in plan v2 (the term stays; only S stops changing) and in the build message, so both builds get the same rule.

**What I decided, and why:**
- Raised `BUDGET_USD` from 6 to **20**.
- Approved Gemini's plan with Claude's drafted answers (sent as the build `message`): sweep resolution is Gemini's choice (keep it responsive), a toggle on P9 for unannounced/announced, and the §5 integral-term clarification.

**Next step:** Gemini build stage; Claude's website build in a fresh session.

### Part 7: Gemini build stage and verification

**What the AI produced:**
- Gemini build run `20261118T173105Z` (requested gemini-3.5-flash; Google served gemini-3.8-flash plus a small gemini-3-flash-preview call): 16 min 19 s, 73 tool calls. 5 files in `site/gemini/` (index.html 875 lines, app.js 1379, model.js 715, style.css 613, plus `data.js` copied byte-for-byte). No files changed outside its folder. Gemini made its own commit (`98b4fb8`), as the build prompt allows.
- Pessimistic cost estimate: $38.84 for this run, **$46.28 total**. 8.93M of the 9.29M input tokens were cached. At the separations comparison's price basis (unverified) it is about $2.70 for this run and $3.60 total. **The total is past the $20 budget, so any follow-up run would be blocked** unless Andrew raises it. Real spend: check the AI Studio bill.

**Claude's independent verification (not relying on Gemini's own report):**
- `npm test` on a clean checkout of `gemini/pro`: **33/33 passed** (25 golden scenarios, 60 tuning cases, 4 margin cases, contract, noise reproducibility). First try, no follow-up prompts.
- Browser smoke test on GitHub's CI (CI run 44363289256, run against `gemini/pro`): **7 tabs, 9 sliders tested, 0 failures in light and in dark mode**, including 375 px mobile.
- Gemini's logs show no reads of `ap-sim/` or the Claude-side docs. The one mention of `ap-sim/` is in its report, describing where `expected.json` came from.
- Problems found on the Claude side, not in Gemini's build: (1) GitHub doesn't start CI for pushes made by a workflow, so CI never ran on `gemini/pro` automatically. (2) CI tried to smoke-test `/` before Claude's site existed and failed on the bare directory listing. Fixed in `ci.yml`: test only the builds that exist; manual runs can target another branch. (3) This sandbox's Chromium can't reach the Plotly/KaTeX CDNs, so browser tests run on GitHub's CI instead.

**Next step:** Claude's website build in a fresh Claude Code session (plan mode, `docs/build-prompt.md`, output `site/`).

### Part 8: Claude website build started; deliverables plan

**Prompts (verbatim):**
15. "did you already use all of the $20? this is crazy, we build the whole separations website for like less that three dollars, what is making it so expensive this time?" (Claude explained that $46.28 is the script's deliberately pessimistic estimate; at the separations comparison's price basis the real cost is about $3.58)
16. "oh okay that is fine carry on, do you need anything from me?"
17. "you can start the new session, whenever you need anything from me just ask!"

**What the AI produced:**
- Claude started a **separate** Claude Code session (Opus 5.5, plan mode, from `main`, pushing to `claude/site-build`) with the build prompt from `docs/build-prompt.md` verbatim (output folder `site/`). `main` doesn't contain Gemini's site, so the build session can't see it. It waits in plan mode for Andrew's approval.
- `docs/plan-deliverables-claude.md`: the plan for the remaining documents, the website content, the presentation, and the YouTube materials (draft, awaiting Andrew's approval).

**Next step:** Andrew approves the build session's plan (answering any questions the same way Gemini's were answered) and the deliverables plan.
### Part 9: Claude website build

Written by Claude Code at the end of the session, from the session itself. Prompts are quoted verbatim.

**Prompts (verbatim):**
18. The build prompt from `docs/build-prompt.md` (output folder `site/`), delivered to a fresh Claude Code session started in plan mode. Not repeated here.
19. Andrew approved the plan without changes.
20. "Put the charts above the controls on mobile"
21. "what's the next steps?"
22. "yes, do steps 1 and 2" (step 1 = this process-log entry, step 2 = `docs/comparison.md`)

**What the AI produced:**
- Claude Code (Opus 5.5; the session record confirms `claude-opus-5-5` served every turn): a plan written after reading only the allowed files (plan v2, `data.js`, `tests/`, `package.json`, `CLAUDE.md`). Plan v1 was off-limits, so Claude derived the ODEs, linearization, half rule and the three IMC formulas itself and checked each against the numbers in `tests/expected.json` before writing code.
- `site/js/model.js` (commit `05d8709`): pure engine with the full §9 API. **`npm test` 33/33 on the first run**, no fixes.
- `site/index.html`, `site/css/style.css`, `site/js/app.js` (commit `8636e2f`): the seven tabs, 22 presets, charts P1–P11 plus a bolus chart on Theory, equation · units · meaning cards, a live SVG block diagram, saved-run overlay, light/dark, AI Workflow / Video / References as placeholders.
- Commit `ce6a77f`: charts above the controls at ≤ 900 px wide (prompt 20).
- Timing: session started 17:56 UTC, site committed 18:24 UTC (≈ 27 min including its own browser checks).

**Choices Claude made where plan v2 is silent (reported, not asked):**
- `saturation: false` removes all pump limits (PID clip, anti-windup and total), with a warning if insulin goes negative.
- An invalid run (glucose ≤ 0) stops; the arrays are cut short and `valid = false`.
- Noise is drawn at every sample, even while the sensor is stuck or dropped out.
- Presets come from the scenario list in `expected.json` (meals at 60 min); the default preset equals `DEFAULT_INPUTS`.
- Picking the drift fault with a zero rate starts at +10 mg/dL per h (the drift preset's value).

**What I accepted / changed / rejected, and why:**
- Accepted the plan as written. Asked for one layout change (prompt 20) because on a phone the controls came before every chart.

**Problems hit:**
- This container's proxy blocks the Plotly and KaTeX CDNs (HTTP 403). For testing only, Claude served the same pinned versions from local npm copies through a Playwright route; the site still loads them from the CDN. A copy of `tests/browser-smoke.mjs` with that route added was used; `tests/` was not changed.
- Claude's own browser check (beyond the smoke test) found two bugs, both fixed before the commit: the fault-start slider did nothing for drift with a zero rate, and the Theory bolus sliders changed only text (a chart was added).
- Final checks: smoke test 7 tabs, 10 sliders, 0 failures in light and dark, no horizontal scroll at 375 px; Claude's extra check moved all 40 Simulator sliders (with feedforward, faults, set point and sensitivity switched on) plus the 8 on Theory and Control Design, loaded every preset, and found no NaN, KaTeX errors or console errors.
- The build prompt limited edits to `site/`, so this process-log entry was written afterwards (prompt 22), not during the build.

**Next step:** compare the two builds (Part 10).

### Part 10: build comparison

**Prompt (verbatim):** 22 above.

**What the AI produced:**
- `docs/comparison.md`, laid out like the separations comparison: setup, results table, findings, fairness caveats, process lessons, and an empty "My conclusions" for Andrew.
- `tools/compare-builds.mjs` → `docs/comparison-data.json`: precision against the reference, agreement between the builds on 13 inputs that aren't in the tests, 18 invalid-input cases, and speed.
- `docs/screenshots/comparison/`: six screenshots (Simulator light/dark, Control Design) of both builds, plus smoke-test reports for both builds in light and dark (all 0 failures).

**Key results (details and sources in `docs/comparison.md`):**
- Both builds: 33/33, 0 smoke-test failures. Gemini matches the reference ~1000× more closely (it copied the full-precision default gains from `expected.json`; Claude recomputes them from the rounded fits in `data.js`) and its engine is ~2× faster.
- Gemini's site has problems the smoke test can't see: the PID-vs-MPC chart (P9) reads data keys that don't exist, so it shows no data; the block diagram has black filled shapes; there is no τc control or step-by-step IMC calculation; only 9 equations on the site vs Claude's 51.
- Gemini wrote its own AI Workflow history instead of a placeholder. It says Gemini's critique found "26 potential pitfalls" (the critique has 11 findings; 26 is the number of rows in Claude's decision table), and it removed every [TO VERIFY] flag.
- Claude's engine sanitizes bad inputs and warns, but it drops a negative set-point step silently. Gemini's throws on t_end < 0 or dt = 0 and returns NaN for a NaN gain.
- The two builds read two plan sentences differently ("no clip when saturation = false" and "one draw per sample read"). Neither is tested.

**What I accepted / changed / rejected, and why:** *[Andrew: to fill after reading `docs/comparison.md`, and write "My conclusions" there.]*

**Problems hit:**
- Claude is comparing its own build. Every claim in the comparison is tied to a test, a script output or a line of code so Andrew can check it.
- The session's cost ($6.05 so far) covers the build and the comparison together; the build's share can't be separated.

**Next step:** Andrew reviews `docs/comparison.md` and writes "My conclusions"; then decide whether to fix Gemini's P9 (a follow-up run) or add a content check to the browser test; then deploy to Netlify.

### Part 11: both builds merged to main; Netlify zip

**Prompts (verbatim):**
23. "Did we go this far with the separations build? Or what steps should we do next to follow similar decisions to separations. Sorry, I'm just kinda confused on where exactly we are in the build of the website; I felt like we moved on to zip files by now when it came to the seperations." (Claude checked the separations process log: there, both builds were merged, zipped, deployed and tested live **before** the comparison write-up. Here the comparison came first, so merge, zip and deploy were next.)
24. "yes, merge to main and send me the zip"

**What the AI produced:**
- Merged `gemini/pro` into `claude/site-build` (`site/` = Claude, `site/gemini/` = Gemini, unchanged), then merged `main` (Part 8 above and `docs/plan-deliverables-claude.md`). The log conflict was resolved by keeping both entries and renumbering this session's to Parts 9–10.
- Combined checks: `npm test` 65/65 (both builds); smoke test 0 failures on `/` (7 tabs, 10 sliders) and `/gemini/` (7 tabs, 9 sliders), light and dark (CDN libraries served locally, as before).
- `main` fast-forwarded to `claude/site-build`. Netlify Drop zip `dist/closing-the-loop-site.zip` (not committed), checked file-by-file against `site/`.

**Next step:** Andrew drags the zip onto Netlify and sends the URL; Claude runs the tests on the live site (the first real test of the Plotly/KaTeX CDN links).

### Part 12: hosting moved to GitHub Pages

**Prompts (verbatim):**
25. "can I use hugging face spaces to host the website? I am going to run out of credit if I keep redeploying on Netlify"
26. Answer to Claude's question on which host: "GitHub Pages (Recommended)". Then approved the plan.

**Options considered (all free and named in the assignment, `context/assignment.md`):**
- **Netlify** (used first, as in separations): drag-and-drop of a zip, but each redeploy uses credit on the free plan (Andrew's observation), and every update needs a manual zip and upload.
- **Hugging Face Space (static):** free and mentioned by Prof. Co, but each update needs either an HF write token for Claude or a manual upload by Andrew.
- **GitHub Pages:** free for a public repo; CI can publish `site/` on every push to `main` with the built-in token, after the tests pass. No zips, no extra token.

**Decision (Andrew):** GitHub Pages, because it deploys itself and costs nothing per deploy.

**What the AI produced:**
- `.github/workflows/ci.yml`: a `deploy` job (needs the reference, npm and browser jobs; runs only on `main`) that publishes `site/` (both builds) with `actions/deploy-pages`, and a `live` job that checks every deployed file matches the repo byte for byte and runs the browser smoke test on the live URL (both builds, light and dark, with the real CDNs). This replaces the separations step "deployed, run the tests on the live site".
- `CLAUDE.md`: hosting line updated.

**One-time setup (Andrew):** repo Settings → Pages → Build and deployment → Source: "GitHub Actions" (the workflow's token can't turn Pages on by itself).

**Result:** Andrew enabled Pages ("done"); `main` moved to `33626bc`. CI run 44386879442: reference, npm test, browser, **deploy** and **live** jobs all green. Live site **https://be-aa8.github.io/PD-C/** (Claude) and **https://be-aa8.github.io/PD-C/gemini/** (Gemini): all 10 deployed files match the repo byte for byte; smoke test with the real CDNs 0 failures on both builds in light and dark (7 tabs; 10 and 9 sliders). Screenshots: the run's `live-results` artifact (30 days).

**Next step:** Andrew reviews the live site and writes "My conclusions" in `docs/comparison.md`; the AI Workflow, Video and References tabs come next (`docs/plan-deliverables-claude.md`).

### Part 13: Claude's build only; simulator improvements, round 1

**Prompts (verbatim):**
27. "I like Claude version better, lets move forward with only its version currently."
28. Answers to Claude's questions: Gemini's site → "Keep frozen at /gemini/ (Recommended)"; next focus → "Improve the simulator first"; improvements → all four offered ("Phone controls reachable", "Manual tuning mode", "Input-warning fixes", "Chart-content tests"). Then approved the plan (`docs/plan-simulator-round1-claude.md`).

**What the AI produced:**
- **Phones:** a floating "⚙ Controls / ↑ Charts" button on the Simulator tab (≤ 900 px), and collapsible control groups (only Preset and Controller open on phones).
- **Manual tuning mode:** a "Tuning: IMC (from τc) | Manual gains" toggle on the Simulator and Control Design tabs. Manual starts from the current IMC gains (nothing jumps); Kc, τI, τD sliders; P10 becomes peak/nadir vs Kc; the IMC step card shows the manual gains and Kc/Kc,IMC. Example: Kc = −1.2 (≈ 2.8× IMC) gives a sustained oscillation, a good demo of the delay limit.
- **Engine (`site/js/model.js`):** warnings for an invalid set-point step (was dropped silently), Kc > 0, and unknown controller/mode/anti-windup/fault names. `npm test` 65/65.
- **β slider** now appears only when a set-point step is on: Claude's own check found it changed nothing otherwise (it had passed the smoke test only because its value label changed).
- **`tests/browser-content.mjs`** (new): 19 checks that charts and numbers show the right data (P1 = `simulate()`, KPIs = `metrics()`, a preset = the Python reference, P4 = `nonlinearGain()`, P9 = `DATA.mpcComparison`, the margins text = the reference, P10 markers, manual mode, phone button, no horizontal scroll). Proven to catch a planted P9 data swap (17/19). Added to CI on the local server and on the live site, light and dark.
- `docs/comparison.md`: "Post-comparison changes" note.

**What I accepted / changed / rejected, and why:**
- One part of option 3 was dropped by Claude before building, and stated in the plan: copying the reference's full-precision default gains from `tests/expected.json` would break plan v2 §13 (only `DATA` may be hard-coded; computed values must be computed). The computed gains differ by 6.5 × 10⁻⁷ relative.

**Problems hit:** none beyond the β finding above.

**Results (local, CDN served from local copies):** smoke test 0 failures on `/` (9 sliders) and `/gemini/` (9), light and dark; content test 19/19 light and dark; extended check (40 Simulator sliders with options on, 11 in manual mode, 5 manual on Control Design, 8 on Theory/Design, every preset) found no NaN, console errors or dead sliders.

**Next step:** push to `main` → CI deploys → live tests (now including the content test).

### Part 14: brief for a third model (ChatGPT) to plan the UI/UX redesign

**Prompt (verbatim, Andrew pasting ChatGPT's request):** "I'm working with ChatGPT to give the website an overall UI and UX redesign plan for you to implement later. Here is what it is asking for, provide the materials needed please. 6. What I need to know about your project … What is the class project about? If you have the existing website, send me its URL or upload the source files. … My goal would be to develop a cohesive design direction that combines: visual storytelling. sophisticated technical presentation. minimalist typography and scroll interactions. I would prioritize making it look like a professionally designed technology company's website, not a student website with a dark theme."

**What the AI produced (same pattern as separations):**
- `docs/ux-brief-for-chatgpt.md`: what the project is (the process-control framing and the four-step teaching story, using only numbers the site or the Python reference computes), live URL and repo, the current 7-tab structure with counts, which files may change (`model.js`, `data.js`, `site/gemini/` may not), the course rules (disclaimer on every page and no "real medical product" look; equation + units + interpretation visible; every calculation charted; no new numbers), the tests and every ID they rely on, a starting list of UX problems, and what ChatGPT should return (direction, page-by-page plan, phases, questions). ChatGPT plans; Claude implements later.
- Not committed (in `dist/`): `chatgpt-ux.zip` with the brief, `chatgpt-ux-bundle.txt` (brief + `index.html`, `style.css`, `app.js`) and 12 current screenshots (desktop light/dark, phone).

**Next step:** Andrew gives ChatGPT the brief and the zip, brings back its plan; Claude reviews it against the tests and rules, then implements it in phases (plan mode first).

### Part 15: redesign brief from ChatGPT; Phase 1 (design foundation)

**Prompts (verbatim):**
29. Andrew pasted ChatGPT's full redesign brief ("CLOSING THE LOOP — COMPLETE UI/UX REDESIGN", 9 parts, 7 phases), saved verbatim as `docs/redesign-brief-chatgpt.md`. Its first task: audit the code and present a Phase 1 plan before changing anything.
30. Answer to Claude's question on the theme: "Dark by default + toggle (Recommended)". Then approved the plan (`docs/plan-redesign-phase1-claude.md`).

**Claude's audit, including where the brief didn't match the code** (to settle in later phases): there is no "?" help toggle on this site (that was the separations site); there are no photos and none may be stock, patient or device imagery, so the "cinematic" hero visual is proposed as SVG/canvas drawn from the model's real trajectories (to confirm at Phase 3); the brief's Theory chapter list renames today's sections (content kept either way); fonts are self-hosted instead of loaded from Google.

**What the AI produced (Phase 1, presentation only):**
- `site/css/style.css` rewritten as a design system: theme-independent tokens (fluid type scale with `clamp()`, 4-px spacing, radii 24/18/14/10, three shadow levels, motion durations with a `prefers-reduced-motion` override), dark tokens (default) and light tokens from the brief, aliases so older rules and `app.js` keep working, and every existing component re-skinned (tabs with an animated underline, pill segmented controls and buttons, cards, KPI tiles, callouts, tables, the block diagram). Same markup and layout.
- **Contrast:** in light mode the brief's accent, blue, amber and red reach only 3.4–4.5:1 against the background, below the 4.5:1 that WCAG AA requires for text. They are kept for fills and lines, and darker `--*-ink` variants carry text. Every text token now passes AA on every surface in both themes (checked by script).
- **Chart palette:** the brief's soft colours failed the dataviz palette checker as chart lines (too pale and gray to tell apart). Six series were derived from the same hues in OKLCH (green, blue, amber, violet, red, teal) and pass in both themes; one dark-mode pair is in the "secondary encoding" band, and the only chart that shows six series already uses dashed and dotted lines.
- **Fonts:** Inter (body) and Manrope (display), variable `woff2`, self-hosted in `site/fonts/` with their SIL OFL licences; latin, latin-ext and Greek subsets (the UI uses τ, θ, β).
- **Theme:** dark for every first visit; a header toggle switches to light and is remembered (`localStorage`); `?theme=light|dark` in the URL also works. Set before first paint by a small inline script. Charts re-theme instantly (a `MutationObserver` on the theme attribute).
- **Tests:** the content test now checks the default theme, the toggle, the remembered choice after reload, and that P1 re-themes (25 checks), and can run with `--theme light`. CI adds a smoke run of `/?theme=light`, because the site no longer follows the device's light/dark setting.

**Problems hit and fixed during Phase 1:** the KPI values wrapped onto two lines at the new display size (resized; checked at 1280, 1024, 768 and 375 px); the Control Design tuning group showed a raw browser `▼` marker (group styles now apply everywhere); the theme toggle wrapped below the title on phones.

**Results (local, CDN served from local copies):** `npm test` 65/65; smoke test 0 failures on `/` (dark default), `/?theme=light` and `/gemini/`, with no console errors; content test 25/25 in both themes; extended check (all sliders, presets, manual mode) clean. Screenshots of every tab reviewed at 1280 and 375 px in both themes.

- First CI run of Phase 1 (44421655694): all tests passed, but the screenshot upload failed because the light-theme smoke run saves into a folder named `?theme=light`, and `?` is not allowed in artifact file names; the deploy was therefore skipped. Fixed by renaming the folder before upload (both jobs).

**Next step:** Andrew reviews Phase 1 on the live site; then Phase 2 (header, navigation, page containers, footer).

### Part 16: redesign Phase 2 (global navigation and layout)

**Prompt (verbatim):** 31. "start phase 2" (Claude entered plan mode, as `CLAUDE.md` requires for new work; Andrew approved `docs/plan-redesign-phase2-claude.md`).

**What the AI produced (presentation only; same 7 tab buttons, ids and behaviour):**
- **Top bar**, sticky on every width, translucent with a blur, a hairline once the page scrolls: a small abstract loop glyph and the "Closing the Loop" wordmark, the seven tabs, and the theme toggle. Below 1100 px the tabs move to a second row that scrolls sideways inside itself. No hamburger menu: a hidden menu would make the smoke test find no visible tabs on phones and silently skip its mobile checks.
- **Sliding pill** behind the active tab (positioned from the active button; recomputed on resize and after the fonts load; no animation under reduced motion); the active tab is scrolled into view on narrow screens.
- **Disclaimer strip** under the bar on every page with the full, unchanged sentence (and again in the footer). Switching tabs now scrolls to the top, so the strip is in view whenever a page opens.
- **Page headers:** an eyebrow ("01 — Overview" … "07 — References"), the page title and the lead, with consistent spacing; a short fade-and-rise when a page opens. A visually hidden `h1` keeps the page outline for screen readers now that the old header title is gone.
- **Footer:** wordmark, course line, disclaimer; "Explore" buttons for each tab (buttons with `data-goto`, not `<a href="#…">` inside a `<nav>`, which the smoke test would count as tabs); "Project" links (source repo, Gemini's frozen build, model source, libraries and font licences).
- **Shared controls:** custom range sliders (filled track, round thumb, focus ring), selects with a drawn chevron, card hover, the "coming soon" placeholder panel.

**Problems hit and fixed:** `main` kept zero top padding because `.wrap` (a class) out-ranked `main` (an element) in specificity; the References placeholder mixed centred paragraphs with a left-aligned list; a large gap above the first Theory section. On phones, the jump from the charts to the controls (≈ 14,000 px) took about 2.5 s as a smooth scroll and left the content test's check at its edge (373 px against a 400 px limit); long jumps are now instant, short ones stay smooth.

**Results (local, CDN served from local copies):** `npm test` 65/65; smoke test 0 failures on `/`, `/?theme=light` and `/gemini/`; content test 25/25 in both themes; extended slider/preset/manual-mode check clean in both themes; no horizontal scroll at 1280, 1024, 768 or 375 px; screenshots reviewed (including the scrolled bar, the 1024 px two-row header, the footer, and the phone jump).

**Next step:** Phase 3 (Overview: hero, process diagram, the four teaching points with real model results, AI story, route into the Simulator). The hero visual will be generated from the model's own trajectories; to confirm with Andrew first.

### Part 17: visual references, master redesign plan, and redesign Phase 3 (Overview with a 3D pancreas)

**Prompts (verbatim):**
32. "before starting phase three, take note of these, well, notes. I gave ChatGPT 4 screen recordings of website layouts that I particularly liked. the 3d model pancreas is a dead set. I 100% NEED that on the website hehehehe. anyways:" followed by ChatGPT's "Visual Reference Analysis & Design Inspiration" notes (Harley-Davidson, Rivian, Nutrien, an interactive 3D pancreas viewer), saved verbatim as `docs/redesign-references-chatgpt.md`. ChatGPT's notes said a 3D model was optional; Andrew overrode that.
33. Answers to Claude's questions: the pancreas goes in the "Overview hero + viewer (Recommended)"; "Yes, driven by real sim data (Recommended)". Then approved the master plan (`docs/plan-redesign-master-claude.md`: design analysis against the four references, reusable patterns, a tab-by-tab plan for Phases 3–6, and the Phase 3 build).

**Decisions and reasoning:**
- **Real anatomy, not a made-up shape:** Claude searched for an openly licensed pancreas mesh and used BodyParts3D (Database Center for Life Science, CC BY-SA 2.1 Japan; Mitsuhashi et al. 2009): pancreas, main pancreatic duct and duodenum. A Node script (`tools/build_pancreas_mesh.mjs`, no dependencies) downloads the STLs, merges vertices, re-centres and smooths them, and writes a 330 KB binary plus a JSON header. The source STLs are not committed; the adapted mesh carries the same licence (`site/models/LICENSE-BodyParts3D.txt`) and is credited on the References page and in the footer.
- **"Driven by real sim data":** the hero's islet points glow with the insulin rate U(t)/U_max from `simulate()` of the default case while a playhead runs along the true-glucose trace (the same arrays the Simulator shows). The islets are labelled schematic everywhere: they are random points on the surface, not anatomical data. The one physiology sentence (β-cells release insulin) is marked [Seborg et al., Ch. 23 — TO VERIFY].
- **One new library, loaded only when needed:** three.js 0.170.0 (MIT), pinned on jsDelivr through an importmap and imported only when the Overview is shown.
- **Chapters use real numbers only:** feedback reacts late (peak 163.4 / nadir 49.4 mg/dL, 91.3 % in band), the pump's lopsided authority (+98.3 vs −16.7 mU/min, ratio 0.17), feedforward (pre-bolus: 107.9 / 62.2 mg/dL, 100 % in band), and delay limits stability (PM 58.6°, 48.1 min tolerable continuous vs 43.4 min sampled). All computed at load by the engine or read from `data.js`; the content test checks them against the Python reference.

**What the AI produced:** the new Overview (hero with the rotating pancreas and live glucose trace; an interactive loop diagram; four alternating chapters with SVG visuals; the "Explore the organ" viewer with a tool rail — rotate, zoom in/out, wireframe, cross-section, isolate duct, duodenum context, reset — hotspots for head, neck, body, tail and the duct, and a breadcrumb; grouped course concepts; an AI-workflow strip; a call to action), `site/js/pancreas.js`, the mesh build script and assets, styles for the shared patterns (story section, viewer frame, metric).

**Problems hit and fixed:**
- Headless Chromium uses software WebGL (SwiftShader): about one frame every 7 s, which made screenshots time out. The viewer now detects software rendering or slow frames and switches to a low-power mode (no auto-rotate, renders only on interaction). It still rotates continuously on real GPUs.
- The first frame's timestamp could precede the animation start, giving `NaN` SVG coordinates (fixed with a positive modulo and clamping).
- The raw mesh looked faceted (Taubin smoothing); the Body and duct labels overlapped (duct label shown only when the duct is exposed); the Head and Neck labels overlapped (Head label flipped left); the organ was cropped on phones (the view widens on portrait stages); the chart legend entries collided.

**Tests added (content test, now 39 checks):** hero trace = `simulate()` G(t) (SVG path inverted back to mg/dL); each chapter's numbers equal the Python reference (`tests/expected.json`) or `DATA`; both 3D viewers load; each tool toggles `aria-pressed` and Reset clears them; every visible hotspot opens its part in the info panel and breadcrumb; with WebGL disabled, the fallback notice appears and the chapters still render; no page errors.

**Results (local, CDN served from local copies):** `npm test` 65/65; smoke test 0 failures on `/`, `/?theme=light` and `/gemini/` (device light and dark); content test 39/39 in both themes; no horizontal scroll at 375 px; no console errors at 1280 and 375 px in both themes; screenshots reviewed.

**Next step:** Andrew reviews the Overview on the live site. Then Phase 4 (Simulator workspace), per the master plan.

### Part 18: redesign Phase 4 (Simulator workspace)

**Prompts and answers (verbatim):** after Phase 3 went live, Claude asked whether to fix the too-small phone loop diagram now or later; Andrew chose "Fold into Phase 5 (Recommended)" (noted in the master plan). Claude then planned Phase 4 in plan mode; Andrew approved it (`docs/plan-redesign-phase4-claude.md`).

**What the AI produced (presentation only; every control, preset, chart id, equation and unit kept):**
- **Workspace header:** the preset menu (the same `#sim-preset`, now built into the header instead of the controls rail), the pass/fail badge, the band menu, and a toolbar: Save run, **Reset** (new: back to the default Ex. 23.6(e) case) and **?** (new: an inline help panel with how to read the page and the numerical method, which used to be the page lead).
- **KPI strip:** peak and nadir lead, larger, tinted red when they leave the band and green when inside, each with its time; time in band, IAE and bolus smaller.
- **One instrument:** P1 at 520 px (360 on phones) with P2 and P3 attached below in the same panel and the same left margin, so the three time axes line up; zooming or panning any one moves the other two (double-click resets).
- **Quieter controls rail:** a translucent panel on desktop; each group has a one-line description.
- **Below the instrument:** "Compare runs" (P8 with each saved run as a chip with its colour and a remove button), "Analysis" (P10/P11) and "Detailed metrics" (the 12-row table in a disclosure, open on desktop, closed on phones). The "Why real systems are harder" callout stays at the end.

**Problems hit and fixed:** an unexplained gap under the lead KPI tiles on phones turned out to be a class-name collision: the tiles' `lead` class also matched the page-lead paragraph style (its bottom margin and font size); renamed `kpi-key`. Five KPI tiles in one row clipped their values at 768–1180 px; they now sit as two lead tiles over three smaller ones. The metrics table's "Value" header wrapped mid-word.

**Tests added (content test, now 45 checks):** the peak tile is flagged out of band for the default and in band for the pre-bolus case; Reset restores the default preset and the reference peak; the help button opens and closes its panel (`aria-expanded`); zooming P1 to 100–300 min moves P2 and P3 to the same range; removing a saved-run chip removes exactly its P8 trace.

**Results (local, CDN served from local copies):** `npm test` 65/65; smoke test 0 failures on `/`, `/?theme=light` and `/gemini/` with the device in light and dark; content test 45/45 in both themes; extended slider/preset/manual-mode check clean; no horizontal scroll and no console errors at 1280, 1024, 768 and 375 px in both themes; screenshots reviewed.

**Next step:** Andrew reviews the Simulator on the live site; then Phase 5 (Theory and Control Design, including the phone layout for both loop diagrams).

### Part 19: the 3D pancreas made the Overview lag and crash on desktop

**Prompt (verbatim):** 34. "is there anyway we can make the website less laggy, with the 3D models, my website is crashing everytime"

**Andrew's answers to Claude's questions (verbatim):** "It only crashes on the 3D models, the other tabs work fine. Right now it crashes on overview for desktop/laptop. The website remains working for the phone at all time. The top 3D pancreas does not do any animation and is still. the bottom works as designed, but is very slow." Loading choice: "Hero live, viewer on tap (Recommended)". Plan approved: `docs/plan-3d-performance-claude.md`.

**Diagnosis (Claude, from the code and the symptoms):** a still hero on a laptop means the viewer had switched to its low-power mode, which happens when the browser draws WebGL in software (hardware acceleration off or the GPU not used), the same path as the headless test browser. In that state the page made things worse: two WebGL contexts that were never released, up to 2× pixel ratio with antialiasing, blur effects over the moving canvas (the glass glucose card and the sticky header), and per-frame layout work (a size read every frame, label positions rewritten every frame, the readout's HTML rewritten 60 times a second, a hero loop that kept running on every tab).

**What changed:**
- **Live 3D only with a hardware renderer.** The page asks the browser for a context with `failIfMajorPerformanceCaveat` and checks the renderer name; on a software renderer it shows a pre-rendered still of the pancreas instead, and the glucose trace, playhead and readout keep animating. The viewer explains why ("Live 3D is off: this browser is drawing graphics without the graphics card…") and offers "Try live 3D anyway" at low resolution.
- **The full viewer starts on tap** ("Explore in 3D"); the hero is then released, so there is never more than one WebGL context. Leaving the Overview releases everything (`forceContextLoss`); returning restarts the hero (the mesh stays cached).
- **Cheaper frames:** pixel ratio ≤ 1.5 (antialiasing only below that), auto-rotation at 30 fps, no per-frame size read, labels rewritten only when the camera moves, readout text 5×/s, no blur over the canvas.
- **Stills:** `tools/render_pancreas_stills.mjs` renders `site/models/pancreas-hero.webp` and `pancreas-viewer.webp` (≈ 32 KB each, transparent, both themes), credited under the same CC BY-SA 2.1 JP licence.

**Measured (local headless Chromium, software WebGL like Andrew's laptop; 1440×900 at 2×; load, 6 s on the hero, scroll to the viewer, a 20-step drag, back to top):**

| | Main-thread busy | Long tasks (> 50 ms) | 20-step drag | WebGL contexts |
|---|---|---|---|---|
| Before | 3.24 s | 24 (1.81 s total) | 1.34 s | 2 |
| After, default (no tap) | 1.47 s | 2 (0.19 s total) | 0.69 s | 0 |
| After, "Try anyway" tapped | 3.15 s | 4 (0.45 s total) | 1.55 s | 1 |

On a software renderer, live 3D stays slow by nature; the difference is that it is now opt-in and never more than one context. These numbers are from the test machine, not Andrew's laptop; he will confirm there.

**Tests (content test, now 53 checks):** the default page shows the still and creates no WebGL context on a software renderer (or is live on a hardware one), with the reason and "Try anyway" shown; the hero playhead animates; the tools are disabled until the viewer starts. A forced-live page (`?3d=force`) checks that the viewer waits for a tap, starts on tap, that only one 3D view is live, the tools, Reset and hotspots, that leaving the Overview releases every view, and that returning restarts the hero. The no-WebGL check now expects the still and a disabled viewer button.

**Results (local):** `npm test` 65/65; smoke test 0 failures on `/`, `/?theme=light`, `/gemini/` (device light and dark); content test 53/53 in both themes; extended check clean; screenshots at 1280 and 375 px reviewed.

**Next step:** Andrew checks the Overview on his laptop. If the still image and "Live 3D is off" appear, hardware acceleration is off in that browser (Chrome: Settings → System → "Use graphics acceleration when available"; `chrome://gpu` shows the details); turning it on brings back the rotating hero.

### Part 20: redesign Phase 5 (Theory and Control Design)

**Prompt (verbatim):** 35. "it works now, start phase 5" (confirming the 3D fix on his laptop). Claude planned in plan mode; Andrew approved `docs/plan-redesign-phase5-claude.md`.

**What the AI produced (presentation only; every equation, unit, meaning, chart, control and tested id kept):**
- **Chapter navigator** (Theory and Control Design): a sticky numbered list beside the content on wide screens that marks the chapter in view, and a sticky "Jump to a chapter" menu on narrower screens. Built from buttons, because the smoke test counts links inside a `<nav>` as tabs.
- **Theory** in the five chapters of ChatGPT's brief: (1) nonlinear glucose–insulin model, (2) units and physical interpretation, (3) linearization and transfer functions, (4) nonlinear gain and half-rule analysis, (5) feedforward and bolus. Each chapter has a large number, a title and a short introduction. Every card was kept (only regrouped), and equations sit in tinted "equation wells". No derivation is hidden, as the brief requires.
- **Control Design** in the brief's eight chapters: configuration (the tuning inputs as a full-width bar instead of a tall column), the IMC method as a numbered three-step sequence, discrete PID, anti-windup, block diagram, stability margins, Bode/Nyquist, PID vs MPC.
- **Block diagram, redrawn and interactive:** more spacing, consistent arrowheads, labelled signals (e, u, U, G, D, G_m), feedback, disturbance and feedforward paths in different colours with a legend. Each block is a button: selecting it highlights the block and its wires and shows its transfer function and live numbers underneath (for example, the controller's K_c follows τ_c). Phones get a purpose-drawn **vertical** diagram with the same blocks and details, instead of a wide drawing that scrolled sideways.
- **Stability margins:** a strip of four numbers (PM, GM, ω_c, tolerable delay) above the existing cards, coloured by rule-of-thumb ranges (PM ≥ 30°, GM ≥ 1.7, marked [TO VERIFY in Seborg Ch. 14]). The cards with their equations stay below.
- **Overview loop on phones** (deferred from the Phase 3 review): a vertical cycle (meal → glucose → sensor → controller → pump → insulin, with a dashed return arrow back to glucose) with readable text.

**Problems hit and fixed:** at 1280 px the wide diagram beside its info panel was shrunk to about 60 % (8 px text), so the panel moved underneath. The three IMC steps side by side cut their equations off, so they became a vertical sequence. Chapter numbers wrapped ("0/1") in the navigator. The parameter table's symbol column wrapped mid-name. A TeX spacing command written with a single backslash showed as ",;" in the block details (found in the screenshots, fixed).

**Tests added (content test, now 62 checks):** the margin strip shows the reference PM and GM; the Control Design navigator lists 8 chapters; every diagram block opens its own details with rendered equations; the controller block's K_c follows a τ_c change to 40 min (checked against `imcTuning()`); the Theory navigator lists 5 chapters, jumps to each and marks the one in view; on a 375 px phone, the diagram is the vertical drawing with no sideways scroll, the chapter menu replaces the list, and the Overview loop is vertical.

**Results (local, CDN served from local copies):** `npm test` 65/65; smoke test 0 failures on `/`, `/?theme=light`, `/gemini/` (device light and dark); content test 62/62 in both themes; extended slider/preset/manual check clean; no sideways scroll and no console errors at 1280, 1024, 768 and 375 px in both themes; screenshots reviewed.

**Next step:** Andrew reviews Theory and Control Design on the live site; then Phase 6 (AI Workflow, Video & Transcript, References).

### Part 21: redesign Phase 6 (AI Workflow, Video & Transcript, References)

**Prompt (verbatim):** 36. "start phase 6"

**Andrew's answers to Claude's questions (verbatim where quoted):** video → "Not yet (Recommended)"; credit → "First name: Andrew"; reflections → "Placeholders for me (Recommended)"; model names → "flash 3.5 and opus 5.5", then, asked which model ChatGPT was, "sorry, I meant just the basic model". Recorded as: the Gemini web-app critique was **Gemini 3.5 Flash**; the ChatGPT redesign brief came from **ChatGPT's default model (version not recorded)**. Plan approved: `docs/plan-redesign-phase6-claude.md`.

**What the AI produced (from the records only; nothing invented):**
- **AI Workflow tab:** the models and services; a seven-stage timeline (plan v1 → Gemini critique → Andrew's 26 decisions → two independent builds → tests and comparison → selection → redesign) with each stage's facts, Andrew's verbatim prompt where there is one, and links to the evidence files; the 26 critique decisions (21 accepted, 3 accepted modified, 1 accepted as [TO VERIFY], 1 rejected; all approved) transcribed from `docs/critique-decisions.md`; a Claude-vs-Gemini table with a source per row; ten key prompts quoted verbatim; a labelled link to Gemini's frozen build; two boxes marked "To be written by Andrew" for his conclusions and what he learned. The content lives in `site/js/workflow.js`.
- **Video & Transcript tab:** a 16:9 stage with a labelled placeholder, the presentation details, and a transcript reader that says the transcript will be pasted verbatim. Adding the video later is one edit in `site/js/video.js` (YouTube id, date, transcript); the YouTube player then loads only when clicked.
- **References tab:** five groups (textbook and theory; model and parameter sources from `data.js`; tools and data, including BodyParts3D; AI contributions; project contributions). Every [TO VERIFY] flag kept; author initials that are not in the project's sources were left out, and the Bequette (2002) full citation is marked [TO VERIFY].

**Tests added (content test, now 73 checks):** 7 timeline stages that each open their own details; every evidence link points to a file that exists in the repository; every quoted prompt appears word for word in this log; the decision table matches `docs/critique-decisions.md` row by row; the Gemini link; Andrew's two boxes are placeholders; the video stays a placeholder while no YouTube id is set and the transcript is labelled, not invented; one reference per `DATA.sources` entry; the [TO VERIFY] flags are present; on phones the timeline is vertical with no sideways scroll.

**Problem hit:** the decision-table check first failed because the table sits in a closed disclosure, where `innerText` is empty; the check now reads `textContent`.

**Results (local, CDN served from local copies):** `npm test` 65/65; smoke test 0 failures on `/`, `/?theme=light`, `/gemini/` (device light and dark); content test 73/73 in both themes; extended check clean; no sideways scroll and no console errors at 1280, 1024, 768 and 375 px in both themes; screenshots reviewed.

**Still needed from Andrew:** record and publish the video, then paste the YouTube id and the verbatim auto-generated transcript into `site/js/video.js`; write the two "To be written by Andrew" sections (and "My conclusions" in `docs/comparison.md`); check the [TO VERIFY] items against the textbook.

**Next step:** Andrew reviews the three tabs on the live site; then Phase 7 (polish) from the master plan.

### Part 22: redesign Phase 7 (final polish and validation)

**Prompt (verbatim):** 37. "start phase 7". Claude planned in plan mode (audit first, fixes second); Andrew approved `docs/plan-redesign-phase7-claude.md`.

**Audit and fixes (measured before and after):**

| Area | Found (before) | Fix | After |
|---|---|---|---|
| Accessibility (axe-core 4.10.2, 7 tabs × desktop/phone) | Dark: 6 serious findings; light: 12. Primary buttons, pressed toggles and the phone Controls button had white text on the light accent below 4.5:1; the organ viewer was labelled as an image while containing buttons; 30+ wide equations and tables scrolled sideways but could not be reached by keyboard; the viewer tool rail was unreachable while its buttons were disabled; plus moderate findings (heading levels skipped, an `aside` nested in `main`, the disclaimer strip outside any landmark) | a darker solid accent behind white text in light mode (≈ 6:1, same hue); the viewer stage became a labelled group; scrollable equations and tables became focusable only when they actually overflow; tools use `aria-disabled` and stay focusable; heading levels fixed; the disclaimer strip is a labelled landmark; a "Skip to content" link | **0 violations of any severity** in both themes, desktop and phone |
| First paint (phone, 4× CPU throttle, median of 3) | 1.01 s: Plotly (~3.6 MB) and KaTeX blocked rendering in `<head>` | both scripts deferred (the module `app.js` still runs after them) | **0.23 s** |
| Slider response on the Simulator (τc, 10 steps) | median 353 ms per move; the metrics table re-typeset its 12 static equations on every move (≈ 33 ms) | the table's equations are typeset once; only the numbers update | median **271 ms** |
| Live sweeps (≈ 25 simulations after a move) | one blocking task per chart, up to 0.7–0.96 s, so the slider froze while they ran | one simulation per task with a yield in between; a newer move cancels an older sweep; results identical | longest blocking task ≈ **0.3–0.55 s** (now the per-move render, not the sweeps) |
| Reduced motion | checked: nothing animates on any tab | — | test added |
| Dead CSS | 11 rules for components replaced in earlier phases (old diagram, placeholder panel, old section headings, an unused hint) | removed after a selector-usage check | — |
| Consistency (screenshot matrix: 7 tabs × 4 widths × 2 themes) | Theory and Control Design titles ran to three lines; the Video page had no lead line | short titles ("Theory", "Control design") with the detail moved into the lead; a lead added to Video | reviewed |
| Sharing | no favicon (a 404 on every load), no link preview | an inline SVG favicon (the loop glyph); Open Graph/Twitter meta with a 1200 × 630 preview of the Overview hero, disclaimer included (`tools/render_og_preview.mjs`) | — |

Measurements are from local headless Chromium with the CDN files served from local copies (CPU throttled, no network throttling); they compare before and after on the same machine, not real-device timings.

**Tests added:** `tests/browser-a11y.mjs` (axe-core loaded from jsDelivr at test time, no new dependency; all 7 tabs, desktop and phone; fails on serious or critical findings; the only exclusions are Plotly's generated SVG internals and KaTeX's hidden MathML, listed in the file with the reason), run in CI on the local build and on the live site, both themes. Content test (now 77 checks): with reduced motion nothing animates; the skip link is the first keyboard stop and focuses the main content without changing the open tab; Plotly and KaTeX are deferred and still load; the preview image and favicon are present.

**Results (local):** `npm test` 65/65; smoke test 0 failures on `/`, `/?theme=light`, `/gemini/` (device light and dark); content test 77/77 in both themes; accessibility test 0 serious/critical (0 of any kind) in both themes; extended check clean; screenshot matrix reviewed.

**Status:** all seven phases of ChatGPT's redesign brief are done. Still Andrew's: the video and transcript, the "To be written by Andrew" sections, "My conclusions", and the [TO VERIFY] checks.

### Part 23: three prompts removed from the website

**Prompt (verbatim):** 38. "remove prompts 14, 25, 32 from website." Answer to Claude's question on prompt 32, which also appeared as the quote in timeline stage 7: "Remove both (Recommended)".

**What changed:** the AI Workflow tab no longer shows prompts 14, 25 and 32 (7 key prompts remain), and stage 7 has no quote box; its facts, including that Andrew required the 3D pancreas, are unchanged. This log still holds all prompts verbatim. The content test now also checks that the three are not on the page.

### Part 24: every [TO VERIFY] flag resolved on the website

**Prompt (verbatim):** 39. "okay now I want to completely finish the website. get rid of all of the to verify and red tags. ask me questions and we can clear things up and push"

**Andrew's answers to Claude's questions (verbatim option labels):** Seborg Ch. 14 margin ranges (PM ≥ 30°, GM ≥ 1.7) → "Book confirms it"; the model's source → "Secondary citation (Recommended)"; the τc guideline → "Keep only τc = θ (Recommended)"; the β-cell sentence (Seborg Ch. 23) and the Table 12.1 rows → "Book confirms both"; the two "To be written by Andrew" boxes → "Keep as placeholders"; the video → "Not yet, keep placeholder"; the history rows that mention TO VERIFY → "Reword on the site (Recommended)".

**Checked online by Claude before asking** (web search: PubMed/PMC and the authors' NTNU pages): Battelino T, et al., *Clinical Targets for Continuous Glucose Monitoring Data Interpretation: Recommendations From the International Consensus on Time in Range*, Diabetes Care 2019;42(8):1593–1603, doi:10.2337/dci19-0028; Skogestad S., *Simple analytic rules for model reduction and PID controller tuning*, J. Process Control 2003;13:291–309; Rivera, Morari & Skogestad 1986 exists (Ind. Eng. Chem. Process Des. Dev. 25:252–265), but the "τc > 0.8θ" guideline could not be confirmed, so it was removed. Seborg's own wording could not be found online; those items rest on Andrew's check of the book.

**What changed on the site:** all eight open flags removed with the resolutions above (References, the Control Design guideline caption and margin strip, the IMC step card, the islet note, the "Time in 70–180" metric). The Battelino citation was updated where it is generated (`tools/build_data.py` → `site/js/data.js`, one line; the CI drift check passes; Gemini's frozen copy is untouched). On the AI Workflow tab, critique row 25 shows "Accept (checked later against the textbook; resolved)" and the comparison row reads "Unverified-source flags"; `docs/critique-decisions.md` keeps the original table with a dated resolution note. The content test now checks that no tab contains "TO VERIFY" (78 checks).

**Still placeholders, by Andrew's choice:** the video and transcript, and the two "To be written by Andrew" sections.

**Results (local):** `npm test` 65/65; data drift check passes; content test 78/78 in both themes; accessibility test 0 serious/critical in both themes; smoke test 0 failures on `/`, `/?theme=light`, `/gemini/`.

### Part 25: Andrew's conclusions and reflections added

**Prompt (verbatim):** 40. "add this to the website conclusions: After comparison, I chose to ship mostly Anthropic made content. I found that Claude had better design and overall building skills. Something that surprised me while making the website was how good ChatGPT is at making moodboards and planning for uI and UX implementations. I found it much better than Claude and Gemini. If I were to rebuild a website, I would use GitHub Pages with a Gemini API key implementation, similar to what I did in Process Dynamics and Controls. This does cost you (I spent around $5 for both Separations and PD&C), but it is definitely worth it for hands free integration!

Something I learned about process control over these past few weeks has been how recycle effects processes. I liked working with AI and expanding my knowledge on building websites. In the future, I would like to further my understanding of LLMs and use GitHub Pages and Claude to build a homepage for all of my project and endeavors."

**Andrew's answers:** typos → "Fix those three typos (Recommended)" ("uI" → "UI", "effects" → "affects", "project and endeavors" → "projects and endeavors"; nothing else changed); also in the comparison document → "Yes, both places (Recommended)".

**What changed:** the AI Workflow tab's two placeholder boxes now hold Andrew's two paragraphs, credited "— Andrew"; `docs/comparison.md` §7 "My conclusions" holds paragraph 1. The content test checks that the website text equals §7 word for word and that no "To be written" placeholder remains. Claude wrote none of this text.

**Follow-up (same day):** the live-site accessibility test then failed once (CI run 45920836171; the site itself had deployed and the content test passed 78/78 live). Cause: on the live site KaTeX's web fonts arrive one face at a time from the CDN, and two equations became a few pixels wider than their box *after* the keyboard-focus pass had run, so axe saw scrollable equations that could not be focused. Reproduced locally by delaying the KaTeX fonts by 3 s. Fix: a ResizeObserver on each equation re-runs the pass whenever its typeset size changes (plus once when all fonts are ready). With delayed fonts and with normal fonts: accessibility 0 serious/critical in both themes; content test 78/78 in both themes.

### Part 26: Video script help, and the slides embedded under the video

**Prompts (verbatim, short):**
- 41. "here are the slides that im using to present in class and for the yt video. what im having trouble with is understanding every part of the website and how to explain it. … provide a layout/script …" The answers were about 15 minutes, a .docx not added to the repo, plus a glossary and Q&A prep.
- 42. "update the slides with those fixes, and give the script as something I can actually open, it won't let me open it right now. a claude artifact is okay also as long as I can open it"
- 43. "nice, can you make an easily printable version that can use minimal ink while still being readable on white apper"
- 44. "can you also embed the presentation into the website, this can be just right under the video embed"

**What was done for 41–43 (outside the repo, at Andrew's request):**
- Claude Opus 5.5 wrote a ~15-minute script. Part A covers the slides and Part B the website, with click-by-click stops, a glossary, and ten "how does that make sense?" Q&A answers.
- The script was delivered as a .docx, then as a Claude artifact (the .docx would not open for Andrew), then as a 12-page low-ink PDF.
- The deck was fixed to match the site:
  - slide 2: 35 → 40 prompts;
  - slide 7: "Double meal" → "2× meal";
  - slide 11: 43.2 → 43.4 min;
  - slide 17: the "to be written" boxes were replaced with Andrew's own conclusions.
- Every number in the script was checked against the site and `tests/expected.json`.

**Plan for 44:** `docs/plan-slides-embed-claude.md`.

**What changed for 44:**
- The Video & Transcript tab now has a slide viewer under the video with:
  - Prev/Next buttons and a live counter ("5 / 18");
  - left/right arrow keys;
  - a thumbnail strip, full screen, and download links for the PDF and PPTX.
- The images are `site/slides/slide-NN.webp` (1600 px, 0.6 MB in total). They were rendered from the fixed deck with the new `tools/build_slides.py`.
- `site/js/slides.js` lists one title per slide. Each title is used as alt text and as the caption.
- The deck's "40 prompts" is a snapshot from when the slides were made. This log now has 44.

**Results (local):**
- `npm test` 65/65.
- Content test 83/83, including 5 new slide-viewer checks.
- Accessibility test: 0 serious/critical findings, also with fonts delayed.
- Smoke test: 0 failures.
- No horizontal scroll at 375 px.
- Screenshots checked at desktop light/dark and on a phone.

### Part 27: The video is published; embedded with its verbatim transcript

**Prompt (verbatim, start):**
47. "time to add the transcript and embed the yt video: https://www.youtube.com/watch?v=SKINf0_tK18&t=10s" followed by the YouTube transcript as copied. Andrew's answer to Claude's question: recorded on 2026-11-28.

Before that, two chat-only prompts (nothing in the repo changed):
- 45. "can you create a good yt title and description for the video" (Claude wrote a title, two alternatives and a description with chapters).
- 46. "give 3 titles, and also provide 2 different prompts for Gemini to make thumbnails. make sure they are professional but also are fun and grab the attention of viewers. make the thumbnails relevant to the theme of the website." (Claude wrote three titles and two thumbnail prompts in the site's colours.)

**Plan:** `docs/plan-video-transcript-claude.md`.

**How the transcript was kept verbatim:**
- YouTube's copy puts a screen-reader duration label after each timestamp, for example `1:011 minute, 1 second um so…`.
- A script split each line into timestamp and text. It removed only that label, and only after checking the label against the timestamp.
- Adding each label back reproduced the paste exactly, character for character.
- 175 lines, from 0:01 "Hey guys, it's Andrew…" to 23:20 "Thanks for watching."
- YouTube's mishearings ("clawed code", "quad opus", "talc") are left as they are. A note above the transcript explains them.

**What changed:**
- `site/js/video.js`: the video id, the date and the transcript.
- `buildVideo()`:
  - The click-to-load poster is unchanged.
  - The transcript is shown as timestamped rows, and clicking a time plays the video from that point.
  - A "Watch on YouTube" link was added.
- `docs/PROJECT_STATUS.md`: the video, link and transcript rows are marked done.

**Results (local):**
- `npm test`: 65/65.
- Content test: 85/85. The new checks cover: the right poster and no iframe before a click; all 175 lines shown word for word in order; a timestamp click loading the video at that time.
- Accessibility test: no serious or critical issues, including with slow-loading fonts.
- Smoke test: 0 failures.
- No horizontal scroll at 375 px. Screenshots checked in dark mode, light mode and at phone width.

### Part 28: Final completion audit

**Prompt (verbatim, start; the full prompt is long):** 48. "FINAL PROJECT COMPLETION: FULL AUDIT, QUALITY CONTROL & LOOSE-ENDS REVIEW. I believe this project is nearly finished. I now want you to conduct a comprehensive final review and bring it to a genuinely complete, polished, submission-ready state. …" The prompt asked for ten things:
- a full functionality audit;
- an engineering-correctness check;
- a content check;
- a design check;
- a code check;
- testing;
- a requirement-by-requirement assignment checklist;
- the fixes;
- a final report;
- no fabrication anywhere.

**Plan:** `docs/plan-final-audit-claude.md`.

**What the audit checked:**
- **Functionality:** a full Playwright click-through of every visible control on all 7 tabs. The 245 controls were:
  - 17 sliders, 1 number box, 9 menus (every option), 7 toggles;
  - 232 buttons, including all 175 transcript timestamps, the 3D tools and the slide viewer.

  Also checked on desktop and phone, in both themes: console errors, failed requests, broken images, KaTeX errors,
  unlabelled controls, horizontal overflow, every link.
- **Engineering:** an independent re-derivation of 31 quantities with scipy (analytic linearization, LSODA, a
  separately written discrete PID, its own least-squares SOPDT fit and frequency response). All agree with the site:
  31/31, closed-loop peaks and nadirs within 0.1%.
- **Content:** every tab's rendered text was read in full.

**Issues found and fixed:**
- **High:** `docs/PROJECT_STATUS.md`, which the site links to, was the 2026-11-18 audit and said there was no Gemini
  work and no deployment. It is now a current requirement checklist with test results. The old audit is kept as
  `docs/audit-2026-11-18-claude.md`, and the timeline link now points to it.
- **Medium:**
  - the AI tab said "All 35 prompts". It now says 48, and a new content check ties that number to this log;
  - the two chat-only prompts (45, 46) were recorded, so the video prompt became 47;
  - a sentence fragment, "Row numbers in Table 12.1.", left on the Control Design IMC card was removed;
  - the README had no links: it now has the site, video, slides, workflow, repository map and test commands.
- **Low:**
  - on phones, the 3D tool strip hid half its tools behind an invisible scrollbar; it is now a 4 × 2 grid;
  - the YouTube iframe raised a browser warning (allowfullscreen duplicated the allow list);
  - the static "Recorded: not yet" fallback was corrected;
  - the contributions text is now in the past tense;
  - the comparison row "Unverified-source flags: kept" now reads "kept at build time (all resolved later)";
  - the decision table now says its reasoning is as written at the time;
  - the row-9 Table 12.1 resolution was added to `docs/critique-decisions.md`;
  - resolved [TO VERIFY] comments in `ap-sim` (Battelino, Skogestad) were updated with no change to any number
    (`build_data --check` and `build_expected --check` still pass).

**Not changed, and why:**
- The 26 decision rows keep their original reasoning; they are a dated record.
- `ap-sim/app.py` (the legacy Streamlit app, not deployed) still flags Bergman et al. (1979) as unverified, which is
  true.
- A WebGL "GPU stall due to ReadPixels" warning appears only with the software renderer used for testing.

**Results:**
- `npm test`: 65/65.
- `pytest`: 100/100.
- Both drift checks pass.
- Content test: 86/86 in light and dark.
- Accessibility test: 0 violations at any severity, including with slow fonts.
- Smoke test: 0 failures.
- Sweep: no errors, no failed requests, no overflow.
