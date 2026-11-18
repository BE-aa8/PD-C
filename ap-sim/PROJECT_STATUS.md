# PROJECT STATUS — Closing the Loop

**Audit date:** 2026-11-18 · **Audited commit:** `8087a7d` on `claude/pancreas-control-simulator-w1e3tl`
**Method:** the repository and history were inspected directly. Statuses below come from what
was observed, not from earlier progress reports.

Status key: ✅ Complete (verified) · 🟡 Partial · ⬜ Not started · 🔴 Broken / wrong · 🔍 Needs validation · 👤 Needs Andrew

---

## 1. What the repository actually contains

| Fact | Observation |
|---|---|
| Branches | `main` (only the initial README commit) and `claude/pancreas-control-simulator-w1e3tl` (all work). Nothing else, locally or on the remote. |
| Gemini work | **None.** No Gemini branch, directory, commit, PR or issue in `BE-aa8/PD-C`. The other repos the account can see (`seperations`, `agen_rh`, `startup`) are, by name, unrelated; they were not opened. |
| PRs / issues | None. |
| Commits | 11, all made by Claude Code (Claude Opus 5.5) in a single session on 2026-11-18. |
| Deployment | **No deployment found.** No Streamlit Cloud URL is recorded anywhere, and the work has not been merged into `main`. |
| Tests | `pytest`: **67 passed** (re-run during this audit). |
| Code size | ~2,000 lines across `apsim/` and `app.py`; 9 test files. |
| Conversation history | Only this conversation is available to the agent. Any Gemini chats or other planning conversations Andrew had elsewhere are not visible here. |

**Process deviation that must be disclosed:** the plan said it would go to a second model for
critique *before* anything was built. That did not happen. The same model that wrote the plan
(Claude Opus 5.5) built the whole implementation immediately afterwards. So, as of this audit,
**the multi-AI requirement is unmet**: there is one planner/implementer and no critic.

---

## 2. Simulator: technical status

| # | Item | Status | Evidence / notes |
|---|---|---|---|
| T1 | Parameters with units and sources (`params.py`) | ✅ | Single source of truth; U_basal derived. |
| T2 | Nonlinear ODE model | ✅ | Matches analytic open-loop solution to < 0.01 mg/dL; LSODA to < 0.05. |
| T3 | Fixed-step RK4 engine, documented event order, integer sample timing | ✅ | dt-convergence test; deterministic. |
| T4 | Linearization, A/B/C, Gp(s), Gd(s) | ✅ | A matches a finite-difference Jacobian; Kp = −4.506. |
| T5 | Nonlinear-gain demonstration | ✅ | −4.27 at ΔU = +1. |
| T6 | Half rule + LSQ FOPDT/SOPDT fits | ✅ | All within plan tolerances. |
| T7 | IMC tuning formulas | 🔍 👤 | Implemented and internally tested, but **never checked against Seborg Table 12.1** (no PDF available). The τc default guideline is also uncited. |
| T8 | Discrete PID (derivative on measurement, filter, bumpless) | ✅ | Unit tests incl. no derivative kick. |
| T9 | Anti-windup (clamp with Kc·e sign logic, back-calculation, off) | ✅ | Tests for both saturation directions. |
| T10 | Sensor: delay, lag, noise, stuck, drift, dropout | ✅ | Delay-shift test; dropout holds output. |
| T11 | Meals, multi-meal, insulin-sensitivity mismatch | ✅ | |
| T12 | Static FF bolus, pre-bolus, estimate error, integral suspend | ✅ | Bolus total to < 1 mU; §14 targets reproduced. |
| T13 | Lead-lag dynamic FF (stretch) | 🟡 | Implemented, **no dedicated test**, τ_lg is an agent-chosen value. |
| T14 | Metrics (TIR, IAE/ISE, insulin, settling) | ✅ | Small bug noted in §4 (B3). |
| T15 | Stability margins, Bode/Nyquist, max delay | ✅ | Reproduces plan references (PM 68°/74°, 33.4/48.1 min). |
| T16 | Empirical delay sweep | ✅ 🔍 | Works. Gives 43.2 vs 48.1 min analytic; the 5–6 min gap is explained only qualitatively. |
| T17 | Ts/2 discrepancy | 🟡 | Default now **excludes** Ts/2 to match the references (Andrew's decision). Consequence: the tuning ignores ~2.5 min of real sampling delay, and the stability tab's continuous margins are optimistic. This is documented, but not yet shown side by side in the app. |
| T18 | Presets (16) | ✅ | All run; all U within [0, 115]. |
| T19 | MPC (stretch) | ✅ 🔍 | Works; 5 tests. Weights were tuned by the agent on one preset; cross-checked on others. |
| T20 | IOB limit (plan §7.3, stretch) | ⬜ | Not built. |
| T21 | Ex. 23.7 linear TF patient (plan Phase 8, stretch) | ⬜ 👤 | Not built; needs the TFs verified from the textbook. |
| T22 | Model-validity warning at extreme states | ⬜ | e.g. a +30 mg/dL/h drift fault drives true glucose to 12.5 mg/dL with no warning. The guard only fires at G ≤ 0. |

## 3. App / website status

| # | Item | Status | Notes |
|---|---|---|---|
| W1 | Streamlit app runs locally; all presets render | ✅ | Verified with `streamlit.testing.AppTest` + screenshot. |
| W2 | Public deployment | ⬜ 👤 | Needs Andrew's Streamlit Cloud account. Repo is public, which is good. |
| W3 | Tabs: Simulation, Model, Reduction, Tuning & Stability, Compare, About | 🟡 | Functional but plain. Information hierarchy is weak (one long sidebar, ~45 controls, no grouping into "basic/advanced"). |
| W4 | Project overview page | ⬜ | Only a title + caption. |
| W5 | Technical documentation pages | 🟡 | Equations and tables exist across tabs; no narrative on assumptions/limitations. |
| W6 | AI development process page | ⬜ | Placeholder text only. |
| W7 | Model comparison page | ⬜ | Requires the Gemini implementation. |
| W8 | YouTube link section | 🟡 | Placeholder "_TBD_". |
| W9 | Verbatim transcript section | 🟡 | Placeholder. Must be filled with the *real* YouTube auto-transcript only. |
| W10 | References & attribution page | 🟡 | List exists; several items marked [TO VERIFY]; no contributions section. |
| W11 | Disclaimer on every page | ✅ | Shown at the top of the app. |

## 4. Problems found during this audit

| # | Problem | Severity | Status |
|---|---|---|---|
| B1 | Tuning & Stability tab shows margins for the *PID design* even when MPC or open loop is the selected controller. This is misleading in a demo. | Medium | 🔴 |
| B2 | If `margins()` throws, the "Run empirical delay sweep" button then references an undefined `m0` → crash. | Low | 🔴 |
| B3 | `metrics.py` hard-codes `115.0` for "time at U_max" instead of `params.U_max`. | Low | 🔴 |
| B4 | No warning when glucose leaves a physiologically meaningful range (T22). | Medium (demo credibility) | 🔴 |
| B5 | Stability tab uses the *actual* sensor-delay slider, while tuning can use a different "design delay". This is correct, but the two aren't labelled clearly. | Low | 🔍 |
| B6 | The windup demo contrast is weak (nadir 39.1 vs 45.0). It works, but is underwhelming for a presentation. | Low | 🔍 👤 |
| B7 | Ex. 23.6(d) (no delay, τc = 20) leaves the band (peak 150.8). This may be correct physics, but it should be checked against the solutions manual / Andrew's hand work. | Medium | 🔍 👤 |
| B8 | Lead-lag FF has no test. | Low | 🔍 |
| B9 | Plan §19 asked for a critique *before* the build; the build happened first. This is a process issue, not a code bug, and must be stated honestly in AI_MODEL_CRITIQUE.md / AI_DEVELOPMENT_HISTORY.md. | High (grading) | 🔴 |

## 5. Assignment deliverables

Requirements as stated by Andrew in the completion directive. **The professor's verbatim
assignment text has not been provided to the agent** (👤 needed for the final checklist).

| # | Deliverable | Status | Blocker |
|---|---|---|---|
| A1 | Plan from model 1 (Claude Opus 5.5) | ✅ | The plan text is in the conversation but **not saved in the repo**. |
| A2 | Critique by a different model (Gemini) | ⬜ | Needs Gemini access (👤). |
| A3 | Accept/reject decisions with reasoning (`AI_MODEL_CRITIQUE.md`) | ⬜ | Depends on A2; decisions must be Andrew's. |
| A4 | Implementation by model 1 (Claude) | ✅ | This branch. |
| A5 | Independent implementation by model 2 (Gemini) | ⬜ | Needs Gemini access (👤). |
| A6 | Reproducible comparison (doc + website section) | ⬜ | Depends on A5. |
| A7 | Public website (simulator + documentation) | ⬜ | Deployment 👤 + content. |
| A8 | YouTube presentation | ⬜ | Andrew records. |
| A9 | YouTube link on website | ⬜ | After A8. |
| A10 | Practice transcript + AI critique in YouTube comments | ⬜ | After A8; Andrew posts. |
| A11 | Verbatim auto-generated transcript on website | ⬜ | After A8. |
| A12 | PRESENTATION_OUTLINE / SCRIPT, AI_DEVELOPMENT_HISTORY, REFERENCES, CONTRIBUTIONS | ⬜ | Agent can draft; Andrew owns content. |
| A13 | FINAL_SUBMISSION_CHECKLIST.md | ⬜ | Needs the verbatim assignment text for accuracy. |
| A14 | Group member contributions | ⬜ 👤 | Is this an individual or group project? |
| A15 | In-class / final-exam presentation prep | ⬜ | |

## 6. Required vs optional

**Required for the assignment:** A1–A15, a working public simulator (T1–T19 core plus W1–W11),
and an honest record of the process.

**Optional / stretch:** MPC (done), lead-lag FF (done, untested), IOB limit, Ex. 23.7 TF patient,
ZN/Cohen–Coon comparison (done), UI polish beyond clarity.
