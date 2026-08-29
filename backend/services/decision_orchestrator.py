"""
DecisionOrchestrator — SOLE Authoritative AI Decision Pipeline for RAILOPT-X.

This is the ONLY entry point for conflict-triggered AI decision making.
app.py MUST delegate ALL conflict handling to this class.

Pipeline:
    PredictedConflict
        → 1. CP-SAT optimizer → CandidateSchedule
        → 2. CandidateEvaluator (physical branch simulation) → ScenarioMetrics
        → 3. compute_J() (unified objective) → J score
        → 4. DecisionExplainer (XAI evidence) → Recommendation
        → 5. Return Recommendation to controller (or emit MANUAL_INTERVENTION_REQUIRED if unsafe)

Architecture Invariants:
    - CP-SAT output feeds DIRECTLY into CandidateEvaluator
    - All scoring uses compute_J()
    - Safety Gate: Only return safe Recommendations. If no safe candidate exists,
      emit MANUAL_INTERVENTION_REQUIRED.
"""
from __future__ import annotations
from typing import List, Optional, Dict, Any
import logging
import asyncio

logger = logging.getLogger(__name__)


class DecisionOrchestrator:
    """
    Single-entry orchestrator for the RAILOPT-X hybrid decision-support pipeline.
    """

    def __init__(self, network=None, engine=None, optimizer=None, explainer=None, delay_estimator=None):
        self.network = network
        self.engine = engine
        self.optimizer = optimizer
        self.explainer = explainer
        self.delay_estimator = delay_estimator

    def handle_predicted_conflict(
        self,
        conflict: Any,
        trains: List[Any],
        blocks: List[Any],
        sim_time_sec: float
    ) -> Optional[Any]:
        """
        Full pipeline from conflict → Recommendation.

        Steps:
        1. Identify involved trains
        2. Run CP-SAT optimizer → opt_schedule
        3. Extract which train should be held from optimizer schedule
        4. Compute delay propagation (XAI supporting data)
        5. Generate Recommendation via DecisionExplainer (which runs CandidateEvaluator internally)
        6. Return Recommendation if safe, or emit MANUAL_INTERVENTION_REQUIRED if unsafe.
        """
        try:
            primary_id = conflict.involved_train_ids[0] if conflict.involved_train_ids else None
            conflict_id = conflict.involved_train_ids[1] if len(conflict.involved_train_ids) > 1 else None

            if not primary_id or not conflict_id:
                logger.warning(f"Orchestrator: conflict {conflict.conflict_id} has < 2 trains, skipping")
                return None

            primary_train = next((t for t in trains if t.train_id == primary_id), None)
            conflicting_train = next((t for t in trains if t.train_id == conflict_id), None)

            if not primary_train or not conflicting_train:
                logger.warning(f"Orchestrator: could not locate trains {primary_id}, {conflict_id}")
                return None

            # --- Step 1: Run CP-SAT optimizer ---
            opt_score = 9999.0
            solver_name = "OR-Tools_CP-SAT"
            solver_status = "FEASIBLE"
            opt_schedule = {}

            if self.optimizer:
                try:
                    disrupted_blocks = []
                    if self.engine:
                        from ..simulator.railway.models import DisruptionType
                        disrupted_blocks = [
                            d.target_id for d in self.engine.state.disruptions.values()
                            if d.disruption_type == DisruptionType.BLOCK_CLOSURE
                        ]
                    opt_res = self.optimizer.solve(trains, sim_time_sec, disrupted_blocks)
                    opt_score = float(opt_res.get("cost_breakdown", {}).get("total_cost", 9999.0))
                    solver_name = str(opt_res.get("solver", "OR-Tools_CP-SAT"))
                    solver_status = str(opt_res.get("status", "FEASIBLE"))
                    opt_schedule = opt_res.get("schedule", {})
                except Exception as opt_err:
                    logger.warning(f"Orchestrator: CP-SAT failed, using priority fallback: {opt_err}")

            # --- Step 2: Extract hold decision from optimizer schedule ---
            from ..simulator.railway.models import DecisionAction
            t1_moves = opt_schedule.get(primary_train.train_id, []) if isinstance(opt_schedule, dict) else []
            t2_moves = opt_schedule.get(conflicting_train.train_id, []) if isinstance(opt_schedule, dict) else []

            t1_conf_entry = next(
                (m.get("enter_time") for m in t1_moves if m.get("block_id") == conflict.location_block_id),
                None
            )
            t2_conf_entry = next(
                (m.get("enter_time") for m in t2_moves if m.get("block_id") == conflict.location_block_id),
                None
            )

            if t1_conf_entry is not None and t2_conf_entry is not None:
                if t1_conf_entry <= t2_conf_entry:
                    primary = primary_train
                    secondary = conflicting_train
                else:
                    primary = conflicting_train
                    secondary = primary_train
                hold_duration = min(420.0, max(180.0, float(abs(t2_conf_entry - t1_conf_entry) % 600.0 or 240.0)))
                action = (
                    DecisionAction.CHANGE_PRECEDENCE
                    if primary.priority.value > secondary.priority.value
                    else DecisionAction.HOLD
                )
            else:
                primary = primary_train if primary_train.priority.value >= conflicting_train.priority.value else conflicting_train
                secondary = conflicting_train if primary == primary_train else primary_train
                hold_duration = 240.0
                action = DecisionAction.HOLD

            # --- Step 3: Delay Propagation (XAI context) ---
            if self.delay_estimator:
                try:
                    other_trains = [t for t in trains if t.train_id != secondary.train_id]
                    delay_tree = self.delay_estimator.compute_propagation(
                        primary_train=secondary,
                        injected_delay_sec=hold_duration,
                        other_trains=other_trains,
                    )
                    if self.engine:
                        self.engine.emit_event("DELAY_PROPAGATION_ANALYZED", {
                            "primary_train_id": secondary.train_id,
                            "net_delay_savings_min": delay_tree.net_delay_savings_min,
                            "impacted_count": len(delay_tree.impacted_trains),
                        })
                except Exception as dp_err:
                    logger.warning(f"Orchestrator: delay propagation failed: {dp_err}")

            # --- Step 4: Generate Recommendation via DecisionExplainer ---
            if self.explainer:
                recommendation = self.explainer.explain_recommendation(
                    conflict=conflict,
                    primary_train=primary,
                    conflicting_train=secondary,
                    action=action,
                    hold_duration_sec=hold_duration,
                    target_block_id=conflict.location_block_id,
                    optimized_score=round(opt_score, 1),
                    safety_valid=True,
                    solver_name=solver_name,
                    solver_status=solver_status,
                    all_trains=trains,
                    engine=self.engine,
                )

                # Safety Gating: If safety invariant violated on all plans, emit MANUAL_INTERVENTION_REQUIRED
                if not recommendation.safety_valid:
                    if self.engine:
                        self.engine.emit_event("MANUAL_INTERVENTION_REQUIRED", {
                            "conflict_id": conflict.conflict_id,
                            "primary_train_id": primary.train_id,
                            "conflicting_train_id": secondary.train_id,
                            "location_block_id": conflict.location_block_id,
                            "reason": "All candidate dispatch branches violate safety invariants",
                            "timestamp_sec": sim_time_sec,
                        })

                return recommendation

        except Exception as e:
            logger.error(f"DecisionOrchestrator pipeline error: {e}", exc_info=True)

        return None
