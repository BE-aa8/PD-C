# Notes for Andrew — open questions the agent could not resolve

1. **Seborg Table 12.1 not checked against the PDF.** No textbook PDF is in the repo. The IMC
   formulas in `apsim/tuning.py` were typed from the plan and from memory of the table
   (Case I SOPDT→PID, Case G FOPDT→PI, Case H FOPDT→PID). Please confirm against the book.
   The same goes for the τc guideline: the default τc = θ_total is Skogestad's SIMC choice.
   Confirm the page in Seborg Ch. 12 where it is discussed before citing it.
2. **Ts/2 in θ_total: which one do you want as the default?** §5.3 says include it. The
   reference numbers in §6 and §13 were computed without it. The default is currently
   *include* (§5.3), and the app has a toggle. See BUILD_LOG Phase 3 for the table.
3. **Meal time.** Presets use a meal at t = 60 min so that pre-boluses fit inside the run.
   If you want the meal at t = 0 (as in the textbook figure), the pre-bolus presets need a
   negative start time. Not implemented. Tell me if you want that.
4. **"Overestimated meal (+40%)" preset**: with a 15-min pre-bolus it does NOT break the
   54 mg/dL limit (nadir ≈ 58). It does go below 70. Decide which framing you want.
5. **Ex. 23.6(d) result**: IMC-PID with τc = 20 and no sensor delay peaks at 151 mg/dL, so it
   does **not** stay in the 54–144 band. Check this against your own hand solution / the
   solutions manual. The exercise may intend a different τc.
6. **Exercise 23.7 transfer functions (Phase 8)** were read from extracted text by the planner
   and still need visual confirmation from the PDF. Not built yet.
7. **Streamlit Cloud deployment** has to be done from your GitHub/Streamlit account
   (share.streamlit.io → New app → this repo, branch, `ap-sim/app.py`). The agent cannot do it.
8. Citations still marked [TO VERIFY]: Bergman 1979, Skogestad 2003, Battelino 2019, and the
   full Bequette 2002 reference from Seborg's reference list.
