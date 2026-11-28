# Closing the Loop: an artificial-pancreas control simulator

> **Educational process-control model of an illustrative textbook patient. Not medical advice. Not for dosing decisions.**

This is an interactive website about feedback and feedforward control of blood glucose. It uses the glucose–insulin
model of Seborg, Edgar, Mellichamp & Doyle, *Process Dynamics and Control*, 4th ed., Example 23.3 / Exercise 23.6. It
was built as Andrew's individual AI project for CHEE 4071 Process Dynamics and Control (Prof. Co, Fall 2026, University
of Cincinnati).

| | |
|---|---|
| **Live site** | https://be-aa8.github.io/PD-C/ |
| **Presentation video** | https://www.youtube.com/watch?v=SKINf0_tK18 (transcript on the site's Video & Transcript tab) |
| **Slides** | [`site/slides/closing-the-loop-slides.pdf`](site/slides/closing-the-loop-slides.pdf) · [`.pptx`](site/slides/closing-the-loop-slides.pptx) |
| **Gemini's build (frozen, for comparison)** | https://be-aa8.github.io/PD-C/gemini/ |
| **Status and requirement checklist** | [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md) |

## The AI workflow in one paragraph
1. Claude Opus 5.5 wrote the plan ([`docs/plan-v1-claude.md`](docs/plan-v1-claude.md)).
2. Gemini 3.5 Flash critiqued it ([`docs/critique-v1-gemini.md`](docs/critique-v1-gemini.md)).
3. Andrew decided all 26 points ([`docs/critique-decisions.md`](docs/critique-decisions.md)), which became plan v2
   ([`docs/plan-v2-final.md`](docs/plan-v2-final.md)).
4. Claude (Claude Code) and Gemini (Gemini CLI on GitHub Actions) each built the website from the same prompt
   ([`docs/build-prompt.md`](docs/build-prompt.md)).
5. Both builds were graded by the same tests, generated from an independent Python reference.
6. Results are in [`docs/comparison.md`](docs/comparison.md); Andrew chose Claude's build.
7. ChatGPT later wrote a redesign brief, and Claude implemented it.

Every prompt, decision and iteration is in [`docs/process-log.md`](docs/process-log.md).

## Repository map
| Path | What's in it |
|---|---|
| `site/` | The website: plain HTML/CSS/JS, Plotly, KaTeX, three.js; deployed to GitHub Pages |
| `site/js/model.js` | Simulation engine (nonlinear model, discrete PID, anti-windup, feedforward, sensor, margins) |
| `site/js/data.js` | Values computed offline by the Python reference (generated; don't edit by hand) |
| `site/gemini/` | Gemini's build, kept unchanged |
| `ap-sim/` | Python reference implementation (NumPy/SciPy, 100 tests); generates the expected test values. `ap-sim/app.py` is the original Streamlit app, not deployed. |
| `tests/` | `expected.json` (from the reference), `model.test.mjs` (engine), and browser content, smoke and accessibility tests (Playwright) |
| `tools/` | Generators: `build_data.py`, `build_expected.py`, `build_slides.py`, `build_pancreas_mesh.mjs`, `compare-builds.mjs` |
| `docs/` | Plans (each named after its model), the critique and decisions, the comparison, the process log, the Gemini build logs, the status |
| `context/` | The assignment text and notes on Prof. Co's guidance |
| `CLAUDE.md` | Project rules, loaded automatically by Claude Code |

## Run and test locally
```bash
python3 -m http.server 8000 -d site                 # open http://localhost:8000
npm test                                            # JS engine vs tests/expected.json
python3 tools/build_data.py --check                 # data.js matches the Python reference
python3 tools/build_expected.py --check             # expected.json matches the Python reference
(cd ap-sim && python3 -m pytest -q)                 # Python reference
node tests/browser-content.mjs --base http://localhost:8000   # needs Playwright and Chromium
node tests/browser-a11y.mjs   --base http://localhost:8000
```
CI (`.github/workflows/ci.yml`) runs all of these, deploys `site/` from `main`, and then tests the live site.

## Credits
- **Model:** Seborg et al., 4th ed., Ex. 23.3 (model from Bequette, 2002).
- **3D anatomy:** BodyParts3D, © The Database Center for Life Science, CC BY-SA 2.1 JP.
- **Software:** Plotly.js, KaTeX, three.js; Inter and Manrope fonts (SIL OFL).

Full references are on the site's References tab.
