import pytest
from pathlib import Path
from backend.simulator.engine import RailwaySimulationEngine
from backend.ai.prediction.conflict_radar import ConflictRadar
from backend.ai.prediction.delay_propagation import DelayPropagationEstimator
from backend.ai.xai.explainer import DecisionExplainer
from backend.simulator.railway.models import DecisionAction


@pytest.fixture
def sim_engine():
    scenario_path = Path(__file__).parent.parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"
    return RailwaySimulationEngine(str(scenario_path))


def test_conflict_radar_predicts_crossing_conflicts(sim_engine):
    radar = ConflictRadar(sim_engine.network, lookahead_sec=12000.0)
    trains = list(sim_engine.state.trains.values())
    
    conflicts = radar.scan_conflicts(trains, current_time_sec=0.0)
    assert len(conflicts) > 0
    c1 = conflicts[0]
    assert c1.location_block_id is not None
    assert len(c1.involved_train_ids) == 2


def test_delay_propagation_downstream_impact(sim_engine):
    estimator = DelayPropagationEstimator(sim_engine.network)
    trains = list(sim_engine.state.trains.values())
    primary = trains[0]
    other_trains = trains[1:]
    
    report = estimator.compute_propagation(primary, injected_delay_sec=900.0, other_trains=other_trains)
    assert report.primary_delayed_train_id == primary.train_id
    assert report.total_unmitigated_network_delay_min > report.primary_delay_min
    assert report.net_delay_savings_min > 0
    assert report.delay_mitigation_efficiency_pct > 0


def test_xai_explainer_generates_defensible_reasons(sim_engine):
    radar = ConflictRadar(sim_engine.network, lookahead_sec=12000.0)
    explainer = DecisionExplainer(sim_engine.network)
    trains = list(sim_engine.state.trains.values())
    
    conflicts = radar.scan_conflicts(trains, current_time_sec=0.0)
    assert len(conflicts) > 0
    c1 = conflicts[0]
    
    t1 = sim_engine.state.trains[c1.involved_train_ids[0]]
    t2 = sim_engine.state.trains[c1.involved_train_ids[1]]
    
    rec = explainer.explain_recommendation(
        conflict=c1,
        primary_train=t1,
        conflicting_train=t2,
        action=DecisionAction.HOLD,
        hold_duration_sec=300.0,
        target_block_id=c1.location_block_id,
        optimized_score=35.0,
        safety_valid=True
    )
    assert rec.recommendation_id.startswith("REC_")
    assert len(rec.reasons_bullet_points) >= 2
    assert any(c["is_recommended"] for c in rec.counterfactual_options)


def test_radar_respects_scheduled_train_departure(sim_engine):
    """Verify that a train scheduled in the future does not cause immediate 0-sec conflicts at t=200s"""
    radar = ConflictRadar(sim_engine.network, lookahead_sec=3600.0)
    trains = list(sim_engine.state.trains.values())
    
    # At simulation time = 200s, T04403 is scheduled at 400s
    conflicts_at_200 = radar.scan_conflicts(trains, current_time_sec=200.0)
    for c in conflicts_at_200:
        if "T04403" in c.involved_train_ids:
            # Time to conflict must be > 0 (e.g. > 100s in the future)
            assert c.time_to_conflict_sec > 100.0, f"False immediate conflict detected for scheduled train: {c.time_to_conflict_sec}s"
            assert c.conflict_state in ("PREDICTED", "POTENTIAL")

