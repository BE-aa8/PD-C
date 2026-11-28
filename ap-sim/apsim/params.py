"""Single source of truth for model constants (BUILD PLAN section 2).

Every value is from Seborg, Edgar, Mellichamp & Doyle, *Process Dynamics and
Control*, 4th ed., Example 23.3 (model from Bequette, 2002), unless the
``source`` string says otherwise.
"""
from __future__ import annotations

from dataclasses import dataclass

SEBORG_EX233 = "Seborg et al., 4th ed., Example 23.3 (model: Bequette, 2002)"


@dataclass(frozen=True)
class ParamInfo:
    value: float
    units: str
    meaning: str
    source: str


PARAM_TABLE: dict[str, ParamInfo] = {
    "p1": ParamInfo(0.028735, "1/min", "Insulin-independent glucose uptake rate", SEBORG_EX233),
    "p2": ParamInfo(0.028344, "1/min", "Decay rate of remote insulin effect", SEBORG_EX233),
    # Textbook lists the units as 1/min. X has units 1/min and dX/dt = -p2 X + p3 I,
    # so dimensionally p3 must be 1/min^2 per (mU/L). Value is shown unchanged.
    "p3": ParamInfo(5.035e-5, "1/min^2 per (mU/L)  [textbook prints 1/min; see units check]",
                    "Gain from plasma insulin to remote insulin effect", SEBORG_EX233),
    "n": ParamInfo(0.0926, "1/min", "Plasma insulin clearance rate", SEBORG_EX233),
    "V1": ParamInfo(12.0, "L", "Insulin distribution volume", SEBORG_EX233),
    "G_basal": ParamInfo(81.0, "mg/dL", "Basal (fasting) glucose", SEBORG_EX233),
    "I_basal": ParamInfo(15.0, "mU/L", "Basal plasma insulin", SEBORG_EX233),
    "U_max": ParamInfo(115.0, "mU/min", "Pump maximum infusion rate", SEBORG_EX233),
    "U_min": ParamInfo(0.0, "mU/min", "Pump cannot remove insulin", SEBORG_EX233),
    "band_low": ParamInfo(54.0, "mg/dL", "Safety band lower limit", SEBORG_EX233),
    "band_high": ParamInfo(144.0, "mg/dL", "Safety band upper limit "
                           "('widened to allow less conservative control')", SEBORG_EX233),
    "meal_A": ParamInfo(9.0, "mg/dL/min", "Meal disturbance amplitude, D(t)=A exp(-k t)", SEBORG_EX233),
    "meal_k": ParamInfo(0.05, "1/min", "Meal disturbance decay rate", SEBORG_EX233),
    "Ts": ParamInfo(5.0, "min", "CGM sample period",
                    "Seborg et al., 4th ed., Sec. 23.2 (cites Harvey et al., 2010)"),
    "sensor_delay": ParamInfo(10.0, "min", "Default CGM delay", "Seborg et al., 4th ed., Exercise 23.6(e)"),
}

# Secondary clinical band (Battelino et al., 2019; citation confirmed 2026-11-27, process log Part 24).
CLINICAL_BAND = (70.0, 180.0)
CLINICAL_BAND_SOURCE = ("International consensus time-in-range 70-180 mg/dL "
                        "(Battelino et al., Diabetes Care 2019;42(8):1593-1603)")


@dataclass(frozen=True)
class Params:
    """Patient + pump parameters. Frozen/hashable so it can be part of a cache key."""
    p1: float = PARAM_TABLE["p1"].value
    p2: float = PARAM_TABLE["p2"].value
    p3: float = PARAM_TABLE["p3"].value
    n: float = PARAM_TABLE["n"].value
    V1: float = PARAM_TABLE["V1"].value
    G_basal: float = PARAM_TABLE["G_basal"].value
    I_basal: float = PARAM_TABLE["I_basal"].value
    U_max: float = PARAM_TABLE["U_max"].value
    U_min: float = PARAM_TABLE["U_min"].value

    @property
    def U_basal(self) -> float:
        """Basal pump rate from dI/dt = 0 at I = 0: U_basal = n * I_basal * V1 (Sec. 3.2)."""
        return self.n * self.I_basal * self.V1

    @property
    def upward_authority(self) -> float:
        """Max insulin rate the pump can add above basal [mU/min]."""
        return self.U_max - self.U_basal

    @property
    def downward_authority(self) -> float:
        """Max insulin rate the pump can cut below basal [mU/min]."""
        return self.U_basal - self.U_min

    @property
    def authority_ratio(self) -> float:
        """downward / upward actuator authority (Sec. 3.3); ~0.17."""
        return self.downward_authority / self.upward_authority


DEFAULT_PARAMS = Params()
BAND_TEXTBOOK = (PARAM_TABLE["band_low"].value, PARAM_TABLE["band_high"].value)


# Model-validity warning threshold [mg/dL].  NOT from a source: an agent-chosen display
# threshold.  The minimal model has no counter-regulatory response (no glucagon, no hepatic
# glucose release beyond the p1 term), so trajectories that fall this low are qualitative only.
G_VALIDITY_LOW = 40.0
