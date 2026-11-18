# Project: Closing the Loop, an artificial-pancreas control simulator

AI project for UC ChemE **Process Dynamics and Control (CHEE 4071, Prof. Carlos Co, Fall 2026)**,
textbook Seborg, Edgar, Mellichamp & Doyle, *Process Dynamics and Control*, 4th ed. **Individual project.**
An interactive static website teaching feedback/feedforward control with the glucose–insulin model of
Seborg Example 23.3 / Exercise 23.6 (an illustrative textbook patient).

Workflow copied from the separations project (`BE-aa8/seperations`), at Andrew's instruction:
"follow exactly what we did in the separations repo". See `docs/plan-gemini-workflow-claude.md`.

## Read these before planning or building
- `context/assignment.md`: the assignment and rubric, verbatim
- `context/professor-guidance.md`: what Prof. Co said about AI projects in lecture (timestamped)
- `docs/plan-v1-claude.md`: plan v1 (Claude Opus 5.5), the specification until plan v2 exists
- `docs/process-log.md`: what has been done so far; append to it after every work session
- `docs/PROJECT_STATUS.md`: audit of what is done and what remains
- `ap-sim/`: the Python implementation of plan v1. It is now the **independent reference** that
  generates `tests/expected.json`, which grades both website builds. Its own log: `ap-sim/BUILD_LOG.md`.

## Assignment requirements (summary; verbatim text in context/assignment.md)
1. Publicly accessible website demo/documentation (GitHub Pages, deployed by CI; Netlify was used first)
2. YouTube video of the presentation, linked on the site
3. Verbatim YouTube auto-generated transcript, viewable on the site
4. Overview; demo; clearly an AI project exploring AI capabilities; process (models, services, prompts); planning and iteration with my guidance and reasoning; course-related technical details; what I learned and want to learn next; attribution
5. Plan from one model → a different model critiques → justify accept/reject → implement with at least 2 different models and compare
6. Attribution/references and group member contributions (individual project: mine)

Rubric: Resourcefulness/curiosity/creativity 25% · Artifacts (plan/comparison, webapp, PowerPoint) 25% · Presentation 25% · Q&A 25%

## Rules for this repo
- Math at a 3rd/4th-year ChemE undergrad process-control level (Seborg). Do not go beyond it.
- Every calculation shows: equation, units, and a one-line physical interpretation.
- Every calculation should have a visualization, and the tool should invite "what if?" exploration.
- **Educational model of an illustrative textbook patient. Not medical advice. Not for dosing decisions.**
  The disclaimer is on every page. No drug names, carb ratios, correction factors, or dosing guidance.
- No invented data. Every parameter comes from Seborg Ex. 23.3 (see `ap-sim/apsim/params.py`) or is a
  clearly labelled user input or ESTIMATE. Cite sources on the References page; mark unverified ones [TO VERIFY].
- Stack: plain HTML/CSS/JavaScript, Plotly for charts, KaTeX for equations. Static, no backend. Mobile-friendly.
  Hosted on GitHub Pages: CI deploys `site/` from `main` after all tests pass, then tests the live site (Netlify drag-and-drop was used first).
- Always start new work in plan mode. Save plans in `docs/` with the model name in the filename
  (e.g. `docs/plan-v2-final.md`, `docs/plan-*-claude.md`).
- Append prompts, decisions, iterations, and problems to `docs/process-log.md` at the end of every session.
- Gemini's build lives only in `site/gemini/` (logs in `docs/gemini-build/`), on branch `gemini/pro`,
  produced by `.github/workflows/gemini-build.yml`. Never edit Gemini's files by hand.
- Verification: the JS model must reproduce `tests/expected.json` (from the Python reference); open the
  site in a browser and confirm every tab, equation, chart, and slider works (light and dark).
- Never fabricate test results, AI contributions, citations, transcripts, or video links.
- This repo is public. Do not commit the textbook, lecture transcripts, API keys, or anything personal.
