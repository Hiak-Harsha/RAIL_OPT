from __future__ import annotations
from typing import Dict, List, Any, Optional, Tuple
from pydantic import BaseModel, Field
from ...simulator.railway.models import TrackBlock, BlockType, BlockDirection
from ...simulator.railway.graph import RailwayNetworkGraph


# Global numerical comparison tolerances (Issue 2.2)
EPSILON_TIME_SEC = 0.5        # 500ms tolerance for discrete schedule boundaries
EPSILON_DISTANCE_KM = 0.01    # 10m tolerance for topological distances


class FloatComparison:
    """Robust floating-point comparison helper for timetable boundaries."""
    @staticmethod
    def is_approximately_equal(a: float, b: float, epsilon: float = EPSILON_TIME_SEC) -> bool:
        return abs(a - b) <= epsilon

    @staticmethod
    def is_approximately_less(a: float, b: float, epsilon: float = EPSILON_TIME_SEC) -> bool:
        return a < (b - epsilon)

    @staticmethod
    def is_approximately_greater(a: float, b: float, epsilon: float = EPSILON_TIME_SEC) -> bool:
        return a > (b + epsilon)


class ViolationType:
    BLOCK_CONFLICT = "BLOCK_CONFLICT"
    HEADWAY_VIOLATION = "HEADWAY_VIOLATION"
    SINGLE_LINE_COLLISION = "SINGLE_LINE_COLLISION"
    PLATFORM_OVERBOOKING = "PLATFORM_OVERBOOKING"
    SPEED_LIMIT_VIOLATION = "SPEED_LIMIT_VIOLATION"
    TRACK_CLOSURE_VIOLATION = "TRACK_CLOSURE_VIOLATION"
    CONTINUITY_VIOLATION = "CONTINUITY_VIOLATION"
    PLATFORM_DWELL_INSUFFICIENT = "PLATFORM_DWELL_INSUFFICIENT"


class SafetyViolation(BaseModel):
    violation_type: str
    severity: str = "CRITICAL"
    train_ids: List[str]
    block_id: Optional[str] = None
    platform_id: Optional[str] = None
    time_interval: Tuple[float, float]
    explanation: str


class ValidationResult(BaseModel):
    is_valid: bool
    total_violations: int = 0
    violations: List[SafetyViolation] = Field(default_factory=list)
    checked_trains_count: int = 0
    checked_intervals_count: int = 0


class SafetyValidator:
    """
    Safety Engine Invariant.
    No schedule proposed by baselines, CP-SAT, or AI/RL may execute without passing validation.
    """

    def __init__(self, network: RailwayNetworkGraph, min_headway_sec: float = 180.0):
        self.network = network
        self.min_headway_sec = min_headway_sec

    def validate_schedule(
        self,
        schedule_movements: Dict[str, List[Dict[str, Any]]],
        blocked_block_ids: Optional[List[str]] = None,
        scheduled_stops: Optional[Dict[str, List[Any]]] = None
    ) -> ValidationResult:
        violations: List[SafetyViolation] = []
        blocked_set = set(blocked_block_ids or [])
        
        block_intervals: Dict[str, List[Tuple[str, float, float, Optional[str]]]] = {}
        platform_intervals: Dict[str, List[Tuple[str, float, float]]] = {}
        
        interval_count = 0
        train_ids = list(schedule_movements.keys())

        for train_id, movements in schedule_movements.items():
            for m in movements:
                interval_count += 1
                b_id = m["block_id"]
                t_enter = float(m["enter_time"])
                t_exit = float(m["exit_time"])
                p_id = m.get("platform_id")

                # 1. Timing validity with epsilon comparison
                if FloatComparison.is_approximately_less(t_exit, t_enter, EPSILON_TIME_SEC):
                    violations.append(SafetyViolation(
                        violation_type=ViolationType.SPEED_LIMIT_VIOLATION,
                        train_ids=[train_id],
                        block_id=b_id,
                        time_interval=(t_enter, t_exit),
                        explanation=f"Train {train_id} exit time ({t_exit}s) cannot precede enter time ({t_enter}s) on block {b_id}."
                    ))

                # 2. Block closure check
                if b_id in blocked_set:
                    violations.append(SafetyViolation(
                        violation_type=ViolationType.TRACK_CLOSURE_VIOLATION,
                        train_ids=[train_id],
                        block_id=b_id,
                        time_interval=(t_enter, t_exit),
                        explanation=f"Train {train_id} routed through blocked/closed track block {b_id}."
                    ))

                # 3. Speed Limit / Traversal Time Check
                block_info = self.network.get_block(b_id)
                if block_info:
                    min_traversal_sec = (block_info.length_km / (block_info.max_speed_kmh / 3600.0))
                    duration_sec = t_exit - t_enter
                    if FloatComparison.is_approximately_less(duration_sec, min_traversal_sec - EPSILON_TIME_SEC, EPSILON_TIME_SEC):
                        violations.append(SafetyViolation(
                            violation_type=ViolationType.SPEED_LIMIT_VIOLATION,
                            train_ids=[train_id],
                            block_id=b_id,
                            time_interval=(t_enter, t_exit),
                            explanation=f"Train {train_id} traversing {b_id} in {duration_sec:.1f}s which exceeds max speed ({block_info.max_speed_kmh} km/h, min time {min_traversal_sec:.1f}s)."
                        ))

                conflicting_b_ids = self.network.get_conflicting_blocks(b_id)
                for cb_id in conflicting_b_ids:
                    if cb_id not in block_intervals:
                        block_intervals[cb_id] = []
                    block_intervals[cb_id].append((train_id, t_enter, t_exit, p_id))

                if p_id:
                    if p_id not in platform_intervals:
                        platform_intervals[p_id] = []
                    platform_intervals[p_id].append((train_id, t_enter, t_exit))

        # Check block overlapping & headway violations
        for b_id, intervals in block_intervals.items():
            block_info = self.network.get_block(b_id)
            is_single_line = block_info and block_info.block_type in (BlockType.SINGLE_LINE_SECTION, BlockType.LOOP_LINE)

            sorted_intervals = sorted(intervals, key=lambda x: x[1])

            for i in range(len(sorted_intervals)):
                t1_id, t1_enter, t1_exit, _ = sorted_intervals[i]

                for j in range(i + 1, len(sorted_intervals)):
                    t2_id, t2_enter, t2_exit, _ = sorted_intervals[j]

                    if t1_id == t2_id:
                        continue

                    # Overlapping occupancy [t_enter, t_exit] with tolerance
                    has_overlap = not (
                        FloatComparison.is_approximately_less(t1_exit, t2_enter, EPSILON_TIME_SEC) or
                        FloatComparison.is_approximately_less(t2_exit, t1_enter, EPSILON_TIME_SEC)
                    )

                    if has_overlap:
                        v_type = ViolationType.SINGLE_LINE_COLLISION if is_single_line else ViolationType.BLOCK_CONFLICT
                        violations.append(SafetyViolation(
                            violation_type=v_type,
                            train_ids=[t1_id, t2_id],
                            block_id=b_id,
                            time_interval=(max(t1_enter, t2_enter), min(t1_exit, t2_exit)),
                            explanation=f"Conflict detected on block {b_id} between {t1_id} ({t1_enter:.0f}s-{t1_exit:.0f}s) and {t2_id} ({t2_enter:.0f}s-{t2_exit:.0f}s)."
                        ))
                    else:
                        # Safety clearance headway between consecutive trains entering same block
                        clearance_buffer = t2_enter - t1_exit
                        if 0 <= clearance_buffer and FloatComparison.is_approximately_less(clearance_buffer, self.min_headway_sec, EPSILON_TIME_SEC):
                            violations.append(SafetyViolation(
                                violation_type=ViolationType.HEADWAY_VIOLATION,
                                severity="MAJOR",
                                train_ids=[t1_id, t2_id],
                                block_id=b_id,
                                time_interval=(t1_exit, t2_enter),
                                explanation=f"Headway violation on block {b_id}: {t2_id} enters {clearance_buffer:.0f}s after {t1_id} cleared block (min required safety buffer is {self.min_headway_sec:.0f}s)."
                            ))

        # Check platform overbooking
        for p_id, p_list in platform_intervals.items():
            sorted_p = sorted(p_list, key=lambda x: x[1])
            for i in range(len(sorted_p)):
                t1_id, t1_enter, t1_exit = sorted_p[i]
                for j in range(i + 1, len(sorted_p)):
                    t2_id, t2_enter, t2_exit = sorted_p[j]
                    if t1_id == t2_id:
                        continue
                    if not (
                        FloatComparison.is_approximately_less(t1_exit, t2_enter, EPSILON_TIME_SEC) or
                        FloatComparison.is_approximately_less(t2_exit, t1_enter, EPSILON_TIME_SEC)
                    ):
                        violations.append(SafetyViolation(
                            violation_type=ViolationType.PLATFORM_OVERBOOKING,
                            train_ids=[t1_id, t2_id],
                            platform_id=p_id,
                            time_interval=(max(t1_enter, t2_enter), min(t1_exit, t2_exit)),
                            explanation=f"Platform {p_id} simultaneous occupancy conflict between {t1_id} and {t2_id}."
                        ))

        # Check platform dwell verification if scheduled_stops are provided
        if scheduled_stops:
            for train_id, stops in scheduled_stops.items():
                train_p_intervals = [
                    (p_id, t_enter, t_exit)
                    for b_id, intervals in block_intervals.items()
                    for t_id, t_enter, t_exit, p_id in intervals
                    if t_id == train_id and p_id is not None
                ]
                for stop in stops:
                    p_id = getattr(stop, "assigned_platform_id", None) or getattr(stop, "platform_id", None)
                    min_dwell = getattr(stop, "minimum_dwell_sec", 60.0)
                    if p_id:
                        actual_dwell = next(
                            (t_exit - t_enter for plat_id, t_enter, t_exit in train_p_intervals if plat_id == p_id),
                            None
                        )
                        if actual_dwell is not None and FloatComparison.is_approximately_less(actual_dwell, min_dwell, EPSILON_TIME_SEC):
                            violations.append(SafetyViolation(
                                violation_type=ViolationType.PLATFORM_DWELL_INSUFFICIENT,
                                train_ids=[train_id],
                                platform_id=p_id,
                                time_interval=(0.0, actual_dwell),
                                explanation=f"Train {train_id} dwell on {p_id} ({actual_dwell:.1f}s) is less than required {min_dwell:.1f}s."
                            ))

        return ValidationResult(
            is_valid=(len(violations) == 0),
            total_violations=len(violations),
            violations=violations,
            checked_trains_count=len(train_ids),
            checked_intervals_count=interval_count
        )
