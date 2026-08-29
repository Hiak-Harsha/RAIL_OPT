from __future__ import annotations
from typing import Dict, List, Any, Optional
from pydantic import BaseModel, Field
from .railway.models import Disruption, DisruptionType, Train, Recommendation, DecisionAction
from .engine import RailwaySimulationEngine
from ..optimizer.solvers.cpsat_solver import CPSATScheduler
from ..optimizer.baselines.fcfs import FCFSDispatcher
from ..optimizer.baselines.priority import PriorityDispatcher


class ScenarioOutcome(BaseModel):
    scenario_id: str
    scenario_name: str
    description: str
    average_delay_min: float
    max_delay_min: float
    total_network_delay_min: float
    throughput_trains_per_hr: float
    track_utilization_pct: float
    conflicts_count: int
    punctuality_pct: float
    recovery_time_min: float
    safety_violations_count: int


class WhatIfComparisonReport(BaseModel):
    baseline_scenario: ScenarioOutcome
    optimized_scenario: ScenarioOutcome
    alternative_scenarios: List[ScenarioOutcome] = Field(default_factory=list)
    delay_reduction_pct: float
    throughput_gain_pct: float
    conflicts_eliminated: int


def _physics_branch_outcome(engine: RailwaySimulationEngine, actions: List[Dict[str, Any]], horizon_sec: float = 900.0) -> ScenarioOutcome:
    """Evaluate a controller candidate in the same tick/interlocking world as live operation.

    Solver schedules are valuable comparisons, but a controller plan must not be
    represented as a solver result.  This branch is intentionally labelled as a
    physics simulation and derives its metrics from the cloned runtime state.
    """
    applied = engine.apply_candidate_actions(actions)
    if applied.get("status") != "SUCCESS":
        raise ValueError(applied.get("reason", "Candidate could not be applied"))
    start_time = engine.state.sim_time_sec
    engine.fast_forward_to(start_time + horizon_sec)
    trains = list(engine.state.trains.values())
    active_conflicts = engine._check_conflicts()
    completed = sum(1 for t in trains if getattr(t.status, "value", t.status) == "ARRIVED")
    total_delay = sum(t.total_delay_sec for t in trains) / 60.0
    occupied = sum(1 for b in engine.network.blocks.values() if b.is_occupied)
    return ScenarioOutcome(
        scenario_id="SCEN_CONTROLLER_PHYSICS_BRANCH",
        scenario_name="Selected Controller Plan (Physics Branch)",
        description="Exact candidate actions replayed through cloned train physics, signals and interlocking",
        average_delay_min=round(total_delay / max(1, len(trains)), 1),
        max_delay_min=round(max((t.total_delay_sec for t in trains), default=0.0) / 60.0, 1),
        total_network_delay_min=round(total_delay, 1),
        throughput_trains_per_hr=round(completed / (horizon_sec / 3600.0), 1),
        track_utilization_pct=round(occupied / max(1, len(engine.network.blocks)) * 100.0, 1),
        conflicts_count=len(active_conflicts),
        punctuality_pct=round(sum(1 for t in trains if t.total_delay_sec <= 300) / max(1, len(trains)) * 100.0, 1),
        recovery_time_min=round(horizon_sec / 60.0, 1),
        safety_violations_count=len(active_conflicts),
    )


def _compute_metrics_from_schedule(
    schedule: Dict[str, List[Dict[str, Any]]],
    cost_breakdown: Dict[str, Any],
    num_trains: int,
    sim_time_sec: float,
    num_blocks: int = 14,
    total_network_km: float = 0.0,
) -> Dict[str, float]:
    """
    Compute authentic physical metrics from trajectory schedules.

    NOTE: No artificial clamps on utilization or throughput.
    Real values are returned — if utilization is 4% or 104%, that is the real model answer.
    Values outside physically plausible ranges indicate a model problem and should be investigated,
    not masked with min/max clamps.
    """
    all_enters: List[float] = []
    all_exits: List[float] = []
    total_occupancy_sec = 0.0

    for movements in schedule.values():
        for m in movements:
            enter = m.get("enter_time", 0.0)
            exit_ = m.get("exit_time", 0.0)
            all_enters.append(enter)
            all_exits.append(exit_)
            total_occupancy_sec += max(0.0, exit_ - enter)

    if all_enters and all_exits:
        span_sec = max(60.0, max(all_exits) - min(all_enters))
        span_hours = span_sec / 3600.0
        throughput = round(num_trains / span_hours, 1)

        # Real track utilization — no artificial floor or ceiling
        effective_blocks = max(1.0, float(num_blocks))
        utilization = round(
            (total_occupancy_sec / (effective_blocks * span_sec)) * 100.0, 1
        )
        recovery_time = round(max(0.0, (max(all_exits) - sim_time_sec) / 60.0), 1)
    else:
        throughput = 0.0
        utilization = 0.0
        recovery_time = 0.0

    total_delay = cost_breakdown.get("total_delay_minutes", 0.0)
    avg_delay = round(total_delay / max(1, num_trains), 1)
    max_delay = cost_breakdown.get("max_train_delay_minutes", 0.0)
    punctuality = cost_breakdown.get("punctuality_percentage", 100.0)

    return {
        "throughput_trains_per_hr": throughput,
        "track_utilization_pct": utilization,
        "recovery_time_min": recovery_time,
        "total_network_delay_min": total_delay,
        "average_delay_min": avg_delay,
        "max_delay_min": max_delay,
        "punctuality_pct": punctuality,
    }


def _apply_disruptions_to_clone(
    disruptions: List[Disruption],
    cloned_network: Any,
    current_trains: List[Train],
) -> List[str]:
    """
    Apply a list of disruptions to a cloned sandbox network and train state.
    Returns the list of disrupted block IDs for use by schedule dispatchers.

    Supports all DisruptionType values including:
      TRAIN_DELAY, TRAIN_BREAKDOWN, BLOCK_CLOSURE,
      SPEED_RESTRICTION, SIGNAL_FAILURE, PLATFORM_UNAVAILABLE, WEATHER_RESTRICTION
    """
    disrupted_block_ids: List[str] = []

    for d in disruptions:
        dtype = d.disruption_type.value if hasattr(d.disruption_type, "value") else str(d.disruption_type)

        if dtype == "BLOCK_CLOSURE":
            disrupted_block_ids.append(d.target_id)
            blk = cloned_network.get_block(d.target_id)
            if blk:
                blk.is_blocked = True

        elif dtype == "TRAIN_DELAY":
            for t in current_trains:
                if t.train_id == d.target_id:
                    t.total_delay_sec += d.duration_sec

        elif dtype == "TRAIN_BREAKDOWN":
            for t in current_trains:
                if t.train_id == d.target_id:
                    t.total_delay_sec += d.duration_sec
                    t.current_speed_kmh = 0.0

        elif dtype == "SPEED_RESTRICTION":
            b = cloned_network.get_block(d.target_id)
            if b:
                new_limit = getattr(d, "severity_kmh", 30.0) or 30.0
                b.current_speed_limit_kmh = min(b.current_speed_limit_kmh, new_limit)

        elif dtype == "SIGNAL_FAILURE":
            # Signal failure closes the protecting block to all traffic
            disrupted_block_ids.append(d.target_id)
            # Try to find the block or the signal directly
            blk = cloned_network.get_block(d.target_id)
            if blk:
                blk.is_blocked = True
            sig = cloned_network.signals.get(d.target_id) if hasattr(cloned_network, "signals") else None
            if sig:
                from .railway.models import SignalAspect
                sig.aspect = SignalAspect.RED

        elif dtype == "PLATFORM_UNAVAILABLE":
            disrupted_block_ids.append(d.target_id)
            blk = cloned_network.get_block(d.target_id)
            if blk:
                blk.is_blocked = True
            # Also mark the platform as unavailable if accessible
            plat = cloned_network.platforms.get(d.target_id) if hasattr(cloned_network, "platforms") else None
            if plat:
                plat.is_occupied = True

        elif dtype == "WEATHER_RESTRICTION":
            # Weather restriction applies a speed cap to the target block or entire corridor
            blk = cloned_network.get_block(d.target_id)
            if blk:
                blk.current_speed_limit_kmh = min(blk.current_speed_limit_kmh, 45.0)
            else:
                # If no specific block, apply corridor-wide speed cap
                for block in cloned_network.blocks.values():
                    block.current_speed_limit_kmh = min(block.current_speed_limit_kmh, 60.0)

    return disrupted_block_ids


class WhatIfSimulator:
    """
    Isolated What-If Simulation Sandbox.

    Clones live digital twin state without altering the live operational railway.
    Supports:
      - All 7 disruption types (including SIGNAL_FAILURE, PLATFORM_UNAVAILABLE, WEATHER_RESTRICTION)
      - Multiple simultaneous disruptions (scenario composition)
      - Authentic metric computation with NO artificial clamps

    Branches evaluated:
      A. FCFS Baseline (Status Quo)
      B. Priority Heuristic
      C. RAILOPT-X CP-SAT Optimal
    """

    def __init__(self, engine: RailwaySimulationEngine):
        self.engine = engine

    def run_what_if_analysis(
        self,
        injected_disruptions: List[Disruption],
        candidate_actions: Optional[List[Dict[str, Any]]] = None,
    ) -> WhatIfComparisonReport:
        # Create completely isolated topological clone
        cloned_network = self.engine.network.deep_copy()
        current_trains = [Train(**t.model_dump()) for t in self.engine.state.trains.values()]
        num_trains = len(current_trains)
        sim_time = self.engine.state.sim_time_sec

        # Apply ALL disruptions to the sandbox (supports multi-disruption scenarios)
        disrupted_block_ids = _apply_disruptions_to_clone(
            injected_disruptions, cloned_network, current_trains
        )

        total_network_km = sum(b.length_km for b in cloned_network.blocks.values())
        num_blocks = len(cloned_network.blocks)

        # Branch A: Unmitigated Baseline (FCFS)
        fcfs_solver = FCFSDispatcher(cloned_network)
        fcfs_res = fcfs_solver.dispatch(current_trains, sim_time, disrupted_block_ids)
        fcfs_cost = fcfs_res.get("cost_breakdown") or {}
        fcfs_metrics = _compute_metrics_from_schedule(
            fcfs_res.get("schedule", {}), fcfs_cost, num_trains, sim_time, num_blocks, total_network_km
        )
        fcfs_violations = len(fcfs_res.get("validation", {}).get("violations", []))

        baseline_outcome = ScenarioOutcome(
            scenario_id="SCEN_BASELINE_FCFS",
            scenario_name="Status Quo (No Intervention)",
            description="First-Come-First-Served dispatching under disruption",
            average_delay_min=fcfs_metrics["average_delay_min"],
            max_delay_min=fcfs_metrics["max_delay_min"],
            total_network_delay_min=fcfs_metrics["total_network_delay_min"],
            throughput_trains_per_hr=fcfs_metrics["throughput_trains_per_hr"],
            track_utilization_pct=fcfs_metrics["track_utilization_pct"],
            conflicts_count=fcfs_violations,
            punctuality_pct=fcfs_metrics["punctuality_pct"],
            recovery_time_min=fcfs_metrics["recovery_time_min"],
            safety_violations_count=fcfs_violations,
        )

        # Branch B: Priority-Based Heuristic
        prio_solver = PriorityDispatcher(cloned_network)
        prio_res = prio_solver.dispatch(current_trains, sim_time, disrupted_block_ids)
        prio_cost = prio_res.get("cost_breakdown") or {}
        prio_metrics = _compute_metrics_from_schedule(
            prio_res.get("schedule", {}), prio_cost, num_trains, sim_time, num_blocks, total_network_km
        )
        prio_violations = len(prio_res.get("validation", {}).get("violations", []))

        prio_outcome = ScenarioOutcome(
            scenario_id="SCEN_PRIORITY",
            scenario_name="Standard Priority Rules",
            description="Static priority dispatching without dynamic crossing optimization",
            average_delay_min=prio_metrics["average_delay_min"],
            max_delay_min=prio_metrics["max_delay_min"],
            total_network_delay_min=prio_metrics["total_network_delay_min"],
            throughput_trains_per_hr=prio_metrics["throughput_trains_per_hr"],
            track_utilization_pct=prio_metrics["track_utilization_pct"],
            conflicts_count=prio_violations,
            punctuality_pct=prio_metrics["punctuality_pct"],
            recovery_time_min=prio_metrics["recovery_time_min"],
            safety_violations_count=prio_violations,
        )

        # Branch C: RAILOPT-X Mathematical CP-SAT Optimal Plan
        cpsat_solver = CPSATScheduler(cloned_network)
        cpsat_res = cpsat_solver.solve(current_trains, sim_time, disrupted_block_ids)
        cpsat_cost = cpsat_res.get("cost_breakdown") or {}
        cpsat_metrics = _compute_metrics_from_schedule(
            cpsat_res.get("schedule", {}), cpsat_cost, num_trains, sim_time, num_blocks, total_network_km
        )
        cpsat_violations = len(cpsat_res.get("validation", {}).get("violations", []))

        opt_outcome = ScenarioOutcome(
            scenario_id="SCEN_RAILOPT_CPSAT",
            scenario_name="RAILOPT-X AI/CP-SAT Optimal",
            description="Dynamic precedence, loop holding, and crossing re-optimization",
            average_delay_min=cpsat_metrics["average_delay_min"],
            max_delay_min=cpsat_metrics["max_delay_min"],
            total_network_delay_min=cpsat_metrics["total_network_delay_min"],
            throughput_trains_per_hr=cpsat_metrics["throughput_trains_per_hr"],
            track_utilization_pct=cpsat_metrics["track_utilization_pct"],
            conflicts_count=cpsat_violations,
            punctuality_pct=cpsat_metrics["punctuality_pct"],
            recovery_time_min=cpsat_metrics["recovery_time_min"],
            safety_violations_count=cpsat_violations,
        )

        baseline_delay = baseline_outcome.total_network_delay_min
        opt_delay = opt_outcome.total_network_delay_min
        delay_reduc = round(
            ((baseline_delay - opt_delay) / max(0.1, baseline_delay)) * 100.0, 1
        )
        baseline_tp = baseline_outcome.throughput_trains_per_hr
        opt_tp = opt_outcome.throughput_trains_per_hr
        tp_gain = round(
            ((opt_tp - baseline_tp) / max(0.1, baseline_tp)) * 100.0, 1
        )

        alternatives = [prio_outcome]
        if candidate_actions:
            # Use a separately cloned engine so this cannot alter either the
            # solver-comparison clones or the live digital twin.
            physics_branch = self.engine.clone()
            for disruption in injected_disruptions:
                physics_branch.inject_disruption(Disruption(**disruption.model_dump()))
            try:
                alternatives.append(_physics_branch_outcome(physics_branch, candidate_actions))
            except ValueError:
                # Invalid controller actions are not silently turned into a
                # synthetic metric; callers receive only executable branches.
                pass

        return WhatIfComparisonReport(
            baseline_scenario=baseline_outcome,
            optimized_scenario=opt_outcome,
            alternative_scenarios=alternatives,
            delay_reduction_pct=delay_reduc,
            throughput_gain_pct=tp_gain,
            conflicts_eliminated=max(0, baseline_outcome.conflicts_count - opt_outcome.conflicts_count),
        )
