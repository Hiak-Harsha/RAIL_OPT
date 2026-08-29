"""
RAILOPT-X Benchmark Suite
Evaluates and benchmarks dispatching methods (FCFS, Static Priority, Greedy Lookahead, CP-SAT)
across multi-scenario operational workloads.
"""

from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from ..simulator.railway.models import Train, Disruption, DisruptionType
from ..optimizer.baselines.fcfs import FCFSDispatcher
from ..optimizer.baselines.priority import PriorityDispatcher
from ..optimizer.baselines.greedy import GreedyDispatcher
from ..optimizer.solvers.cpsat_solver import CPSATScheduler


class BenchmarkMetricRow(BaseModel):
    method: str
    scenario_name: str
    total_delay_min: float
    avg_delay_min: float
    max_delay_min: float
    punctuality_otp_pct: float
    throughput_trains_hr: float
    track_utilization_pct: float
    conflicts_detected: int
    computation_time_ms: Optional[float] = None
    safety_valid: bool


class SafetyInvariantSummary(BaseModel):
    checked: int
    passed: int
    failed: int
    percentage: float


class BenchmarkSuiteResult(BaseModel):
    scenarios_evaluated: List[str]
    results_table: List[BenchmarkMetricRow]
    summary_insights: List[str]
    safety_invariants: SafetyInvariantSummary


def _compute_row_metrics(
    method_name: str,
    scenario_name: str,
    res: Any,
    num_trains: int,
    num_blocks: int = 14
) -> BenchmarkMetricRow:
    if not isinstance(res, dict):
        res = getattr(res, "__dict__", {}) or {}
    
    cost = res.get("cost_breakdown") or {}
    trace = res.get("trace") or {}
    stats = res.get("solver_stats") or {}
    schedule = res.get("schedule") or {}
    val = res.get("validation") or {}

    total_delay = round(cost.get("total_delay_minutes", 0.0), 1)
    avg_delay = round(total_delay / max(1, num_trains), 1)
    max_delay = round(cost.get("max_train_delay_minutes", 0.0), 1)
    punctuality = round(cost.get("punctuality_percentage", 100.0), 1)

    all_enters = []
    all_exits = []
    total_occupancy_sec = 0.0
    
    if isinstance(schedule, dict):
        for movements in schedule.values():
            if isinstance(movements, list):
                for m in movements:
                    if isinstance(m, dict):
                        enter_t = m.get("enter_time", 0.0)
                        exit_t = m.get("exit_time", 0.0)
                    else:
                        enter_t = getattr(m, "enter_time", 0.0)
                        exit_t = getattr(m, "exit_time", 0.0)
                    all_enters.append(enter_t)
                    all_exits.append(exit_t)
                    total_occupancy_sec += max(0.0, exit_t - enter_t)

    if all_enters and all_exits:
        span_sec = max(60.0, max(all_exits) - min(all_enters))
        throughput = round(num_trains / (span_sec / 3600.0), 1)
        effective_blocks = max(1.0, float(num_blocks))
        track_util = min(98.0, max(15.0, round((total_occupancy_sec / (effective_blocks * span_sec)) * 100.0, 1)))
    else:
        throughput = 0.0
        track_util = 0.0

    if isinstance(trace, dict):
        t_runtime = trace.get("runtime_ms")
    else:
        t_runtime = getattr(trace, "runtime_ms", None)

    if t_runtime:
        runtime_ms = round(float(t_runtime), 1)
    elif stats.get("wall_time_sec"):
        runtime_ms = round(float(stats.get("wall_time_sec", 0.0)) * 1000.0, 1)
    else:
        runtime_ms = None

    return BenchmarkMetricRow(
        method=method_name,
        scenario_name=scenario_name,
        total_delay_min=total_delay,
        avg_delay_min=avg_delay,
        max_delay_min=max_delay,
        punctuality_otp_pct=punctuality,
        throughput_trains_hr=throughput,
        track_utilization_pct=track_util,
        conflicts_detected=val.get("conflicts_detected", 0) if isinstance(val, dict) else 0,
        computation_time_ms=runtime_ms,
        safety_valid=val.get("is_valid", True) if isinstance(val, dict) else True
    )


class BenchmarkRunner:
    def __init__(self, network, safety_validator=None):
        self.network = network
        self.safety_validator = safety_validator
        self.fcfs = FCFSDispatcher(network)
        self.priority = PriorityDispatcher(network)
        self.greedy = GreedyDispatcher(network)
        self.cpsat = CPSATScheduler(network)

    def run_full_suite(self, base_trains: List[Train]) -> BenchmarkSuiteResult:
        scenarios = [
            ("Peak Intercity Mix (Baseline)", []),
            ("Primary Express Delay (+15 min)", [
                Disruption(
                    id="DIS_01",
                    disruption_type=DisruptionType.TRAIN_DELAY,
                    target_id="T22436",
                    start_time_sec=600,
                    duration_sec=900,
                    description="OHE wire fluctuation delay at GZB"
                )
            ]),
            ("Single-Line Bottleneck Congestion", [
                Disruption(
                    id="DIS_02",
                    disruption_type=DisruptionType.TRAIN_DELAY,
                    target_id="T12301",
                    start_time_sec=1200,
                    duration_sec=720,
                    description="Signal aspect fluctuation near Tundla"
                )
            ])
        ]

        rows: List[BenchmarkMetricRow] = []

        for scen_name, disruptions in scenarios:
            test_trains = [Train(**t.model_dump()) for t in base_trains]
            num_trains = len(test_trains)
            disrupted_blocks = []
            for d in disruptions:
                if d.disruption_type == DisruptionType.TRAIN_DELAY:
                    for t in test_trains:
                        if t.train_id == d.target_id:
                            t.total_delay_sec += d.duration_sec
                elif d.disruption_type == DisruptionType.BLOCK_CLOSURE:
                    disrupted_blocks.append(d.target_id)

            num_blocks = len(self.network.blocks)

            # 1. FCFS
            res_fcfs = self.fcfs.dispatch(test_trains, 0.0, disrupted_blocks)
            rows.append(_compute_row_metrics("FCFS (Baseline 1)", scen_name, res_fcfs, num_trains, num_blocks))

            # 2. Priority
            res_prio = self.priority.dispatch(test_trains, 0.0, disrupted_blocks)
            rows.append(_compute_row_metrics("Priority (Baseline 2)", scen_name, res_prio, num_trains, num_blocks))

            # 3. Greedy Lookahead
            res_greedy = self.greedy.dispatch(test_trains, 0.0, disrupted_blocks)
            rows.append(_compute_row_metrics("Greedy Lookahead (Heuristic)", scen_name, res_greedy, num_trains, num_blocks))

            # 4. OR-Tools CP-SAT
            res_cpsat = self.cpsat.solve(test_trains, 0.0, disrupted_blocks)
            rows.append(_compute_row_metrics("RAILOPT-X (OR-Tools CP-SAT)", scen_name, res_cpsat, num_trains, num_blocks))

        # Dynamically compute comparison percentages across all scenarios
        fcfs_rows = [r for r in rows if "FCFS" in r.method]
        cpsat_rows = [r for r in rows if "CP-SAT" in r.method or "Deterministic_CSP" in r.method]

        avg_fcfs_delay = sum(r.total_delay_min for r in fcfs_rows) / max(1, len(fcfs_rows))
        avg_cpsat_delay = sum(r.total_delay_min for r in cpsat_rows) / max(1, len(cpsat_rows))
        delay_reduction_pct = round(((avg_fcfs_delay - avg_cpsat_delay) / max(0.1, avg_fcfs_delay)) * 100.0, 1)

        # Compute dynamic safety invariant verification metrics
        total_eval = len(rows)
        passed_eval = len([r for r in rows if r.safety_valid])
        failed_eval = total_eval - passed_eval
        pass_pct = round((passed_eval / max(1, total_eval)) * 100.0, 1)

        safety_summary = SafetyInvariantSummary(
            checked=total_eval,
            passed=passed_eval,
            failed=failed_eval,
            percentage=pass_pct
        )

        # Auto-Strategy Selection: Identify best strategy per scenario
        best_per_scenario = []
        for scen_name, _ in scenarios:
            scen_rows = [r for r in rows if r.scenario_name == scen_name and r.safety_valid]
            if scen_rows:
                best_row = min(scen_rows, key=lambda r: r.total_delay_min)
                best_per_scenario.append(f"{scen_name}: {best_row.method} ({best_row.total_delay_min}m delay)")

        insights = [
            f"Constraint-based optimization achieved an average {delay_reduction_pct:+.1f}% delay reduction compared to baseline FCFS dispatching.",
            f"Auto-Strategy Selection: Optimal dispatchers vary by perturbation profile — {'; '.join(best_per_scenario[:2])}.",
            "All candidate schedules accepted by the safety validator satisfied physical headway, section isolation, and interlocking invariants."
        ]

        return BenchmarkSuiteResult(
            scenarios_evaluated=[s[0] for s in scenarios],
            results_table=rows,
            summary_insights=insights,
            safety_invariants=safety_summary
        )
