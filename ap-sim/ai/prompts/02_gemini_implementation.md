<!--
Prompt 02: independent implementation of the same plan by Gemini.
Written by Claude Code (Opus 5.5) for Andrew, 2026-11-18. Andrew reviews and edits before sending.
Send AFTER the critique (prompt 01) and AFTER Andrew has decided which critique items apply.
Send with: python tools/gemini_run.py new --session implementation --model <MODEL_ID>
             --prompt ai/prompts/02_gemini_implementation.md
             --attach docs/PLAN_v1_claude.md --attach ai/COMPARISON_INTERFACE.md
Gemini must NOT be given the Claude implementation (apsim/) or its BUILD_LOG / test results:
the comparison is only meaningful if the two builds are independent.

[ANDREW: before sending, fill in or delete the block below.]
-->

You are the implementing engineer for a university process-control term project (CHEE 4071
Process Dynamics and Controls, University of Cincinnati, Fall 2026; student Andrew Aldrich).

Two documents are attached:
1. `PLAN_v1_claude.md`: the build plan (written by a different AI model). This is your
   technical specification.
2. `COMPARISON_INTERFACE.md`: a small input/output contract. Your implementation must expose
   this contract so it can be compared, on identical scenarios, with another independent
   implementation of the same plan.

**Student decisions that override the plan** (from the critique review):
[ANDREW: list accepted changes here, e.g. "Ts/2 is NOT included in theta_total by default
(include_zoh=False)", or write "None: implement the plan as written."]

## What to build

Implement the plan's core in Python 3.11+ as a package called **`gemsim`**, inside a top-level
folder **`gemini-impl/`**:

```
gemini-impl/
├── gemsim/            # your package; pure Python (numpy, scipy only), no Streamlit
│   ├── ...            # organize modules however you judge best
│   └── compare_api.py # the contract from COMPARISON_INTERFACE.md
├── tests/             # pytest tests (plan §16, plus any you think are missing)
├── GEMINI_BUILD_LOG.md  # every decision, deviation from the plan, and why
└── README.md
```

Scope, in priority order:
1. **Required:** plan §2–§9, §11–§13 and §16. That is: parameters, nonlinear model, RK4 engine
   with the §11 event order, linearization, half rule + least-squares fits, IMC tuning,
   discrete PID with both anti-windup methods, sensor delay/lag/noise/faults, meals, static
   feedforward bolus with pre-bolus, metrics, stability margins and maximum tolerable delay,
   and the §16 validation tests.
2. **Required:** `compare_api.py`, exactly as specified in COMPARISON_INTERFACE.md.
3. **Optional:** presets (§14). **Out of scope:** the Streamlit app (§15), MPC (Phase 7), the
   lead-lag feedforward (§10.3), and Phase 8.

## Rules

- **Work independently.** Make your own engineering judgements. Where the plan is ambiguous,
  inconsistent, or (in your judgement) wrong, choose an approach, implement it, and record the
  choice and reasoning in `GEMINI_BUILD_LOG.md`. Do not silently deviate.
- **Do not invent parameter values.** Every number comes from the plan's §2 table or is an
  explicit, labelled input.
- **Do not change the plan's reference values to make tests pass.** If your implementation
  disagrees with a reference value, keep the test, report the discrepancy in the build log, and
  explain which you believe is correct and why.
- **Report test results honestly.** You cannot run code in this conversation. Never claim tests
  pass. The student will run them and send the output back to you.
- Keep it an **educational model of an illustrative textbook patient**: no real dosing
  guidance, no drug names, no carbohydrate conversions.

## Output format (important: a script parses your reply)

The full implementation is longer than one reply, so deliver it in **parts**. In each reply:
- Emit every file as a block exactly like this (the path is relative to the repository root):

  ```
  === FILE: gemini-impl/gemsim/model.py ===
  <complete file contents>
  === END FILE ===
  ```

- Always give **complete file contents**; never use "..." or "rest unchanged". If you revise a
  file in a later part, re-emit the whole file.
- Do not wrap the file blocks in Markdown code fences.
- End each reply with a line `=== PART k OF n ===` (your best estimate of n), followed by one
  sentence saying what the next part will contain. In the final part, write
  `=== IMPLEMENTATION COMPLETE ===` instead.

Start with Part 1: the package layout you have chosen and why (3–8 bullets, outside any file
block), then the parameter, model and simulation-engine files.
