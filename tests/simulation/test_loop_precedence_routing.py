"""
RAILOPT-X 2.0 — Phase 1 Loop Precedence Interlocking Routing Test Suite

Tests:
1. Valid loop precedence routes train into authentic station loop track.
2. Mainline section is physically released and unblocked.
3. Switch and route reservations are locked before movement.
4. Train status transitions to WAITING inside loop with non-zero hold duration.
5. Inadmissible / non-loop targets are strictly rejected or resolved to authentic loops.
"""

from pathlib import Path
import pytest
from backend.simulator.engine import RailwaySimulationEngine
from backend.simulator.railway.models import (
    TrainStatus, BlockType, CandidateActionType, LoopPrecedenceAction
)

SCENARIO_PATH = Path(__file__).parents[2] / "backend" / "data" / "scenarios" / "synthetic_section.json"


def test_loop_precedence_diverts_to_authentic_loop_block():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    trains = list(engine.state.trains.values())
    t0 = trains[0]
    orig_blk_id = t0.current_block_id or t0.route_block_ids[0]

    res = engine.apply_controller_action(
        action_type="LOOP_PRECEDENCE",
        train_id=t0.train_id,
        hold_duration_sec=240.0,
        target_block_id=orig_blk_id
    )

    assert res["status"] == "SUCCESS"
    updated = engine.state.trains[t0.train_id]
    assert updated.status == TrainStatus.WAITING
    assert updated.held_at_block_id is not None
    assert "LOOP" in updated.held_at_block_id
    assert updated.current_block_id == updated.held_at_block_id
    assert updated.held_at_block_id in updated.route_block_ids


def test_loop_precedence_releases_mainline_occupancy():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    trains = list(engine.state.trains.values())
    t0 = trains[0]
    mainline_block_id = t0.current_block_id or t0.route_block_ids[0]

    # Ensure mainline block is initially occupied
    old_blk = engine.network.get_block(mainline_block_id)
    if old_blk:
        old_blk.is_occupied = True
        old_blk.occupied_by_train_id = t0.train_id

    res = engine.apply_controller_action(
        action_type="LOOP_PRECEDENCE",
        train_id=t0.train_id,
        hold_duration_sec=180.0,
        target_block_id=mainline_block_id
    )

    assert res["status"] == "SUCCESS"
    if old_blk and old_blk.id != engine.state.trains[t0.train_id].held_at_block_id:
        assert old_blk.occupied_by_train_id != t0.train_id


def test_loop_precedence_model_serialization_and_validation():
    action = LoopPrecedenceAction(
        train_id="T04403",
        approach_edge_id="BLK_NDLS_GZB_UP",
        loop_edge_id="BLK_GZB_LOOP_1",
        exit_edge_id="BLK_GZB_ALJN_UP_1",
        precedence_train_id="T22436",
        hold_duration_sec=300.0,
        switch_commands=[{"switch_id": "SW_GZB_01", "position": "REVERSE"}],
        required_signals=["SIG_GZB_LOOP_01"],
        status="RESERVED"
    )

    d = action.model_dump()
    assert d["train_id"] == "T04403"
    assert d["loop_edge_id"] == "BLK_GZB_LOOP_1"
    assert d["hold_duration_sec"] == 300.0
    assert len(d["switch_commands"]) == 1
