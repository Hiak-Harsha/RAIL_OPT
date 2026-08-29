import pytest
from pathlib import Path
from backend.simulator.engine import RailwaySimulationEngine
from backend.simulator.railway.models import TrainStatus, SignalAspect

SCENARIO_PATH = Path(__file__).parent.parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"


def test_4_aspect_signal_progression():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    
    # NDLS to GZB UP line
    up_block_id = "BLK_NDLS_GZB_UP"
    up_block = engine.network.get_block(up_block_id)
    sig_id = up_block.signals[0]
    
    # 1. When clear, signal is GREEN / DOUBLE_YELLOW
    engine.tick(delta_sec=1.0)
    sig = engine.network.signals[sig_id]
    assert sig.aspect in (SignalAspect.GREEN, SignalAspect.DOUBLE_YELLOW)

    # 2. When occupied, signal is RED
    up_block.is_occupied = True
    engine.tick(delta_sec=1.0)
    assert engine.network.signals[sig_id].aspect == SignalAspect.RED


def test_station_dwell_lifecycle():
    engine = RailwaySimulationEngine(str(SCENARIO_PATH))
    train = engine.state.trains["T22436"]
    
    # Set train to enter intermediate station stop platform
    train.status = TrainStatus.RUNNING
    train.route_index = 0
    train.current_block_id = train.route_block_ids[0]
    
    # Simulate entering platform block
    train.is_dwelling = True
    train.dwell_remaining_sec = 120.0
    
    # Tick forward 30 seconds
    engine.tick(delta_sec=30.0)
    assert train.is_dwelling is True
    assert train.status == TrainStatus.WAITING
    assert train.current_speed_kmh == 0.0
    assert round(train.dwell_remaining_sec) == 90.0
