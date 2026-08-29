"""
RAILOPT-X Operational Safety Engine
Canonical Authoritative Safety Subsystem for Runtime Simulation,
Candidate Evaluation, and Dispatch Plan Validation.
"""

from typing import List, Dict, Tuple, Optional
from backend.simulator.railway.models import (
    Train, TrackBlock, Signal, Platform, Disruption, DisruptionType,
    TrainStatus, BlockDirection, SafetyViolation
)


class OperationalSafetyEngine:
    """
    Canonical authority for verifying safety invariants across both live simulation
    states and cloned candidate evaluation branches.
    """

    HEADWAY_BUFFER_SEC = 180.0  # 3 minutes headway buffer

    @classmethod
    def validate_runtime_state(
        cls,
        sim_time_sec: float,
        trains: Dict[str, Train],
        blocks: Dict[str, TrackBlock],
        signals: Dict[str, Signal],
        platforms: Dict[str, Platform],
        disruptions: Dict[str, Disruption]
    ) -> Tuple[bool, List[SafetyViolation]]:
        """
        Evaluate full safety invariants across all active entities at current time step.
        Returns (is_safe, violations).
        """
        violations: List[SafetyViolation] = []

        # 1. Closed Block / Track Disruption Invariant
        closed_blocks = {
            d.target_id for d in disruptions.values()
            if d.disruption_type == DisruptionType.BLOCK_CLOSURE and d.active
        }
        for train in trains.values():
            if train.status in (TrainStatus.RUNNING, TrainStatus.WAITING, TrainStatus.DELAYED):
                if train.current_block_id in closed_blocks:
                    violations.append(SafetyViolation(
                        timestamp_sec=sim_time_sec,
                        violation_type="TRACK_CLOSURE",
                        block_id=train.current_block_id,
                        train_ids=[train.train_id],
                        severity="CRITICAL",
                        explanation=f"Train {train.train_id} ({train.train_name}) occupies closed block {train.current_block_id}."
                    ))

        # 2. Block Occupancy & Simultaneous Conflict Invariant
        block_occupancy: Dict[str, List[Train]] = {}
        for train in trains.values():
            if train.status in (TrainStatus.RUNNING, TrainStatus.WAITING, TrainStatus.DELAYED) and train.current_block_id:
                block_occupancy.setdefault(train.current_block_id, []).append(train)

        for block_id, occ_trains in block_occupancy.items():
            if len(occ_trains) > 1:
                block = blocks.get(block_id)
                # Station loops or multi-track yards might allow multiple rakes, but main/single line sections forbid it
                if block and block.block_type in ("MAIN_LINE", "SINGLE_LINE_SECTION"):
                    t_ids = [t.train_id for t in occ_trains]
                    violations.append(SafetyViolation(
                        timestamp_sec=sim_time_sec,
                        violation_type="BLOCK_OCCUPANCY",
                        block_id=block_id,
                        train_ids=t_ids,
                        severity="CRITICAL",
                        explanation=f"Simultaneous occupancy conflict on {block.block_type} {block_id} by trains {', '.join(t_ids)}."
                    ))

        # 3. Single-Line Opposing Direction Movement Invariant
        single_line_blocks = {
            b_id: b for b_id, b in blocks.items()
            if b.block_type == "SINGLE_LINE_SECTION" or b.direction == BlockDirection.BIDIRECTIONAL
        }
        for sl_id, sl_block in single_line_blocks.items():
            sl_trains = block_occupancy.get(sl_id, [])
            if len(sl_trains) >= 2:
                dirs = {t.direction for t in sl_trains}
                if len(dirs) > 1:
                    t_ids = [t.train_id for t in sl_trains]
                    violations.append(SafetyViolation(
                        timestamp_sec=sim_time_sec,
                        violation_type="HEADWAY_VIOLATION",
                        block_id=sl_id,
                        train_ids=t_ids,
                        severity="CRITICAL",
                        explanation=f"Opposing directional collision risk on single-line section {sl_id} between trains {', '.join(t_ids)}."
                    ))

        # 4. Platform Occupancy Conflict Invariant
        platform_occupancy: Dict[str, List[Train]] = {}
        for train in trains.values():
            if train.is_dwelling and train.stops and train.route_index < len(train.stops):
                plat_id = train.stops[train.route_index].assigned_platform_id
                if plat_id:
                    platform_occupancy.setdefault(plat_id, []).append(train)

        for plat_id, p_trains in platform_occupancy.items():
            if len(p_trains) > 1:
                t_ids = [t.train_id for t in p_trains]
                violations.append(SafetyViolation(
                    timestamp_sec=sim_time_sec,
                    violation_type="PLATFORM_CONFLICT",
                    block_id=plat_id,
                    train_ids=t_ids,
                    severity="HIGH",
                    explanation=f"Simultaneous platform occupancy conflict on platform {plat_id} by trains {', '.join(t_ids)}."
                ))

        is_safe = len(violations) == 0
        return is_safe, violations
