# Closing the Loop — artificial-pancreas control simulator

> **Educational process-control model of an illustrative textbook patient. Not medical advice. Not for dosing decisions.**

CHEE 4071 Process Dynamics and Controls (UC, Fall 2026) term project.
The patient is the glucose–insulin model of Seborg et al., *Process Dynamics and Control*, 4th ed.,
**Example 23.3** (model from Bequette, 2002). A sampled digital controller reads a delayed CGM every 5 min
and sets an insulin pump rate (0–115 mU/min). A meal is the disturbance. The app follows
**Exercise 23.6 (a)–(e)**: linearization → transfer functions → reduced-order model fit → IMC-PID tuning →
closed-loop response → stability margins and maximum tolerable delay. It also adds feedforward
(meal announcement / pre-bolus), anti-windup, sensor faults, and a linear MPC (stretch).

## Run locally
```bash
cd ap-sim
pip install -r requirements.txt
python -m pytest -q          # validation suite (must pass)
streamlit run app.py
```

## Deploy (Streamlit Community Cloud)
share.streamlit.io → *New app* → this repository / branch → main file `ap-sim/app.py`.

## Layout
| path | contents |
|---|---|
| `apsim/params.py` | every constant, with units and source (single source of truth) |
| `apsim/patient.py` | nonlinear ODEs (Seborg Eqs. 23-16 to 23-18) |
| `apsim/linearize.py` | A/B/C, Gp(s), Gd(s), nonlinear-gain curve |
| `apsim/reduce.py` | Skogestad half rule, LSQ FOPDT/SOPDT fits, effective dead time |
| `apsim/tuning.py`, `apsim/design.py` | IMC rules (Seborg Table 12.1), ZN / Cohen–Coon comparison |
| `apsim/controller.py` | discrete PID: derivative on measurement, filter, clamp / back-calculation anti-windup |
| `apsim/sensor.py`, `pump.py`, `disturbance.py`, `feedforward.py` | CGM, actuator, meals, bolus / lead-lag FF |
| `apsim/simulate.py` | fixed-step RK4 engine with documented event order |
| `apsim/metrics.py`, `stability.py` | time in range, IAE…, Bode/Nyquist margins, delay sweep |
| `apsim/presets.py` | named scenarios |
| `apsim/mpc.py` | linear MPC (stretch) |
| `app.py` | thin Streamlit UI (the only file importing Streamlit) |
| `BUILD_LOG.md` | every decision and deviation from the plan, with numbers |
| `NOTES_FOR_ANDREW.md` | open questions the agent could not resolve |

## Sources
See the *About / Sources* tab. The main source is Seborg et al., 4th ed., Ch. 8, 12, 15, 16, 23
(Example 23.3, Exercises 23.6–23.7). Clinical references are marked *[TO VERIFY]* where noted.
