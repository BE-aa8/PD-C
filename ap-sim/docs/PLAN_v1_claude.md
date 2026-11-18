<!--
PROVENANCE: Verbatim copy of the original build plan as pasted by Andrew into the Claude Code
session on 2026-11-18 (first message of the session). Plan author: Claude Opus 5.5.
Saved to the repository on 2026-11-18 during completion Phase A. Do not edit; later changes
belong in BUILD_LOG.md / AI_MODEL_CRITIQUE.md.
-->

# BUILD PLAN — "Closing the Loop": Artificial Pancreas Control Simulator

**Plan author (Model 1):** Claude Opus 5.5 · **Date:** 2026-11-18
**Course:** CHEE 4071 Process Dynamics and Controls (UC, Fall 2026) · **Student:** Andrew Aldrich
**Status:** First plan. This goes to a second AI model for critique before anything is built.

> **Instructions to the coding agent (Claude Code or any other model):**
> Build the simulator described below **exactly as specified**. The priority is correct physics, correct math, correct numerics, and passing validation tests. **UI/UX is not a priority**: a plain functional Streamlit page is enough for now. Do not invent parameter values. Every number comes from the source table in §2 or is an explicit, labeled user input. If something in this plan is ambiguous or looks wrong, **stop and write the question to `NOTES_FOR_ANDREW.md`**. Do not guess silently. Log every major decision in `BUILD_LOG.md`, because this project is graded on documented reasoning.

---

## 0. What we are building (one paragraph)

The simulator models one illustrative Type 1 diabetic patient: the textbook glucose–insulin model from Seborg et al., *Process Dynamics and Control*, 4th ed., Example 23.3 (model from Bequette, 2002). A digital controller reads a delayed, sampled glucose sensor every 5 minutes and sets an insulin pump rate. The pump is limited to 0–115 mU/min. A meal is the disturbance. The app lets the user change controller tuning, sensor delay, meal size and feedforward (meal announcement / pre-bolus). It then plots glucose, insulin, and safety metrics against the textbook's safety band (54–144 mg/dL). It also does the course math: linearization → transfer functions → reduced-order model fit → IMC-PID tuning → stability margins and maximum tolerable delay. This mirrors Seborg Exercises 23.6 (a)–(e).

**Required disclaimer, shown on every page:** *"Educational process-control model of an illustrative textbook patient. Not medical advice. Not for dosing decisions."*

---

## 1. Tech stack and repository layout

- **Language:** Python 3.11+
- **Libraries:** `numpy`, `scipy`, `plotly`, `streamlit`, `pytest`. MPC stretch only: `cvxpy` OR a hand-written QP via `scipy.optimize`.
- **Hosting target:** Streamlit Community Cloud (free, public URL, required by the assignment).
- **Hard rule:** all physics and control code is **pure Python with no Streamlit imports**, so it can be unit-tested and reused. `app.py` only wires inputs to functions and draws plots.

```
ap-sim/
├── app.py                  # Streamlit UI (thin)
├── apsim/
│   ├── __init__.py
│   ├── params.py           # All constants + source citations (single source of truth)
│   ├── patient.py          # Nonlinear ODE model (Bergman/Bequette minimal model)
│   ├── linearize.py        # Analytic linearization, transfer functions, step responses
│   ├── reduce.py           # Reduced-order model fitting (FOPDT/SOPDT) + Skogestad half rule
│   ├── tuning.py           # IMC-PID tuning rules (Seborg Table 12.1)
│   ├── controller.py       # Discrete PID with derivative filter + anti-windup
│   ├── feedforward.py      # Meal announcement / bolus logic
│   ├── sensor.py           # CGM model: sampling, delay, lag, noise, faults
│   ├── pump.py             # Actuator: saturation, rate quantization (optional)
│   ├── disturbance.py      # Meal profiles
│   ├── simulate.py         # Fixed-step RK4 engine, event ordering, logging
│   ├── metrics.py          # Time-in-range, min/max, IAE, insulin totals, etc.
│   ├── stability.py        # Frequency response, phase/gain margin, max delay
│   ├── presets.py          # Named scenarios
│   └── mpc.py              # STRETCH (Phase 7) — linear MPC
├── tests/
│   ├── test_patient.py
│   ├── test_linearize.py
│   ├── test_reduce.py
│   ├── test_controller.py
│   ├── test_simulate.py
│   └── test_stability.py
├── requirements.txt
├── BUILD_LOG.md            # Decisions, deviations, and why
├── NOTES_FOR_ANDREW.md     # Open questions the agent could not resolve
└── README.md               # How to run, disclaimer, sources
```

---

## 2. Parameters (single source of truth, `params.py`)

All values below come from **Seborg et al., 4th ed., Example 23.3** unless noted. Store each with a `source` string and `units` string.

| Symbol | Value | Units | Meaning |
|---|---|---|---|
| p1 | 0.028735 | min⁻¹ | Insulin-independent glucose uptake rate |
| p2 | 0.028344 | min⁻¹ | Decay rate of remote insulin effect |
| p3 | 5.035e-5 | min⁻² per (mU/L)  *(textbook lists "min⁻¹"; see note)* | Gain from plasma insulin to remote effect |
| n  | 0.0926 | min⁻¹ | Plasma insulin clearance rate |
| V1 | 12 | L | Insulin distribution volume |
| G_basal | 81 | mg/dL | Basal (fasting) glucose |
| I_basal | 15 | mU/L | Basal plasma insulin |
| U_max | 115 | mU/min | Pump maximum infusion rate |
| U_min | 0 | mU/min | Pump cannot remove insulin |
| Safety band | 54 < G < 144 | mg/dL | Textbook Example 23.3 band ("widened to allow less conservative control") |
| Meal D(t) | 9.0·e^(−0.05 t) | mg/dL/min | Textbook meal disturbance, t in min after meal |
| CGM sample period | 5 | min | Seborg §23.2 (cites Harvey et al., 2010) |
| Sensor delay (default) | 10 | min | Seborg Exercise 23.6(e) |

**Unit note for p3:** X has units of min⁻¹ (it multiplies G in dG/dt), so the dimensionally consistent unit for p3 is min⁻²·(mU/L)⁻¹. Show the textbook value unchanged. Put this note in the docs as a "units check" that Andrew can talk through in Q&A.

**Secondary clinical reference (label "to verify before citing"):** the international consensus time-in-range target of 70–180 mg/dL, with level-2 hypoglycemia below 54 mg/dL (Battelino et al., *Diabetes Care*, 2019). Seborg also quotes ADA (2014): 70–130 mg/dL before meals, < 180 mg/dL 1–2 h after. **Default band in the app = textbook 54–144.** The 70–180 band is a second, toggleable metric.

---

## 3. Process model (`patient.py`)

### 3.1 Nonlinear ODEs (deviation variables, exactly as in Seborg Eq. 23-16 to 23-18)

```
dG/dt = −p1·G − X·(G + G_basal) + D(t)
dX/dt = −p2·X + p3·I
dI/dt = −n·(I + I_basal) + U(t)/V1
```

- G = glucose deviation from G_basal [mg/dL]; absolute glucose = G + G_basal
- X = remote insulin effect [min⁻¹]. This is the main lag: insulin acts *through* X, not directly.
- I = plasma insulin deviation from I_basal [mU/L]
- U = **absolute** pump infusion rate [mU/min], the manipulated variable
- D = meal glucose appearance rate [mg/dL/min], the disturbance

### 3.2 Basal steady state (derive in code, don't hard-code)

With G = X = I = 0 at steady state, the third equation gives:

```
U_basal = n · I_basal · V1 = 0.0926 × 15 × 12 = 16.668 mU/min
```

**This is the controller's bias (u_bias).** Explain this in the docs. It's a direct link to the course idea of "controller output at the nominal steady state."

### 3.3 Key physical insight to surface in the app (Q&A gold)

The pump can add up to 115 − 16.67 = **98.3 mU/min** above basal, but it can only cut **16.67 mU/min** below basal. **The actuator is wildly asymmetric.** Insulin only lowers glucose and can't be taken back. Overdelivery therefore can't be undone, which is why integral windup ("insulin stacking") is dangerous. Show `downward authority / upward authority = 0.17` as a computed number.

### 3.4 Implementation

- `patient_rhs(state: np.ndarray, U: float, D: float, p: Params) -> np.ndarray` is a pure function with no hidden state.
- Clamp nothing inside the ODE. Saturation lives in `pump.py`.
- Guard: if absolute glucose G + G_basal goes ≤ 0, stop the simulation and flag "model invalid". This should never happen with sane inputs.

---

## 4. Linearization and transfer functions (`linearize.py`)

### 4.1 Analytic linearization about the basal steady state (G = X = I = 0)

The only nonlinear term is X·(G + G_basal). Its partial derivatives at the origin: ∂/∂G = X = 0 and ∂/∂X = G_basal. So:

```
dG/dt = −p1·G − G_basal·X + D
dX/dt = −p2·X + p3·I
dI/dt = −n·I + u/V1          where u = U − U_basal (deviation input)
```

State-space form: x = [G, X, I]ᵀ

```
A = [[−p1, −G_basal, 0 ],
     [ 0 ,  −p2,    p3],
     [ 0 ,   0 ,   −n ]]
B_u = [0, 0, 1/V1]ᵀ     B_d = [1, 0, 0]ᵀ     C = [1, 0, 0]
```

### 4.2 Transfer functions (derive symbolically, then verify numerically)

```
Gp(s) = G(s)/u(s) = −(G_basal·p3/V1) / [(s + p1)(s + p2)(s + n)]

Gd(s) = G(s)/D(s) = 1 / (s + p1)
```

Write these in time-constant (gain/τ) form as well. **Reference values (tests must reproduce):**

| Quantity | Formula | Value |
|---|---|---|
| Process gain Kp | −G_basal·p3 / (V1·p1·p2·n) | **−4.506 (mg/dL)/(mU/min)** |
| τ (glucose) | 1/p1 | 34.80 min |
| τ (remote insulin) | 1/p2 | 35.28 min |
| τ (plasma insulin) | 1/n | 10.80 min |
| Disturbance gain Kd | 1/p1 | 34.80 (mg/dL)/(mg/dL/min) |

### 4.3 Nonlinearity demonstration (teaching feature)

Simulate the **nonlinear** model for a +1 mU/min step in U (no meal). The final ΔG/ΔU is **≈ −4.27**, not −4.506. The difference arises because at steady state G = −X·G_basal/(p1 + X), so the effective gain *shrinks* as insulin rises. Plot a "steady-state gain vs. step size" curve for ΔU from −16 to +98 mU/min. This shows why a linear model is only valid near the operating point, which is a core Module 2 idea.

### 4.4 Step response utilities

- `linear_step(tf, t)` with `scipy.signal`
- `nonlinear_step(dU, t)` via `simulate.py` with no controller

---

## 5. Reduced-order model (`reduce.py`) — Seborg Exercise 23.6(a)

The tuning rules need a low-order model. Provide **two methods** and compare them.

### 5.1 Skogestad half rule (analytic)

Starting from the three time constants (35.28, 34.80, 10.80 min):

- **SOPDT:** τ1 = 35.28, τ2 = 34.80 + 10.80/2 = **40.20**, θ = 10.80/2 = **5.40 min**, K = −4.506
- **FOPDT:** τ = 35.28 + 34.80/2 = **52.68**, θ = 34.80/2 + 10.80 = **28.20 min**, K = −4.506

### 5.2 Least-squares fit to the simulated nonlinear step (what the exercise asks)

Fit to the nonlinear response for ΔU = +1 mU/min over 0–600 min, using `scipy.optimize.least_squares`. Reference results from the planning check, ±3% tolerance:

- **SOPDT fit:** K ≈ −4.27, τ1 ≈ τ2 ≈ 35.1 min, θ ≈ 8.7 min
- **FOPDT fit:** K ≈ −4.29, τ ≈ 56.6 min, θ ≈ 25.6 min

Notes for the coding agent:
- The fit may push τ1 → τ2 (critically damped). Handle the τ1 = τ2 limit analytically: y = K[1 − (1 + t′/τ)e^(−t′/τ)]. Don't divide by (τ1 − τ2).
- Report fit quality (RMSE, max error) and overlay the fitted model on the true response.

### 5.3 Effective dead time with the sensor

Total effective delay seen by the controller is θ_total = θ_model + θ_sensor + Ts/2. The last term is the standard approximation for a zero-order hold with sample period Ts. Show all three terms separately in the app.

---

## 6. Controller tuning (`tuning.py`) — IMC rules (Seborg Table 12.1)

**Agent: verify these against Seborg Table 12.1 in the textbook PDF before finalizing, and log the check in `BUILD_LOG.md`.**

- **SOPDT → PID:** Kc = (τ1 + τ2) / [K(τc + θ)],  τI = τ1 + τ2,  τD = τ1·τ2/(τ1 + τ2)
- **FOPDT → PI:** Kc = τ / [K(τc + θ)],  τI = τ
- **FOPDT → PID:** Kc = (τ + θ/2) / [K(τc + θ/2)],  τI = τ + θ/2,  τD = τθ/(2τ + θ)

τc is a user slider. Default τc = θ_total, a common IMC starting guideline; cite the guideline Seborg gives in Chapter 12. Also show a Ziegler–Nichols / Cohen–Coon comparison as a stretch, clearly labeled as "aggressive classical rules".

**Sign convention:** K < 0, so Kc < 0. With e = G_sp − G_m, high glucose gives e < 0, and Kc·e > 0 means more insulin. Correct. **Add a unit test that a +10 mg/dL measured error raises U above U_basal.**

Reference IMC-PID from the SOPDT fit with θ_sensor = 10 min and τc = 20 min: Kc ≈ **−0.43 (mU/min)/(mg/dL)**, τI ≈ 70.3 min, τD ≈ 17.6 min.

---

## 7. Discrete PID controller (`controller.py`)

The controller runs **only at sample instants** (every Ts = 5 min) and holds its output in between (ZOH).

### 7.1 Algorithm (position form, ISA/standard)

At sample k, with measurement m_k, set point r_k, error e_k = r_k − m_k:

```
P_k   = Kc · (β·r_k − m_k)                         # β = set-point weight (default 1)
I_k   = Kc/τI · S_k,     S_k = S_{k−1} + e_k·Ts    # integral state (subject to anti-windup)
D_k   = −Kc·τD · d_k                               # derivative on MEASUREMENT, not error
d_k   = α·d_{k−1} + (1−α)·(m_k − m_{k−1})/Ts       # filtered derivative
α     = τf/(τf + Ts),  τf = τD/N,  N = 10 (slider 5–20)
u_k   = U_basal + P_k + I_k + D_k + u_ff,k
U_k   = clip(u_k, U_min, U_max)
```

- **Derivative on measurement** avoids derivative kick on set-point steps (Seborg Ch. 8). Document why.
- **Bumpless start:** S_0 = 0, d_0 = 0, m_{−1} = m_0.

### 7.2 Anti-windup (two selectable methods, plus "off" for the demo)

1. **Conditional integration (clamping):** compute u_trial with the updated S_k. If u_trial > U_max **and** Kc·e_k > 0, or u_trial < U_min **and** Kc·e_k < 0, reject the integral update (S_k = S_{k−1}).
   ⚠️ **Judge saturation direction by the sign of Kc·e, not e.** Kc is negative here. Using e alone gives the wrong logic. (The quick planning check made exactly this mistake, so add a test.)
2. **Back-calculation:** S_k += Ts·[e_k + (U_k − u_k)/(Kc·Tt)·τI], with tracking time Tt = √(τI·τD), or Tt = τI for PI. Agent: derive carefully and unit-test that S stops growing while saturated.
3. **Off:** for the "insulin stacking" demonstration.

### 7.3 Optional insulin-on-board (IOB) limit (stretch, label clearly)

Track IOB as the model's own insulin states, mapped to "equivalent mU". Cap feedback insulin when IOB exceeds a threshold. This is how real systems limit stacking. Mark it "illustrative; not a real device algorithm".

---

## 8. Sensor model (`sensor.py`)

The CGM reads **delayed, sampled, optionally noisy** glucose:

```
G_m(t_k) = G_true(t_k − θ_s) + noise_k  [+ optional first-order lag τ_s]
```

- **Delay:** use a circular history buffer of the true glucose at simulation step dt. The delay must be a whole multiple of dt; round and log it.
- **Lag (optional):** first-order filter with τ_s (default 0, slider 0–15 min), integrated inside the main RK4 loop as an extra state.
- **Noise:** Gaussian, σ slider 0–10 mg/dL, **seeded RNG** (seed shown in the UI) for reproducibility.
- **Faults (presets):** (a) stuck sensor (holds last value after t_fault), (b) drift (+x mg/dL/h), (c) dropout (NaN; controller holds the last output and flags it).
- Before t = θ_s, the sensor returns basal glucose (history pre-filled at steady state).

---

## 9. Disturbances (`disturbance.py`)

- **Textbook meal:** D(t) = A·e^(−k(t − t_meal)) for t ≥ t_meal, else 0. Defaults A = 9.0, k = 0.05.
- **Meal size multiplier** (0–2×) scales A. Total glucose "area" = A/k (180 mg/dL for the textbook meal). Show it.
- **Multiple meals:** list of (t_meal, multiplier). The "three meals a day" preset ties to the run-to-run discussion in Seborg §23.2.
- **Do not convert to grams of carbohydrate.** No such mapping is in the source, and doing so would drift toward dosing advice. Keep everything in model units.
- **Unmeasured disturbance option:** a step change in insulin sensitivity (multiply p3 by a factor at t_s). Represents exercise/illness as **plant–model mismatch**, labeled illustrative.

---

## 10. Feedforward / meal announcement (`feedforward.py`)

### 10.1 Why ideal feedforward is impossible here (explain in the docs)

The ideal FF controller is Gf(s) = −Gd(s)/Gp(s) = V1·(s + p2)(s + n)/(G_basal·p3). This is **improper** (numerator order 2 > denominator order 0), so it needs pure derivatives of D. The meal also hits glucose *directly*, while insulin goes through two lags. Perfect cancellation is physically unrealizable, which is a key Seborg Ch. 15 concept. Show this derivation in the app.

### 10.2 Static feedforward → "bolus"

Static FF gain: Kf = −Kd/Kp = 34.80/4.506 = **7.72 (mU/min)/(mg/dL/min)**.
Matching total delivered insulin to the meal's total area gives the bolus size:

```
Bolus_total = f_bolus · Kf · (A_est/k)        # textbook meal: 7.72 × 180 ≈ 1390 mU
```

- f_bolus slider: 0–1.2, default 1.0
- **Meal estimate error** slider: A_est = (1 + ε)·A_true, ε from −50% to +50%. Real announcements are estimates.
- **Pre-bolus timing** slider: bolus starts t_pre minutes **before** the meal (0–30). This is the wow lever: because insulin lags, *when* you deliver it matters as much as *how much*.
- Delivery: at the max remaining pump capacity (U_max − U_fb) until Bolus_total is delivered. Total U never exceeds U_max. Log delivery time.
- Option: "suspend integral action during bolus window." The agent should implement it, test it, and record whether it helps in `BUILD_LOG.md`. Don't assume.

### 10.3 Dynamic FF (stretch)

A lead–lag approximation Gf ≈ Kf·(τ_ld·s + 1)/(τ_lg·s + 1). Compare it to the bolus.

---

## 11. Simulation engine (`simulate.py`)

- **Integrator:** fixed-step classical **RK4**, dt = 0.1 min (slider for advanced users: 0.05–0.5). Why fixed-step rather than `solve_ivp`: the sampled controller, ZOH, and delay buffer need deterministic, aligned time steps. It also makes both AI implementations directly comparable. **Cross-check once** against `solve_ivp(method="LSODA", rtol=1e-8)` in a test (open-loop meal, max error < 0.05 mg/dL).
- **Horizon:** default 600 min; up to 1440 min for multi-meal days.
- **Event order within each dt step (document it; this order matters):**
  1. Record the true state and push G_true into the sensor history.
  2. If t is a sample instant (t mod Ts == 0, use integer step counters, **never float modulo**): read the sensor, compute feedback, update the controller states, latch U_fb.
  3. Compute the feedforward/bolus contribution for this step.
  4. U = clip(U_fb + U_ff, U_min, U_max); log U_fb, U_ff, U.
  5. Evaluate D(t), with D held constant across RK4 substeps (or evaluated at substep times; pick one, document it, test both give < 0.1 mg/dL difference).
  6. RK4 step.
- **Output:** a dict of numpy arrays (or a pandas DataFrame): t, G_true(abs), G_meas, X, I, U, U_fb, U_ff, D, integral state, saturation flag, bolus-active flag.
- Pure function: `simulate(config) -> Result`. `config` is a dataclass that fully defines the run (hashable for Streamlit caching).

---

## 12. Metrics (`metrics.py`)

Computed on **true** glucose (and also on measured, shown side by side):

- Peak glucose and time of peak; nadir (lowest) glucose and time of nadir
- **% time in textbook band** (54–144) and **% time in 70–180** (clinical, "verify" label)
- % time below 54 and below 70 (hypo exposure); % time above 144 / 180
- IAE and ISE of glucose about the set point
- Total insulin delivered (feedback, feedforward, total) in mU
- Time saturated at U_max and at U_min (0)
- Settling time back to within ±5 mg/dL of the set point after the meal
- **Pass/fail badge:** "Stayed in 54–144 band?" (Exercise 23.6(d)'s exact question)

Time fractions use the trapezoid rule on the dt grid. Test with a synthetic signal whose answer is known exactly.

---

## 13. Stability analysis (`stability.py`) — Seborg Exercise 23.6(e)

1. **Frequency response** of the loop L(jω) = Gc(jω)·Gp(jω)·e^(−jωθ_s), with Gc the filtered PID and Gp the **full 3rd-order linear model** (not the fit).
2. Compute crossover ωc (|L| = 1), **phase margin PM**, **gain margin GM**. Plot Bode and Nyquist.
3. **Maximum tolerable additional delay:** Δθ_max = PM / ωc (radians / rad·min⁻¹ → min).
   Reference values (continuous-time, ideal PID with τf = 0.1τD, full linear model):
   - Tuned for θ_s = 0, τc = 20: Kc ≈ −0.574, ωc ≈ 0.0358 rad/min, PM ≈ 68°, **total tolerable delay ≈ 33 min**
   - Tuned for θ_s = 10, τc = 20: Kc ≈ −0.426, ωc ≈ 0.0269 rad/min, PM ≈ 74°, **total tolerable delay ≈ 48 min**
   (Tolerance ±5%. Note: sampling adds ≈ Ts/2 = 2.5 min of effective delay that this continuous calculation ignores. Report both.)
4. **Empirical cross-check:** sweep θ_s in the nonlinear closed-loop sim with no saturation (small set-point step) until sustained oscillation appears. Compare with step 3 and explain any gap (nonlinearity, sampling, saturation).
5. Exercise 23.6(c): closed-loop response to a **−20 mg/dL set-point step**. Show it as a preset.

---

## 14. Presets (`presets.py`)

Each preset is a full config dataclass:

| Preset | What it shows |
|---|---|
| Open loop (basal only) | Meal pushes glucose to ≈ 166 mg/dL at ≈ 26 min; above 144 from ≈ 10.7 to 52.4 min |
| Textbook IMC-PID, no sensor delay | Exercise 23.6(d) |
| IMC-PID with 10-min sensor delay | Exercise 23.6(e). Feedback alone peaks high, then dips toward the low limit |
| Aggressive (τc = 2 min) | Lower peak is NOT achieved (insulin lag); deeper low. "Why can't you just turn up the gain?" |
| Sluggish (τc = 60 min) | Safe but slow |
| Windup demo (anti-windup off, 2× meal) | Insulin stacking → later low |
| Meal announced, no pre-bolus | Feedforward helps |
| Meal announced + 15-min pre-bolus | **The wow moment:** stays in band |
| Overestimated meal (+40%) | Feedforward can cause lows too |
| Sensor stuck at t = 60 min | Fault scenario |
| Set-point step −20 mg/dL | Exercise 23.6(c) |
| Three meals / 24 h | Leads into the run-to-run discussion |

**Sanity targets from the planner's quick check** (SOPDT-fit IMC-PID, τc = 20, θ_s = 10, Ts = 5, dt = 0.1). These are approximate and should land within about ±5 mg/dL:
- Feedback only: peak ≈ 163 mg/dL, nadir ≈ 52 mg/dL (breaks both band limits)
- Full static bolus (≈ 1390 mU), 15-min pre-bolus: peak ≈ 108, nadir ≈ 63 (stays in band)
- Full bolus at meal time (no pre-bolus): peak ≈ 139, nadir ≈ 50

If the implementation lands far from these, find out why and record it in `BUILD_LOG.md`. Either the implementation or the planner's quick check could be wrong.

---

## 15. App (`app.py`) — functional only

Sidebar inputs: preset selector; tuning method (IMC from fit / IMC from half rule / manual); τc; manual Kc, τI, τD; derivative filter N; anti-windup method; Ts; sensor delay, lag, noise, seed; meal list and size; feedforward on/off, f_bolus, estimate error, pre-bolus time; set point; simulation horizon; band choice.

Main panel (plain tabs are fine):
1. **Simulation:** glucose (true and measured) with the safety band shaded; U split into basal / feedback / bolus; D(t); metrics table and pass/fail.
2. **Model & Linearization:** equations (st.latex), A/B/C matrices, TFs, the gain table, the nonlinear-gain-vs-step-size plot.
3. **Model Reduction:** true vs. half-rule vs. fitted step responses, fit stats.
4. **Tuning & Stability:** IMC calculation shown step by step; Bode/Nyquist; PM, GM, max delay; delay sweep.
5. **Compare runs:** overlay up to 4 saved runs (needed for the AI-model comparison and for presets).
6. **About / Sources / Disclaimer / Transcript** (placeholder sections the assignment requires: YouTube link, verbatim transcript, AI process, attribution).

Use `@st.cache_data` on `simulate(config)`. One 600-min run at dt = 0.1 is 6,000 RK4 steps, which should take well under 1 s.

---

## 16. Validation tests (must pass before UI work)

| Test | Assertion |
|---|---|
| Basal steady state | U = U_basal, no meal, 1000 min → \|G\|, \|X\|, \|I\| < 1e-9 |
| U_basal | = 16.668 ± 1e-3 mU/min |
| Open-loop meal | peak deviation 85.15 ± 0.2 mg/dL at t = 26.0 ± 0.3 min (absolute ≈ 166.2) |
| Open-loop analytic | Because X ≡ 0 open-loop, G(t) = 9/(0.05 − p1)·(e^(−p1 t) − e^(−0.05 t)) exactly. Max error vs. sim < 0.01 mg/dL |
| RK4 vs. LSODA | max diff < 0.05 mg/dL |
| Linear gain | Kp = −4.506 ± 0.001; poles at −p1, −p2, −n |
| Nonlinear gain | ΔU = +1 → ΔG_ss/ΔU = −4.27 ± 0.02 |
| Linear vs. nonlinear | small step (ΔU = 0.01): nonlinear gain within 0.5% of Kp |
| Half rule | values in §5.1 ± 0.01 |
| Fit | values in §5.2 ± 3% |
| IMC | reference values in §6 ± 1% |
| Controller sign | measured G = basal + 10, Kc < 0 → U > U_basal |
| Saturation | U always within [0, 115] |
| Anti-windup | with a forced saturation scenario, the integral state stops changing in the saturating direction (both methods) |
| Derivative on measurement | set-point step gives no spike in U at the step instant |
| Sensor delay | measured signal equals the true signal shifted by θ_s (within one dt) |
| Bolus | total delivered ff insulin = Bolus_total ± 1 mU; never exceeds U_max |
| Stability | PM/ωc/max-delay reference values ± 5% |
| Metrics | synthetic signal with a known time-in-range fraction → exact within the dt resolution |
| Reproducibility | same config + seed → identical arrays |

---

## 17. Build phases (do in order; commit after each; log in `BUILD_LOG.md`)

1. **Phase 1:** `params`, `patient`, `simulate` (open loop), and tests for steady state, open-loop meal, analytic and LSODA cross-checks.
2. **Phase 2:** `linearize`, `reduce` + tests (gains, half rule, fit, nonlinearity curve).
3. **Phase 3:** `tuning`, `controller`, `pump`, `sensor` + closed-loop tests (sign, saturation, anti-windup, delay).
4. **Phase 4:** `disturbance`, `feedforward` + bolus tests; reproduce the §14 sanity targets.
5. **Phase 5:** `metrics`, `stability` + tests; delay sweep.
6. **Phase 6:** `presets`, minimal `app.py`, deploy to Streamlit Cloud, README with disclaimer and sources.
7. **Phase 7 (stretch):** `mpc.py`. Discretize the linear model (Ts = 5, delay augmented as extra states). Use a horizon of about 24 steps (2 h) with input constraints 0 ≤ U ≤ 115 and a soft output constraint on G ≥ 70 (or 54). Weigh hypoglycemia more heavily than hyperglycemia (asymmetric cost). Compare against PID on the same presets. Seborg notes that PID, MPC, and fuzzy-logic algorithms have all been clinically tested (Doyle III et al., 2014). **Do not claim** which commercial devices use which algorithm unless Andrew supplies a verified source.
8. **Phase 8 (stretch):** "Textbook TF patient" from Seborg Exercise 23.7: Gp1 = −1.5e^(−30s)/[(20s+1)(25s+1)], Gd = 5e^(−10s)/(30s+1). This is a second, purely linear plant for comparison; units are as given in the exercise. Optional glucagon channel Gp2 = 3.4e^(−15s)/(15s+1) for a split-range (insulin/glucagon) discussion (Seborg Ch. 16 split-range control). **Check the exact transfer functions against the textbook PDF first.** They were read from extracted text and need visual confirmation.

---

## 18. Explicit "do NOT" list

- Do not add real drug names, carb ratios, correction factors, or anything that reads as patient dosing guidance.
- Do not hard-code tuning values that should be computed.
- Do not use `solve_ivp` inside the controlled loop (see §11).
- Do not use float modulo for sample timing.
- Do not cite commercial products, FDA approvals, or clinical guidelines that aren't in §2's sources without a `[TO VERIFY]` tag.
- Do not spend time on styling, themes, or custom CSS.

---

## 19. What the second AI model should critique (for the multi-model requirement)

Hand this plan to a different model and ask it to critique specifically:
1. Is the anti-windup logic correct for a negative-gain process?
2. Is fixed-step RK4 at dt = 0.1 min appropriate, or is there a better choice?
3. Is the static-gain bolus sizing (§10.2) sound, and is it the right "feedforward" to teach?
4. Are the IMC formulas and τc default the right ones from Seborg Table 12.1?
5. Is anything physically wrong or missing in the patient/sensor/pump models?
6. Are the validation tests sufficient to catch a wrong implementation?
7. What would make the comparison between two AI implementations most meaningful?

Andrew records which suggestions he accepts or rejects, and why. That record is a graded deliverable.

---

## 20. Sources

- Seborg, D. E., Edgar, T. F., Mellichamp, D. A., & Doyle, F. J. III. *Process Dynamics and Control*, 4th ed. Wiley, 2016/2017. Ch. 8 (PID), Ch. 12 (IMC tuning, Table 12.1), Ch. 15 (feedforward), Ch. 16 (selective/split-range control), **Ch. 23 §23.2.1 and Example 23.3; Exercises 23.6, 23.7**.
- Bequette, B. W. (2002), the model source cited in Seborg Example 23.3. *Full citation to pull from Seborg's reference list.*
- Bergman, R. N., et al. (1979), the original "minimal model". *[TO VERIFY: full citation]*
- Doyle III, F. J., et al. (2014), as cited in Seborg §23.2 (closed-loop artificial pancreas clinical testing review).
- Battelino, T., et al. (2019), *Diabetes Care*, time-in-range consensus. *[TO VERIFY before citing]*
- American Diabetes Association (2014), glucose targets as quoted in Seborg §23.2.
- Skogestad, S. (2003), *J. Process Control*, the "half rule" for model reduction. *[TO VERIFY: full citation]*
