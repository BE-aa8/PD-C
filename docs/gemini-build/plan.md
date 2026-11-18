# Gemini's implementation plan

_Run 20261118T171557Z, models: gemini-3.8-flash, gemini-3-flash-preview_

# Implementation Plan: "Closing the Loop" Artificial-Pancreas Control Simulator (Gemini Build)

**Course:** CHEE 4071 Process Dynamics and Control (Prof. Carlos Co, Fall 2026)  
**Student:** Andrew Aldrich  
**Specification:** `docs/plan-v2-final.md` (Plan v2 Final)  
**Output Target:** `site/gemini/`  

---

## 1. Executive Summary & Core Objectives

The objective is to build an interactive static educational web application teaching feedback and feedforward process control using the minimal glucose–insulin model from Seborg, Edgar, Mellichamp & Doyle (*Process Dynamics and Control*, 4th ed., Example 23.3 / Exercise 23.6).

The build is partitioned strictly into two decoupled layers:
1. **Mathematical & Numerical Engine (`site/gemini/js/model.js`):** A pure ES module containing zero DOM references, importable in Node 18+ and browser environments, tested against the golden reference data (`tests/expected.json` via `npm test`).
2. **Interactive Educational Frontend (`site/gemini/`):** Plain HTML5, CSS3, and ES modules using pinned CDN builds of Plotly 2.35.2 and KaTeX 0.16.11. Supports responsive layouts down to 375px mobile viewports, automatic light and dark mode adaptation, 7 tabs, 11 dedicated Plotly visualizations (P1–P11), a live SVG control block diagram, and educational cards containing equation (KaTeX), units, and a one-line physical interpretation.

---

## 2. Repository Layout & File Architecture

All generated files will reside strictly inside `site/gemini/`:

```
site/gemini/
├── index.html              # Main HTML5 application shell containing the 7 tabs & layout
├── css/
│   └── style.css           # Responsive styling, CSS variables, dark/light themes, mobile 375px rules
└── js/
    ├── data.js             # Exact, UNCHANGED copy of site/js/data.js (never hand-edited)
    ├── model.js            # Pure numerical engine fulfilling plan §9 API contract
    └── app.js              # UI controller, DOM event bindings, KaTeX rendering, Plotly charts P1–P11, SVG diagram
```

External dependencies (pinned CDNs, no build step):
- `https://cdn.plot.ly/plotly-2.35.2.min.js`
- `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js`
- `https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css`

---

## 3. Mathematical Model & Numerical Engine (`js/model.js`)

`model.js` imports constants from `./data.js` and exports pure functions and constants according to Plan §9.

### 3.1 Model Equations & Parameters
From Seborg Example 23.3:
- Parameters:
  - $p_1 = 0.028735\text{ min}^{-1}$ (glucose uptake rate)
  - $p_2 = 0.028344\text{ min}^{-1}$ (remote insulin decay rate)
  - $p_3 = 5.035\times 10^{-5}\text{ min}^{-2}/(\text{mU/L})$ (insulin sensitivity gain)
  - $n = 0.0926\text{ min}^{-1}$ (plasma insulin clearance rate)
  - $V_1 = 12\text{ L}$ (distribution volume)
  - $G_b = 81\text{ mg/dL}$ (basal fasting glucose)
  - $I_b = 15\text{ mU/L}$ (basal plasma insulin)
  - $U_{\max} = 115\text{ mU/min}$, $U_{\min} = 0\text{ mU/min}$
- Derived quantities:
  - $U_{\text{basal}} = n \cdot I_b \cdot V_1 = 16.668\text{ mU/min}$
  - $K_p = -\frac{G_b \cdot p_3}{V_1 \cdot p_1 \cdot p_2 \cdot n} = -4.506298126\text{ mg/dL per (mU/min)}$
  - $\tau_G = 1/p_1 = 34.80076562\text{ min}$, $\tau_X = 1/p_2 = 35.28083545\text{ min}$, $\tau_I = 1/n = 10.79913607\text{ min}$
  - $K_d = 1/p_1 = 34.80076562\text{ mg/dL per (mg/dL/min)}$
  - $K_f = -K_d / K_p = \frac{V_1 \cdot p_2 \cdot n}{G_b \cdot p_3} = 7.722694913\text{ (mU/min)/(mg/dL/min)}$
  - Authority ratio: $\frac{U_{\text{basal}}}{U_{\max} - U_{\text{basal}}} = \frac{16.668}{98.332} \approx 0.1695073832$

### 3.2 Analytical Functions
- `linearModel()`:
  Returns `{ U_basal, Kp, Kd, tauG, tauX, tauI, Kf, authorityRatio }`.
- `nonlinearGain(dU)`:
  For deviation $\Delta U$:
  $$I = \frac{\Delta U}{n \cdot V_1}, \quad X = \frac{p_3 \cdot I}{p_2}, \quad G = -\frac{X \cdot G_b}{p_1 + X}, \quad \text{gain} = \frac{G}{\Delta U}$$
  When $|\Delta U| < 10^{-12}$, returns $K_p$.
- `halfRule()`:
  Ordered original lags: $\tau_1^* = \tau_X = 35.2808$, $\tau_2^* = \tau_G = 34.8008$, $\tau_3^* = \tau_I = 10.7991$.
  - SOPDT: $\tau_1 = \tau_1^*$, $\tau_2 = \tau_2^* + \tau_3^*/2 = 40.2003$, $\theta = \tau_3^*/2 = 5.39957$, $K = K_p$.
  - FOPDT: $\tau = \tau_1^* + \tau_2^*/2 = 52.6812$, $\theta = \tau_2^*/2 + \tau_3^* = 28.1995$, $K = K_p$.
- `imcTuning({model, tau_c, theta_sensor, Ts, include_zoh})`:
  Effective delay: $\theta_{\text{total}} = \theta_{\text{model}} + \theta_{\text{sensor}} + (\text{include\_zoh} ? T_s / 2 : 0)$.
  - `fit_sopdt` & `half_sopdt`:
    $\tau_I = \tau_1 + \tau_2$, $\tau_D = \frac{\tau_1 \cdot \tau_2}{\tau_1 + \tau_2}$, $K_c = \frac{1}{K} \frac{\tau_1 + \tau_2}{\tau_c + \theta_{\text{total}}}$.
  - `fit_fopdt_pi` & `half_fopdt_pi`:
    $\tau_I = \tau$, $\tau_D = 0$, $K_c = \frac{1}{K} \frac{\tau}{\tau_c + \theta_{\text{total}}}$.
  - `fit_fopdt_pid`:
    $\tau_I = \tau + \theta_{\text{total}}/2$, $\tau_D = \frac{\tau \cdot (\theta_{\text{total}}/2)}{\tau + \theta_{\text{total}}/2}$, $K_c = \frac{1}{K} \frac{\tau + \theta_{\text{total}}/2}{\tau_c + \theta_{\text{total}}/2}$.
- `margins({Kc, tauI, tauD, N, theta})`:
  Calculates loop transfer function $L(j\omega) = G_c(j\omega) G_p(j\omega) e^{-j\omega\theta}$ where
  $G_p(j\omega) = \frac{K_p}{(1 + j\omega\tau_G)(1 + j\omega\tau_X)(1 + j\omega\tau_I)}$,
  $G_c(j\omega) = K_c \left[1 + \frac{1}{j\omega\tau_I} + \frac{j\omega\tau_D}{1 + j\omega\tau_D/N}\right]$ (omitting integral if $\tau_I$ is null/$\infty$, omitting derivative if $\tau_D \le 0$).
  Evaluates $|L(j\omega)| = 1$ in $[10^{-5}, 10]\text{ rad/min}$ to find gain crossover frequency $\omega_c$.
  Analytic phase: $\angle L(j\omega_c) = \angle G_c(j\omega_c) + \angle G_p(j\omega_c) - \omega_c\theta$.
  $PM = 180^\circ + \angle L(j\omega_c)$.
  Gain margin $GM = 1 / |L(j\omega_{180})|$ at the first $-180^\circ$ crossing.
  $\Delta\theta_{\max} = PM[\text{rad}] / \omega_c$; $\text{total\_tolerable\_delay} = \theta + \Delta\theta_{\max}$.

### 3.3 Discrete PID & Anti-Windup (§5)
Sample instants $t_k = k \cdot T_s$.
Error: $e_k = r_k - m_k$, $y_{\text{nom}} = G_b$.
- Proportional: $P_k = K_c [\beta(r_k - y_{\text{nom}}) - (m_k - y_{\text{nom}})]$
- Derivative (on measurement):
  $\tau_f = \tau_D / N$, $\alpha = \frac{\tau_f}{\tau_f + T_s}$ (if $\tau_D = 0 \implies \alpha = 0$).
  $d_k = \alpha \cdot d_{k-1} + (1 - \alpha) \frac{m_k - m_{k-1}}{T_s}$ (with $d_0 = 0, m_{-1} = m_0$).
  $D_k = -K_c \cdot \tau_D \cdot d_k$.
- Integral & Anti-windup:
  $\text{integrate} = (\text{mode} \ne \text{'P'}) \land \neg\text{frozen}$.
  $S_{\text{trial}} = \text{integrate} ? S_{k-1} + e_k \cdot T_s : S_{k-1}$.
  $u(S) = U_{\text{basal}} + P_k + (\text{integrate} ? (K_c / \tau_I) \cdot S : 0) + D_k$.
  - **clamp:**
    $u_{\text{trial}} = u(S_{\text{trial}})$.
    If $\text{integrate} \land [(u_{\text{trial}} > U_{\max} \land K_c \cdot e_k > 0) \lor (u_{\text{trial}} < U_{\min} \land K_c \cdot e_k < 0)]$,
    then $S_k = S_{k-1}$, else $S_k = S_{\text{trial}}$.
    $u_k = u(S_k)$, $U_{\text{fb}} = \text{clip}(u_k, U_{\min}, U_{\max})$.
  - **backcalc:**
    $u_k = u(S_{\text{trial}})$, $U_{\text{fb}} = \text{clip}(u_k, U_{\min}, U_{\max})$.
    $T_t = \max(\sqrt{\tau_I \cdot \tau_D}, T_s)$ if $\tau_D > 0$, else $T_t = \tau_I$.
    $S_k = \text{integrate} ? S_{\text{trial}} + T_s \cdot \tau_I \cdot \frac{U_{\text{fb}} - u_k}{K_c \cdot T_t} : S_{\text{trial}}$.
  - **off:**
    $S_k = S_{\text{trial}}$, $U_{\text{fb}} = \text{clip}(u(S_k), U_{\min}, U_{\max})$.
  - **dropout (NaN measurement):**
    Hold previous $U_{\text{fb}}$, maintain controller states ($S_k = S_{k-1}, d_k = d_{k-1}, m_{k-1}$ unchanged).

### 3.4 Sensor Dynamics & Faults (§6)
- Lag $\tau_s$:
  If $\tau_s > 0$: 4th ODE state $\frac{dG_l}{dt} = \frac{(G + G_b) - G_l}{\tau_s}$ with $G_l(0) = G_b$.
  If $\tau_s = 0$: $G_l = G + G_b$.
- Delay $\theta_s$:
  Ring buffer of length $\text{delay\_steps} = \text{round}(\theta_s / dt)$ prefilled with $G_b$. At step $i$, push $G_l$, read value from $i - \text{delay\_steps}$.
- Faults:
  - `stuck`: for $t \ge t_{\text{fault}}$, returns the last sample reading before $t_{\text{fault}}$.
  - `drift`: adds $\text{drift\_rate} \cdot (t - t_{\text{fault}}) / 60$ for $t \ge t_{\text{fault}}$.
  - `dropout`: returns `NaN` for $t_{\text{fault}} \le t < t_{\text{fault}} + \text{dropout\_duration}$.
- Noise:
  Mulberry32 PRNG + Box-Muller Gaussian draw ($\sigma = \text{noise\_sd}$) drawn strictly once per sample instant.

### 3.5 Meals & Feedforward Bolus (§7)
- Disturbance profile: $D(t) = \sum_i A \cdot \text{mult}_i \cdot e^{-k(t - t_i)}$ for $t \ge t_i$ ($A = 9.0, k = 0.05$).
- Bolus magnitude:
  $\text{Bolus}_i = f_{\text{bolus}} \cdot K_f \cdot (1 + \text{est\_error}) \cdot A \cdot \text{mult}_i / k$ (starts at $t_i - t_{\text{pre}}$).
  If scheduled before $t = 0$, starts at $t = 0$ with a warning.
- Bolus delivery loop (each $dt$ step):
  1. Queue boluses whose start $\le t + 10^{-9}$.
  2. $\text{cap} = \max(0, U_{\max} - U_{\text{fb}})$.
  3. $U_{\text{ff}} = \min(\text{cap}, \text{remaining} / dt)$, $\text{remaining} -= U_{\text{ff}} \cdot dt$.
  4. If $\text{remaining} \le 10^{-9}$, set $\text{remaining} = 0, \text{freeze\_until} = t + dt + \text{suspend\_extra}$.
- Suspend integral:
  $\text{frozen} = \text{ff\_enabled} \land \text{suspend\_integral} \land (\text{remaining} > 10^{-9} \lor t < \text{freeze\_until})$ evaluated at sample instant before queue update.

### 3.6 RK4 Simulation Pipeline (§8)
- Time grid $t_i = i \cdot dt$, $i = 0 \dots N$, $N = \text{round}(t_{\text{end}} / dt)$, $\text{steps\_per\_sample} = \text{round}(T_s / dt)$.
- Initial conditions: $G = 0, X = 0, I = 0, G_l = G_b, U_{\text{fb}} = U_{\text{basal}}$ (or $U_{\text{open\_loop}}$ if controller = 'none'), $G_{\text{meas}} = G_b$.
- Loop order per step $i$:
  1. Determine current setpoint $sp$ and sensitivity scale for $p_3$.
  2. Check if $G + G_b \le 0 \implies$ mark invalid, record warning, abort integration.
  3. Push $G_l$ into sensor delay buffer.
  4. If $i \pmod{\text{steps\_per\_sample}} == 0$: read sensor $G_{\text{meas}}$, update PID if controller is 'pid'.
  5. Update feedforward step $U_{\text{ff}}$; $U = \text{saturation} ? \text{clip}(U_{\text{fb}} + U_{\text{ff}}, U_{\min}, U_{\max}) : U_{\text{fb}} + U_{\text{ff}}$.
  6. Evaluate $D(t)$ at RK4 stages: $t, t + dt/2, t + dt$.
  7. Log states at step $i$: $t, G_{\text{abs}}, G_{\text{meas}}, U, U_{\text{fb}}, U_{\text{ff}}, D$.
  8. If $i < N$, execute one RK4 step over $[t, t+dt]$ with $U$ and $p_3$ held constant.
- Post-simulation:
  Check if $\min(G_{\text{abs}}) < 40\text{ mg/dL} \implies$ record counter-regulation display warning.

### 3.7 Metrics Calculation (`metrics()`, §9.3)
- `peak`, `t_peak`, `nadir`, `t_nadir`.
- Time percentages calculated via trapezoid rule on the 0/1 indicator $\div (t_N - t_0) \times 100$:
  - `pct_in_band`: safety band strict ($54 < G < 144$)
  - `pct_in_70_180`: clinical band inclusive ($70 \le G \le 180$)
  - `pct_below_54`: $G < 54$
  - `pct_below_70`: $G < 70$
  - `pct_above_high`: $G > 144$
  - `pct_above_180`: $G > 180$
- `IAE`: trapezoid integration $\int |G - sp| \, dt$.
- `insulin_total`: rectangular sum $\sum_{i=0}^{N-1} U_i \cdot dt$.
- `insulin_ff`: rectangular sum $\sum_{i=0}^{N-1} U_{\text{ff}, i} \cdot dt$.
- `time_at_Umax`: sum of $dt$ where $U_i \ge U_{\max} - 10^{-9}$.
- `time_at_Umin`: sum of $dt$ where $U_i \le U_{\min} + 10^{-9}$.
- `stayed_in_band`: boolean ($\text{nadir} > \text{band.low} \land \text{peak} < \text{band.high}$).

---

## 4. Static Website UI & Presentation Architecture (`site/gemini/`)

### 4.1 Required 7 Tabs
1. **Overview:** Project background, chemical process control context (CHEE 4071), minimal model formulation, AI project exploration, and the mandatory disclaimer banner.
2. **Simulator:**
   - Preset selector (all 19 scenarios from tests and v1 §14: Default Ex. 23.6e, Open Loop, Ex. 23.6d no delay, Bolus at meal, 15-min pre-bolus, Overestimate +40%, Anti-windup demo [off/clamp/backcalc], Set-point step -20, P-only offset, PI mode, Sensor lag, Sensor faults [stuck/drift/dropout], Insulin sensitivity change, 3 Meals 24h, Suspend integral).
   - Control knobs: range sliders and dropdowns for setpoint, controller mode (P/PI/PID), $K_c$, $\tau_I$, $\tau_D$, $N$, $\beta$, anti-windup, sensor delay $\theta_s$, sensor lag $\tau_s$, sensor noise $\sigma$, faults, meal timing/size, feedforward toggle, bolus fraction, $t_{\text{pre}}$, integral suspension.
   - Live value labels on every slider.
   - Metrics summary panel with clear Pass/Fail badge for the safety band.
   - Run management: "Save Run" button allowing overlay of up to 4 simulation runs (Chart P8).
   - Plots P1 (Glucose), P2 (Insulin components), P3 (Meal disturbance).
3. **Theory:**
   - Minimal model differential equations rendered in KaTeX.
   - Dimensional analysis / units check.
   - Basal steady-state derivation ($U_{\text{basal}} = 16.668\text{ mU/min}$) and actuator asymmetry explanation.
   - Linearization, transfer functions ($G_p(s), G_d(s)$), pole-zero locations.
   - Chart P4: Analytic nonlinear steady-state gain curve vs $\Delta U \in [-16, 98]\text{ mU/min}$ with current operating point marker.
   - Chart P5: Step response comparison (Nonlinear vs 3rd-order linear vs Half-rule SOPDT vs Fitted SOPDT & FOPDT).
   - Mathematical derivation of why ideal feedforward $G_f(s) = -G_d(s)/G_p(s)$ is improper (lead-lag requirement).
   - Callouts on "Why Real Systems Are Harder" (gut absorption delay, lumped insulin kinetics, lack of counter-regulation/glucagon).
4. **Control Design:**
   - Step-by-step IMC synthesis table for all 5 model choices.
   - Interactive SVG closed-loop block diagram displaying current numerical gains, transfer functions, saturation limiter, and feedback/feedforward loops.
   - Chart P6: Frequency response Bode plot (Magnitude and Phase of $L(j\omega)$) with $\omega_c$, $\omega_{180}$, $PM$, and $GM$ annotated.
   - Chart P7: Nyquist plot of $L(j\omega)$ with critical point $(-1, 0)$ and unit circle.
   - Stability metrics card: Phase margin with and without sensor delay, $\Delta\theta_{\max}$, and empirical delay limit from `DATA.empiricalDelay`.
   - Chart P9: PID vs MPC comparison (precomputed from `DATA.mpcComparison`) with toggle for unannounced vs announced meal.
   - Chart P10: Live parameter sweep: Peak & Nadir vs $\tau_c \in [2, 60]\text{ min}$ with current $\tau_c$ marker.
   - Chart P11: Live parameter sweep: Peak & Nadir vs $t_{\text{pre}} \in [0, 45]\text{ min}$ with current $t_{\text{pre}}$ marker.
5. **AI Workflow:** Clearly labeled placeholder tab describing the multi-model architecture, prompt engineering, critique phase, and iterative validation against the independent Python reference.
6. **Video & Transcript:** Clearly labeled placeholder tab with video container and transcript viewport.
7. **References:** Comprehensive bibliography card from `DATA.sources` (Seborg, Bequette, Battelino consensus, reference implementation) and project attribution.

### 4.2 Chart Suite Specification (Charts P1–P11)
- **P1:** Glucose Trajectory $G(t)$ & $G_m(t)$, target setpoint line, and shaded green safety band ($54 \le G \le 144\text{ mg/dL}$).
- **P2:** Insulin Infusion $U(t)$ stacked/overlaid by components: Basal $U_{\text{basal}}$, Feedback $U_{\text{fb}}$, and Feedforward Bolus $U_{\text{ff}}$, with pump limits $U_{\min}=0$ and $U_{\max}=115$.
- **P3:** Disturbance Profile $D(t)$ over simulation horizon.
- **P4:** Nonlinear Steady-State Gain vs $\Delta U$ from $-16$ to $+98\text{ mU/min}$ with current operating point marked.
- **P5:** Step Response Benchmark: 5-way comparison of $\Delta U = +1\text{ mU/min}$ step across Nonlinear, Linear 3-lag, Half-rule SOPDT, Fitted SOPDT, and Fitted FOPDT.
- **P6:** Bode Diagrams: Log-magnitude (dB) and Phase (deg) vs $\omega \in [10^{-4}, 10]\text{ rad/min}$, highlighting $\omega_c$, $\omega_{180}$, $PM$, and $GM$.
- **P7:** Nyquist Contour: $\text{Re}(L(j\omega))$ vs $\text{Im}(L(j\omega))$ showing proximity to $(-1, 0)$.
- **P8:** Run History Overlay: Comparison of true glucose $G(t)$ for up to 4 saved scenarios with distinct colors and legend.
- **P9:** Precomputed PID vs MPC: Glucose and insulin profiles from `DATA.mpcComparison` for unannounced and announced meals.
- **P10:** Live Sweep: Maximum glucose peak and minimum nadir as $\tau_c$ varies from $2$ to $60\text{ min}$.
- **P11:** Live Sweep: Maximum glucose peak and minimum nadir as pre-bolus lead time $t_{\text{pre}}$ varies from $0$ to $45\text{ min}$.

### 4.3 Educational Card Standard
Every single calculated parameter or derived variable will be presented in a standardized card format:
1. **Equation:** High-quality KaTeX rendering (e.g., $K_c = \frac{1}{K}\frac{\tau_1 + \tau_2}{\tau_c + \theta}$).
2. **Units:** Explicit dimensional units (e.g., $\text{mU/min per mg/dL}$).
3. **Physical Interpretation:** Clear, one-sentence ChemE meaning (e.g., "Determines how aggressively the pump increases insulin infusion in response to a glucose deviation above setpoint").

### 4.4 Mobile and Theme Compliance
- Strict CSS viewport constraints ensuring no horizontal scrolling on 375px mobile viewports (`overflow-x: hidden`, flex/grid wrapping, responsive Plotly configurations).
- `@media (prefers-color-scheme: dark)` styling adapting backgrounds, card surfaces, text contrast, borders, and Plotly layout templates (paper/plot backgrounds, font colors, grid colors).

---

## 5. Implementation Phases & Step-by-Step Execution

### Phase 1: Environment Setup & Data Copy
1. Copy `site/js/data.js` to `site/gemini/js/data.js` verbatim without modifying a single character.
2. Verify file presence and integrity.

### Phase 2: Engine Implementation & Golden Test Verification
1. Implement `site/gemini/js/model.js` with all 8 specified exports.
2. Execute `npm test` using Node.js test runner to test `site/gemini/js/model.js` against all golden trajectories and tolerances in `tests/expected.json`:
   - Exact `DEFAULT_INPUTS` match
   - Linear model parameters & nonlinear gain points
   - Half rule SOPDT and FOPDT reductions
   - IMC tuning for all 5 model choices
   - Stability margins ($\omega_c, PM, GM, \Delta\theta_{\max}$)
   - All 25 golden closed-loop trajectories ($G, U$ tolerances)
   - Performance metrics ($IAE$, peak, nadir, time in band, insulin)
   - Seeded PRNG reproducibility test
3. Iterate and refine until 100% of test cases pass with zero tolerance violations.

### Phase 3: UI, CSS, KaTeX & Interactive SVG Development
1. Write `site/gemini/css/style.css` implementing responsive layout, CSS variables, dark/light theme tokens, and typography.
2. Write `site/gemini/index.html` structure with all 7 tabs, accessible ARIA roles, input control groups, metric readouts, card placeholders, and disclaimer banner.
3. Construct the SVG closed-loop block diagram in Tab 4 with dynamic text nodes for live parameter display.

### Phase 4: Plotly Integration & Live Visualizations (P1–P11)
1. Write `site/gemini/js/app.js`:
   - Initialize KaTeX rendering on equation cards.
   - Implement preset selection logic to load predefined scenarios.
   - Attach reactive input listeners to all range sliders and dropdowns with debounced execution.
   - Bind slider value displays so every slider visibly updates its readout.
   - Implement the "Save Run" buffer and management for overlay Chart P8.
   - Render Charts P1 through P11 using Plotly, ensuring responsive resizing via `ResizeObserver` and tab activation triggers.

### Phase 5: Verification & Browser Smoke Testing
1. Launch local static web server (`python3 -m http.server 8000 -d site`).
2. Run `node tests/browser-smoke.mjs --base http://localhost:8000 --paths /gemini/ --out docs/screenshots/verification/gemini_run`.
3. Validate all checks:
   - All 7 tabs render without console errors.
   - Zero KaTeX rendering errors.
   - All Plotly charts render SVG contents without failure.
   - Zero occurrences of `NaN`, `undefined`, or `Infinity` on any page or slider adjustment.
   - Every slider visibly mutates the page signature.
   - Mobile test at 375px reports zero horizontal overflow (`scrollWidth <= clientWidth + 1`).
   - Both light and dark color schemes function cleanly.

### Phase 6: Final Review & Delivery
1. Audit all files against the forbidden list (no drug names, no carb ratios, no invented numbers).
2. Confirm the mandatory disclaimer is prominently visible across all tabs.
3. Document all created files, verification outcomes, and assumptions.

---

## 6. Assumptions & Design Choices (Where Plan v2 is Silent)

1. **Slider Range Limits:**
   - Setpoint: 60 to 140 mg/dL (default 81)
   - $K_c$: -2.0 to -0.05 (default -0.4256)
   - $\tau_I$: 10 to 150 min (default 70.30)
   - $\tau_D$: 0 to 40 min (default 17.57)
   - Derivative filter $N$: 2 to 20 (default 10)
   - Setpoint weight $\beta$: 0 to 1 (default 1.0)
   - Sensor delay $\theta_s$: 0 to 30 min (default 10)
   - Sensor lag $\tau_s$: 0 to 15 min (default 0)
   - Sensor noise $\sigma$: 0 to 10 mg/dL (default 0)
   - Meal multiplier: 0.5 to 3.0 (default 1.0)
   - Pre-bolus time $t_{\text{pre}}$: 0 to 45 min (default 0)
   - Bolus fraction $f_{\text{bolus}}$: 0.2 to 1.5 (default 1.0)
   - Estimation error: -0.5 to +0.8 (default 0)
   - Extra integral suspension: 0 to 120 min (default 0)
2. **Frequency Search Range for Margins:**
   - Logarithmic grid of 2,000 points spanning $\omega \in [10^{-5}, 10]\text{ rad/min}$, followed by bisection to pinpoint exact $|L(j\omega)| = 1$ crossover.
3. **Plotly Theme Integration:**
   - Use `prefers-color-scheme` media query in JavaScript to toggle Plotly layout templates (light: `#ffffff` paper, `#1f2937` font, `#e5e7eb` grid; dark: `#111827` paper, `#f3f4f6` font, `#374151` grid).
4. **SVG Block Diagram Rendering:**
   - Pure inline SVG vector graphic embedded directly into Tab 4, allowing dynamic text content updates for $G_c(s)$, $G_p(s)$, $G_d(s)$, $G_f(s)$, saturation limits, and numerical gains without external image files.

---

## 7. Clarifying Questions for the User

1. **Parameter Sweeps (Charts P10 & P11):** We propose computing live sweeps with 25 evenly spaced grid points for $\tau_c \in [2, 60]\text{ min}$ and 10 points for $t_{\text{pre}} \in [0, 45]\text{ min}$. Does this grid resolution suit the desired performance balance?
2. **Precomputed MPC Comparison (Chart P9):** `DATA.mpcComparison` provides both `unannounced` and `announced` trajectories. We plan to include an interactive toggle on Chart P9 allowing the user to view unannounced meal recovery or 15-minute pre-bolus/forecasting mode. Does this match your expectation?
3. **Approval to Proceed:** Please let us know if you approve this implementation strategy or if there are any specific refinements you would like to incorporate before we proceed to coding.
