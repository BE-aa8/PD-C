# Plan: follow the separations-repo pathway exactly

**Author:** Claude Code (Opus 5.5) · **Date:** 2026-11-18 · **Status: APPROVED by Andrew on 2026-11-18** ("approved, same assignment, individual, you can push to main")
**Andrew's instruction (verbatim):** "follow exactly what we did in the separations repo. that
pathway worked great for me all week, I don't want to switch it up."

This replaces draft v1 of this file (see git history). Every variation I proposed in v1 is
dropped: no `critique` workflow stage, no spec-only branch, no budget changes, no stlite. Where
separations did something, we do the same thing. The only differences are the names (folders,
branch, prompts), which the separations setup guide says to update.

Reference: `BE-aa8/seperations` @ `1e6074c`.

## 1. The pathway, mapped one-to-one

| Separations | This project |
|---|---|
| Static site `site/` (HTML/CSS/JS, Plotly 2.35.2, KaTeX 0.16.11, CDN-pinned, no build step) on **Netlify** by drag-and-drop | Same. The simulator becomes `site/js/model.js` (plain JS, pure functions, imports in Node 18+) plus a UI in `site/`. |
| `tests/reference/handcalc_reference.py`: independent Python reference → `tests/handcalc-expected.json` | **`ap-sim/apsim`** (existing, 98 tests) is the independent Python reference. `tools/build_expected.py` runs it → `tests/expected.json`. Nothing already validated is thrown away. |
| `npm test` = `node --test tests/*.test.mjs` grades **both** `site/` and `site/gemini/` against the expected JSON | Same: `tests/model.test.mjs` grades `site/js/model.js` and `site/gemini/js/model.js` against `tests/expected.json`. |
| `tests/browser-smoke.mjs` (Playwright), light and dark, both builds | Same. |
| `ci.yml`: reproducibility checks + `npm test` + browser smoke | Same, plus `pytest ap-sim` (the reference's own tests). |
| `CLAUDE.md`, `context/assignment.md` (verbatim), `docs/process-log.md` | Same files at the repo root. |
| `docs/plan-v1-claude.md` | `ap-sim/docs/PLAN_v1_claude.md`, moved to `docs/plan-v1-claude.md` |
| Critique: pasted from the **Gemini web app** → `docs/critique-v1-gemini.md` (verbatim) | Same. I prepare one all-in-one paste file; you paste it into Gemini and commit the reply verbatim. |
| `docs/critique-decisions.md`: Claude fact-checks and drafts, Andrew approves every row | Same. |
| `docs/plan-v2-final.md` | Same: plan v1 + your accepted items + the static-site architecture. |
| `docs/build-prompt.md`: identical prompt for both models; only `<OUTPUT_DIR>` differs | Same. |
| Claude builds `site/` in plan mode in a fresh session | Same. |
| `gemini-build.yml` + `run-gemini.sh`: stages `models` / `plan` / `build` / `followup`, Gemini CLI 0.68.0, branch `gemini/pro` created from the Claude branch, allowed paths `site/gemini/` + `docs/gemini-build/`, `BUDGET_USD: "6"`, 45-min timeout, `npm test` after each run, `costs.tsv` | **Copied as-is.** Changed: the base branch name in the "create gemini/pro" step, and the Phase/project wording in comments. `prompt.txt` = the build prompt with `site/gemini/`. |
| `docs/comparison.md`; "My conclusions" written by Andrew | Same. |
| Zip `site/` → you drag it onto Netlify → Claude runs the browser tests on the live URL | Same. |

### Consequences you should know (no change to the pathway, just facts)
- The **Phase A local runner** (`ap-sim/tools/gemini_run.py`, its test and `ai/GEMINI_RUNBOOK.md`)
  wasn't part of separations, so I'll remove it (it stays in git history). The Phase A prompts and
  `ai/COMPARISON_INTERFACE.md` are superseded by the critique paste file, `build-prompt.md` and
  the `model.js` API contract in plan v2.
- The simulator gets **re-implemented in JavaScript** by both models, as separations did.
  The Python code becomes the reference that grades them, which is exactly the role
  `handcalc_reference.py` played.
- MPC and the empirical delay sweep exist in Python. Whether they go into the JS site is a
  plan-v2 scope question, for after the critique.
- As in separations, `gemini/pro` is branched from the Claude branch, and the build prompt tells
  Gemini which files to read.
- `BUDGET_USD: "6"` is kept as in separations. In separations the build run itself was estimated
  at $34 and still ran, because the guard checks before each run. Same behaviour here.

## 2. Sequence (separations order)

1. **Setup (Claude):** `CLAUDE.md`, `context/assignment.md`, `docs/process-log.md` (this
   session reconstructed honestly from this conversation), move plan v1 to `docs/`, remove the
   local runner, `package.json`, `.github/workflows/ci.yml` (pytest for now; npm/browser jobs skip
   until `site/` exists, as in separations), `.github/workflows/gemini-build.yml` +
   `.github/scripts/run-gemini.sh` copied from separations.
2. **Critique paste file (Claude):** `docs/gemini-critique-all-in-one.txt` = critique prompt +
   `docs/plan-v1-claude.md` + `CLAUDE.md` + the assignment.
3. **You:** paste it into the Gemini web app, then commit the reply verbatim as `docs/critique-v1-gemini.md`.
4. **Claude:** fact-check the critique and draft `docs/critique-decisions.md` → **you approve each row**.
5. **Claude:** `docs/plan-v2-final.md`, `tools/build_expected.py` → `tests/expected.json`,
   `tests/model.test.mjs`, `tests/browser-smoke.mjs` (written **before** either site build,
   as in separations), `docs/build-prompt.md`, `docs/gemini-build/prompt.txt`.
6. **Claude:** fresh session, plan mode, builds `site/` from `build-prompt.md`.
7. **You:** add the `GEMINI_API_KEY` repo secret if it isn't there; run `models` → `plan` → answer → `build` → `followup`.
8. **Claude:** `docs/comparison.md`; you write "My conclusions".
9. **Claude → You:** zip `site/` → Netlify → live-site tests.
10. **Claude → You:** presentation materials, video/transcript pages, final checklist.

## 3. What I need from you before step 1

- **Approve this plan.**
- **`main`:** in separations the workflow file was on `main` (the Actions "Run workflow" button
  needs it there). May I push to `main` when you say "ship it", as before?
- **Assignment:** is the PD&C AI-project text identical to `seperations/context/assignment.md`?
  If so, I'll copy it. If not, please paste it. Individual or group?
