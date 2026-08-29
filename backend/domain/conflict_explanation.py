"""
Conflict Explanation & Resolution Tradeoff Domain Model (SIH PS-25022).

Structured, machine-checkable explanation object mirroring the rigor of WaitReason.
Provides structured WHY (root cause) → WHAT (impact) → HOW (candidate resolutions & tradeoffs).
"""
from __future__ import annotations
from enum import Enum
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field


class ConflictType(str, Enum):
    HEADWAY_VIOLATION = "HEADWAY_VIOLATION"
    CROSSING_OVERLAP = "CROSSING_OVERLAP"
    PLATFORM_CLASH = "PLATFORM_CLASH"
    BLOCK_CLOSURE_CONTENTION = "BLOCK_CLOSURE_CONTENTION"
    OPPOSING_MOVEMENT = "OPPOSING_MOVEMENT"


class ResolutionTradeoff(BaseModel):
    action: str                       # e.g., "HOLD_AT_LOOP", "ALLOW_PRECEDENCE", "SPEED_RESTRICT"
    target_train_id: str             # Which train is acted upon
    location_block_id: str           # Where action takes place
    expected_effect: str             # e.g., "Prevents 41.0m cascade gridlock on Main UP"
    tradeoff: str                    # e.g., "Adds 4.2m scheduled hold delay to Train T04403"
    delay_delta_sec: float           # Actual computed delta in seconds
    safety_valid: bool = True


class ConflictEntityState(BaseModel):
    train_id: str
    train_name: str
    priority: str
    speed_kmh: float
    current_block_id: Optional[str] = None
    accumulated_delay_min: float = 0.0


class ConflictExplanation(BaseModel):
    """
    Authoritative machine-readable conflict explanation.
    """
    conflict_id: str
    conflict_type: ConflictType
    severity: str = "HIGH"           # CRITICAL, HIGH, MEDIUM, LOW
    time_to_impact_sec: float
    location_block_id: str
    location_block_name: str
    involved_entities: List[ConflictEntityState] = Field(default_factory=list)
    root_cause: str
    impact_summary: str
    candidate_resolutions: List[ResolutionTradeoff] = Field(default_factory=list)


class RecommendationRationale(BaseModel):
    """
    Authoritative machine-readable recommendation rationale.
    """
    recommendation_id: str
    action: str
    primary_train_id: str
    conflicting_train_id: Optional[str] = None
    target_block_id: Optional[str] = None
    binding_constraints: List[str] = Field(default_factory=list)
    why_chosen: str
    metric_delta: Dict[str, float] = Field(default_factory=dict)
    rejection_consequence: str
    safety_validated: bool = True
