import pytest
from pathlib import Path
from backend.simulator.engine import RailwaySimulationEngine
from backend.simulator.railway.models import Disruption, DisruptionType, TrainStatus


@pytest.fixture
def sim_engine():
    scenario_path = Path(__file__).parent.parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"
    return RailwaySimulationEngine(str(scenario_path))


def test_disruption_injection_train_delay(sim_engine):
    train_id = "T22436"
    initial_delay = sim_engine.state.trains[train_id].total_delay_sec
    
    dis = Disruption(
        id="DIS_TEST_01",
        disruption_type=DisruptionType.TRAIN_DELAY,
        target_id=train_id,
        start_time_sec=100.0,
        duration_sec=600.0,
        description="Signal malfunction delay"
    )
    res = sim_engine.inject_disruption(dis)
    assert res["status"] == "SUCCESS"
    assert sim_engine.state.trains[train_id].total_delay_sec == initial_delay + 600.0
    assert sim_engine.state.trains[train_id].status == TrainStatus.DELAYED


def test_disruption_block_closure(sim_engine):
    block_id = "BLK_ALJN_TDL_SINGLE"
    dis = Disruption(
        id="DIS_TEST_02",
        disruption_type=DisruptionType.BLOCK_CLOSURE,
        target_id=block_id,
        start_time_sec=200.0,
        duration_sec=1800.0,
        description="Track maintenance closure"
    )
    sim_engine.inject_disruption(dis)
    assert sim_engine.network.get_block(block_id).is_blocked is True
