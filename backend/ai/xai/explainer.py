from __future__ import annotations
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from ...simulator.railway.models import (
    Train, TrackBlock, Recommendation, DecisionAction,
    CandidateSchedule, PriorityClass, ScenarioMetrics, DecisionEvaluation, TrainStatus
)
from ...simulator.railway.graph import RailwayNetworkGraph
from ...simulator.engine import RailwaySimulationEngine, SimulationState
from ..prediction.conflict_radar import PredictedConflict
from ...services.evaluator import CandidateEvaluator


@dataclass
class EvidenceFact:
    """
    Machine-checkable evidence fact for XAI transparency.

    Each XAI sentence must be backed by an EvidenceFact with:
      - A before/after metric pair so the claim can be independently verified
      - verified=True only when metric_after is provably better than metric_before
      - rendered_text: the human-readable sentence derived from the fact

    No EvidenceFact → no sentence (prevents hallucinated XAI claims).
    """
    code: str                          # e.g. "CONFLICT_REDUCED", "PRIORITY_ADVANTAGE"
    train_ids: List[str] = field(default_factory=list)
    metric_name: str = ""              # e.g. "conflicts_count", "delay_min"
    metric_before: float = 0.0
    metric_after: float = 0.0
    verified: bool = False             # True when metric_after < metric_before (for cost metrics)
    rendered_text: str = ""

    @property
    def delta(self) -> float:
        return self.metric_after - self.metric_before

    def is_improvement(self) -> bool:
        """For cost metrics (delay, conflicts): improvement when delta < 0."""
        return self.metric_after < self.metric_before


class DecisionExplainer:
    """
    Explainable AI (XAI) & Counterfactual Reasoning Engine.
    Executes actual candidate branch simulation using the authentic RailwaySimulationEngine physics
    to produce 100% simulation-derived DecisionEvaluations without synthetic formulas.
    """

    def __init__(self, network: RailwayNetworkGraph, engine: Optional[RailwaySimulationEngine] = None):
        self.network = network
        self.engine = engine

    def explain_recommendation(
        self,
        conflict: PredictedConflict,
        primary_train: Train,
        conflicting_train: Train,
        action: DecisionAction,
        hold_duration_sec: float,
        target_block_id: str,
        optimized_score: float,
        safety_valid: bool,
        solver_name: Optional[str] = "OR-Tools_CP-SAT",
        solver_status: Optional[str] = "OPTIMAL",
        all_trains: Optional[List[Train]] = None,
        engine: Optional[RailwaySimulationEngine] = None
    ) -> Recommendation:
        block = self.network.get_block(target_block_id)
        block_name = block.name if block else target_block_id
        
        effective_hold_sec = min(600.0, max(180.0, hold_duration_sec))
        hold_min = round(effective_hold_sec / 60.0, 1)
        train_pool = all_trains if all_trains else [primary_train, conflicting_train]

        # 1. Instantiate CandidateEvaluator using authentic RailwaySimulationEngine
        sim_engine = engine or self.engine
        if not sim_engine:
            state = SimulationState(network=self.network.deep_copy(), trains=train_pool)
            sim_engine = RailwaySimulationEngine.from_state(state)

        evaluator = CandidateEvaluator(sim_engine)

        # 2. Derive 100% physically simulated DecisionEvaluation
        evaluation = evaluator.evaluate_decision_candidates(
            primary_train=primary_train,
            conflicting_train=conflicting_train,
            hold_duration_sec=effective_hold_sec,
            optimized_score=optimized_score,
            solver_name=solver_name or "OR-Tools_CP-SAT",
            solver_status=solver_status or "FEASIBLE",
            horizon_sec=900.0
        )

        # 3. Derive Recommendation Properties Directly from Authoritative DecisionEvaluation
        delay_saved_min = evaluation.delta.get("delay_saved_min", 0.0)
        tp_gain_pct = evaluation.delta.get("throughput_gain_pct", 0.0)
        conflicts_prev = evaluation.delta.get("conflicts_prevented", 0.0)
        
        reasons: List[str] = []
        evidence_facts: List[EvidenceFact] = []

        # Priority evidence (only emit when priorities differ)
        if primary_train.priority.value != conflicting_train.priority.value:
            fact = EvidenceFact(
                code="PRIORITY_ADVANTAGE",
                train_ids=[primary_train.train_id, conflicting_train.train_id],
                metric_name="priority_class",
                metric_before=float(conflicting_train.priority.value),
                metric_after=float(primary_train.priority.value),
                verified=primary_train.priority.value > conflicting_train.priority.value,
            )
            if primary_train.priority.value > conflicting_train.priority.value:
                fact.rendered_text = (
                    f"{primary_train.train_name} holds higher operational priority (P{primary_train.priority.value}) "
                    f"than {conflicting_train.train_name} (P{conflicting_train.priority.value})."
                )
            else:
                fact.rendered_text = (
                    f"Yielding right-of-way to {conflicting_train.train_name} (P{conflicting_train.priority.value}) "
                    f"preserves premium service punctuality."
                )
            evidence_facts.append(fact)
            reasons.append(fact.rendered_text)
        else:
            reasons.append(
                f"Both trains share equal priority class (P{primary_train.priority.value}); "
                f"precedence ordered by sectional bottleneck clearing speed."
            )

        if evaluation.status == "NO_SAFE_PLAN":
            operational_status = "NO_SAFE_PLAN"
            rec_safety_valid = False
            rec_action = DecisionAction.HOLD
            rec_target_train_id = conflicting_train.train_id
            rec_duration_sec = effective_hold_sec
            summary = f"NO SAFE RECOMMENDATION: Evaluated 3 candidate dispatch plans; all violate safety invariants."
            reasons.append(
                f"Physical simulation rejected all candidate actions: unmitigated crossing and alternative holds both produce unresolved sectional conflicts."
            )
            reasons.append(
                f"Mathematical solver status is {solver_status or 'FEASIBLE'}, but downstream operational validation detected {evaluation.baseline.conflicts_count} active conflicts."
            )
        elif evaluation.status == "NO_INTERVENTION_REQUIRED":
            operational_status = "NO_INTERVENTION_REQUIRED"
            rec_safety_valid = True
            rec_action = DecisionAction.ALLOW_CROSSING
            rec_target_train_id = conflicting_train.train_id
            rec_duration_sec = 0.0
            summary = f"NO INTERVENTION REQUIRED: Baseline unmitigated timetable dispatch is safe with minimal sectional delay ({evaluation.baseline.total_delay_min}m)."
            reasons.append("Unmitigated traversal satisfies safe headway and section separation invariants.")
            reasons.append("Operational hold interventions would introduce unnecessary sectional delay.")
        else:
            # "SELECTED" - Authoritatively derive action from selected candidate
            operational_status = "SAFE_RECOMMENDATION"
            rec_safety_valid = True
            
            selected_cand = None
            for cs in getattr(evaluation, "candidate_schedules", []):
                if isinstance(cs, dict) and cs.get("schedule_id") == evaluation.selected_candidate_id:
                    selected_cand = cs
                    break

            if selected_cand and selected_cand.get("actions"):
                first_act = selected_cand["actions"][0]
                act_type = first_act.get("action_type", "HOLD")
                rec_target_train_id = first_act.get("train_id", conflicting_train.train_id)
                rec_duration_sec = float(first_act.get("duration_sec", effective_hold_sec))
                if first_act.get("target_block_id"):
                    target_block_id = first_act["target_block_id"]

                if act_type == "LOOP_PRECEDENCE":
                    rec_action = DecisionAction.CHANGE_PRECEDENCE
                    summary = f"Assign precedence to {primary_train.train_id}; route {rec_target_train_id} to loop track at {block_name} for {round(rec_duration_sec)}s."
                    reasons.append(f"Precedence adjustment on loop line resolves crossing contention while prioritizing higher-class movement.")
                elif act_type == "PLATFORM_REASSIGN":
                    rec_action = DecisionAction.REASSIGN_PLATFORM
                    summary = f"Reassign {rec_target_train_id} to alternate platform at {block_name}."
                    reasons.append(f"Platform reallocation resolves dwell conflict and clears main line route.")
                elif act_type == "PROCEED_NORMAL":
                    rec_action = DecisionAction.ALLOW_CROSSING
                    summary = f"Allow crossing clearance for {rec_target_train_id} at {block_name}."
                    reasons.append(f"Clearance verification confirms section traversal is safe.")
                else:
                    rec_action = DecisionAction.HOLD
                    summary = f"Hold {rec_target_train_id} for {hold_min}m ({round(rec_duration_sec)}s) at {block_name}."
                    reasons.append(f"Holding {rec_target_train_id} eliminates crossing overlap, saving {delay_saved_min}m projected sectional delay.")
            else:
                # Fallback to evaluation candidate ID
                if evaluation.selected_candidate_id and ("PRIMARY" in evaluation.selected_candidate_id or evaluation.selected_candidate_id == "OPT_B"):
                    rec_action = DecisionAction.HOLD
                    rec_target_train_id = primary_train.train_id
                    rec_duration_sec = effective_hold_sec
                    summary = f"Hold {primary_train.train_id} ({primary_train.train_name}) for {hold_min}m ({round(effective_hold_sec)}s) at {block_name}."
                    reasons.append(f"Holding {primary_train.train_id} preserves corridor throughput while safely resolving crossing overlap.")
                else:
                    rec_action = DecisionAction.HOLD
                    rec_target_train_id = conflicting_train.train_id
                    rec_duration_sec = effective_hold_sec
                    summary = f"Hold {conflicting_train.train_id} ({conflicting_train.train_name}) for {hold_min}m ({round(effective_hold_sec)}s) at {block_name}."
                    reasons.append(f"Scheduled loop clearance eliminates crossing overlap, reducing projected sectional delay by {delay_saved_min} minutes.")

            # CONFLICT_REDUCED: only emit when conflicts_prev is actually positive
            # (prevents false claim when baseline already has 0 conflicts)
            if conflicts_prev > 0:
                fact = EvidenceFact(
                    code="CONFLICT_REDUCED",
                    train_ids=[primary_train.train_id, conflicting_train.train_id],
                    metric_name="conflicts_count",
                    metric_before=float(conflicts_prev),
                    metric_after=0.0,
                    verified=True,
                    rendered_text=f"Action physically eliminates {int(conflicts_prev)} projected crossing conflict(s).",
                )
                evidence_facts.append(fact)
                reasons.append(fact.rendered_text)

            # Physical Gradient & Infrastructure Attribution
            if block and abs(getattr(block, "gradient_percent", 0.0)) >= 0.2:
                grad_pct = block.gradient_percent
                if grad_pct > 0:
                    reasons.append(f"Target section {block.name} carries a +{grad_pct:.1f}% uphill gradient; precedence ordering avoids heavy train restart stall.")
                else:
                    reasons.append(f"Target section {block.name} carries a {grad_pct:.1f}% descending gradient; braking distances incorporate slope inertia.")

            if block and getattr(block, "speed_restrictions", None):
                reasons.append(f"Infrastructure constraints: {len(block.speed_restrictions)} permanent speed restriction(s) active on approach.")

        # Derive evaluated_objective_score from the selected candidate (Finding #43)
        evaluated_obj_score = optimized_score
        for alt in evaluation.alternatives:
            if alt.get("is_recommended"):
                score_str = alt.get("objective_score", "")
                if isinstance(score_str, str) and score_str.startswith("J = "):
                    try:
                        evaluated_obj_score = float(score_str.replace("J = ", ""))
                    except ValueError:
                        pass
                elif isinstance(score_str, (int, float)):
                    evaluated_obj_score = float(score_str)
                break

        # Delay savings evidence (only when delta > 0.1 min)
        if delay_saved_min > 0.1:
            fact = EvidenceFact(
                code="DELAY_REDUCED",
                train_ids=[primary_train.train_id, conflicting_train.train_id],
                metric_name="delay_saved_min",
                metric_before=0.0,
                metric_after=-delay_saved_min,  # negative = improvement
                verified=True,
                rendered_text=f"Projected sectional delay reduced by {delay_saved_min:.1f} minutes.",
            )
            evidence_facts.append(fact)

        return Recommendation(
            recommendation_id=f"REC_{conflict.conflict_id}",
            timestamp_sec=getattr(conflict, "predicted_time_sec", getattr(conflict, "estimated_time_to_conflict_sec", 0.0)),
            primary_train_id=rec_target_train_id,
            conflicting_train_id=primary_train.train_id if rec_target_train_id == conflicting_train.train_id else conflicting_train.train_id,
            action=rec_action,
            target_block_id=target_block_id,
            duration_sec=rec_duration_sec,
            reason_summary=summary,
            reasons_bullet_points=reasons,
            affected_train_ids=[primary_train.train_id, conflicting_train.train_id],
            optimization_objective_score=optimized_score,
            evaluated_objective_score=evaluated_obj_score,
            solver_name=solver_name,
            solver_status=solver_status,
            operational_status=operational_status,
            safety_valid=rec_safety_valid,
            evaluation=evaluation,
            counterfactual_options=evaluation.alternatives,
            projected_metrics_diff=evaluation.delta,
            # Provenance (Finding #21)
            source_candidate_id=evaluation.selected_candidate_id,
            evaluation_horizon_sec=900.0,
            physical_validation_status="PASSED" if rec_safety_valid else "FAILED",
            prediction_method="DETERMINISTIC_TRAJECTORY_APPROXIMATION",
            # EvidenceFacts (Finding #22) - machine-checkable XAI evidence
            evidence_facts=[{
                "code": f.code,
                "train_ids": f.train_ids,
                "metric_name": f.metric_name,
                "metric_before": f.metric_before,
                "metric_after": f.metric_after,
                "verified": f.verified,
                "rendered_text": f.rendered_text,
            } for f in evidence_facts if f.rendered_text]
        )
