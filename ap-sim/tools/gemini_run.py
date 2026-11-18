#!/usr/bin/env python3
"""Run Gemini (Google AI Studio API key) and keep a verbatim, auditable record of every turn.

Andrew runs this on his own machine with his own key. Nothing here stores the key.

    export GEMINI_API_KEY=...            # from Google AI Studio (never commit it)
    python tools/gemini_run.py models                     # list model IDs the key can use
    python tools/gemini_run.py new  --session critique --model <MODEL_ID> \
        --prompt ai/prompts/01_gemini_plan_critique.md --attach docs/PLAN_v1_claude.md
    python tools/gemini_run.py send --session critique --message "Please expand G-03."
    python tools/gemini_run.py send --session implementation --message-file pytest_output.txt
    python tools/gemini_run.py extract --session implementation --out ..   # write file blocks

Records go to ai/gemini/<session>/:
    turn_NN_user.md       exact text sent (prompt + attachments)
    turn_NN_model.md      exact text returned (visible answer only; "thought" parts excluded)
    turn_NN_raw.json      the raw API response (it contains no key)
    history.json          conversation state, re-sent on each turn (Gemini API is stateless)
    session.json          model id, reported modelVersion, timestamps, token usage, SHA-256 hashes

Only the Python standard library is used. The key is sent in the x-goog-api-key header,
never in a URL, so it cannot leak into logged URLs or error messages.
"""
from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

API = "https://generativelanguage.googleapis.com/v1beta"
ROOT = pathlib.Path(__file__).resolve().parents[1]          # ap-sim/
RECORDS = ROOT / "ai" / "gemini"

FILE_BLOCK = re.compile(r"^=== FILE: (?P<path>[^\n=]+?) ===\n(?P<body>.*?)^=== END FILE ===$",
                        re.M | re.S)


# ----------------------------------------------------------------------------- helpers
def _now() -> str:
    return _dt.datetime.now(_dt.timezone.utc).isoformat(timespec="seconds")


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _key() -> str:
    k = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not k:
        sys.exit("Set GEMINI_API_KEY (a Google AI Studio key) in your environment first.")
    return k


def build_user_text(prompt_text: str, attachments: list[tuple[str, str]]) -> str:
    """Prompt followed by each attachment under an explicit header (exactly what is sent)."""
    parts = [prompt_text.rstrip()]
    for name, body in attachments:
        parts.append(f"\n\n=== ATTACHED FILE: {name} ===\n{body.rstrip()}\n=== END ATTACHED FILE: {name} ===")
    return "".join(parts) + "\n"


def build_payload(history: list[dict], temperature: float | None) -> dict:
    payload: dict = {"contents": list(history)}   # snapshot: later appends must not alter it
    if temperature is not None:
        payload["generationConfig"] = {"temperature": temperature}
    return payload


def response_text(resp: dict) -> tuple[str, str | None]:
    """Visible answer text of the first candidate (thought parts excluded) and finishReason."""
    cands = resp.get("candidates") or []
    if not cands:
        return "", None
    c = cands[0]
    parts = (c.get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    return text, c.get("finishReason")


def extract_files(text: str) -> dict[str, str]:
    """Parse '=== FILE: path === ... === END FILE ===' blocks. Later blocks win."""
    files: dict[str, str] = {}
    for m in FILE_BLOCK.finditer(text):
        files[m.group("path").strip()] = m.group("body")
    return files


def safe_target(out_dir: pathlib.Path, rel: str) -> pathlib.Path:
    """Refuse absolute paths or '..' so a reply cannot write outside out_dir."""
    p = pathlib.PurePosixPath(rel)
    if p.is_absolute() or ".." in p.parts:
        raise ValueError(f"unsafe path in model output: {rel!r}")
    return out_dir.joinpath(*p.parts)


def _post(model: str, payload: dict, timeout: float) -> dict:
    req = urllib.request.Request(f"{API}/models/{model}:generateContent",
                                 data=json.dumps(payload).encode("utf-8"), method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": _key()})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        sys.exit(f"Gemini API error {e.code}: {e.read().decode('utf-8', 'replace')[:2000]}")


# ----------------------------------------------------------------------------- session I/O
class Session:
    def __init__(self, name: str):
        self.dir = RECORDS / name
        self.meta_path = self.dir / "session.json"
        self.hist_path = self.dir / "history.json"

    def exists(self) -> bool:
        return self.meta_path.exists()

    def load(self):
        return (json.loads(self.meta_path.read_text()), json.loads(self.hist_path.read_text()))

    def save(self, meta, history):
        self.dir.mkdir(parents=True, exist_ok=True)
        self.meta_path.write_text(json.dumps(meta, indent=2) + "\n")
        self.hist_path.write_text(json.dumps(history, indent=2) + "\n")


def _turn(sess: Session, meta: dict, history: list, user_text: str, args) -> None:
    n = len(meta["turns"]) + 1
    history.append({"role": "user", "parts": [{"text": user_text}]})
    payload = build_payload(history, args.temperature)
    sess.dir.mkdir(parents=True, exist_ok=True)
    (sess.dir / f"turn_{n:02d}_user.md").write_text(user_text)
    if args.dry_run:
        print(f"[dry run] would send turn {n}: {len(user_text)} chars, {len(history)} messages in history")
        return
    sent = _now()
    resp = _post(meta["model"], payload, args.timeout)
    text, finish = response_text(resp)
    (sess.dir / f"turn_{n:02d}_raw.json").write_text(json.dumps(resp, indent=2) + "\n")
    (sess.dir / f"turn_{n:02d}_model.md").write_text(text)
    history.append({"role": "model", "parts": [{"text": text}]})
    meta["turns"].append({
        "turn": n, "sent_utc": sent, "received_utc": _now(),
        "model_requested": meta["model"], "model_version_reported": resp.get("modelVersion"),
        "finish_reason": finish, "usage": resp.get("usageMetadata"),
        "user_sha256": _sha(user_text), "model_sha256": _sha(text),
        "temperature": args.temperature,
    })
    sess.save(meta, history)
    print(f"turn {n}: {len(text)} chars returned, finishReason={finish}, "
          f"modelVersion={resp.get('modelVersion')}")
    out = sess.dir / f"turn_{n:02d}_model.md"
    print(f"saved to {out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}")
    if finish not in (None, "STOP"):
        print(f"WARNING: finishReason={finish}; the reply may be truncated. Ask Gemini to continue.")


# ----------------------------------------------------------------------------- commands
def cmd_models(args):
    req = urllib.request.Request(f"{API}/models?pageSize=200", headers={"x-goog-api-key": _key()})
    with urllib.request.urlopen(req, timeout=args.timeout) as r:
        data = json.loads(r.read().decode("utf-8"))
    for m in data.get("models", []):
        if "generateContent" in m.get("supportedGenerationMethods", []):
            print(m["name"].removeprefix("models/"), "-", m.get("displayName", ""))


def cmd_new(args):
    sess = Session(args.session)
    if sess.exists() and not args.dry_run:
        sys.exit(f"session '{args.session}' already exists; use 'send' to continue it")
    prompt = (ROOT / args.prompt).read_text()
    atts = [(pathlib.Path(a).name, (ROOT / a).read_text()) for a in args.attach]
    meta = {"session": args.session, "model": args.model, "created_utc": _now(),
            "prompt_file": args.prompt, "prompt_sha256": _sha(prompt),
            "attachments": [{"file": a, "sha256": _sha((ROOT / a).read_text())} for a in args.attach],
            "turns": []}
    _turn(sess, meta, [], build_user_text(prompt, atts), args)


def cmd_send(args):
    sess = Session(args.session)
    if not sess.exists():
        sys.exit(f"no session '{args.session}'; start it with 'new'")
    meta, history = sess.load()
    if args.message_file:
        msg = (pathlib.Path(args.message_file)).read_text()
    elif args.message:
        msg = args.message
    else:
        sys.exit("give --message or --message-file")
    atts = [(pathlib.Path(a).name, (ROOT / a).read_text()) for a in args.attach]
    _turn(sess, meta, history, build_user_text(msg, atts), args)


def cmd_extract(args):
    sess = Session(args.session)
    _, history = sess.load()
    files: dict[str, str] = {}
    for msg in history:
        if msg["role"] == "model":
            files.update(extract_files("".join(p.get("text", "") for p in msg["parts"])))
    out = (ROOT / args.out).resolve()
    for rel, body in sorted(files.items()):
        target = safe_target(out, rel)
        if args.dry_run:
            print(f"[dry run] {target}  ({len(body)} chars)")
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body)
        print(f"wrote {target}")
    print(f"{len(files)} file(s) from session '{args.session}'")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--timeout", type=float, default=600.0)
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("models")
    for name in ("new", "send"):
        p = sub.add_parser(name)
        p.add_argument("--session", required=True)
        p.add_argument("--attach", action="append", default=[], help="file path relative to ap-sim/")
        p.add_argument("--temperature", type=float, default=None)
        p.add_argument("--dry-run", action="store_true")
        if name == "new":
            p.add_argument("--model", required=True)
            p.add_argument("--prompt", required=True, help="prompt file relative to ap-sim/")
        else:
            p.add_argument("--message")
            p.add_argument("--message-file")
    p = sub.add_parser("extract")
    p.add_argument("--session", required=True)
    p.add_argument("--out", required=True, help="directory (relative to ap-sim/) to write files into")
    p.add_argument("--dry-run", action="store_true")
    args = ap.parse_args(argv)
    {"models": cmd_models, "new": cmd_new, "send": cmd_send, "extract": cmd_extract}[args.cmd](args)


if __name__ == "__main__":
    main()
