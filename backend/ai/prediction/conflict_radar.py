from __future__ import annotations
from typing import Dict, List, Any, Tuple, Optional
from pydantic import BaseModel, Field
from ...simulator.railway.models import Train, TrackBlock, TrainStatus
from ...simulator.railway.graph import RailwayNetworkGraph
from ...domain.conflict_explanation import (
    ConflictExplanation, ConflictType, ConflictEntityState, ResolutionTradeoff
)


class PredictedConflict(BaseModel):
    conflict_id: str
    severity: str = "HIGH"
    conflict_state: str = "PREDICTED"  # ACTIVE (<=30s), PREDICTED (<=900s), POTENTIAL (>900s)
    predicted_time_sec: float
    time_to_conflict_sec: float
    location_block_id: str
    location_block_name: str
    involved_train_ids: List[str]
    involved_train_names: List[str]
    conflict_nature: str
    projected_delay_minutes: float
    recommended_action_type: str
    affected_block_ids: List[str] = Field(default_factory=list)
    cluster_id: Optional[str] = None
    explanation: Optional[ConflictExplanation] = None


class ConflictRadar:
    """
    Proactive Lookahead Conflict Radar with Spatial-Temporal Clustering.
    Projects trajectories 5 to 15 minutes into the future to warn section controllers
    and trigger automated optimization before block deadlocks occur.

    Clusters overlapping corridor block overlaps for the same train pair into a single
    authoritative conflict incident with `affected_block_ids`.

    PREDICTION METHOD: Deterministic trajectory approximation.
    """

    prediction_method: str = "DETERMINISTIC_TRAJECTORY_APPROXIMATION"

    def __init__(self, network: RailwayNetworkGraph, lookahead_sec: float = 900.0):
        self.network = network
        self.lookahead_sec = lookahead_sec  # 15 minutes lookahead

    def scan_conflicts(
        self,
        trains: List[Train],
        current_time_sec: float,
    ) -> List[PredictedConflict]:
        raw_overlaps: List[Dict[str, Any]] = []
        train_trajectories: Dict[str, List[Tuple[str, float, float]]] = {}

        # Project expected arrival and departure times for each train at each block
        for train in trains:
            if train.status in (TrainStatus.CANCELLED, TrainStatus.ARRIVED):
                continue

            # Start trajectory from authentic operational departure or current position
            if train.status in (TrainStatus.SCHEDULED, TrainStatus.READY_TO_DEPART):
                dep_time = (
                    train.stops[0].scheduled_departure if train.stops else 0.0
                ) + train.total_delay_sec
                # If departure is far beyond the lookahead window, skip
                if dep_time > current_time_sec + self.lookahead_sec:
                    continue
                # For future departure, start trajectory AT departure time
                # For past departure not yet dispatched, start at current_time_sec
                curr_t = max(current_time_sec, dep_time)
            else:
                curr_t = current_time_sec

            trajectories = []
            # Start from current route index
            for idx, b_id in enumerate(train.route_block_ids[train.route_index:]):
                block = self.network.get_block(b_id)
                if not block:
                    continue

                effective_speed = max(20.0, min(train.max_speed_kmh, block.current_speed_limit_kmh))
                if idx == 0 and train.current_block_id == b_id:
                    rem_dist = max(0.05, block.length_km - train.current_position_km)
                    min_dur = rem_dist / (effective_speed / 3600.0)
                else:
                    min_dur = block.length_km / (effective_speed / 3600.0)

                enter_t = curr_t
                exit_t = enter_t + min_dur
                trajectories.append((b_id, enter_t, exit_t))
                curr_t = exit_t + 10.0  # Safe block clear buffer

            if trajectories:
                train_trajectories[train.train_id] = trajectories

        train_map = {t.train_id: t for t in trains}
        train_ids = list(train_trajectories.keys())

        # 1. Identify raw block overlap candidates
        for i in range(len(train_ids)):
            t1_id = train_ids[i]
            t1_traj = train_trajectories[t1_id]

            for j in range(i + 1, len(train_ids)):
                t2_id = train_ids[j]
                t2_traj = train_trajectories[t2_id]

                for b1_id, t1_enter, t1_exit in t1_traj:
                    conflicting_b_ids = self.network.get_conflicting_blocks(b1_id)

                    for b2_id, t2_enter, t2_exit in t2_traj:
                        if b2_id in conflicting_b_ids:
                            # Check interval overlap within lookahead window
                            has_overlap = not (t1_exit <= t2_enter or t2_exit <= t1_enter)
                            if has_overlap and (min(t1_enter, t2_enter) - current_time_sec <= self.lookahead_sec):
                                conflict_time = max(t1_enter, t2_enter)
                                time_to_conflict = max(0.0, conflict_time - current_time_sec)
                                raw_overlaps.append({
                                    "train_pair": tuple(sorted([t1_id, t2_id])),
                                    "block_id": b1_id,
                                    "conflict_time": conflict_time,
                                    "time_to_conflict": time_to_conflict,
                                    "t1_enter": t1_enter,
                                    "t1_exit": t1_exit,
                                    "t2_enter": t2_enter,
                                    "t2_exit": t2_exit,
                                })

        # 2. Cluster raw overlaps by (train_pair)
        clustered_groups: Dict[Tuple[str, str], List[Dict[str, Any]]] = {}
        for overlap in raw_overlaps:
            pair = overlap["train_pair"]
            if pair not in clustered_groups:
                clustered_groups[pair] = []
            clustered_groups[pair].append(overlap)

        # 3. Build unified authoritative PredictedConflict incidents
        predicted: List[PredictedConflict] = []
        conflict_seq = 1

        for pair, group in clustered_groups.items():
            t1_id, t2_id = pair
            t1 = train_map.get(t1_id)
            t2 = train_map.get(t2_id)

            # Sort by earliest conflict time
            group.sort(key=lambda x: x["time_to_conflict"])
            earliest = group[0]
            earliest_block_id = earliest["block_id"]
            block = self.network.get_block(earliest_block_id)

            affected_blocks = list(dict.fromkeys(item["block_id"] for item in group))
            min_ttc = earliest["time_to_conflict"]
            min_pred_time = earliest["conflict_time"]

            is_opposing = (t1.direction != t2.direction) if t1 and t2 else False
            nature = "Opposing Head-on Single-Line Crossing" if is_opposing else "Same-direction Block Catch-up"

            if min_ttc <= 30.0:
                conf_state = "ACTIVE"
            elif min_ttc <= self.lookahead_sec:
                conf_state = "PREDICTED"
            else:
                conf_state = "POTENTIAL"

            involved_entities = []
            for t in (t1, t2):
                if t:
                    prio_str = t.priority.name if hasattr(t.priority, "name") else str(t.priority)
                    involved_entities.append(ConflictEntityState(
                        train_id=t.train_id,
                        train_name=t.train_name,
                        priority=prio_str,
                        speed_kmh=round(t.current_speed_kmh, 1),
                        current_block_id=t.current_block_id,
                        accumulated_delay_min=round(t.total_delay_sec / 60.0, 1)
                    ))

            proj_delay_min = round((earliest["t1_exit"] - earliest["t1_enter"] + 180.0) / 60.0, 1)
            b_name = block.name if block else earliest_block_id

            if is_opposing:
                root_cause = f"Train {t1_id} ({t1.train_name if t1 else t1_id}) and Train {t2_id} ({t2.train_name if t2 else t2_id}) are both projected to occupy single-line block {earliest_block_id} ({b_name}) in opposing directions within {int(min_ttc)}s."
                impact_summary = f"Opposing headway violation risking emergency brake intervention and +{proj_delay_min}m cascade delay."
                resolutions = [
                    ResolutionTradeoff(
                        action="HOLD_AT_CROSSING",
                        target_train_id=t2_id if (t1 and t2 and t1.priority >= t2.priority) else t1_id,
                        location_block_id=earliest_block_id,
                        expected_effect="Maintains clear line for higher priority movement",
                        tradeoff=f"Adds {round(min_ttc / 60.0, 1)}m controlled hold at preceding loop siding",
                        delay_delta_sec=round(min_ttc, 1),
                        safety_valid=True
                    )
                ]
            else:
                root_cause = f"Faster Train {t1_id} ({t1.train_name if t1 else t1_id}) is projected to enter block {earliest_block_id} ({b_name}) within {int(min_ttc)}s of Train {t2_id} ({t2.train_name if t2 else t2_id}), breaching the 180s safe headway standard."
                impact_summary = f"Same-direction headway compression forcing restrictive signal aspects (YELLOW/RED) and +{proj_delay_min}m slowdown."
                resolutions = [
                    ResolutionTradeoff(
                        action="LOOP_PRECEDENCE",
                        target_train_id=t2_id if (t1 and t2 and t1.priority >= t2.priority) else t1_id,
                        location_block_id=earliest_block_id,
                        expected_effect="Restores 180s clear line headway for express corridor",
                        tradeoff=f"Adds {round(min_ttc / 60.0, 1)}m loop siding dwell to freight/secondary rake",
                        delay_delta_sec=round(min_ttc, 1),
                        safety_valid=True
                    )
                ]

            explanation = ConflictExplanation(
                conflict_id=f"CONF_{conflict_seq:03d}",
                conflict_type=ConflictType.OPPOSING_MOVEMENT if is_opposing else ConflictType.HEADWAY_VIOLATION,
                severity="CRITICAL" if is_opposing else "HIGH",
                time_to_impact_sec=round(min_ttc, 1),
                location_block_id=earliest_block_id,
                location_block_name=b_name,
                involved_entities=involved_entities,
                root_cause=root_cause,
                impact_summary=impact_summary,
                candidate_resolutions=resolutions
            )

            predicted.append(PredictedConflict(
                conflict_id=f"CONF_{conflict_seq:03d}",
                severity="CRITICAL" if is_opposing else "HIGH",
                conflict_state=conf_state,
                predicted_time_sec=round(min_pred_time, 1),
                time_to_conflict_sec=round(min_ttc, 1),
                location_block_id=earliest_block_id,
                location_block_name=b_name,
                involved_train_ids=[t1_id, t2_id],
                involved_train_names=[t1.train_name if t1 else t1_id, t2.train_name if t2 else t2_id],
                conflict_nature=nature,
                projected_delay_minutes=proj_delay_min,
                recommended_action_type="HOLD_AND_CROSS" if is_opposing else "OVERTAKE_AT_LOOP",
                affected_block_ids=affected_blocks,
                cluster_id=f"CLUS_{t1_id}_{t2_id}",
                explanation=explanation
            ))
            conflict_seq += 1

        return predicted
