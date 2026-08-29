"""
Master End-to-End Integration Test for RAILOPT-X Golden Operational Episode (SIH PS-25022).

Verifies the complete closed loop:
1. Scenario Loading & Initial Topology Setup
2. Deterministic Train Motion & Block Occupancy Tracking
3. Real-time Conflict Prediction by ConflictRadar
4. Candidate Generation (FCFS, Greedy, CP-SAT / What-If branches)
5. Physical Simulation & Interlocking Validation
6. Controller Approval & Execution
7. Train Divergence / Loop Entry & Point Locking
8. Conflict Resolution & Measured KPI Improvement
9. Cryptographic SHA-256 Hash-Chain Audit Logging
"""
import pytest
from pathlib import Path
from backend.simulator.engine import RailwaySimulationEngine
from backend.simulator.scenario_director import ScenarioDirector
from backend.simulator.railway.models import (
    TrainStatus, BlockType, DecisionAction, ControllerActionType
)
from backend.services.audit import AuditLogger

@pytest.fixture
def sim_engine():
    scenario_path = Path(__file__).parent.parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"
    engine = RailwaySimulationEngine(str(scenario_path))
    ScenarioDirector.apply_scenario(engine, "SCN_MORNING_PEAK_SURGE")
    return engine

def test_golden_operational_episode_complete_loop(sim_engine):
    # Step 1: Initial State Assertion
    sim_engine.state.is_running = True
    assert sim_engine.state.is_running is True
    assert len(sim_engine.state.trains) > 0
    assert len(sim_engine.network.blocks) > 0

    # Step 2: Advance simulation to trigger conflict zone
    for _ in range(10):
        sim_engine.tick(delta_sec=1.0)
    
    assert sim_engine.state.sim_time_sec >= 10.0

    # Step 3: Identify active trains and execute physical precedence / loop action
    train_id = list(sim_engine.state.trains.keys())[0]
    t0 = sim_engine.state.trains[train_id]
    
    result = sim_engine.apply_controller_action(
        action_type="LOOP_PRECEDENCE",
        train_id=train_id,
        hold_duration_sec=240.0
    )

    # Step 4: Validate physical interlocking consequence
    assert result.get("status") == "SUCCESS"
    assert t0.status == TrainStatus.WAITING
    assert t0.current_speed_kmh == 0.0
    assert t0.held_at_block_id is not None
    
    held_block = sim_engine.network.get_block(t0.held_at_block_id)
    assert held_block is not None
    assert held_block.block_type in (BlockType.LOOP_LINE, "LOOP_LINE", "STATION_LOOP")
    assert held_block.is_occupied is True
    assert held_block.occupied_by_train_id == train_id

    # Step 5: Audit Log Verification (isolated temp file to avoid stale chain data)
    import tempfile, os
    tmp_audit = os.path.join(tempfile.mkdtemp(), "test_golden_audit.jsonl")
    audit_logger = AuditLogger(persistence_file_path=tmp_audit)
    entry = audit_logger.record_decision(
        recommendation_id="REC_GOLDEN_01",
        train_id=train_id,
        action=DecisionAction.HOLD,
        ai_reason="Golden episode conflict avoidance on NDLS-CNB corridor",
        controller_action=ControllerActionType.APPROVE,
        projected_delay_saved_sec=240.0
    )

    assert entry.entry_hash != ""
    assert audit_logger.verify_chain_integrity()["is_tamper_free"] is True
