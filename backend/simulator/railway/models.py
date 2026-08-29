from __future__ import annotations
from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field


class PriorityClass(int, Enum):
    P5_HIGH_SPEED_PREMIUM = 5  # Rajdhani / Vande Bharat
    P4_SUPERFAST_EXPRESS = 4   # Mail / Express / Superfast
    P3_PASSENGER_LOCAL = 3     # Passenger / MEMU / Suburban
    P2_FREIGHT = 2             # Freight / Container / Goods
    P1_MAINTENANCE_TOWERS = 1  # Maintenance / Inspection Car


class BlockType(str, Enum):
    MAIN_LINE = "MAIN_LINE"
    LOOP_LINE = "LOOP_LINE"
    PLATFORM_LINE = "PLATFORM_LINE"
    JUNCTION_CROSSOVER = "JUNCTION_CROSSOVER"
    SINGLE_LINE_SECTION = "SINGLE_LINE_SECTION"
    SINGLE_LINE = "SINGLE_LINE_SECTION"
    BOTTLENECK = "BOTTLENECK"


class BlockDirection(str, Enum):
    UP = "UP"          # Direction A -> Z
    DOWN = "DOWN"      # Direction Z -> A
    BIDIRECTIONAL = "BIDIRECTIONAL"


class SignalAspect(str, Enum):
    RED = "RED"        # Stop
    YELLOW = "YELLOW"  # Caution - prepare to stop at next signal
    DOUBLE_YELLOW = "DOUBLE_YELLOW" # Attention - proceed at restricted speed
    GREEN = "GREEN"    # Proceed at normal track speed


class TrainStatus(str, Enum):
    SCHEDULED = "SCHEDULED"             # Not yet departed; departure time in future
    READY_TO_DEPART = "READY_TO_DEPART" # Departure time passed; awaiting physical dispatch
    RUNNING = "RUNNING"                 # Actively moving on network
    WAITING = "WAITING"                 # Stationary — waiting for signal/route/headway
    STOPPED = "STOPPED"                 # Deliberate operational stop
    DELAYED = "DELAYED"                 # Running behind schedule
    ARRIVED = "ARRIVED"                 # Reached final destination
    CANCELLED = "CANCELLED"             # Service cancelled
    DISRUPTED = "DISRUPTED"             # Active disruption affecting this train


class DisruptionType(str, Enum):
    TRAIN_DELAY = "TRAIN_DELAY"
    TRAIN_BREAKDOWN = "TRAIN_BREAKDOWN"
    BLOCK_CLOSURE = "BLOCK_CLOSURE"
    PLATFORM_UNAVAILABLE = "PLATFORM_UNAVAILABLE"
    SIGNAL_FAILURE = "SIGNAL_FAILURE"
    WEATHER_RESTRICTION = "WEATHER_RESTRICTION"
    SPEED_RESTRICTION = "SPEED_RESTRICTION"
    EMERGENCY_MOVEMENT = "EMERGENCY_MOVEMENT"


class SimulationControlAction(str, Enum):
    START = "START"
    PAUSE = "PAUSE"
    RESET = "RESET"
    SET_SCALE = "SET_SCALE"
    JUMP_TO_TIME = "JUMP_TO_TIME"
    JUMP_TO_DEMO = "JUMP_TO_DEMO"
    JUMP_TO_NEXT_CONFLICT = "JUMP_TO_NEXT_CONFLICT"
    JUMP_TO_NEXT_EVENT = "JUMP_TO_NEXT_EVENT"


class DecisionAction(str, Enum):
    HOLD = "HOLD"
    RELEASE = "RELEASE"
    REROUTE = "REROUTE"
    CHANGE_PRECEDENCE = "CHANGE_PRECEDENCE"
    REASSIGN_PLATFORM = "REASSIGN_PLATFORM"
    ALLOW_CROSSING = "ALLOW_CROSSING"


class ControllerActionType(str, Enum):
    APPROVE = "APPROVE"
    REJECT = "REJECT"
    MODIFY = "MODIFY"
    OVERRIDE = "OVERRIDE"


class ConflictLifecycleState(str, Enum):
    DETECTED = "DETECTED"
    PREDICTED = "PREDICTED"
    ASSESSED = "ASSESSED"
    ACTIONABLE = "ACTIONABLE"
    EVALUATING = "EVALUATING"
    RECOMMENDED = "RECOMMENDED"
    PREVIEWING = "PREVIEWING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    OVERRIDDEN = "OVERRIDDEN"
    EXECUTED = "EXECUTED"
    OUTCOME_VERIFIED = "OUTCOME_VERIFIED"
    INVALIDATED = "INVALIDATED"
    SUPERSEDED = "SUPERSEDED"


class LoopPrecedenceAction(BaseModel):
    train_id: str
    approach_edge_id: str
    loop_edge_id: str
    exit_edge_id: str
    precedence_train_id: str
    hold_duration_sec: float = 180.0
    switch_commands: List[Dict[str, str]] = Field(default_factory=list)
    required_signals: List[str] = Field(default_factory=list)
    route_reservation_id: Optional[str] = None
    status: str = "PENDING"  # "PENDING" | "RESERVED" | "LOCKED" | "IN_LOOP" | "RELEASED"


# --- Physical Infrastructure Models ---

class Signal(BaseModel):
    id: str
    name: str
    block_id: str
    aspect: SignalAspect = SignalAspect.GREEN
    position_km: float


class Platform(BaseModel):
    id: str
    name: str
    station_id: str
    length_meters: float = 650.0
    is_electrified: bool = True
    is_occupied: bool = False
    occupied_by: Optional[str] = None


class SpeedRestriction(BaseModel):
    start_km_in_block: float = 0.0
    end_km_in_block: float = 0.0
    restricted_speed_kmh: float = 60.0
    reason: str = "PERMANENT_SPEED_RESTRICTION"  # "CURVE", "BRIDGE", "LEVEL_CROSSING", "GRADIENT"


class TrackBlock(BaseModel):
    id: str
    name: str
    block_type: BlockType
    direction: BlockDirection
    length_km: float
    max_speed_kmh: float = 110.0
    current_speed_limit_kmh: float = 110.0
    gradient_percent: float = 0.0   # positive = uphill climbing in UP direction, negative = descending
    elevation_start_m: float = 0.0
    elevation_end_m: float = 0.0
    speed_restrictions: List[SpeedRestriction] = Field(default_factory=list)
    is_occupied: bool = False
    occupied_by_train_id: Optional[str] = None
    is_blocked: bool = False  # Track failure/maintenance
    from_node: str
    to_node: str
    signals: List[str] = Field(default_factory=list)


class Station(BaseModel):
    id: str
    code: str
    name: str
    position_km: float
    platforms: List[Platform] = Field(default_factory=list)
    loop_blocks: List[str] = Field(default_factory=list)


# --- Train Model ---

class TimetableStop(BaseModel):
    station_id: str
    station_code: str
    scheduled_arrival: float  # Seconds from simulation epoch (t=0)
    scheduled_departure: float
    actual_arrival: Optional[float] = None
    actual_departure: Optional[float] = None
    assigned_platform_id: Optional[str] = None
    min_dwell_time_sec: float = 120.0  # 2 mins standard


class Train(BaseModel):
    train_id: str
    train_number: str
    train_name: str
    priority: PriorityClass
    origin: str
    destination: str
    direction: BlockDirection
    current_block_id: Optional[str] = None
    current_position_km: float = 0.0
    current_speed_kmh: float = 0.0
    max_speed_kmh: float = 110.0
    acceleration_ms2: float = 0.5
    deceleration_ms2: float = 0.7
    current_accel_ms2: float = 0.0
    jerk_limit_ms3: float = 0.15      # m/s³ jerk rate of acceleration change
    gradient_sensitivity: float = 1.0  # 0.3 for Vande Bharat, 1.0 for Rajdhani, 2.0+ for Heavy Freight
    length_meters: float = 550.0
    rolling_stock_type: str = "WAP7_LHB"  # "VANDE_BHARAT" | "WAP7_LHB" | "WAG9_FREIGHT" | "MEMU"
    coach_count: int = 16
    rake_length_meters: float = 450.0
    status: TrainStatus = TrainStatus.SCHEDULED
    route_block_ids: List[str] = Field(default_factory=list)
    route_index: int = 0
    total_delay_sec: float = 0.0
    stops: List[TimetableStop] = Field(default_factory=list)
    held_at_block_id: Optional[str] = None
    hold_duration_remaining_sec: float = 0.0
    dwell_remaining_sec: float = 0.0
    is_dwelling: bool = False


# --- Disruption & What-If Models ---

class Disruption(BaseModel):
    id: str
    disruption_type: DisruptionType
    target_id: str  # train_id, block_id, platform_id, or signal_id
    start_time_sec: float
    duration_sec: float
    severity_factor: float = 1.0  # e.g., delay minutes or speed reduction
    description: str
    active: bool = True


# --- Decision Support & Explainability Models ---

class SafetyViolation(BaseModel):
    timestamp_sec: float
    violation_type: str  # "BLOCK_OCCUPANCY" | "HEADWAY_VIOLATION" | "SIGNAL_OVERRUN" | "PLATFORM_CONFLICT" | "TRACK_CLOSURE"
    block_id: Optional[str] = None
    train_ids: List[str] = Field(default_factory=list)
    severity: str = "CRITICAL"
    explanation: str = ""


class CandidateTrajectory(BaseModel):
    candidate_id: str
    description: str = ""
    train_movements: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict) # train_id -> [{block_id, enter_time, exit_time}]
    objective_cost: float = 0.0
    is_safety_valid: bool = True
    violations: List[SafetyViolation] = Field(default_factory=list)
    projected_delay_reduction_sec: float = 0.0
    projected_throughput_increase_pct: float = 0.0
    computation_time_ms: float = 0.0


class CandidateActionType(str, Enum):
    HOLD = "HOLD"
    LOOP_PRECEDENCE = "LOOP_PRECEDENCE"
    PLATFORM_REASSIGN = "PLATFORM_REASSIGN"
    SPEED_RESTRICT = "SPEED_RESTRICT"
    PROCEED_NORMAL = "PROCEED_NORMAL"


class CandidateAction(BaseModel):
    action_type: CandidateActionType
    train_id: str
    target_block_id: Optional[str] = None
    target_platform_id: Optional[str] = None
    duration_sec: float = 0.0
    restricted_speed_kmh: Optional[float] = None
    description: str = ""


class CandidateSchedule(BaseModel):
    schedule_id: str
    name: str
    strategy: str  # "CP_SAT_OPTIMAL" | "FALLBACK_CSP" | "PRIORITY_GREEDY" | "FCFS_BASELINE"
    actions: List[CandidateAction] = Field(default_factory=list)
    raw_solver_score: Optional[float] = None
    estimated_cost: float = 0.0


class ScenarioMetrics(BaseModel):
    total_delay_min: float
    avg_delay_min: float
    max_delay_min: float
    throughput_trains_hr: float
    conflicts_count: int
    total_travel_time_min: float = 0.0
    actual_travel_time_min: float = 0.0
    predicted_travel_time_min: float = 0.0
    peak_conflicts: int = 0
    conflict_events_total: int = 0
    first_violation_time_sec: Optional[float] = None
    violations_log: List[str] = Field(default_factory=list)
    safety_violations: List[SafetyViolation] = Field(default_factory=list)
    safety_valid: bool = True


class DecisionEvaluation(BaseModel):
    baseline: ScenarioMetrics
    selected_plan: Optional[ScenarioMetrics] = None
    selected_candidate_id: Optional[str] = None
    status: str = "SELECTED"  # "SELECTED" | "NO_SAFE_PLAN" | "NO_INTERVENTION_REQUIRED"
    delta: Dict[str, float] = Field(default_factory=dict)  # delay_saved_min, avg_delay_saved_min, throughput_gain_pct, conflicts_prevented
    alternatives: List[Dict[str, Any]] = Field(default_factory=list)
    candidate_schedules: List[Dict[str, Any]] = Field(default_factory=list)


class Recommendation(BaseModel):
    recommendation_id: str
    timestamp_sec: float
    primary_train_id: str
    conflicting_train_id: Optional[str] = None
    action: DecisionAction
    target_block_id: Optional[str] = None
    duration_sec: float = 0.0
    reason_summary: str
    reasons_bullet_points: List[str]
    affected_train_ids: List[str]
    confidence_score: Optional[float] = None
    optimization_objective_score: float          # Raw solver cost (from CP-SAT / CSP)
    evaluated_objective_score: Optional[float] = None  # Evaluated cost from CandidateEvaluator (Finding #43)
    solver_name: Optional[str] = None
    solver_status: Optional[str] = None
    operational_status: str = "SAFE_RECOMMENDATION"  # "SAFE_RECOMMENDATION" | "SOLVER_INVALIDATED" | "NO_SAFE_PLAN" | "NO_INTERVENTION_REQUIRED"
    safety_valid: bool = True
    safety_violations: List[str] = Field(default_factory=list)
    evaluation: Optional[DecisionEvaluation] = None
    counterfactual_options: List[Dict[str, Any]] = Field(default_factory=list)
    projected_metrics_diff: Dict[str, float] = Field(default_factory=dict)
    applied: bool = False
    controller_decision: Optional[ControllerActionType] = None
    override_reason: Optional[str] = None
    # Provenance (Finding #21)
    source_candidate_id: Optional[str] = None
    evaluation_horizon_sec: Optional[float] = None
    physical_validation_status: Optional[str] = None    # "PASSED" | "FAILED"
    prediction_method: Optional[str] = None             # "DETERMINISTIC_TRAJECTORY_APPROXIMATION"
    lifecycle_state: ConflictLifecycleState = ConflictLifecycleState.RECOMMENDED
    loop_action_details: Optional[LoopPrecedenceAction] = None




class OperationalSnapshot(BaseModel):
    timestamp_sec: float
    trains: List[Train]
    blocks: List[TrackBlock]
    signals: List[Signal]
    platforms: List[Platform]
    disruptions: List[Disruption] = Field(default_factory=list)


class CandidateEvaluation(BaseModel):
    candidate_id: str
    action: DecisionAction
    safety_valid: bool
    baseline_metrics: ScenarioMetrics
    candidate_metrics: ScenarioMetrics
    delta_metrics: Dict[str, float]


class DecisionImpact(BaseModel):
    train_ids: List[str]
    block_ids: List[str]
    conflicts_resolved: int
    metric_delta: Dict[str, float]


class EvaluationResult(BaseModel):
    scenario_id: str
    strategy: str
    evaluation_window_hr: float
    throughput_trains_hr: float
    total_travel_time_min: float
    total_delay_min: float
    avg_delay_min: float
    max_delay_min: float
    conflicts_count: int
    safety_valid: bool
    utilization_pct: float
    runtime_ms: Optional[float] = None


class AuditLogEntry(BaseModel):
    entry_id: str
    timestamp_sec: float
    recommendation_id: str
    train_id: str
    action: DecisionAction
    ai_reason: str
    controller_action: ControllerActionType
    override_reason: Optional[str] = None
    projected_delay_saved_sec: float
    actual_outcome_delay_saved_sec: Optional[float] = None
    prev_hash: Optional[str] = None
    entry_hash: Optional[str] = None


class PredictedConflict(BaseModel):
    conflict_id: str
    conflict_type: str
    location_block_id: str
    train_ids: List[str]
    estimated_time_to_conflict_sec: float
    ttc_sec: float = 0.0
    severity: str
    recommended_action_type: str
    description: str
    affected_block_ids: List[str] = Field(default_factory=list)
    cluster_id: Optional[str] = None
    lifecycle_state: ConflictLifecycleState = ConflictLifecycleState.PREDICTED
    prediction_horizon_sec: float = 900.0
