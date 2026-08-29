import pytest
from pathlib import Path
from backend.simulator.engine import RailwaySimulationEngine
from backend.simulator.railway.models import TrainStatus


@pytest.fixture
def sim_engine():
    scenario_path = Path(__file__).parent.parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"
    return RailwaySimulationEngine(str(scenario_path))


def test_runtime_interlocking_prevents_simultaneous_occupancy(sim_engine):
    """
    Verify that runtime physical interlocking prevents two trains
    from occupying the same block or converging single-line section simultaneously.
    """
    # Start two trains at the same time
    trains = list(sim_engine.state.trains.values())
    t1 = trains[0]
    t2 = trains[1]
    
    # Place t1 in first block
    first_block = t1.route_block_ids[0]
    t1.status = TrainStatus.RUNNING
    t1.current_block_id = first_block
    sim_engine.network.blocks[first_block].is_occupied = True
    sim_engine.network.blocks[first_block].occupied_by_train_id = t1.train_id

    # Attempt to start t2 targeting the same first block
    t2.status = TrainStatus.SCHEDULED
    t2.route_block_ids[0] = first_block
    
    # Tick simulation forward
    sim_engine.tick(delta_sec=5.0)

    # t2 must NOT enter the occupied block and should remain SCHEDULED or WAITING
    assert t2.current_block_id != first_block
    assert sim_engine.network.blocks[first_block].occupied_by_train_id == t1.train_id


def test_runtime_interlocking_single_line_halt(sim_engine):
    """
    Verify that an opposing train halts at the entry signal of a single-line bottleneck
    when the single line is already occupied by a train in the opposing direction.
    """
    single_block_id = "BLK_ALJN_TDL_SINGLE"
    sim_engine.network.blocks[single_block_id].is_occupied = True
    sim_engine.network.blocks[single_block_id].occupied_by_train_id = "T12301"

    # Train T22436 approaches single line (preceding block before BLK_ALJN_TDL_SINGLE)
    train = sim_engine.state.trains["T22436"]
    train.status = TrainStatus.RUNNING
    single_idx = train.route_block_ids.index(single_block_id)
    train.route_index = single_idx - 1
    train.current_block_id = train.route_block_ids[train.route_index]
    curr_block = sim_engine.network.get_block(train.current_block_id)
    train.current_position_km = curr_block.length_km - 0.005  # At the boundary signal

    # Tick simulation forward
    sim_engine.tick(delta_sec=2.0)

    # Train must halt before single line with speed 0 and status WAITING
    assert train.current_block_id != single_block_id
    assert train.status == TrainStatus.WAITING
    assert train.current_speed_kmh == 0.0


def test_runtime_interlocking_clearance_allows_entry(sim_engine):
    """
    Verify that once a previously occupied block is cleared,
    a waiting train is granted entry on the next tick.
    """
    single_block_id = "BLK_ALJN_TDL_SINGLE"
    sim_engine.network.blocks[single_block_id].is_occupied = True
    sim_engine.network.blocks[single_block_id].occupied_by_train_id = "T12301"

    train = sim_engine.state.trains["T22436"]
    train.status = TrainStatus.RUNNING
    single_idx = train.route_block_ids.index(single_block_id)
    train.route_index = single_idx - 1
    train.current_block_id = train.route_block_ids[train.route_index]
    curr_block = sim_engine.network.get_block(train.current_block_id)
    train.current_position_km = curr_block.length_km - 0.005

    # 1. First tick while occupied: train must wait
    sim_engine.tick(delta_sec=1.0)
    assert train.status == TrainStatus.WAITING
    assert sim_engine.network.blocks[single_block_id].occupied_by_train_id != "T22436"

    # 2. Block is cleared (T12301 leaves)
    sim_engine.network.blocks[single_block_id].is_occupied = False
    sim_engine.network.blocks[single_block_id].occupied_by_train_id = None

    # 3. Next tick: train now enters the cleared block
    sim_engine.tick(delta_sec=1.0)
    assert train.current_block_id == single_block_id
    assert sim_engine.network.blocks[single_block_id].occupied_by_train_id == "T22436"
    assert train.status == TrainStatus.RUNNING
