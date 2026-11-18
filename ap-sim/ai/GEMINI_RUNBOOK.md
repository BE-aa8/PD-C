# Gemini runbook (for Andrew)

You run every Gemini step yourself, on your own machine, with your own Google AI Studio key.
`tools/gemini_run.py` sends the prompts and saves a verbatim record of every exchange, so the
multi-model work is documented and reproducible.

## 0. One-time setup
```bash
git clone https://github.com/BE-aa8/PD-C.git && cd PD-C
git checkout claude/pancreas-control-simulator-w1e3tl
cd ap-sim
export GEMINI_API_KEY="paste-your-AI-Studio-key-here"     # Windows PowerShell: $env:GEMINI_API_KEY="..."
python tools/gemini_run.py models                          # lists model IDs your key can use
```
- Never paste the key into a chat or a file in the repo. The script reads it from the environment
  only and never writes it anywhere (a test checks this).
- Pick the most capable Gemini model in the list and **use the same model ID for both sessions**.
  The ID requested and the version Google reports are saved in `session.json`.

## 1. Critique (prompt 01)
1. Read `ai/prompts/01_gemini_plan_critique.md` and edit it if you want. Your edits are part of
   your contribution, so keep them in git.
2. Run:
   ```bash
   python tools/gemini_run.py new --session critique --model <MODEL_ID> \
     --prompt ai/prompts/01_gemini_plan_critique.md --attach docs/PLAN_v1_claude.md
   ```
3. Read `ai/gemini/critique/turn_01_model.md`. Optional follow-ups (also recorded):
   ```bash
   python tools/gemini_run.py send --session critique --message "For G-04, show the derivation."
   ```
4. Commit `ai/gemini/critique/` and push. Then tell Claude it is there. Claude will draft
   `AI_MODEL_CRITIQUE.md` with one row per G-item, **leaving Decision and Reasoning for you**.

## 2. Your decisions
For each G-item, decide Accept / Reject / Modify and write one or two sentences of reasoning.
Then fill in the "Student decisions" block in `ai/prompts/02_gemini_implementation.md`.

## 3. Independent implementation (prompt 02)
1. Create your own branch so Gemini's code is separately identifiable:
   ```bash
   git checkout -b gemini-implementation
   ```
2. Start the session. Do **not** attach anything from `apsim/` or `BUILD_LOG.md`: the builds
   must be independent.
   ```bash
   python tools/gemini_run.py new --session implementation --model <MODEL_ID> \
     --prompt ai/prompts/02_gemini_implementation.md \
     --attach docs/PLAN_v1_claude.md --attach ai/COMPARISON_INTERFACE.md
   ```
3. Loop until Gemini writes `=== IMPLEMENTATION COMPLETE ===`:
   ```bash
   python tools/gemini_run.py send --session implementation --message "Continue with the next part."
   ```
4. Write the files to disk (the paths begin with `gemini-impl/`, so `--out ..` puts the folder at the repo root):
   ```bash
   python tools/gemini_run.py extract --session implementation --out .. --dry-run   # preview
   python tools/gemini_run.py extract --session implementation --out ..
   ```
5. Run Gemini's tests and send the **real** output back, so Gemini fixes its own code:
   ```bash
   cd ../gemini-impl && python -m pytest -q > ../ap-sim/pytest_gemini.txt 2>&1; cd ../ap-sim
   python tools/gemini_run.py send --session implementation --message-file pytest_gemini.txt
   python tools/gemini_run.py extract --session implementation --out ..
   ```
   Repeat until the tests pass, or until you decide to stop. Record how many rounds it took; that
   number is part of the "development efficiency" comparison.
6. Commit `gemini-impl/` and `ai/gemini/implementation/` on `gemini-implementation` and push.
   Commits made by you show your involvement.

## Rules that keep the comparison honest
- Don't hand-fix Gemini's code. If you must, commit the fix separately with a message saying so.
- Don't show Gemini the Claude code or Claude's results until the comparison is done.
- Keep every turn, including failed or bad ones. The record is the evidence.
