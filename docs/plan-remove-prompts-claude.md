# Remove prompts 14, 25 and 32 from the website (Claude)

## Context
Andrew: "remove prompts 14, 25, 32 from website." Answer to Claude's question: remove prompt 32 from **both** places
it appears (the "Key prompts" list and the quote box in timeline stage 7).

The three prompts are:
- 14: "Budget $20 send it"
- 25: the Hugging Face / Netlify credit question
- 32: the 3D pancreas request

They stay in `docs/process-log.md`, which is the full record and is unchanged. This is a website-only removal.

## Changes
- `site/js/workflow.js`:
  - delete the three entries from `PROMPTS`; 7 prompts remain;
  - set stage 7's `quote` to `null`. Its facts stay, including "Andrew overrode the notes on one point: the
    interactive 3D pancreas…".
- `site/index.html`: the line "All 35 prompts and every decision…" stays true, because the full log is linked. No
  wording change is needed.
- `tests/browser-content.mjs`:
  - lower the verbatim-quote check's minimum from 10 to 8 quotes (7 prompts plus 2 stage quotes = 9);
  - add a check that prompts 14, 25 and 32 are not on the page.
- Records: one line in process log Part 23 (prompt verbatim + the answer).

## Verification
- Content test in both themes; smoke on `/`; a11y test.
- Visual check of the AI Workflow tab: the prompt grid stays balanced with 7 items, and stage 7 shows no quote box.
- Commit, push, fast-forward `main`, and wait for the CI deploy and live tests.
