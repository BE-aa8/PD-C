# Project status: Closing the Loop

**Status as of 2026-11-28: complete and deployed.** This file replaces the first audit, dated 2026-11-18. That audit was
written before the critique, the second build and the deployment existed. It is kept unchanged in
[`audit-2026-11-18-claude.md`](audit-2026-11-18-claude.md). How this status was established is in
[`plan-final-audit-claude.md`](plan-final-audit-claude.md) and process log Part 28.

- **Live site:** https://be-aa8.github.io/PD-C/. It is deployed by CI from `main` after every test passes, and the live
  site is then tested again.
- **Video:** https://www.youtube.com/watch?v=SKINf0_tK18 (recorded 2026-11-28).
- **Source:** https://github.com/BE-aa8/PD-C (public).

> Educational process-control model of an illustrative textbook patient. Not medical advice. Not for dosing decisions.

Key: ✅ complete · 👤 needs Andrew (outside the repository)

## 1. Assignment requirements (`context/assignment.md`)

| # | Requirement | Status | Where |
|---|---|---|---|
| 1 | Publicly accessible website demo and documentation | ✅ | GitHub Pages, 7 tabs; CI tests the live site after each deploy |
| 2 | YouTube video of the presentation, linked on the site | ✅ | Video & Transcript tab: embedded player and a "Watch on YouTube" link |
| 3 | Verbatim YouTube auto-generated transcript, viewable on the site | ✅ | Same tab: 175 timestamped lines, word for word (process log Part 27 explains how this was checked) |
| 4a | Overview; demo of what was created | ✅ | Overview tab; Simulator, Theory and Control Design tabs; video |
| 4b | Clearly an AI project exploring AI capabilities | ✅ | Overview "How it was built"; AI Workflow tab; `docs/comparison.md` |
| 4c | Process: models, services, prompts | ✅ | AI Workflow tab (models, 7-stage timeline, key prompts); References §04; `docs/process-log.md` (all 48 prompts) |
| 4d | Planning and iteration, with Andrew's guidance and reasoning | ✅ | AI Workflow timeline and decision table; `docs/critique-decisions.md`; `docs/plan-*.md` |
| 4e | Key technical details from the course | ✅ | Theory and Control Design tabs (every equation with units and meaning); Overview "Course concepts" |
| 4f | What was learned and what to learn next | ✅ | AI Workflow tab, "In Andrew's words" (his own text); slide 17; video at 12:13 |
| 4g | Attribution and references | ✅ | References tab; `docs/comparison.md` |
| 5a | Plan from one model, critique by a different model | ✅ | `docs/plan-v1-claude.md` (Claude Opus 5.5) → `docs/critique-v1-gemini.md` (Gemini 3.5 Flash) |
| 5b | Justify each accept or reject decision | ✅ | `docs/critique-decisions.md`: 26 rows, each with its reasoning, all approved by Andrew |
| 5c | Implement with at least 2 different AI models and compare | ✅ | Claude build at the site root; Gemini build frozen at `/gemini/`; `docs/comparison.md`; AI Workflow comparison table |
| 6 | Attribution, and what each group member contributed | ✅ | References §05 (individual project: Andrew's role and each model's role) |
| R | Rubric artefacts: plan and comparison, web app, PowerPoint | ✅ | Plans and comparison in `docs/`; the site; the 18-slide deck on the Video tab (PDF and PPTX downloads) |
| P | Chat history and prompts (syllabus AI policy) | ✅ | `docs/process-log.md`, Parts 1–28, prompts 1–48. Part 1 notes that the conversation that produced plan v1 is not in the repository. |

## 2. Verification (2026-11-28, final audit)

| Check | Result |
|---|---|
| `npm test`: JS engine vs `tests/expected.json` | 65/65 pass |
| `pytest`: Python reference (`ap-sim/`) | 100/100 pass |
| `data.js` and `expected.json` regenerate identically from the reference | pass |
| Content test (`tests/browser-content.mjs`), light and dark | 86/86 pass |
| Accessibility (axe-core 4.10.2), 7 tabs, desktop and phone, light and dark, also with slow fonts | 0 violations at any severity |
| Smoke test | 7 tabs, 9 sliders, 0 failures |
| Full click-through sweep (every visible control on every tab, desktop and phone, both themes) | no page errors, no failed requests, no broken images, no KaTeX errors, no unlabelled controls, no horizontal overflow |
| Independent engineering re-derivation (scipy, written from the model and spec, not from the site code) | 31/31 quantities agree; see §3 |
| CI on `main`, including the live-site tests | green |

## 3. Engineering: verified vs assumed

**Verified independently.** Each quantity was re-derived with a different method and agrees with the site.
- Basal insulin U_b = nI_bV₁ = 16.668 mU/min.
- Gains and lags:
  - process gain K_p = −G_b p₃/(p₁p₂nV₁) = −4.5063 (mg/dL)/(mU/min);
  - disturbance gain K_d = 34.80 min;
  - feedforward gain K_f = −K_d/K_p = 7.7227;
  - lags of 34.80, 35.28 and 10.80 min;
  - authority ratio 0.1695.
- Bolus = 1390.09 mU.
- Open-loop meal peak 166.15 mg/dL at about 26 min; nonlinear gain −4.2688 at ΔU = +1.
- IMC tuning:
  - an independent least-squares SOPDT fit gives K = −4.271, τ₁ = τ₂ = 35.15 min, θ = 8.66 min;
  - these give K_c = −0.4256, τ_I = 70.30 min, τ_D = 17.57 min.
- Margins:
  - phase margin 74.0° without the sensor delay and 58.6° with it;
  - gain margin 23.06 and 3.47;
  - maximum tolerable delay 48.1 min.
- Closed-loop runs, simulated with LSODA and a separately written discrete PID; all agree within 0.1%:
  - feedback only 163.4 / 49.4 mg/dL;
  - bolus at the meal 138.9 / 48.6;
  - 15-min pre-bolus 107.9 / 62.2;
  - windup nadirs 39.1 (anti-windup off) / 45.0 (clamping) / 43.3 (back-calculation).

**Taken from the textbook.** These were checked by Andrew in the book; the repository can't verify them on its own.
- Parameter values: Seborg Ex. 23.3.
- The 54–144 mg/dL band.
- The 10-min sensor delay: Exer. 23.6(e).
- Ts = 5 min: Sec. 23.2.
- The Table 12.1 IMC rows.
- The Ch. 14 margin ranges: PM ≥ 30°, GM ≥ 1.7.
- The β-cell sentence: Ch. 23.

**Documented project choices (not from a source):**
- the 40 mg/dL model-validity display threshold;
- the MPC weights;
- τc = 20 min for the presets;
- Ts/2 excluded from θ by default (Andrew's decision).

**Documented model note:** the textbook prints p₃ in 1/min. Dimensional consistency needs 1/min² per (mU/L); the value
is unchanged (Theory tab, card 02).

## 4. Still needs Andrew (outside the repository)

1. **Submit on Canvas** (or wherever the course collects it): the live-site URL, the YouTube URL and the repository URL.
2. **The in-class presentation and the technical Q&A** (25% + 25% of the rubric).
3. **Optional:** Prof. Co suggested (lecture 9) transcribing a practice run and asking an AI for presentation tips. It
   is a tip, not an assignment requirement, and has not been done.
4. **Book-only facts** (§3, "Taken from the textbook"): be ready to show the textbook page if asked. Andrew has already
   checked them against the book.

## 5. Known limitations (stated on the site)

- Minimal model: the meal appears in the blood instantly, insulin absorption is lumped, and there is no glucagon.
  Results below about 40 mg/dL are qualitative.
- Stability margins are continuous-time estimates. The sampled loop tolerates less delay: 43.4 min against 48.1 min.
- MPC is shown as precomputed Python results; it is not run in the browser.
- The live 3D viewer falls back to still images on browsers without hardware graphics (by design; see process log
  Part 19).
- `ap-sim/app.py` is the original Streamlit app from before the static-site workflow. It isn't deployed, and it still
  lists one unverified secondary reference (Bergman et al., 1979) that the website doesn't use.
