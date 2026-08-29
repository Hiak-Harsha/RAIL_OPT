"""
Unified Operational Objective Function for RAILOPT-X (PS 25022).

This is the SINGLE authoritative objective function used by:
  - CP-SAT solver (via ObjectiveEvaluator.to_unified_j() bridge)
  - CandidateEvaluator (physical branch simulation scoring)
  - Benchmark runner (strategy comparison)
  - AI Decision Review (displayed to controller)
  - What-If Lab (scenario branch scoring)

All components MUST use compute_J() to produce comparable scores.

Objective:
  J = (total_delay * delay_w * priority_w)
    + (max_delay * peak_delay_w)
    + (conflicts * conflict_penalty)
    + (travel_time * travel_time_w)
    - (throughput * throughput_w)

Horizon Note:
  - DECISION_HORIZON_SEC (900s): short window for real-time dispatch decisions.
    Conflicts and delay terms dominate to resolve immediate block contentions.
  - PERFORMANCE_HORIZON_SEC (14400s): full timetable window for KPI benchmarking
    where network-wide delay and throughput are compared across dispatch methods.

Safety Gate:
  Unsafe candidates receive J = 99999.0 and are ineligible for selection.
"""
from __future__ import annotations
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel


class ObjectiveProfile(str, Enum):
    """Pre-configured objective weight profiles for different operational priorities."""
    BALANCED = "BALANCED"
    PUNCTUALITY = "PUNCTUALITY"
    THROUGHPUT = "THROUGHPUT"


class ObjectiveWeights(BaseModel):
    """Explicit, tunable multi-objective weights for the railway cost function.

    All weights must be non-negative.
    throughput_weight is a benefit multiplier that rewards higher throughput.
    """
    delay_weight: float = 1.0
    travel_time_weight: float = 0.3
    throughput_weight: float = 0.0     # default 0.0 in BALANCED; active in THROUGHPUT profile
    peak_delay_weight: float = 0.5
    conflict_penalty: float = 50.0
    priority_multiplier: float = 1.0   # Applied to delay term per train priority

    @classmethod
    def from_profile(cls, profile: ObjectiveProfile) -> "ObjectiveWeights":
        if profile == ObjectiveProfile.PUNCTUALITY:
            return cls(
                delay_weight=2.0,
                travel_time_weight=0.2,
                throughput_weight=0.0,
                peak_delay_weight=1.0,
                conflict_penalty=50.0,
            )
        elif profile == ObjectiveProfile.THROUGHPUT:
            return cls(
                delay_weight=0.5,
                travel_time_weight=0.5,
                throughput_weight=2.0,
                peak_delay_weight=0.3,
                conflict_penalty=50.0,
            )
        else:  # BALANCED
            return cls()


# Singleton default weights (used when no profile is specified)
DEFAULT_WEIGHTS = ObjectiveWeights()

# Decision horizon: short window used for real-time dispatch decisions (seconds)
DECISION_HORIZON_SEC = 900.0

# Performance horizon: full timetable window used for KPI and benchmark evaluation (seconds)
PERFORMANCE_HORIZON_SEC = 14400.0

# Safety sentinel: returned when safety invariants are violated
INFEASIBLE_J = 99999.0


def compute_J(
    total_delay_min: float,
    max_delay_min: float,
    conflicts_count: int,
    total_travel_time_min: float = 0.0,
    throughput_trains_hr: float = 0.0,
    priority_weight: float = 1.0,
    safety_valid: bool = True,
    weights: Optional[ObjectiveWeights] = None,
) -> float:
    """
    Unified multi-objective cost function J.

    Lower J = better schedule.

    J = (total_delay * delay_w * priority_w)
      + (max_delay * peak_delay_w)
      + (conflicts * conflict_penalty)
      + (travel_time * travel_time_w)
      - (throughput * throughput_w)

    Hard Safety Gate: Unsafe candidates receive J = INFEASIBLE_J and cannot be selected.
    """
    if not safety_valid:
        return INFEASIBLE_J

    w = weights or DEFAULT_WEIGHTS

    score = (
        (total_delay_min * w.delay_weight * priority_weight)
        + (max_delay_min * w.peak_delay_weight)
        + (conflicts_count * w.conflict_penalty)
        + (total_travel_time_min * w.travel_time_weight)
        - (throughput_trains_hr * w.throughput_weight)
    )
    return round(max(0.0, score), 2)


# ---------------------------------------------------------------------------
# Pipeline Contract Types
# ---------------------------------------------------------------------------

class EvidenceFact(BaseModel):
    """A machine-checkable XAI fact associated with a decision evaluation."""
    fact_id: str
    fact_type: str          # PRIORITY_ADVANTAGE, CONFLICT_REDUCED, DELAY_REDUCED, etc.
    description: str
    before_value: Optional[float] = None
    after_value: Optional[float] = None
    unit: str = ""
    entity_ids: List[str] = []     # railway entity IDs relevant to this fact


class DecisionEvaluation(BaseModel):
    """
    Unified output contract of the AI decision pipeline.

    Produced by: CandidateEvaluator (physical branch simulation)
    Consumed by: AIDecisionReviewCenter, RecommendationDrawer, AuditLogger
    """
    candidate_id: str
    action_type: str
    description: str

    # Unified objective score (compute_J result)
    objective_j: float
    baseline_j: float
    j_improvement: float

    # Physical metrics (from branch simulation)
    total_delay_min: float
    max_delay_min: float
    conflicts_count: int
    throughput_trains_hr: float
    travel_time_min: float

    # Safety
    safety_valid: bool
    safety_violations: List[str] = []

    # Provenance
    solver_name: str = "OR-Tools_CP-SAT"
    solver_status: str = "FEASIBLE"
    priority_weight: float = 1.0

    # XAI evidence
    evidence_facts: List[EvidenceFact] = []
