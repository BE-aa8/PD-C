"""Headless smoke tests of the Streamlit UI (app.py) using streamlit.testing."""
import pathlib

import pytest

st_testing = pytest.importorskip("streamlit.testing.v1")
from apsim.presets import SCENARIOS  # noqa: E402

APP = str(pathlib.Path(__file__).resolve().parents[1] / "app.py")


def _at(preset):
    at = st_testing.AppTest.from_file(APP, default_timeout=120)
    at.run()
    at.sidebar.selectbox[0].set_value(preset).run()
    return at


@pytest.mark.parametrize("preset", list(SCENARIOS))
def test_every_preset_renders(preset):
    at = _at(preset)
    assert not at.exception


@pytest.mark.parametrize("preset", ["MPC, unannounced meal (stretch)", "Open loop (basal only)"])
def test_no_pid_margins_for_non_pid_controller(preset):
    """B1: the stability tab must not show PID margins when PID is not the active controller."""
    at = _at(preset)
    assert any("computed for the PID loop only" in i.value for i in at.info)
    assert not any("Run empirical delay sweep" in b.label for b in at.button)


def test_pid_preset_shows_margins():
    at = _at("IMC-PID with 10-min sensor delay (Ex. 23.6e)")
    assert any("Run empirical delay sweep" in b.label for b in at.button)
