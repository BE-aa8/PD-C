# Clear every [TO VERIFY] flag from the website (Claude)

## Context
Andrew: "now I want to completely finish the website. get rid of all of the to verify and red tags. ask me questions
and we can clear things up and push".

The site shows 8 open [TO VERIFY] flags, plus two history rows that mention TO VERIFY. Each is resolved from one of two
sources: Andrew's textbook check, or a citation Claude confirmed online.

**Andrew's answers:**
- **Seborg Ch. 14 margins:** "Book confirms it". Keep PM ≥ 30°, GM ≥ 1.7 and drop the flag.
- **Bequette:** "Secondary citation". It reads "model from Bequette (2002), as cited in Seborg Example 23.3".
- **τc guideline:** "Keep only τc = θ". Cite Skogestad (2003) and drop the 0.8θ (Rivera) claim.
- **β-cells (Seborg Ch. 23) and the Table 12.1 rows:** "Book confirms both". Keep the text and drop the flags.
- **The two "To be written by Andrew" boxes and the video placeholder:** keep as placeholders. They are Andrew's
  content, not unverified claims.
- **History rows:** "Reword on the site". The docs keep their original wording.

**Confirmed online by Claude** (sources: PubMed/PMC, the authors' NTNU pages):
- Battelino T, et al. *Clinical Targets for Continuous Glucose Monitoring Data Interpretation: Recommendations From
  the International Consensus on Time in Range.* Diabetes Care 2019;42(8):1593–1603. doi:10.2337/dci19-0028.
- Skogestad S. *Simple analytic rules for model reduction and PID controller tuning.* J. Process Control
  2003;13:291–309.

## Changes
- **`site/index.html`, References:**
  - remove the lead sentence about [TO VERIFY];
  - Seborg entry: "…Ch. 14 stability-margin ranges (PM ≥ 30°, GM ≥ 1.7)", no flag;
  - Bequette entry: the secondary citation;
  - τc entry: Skogestad (2003) full citation, SIMC τc = θ; the Rivera/0.8θ text is removed;
  - β-cell entry: "Seborg et al., Ch. 23", no flag.
- **`site/js/app.js`:**
  - Control Design guideline caption: SIMC τc = θ (Skogestad, 2003) only;
  - margin-strip note and comment: no flag;
  - IMC card: "Row numbers in Table 12.1." with no flag;
  - islet note: "[Seborg et al., Ch. 23]";
  - metrics row "Time in 70–180": "(Battelino et al., 2019)" replaces "source marked to verify";
  - on the AI tab, row 25 shows "Accept (checked later against the textbook; resolved)", and the decision summary
    category matches it.
- **Battelino source string:** `site/js/data.js` is generated, so it is never edited by hand.
  - Change it in `tools/build_data.py` and regenerate with `npm run data`. CI's drift check then still passes.
  - `site/gemini/js/data.js` is Gemini's frozen copy and stays untouched. Before changing anything, check that no
    test requires the two copies to be identical; if one does, keep the old string in `data.js` and override only
    the displayed reference text.
- **`site/js/workflow.js`:** the comparison row label becomes "Unverified-source flags" (values kept: "kept" /
  "removed").
- Remove the now-unused `.tv` style.
- **`tests/browser-content.mjs`:**
  - replace "References keep the [TO VERIFY] flags" with "no [TO VERIFY] text anywhere on the site" (all 7 tabs,
    including closed disclosures);
  - adjust the decision-table check for the row-25 display wording; every other row must still match
    `docs/critique-decisions.md` exactly.
- **Records:**
  - process log Part 24, with Andrew's answers verbatim and the two online confirmations with their sources;
  - `docs/critique-decisions.md` is unchanged (history), with a dated note added that row 25 was resolved;
  - plan saved as `docs/plan-clear-to-verify-claude.md`.

## Verification
- `npm test` (65); data drift check: `npm run data` then `git diff` shows only the Battelino string.
- Smoke test on `/`, `/?theme=light` and `/gemini/`; content test in both themes; a11y test.
- grep: no "TO VERIFY" in `site/` outside `site/gemini/`.
- Commit, push, fast-forward `main`, and wait for the CI deploy and live tests.
