import pytest
from pathlib import Path
from backend.simulator.engine import RailwaySimulationEngine
from backend.optimizer.solvers.cpsat_solver import CPSATScheduler


@pytest.fixture
def sim_engine():
    scenario_path = Path(__file__).parent.parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"
    return RailwaySimulationEngine(str(scenario_path))


def test_csp_fallback_produces_valid_schedule_on_full_corridor(sim_engine):
    """
    Verify that the Pure Python Deterministic Interval-Insertion CSP Fallback
    produces a 100% valid schedule on the 435km corridor even without OR-Tools.
    """
    solver = CPSATScheduler(sim_engine.network, min_headway_sec=180.0, time_limit_sec=5.0)
    trains = list(sim_engine.state.trains.values())
    
    result = solver._solve_with_csp_fallback(trains, current_time_sec=0.0)
    assert result["solver"] == "Deterministic_CSP_Fallback"
    assert result["status"] == "FEASIBLE"
    assert result["validation"]["is_valid"] is True
    assert len(result["validation"]["violations"]) == 0
    assert len(result["schedule"]) == len(trains)
