"""Regression tests for the evaluated-candidate → preview → execution contract."""
from pathlib import Path

from backend.simulator.engine import RailwaySimulationEngine
from backend.simulator.railway.models import TrainStatus
from backend.simulator.what_if import WhatIfSimulator


SCENARIO_PATH = Path(__file__).parents[2] / "backend" / "data" / "scenarios" / "synthetic_section.json"


def test_candidate_preview_isolated_and_uses_live_physics():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    train = next(iter(engine.state.trains.values()))
    original_status = train.status

    preview = engine.preview_candidate_actions([{
        "action_type": "HOLD", "train_id": train.train_id,
        "target_block_id": train.current_block_id, "duration_sec": 120,
    }], horizon_sec=60, sample_every_sec=30)

    assert preview["status"] == "SUCCESS"
    assert len(preview["frames"]) == 3
    # A preview must never mutate the live digital twin.
    assert engine.state.trains[train.train_id].status == original_status


def test_candidate_execution_applies_the_evaluated_action_not_a_label():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    train = next(iter(engine.state.trains.values()))
    original_mainline_block = train.current_block_id or train.route_block_ids[0]

    result = engine.apply_candidate_actions([{
        "action_type": "LOOP_PRECEDENCE", "train_id": train.train_id,
        "target_block_id": original_mainline_block, "duration_sec": 180,
    }])

    assert result["status"] == "SUCCESS"
    assert result["applied"][0]["controller_action"] == "LOOP_PRECEDENCE"
    
    updated_train = engine.state.trains[train.train_id]
    assert updated_train.status == TrainStatus.WAITING
    assert updated_train.held_at_block_id is not None
    assert "LOOP" in updated_train.held_at_block_id, f"Target block {updated_train.held_at_block_id} must be a genuine loop block"
    assert updated_train.current_block_id == updated_train.held_at_block_id
    assert updated_train.held_at_block_id in updated_train.route_block_ids
    
    # Verify the mainline block is no longer occupied by this train
    if original_mainline_block and original_mainline_block != updated_train.held_at_block_id:
        old_blk = engine.network.get_block(original_mainline_block)
        if old_blk:
            assert old_blk.occupied_by_train_id != train.train_id


def test_snapshot_exposes_topology_derived_chainage_for_the_renderer():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    # The synthetic timetable's first departure is after T+300s.  Test a
    # genuine moving-train state rather than asserting motion before departure.
    engine.fast_forward_to(360.0)
    snapshot = engine.get_snapshot()
    moving = next(t for t in snapshot["trains"] if t["current_block_id"])
    assert "corridor_position_km" in moving
    # This is absolute corridor location, not the per-block integration distance.
    assert moving["corridor_position_km"] >= 0.0


def test_candidate_speed_restriction_is_an_actual_tsr_not_a_hidden_hold():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    train = next(iter(engine.state.trains.values()))
    block_id = train.route_block_ids[0]
    result = engine.apply_candidate_actions([{
        "action_type": "SPEED_RESTRICT", "train_id": train.train_id,
        "target_block_id": block_id, "restricted_speed_kmh": 40,
    }])
    assert result["status"] == "SUCCESS"
    assert engine.network.get_block(block_id).current_speed_limit_kmh == 40


def test_what_if_can_include_an_exact_controller_physics_branch():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    train = next(iter(engine.state.trains.values()))
    report = WhatIfSimulator(engine).run_what_if_analysis([], [{
        "action_type": "SPEED_RESTRICT", "train_id": train.train_id,
        "target_block_id": train.route_block_ids[0], "restricted_speed_kmh": 45,
    }])
    assert any(s.scenario_id == "SCEN_CONTROLLER_PHYSICS_BRANCH" for s in report.alternative_scenarios)
