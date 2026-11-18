"""Offline tests of tools/gemini_run.py (the Gemini API call is mocked; no key, no network)."""
import importlib.util
import json
import pathlib

import pytest

_p = pathlib.Path(__file__).resolve().parents[1] / "tools" / "gemini_run.py"
spec = importlib.util.spec_from_file_location("gemini_run", _p)
gr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gr)


def test_extract_files_and_last_block_wins():
    text = ("intro\n=== FILE: gemini-impl/a.py ===\nx = 1\n=== END FILE ===\n"
            "=== FILE: gemini-impl/b.py ===\ny = 2\n\n=== END FILE ===\n"
            "=== FILE: gemini-impl/a.py ===\nx = 3\n=== END FILE ===\n=== PART 1 OF 3 ===\n")
    f = gr.extract_files(text)
    assert f == {"gemini-impl/a.py": "x = 3\n", "gemini-impl/b.py": "y = 2\n\n"}


@pytest.mark.parametrize("bad", ["/etc/passwd", "../x.py", "gemini-impl/../../x.py"])
def test_safe_target_rejects_escape(tmp_path, bad):
    with pytest.raises(ValueError):
        gr.safe_target(tmp_path, bad)


def test_response_text_skips_thoughts():
    resp = {"candidates": [{"content": {"parts": [{"text": "hidden", "thought": True},
                                                   {"text": "visible"}]}, "finishReason": "STOP"}]}
    assert gr.response_text(resp) == ("visible", "STOP")


def test_attachments_are_appended_verbatim():
    t = gr.build_user_text("PROMPT", [("PLAN.md", "line1\nline2\n")])
    assert t.startswith("PROMPT\n\n=== ATTACHED FILE: PLAN.md ===\nline1\nline2\n=== END ATTACHED FILE: PLAN.md ===")


def test_full_turn_records_without_key(tmp_path, monkeypatch):
    monkeypatch.setattr(gr, "RECORDS", tmp_path)
    monkeypatch.setenv("GEMINI_API_KEY", "SECRET-KEY-123")
    sent = {}

    def fake_post(model, payload, timeout):
        sent["payload"] = payload
        return {"candidates": [{"content": {"parts": [{"text": "### G-01: ok"}]}, "finishReason": "STOP"}],
                "modelVersion": "fake-model-001", "usageMetadata": {"totalTokenCount": 10}}
    monkeypatch.setattr(gr, "_post", fake_post)
    gr.main(["new", "--session", "s", "--model", "fake-model",
             "--prompt", "ai/prompts/01_gemini_plan_critique.md", "--attach", "docs/PLAN_v1_claude.md"])
    gr.main(["send", "--session", "s", "--message", "Expand G-01"])
    d = tmp_path / "s"
    meta = json.loads((d / "session.json").read_text())
    assert [t["turn"] for t in meta["turns"]] == [1, 2]
    assert meta["turns"][0]["model_version_reported"] == "fake-model-001"
    assert (d / "turn_01_model.md").read_text() == "### G-01: ok"
    assert "BUILD PLAN" in (d / "turn_01_user.md").read_text()
    assert len(sent["payload"]["contents"]) == 3          # user, model, user
    for f in d.iterdir():
        assert "SECRET-KEY-123" not in f.read_text()
