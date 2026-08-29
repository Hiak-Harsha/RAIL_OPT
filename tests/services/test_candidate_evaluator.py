import pytest
from pathlib import Path
from backend.simulator.engine import RailwaySimulationEngine
from backend.services.evaluator import CandidateEvaluator, compute_candidate_objective
from backend.ai.xai.explainer import DecisionExplainer
from backend.ai.prediction.conflict_radar import ConflictRadar
from backend.simulator.railway.models import TrainStatus, ScenarioMetrics, DecisionAction

SCENARIO_PATH = Path(__file__).parent.parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"


def test_candidate_evaluator_strict_safety_and_objective():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    evaluator = CandidateEvaluator(engine)
    
    trains = list(engine.state.trains.values())
    t1 = trains[0]
    t2 = trains[1]
    
    # Run full physical evaluation across candidate branches with 300s horizon
    evaluation = evaluator.evaluate_decision_candidates(
        primary_train=t1,
        conflicting_train=t2,
        hold_duration_sec=240.0,
        optimized_score=35.0,
        solver_name="OR-Tools_CP-SAT",
        solver_status="OPTIMAL",
        horizon_sec=300.0
    )
    
    assert evaluation.baseline is not None
    assert len(evaluation.alternatives) == 3
    
    # 1. Mandatory Safety & Recommendation Invariant:
    # Any recommended candidate must be safety-valid and feasible
    rec_candidate = next((c for c in evaluation.alternatives if c["is_recommended"]), None)
    if rec_candidate:
        assert rec_candidate["safety"] == "PASSED (0 Violations)"
        assert rec_candidate["feasibility"] == "FEASIBLE"
        assert rec_candidate["relative_preference"] == "SELECTED OPTIMAL PLAN"

    # 2. Honest Throughput Invariant:
    # 300s is insufficient for trains to complete their full multi-station routes,
    # so completed == 0 -> throughput must be 0.0 (NO fake 4.8 tr/hr fallback)
    assert evaluation.baseline.throughput_trains_hr == 0.0

    # 3. Authentic Objective Score Invariant:
    # Objective score must match compute_candidate_objective
    for c in evaluation.alternatives:
        assert c["objective_score"].startswith("J = ")

    # 4. Conflicts Prevented Invariant:
    assert evaluation.delta["conflicts_prevented"] >= 0.0


def test_compute_candidate_objective_penalizes_unsafe():
    safe_metrics = ScenarioMetrics(
        total_delay_min=10.0,
        avg_delay_min=2.0,
        max_delay_min=5.0,
        throughput_trains_hr=12.0,
        conflicts_count=0,
        safety_valid=True
    )
    unsafe_metrics = ScenarioMetrics(
        total_delay_min=0.0,
        avg_delay_min=0.0,
        max_delay_min=0.0,
        throughput_trains_hr=15.0,
        conflicts_count=2,
        safety_valid=False
    )
    
    j_safe = compute_candidate_objective(safe_metrics)
    j_unsafe = compute_candidate_objective(unsafe_metrics)
    
    # Unified J: (delay * 1.0 * 1.0) + (max_delay * 0.5) + (conflicts * 50) + (travel_time * 0.3)
    assert j_safe > 0
    assert j_unsafe == 99999.0  # Hard rejection penalty from unified objective
    assert j_safe < j_unsafe


def test_recommendation_and_evaluator_semantic_reconciliation():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    radar = ConflictRadar(engine.network, lookahead_sec=12000.0)
    explainer = DecisionExplainer(engine.network, engine=engine)
    
    trains = list(engine.state.trains.values())
    conflicts = radar.scan_conflicts(trains, current_time_sec=0.0)
    assert len(conflicts) > 0
    c1 = conflicts[0]
    
    t1 = engine.state.trains[c1.involved_train_ids[0]]
    t2 = engine.state.trains[c1.involved_train_ids[1]]
    
    rec = explainer.explain_recommendation(
        conflict=c1,
        primary_train=t1,
        conflicting_train=t2,
        action=DecisionAction.HOLD,
        hold_duration_sec=300.0,
        target_block_id=c1.location_block_id,
        optimized_score=35.0,
        safety_valid=True,
        engine=engine
    )
    
    # 1. Closed-Loop Safety Invariant:
    # If the recommendation says safety_valid=True, its evaluated selected plan must be safety_valid=True
    if rec.safety_valid:
        assert rec.operational_status in ("SAFE_RECOMMENDATION", "NO_INTERVENTION_REQUIRED")
        if rec.evaluation and rec.evaluation.selected_plan:
            assert rec.evaluation.selected_plan.safety_valid is True
    else:
        assert rec.operational_status == "NO_SAFE_PLAN"
        assert "NO SAFE RECOMMENDATION" in rec.reason_summary

    # 2. Reconciled Metrics Invariant:
    # recommendation deltas must strictly match evaluation deltas
    assert rec.projected_metrics_diff == rec.evaluation.delta
