# Plan: remaining deliverables (documentation, website content, presentation, YouTube, checklist)

**Author:** Claude Code (Opus 5.5) · **Date:** 2026-11-18 · **Status: DRAFT, awaiting Andrew's approval**

Covers Parts 4–7 of Andrew's completion directive. It runs **in parallel** with Claude's website build (a separate
session on branch `claude/site-build`). Everything here lives in `docs/`, which the build prompt tells the build session not
to read, so it can't affect the comparison. Nothing is fabricated: every number comes from a repo file or a run record, and
anything that needs Andrew (the video, the transcript, bills, personal reflections) is a clearly marked placeholder.

## 1. Documents (in `docs/`)

| File | Content | Sources | Depends on |
|---|---|---|---|
| `AI_DEVELOPMENT_HISTORY.md` | A dated timeline of every AI step: plan v1 (Claude), the Python build, the audit, the Gemini critique (web app), Andrew's 26 decisions, plan v2, the Gemini plan and build (Actions), the Claude build (fresh session), the comparison. For each step: model, service, prompt (verbatim or linked), output, and **Andrew's decision and reasoning**. Ends with "what changed because of human guidance". | `process-log.md`, `critique-decisions.md`, `docs/gemini-build/`, git history | — (start now; finish after the comparison) |
| `REFERENCES.md` | Textbook (with exact sections), Bequette 2002, Bergman 1979, Skogestad 2003, Battelino 2019, ADA 2014, Doyle III 2014, tools and libraries (Plotly, KaTeX, NumPy/SciPy, Gemini CLI, Claude Code, GitHub Actions, Netlify), AI model attribution. Unverified items stay **[TO VERIFY]**, and Andrew checks them against the book and library access. | plan v2, `data.js` sources | — |
| `CONTRIBUTIONS.md` | Individual project: Andrew's contributions (decisions, prompts, approvals, deployment, the presentation) vs each AI model's contributions, in a table. No invented contributions. | process log | — |
| `comparison.md` | Claude vs Gemini, same structure as separations: what was held equal, results table (tests, smoke test, time, tokens, cost, follow-up prompts, code size, UI differences), differences investigated and explained, Gemini's critique slips and catches. **"My conclusions" is Andrew's section.** | CI runs, run logs, both builds | Claude build done |
| `PRESENTATION_OUTLINE.md` | The 13 sections from the directive, with time per section, slide titles, and the on-screen demo for each. | all of the above | comparison |
| `PRESENTATION_SCRIPT.md` | A spoken script that follows the outline, at an undergrad PD&C level, ending in Q&A prep (likely questions with short answers: units check, why Kc < 0, why the pre-bolus works, the Ts/2 and β decisions, the stability margins). Marked as a **script**, never as the transcript. | outline | outline |
| `YOUTUBE_KIT.md` | A recording checklist and the demo sequence (preset by preset, what to point at), plus the **AI-critique prompt** for the practice run. Per the directive, the prompt includes the public site URL, the original project context, and the professor's requirements. Placeholders for the video link, the practice transcript, and the AI critique. | script | site URL |
| `FINAL_SUBMISSION_CHECKLIST.md` | Each item from `context/assignment.md` (verbatim), plus the directive's YouTube-comment items. Status per item: ✅ done / 👤 needs Andrew / ⏳ blocked until recording. | all | — (start now, keep updated) |

## 2. Website content (after both builds are verified)

Following separations, the deployed site is **Claude's build at `/`** with **Gemini's build at `/gemini/`**, and both stay
unchanged as the compared artefacts. The four content tabs in the root site get filled in **after** the comparison, in a
clearly separate commit ("content, not part of the build comparison"):

- **Overview:** what it is, why, the process-control concepts it teaches, and a link to the Gemini build.
- **AI Workflow:** a condensed `AI_DEVELOPMENT_HISTORY.md`, the critique decision table, the comparison table, and links to the raw records.
- **Video & Transcript:** the YouTube embed and the **verbatim auto-generated transcript**. Placeholder until Andrew records.
- **References:** `REFERENCES.md` + `CONTRIBUTIONS.md`.

Then: zip `site/` → Andrew drags it onto Netlify → Claude runs the browser smoke test against the live URL (as in separations).

## 3. Order

1. Now: `AI_DEVELOPMENT_HISTORY.md` (up to today), `REFERENCES.md`, `CONTRIBUTIONS.md`, `FINAL_SUBMISSION_CHECKLIST.md`.
2. When the Claude build is done: verify it (npm test, smoke test on CI) → `comparison.md` → Andrew writes "My conclusions".
3. Merge `claude/site-build` and `gemini/pro` → fill in the content tabs → Netlify → live tests.
4. `PRESENTATION_OUTLINE.md` → `PRESENTATION_SCRIPT.md` → `YOUTUBE_KIT.md`.
5. After recording: transcript onto the site, YouTube comments, final checklist pass.

## 4. Questions for Andrew

1. **Presentation date and length** (minutes)? This sets the script length and the schedule.
2. **The YouTube-comments requirement** ("copy the practice transcript and AI critique into the YouTube comments") is not in
   `context/assignment.md`. Is it from a later announcement? If you have the exact wording, I'll copy it verbatim into
   `context/` so the checklist cites it. My reading of it: record a practice run → take its YouTube auto-transcript → have an AI
   critique it (the prompt includes the site URL, the project context, and the requirements) → post the practice transcript and the
   critique as comments on the final video. Correct?
3. **PowerPoint:** the rubric lists "Powerpoint" under artifacts. Do you want a slide deck (I can make one), or will you build it from the outline yourself?
