from __future__ import annotations
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from ..simulator.railway.models import (
    Train, TrackBlock, DecisionAction, ScenarioMetrics, DecisionEvaluation, TrainStatus,
    CandidateSchedule, CandidateAction, CandidateActionType, SafetyViolation
)
from ..simulator.engine import RailwaySimulationEngine
from .safety_engine import OperationalSafetyEngine
from .operational_objective import compute_J, ObjectiveWeights, ObjectiveProfile


def compute_candidate_objective(
    metrics: ScenarioMetrics,
    priority_weight: float = 1.0,
    weights: Optional[ObjectiveWeights] = None
) -> float:
    """
    Unified Multi-Objective Evaluation Function for Problem Statement 25022.
    Delegates to the single authoritative compute_J() so that CP-SAT solver,
    CandidateEvaluator, and Benchmark all produce comparable scores.
    """
    return compute_J(
        total_delay_min=metrics.total_delay_min,
        max_delay_min=metrics.max_delay_min,
        conflicts_count=metrics.conflicts_count,
        total_travel_time_min=metrics.total_travel_time_min,
        throughput_trains_hr=metrics.throughput_trains_hr,
        priority_weight=priority_weight,
        safety_valid=metrics.safety_valid,
        weights=weights
    )


class CandidateEvaluator:
    """
    Unified Operational Truth Layer & Candidate Evaluator for RAILOPT-X.
    Executes actual isolated branches of RailwaySimulationEngine across an evaluation horizon
    to measure authentic delay, throughput, conflict, and safety metrics without synthetic shortcuts.
    
    Continuous Full-Horizon Safety Verification:
    Inspects safety invariants via OperationalSafetyEngine at EVERY simulation tick across [0, T_horizon].
    Any transient violation at any second t <= T_horizon marks the candidate as unsafe with structured logs.
    """

    def __init__(self, base_engine: RailwaySimulationEngine):
        self.base_engine = base_engine

    def evaluate_branch(
        self,
        schedule: Optional[CandidateSchedule] = None,
        hold_train_id: Optional[str] = None,
        hold_sec: float = 0.0,
        horizon_sec: float = 900.0,
        dt: float = 2.0
    ) -> ScenarioMetrics:
        """
        Clones the live simulation engine and runs full physics, signaling, and interlocking
        while tracking continuous safety invariants at every step using OperationalSafetyEngine.
        """
        cloned_engine = self.base_engine.clone()
        violations_log: List[str] = []
        safety_violations_list: List[SafetyViolation] = []
        first_violation_time: Optional[float] = None
        peak_conflicts: int = 0
        conflict_events_count: int = 0

        # Apply candidate actions from schedule if provided
        if schedule:
            for action in schedule.actions:
                action_type_str = action.action_type.value if hasattr(action.action_type, "value") else str(action.action_type)
                if action.action_type in (CandidateActionType.HOLD, CandidateActionType.LOOP_PRECEDENCE):
                    cloned_engine.apply_controller_action(
                        action_type=action_type_str,
                        train_id=action.train_id,
                        hold_duration_sec=action.duration_sec,
                        target_block_id=action.target_block_id
                    )
                elif action.action_type == CandidateActionType.PLATFORM_REASSIGN and action.train_id in cloned_engine.state.trains:
                    cloned_engine.apply_controller_action(
                        action_type="REASSIGN_PLATFORM",
                        train_id=action.train_id,
                        target_block_id=action.target_platform_id
                    )
                elif action.action_type == CandidateActionType.SPEED_RESTRICT and action.target_block_id:
                    block = cloned_engine.network.get_block(action.target_block_id)
                    if block and action.restricted_speed_kmh:
                        block.current_speed_limit_kmh = action.restricted_speed_kmh
        elif hold_train_id and hold_train_id in cloned_engine.state.trains:
            cloned_engine.apply_controller_action(
                action_type="HOLD",
                train_id=hold_train_id,
                hold_duration_sec=hold_sec
            )

        # Continuous step-by-step physical simulation across horizon
        steps = max(1, int(horizon_sec / dt))
        for step_idx in range(steps):
            current_sim_t = cloned_engine.state.sim_time_sec
            cloned_engine.tick(delta_sec=dt)

            # 1. Authoritative Operational Safety Check at EVERY step
            is_step_safe, step_violations = OperationalSafetyEngine.validate_runtime_state(
                sim_time_sec=current_sim_t,
                trains=cloned_engine.state.trains,
                blocks=cloned_engine.network.blocks,
                signals=cloned_engine.network.signals,
                platforms=cloned_engine.network.platforms,
                disruptions=cloned_engine.state.disruptions
            )

            # 2. Continuous radar conflict tracking
            step_conflicts = cloned_engine._check_conflicts()
            if step_conflicts:
                conflict_events_count += len(step_conflicts)
                if len(step_conflicts) > peak_conflicts:
                    peak_conflicts = len(step_conflicts)

            if not is_step_safe or step_conflicts:
                if first_violation_time is None:
                    first_violation_time = current_sim_t
                for sv in step_violations:
                    safety_violations_list.append(sv)
                    violations_log.append(f"T+{round(current_sim_t, 1)}s: {sv.violation_type} on {sv.block_id or 'section'}")
                for c in step_conflicts:
                    violations_log.append(f"T+{round(current_sim_t, 1)}s: Crossing Conflict {c}")

        trains = list(cloned_engine.state.trains.values())
        total_delay_min = round(sum(t.total_delay_sec for t in trains) / 60.0, 1)
        avg_delay_min = round(total_delay_min / max(1, len(trains)), 1)
        max_delay_min = round(max((t.total_delay_sec for t in trains), default=0.0) / 60.0, 1)
        
        # Honest travel time calculation:
        actual_travel_time_min = round(sum(
            (t.current_position_km / max(20.0, t.max_speed_kmh) * 60.0) + (t.total_delay_sec / 60.0)
            for t in trains if t.status == TrainStatus.ARRIVED
        ), 1)

        predicted_travel_time_min = round(sum(
            (max(0.0, 435.0 - t.current_position_km) / max(20.0, t.current_speed_kmh or t.max_speed_kmh) * 60.0) + (t.total_delay_sec / 60.0)
            for t in trains if t.status != TrainStatus.ARRIVED
        ), 1)

        total_travel_time_min = round(actual_travel_time_min + predicted_travel_time_min, 1)

        # Authentic section throughput: strictly completed movements over horizon hours
        completed = sum(1 for t in trains if t.status == TrainStatus.ARRIVED)
        horizon_hr = max(0.01, horizon_sec / 3600.0)
        throughput = round(completed / horizon_hr, 1) if completed > 0 else 0.0

        end_conflicts = cloned_engine._check_conflicts()
        is_safe = (first_violation_time is None and len(end_conflicts) == 0 and len(safety_violations_list) == 0)

        return ScenarioMetrics(
            total_delay_min=total_delay_min,
            avg_delay_min=avg_delay_min,
            max_delay_min=max_delay_min,
            throughput_trains_hr=throughput,
            conflicts_count=len(end_conflicts),
            total_travel_time_min=total_travel_time_min,
            actual_travel_time_min=actual_travel_time_min,
            predicted_travel_time_min=predicted_travel_time_min,
            peak_conflicts=peak_conflicts,
            conflict_events_total=conflict_events_count,
            first_violation_time_sec=first_violation_time,
            violations_log=violations_log[:5],
            safety_violations=safety_violations_list[:5],
            safety_valid=is_safe
        )

    def evaluate_candidate_schedules(
        self,
        candidate_schedules: List[CandidateSchedule],
        primary_train: Optional[Train] = None,
        conflicting_train: Optional[Train] = None,
        optimized_score: Optional[float] = None,
        solver_name: Optional[str] = None,
        solver_status: Optional[str] = None,
        horizon_sec: float = 900.0
    ) -> DecisionEvaluation:
        """
        Evaluates a set of concrete CandidateSchedule objects emitted by the optimizer or baselines.
        Ranks candidates by multi-objective cost J with a strict safety gate.
        """
        # 1. Baseline Run (Unmitigated timetable dispatch without interventions)
        baseline_metrics = self.evaluate_branch(schedule=None, horizon_sec=horizon_sec)

        # Always include baseline as OPT_C in candidate evaluation
        baseline_candidate = CandidateSchedule(
            schedule_id="OPT_C",
            name="Unmitigated Traversal Baseline",
            strategy="UNMITIGATED_BASELINE",
            actions=[],
            estimated_cost=0.0
        )
        all_candidates = [cs for cs in candidate_schedules if cs.schedule_id != "OPT_C"]
        all_candidates.append(baseline_candidate)

        evaluated_plans: List[Dict[str, Any]] = []
        prio_weight = primary_train.priority.value if primary_train else 1.0

        for cand in all_candidates:
            metrics = self.evaluate_branch(schedule=cand, horizon_sec=horizon_sec)
            obj_score = compute_candidate_objective(metrics, priority_weight=prio_weight)
            
            evaluated_plans.append({
                "candidate_id": cand.schedule_id,
                "name": cand.name,
                "strategy": cand.strategy,
                "actions": [a.model_dump() for a in cand.actions],
                "safety_valid": metrics.safety_valid,
                "first_violation_time_sec": metrics.first_violation_time_sec,
                "violations_log": metrics.violations_log,
                "safety_violations": [sv.model_dump() for sv in metrics.safety_violations],
                "objective_score": obj_score,
                "total_delay_min": metrics.total_delay_min,
                "max_delay_min": metrics.max_delay_min,
                "throughput_trains_hr": metrics.throughput_trains_hr,
                "conflicts_count": metrics.conflicts_count,
                "peak_conflicts": metrics.peak_conflicts,
                "is_recommended": False,
                "metrics": metrics
            })

        # Filter safety-valid candidates
        safe_candidates = [p for p in evaluated_plans if p["safety_valid"]]

        if not safe_candidates:
            status = "NO_SAFE_PLAN"
            selected_cand_id = None
            selected_metrics = None
            delta = {
                "delay_saved_min": 0.0,
                "avg_delay_saved_min": 0.0,
                "throughput_gain_pct": 0.0,
                "conflicts_prevented": 0.0
            }
        else:
            safe_candidates.sort(key=lambda x: x["objective_score"])
            best = safe_candidates[0]
            best["is_recommended"] = True
            selected_cand_id = best["candidate_id"]
            selected_metrics = best["metrics"]

            if selected_cand_id == "OPT_C" and baseline_metrics.conflicts_count == 0:
                status = "NO_INTERVENTION_REQUIRED"
            else:
                status = "SELECTED"

            delay_saved = round(max(0.0, baseline_metrics.total_delay_min - selected_metrics.total_delay_min), 1)
            avg_delay_saved = round(max(0.0, baseline_metrics.avg_delay_min - selected_metrics.avg_delay_min), 1)
            t_gain = (
                round(((selected_metrics.throughput_trains_hr - baseline_metrics.throughput_trains_hr) / baseline_metrics.throughput_trains_hr) * 100.0, 1)
                if baseline_metrics.throughput_trains_hr > 0 else 0.0
            )
            conf_prev = max(0, baseline_metrics.conflicts_count - selected_metrics.conflicts_count)

            delta = {
                "delay_saved_min": delay_saved,
                "avg_delay_saved_min": avg_delay_saved,
                "throughput_gain_pct": t_gain,
                "conflicts_prevented": float(conf_prev)
            }

        # Format alternatives for counterfactual exploration and UI
        alternatives = []
        for p in evaluated_plans:
            met = p["metrics"]
            is_rec = p["is_recommended"]
            viol_count = len(p["safety_violations"]) + (0 if p["safety_valid"] else 1)
            alternatives.append({
                "option_id": p["candidate_id"],
                "name": p["name"],
                "strategy": p["strategy"],
                "actions": p["actions"],
                "safety_valid": p["safety_valid"],
                "safety": "PASSED (0 Violations)" if p["safety_valid"] else f"FAILED ({viol_count} Violations)",
                "feasibility": "FEASIBLE" if p["safety_valid"] else "INFEASIBLE",
                "relative_preference": "SELECTED OPTIMAL PLAN" if is_rec else "ALTERNATIVE REJECTED",
                "first_violation_time_sec": p["first_violation_time_sec"],
                "violations_log": p["violations_log"],
                "objective_score": f"J = {p['objective_score']}",
                "is_recommended": is_rec,
                "metrics": {
                    "total_delay_min": met.total_delay_min,
                    "max_delay_min": met.max_delay_min,
                    "throughput_trains_hr": met.throughput_trains_hr,
                    "conflicts_count": met.conflicts_count,
                    "peak_conflicts": met.peak_conflicts
                }
            })

        return DecisionEvaluation(
            baseline=baseline_metrics,
            selected_plan=selected_metrics,
            selected_candidate_id=selected_cand_id,
            status=status,
            delta=delta,
            alternatives=alternatives,
            candidate_schedules=[
                {
                    "schedule_id": cs.schedule_id,
                    "name": cs.name,
                    "strategy": cs.strategy,
                    "actions": [a.model_dump() for a in cs.actions]
                }
                for cs in all_candidates
            ]
        )

    def _resolve_loop_block(self, train: Train, fallback_block_id: Optional[str] = None) -> str:
        """Resolve the authentic physical station loop block for a train."""
        network = self.base_engine.network
        if fallback_block_id and fallback_block_id in network.blocks:
            cand = network.blocks[fallback_block_id]
            if cand.block_type in ("LOOP_LINE", "STATION_LOOP"):
                return fallback_block_id

        curr_blk = network.get_block(train.current_block_id) if train.current_block_id else None
        candidate_nodes = []
        if curr_blk:
            candidate_nodes.extend([curr_blk.from_node, curr_blk.to_node])
        for node in candidate_nodes:
            if node in network.stations:
                stn = network.stations[node]
                for l_id in stn.loop_blocks:
                    if l_id in network.blocks:
                        cand = network.blocks[l_id]
                        if not cand.is_occupied and not cand.is_blocked:
                            return l_id

        for blk in network.blocks.values():
            if blk.block_type in ("LOOP_LINE", "STATION_LOOP"):
                if not blk.is_occupied and not blk.is_blocked:
                    return blk.id

        curr_node = curr_blk.from_node if curr_blk else "STN"
        return f"BLK_{curr_node}_LOOP_1"

    def generate_candidate_schedules(
        self,
        primary_train: Train,
        conflicting_train: Train,
        target_block_id: Optional[str] = None,
        hold_duration_sec: float = 300.0,
        optimized_score: Optional[float] = None,
        solver_name: Optional[str] = None,
        solver_status: Optional[str] = None,
        horizon_sec: float = 900.0,
        candidate_schedules: Optional[List[CandidateSchedule]] = None
    ) -> DecisionEvaluation:
        """
        Formulates standard candidate dispatch options or evaluates direct optimizer candidate schedules closed-loop.
        """
        if candidate_schedules and len(candidate_schedules) > 0:
            schedules_to_evaluate = candidate_schedules
        else:
            loop_conflicting = self._resolve_loop_block(conflicting_train, target_block_id)
            loop_primary = self._resolve_loop_block(primary_train, target_block_id)

            cand_a = CandidateSchedule(
                schedule_id="OPT_A",
                name=f"Hold Conflicting Train {conflicting_train.train_id}",
                strategy="PRIORITY_LOOP_HOLD",
                actions=[
                    CandidateAction(
                        action_type=CandidateActionType.LOOP_PRECEDENCE,
                        train_id=conflicting_train.train_id,
                        target_block_id=loop_conflicting,
                        duration_sec=hold_duration_sec,
                        description=f"Divert {conflicting_train.train_id} to loop {loop_conflicting}"
                    )
                ]
            )

            cand_b = CandidateSchedule(
                schedule_id="OPT_B",
                name=f"Hold Primary Train {primary_train.train_id}",
                strategy="REVERSE_PRECEDENCE_HOLD",
                actions=[
                    CandidateAction(
                        action_type=CandidateActionType.LOOP_PRECEDENCE,
                        train_id=primary_train.train_id,
                        target_block_id=loop_primary,
                        duration_sec=hold_duration_sec,
                        description=f"Divert {primary_train.train_id} to loop {loop_primary}"
                    )
                ]
            )
            schedules_to_evaluate = [cand_a, cand_b]

        return self.evaluate_candidate_schedules(
            candidate_schedules=schedules_to_evaluate,
            primary_train=primary_train,
            conflicting_train=conflicting_train,
            optimized_score=optimized_score,
            solver_name=solver_name,
            solver_status=solver_status,
            horizon_sec=horizon_sec
        )

    # Backward-compatible method name alias
    evaluate_decision_candidates = generate_candidate_schedules
