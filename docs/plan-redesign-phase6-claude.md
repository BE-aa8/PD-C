# Redesign Phase 6: AI Workflow, Video & Transcript, References (Claude)

## Context
Andrew: "start phase 6". The last three tabs are still placeholders. They carry assignment items 2–6 (YouTube video and
verbatim transcript; the process: models, services, prompts, planning and iteration with Andrew's guidance and reasoning;
plan → critique → accept/reject → two builds → compare; attribution and contributions). ChatGPT's brief §5–7 sets the
look: a timeline, a presentation-style video page, and grouped references.

Andrew's answers:
- **Video:** not recorded yet, so the tab gets a labelled placeholder stage.
- **Credit:** "Andrew".
- **Reflections and "My conclusions":** placeholders for Andrew to write. Claude writes no opinions for him.
- **Models:** the Gemini web-app critique was **Gemini 3.5 Flash**; the ChatGPT redesign brief was "just the basic
  model", shown as *ChatGPT (default model; version not recorded)*.

Rule for all three tabs: **only facts from `docs/process-log.md`, `docs/critique-decisions.md`, `docs/comparison.md`
and `docs/gemini-build/`, and prompts quoted verbatim.** Nothing about the video or transcript is invented.

Presentation only: `model.js`, `data.js` and `site/gemini/**` stay untouched, and the ids `#ref-list` and
`#lib-warning` stay. On approval, save this plan as `docs/plan-redesign-phase6-claude.md`, build, then stop for review.

## AI Workflow tab
1. **Intro:** one paragraph on how AI was used in a structured process (plan → independent critique → human decisions →
   two independent builds → tests and comparison → selection), plus a "models and services" strip:
   - Claude Opus 5.5 (Claude Code, cloud sessions)
   - Gemini 3.5 Flash (Gemini web app, critique)
   - Gemini CLI 0.68.0 on GitHub Actions with an AI Studio key: requested gemini-3.5-flash, Google served gemini-3.8-flash
   - ChatGPT (default model, redesign brief)
   - GitHub Actions and GitHub Pages
2. **Timeline:** the brief's 6 stages plus a 7th for the redesign. Horizontal on desktop with a selectable stage
   rail, vertical on phones. Each stage shows:
   - who did it (model and service), what came out, and the key facts with numbers;
   - Andrew's decision as a verbatim quote;
   - links to the evidence files on GitHub.

   The stages:
   1. *Claude, initial plan:* plan v1. Its origin conversation isn't in the repo, so the site says so.
   2. *Gemini, critique:* 11 findings plus answers to Q1–Q7. Two real bugs (β set-point weighting; back-calculation Tt
      guard), one overstated claim, two arithmetic slips.
   3. *Andrew, decisions:* 26 rows, all approved ("approve all, go with your recommendations"); plan v2 pins the
      numerics; the shared tests are written before either build.
   4. *Two independent builds:* Claude about 27 min; Gemini 16 min 19 s and 73 tool calls. Same prompt, same tests.
   5. *Tests and comparison:* both 33/33 and 0 smoke failures. Gemini's P9 had no data; equation counts 51 vs 9.
   6. *Selection:* "I like Claude version better, lets move forward with only its version currently."; Gemini frozen
      at `/gemini/`.
   7. *Redesign:* a third model (ChatGPT) wrote the UI/UX brief and visual-reference notes; Claude implemented it in
      phases. The 3D pancreas request was Andrew's.
3. **Decision table:** all 26 critique rows (Gemini's suggestion, severity, decision, short reasoning) in a disclosure,
   with a summary count by decision type. The data is copied from `docs/critique-decisions.md` into a small
   `site/js/workflow.js`.
4. **Comparison highlights:** a compact table of selected rows from `docs/comparison.md`. Each row cites its source and
   links to the full document.
5. **Key prompts:** 8–10 short prompts from the process log, quoted verbatim with their part numbers.
6. **Frozen Gemini build:** a clearly labelled card linking to `https://be-aa8.github.io/PD-C/gemini/`.
7. **Placeholders for Andrew:** "My conclusions on the comparison" and "What I learned / what I want to learn next",
   with the guiding questions, styled as visible "to be written by Andrew" boxes.

## Video & Transcript tab
- A 16:9 stage. Without a video it shows a designed placeholder: "Presentation video: added after recording".
- Beside it: the title, a short description, and details (course, textbook example, source: YouTube auto-generated
  transcript).
- The transcript sits in a collapsible reader with readable typography. It is empty and labelled until it's pasted
  verbatim.
- **One-edit update:** `site/js/video.js` exports `{ youtubeId: null, transcript: '' }`. With an id set, the page shows
  a click-to-play poster and loads the `youtube-nocookie.com` embed only on click (keeps the page light). The
  transcript keeps its line breaks.

## References tab
The brief's five groups, in one citation style, with every [TO VERIFY] kept:
- **Textbook and theoretical sources:**
  - Seborg et al. 4th ed.: Ex. 23.3, Exer. 23.6, Sec. 23.2, Table 12.1, Ch. 14 margin ranges [TO VERIFY]
  - Bequette 2002, the model source as cited by Seborg
  - Skogestad 2003 and Rivera et al. 1986, the τc guidelines [TO VERIFY]
  - Battelino 2019 [TO VERIFY]
- **Model and parameter sources:** the existing `#ref-list` from `DATA.sources`, plus the parameter-table pointer.
- **Computational tools:**
  - site libraries: Plotly 2.35.2, KaTeX 0.16.11, three.js 0.170.0; Inter and Manrope (SIL OFL);
  - 3D anatomy: BodyParts3D (CC BY-SA 2.1 JP, full citation);
  - tooling: the Python reference (NumPy/SciPy), Playwright tests, GitHub Actions and Pages.
- **AI contributions:** a table of each model, what it produced, and where the record is.
- **Project contributions:** Andrew (direction, every approval and decision, prompts, budget, hosting choice, the
  pancreas request, the presentation) vs the AI models. Each item points to the process log.

## Files
- `site/index.html`: the three panels (keep `#ref-list` and the eyebrows).
- New `site/js/workflow.js`: stages, decisions, comparison rows and prompts as data, transcribed from the docs.
- New `site/js/video.js`: the video config.
- `site/js/app.js`: `buildWorkflow()`, `buildVideo()`, `renderRefs()` (extended).
- `site/css/style.css`: timeline, decision table, prompt quotes, placeholder boxes, video stage and transcript reader,
  reference list styles.
- **`tests/browser-content.mjs`:**
  - the timeline has 7 stages, and selecting each shows its details;
  - every evidence link points to a file that exists in the repo (checked with `fs`), so no link is made up;
  - the decision table has 26 rows, all approved, matching `docs/critique-decisions.md` row count and decisions;
  - the Gemini link is `/gemini/`;
  - the video tab shows the placeholder when `youtubeId` is null, and the transcript reader toggles;
  - `#ref-list` has one item per `DATA.sources` entry, and the [TO VERIFY] flags are still present;
  - the phone timeline is vertical, with no sideways scroll.
- Records: plan doc, process log Part 21, comparison note.

## Verification
- `npm test`; smoke on `/`, `/?theme=light` and `/gemini/` in both device schemes; content test in both themes;
  extended check.
- Screenshots of the three tabs at 1280, 1024, 768 and 375 px in both themes, reviewed.
- Then commit, push, fast-forward `main`, and wait for the CI deploy and live tests.
