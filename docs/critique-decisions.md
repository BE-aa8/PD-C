# Critique decisions: Gemini's review of plan v1

**Status: APPROVED by Andrew on 2026-11-18** ("approve all, go with your recommendations"). Claude drafted the table and the fact-checks; Andrew approved every row. Where a row offered a choice (rows 7 and 19), the recommended option was taken. Merged into `plan-v2-final.md`.

Source: `docs/critique-v1-gemini.md` (verbatim). Gemini's severity in brackets. "F" = Gemini's finding number, "Q" = its answer to plan §19.

## Fact-checks Claude ran before drafting

All checks were run against the Python reference (`ap-sim/`). Commands and output are in the 2026-11-18 process-log entry.

1. **Gemini's setpoint-weighting (β) bug is real (F9.3).** Plan §7.1 writes P_k = Kc(β·r_k − m_k) in absolute units, and `ap-sim` implements it that way. With **no meal**, glucose at basal and β = 0.5, the first controller output is **33.9 mU/min instead of 16.67** (basal), and glucose falls from 81 to **57.3 mg/dL** from a resting steady state. At β = 0, it is 51.1 mU/min and 42.2 mg/dL. The app exposes a β slider, so this bug was live. Claude's plan *and* Claude's implementation both missed it; no test used β ≠ 1.
2. **Gemini's back-calculation safeguard is needed (F2).** `ap-sim` uses Tt = √(τI·τD) (τI for PI). With the pump held saturated:

   | τD (min) | Tt (min) | Ts/Tt | integral state after 60 samples |
   |---|---|---|---|
   | 17.6 (default design) | 35.2 | 0.14 | converging |
   | 0.5 | 5.9 | 0.84 | converged |
   | 0.1 | 2.65 | 1.89 | still oscillating |
   | 0.05 | 1.87 | 2.67 | **diverging oscillation** (|ΔS| ≈ 1600 per sample) |
   | 0.02 | 1.19 | 4.22 | **diverging oscillation** (|ΔS| ≈ 3500 per sample) |

   The discrete correction removes a fraction Ts/Tt of the excess per sample, so it overshoots and oscillates for Ts/Tt > 1 and grows once Ts/Tt > 2. That is only reachable with manual tuning and a tiny τD, but it is real. Gemini's own fix, Tt = max(√(τI·τD), Ts), keeps Ts/Tt ≤ 1.
3. **The back-calculation formula itself is correct**, as Gemini's own derivation in F2/Q1 shows. Its executive-summary wording ("a subtle algebraic error … sign and scaling risk") overstates this: the risk is ambiguity in the *order* of operations, not an error. Gemini's recommended 4-line sequence is exactly what `ap-sim` already does.
4. **Gemini's D(t) numbers are wrong, but the conclusion holds and gets stronger (F10).** Gemini says holding D at the start of each step gives about 0.018 mg/dL of error. Measured against the exact analytic open-loop solution:

   | D(t) treatment | max error vs analytic |
   |---|---|
   | evaluated at RK4 substep times (`ap-sim` default) | 1.0 × 10⁻¹⁰ mg/dL |
   | held at the mid-step value | 1.3 × 10⁻⁵ mg/dL |
   | held at the step-start value | **0.213 mg/dL** (about 12× Gemini's estimate; fails §16's 0.01) |
5. **Two small arithmetic slips.** Kp: Gemini gets −4.505925, because its denominator is 9.051083 × 10⁻⁴ instead of 9.050333 × 10⁻⁴; the correct value is −4.506298 (a 0.008% error). Bolus: Gemini quotes both 1390.09 and 1390.13 mU; the correct value is **1390.09**. Neither changes any conclusion, but, as last time, the critic needs checking too.
6. **Everything Gemini asked us to check in `ap-sim` ("Things I could not verify" #2):**
   - Ts/2 is excluded from the IMC dead time by default (your 2026-11-18 decision).
   - D(t) is evaluated at RK4 substep times.
   - Presets use t_meal = 60 min; the open-loop §16 test uses t_meal = 0.
   - The bolus uses the *clipped* feedback output: capacity = max(0, U_max − clip(U_fb)).
   - Anti-windup judges the PID output alone, not PID + bolus.
   - The sensor lag is a 4th RK4 state before the delay buffer.
   - The sensor history is pushed before it is read.
   - The stability numbers match: PM 74.0° without the sensor delay in the loop, 58.6° with it; total tolerable delay 48.1 min (38.1 min extra).
   - The empirical (sampled) delay limit is 43.2 min, about 5 min lower than the continuous estimate, consistent with Gemini's sampled-data note (F7, F8).

## Decision table

| # | Gemini suggestion | Sev. | Decision | Reasoning | Approved |
|---|---|---|---|---|---|
| 1 | F1: §5.3 includes Ts/2 in θ_total but the §6/§13 reference values don't; resolve it | Critical | **Accept (already resolved)** | You already chose Option A on 2026-11-18: Ts/2 is excluded by default (flag `include_zoh`, default false), matching −0.574 / −0.426. Plan v2 states this explicitly. Gemini's second point (default τc = θ_total vs the reference τc = 20) isn't a contradiction: the reference values take τc = 20 as an explicit input. Plan v2: presets and tests use τc = 20; "τc = θ_total" stays as a selectable guideline. || ✅ |
| 2 | F2: write the exact back-calculation sequence (S_trial → u_unsat → clip → correction) | Critical | **Accept** | Removes the ambiguity that could make the two JS builds differ. `ap-sim` already uses exactly this order (fact-check 3). || ✅ |
| 3 | F2: guard Tt: Tt = max(√(τI·τD), Ts) when τD > 0; Tt = τI for PI | Critical | **Accept** | Fact-check 2: without it, back-calculation oscillates and diverges for small manual τD. Fix `ap-sim` and add a test. || ✅ |
| 4 | Exec summary: back-calculation has "a subtle algebraic error" | Critical | **Reject the claim** (keep 2–3) | Gemini's own derivation shows the signs and scaling are correct (fact-check 3). Recorded in the comparison as an example of the critic overstating severity. || ✅ |
| 5 | F3: pin FF/FB coupling: U_avail = max(0, U_max − clip(U_fb)), U_ff = min(U_avail, B_rem/dt), anti-windup judged on feedback alone, freeze only with the suspend option | Critical | **Accept** | This is what `ap-sim` does (fact-check 6). It must be written into plan v2 so both JS builds match. || ✅ |
| 6 | F4: plan v2 must target the static JS site with a strict `model.js` API contract (names, defaults, return schema) | Critical | **Accept** | It is the core of the separations pathway (shared `npm test` for both builds). || ✅ |
| 7 | F4: no SciPy in JS: how do the builds get the least-squares fits? | Critical | **Accept, modified** (recommended option taken) | JS computes the half rule and the analytic linear step response itself; the least-squares FOPDT/SOPDT parameters are computed by the Python reference and shipped in `site/js/data.js`, labelled "fitted offline by the Python reference (scipy least_squares)". This is the same role `data.js` played in separations. **Alternative:** require a small Nelder–Mead fit in JS (more to build, more ways to diverge). || ✅ |
| 8 | F4: the PRNG can't match NumPy; restrict `expected.json` to σ = 0, specify Mulberry32 + Box–Muller in JS | Critical | **Accept** | Cross-language bit-matching isn't feasible. Noisy runs are tested only for reproducibility (same seed → same output) within each build. || ✅ |
| 9 | F5, F6, F7, Q3, Q4: confirmations of U_basal, units, Kp, τs, nonlinear gain, open-loop peak, half rule, Kf/bolus, IMC formulas | Important | **Accept (no change)** | Independently confirmed by a second model. Note the two small slips (fact-check 5). IMC row numbers ("Row 1/2") in Seborg Table 12.1 are still **unverified**: check them in the book. || ✅ |
| 10 | F6: specify the fit grid, whether K is free, and τ1 ≥ τ2 | Important | **Accept** | Document what `ap-sim` does: grid 0–600 min at dt = 0.1, K free, τ2 = r·τ1 with 0 < r ≤ 1, three starting points. || ✅ |
| 11 | F7: §13 must distinguish PM with the sensor delay in the loop (58.6°, 38.1 min extra) from the delay-free PM (74.0°, 48.1 min total) | Important | **Accept** | It matches `ap-sim` exactly. Plan v1 mixed the two. Plan v2 and the site show both, plus the sampled-data loss (empirical 43.2 min). || ✅ |
| 12 | F8: keep the backward-Euler derivative filter; explain the extra lag from Ts = 5 min on the Stability tab | Important | **Accept** | It is correct, and it is a good explanation for the 5 min gap between continuous and empirical delay limits. || ✅ |
| 13 | F9.3: setpoint weighting is wrong in absolute units: use P = Kc[β(r − G_b) − (m − G_b)] | Important | **Accept** | **A real bug in plan v1 and in `ap-sim`** (fact-check 1). Fix the reference, add a β ≠ 1 steady-state test, and pin the formula in plan v2. The best catch in the critique. || ✅ |
| 14 | F9.4: pin t_meal (presets at t ≥ t_pre), keep t_meal = 0 for the open-loop unit test | Important | **Accept** | `ap-sim` presets use 60 min; plan v2 states it. || ✅ |
| 15 | F9.1, F9.2, F9.5, Q6: add golden closed-loop trajectories (feedback-only, clamp vs back-calc, pre-bolus) to the tests | Important | **Accept** | This is exactly what `tests/expected.json` will hold, and it catches ZOH-timing and event-order bugs that §16 misses. Tolerance: ±0.05 mg/dL on G and ±0.05 mU/min on U at fixed times, plus the scalar results (gains, fits, tuning, margins) at ±0.5%. || ✅ |
| 16 | F10: mandate D(t) at RK4 substep times (no "pick one") | Important | **Accept** | Fact-check 4: the left-hold error is 0.213 mg/dL, not 0.018. That makes the case stronger. || ✅ |
| 17 | F10: the sensor lag is a 4th RK4 state, before the delay buffer | Important | **Accept** | It is what `ap-sim` does. Pinned in plan v2. || ✅ |
| 18 | Q2: restrict τs to 0 or ≥ 0.5 min (RK4 stability) | Important | **Accept** | Correct (RK4 needs dt/τs below about 2.8). The current app slider already steps 0 → 0.5; plan v2 states the limit. || ✅ |
| 19 | F11.1: drop QP-MPC from the JS builds | Nice | **Accept, modified** (recommended option taken) | Not required in either JS build (too far beyond undergrad level, and the builds would diverge). Show the existing **Python** MPC results as a labelled, precomputed comparison figure with a short "PID vs MPC" explanation. **Alternative:** omit MPC from the site entirely. || ✅ |
| 20 | F11.2: drop Phase 8 (Ex. 23.7); add a short glucagon / split-range text box instead | Nice | **Accept** | Keeps the focus on Ex. 23.3 / 23.6. The text box uses no numbers that aren't sourced. || ✅ |
| 21 | F11.3: add a closed-loop block diagram (R, Gc, saturation, Gff, Gp, Gd, sensor delay) with live numbers | Nice | **Accept** | It is the standard Seborg picture, and it ties the tabs together. Good for the presentation. || ✅ |
| 22 | F11.3: add a P / PI / PID toggle with an offset demonstration | Nice | **Accept** | Cheap, and it is core course content (P-only offset, I removes it, D fights the lags). || ✅ |
| 23 | F11.3: equation + units + one-line interpretation on every card | Nice | **Accept** | Already a `CLAUDE.md` rule; plan v2 makes it a build requirement. || ✅ |
| 24 | Q5: "why real systems are harder" callouts: meal appears instantly, insulin absorption lag is lumped, no counter-regulation | Nice | **Accept, modified** | Keep the three qualitative points. **Reject Gemini's numbers** (an extra 20–50 min subcutaneous lag; a D = A·t·e^(−kt) meal peaking at 20–40 min) as unsourced, under the no-invented-data rule, unless a source is found. || ✅ |
| 25 | Q4: τc guidelines "τc > 0.8θ (Rivera et al., 1986)", "τc = θ (Skogestad 2003)" | Nice | **Accept as [TO VERIFY]** | Plausible, but neither citation has been checked against Seborg Ch. 12. Check them in the book before they appear on the site. || ✅ |
| 26 | Q7: compare on two axes: a locked numerical contract (must agree), and UI/pedagogy freedom (expected to differ) | Nice | **Accept** | Same idea as separations. Add to the comparison: iterations to pass, bugs hit, and the critic's own slips (fact-checks 3–5) and real catches (fact-checks 1–2). || ✅ |

## What changes after approval

- **Reference fixes in `ap-sim`** (rows 3 and 13), each with a new test.
- **Plan v2** (`docs/plan-v2-final.md`): plan v1 with every approved row merged in, the static-site architecture, and the `model.js` API contract.
- **Then step 5 of the workflow plan:** `tools/build_expected.py` → `tests/expected.json`, `tests/model.test.mjs`, `tests/browser-smoke.mjs`, `docs/build-prompt.md`.

**Later resolution (2026-11-27):** row 25 (τc guidelines, accepted "as [TO VERIFY]") was settled by Andrew: the site keeps only the SIMC guideline τc = θ, cited to Skogestad (2003), *J. Process Control* 13:291–309 (citation confirmed online), and drops the "τc > 0.8θ (Rivera et al., 1986)" part, which could not be confirmed. See process log Part 24. The table above is left as originally approved.

**Later resolution (2026-11-27), row 9:** the IMC row numbers in Seborg Table 12.1, noted as unverified in row 9, were checked by Andrew in the book ("Book confirms both", process log Part 24).
