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

**What I accepted / changed / rejected, and why:** *(pending: Andrew's decisions go in `docs/critique-decisions.md`)*

**Next step:** Andrew approves or changes each row; then Claude fixes the two reference bugs (rows 3 and 13) and writes plan v2.
