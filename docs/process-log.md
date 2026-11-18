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

**Next step:** Andrew enables Pages; Claude moves `main` forward; CI deploys and tests the live site; Claude reports the URL.
