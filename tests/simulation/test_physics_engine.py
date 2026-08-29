import pytest
import math
from pathlib import Path
from backend.simulator.engine import RailwaySimulationEngine
from backend.simulator.railway.models import TrainStatus, SignalAspect


@pytest.fixture
def sim_engine():
    scenario_path = Path(__file__).parent.parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"
    return RailwaySimulationEngine(str(scenario_path))


def test_immediate_departure_acceleration(sim_engine):
    """Verify that at scheduled departure time, a train immediately transitions to RUNNING and accelerates"""
    train = sim_engine.state.trains["T22436"]
    assert train.status == TrainStatus.SCHEDULED
    assert train.current_speed_kmh == 0.0

    # Advance to scheduled departure time (300s)
    sim_engine.fast_forward_to(300.0, dt=1.0)
    assert train.status == TrainStatus.RUNNING
    assert train.current_speed_kmh > 0.0
    assert train.current_position_km > 0.0
    assert train.current_block_id == "BLK_NDLS_GZB_UP"


def test_braking_profile_before_occupied_boundary(sim_engine):
    """Verify that a train calculates braking distance and decelerates before an occupied or red signal block"""
    # Block downstream single-line
    single_block_id = "BLK_ALJN_TDL_SINGLE"
    sim_engine.network.blocks[single_block_id].is_occupied = True
    sim_engine.network.blocks[single_block_id].occupied_by_train_id = "T12301"

    # Fast forward T22436 as it travels through block 0 and approaches block 1 end
    train = sim_engine.state.trains["T22436"]
    train.status = TrainStatus.RUNNING
    train.route_index = 1
    train.current_block_id = train.route_block_ids[1]  # BLK_GZB_ALJN_UP
    curr_block = sim_engine.network.get_block(train.current_block_id)
    
    # Place train near block end at full speed
    train.current_speed_kmh = 130.0
    train.current_position_km = curr_block.length_km - 0.5  # 500m before boundary
    
    # Tick simulation forward
    sim_engine.tick(delta_sec=1.0)
    
    # Train must decelerate due to red signal / occupied next block
    assert train.current_speed_kmh < 130.0


def test_jump_to_demo_window(sim_engine):
    """Verify that jump_to_demo_window advances the state to T+600s and beyond with active running trains"""
    sim_engine.jump_to_demo_window(600.0)
    
    assert sim_engine.state.sim_time_sec >= 600.0
    t22436 = sim_engine.state.trains["T22436"]
    assert t22436.status == TrainStatus.RUNNING
    assert t22436.current_speed_kmh > 0.0
    assert t22436.current_position_km > 0.0

    # Advance to 850s where opposing train T12301 has also departed
    sim_engine.fast_forward_to(850.0)
    t12301 = sim_engine.state.trains["T12301"]
    assert t12301.status == TrainStatus.RUNNING
    assert t12301.current_speed_kmh > 0.0


def test_block_occupancy_safety_rejection(sim_engine):
    """Verify that _is_block_clear_for_train strictly rejects occupied blocks"""
    block = sim_engine.network.blocks["BLK_NDLS_GZB_UP"]
    block.is_occupied = True
    block.occupied_by_train_id = "T99999"

    is_clear = sim_engine._is_block_clear_for_train("BLK_NDLS_GZB_UP", "T22436")
    assert is_clear is False
