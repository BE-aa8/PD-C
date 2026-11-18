# BUILD LOG — "Closing the Loop" artificial-pancreas simulator

Implementation of the Model-1 build plan (2026-11-18). One entry per decision or
deviation, and why. Numbers are from the code as committed; rerun `pytest` to reproduce.

## Phase 1: params, patient, open-loop simulate
- `params.py` holds every constant with `units` and `source`. `U_basal = n·I_basal·V1 = 16.668`
  is **derived** (a property), not hard-coded. `authority_ratio = 16.668/98.332 = 0.1695`.
- p3 units: the textbook value is kept and labeled `1/min^2 per (mU/L)`, with a note that the
  textbook prints 1/min (see Sec. 2 units check).
- RK4 hot loop uses scalar floats (`rhs_scalar`) rather than numpy arrays, for speed. A 600-min
  run at dt=0.1 takes about 0.07 s. `patient_rhs` (the numpy version) is the same math and is
  what the LSODA cross-check uses.
- Open loop: peak 166.15 mg/dL at t=26.0 min; above 144 from 10.7 to 52.4 min. Matches plan.
  The analytic solution matches to < 0.01 mg/dL. LSODA (rtol 1e-8) matches to < 0.05 mg/dL,
  both basal and with U = basal+20 (exercises the bilinear X·G term).
- **Deviation: D(t) handling (event-order step 5).** The plan asks for "hold D constant OR
  evaluate at substeps, test both give < 0.1 mg/dL". Holding D at the *start* of each step is
  only first-order accurate. It differs from substep evaluation by **0.21 mg/dL** at dt=0.1
  (the error halves at dt=0.05). That fails the 0.1 criterion. Resolution:
  - default `d_mode='substep'` (exact D at the RK4 stages);
  - added `d_mode='hold_mid'` (hold D(t+dt/2)), which is second-order and agrees to < 0.1 (test);
  - kept `d_mode='hold'` (left endpoint), with a test documenting its first-order error.
- Sensor lag: lag and delay are both LTI, so they commute. The first-order lag is integrated as
  a 4th RK4 state on the *true* glucose, and the delay buffer then acts on the lagged signal.
  This keeps the lag inside the RK4 loop, as the plan asks, without having to evaluate a
  delayed signal at RK4 substeps.

## Phase 2: linearize, reduce
- A matches a finite-difference Jacobian of `patient_rhs` to 1e-8.
- Kp = −4.5063, τ = 34.80 / 35.28 / 10.80 min, Kd = 34.80. Matches plan.
- Nonlinear gain at ΔU=+1: −4.269 (analytic steady state G = −X·Gb/(p1+X), confirmed by
  simulation). At ΔU=0.01 it is within 0.06% of Kp.
- Half rule: SOPDT (35.28, 40.20, θ=5.40), FOPDT (52.68, θ=28.20). Matches plan. Note: the half
  rule makes τ2 (40.20) *larger* than τ1 (35.28) here, because the two dominant lags are almost
  equal and τ2 absorbs half of the 10.8-min lag. This is correct per Skogestad. It is worth
  saying out loud in Q&A.
- LSQ fits to the nonlinear step (0–600 min, dt=0.1):
  - SOPDT: K=−4.2714, τ1=τ2=35.148 (critically damped, as the plan predicted), θ=8.665,
    RMSE 0.0098, max error 0.050
  - FOPDT: K=−4.2933, τ=56.63, θ=25.56, RMSE 0.065, max error 0.387
  - SOPDT parameterised as τ2 = r·τ1 with 0<r≤1, plus 3 starting points. The τ1=τ2 limit uses
    the analytic critically damped formula (relative tolerance 1e-6). A test checks continuity.

## Phase 3: tuning, controller, pump, sensor
- IMC formulas typed from Seborg Table 12.1 as recalled. **NOT yet checked against the PDF**
  (no textbook PDF in the repo). Logged in NOTES_FOR_ANDREW.md.
- **Discrepancy: θ_total and the Ts/2 term.** §5.3 defines θ_total = θ_model + θ_sensor + Ts/2.
  But the §6 reference (Kc ≈ −0.43) and the §13 references (Kc −0.574 / −0.426) only reproduce
  *without* the Ts/2 term:

  | θ_sensor | include Ts/2 | Kc | τI | τD |
  |---|---|---|---|---|
  | 0 | no | −0.5741 | 70.30 | 17.57 |
  | 0 | yes | −0.5281 | 70.30 | 17.57 |
  | 10 | no | −0.4256 | 70.30 | 17.57 |
  | 10 | yes | −0.3998 | 70.30 | 17.57 |

  Resolution: `DesignSpec.include_zoh` flag. **Default True** (follows §5.3, the stated
  design). Tests that check the planner's reference numbers set it False. App exposes the toggle.
- Controller as specified: position form, derivative on measurement, filter N=10, bumpless
  start. The feedforward is added *outside* the PID (simulate step 3–4), so anti-windup judges
  saturation of the PID output alone. The bolus fills the remaining capacity U_max − U_fb.
- Conditional integration judges direction by sign(Kc·e). A dedicated test sets up a case where
  the naive "e>0" rule would give the wrong answer.
- Back-calculation: S += Ts[e + τI(U−u)/(Kc·Tt)], Tt = √(τI·τD) (≈35.2 min) or τI for PI.
  u is evaluated with S_{k−1}+e·Ts. Derivation: integral term I = (Kc/τI)·S and
  dI/dt = (Kc/τI)e + (U−u)/Tt. While saturated with constant e, S converges geometrically
  (factor 1−Ts/Tt per sample) to a bounded equilibrium. The test checks |ΔS| < 1e-6 after 150
  samples, and S ends up < 20% of the anti-windup-off value.
- NaN measurement (dropout): the controller holds the last output and freezes its states.

## Phase 4: disturbance, feedforward
- Kf = V1·p2·n/(Gb·p3) = 7.7227, bolus for the textbook meal = 1390.09 mU. Delivered at
  U_max − U_fb, which takes 14.2 min. Total delivered matches to < 1 mU (test).
- **Deviation: meal time.** With the meal at t=0, a 15-min pre-bolus would start at t=−15
  (outside the run). An early version silently started it at t=0, which made "pre-bolus" equal
  to "no pre-bolus". Fix: presets put the meal at **t=60 min**, and the simulator warns
  (`Result.message`) when a bolus is scheduled before t=0.
- §14 sanity targets (SOPDT-fit IMC-PID, τc=20, θs=10, Ts=5, dt=0.1, meal at 60):

  | case | peak | nadir | planner target |
  |---|---|---|---|
  | feedback only (no Ts/2) | 163.4 | 49.4 | 163 / 52 |
  | feedback only (with Ts/2) | 163.5 | 50.4 | |
  | full bolus at meal | 138.9 | 48.6 | 139 / 50 |
  | 15-min pre-bolus | 107.9 | 62.2 | 108 / 63 (in band ✔) |

  All are within ±5 mg/dL. The planner's feedback-only nadir (52) is 2.6 high.
- **"Suspend integral during bolus window" (plan asked: test, don't assume).** With the
  15-min pre-bolus preset: nadir 62.6 with no suspend; 62.6 suspending only during the 14-min
  delivery; 63.8 with +30 min; 64.5 with +60 min; 64.5 with +120 min. The peak is unchanged
  (107.9). So it **helps slightly** on the low side (+2 mg/dL) once the freeze outlasts the
  delivery by ~60 min. It is minor because the integral is slow (τI = 70 min). Default: off.
- Overestimated meal (+40%) with the 15-min pre-bolus: nadir 57.8. That is below 70 but above
  54, so the plan's claim "FF can cause lows too" holds for the 70 threshold, not the 54 one.
  Without a pre-bolus the nadir is 41.8, but most of that comes from timing (a correct
  estimate with no pre-bolus already gives 49.3). The preset text says this honestly.
- Lead-lag dynamic FF (stretch) implemented: Kf(τ_ld s+1)/(τ_lg s+1), driven by the announced
  meal shifted by t_pre. Default τ_ld = 1/p2+1/n (the first-order term of the ideal
  numerator); τ_lg = 10 min is a **labeled user choice, not from a source**.

## Phase 5: metrics, stability
- Time fractions use the trapezoid rule on an indicator. A test with an analytic sine
  fraction matches to 0.02 percentage points.
- Margins use the full 3rd-order linear Gp and the filtered PID (N=10). Phase is built
  analytically from its factors, so no numerical unwrapping is needed.

  | design | ωc | PM | GM | total tolerable delay (PM/ωc, no delay in L) |
  |---|---|---|---|---|
  | θs=0, τc=20 | 0.03574 | 68.5° | 17.1 | 33.4 min |
  | θs=10, τc=20 | 0.02687 | 74.0° | 23.1 | 48.1 min |

  Matches plan. With the 10-min delay *included* in L: PM 58.6°, extra tolerable delay
  38.1 min (= 48.1 − 10, consistent). "Total tolerable delay" in the plan = PM/ωc computed
  with no delay in L.
- Empirical cross-check (sampled nonlinear loop, unbounded actuator, −1 mg/dL SP step,
  bisection on sensor delay until peak ratio ≥ 1): **43.2 min** (vs 48.1 analytic) for the
  θs=10 design, and **27.6 min** (vs 33.4) for θs=0. The gap of ~5–6 min is more than the
  Ts/2 = 2.5 min the plan anticipated. Likely reasons: (1) the ZOH (Ts/2); (2) the discrete
  backward-difference derivative and filter add roughly another half-sample of lag to the D
  action; (3) the delay is rounded to dt. Nonlinearity is negligible for a 1 mg/dL step.

## Phase 6: presets, app
- Presets are `Scenario` objects (user-level knobs). `build_config()` computes the PID from the
  reduced model at run time, so no tuning values are hard-coded. Added one preset beyond the
  plan: "Delay-unaware tuning" (tuned for θs=0, actual 10 min): peak 163.0, nadir 45.7.
- Preset results (default include Ts/2, τc=20, meal at 60 min):

  | preset | peak | nadir | in 54–144? |
  |---|---|---|---|
  | Open loop | 166.2 | 81.0 | no |
  | IMC-PID, no delay (23.6d) | 151.4 | 60.5 | no (peak) |
  | IMC-PID, 10-min delay (23.6e) | 163.5 | 50.4 | no |
  | Aggressive τc=2 | 162.5 | 41.8 | no |
  | Sluggish τc=60 | 164.4 | 59.3 | no |
  | Windup, AW off, 2× meal | 245.0 | 39.6 | no |
  | Windup, AW on (clamp), 2× meal | 245.0 | 43.9 | no (back-calc: 42.6) |
  | Bolus at meal | 138.9 | 49.3 | no |
  | **15-min pre-bolus** | **107.9** | **62.6** | **yes** |
  | Overestimate +40% (pre-bolus) | 102.0 | 57.8 | yes (but < 70) |
  | Sensor stuck at 60 | 166.2 | 81.0 | no (identical to open loop) |
  | SP step −20 | 81.0 | 60.1 | yes |

- The windup demo shows a smaller difference than the plan implied (nadir 39.6 vs 43.9).
  The 2× meal pins U_max for 15–20 min whether or not anti-windup is on. Most of the low comes
  from the large P+D action and the delay, not from integral windup alone.
- App verified headless with `streamlit.testing.AppTest`: all presets, every tuning method,
  manual tuning, open loop, lead-lag FF, drift/dropout faults, save-run and the delay-sweep
  button all run without exceptions.
- **Not done: Streamlit Cloud deployment.** It needs Andrew's account (see NOTES).

## Phase 7 (stretch): MPC
- Delay-augmented ZOH discretisation of the linear model, steady-state Kalman filter, horizon
  24 samples, box input bounds, soft G ≥ 70, asymmetric cost (w_hypo = 10). Solved with
  L-BFGS-B and an analytic gradient (cost is piecewise quadratic, C1). A ~1 s run is fine for
  caching. A hand-written QP / cvxpy was not needed.
- **Key finding: the disturbance model matters more than the optimiser.** With the standard
  random-walk *output* disturbance (offset-free MPC textbook choice), MPC ≈ PID on the 23.6(e)
  meal (164.0 / 51.5). That model treats the meal as a permanent offset, so MPC keeps
  delivering. Adding a decaying *input* disturbance state (decay 0.05/min, the textbook meal
  k) gives 162.5 / **69.9**. Default `dist_model='meal'`, q_w = 0.01, q_meal = 0.5.
  ⚠ These weights were chosen by the agent **on the 23.6(e) preset**. Cross-checked on other
  scenarios to guard against overfitting:

  | scenario | PID peak/nadir | MPC peak/nadir |
  |---|---|---|
  | 23.6(e) | 163.5 / 50.4 | 162.5 / 69.9 |
  | + p3×1.5 at t=120 | 163.5 / 49.6 | 162.5 / 70.5 |
  | + noise σ=5 | 163.0 / 50.4 | 167.6 / 71.4 |
  | 2× meal | 245.0 / 43.9 | 244.9 / 64.7 |
  | 3 meals / 24 h, p3×1.5 | 163.2 / 43.3 | 162.6 / 55.2 |
  | 15-min pre-bolus vs MPC+announcement | 107.9 / 62.6 | 98.5 / 71.7 |

  No controller lowers the unannounced-meal **peak**. That limit is set by the delay and the
  insulin lag, not by the algorithm. MPC's advantage is entirely on the low side.
- With MPC, an announced meal enters the prediction, and the separate bolus is switched off.
- The SP step −20 (target 61) ends at 70.3 under MPC because the soft constraint G ≥ 70
  overrides the set point. This is intended behaviour, and worth explaining.

## Not built
- 7.3 IOB limit (stretch): not implemented.
- Phase 8 (Ex. 23.7 TF patient): not built. The plan requires checking the transfer functions
  against the PDF first, and the PDF is not available to the agent.
