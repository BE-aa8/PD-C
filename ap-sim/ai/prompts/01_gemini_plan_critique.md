<!--
Prompt 01: independent technical critique of the Claude plan by Gemini.
Written by Claude Code (Opus 5.5) for Andrew, 2026-11-18. Andrew reviews and edits before sending.
Send with: python tools/gemini_run.py new --session critique --model <MODEL_ID>
             --prompt ai/prompts/01_gemini_plan_critique.md --attach docs/PLAN_v1_claude.md
The runner appends the attached plan below this prompt under a "=== ATTACHED FILE ===" header.
-->

You are acting as an independent technical reviewer for a university process-control term project
(CHEE 4071 Process Dynamics and Controls, University of Cincinnati, Fall 2026). The student is
Andrew Aldrich.

The attached document is a build plan written by a different AI model (Claude Opus 5.5). It
specifies an educational simulator of an artificial-pancreas control loop, based on the
glucose–insulin model in Seborg, Edgar, Mellichamp & Doyle, *Process Dynamics and Control*,
4th ed., Example 23.3 and Exercise 23.6. The course requires that a second, different AI model
critique the plan. The student will decide which of your suggestions to accept or reject, and
will justify each decision in a graded document.

## Your task

Write a rigorous, independent technical critique of the plan. **Agreement is not the default.**
Check the plan's claims yourself. Where you agree, say so briefly and show the independent check
you did (a derivation, a recomputed number, or a reasoned argument), not just "looks good".
Where you disagree or see a gap, say exactly what is wrong and what you would do instead.

Equally important: **do not invent problems.** If something is correct, say it is correct. For
every finding, state your confidence (High / Medium / Low). Say explicitly when you cannot verify
something, for example a textbook table you do not have in front of you.

Recompute key numbers where you can (for example, the process gain Kp, the half-rule reductions,
the IMC tuning, the static feedforward gain, the open-loop peak). Show the arithmetic.

## Areas to cover

1. **Mathematical correctness:** model equations, linearization, transfer functions, units
   (including the p3 units note), reference values in §4–§6 and §13.
2. **Physical assumptions:** the patient model, sensor model, pump model, meal model; what is
   missing or unrealistic for a *teaching* simulator. (No real dosing advice; this must stay an
   illustrative textbook model.)
3. **Numerical methods:** fixed-step RK4 at dt = 0.1 min, delay handling, event ordering,
   treatment of D(t) within a step, sample-time logic.
4. **Controller implementation:** discrete PID form, derivative on measurement and its filter,
   both anti-windup methods (especially the sign logic for a negative-gain process, and the
   back-calculation formula), the bias term.
5. **Tuning:** the IMC formulas and the τc default (plan §6), and the effective dead-time
   definition θ_total = θ_model + θ_sensor + Ts/2 (plan §5.3). Note: the plan's own reference
   values in §6 and §13 may or may not be consistent with §5.3. Check this.
6. **Stability calculations:** loop transfer function, phase/gain margin, maximum tolerable
   delay Δθ_max = PM/ωc, and what a discrete-time (sampled) analysis would change.
7. **Feedforward:** the improper ideal Gf(s), the static-gain bolus sizing, pre-bolus timing,
   and whether this is the right feedforward concept to teach.
8. **Validation methodology:** are the tests in §16 sufficient to catch a wrong implementation?
   Which wrong implementations would still pass them? What tests are missing?
9. **Software architecture:** module split, purity, hashable configs, caching.
10. **Missing functionality** that a process-control instructor would expect.
11. **Comparing two AI implementations:** what would make that comparison meaningful and
    reproducible? (A second model will implement the same plan independently.)
12. **Answer each of the seven questions in plan §19 explicitly.**

## Required output format

Start with a 5–10 line executive summary.

Then give a numbered list of findings, with IDs `G-01`, `G-02`, …. Use exactly this structure
for each finding:

```
### G-xx: <short title>
- Plan section: <§ number(s)>
- Type: Error | Inconsistency | Gap | Risk | Alternative | Confirmation
- Severity: High | Medium | Low
- Confidence: High | Medium | Low
- What the plan says: <one or two sentences, quoted or paraphrased>
- Critique: <your analysis, with any derivation or recomputed numbers>
- Recommendation: <concrete change, or "none - plan is correct">
- How to verify: <a test or check that would confirm your recommendation>
```

Then a section "Answers to plan §19" with one short paragraph per question (Q1–Q7).

End with a section "Things I could not verify", listing anything that depends on sources you
do not have.
