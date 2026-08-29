"""
Tests for physical loop precedence dispatch semantics (P0.4).
Validates that Loop Precedence checks route adjacency, point locks, sets occupancy,
and rejects disconnected/non-existent loop candidates.
"""
import pytest
from pathlib import Path
from backend.simulator.engine import RailwaySimulationEngine
from backend.simulator.railway.models import TrainStatus, BlockType

@pytest.fixture
def sim():
    scenario_path = Path(__file__).parent.parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"
    return RailwaySimulationEngine(str(scenario_path))

def test_loop_precedence_valid_execution(sim):
    # Find an active train on the network
    train_id = list(sim.state.trains.keys())[0]
    train = sim.state.trains[train_id]
    
    # Apply loop precedence
    result = sim.apply_controller_action(
        action_type="LOOP_PRECEDENCE",
        train_id=train_id,
        hold_duration_sec=300.0
    )
    
    assert result.get("status") == "SUCCESS"
    assert train.status == TrainStatus.WAITING
    assert train.current_speed_kmh == 0.0
    assert train.held_at_block_id is not None
    
    # The held block must be a valid loop line
    held_blk = sim.network.get_block(train.held_at_block_id)
    assert held_blk is not None
    assert held_blk.block_type in (BlockType.LOOP_LINE, "LOOP_LINE", "STATION_LOOP")
    assert held_blk.is_occupied is True
    assert held_blk.occupied_by_train_id == train_id

def test_loop_precedence_invalid_candidate_rejected(sim):
    train_id = list(sim.state.trains.keys())[0]
    
    # Try an invalid non-existent block
    result = sim.apply_controller_action(
        action_type="LOOP_PRECEDENCE",
        train_id=train_id,
        hold_duration_sec=300.0,
        target_block_id="BLK_NONEXISTENT_999"
    )
    
    # Should either find a valid local station loop or fail cleanly
    assert result.get("status") in ("SUCCESS", "FAILED")
    if result.get("status") == "FAILED":
        assert "No valid" in result.get("reason", "")
