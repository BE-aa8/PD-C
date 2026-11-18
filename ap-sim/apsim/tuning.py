"""IMC (direct synthesis) PID tuning rules, Seborg et al. Table 12.1.

  SOPDT K e^{-theta s}/((tau1 s+1)(tau2 s+1)) -> PID:
      Kc = (tau1+tau2)/[K (tau_c+theta)],  tauI = tau1+tau2,  tauD = tau1 tau2/(tau1+tau2)
  FOPDT K e^{-theta s}/(tau s+1) -> PI:
      Kc = tau/[K (tau_c+theta)],  tauI = tau
  FOPDT -> PID (1/1 Pade of the delay):
      Kc = (tau+theta/2)/[K (tau_c+theta/2)],  tauI = tau+theta/2,  tauD = tau theta/(2 tau+theta)

Default tau_c = theta_total (Skogestad's SIMC guideline, as discussed in Seborg Ch. 12)
[TO VERIFY page reference against the textbook].

Sign: K < 0 -> Kc < 0.  With e = r - m, high glucose gives e < 0, Kc e > 0 -> more insulin.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

from .reduce import FOPDT, SOPDT


@dataclass(frozen=True)
class PIDTuning:
    Kc: float
    tauI: float
    tauD: float
    rule: str
    tau_c: float
    theta: float


def imc_sopdt_pid(m: SOPDT, tau_c: float, theta: float | None = None) -> PIDTuning:
    th = m.theta if theta is None else theta
    s = m.tau1 + m.tau2
    return PIDTuning(s / (m.K * (tau_c + th)), s, m.tau1 * m.tau2 / s, "IMC SOPDT->PID", tau_c, th)


def imc_fopdt_pi(m: FOPDT, tau_c: float, theta: float | None = None) -> PIDTuning:
    th = m.theta if theta is None else theta
    return PIDTuning(m.tau / (m.K * (tau_c + th)), m.tau, 0.0, "IMC FOPDT->PI", tau_c, th)


def imc_fopdt_pid(m: FOPDT, tau_c: float, theta: float | None = None) -> PIDTuning:
    th = m.theta if theta is None else theta
    return PIDTuning((m.tau + th / 2) / (m.K * (tau_c + th / 2)), m.tau + th / 2,
                     m.tau * th / (2 * m.tau + th), "IMC FOPDT->PID", tau_c, th)


# ---- "aggressive classical rules" (comparison only, stretch) ----------------------
def ziegler_nichols_reaction_curve_pid(m: FOPDT, theta: float | None = None) -> PIDTuning:
    """Ziegler-Nichols open-loop (reaction-curve) PID: Kc = 1.2 tau/(K theta),
    tauI = 2 theta, tauD = 0.5 theta.  Aggressive classical rule (~quarter decay)."""
    th = m.theta if theta is None else theta
    return PIDTuning(1.2 * m.tau / (m.K * th), 2 * th, 0.5 * th, "Ziegler-Nichols (reaction curve)",
                     math.nan, th)


def cohen_coon_pid(m: FOPDT, theta: float | None = None) -> PIDTuning:
    """Cohen-Coon PID.  Aggressive classical rule."""
    th = m.theta if theta is None else theta
    r = th / m.tau
    Kc = (1 / m.K) * (1 / r) * (4 / 3 + r / 4)
    tauI = th * (32 + 6 * r) / (13 + 8 * r)
    tauD = th * 4 / (11 + 2 * r)
    return PIDTuning(Kc, tauI, tauD, "Cohen-Coon", math.nan, th)
