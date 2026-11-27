# Add Andrew's conclusions and reflections to the website (Claude)

## Context
Andrew sent his own text for the two "To be written by Andrew" boxes on the AI Workflow tab. His answers:
- fix three typos only ("uI" → "UI", "effects" → "affects", "project and endeavors" → "projects and endeavors"); every
  other word stays as written;
- paragraph 1 also fills the empty "My conclusions" section of `docs/comparison.md`.

## Changes
- **`site/index.html`, AI Workflow → "In Andrew's words":** replace the two placeholder boxes with his text.
  - Box 1 "My conclusions on the comparison" = paragraph 1.
  - Box 2 "What I learned, and what I want to learn next" = paragraph 2.
  - Each box ends with "— Andrew"; the "To be written by Andrew" tags and guiding questions are removed.
  - Style: a quote-like card (accent left border, as used for prompts), no orange placeholder look.
- **`docs/comparison.md` §7 "My conclusions":** replace the blank/guiding questions with paragraph 1 (same text),
  attributed to Andrew and dated.
- **`tests/browser-content.mjs`:**
  - the "conclusions are placeholders" check becomes "Andrew's sections show his text verbatim";
  - the comparison box text must equal paragraph 1 in `docs/comparison.md`, so the two copies can't drift;
  - no "To be written" tag is left on the page.
- **Records:** process log Part 25, with his message verbatim (including the original typos) and the decisions;
  plan saved as `docs/plan-andrew-conclusions-claude.md`.

## Text (as it will appear)
1. After comparison, I chose to ship mostly Anthropic made content. I found that Claude had better design and overall
   building skills. Something that surprised me while making the website was how good ChatGPT is at making moodboards
   and planning for UI and UX implementations. I found it much better than Claude and Gemini. If I were to rebuild a
   website, I would use GitHub Pages with a Gemini API key implementation, similar to what I did in Process Dynamics
   and Controls. This does cost you (I spent around $5 for both Separations and PD&C), but it is definitely worth it
   for hands free integration!
2. Something I learned about process control over these past few weeks has been how recycle affects processes. I liked
   working with AI and expanding my knowledge on building websites. In the future, I would like to further my
   understanding of LLMs and use GitHub Pages and Claude to build a homepage for all of my projects and endeavors.

## Verification
- Content test in both themes; a11y test; smoke on `/`.
- Screenshot of the section at 1280 and 375 px in both themes.
- Commit, push, fast-forward `main`, and wait for the CI deploy and live tests.
