# PD-C
pdnc with PROFESSOR Co

## AI Project: Closing the Loop, an artificial-pancreas control simulator

> **Educational process-control model of an illustrative textbook patient. Not medical advice. Not for dosing decisions.**

Interactive website on feedback and feedforward control of blood glucose, using the glucose–insulin
model of Seborg et al., *Process Dynamics and Control*, 4th ed., Example 23.3 / Exercise 23.6.
Built as the individual AI project for Process Dynamics and Control (CHEE 4071, Fall 2026, University of Cincinnati).

| Folder / file | What's in it |
|---|---|
| `CLAUDE.md` | Project rules and requirements, loaded automatically by Claude Code |
| `context/assignment.md` | AI project assignment and rubric (verbatim) |
| `context/professor-guidance.md` | Timestamped notes on what Prof. Co said about AI projects in lecture |
| `docs/plan-v1-claude.md` | Plan v1 (Claude Opus 5.5) |
| `docs/process-log.md` | Running log of prompts, decisions, and iterations (required for grading) |
| `docs/PROJECT_STATUS.md` | Audit: what is done, what remains |
| `ap-sim/` | Python implementation of plan v1 (98 tests); the independent reference for the website builds |
| `.github/workflows/` | CI (`ci.yml`) and the Gemini build workflow (`gemini-build.yml`) |
