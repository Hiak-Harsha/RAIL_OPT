import pytest
from pathlib import Path
from backend.simulator.engine import RailwaySimulationEngine
from backend.optimizer.solvers.cpsat_solver import CPSATScheduler, HAS_ORTOOLS
from backend.optimizer.baselines.fcfs import FCFSDispatcher


@pytest.fixture
def sim_engine():
    scenario_path = Path(__file__).parent.parent.parent / "backend" / "data" / "scenarios" / "synthetic_section.json"
    return RailwaySimulationEngine(str(scenario_path))


@pytest.mark.skipif(not HAS_ORTOOLS, reason="Google OR-Tools required for CP-SAT solver tests")
def test_cpsat_solver_produces_valid_schedule(sim_engine):
    """Verify that Google OR-Tools CP-SAT produces an optimal, conflict-free schedule"""
    solver = CPSATScheduler(sim_engine.network, min_headway_sec=180.0, time_limit_sec=5.0)
    trains = list(sim_engine.state.trains.values())
    
    result = solver._solve_with_ortools(trains, current_time_sec=0.0)
    assert result["solver"] == "OR-Tools_CP-SAT"
    assert result["status"] in ("OPTIMAL", "FEASIBLE")
    assert result["validation"]["is_valid"] is True
    assert len(result["validation"]["violations"]) == 0
    assert result["cost_breakdown"]["total_cost"] > 0
    assert result["trace"]["total_candidates_generated"] > 0


@pytest.mark.skipif(not HAS_ORTOOLS, reason="Google OR-Tools required for CP-SAT solver tests")
def test_cpsat_delay_lower_than_fcfs(sim_engine):
    """Verify that CP-SAT achieves lower or equal weighted delay compared with baseline FCFS"""
    trains = list(sim_engine.state.trains.values())
    trains[0].total_delay_sec = 600.0

    fcfs = FCFSDispatcher(sim_engine.network, min_headway_sec=180.0)
    res_fcfs = fcfs.solve(trains, current_time_sec=0.0)

    cpsat = CPSATScheduler(sim_engine.network, min_headway_sec=180.0, time_limit_sec=5.0)
    res_cpsat = cpsat._solve_with_ortools(trains, current_time_sec=0.0)

    assert res_cpsat["validation"]["is_valid"] is True
    cost_fcfs = res_fcfs["cost_breakdown"]["total_cost"]
    cost_cpsat = res_cpsat["cost_breakdown"]["total_cost"]
    assert cost_cpsat <= cost_fcfs
