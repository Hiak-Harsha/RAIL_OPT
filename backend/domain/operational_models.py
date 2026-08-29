"""
Domain models for RAILOPT-X Operational Digital Twin 2.0.

These are the foundational shared models consumed by ALL layers:
  - NX Track Canvas
  - Traffic Theater
  - Teleprinter / Timeline
  - Audit Log & Replay
  - AI Decision Review
  - What-If / Future Worlds

Single source of operational truth — all rendering layers consume OperationalSnapshot.
"""
from __future__ import annotations
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Operational Event System
# ---------------------------------------------------------------------------

class OperationalEventType(str, Enum):
    """All events that can flow through the RAILOPT-X event pipeline."""
    # Train lifecycle
    TRAIN_SCHEDULED       = "TRAIN_SCHEDULED"
    TRAIN_READY_TO_DEPART = "TRAIN_READY_TO_DEPART"
    TRAIN_DEPARTED        = "TRAIN_DEPARTED"
    TRAIN_ACCELERATING    = "TRAIN_ACCELERATING"
    TRAIN_CRUISING        = "TRAIN_CRUISING"
    TRAIN_BRAKING         = "TRAIN_BRAKING"
    TRAIN_APPROACHING_STATION = "TRAIN_APPROACHING_STATION"
    TRAIN_DWELLING        = "TRAIN_DWELLING"
    TRAIN_DEPARTED_STATION = "TRAIN_DEPARTED_STATION"
    TRAIN_WAITING_SIGNAL  = "TRAIN_WAITING_SIGNAL"
    TRAIN_WAITING_HEADWAY = "TRAIN_WAITING_HEADWAY"
    TRAIN_ARRIVED         = "TRAIN_ARRIVED"
    TRAIN_DISRUPTED       = "TRAIN_DISRUPTED"

    # Block lifecycle
    BLOCK_RESERVED        = "BLOCK_RESERVED"
    BLOCK_OCCUPIED        = "BLOCK_OCCUPIED"
    BLOCK_RELEASED        = "BLOCK_RELEASED"
    BLOCK_BLOCKED         = "BLOCK_BLOCKED"

    # Signal lifecycle
    SIGNAL_GREEN          = "SIGNAL_GREEN"
    SIGNAL_DOUBLE_YELLOW  = "SIGNAL_DOUBLE_YELLOW"
    SIGNAL_YELLOW         = "SIGNAL_YELLOW"
    SIGNAL_RED            = "SIGNAL_RED"
    SIGNAL_FAILURE        = "SIGNAL_FAILURE"

    # Platform
    PLATFORM_OCCUPIED     = "PLATFORM_OCCUPIED"
    PLATFORM_CLEARED      = "PLATFORM_CLEARED"
    PLATFORM_REASSIGNED   = "PLATFORM_REASSIGNED"

    # AI pipeline
    CONFLICT_PREDICTED    = "CONFLICT_PREDICTED"
    CONFLICT_RESOLVED     = "CONFLICT_RESOLVED"
    OPTIMIZATION_STARTED  = "OPTIMIZATION_STARTED"
    OPTIMIZATION_COMPLETE = "OPTIMIZATION_COMPLETE"
    PLAN_GENERATED        = "PLAN_GENERATED"
    PLAN_SELECTED         = "PLAN_SELECTED"
    DECISION_APPROVED     = "DECISION_APPROVED"
    DECISION_REJECTED     = "DECISION_REJECTED"
    OUTCOME_VERIFIED      = "OUTCOME_VERIFIED"

    # Disruptions
    DISRUPTION_INJECTED   = "DISRUPTION_INJECTED"
    DISRUPTION_CLEARED    = "DISRUPTION_CLEARED"

    # System
    SIM_STARTED           = "SIM_STARTED"
    SIM_PAUSED            = "SIM_PAUSED"
    SIM_RESET             = "SIM_RESET"
    SIM_JUMPED            = "SIM_JUMPED"


class OperationalEvent(BaseModel):
    """
    Unified event model for RAILOPT-X Digital Twin 2.0.

    Every significant state change in the railway produces an OperationalEvent.
    All visualization layers (NX, Teleprinter, Timeline, Audit, Replay) consume
    the same OperationalEvent stream.
    """
    event_id: str
    timestamp_sec: float
    event_type: OperationalEventType
    entity_ids: List[str] = Field(default_factory=list)   # train_ids, block_ids, signal_ids
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    reason: str = ""
    source: str = "SIMULATION_ENGINE"   # ENGINE, OPTIMIZER, CONTROLLER, RADAR
    metadata: Dict[str, Any] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Operational Snapshot — single source of operational truth
# ---------------------------------------------------------------------------

class OperationalSnapshot(BaseModel):
    """
    Complete operational state of the railway at a point in time.

    Every rendering layer MUST derive its display from this snapshot.
    No layer may independently compute metrics that are available here.
    """
    timestamp_sec: float
    is_running: bool = False

    # Physical infrastructure state
    trains: List[Dict[str, Any]] = Field(default_factory=list)
    blocks: List[Dict[str, Any]] = Field(default_factory=list)
    signals: List[Dict[str, Any]] = Field(default_factory=list)
    platforms: List[Dict[str, Any]] = Field(default_factory=list)
    stations: List[Dict[str, Any]] = Field(default_factory=list)

    # Operational state
    conflicts: List[Dict[str, Any]] = Field(default_factory=list)
    disruptions: List[Dict[str, Any]] = Field(default_factory=list)
    active_recommendations: List[Dict[str, Any]] = Field(default_factory=list)

    # KPIs
    kpis: Dict[str, Any] = Field(default_factory=dict)

    # Recent events (last N events for teleprinter / timeline)
    recent_events: List[OperationalEvent] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Scenario Branch — unified concept for What-If, Future Worlds, Candidate Eval
# ---------------------------------------------------------------------------

class ScenarioBranch(BaseModel):
    """
    A scenario branch represents a divergent railway future.

    Used uniformly by:
      - What-If Lab (user-injected disruptions)
      - Future Worlds (AI-generated candidate plans)
      - Candidate Evaluator (physical branch simulation)
      - Decision Review (display of evaluated alternatives)

    Replaces the previously separate concepts of:
      ScenarioOutcome, CounterfactualOption, CandidateSchedule result
    """
    branch_id: str
    branch_name: str
    description: str

    # What triggered this branch
    interventions: List[Dict[str, Any]] = Field(default_factory=list)

    # Physical simulation results
    evaluation: Optional[Dict[str, Any]] = None

    # Core metrics (from compute_J pipeline)
    objective_j: float = 0.0
    total_delay_min: float = 0.0
    max_delay_min: float = 0.0
    conflicts_count: int = 0
    throughput_trains_hr: float = 0.0
    track_utilization_pct: float = 0.0
    punctuality_pct: float = 0.0
    recovery_time_min: float = 0.0
    safety_valid: bool = True
    safety_violations: List[str] = Field(default_factory=list)

    # Provenance
    solver_name: str = "PHYSICAL_BRANCH_SIMULATION"
    is_selected: bool = False

    # XAI
    evidence_facts: List[Dict[str, Any]] = Field(default_factory=list)
