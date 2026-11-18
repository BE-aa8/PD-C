# Plan: adopt the GitHub + Claude Code + Gemini (Actions) workflow for this project

**Author:** Claude Code (Opus 5.5) · **Date:** 2026-11-18 · **Status: DRAFT, awaiting Andrew's approval**
Nothing in this plan has been implemented. The only change made so far is this file.

## 0. What I checked before writing this

I read the previous project's repo (`BE-aa8/seperations`, branch `main`, commit `1e6074c`):
`.github/workflows/gemini-build.yml`, `.github/scripts/run-gemini.sh`, `.github/workflows/ci.yml`,
`CLAUDE.md`, `netlify.toml`, `context/assignment.md`, `docs/critique-decisions.md`,
`docs/critique-v1-gemini.md`, `docs/process-log.md`, `docs/comparison.md`,
`docs/gemini-build/{prompt.txt,costs.tsv}`.

Facts from that repo that matter here:
1. Gemini CLI **0.68.0**, headless (`-p`, `-o json`), `--approval-mode plan` for the read-only
   stage, `--yolo` for build/followup. Per-stage time limits of 10/30/15 min; job timeout 45 min.
2. A guard reverts any file Gemini changes outside its allowed folders.
3. The cost estimate is deliberately high ($4/M input, $18/M output, no cache discount). The
   recorded estimates were **$2.56 for plan and $34.05 for build**. With `BUDGET_USD: "6"`, the
   **build run alone went far past the budget**: the guard only checks *before* a run starts.
   (The comparison doc estimates the real spend at ≈ $2.85, from a different price basis.)
4. **The critique was not done through the workflow.** It was pasted from the Gemini web app
   (`critique-v1-gemini.md`, "Gemini app, 2026-11-13"). The workflow did Gemini's *plan* and
   *build* stages.
5. Gemini's branch was created **from Claude's branch**, so Gemini could see Claude's build.
6. `context/assignment.md` holds the assignment verbatim; it is the same professor (Co) as this
   repo's README names.
7. The previous site was static HTML/JS, hosted on Netlify by drag-and-drop of `site/`.

## 1. Where this project differs, and what I propose

### 1.1 Hosting: Python/Streamlit vs Netlify (decision D1)
Our simulator is Python (numpy/scipy) with a Streamlit UI. **Netlify only serves static files;
it cannot run a Streamlit server.** Options:

| Option | What | Pros | Cons |
|---|---|---|---|
| **A. stlite on Netlify** (recommended, *after a feasibility spike*) | Run the existing Streamlit app in the browser via Pyodide (stlite), plus static documentation pages, all in one Netlify `site/` | Same workflow as last time; one URL; no server; reuses the tested `apsim` code unchanged | First load is slow (downloads Pyodide + numpy/scipy, maybe 10–30 s); stlite/Pyodide versions must be pinned; **not yet verified to work with our code** |
| B. Netlify docs + Streamlit Community Cloud simulator | Static docs site on Netlify, with a link to the simulator on share.streamlit.io | Native Streamlit, fast; zero porting | Two URLs/hosts; the Streamlit app sleeps when idle |
| C. Streamlit Community Cloud only | Docs as extra Streamlit pages | Simplest | Drops the Netlify workflow; weaker as a polished documentation site |

Plan: a **time-boxed spike** (about 1 hour) to load the current `app.py` + `apsim` in stlite, run
it in headless Chromium, and measure load time and per-run time. If it works, use A.
Otherwise fall back to B. I'll report the numbers before committing to either.

### 1.2 Gemini runs in GitHub Actions; Phase A's local runner is retired (decision D2)
Phase A built `tools/gemini_run.py` (a local direct-API runner) plus `ai/GEMINI_RUNBOOK.md`.
Your workflow doesn't use that, so keeping both paths would be confusing. Proposal:
- **Remove** `tools/gemini_run.py`, `tests/test_gemini_runner.py` and `ai/GEMINI_RUNBOOK.md`
  (they stay in git history; logged in BUILD_LOG).
- **Keep and adapt** the prompt *content* (`01_gemini_plan_critique.md`,
  `02_gemini_implementation.md`). Gemini CLI writes files itself, so the
  "=== FILE: … ===" output format is dropped.
- **Keep** `ai/COMPARISON_INTERFACE.md` and `docs/PLAN_v1_claude.md`.

### 1.3 Workflow stages for this project
Copy `gemini-build.yml` + `run-gemini.sh` and adapt them:

| Stage | Mode | Writes | Purpose |
|---|---|---|---|
| `models` | none | `docs/gemini-build/models-*.txt` | List the models the key can use (free) |
| **`critique`** (new) | `--approval-mode plan` | `docs/gemini-build/critique.md` | Independent critique of `PLAN_v1_claude.md`, recorded with model, tokens and cost (better evidence than a pasted web-app chat). Uses prompt 01. |
| `plan` | `--approval-mode plan` | `docs/gemini-build/plan.md` | Gemini's own implementation plan + questions |
| `build` | `--yolo` | `gemini-impl/`, `docs/gemini-build/` | Implements its approved plan; your answers go in `message` |
| `followup` | `--yolo` | same | One extra instruction, e.g. pasting a failing test |

Changes from the previous script:
- **Budget guard fixed:** also pass a per-run cap. If the estimated cost of the run that just
  finished pushes the total past `BUDGET_USD`, the summary says so in bold, and the next run
  refuses to start. (A hard mid-run stop isn't possible from outside the CLI; the per-stage time
  limit is the real cap. I'll say that plainly in the workflow comments.)
- **Pricing constants** stay conservative and labelled as estimates; actual spend comes from the
  AI Studio billing page (you check it).
- After build/followup, the script runs `pytest` on `gemini-impl/` (instead of `npm test`) and
  records pass/fail counts.
- Allowed paths: `gemini-impl/` and `docs/gemini-build/` only (critique/plan: `docs/gemini-build/`
  only). Everything else is reverted and listed in the summary.

### 1.4 Independence of the Gemini build (decision D3)
Claude's implementation already exists. If Gemini's branch is made from Claude's branch (as last
time), Gemini can read `ap-sim/apsim/` and the comparison loses meaning. Proposal:
- Create a **spec-only base branch** `gemini/base` from `main` (the initial commit), containing only:
  `docs/PLAN_v1_claude.md`, `ai/COMPARISON_INTERFACE.md`, the Gemini prompt files,
  `docs/gemini-build/`, and a `gemini-impl/` placeholder. **No `ap-sim/apsim/`, no BUILD_LOG,
  no Claude tests.**
- `gemini/impl` is created from `gemini/base` by the workflow on its first run.
- Checkout with `persist-credentials: false` while Gemini runs. Only the script's commit step,
  run after Gemini exits, gets push rights.
- **Residual risk, stated honestly:** the repo is public, so a `--yolo` agent with a shell *could*
  fetch Claude's branch over the internet. The prompt forbids it, and the script will grep
  Gemini's JSON tool-call log for `ap-sim`, `apsim` and `claude/` and report any hits in the run
  summary.

### 1.5 GitHub Actions needs the workflow on `main` (decision D4)
`workflow_dispatch` workflows only appear in the Actions tab ("Run workflow") when the file is on
the **default branch**. So `main` needs `.github/workflows/gemini-build.yml`. Options:
- **(a) Recommended:** after CI is green on the Claude branch, fast-forward `main` to it
  ("ship it" is your call). The workflow then lives on `main`, and Gemini still works only on
  `gemini/impl`, which is built from the spec-only base.
- (b) Put only `.github/` on `main` and keep Claude's work on its branch until the end.

I'm only allowed to push to `claude/pancreas-control-simulator-w1e3tl` unless you explicitly
allow `main`, `gemini/base` and `gemini/impl`. **This plan asks for that permission.**

### 1.6 CI (`.github/workflows/ci.yml`), the referee
On every push:
1. `pytest` for `ap-sim/` (98 tests now; the app smoke tests included).
2. `pytest` for `gemini-impl/` if it exists.
3. **Shared acceptance suite** `acceptance/` (new). Tests built only on the
   `COMPARISON_INTERFACE.md` contract and the **plan's §16 reference values** (which predate
   both builds). Run against both implementations through each one's `compare_api`.
   - Hidden from Gemini: not on `gemini/base`.
   - **Not blind for Claude:** I write it after building mine. Disclosed in the comparison. Its
     reference numbers come from the plan, not from my implementation, which limits the
     home-field advantage.
4. **Comparison harness** `compare/run_compare.py`: identical scenarios (explicit-gain and
   design-gain) through both implementations → `compare/report.md` + JSON, uploaded as a CI
   artifact and committed when you ask.
5. Once `site/` exists: Playwright smoke test of the built site (light and dark).

### 1.7 Repo conventions to adopt (from the previous project)
- `CLAUDE.md` at the repo root: project rules, "start in plan mode", plans saved as
  `docs/plan-*-<model>.md`, append to the process log every session.
- `context/assignment.md`: **verbatim assignment text**. The previous repo's copy is for CHE 4061
  with the same professor. I need you to confirm that the PD&C assignment is identical, or paste
  it (decision D5).
- `docs/process-log.md`: session-by-session record (prompts verbatim, decisions, problems).
  I'll start it with an honest reconstruction of this session, from this conversation only.
- `docs/critique-decisions.md`: the accept/reject table (the format that worked last time),
  drafted by me with fact-checks; **every Decision is yours**.
- Netlify: `netlify.toml` publishing `site/`; I build and verify a zip, you drag it onto Netlify,
  then I run the browser tests against the live URL.

## 2. Sequence (each step ends at an approval gate)

| Step | Who | What | Gate |
|---|---|---|---|
| 1 | Claude | Repo conventions (CLAUDE.md, process-log, assignment stub), retire the local runner, adapt prompts, write `gemini-build.yml` + `run-gemini.sh` + `ci.yml`, acceptance suite + Claude `compare_api` adapter | You review; CI green on the Claude branch |
| 2 | Claude (with your permission) | Create `gemini/base` (spec only); fast-forward `main` if you say so | Your "ship it" |
| 3 | **You** | Add the `GEMINI_API_KEY` repo secret; run `stage=models`; choose the model and `BUDGET_USD` | |
| 4 | You (or Claude triggers) | `stage=critique` | |
| 5 | Claude → You | Fact-check the critique, draft `critique-decisions.md`; **you decide every row** | Your approval |
| 6 | Claude | Apply your accepted items to the Claude build (plan v2), with tests | CI green |
| 7 | You/Claude | Gemini `plan` → you answer its questions → `build` → `followup` until done or you stop | Each run |
| 8 | Claude | Comparison harness on both, `comparison.md`, investigate every difference | You write "My conclusions" |
| 9 | Claude | Hosting spike (1.1) → `site/` (simulator + docs pages + comparison + video/transcript placeholders) | You approve the design |
| 10 | You | Netlify drag-and-drop; Claude runs the live-site tests | |
| 11 | Claude → You | Presentation outline, script, AI history, references, contributions, final checklist | You record the video |
| 12 | You | YouTube upload, comments (practice transcript + AI critique), real transcript onto the site | Final check |

## 3. Decisions I need from you

- **D1 Hosting:** approve the stlite spike, with fallback B? (Recommended.)
- **D2 Local runner:** remove `tools/gemini_run.py` and the runbook in favour of the Actions
  workflow? (Recommended.)
- **D3 Independence:** build Gemini from a spec-only base branch? (Recommended.)
- **D4 Branch permissions:** may I create/push `gemini/base`, and fast-forward `main` once CI is
  green and you say "ship it"?
- **D5 Assignment text:** is the PD&C AI-project assignment identical to the one in
  `seperations/context/assignment.md` (6 components; rubric 25/25/25/25; individual = 50 pts
  with recorded in-class presentation and Q&A)? Individual or group?
- **D6 Budget:** a starting `BUDGET_USD`. Note the last build's *conservative estimate* was
  $34 for a single run, so a $6 budget would block the build stage after one plan run.
  Suggest **$40** of conservative estimate (the real bill is likely much lower), then check AI
  Studio billing after the critique run.
- **D7 Critique route:** run the critique through the workflow (recommended; recorded tokens and
  cost) or paste it from the Gemini web app as last time?
