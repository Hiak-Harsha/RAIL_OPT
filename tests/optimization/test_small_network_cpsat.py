import pytest
from backend.simulator.railway.models import (
    Station, Platform, TrackBlock, Train, TimetableStop,
    BlockDirection, BlockType, PriorityClass
)
from backend.simulator.railway.graph import RailwayNetworkGraph
from backend.optimizer.constraints.safety_validator import SafetyValidator
from backend.optimizer.solvers.cpsat_solver import CPSATScheduler


@pytest.fixture
def small_network():
    net = RailwayNetworkGraph()
    
    # 3 Stations: STN_A, STN_B, STN_C
    net.add_station(Station(
        id="STN_A", code="STA", name="Station A", position_km=0.0,
        platforms=[Platform(id="STA_P1", name="Platform 1", station_id="STN_A", number="1", length_m=600)]
    ))
    net.add_station(Station(
        id="STN_B", code="STB", name="Station B (Junction)", position_km=30.0,
        platforms=[
            Platform(id="STB_P1", name="Platform 1", station_id="STN_B", number="1", length_m=600),
            Platform(id="STB_LOOP", name="Loop Platform", station_id="STN_B", number="2", length_m=700)
        ]
    ))
    net.add_station(Station(
        id="STN_C", code="STC", name="Station C", position_km=80.0,
        platforms=[Platform(id="STC_P1", name="Platform 1", station_id="STN_C", number="1", length_m=600)]
    ))

    # Blocks:
    # 1. BLK_AB (Double line UP)
    net.add_block(TrackBlock(
        id="BLK_AB", name="Section A-B", from_node="STN_A", to_node="STN_B",
        length_km=30.0, max_speed_kmh=130.0, direction=BlockDirection.UP, block_type=BlockType.MAIN_LINE
    ))
    # 2. BLK_B_LOOP (Station Loop line at B)
    net.add_block(TrackBlock(
        id="BLK_B_LOOP", name="Station B Loop Line", from_node="STN_B", to_node="STN_B",
        length_km=2.0, max_speed_kmh=50.0, direction=BlockDirection.BIDIRECTIONAL, block_type=BlockType.LOOP_LINE
    ))
    # 3. BLK_BC_SINGLE (Single-line Bottleneck between B and C)
    net.add_block(TrackBlock(
        id="BLK_BC_SINGLE", name="Single Line Section B-C", from_node="STN_B", to_node="STN_C",
        length_km=50.0, max_speed_kmh=100.0, direction=BlockDirection.BIDIRECTIONAL, block_type=BlockType.SINGLE_LINE_SECTION
    ))

    return net


def test_small_network_single_train(small_network):
    """Test 1: Single train traversing the corridor produces OPTIMAL and VALID schedule"""
    t1 = Train(
        train_id="T001", train_number="10001", train_name="Express A",
        priority=PriorityClass.P4_SUPERFAST_EXPRESS, length_m=400, max_speed_kmh=120, acceleration_ms2=0.6,
        origin="STN_A", destination="STN_C", direction=BlockDirection.UP,
        route_block_ids=["BLK_AB", "BLK_BC_SINGLE"],
        stops=[
            TimetableStop(station_id="STN_A", station_code="STA", scheduled_arrival=0, scheduled_departure=0),
            TimetableStop(station_id="STN_C", station_code="STC", scheduled_arrival=3600, scheduled_departure=3600)
        ]
    )

    solver = CPSATScheduler(small_network, min_headway_sec=180.0, time_limit_sec=3.0)
    result = solver.solve([t1], current_time_sec=0.0)

    assert result["status"] in ("OPTIMAL", "FEASIBLE")
    assert result["validation"]["is_valid"] is True
    assert len(result["schedule"]["T001"]) == 2


def test_small_network_same_direction_headway(small_network):
    """Test 2: Two trailing trains in the same direction strictly maintain headway"""
    t1 = Train(
        train_id="T001", train_number="10001", train_name="Express A1",
        priority=PriorityClass.P4_SUPERFAST_EXPRESS, length_m=400, max_speed_kmh=120, acceleration_ms2=0.6,
        origin="STN_A", destination="STN_C", direction=BlockDirection.UP,
        route_block_ids=["BLK_AB", "BLK_BC_SINGLE"],
        stops=[
            TimetableStop(station_id="STN_A", station_code="STA", scheduled_arrival=0, scheduled_departure=0),
            TimetableStop(station_id="STN_C", station_code="STC", scheduled_arrival=3600, scheduled_departure=3600)
        ]
    )
    t2 = Train(
        train_id="T002", train_number="10002", train_name="Express A2",
        priority=PriorityClass.P3_PASSENGER_LOCAL, length_m=400, max_speed_kmh=100, acceleration_ms2=0.5,
        origin="STN_A", destination="STN_C", direction=BlockDirection.UP,
        route_block_ids=["BLK_AB", "BLK_BC_SINGLE"],
        stops=[
            TimetableStop(station_id="STN_A", station_code="STA", scheduled_arrival=60, scheduled_departure=60),
            TimetableStop(station_id="STN_C", station_code="STC", scheduled_arrival=4000, scheduled_departure=4000)
        ]
    )

    solver = CPSATScheduler(small_network, min_headway_sec=180.0, time_limit_sec=3.0)
    result = solver.solve([t1, t2], current_time_sec=0.0)

    assert result["status"] in ("OPTIMAL", "FEASIBLE")
    assert result["validation"]["is_valid"] is True
    
    m1_ab = [m for m in result["schedule"]["T001"] if m["block_id"] == "BLK_AB"][0]
    m2_ab = [m for m in result["schedule"]["T002"] if m["block_id"] == "BLK_AB"][0]
    assert m2_ab["enter_time"] >= m1_ab["exit_time"] + 180.0 or m1_ab["enter_time"] >= m2_ab["exit_time"] + 180.0


def test_small_network_opposing_trains_crossing(small_network):
    """Test 3: Two opposing trains on a single-line section cross with precedence and zero collision"""
    t_up = Train(
        train_id="T_UP", train_number="12001", train_name="Vande Bharat UP",
        priority=PriorityClass.P5_HIGH_SPEED_PREMIUM, length_m=400, max_speed_kmh=130, acceleration_ms2=0.8,
        origin="STN_A", destination="STN_C", direction=BlockDirection.UP,
        route_block_ids=["BLK_AB", "BLK_BC_SINGLE"],
        stops=[
            TimetableStop(station_id="STN_A", station_code="STA", scheduled_arrival=0, scheduled_departure=0),
            TimetableStop(station_id="STN_C", station_code="STC", scheduled_arrival=3600, scheduled_departure=3600)
        ]
    )
    t_down = Train(
        train_id="T_DN", train_number="12002", train_name="Freight DN",
        priority=PriorityClass.P2_FREIGHT, length_m=600, max_speed_kmh=75, acceleration_ms2=0.3,
        origin="STN_C", destination="STN_A", direction=BlockDirection.DOWN,
        route_block_ids=["BLK_BC_SINGLE", "BLK_AB"],
        stops=[
            TimetableStop(station_id="STN_C", station_code="STC", scheduled_arrival=0, scheduled_departure=0),
            TimetableStop(station_id="STN_A", station_code="STA", scheduled_arrival=4500, scheduled_departure=4500)
        ]
    )

    solver = CPSATScheduler(small_network, min_headway_sec=180.0, time_limit_sec=3.0)
    result = solver.solve([t_up, t_down], current_time_sec=0.0)

    assert result["status"] in ("OPTIMAL", "FEASIBLE")
    assert result["validation"]["is_valid"] is True

    m_up_single = [m for m in result["schedule"]["T_UP"] if m["block_id"] == "BLK_BC_SINGLE"][0]
    m_dn_single = [m for m in result["schedule"]["T_DN"] if m["block_id"] == "BLK_BC_SINGLE"][0]
    
    no_overlap = (m_up_single["exit_time"] + 180.0 <= m_dn_single["enter_time"]) or \
                 (m_dn_single["exit_time"] + 180.0 <= m_up_single["enter_time"])
    assert no_overlap is True


def test_small_network_blocked_section(small_network):
    """Test 4: Disrupted closed block prevents train dispatch"""
    validator = SafetyValidator(small_network)
    bad_schedule = {
        "T001": [
            {"block_id": "BLK_AB", "enter_time": 0.0, "exit_time": 1000.0},
            {"block_id": "BLK_BC_SINGLE", "enter_time": 1000.0, "exit_time": 2500.0}
        ]
    }
    val = validator.validate_schedule(bad_schedule, blocked_block_ids=["BLK_BC_SINGLE"])
    assert val.is_valid is False
    assert any(str(v.violation_type) == "TRACK_CLOSURE_VIOLATION" or getattr(v.violation_type, "value", "") == "TRACK_CLOSURE_VIOLATION" for v in val.violations)
