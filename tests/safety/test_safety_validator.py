import pytest
from backend.simulator.railway.models import Station, TrackBlock, BlockType, BlockDirection
from backend.simulator.railway.graph import RailwayNetworkGraph
from backend.optimizer.constraints.safety_validator import SafetyValidator, ViolationType


def build_test_network():
    net = RailwayNetworkGraph()
    net.add_block(TrackBlock(
        id="BLK_01",
        name="Block 1 Main",
        block_type=BlockType.MAIN_LINE,
        direction=BlockDirection.UP,
        length_km=10.0,
        max_speed_kmh=100.0,
        from_node="STN_A",
        to_node="STN_B"
    ))
    net.add_block(TrackBlock(
        id="BLK_SINGLE",
        name="Block Single Line",
        block_type=BlockType.SINGLE_LINE_SECTION,
        direction=BlockDirection.BIDIRECTIONAL,
        length_km=15.0,
        max_speed_kmh=80.0,
        from_node="STN_B",
        to_node="STN_C"
    ))
    return net


def test_valid_schedule():
    net = build_test_network()
    val = SafetyValidator(net, min_headway_sec=180.0)
    
    # Non-overlapping schedule
    schedule = {
        "T1": [{"block_id": "BLK_01", "enter_time": 0.0, "exit_time": 400.0}],
        "T2": [{"block_id": "BLK_01", "enter_time": 600.0, "exit_time": 1000.0}]
    }
    res = val.validate_schedule(schedule)
    assert res.is_valid is True
    assert res.total_violations == 0


def test_block_collision_detected():
    net = build_test_network()
    val = SafetyValidator(net, min_headway_sec=180.0)
    
    # Overlapping interval in BLK_01
    schedule = {
        "T1": [{"block_id": "BLK_01", "enter_time": 100.0, "exit_time": 500.0}],
        "T2": [{"block_id": "BLK_01", "enter_time": 200.0, "exit_time": 600.0}]
    }
    res = val.validate_schedule(schedule)
    assert res.is_valid is False
    assert any(v.violation_type == ViolationType.BLOCK_CONFLICT for v in res.violations)


def test_headway_violation_detected():
    net = build_test_network()
    val = SafetyValidator(net, min_headway_sec=180.0)
    
    # T2 enters only 50s after T1 exits
    schedule = {
        "T1": [{"block_id": "BLK_01", "enter_time": 100.0, "exit_time": 500.0}],
        "T2": [{"block_id": "BLK_01", "enter_time": 550.0, "exit_time": 950.0}]
    }
    res = val.validate_schedule(schedule)
    assert res.is_valid is False
    assert any(v.violation_type == ViolationType.HEADWAY_VIOLATION for v in res.violations)


def test_track_closure_violation():
    net = build_test_network()
    val = SafetyValidator(net, min_headway_sec=180.0)
    
    schedule = {
        "T1": [{"block_id": "BLK_SINGLE", "enter_time": 100.0, "exit_time": 800.0}]
    }
    res = val.validate_schedule(schedule, blocked_block_ids=["BLK_SINGLE"])
    assert res.is_valid is False
    assert any(v.violation_type == ViolationType.TRACK_CLOSURE_VIOLATION for v in res.violations)
