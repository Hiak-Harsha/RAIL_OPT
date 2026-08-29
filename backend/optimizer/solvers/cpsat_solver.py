from __future__ import annotations
import math
import time
from typing import Dict, List, Any, Optional, Tuple

try:
    from ortools.sat.python import cp_model
    HAS_ORTOOLS = True
except ImportError:
    cp_model = None
    HAS_ORTOOLS = False

from ...simulator.railway.models import Train, PriorityClass
from ...simulator.railway.graph import RailwayNetworkGraph
from ..constraints.safety_validator import SafetyValidator
from ..objectives.cost_function import ObjectiveEvaluator
from ..trace import OptimizationTracer


def _find_earliest_free_interval(
    earliest_start: float,
    duration: float,
    min_headway: float,
    conflicting_intervals: List[Tuple[float, float, str]],
    horizon: float = 86400.0
) -> float:
    """
    Finds the earliest time t >= earliest_start such that [t, t + duration + min_headway]
    does not overlap with any existing interval [start - min_headway, end + min_headway].
    """
    # Sort existing intervals by start time
    sorted_intervals = sorted(conflicting_intervals, key=lambda x: x[0])
    candidate_t = max(0.0, earliest_start)

    for start_occ, end_occ, _ in sorted_intervals:
        # If candidate interval [candidate_t, candidate_t + duration] overlaps with [start_occ, end_occ]
        # with min_headway separation:
        # Non-overlap condition:
        # either candidate_t + duration + min_headway <= start_occ
        # or candidate_t >= end_occ + min_headway
        if not (candidate_t + duration + min_headway <= start_occ or candidate_t >= end_occ + min_headway):
            # Conflict detected: push candidate_t to clear the current occupying train plus headway
            candidate_t = max(candidate_t, end_occ + min_headway)

    return candidate_t


class CPSATScheduler:
    """
    Mathematical Railway Traffic Optimizer.
    Uses Google OR-Tools CP-SAT with unified safety constraint semantics matching SafetyValidator.
    Includes a deterministic interval-insertion CSP fallback when CP-SAT solver is unavailable.
    """

    def __init__(self, network: RailwayNetworkGraph, min_headway_sec: float = 180.0, time_limit_sec: float = 5.0):
        self.network = network
        self.min_headway_sec = float(min_headway_sec)
        self.time_limit_sec = time_limit_sec
        self.validator = SafetyValidator(network, min_headway_sec)
        self.cost_evaluator = ObjectiveEvaluator()

    def solve(
        self,
        trains: List[Train],
        current_time_sec: float = 0.0,
        disrupted_block_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        if HAS_ORTOOLS and cp_model is not None:
            return self._solve_with_ortools(trains, current_time_sec, disrupted_block_ids)
        else:
            return self._solve_with_csp_fallback(trains, current_time_sec, disrupted_block_ids)

    def _solve_with_ortools(
        self,
        trains: List[Train],
        current_time_sec: float = 0.0,
        disrupted_block_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        tracer = OptimizationTracer(solver_name="OR-Tools_CP-SAT")
        train_map = {t.train_id: t for t in trains}
        timetables = {t.train_id: [s.model_dump() for s in t.stops] for t in trains}
        disrupted_set = set(disrupted_block_ids or [])

        model = cp_model.CpModel()
        horizon = int(current_time_sec + 86400)

        enter_vars: Dict[Tuple[str, str], cp_model.IntVar] = {}
        exit_vars: Dict[Tuple[str, str], cp_model.IntVar] = {}
        interval_vars: Dict[Tuple[str, str], cp_model.IntervalVar] = {}
        block_intervals: Dict[str, List[Tuple[str, cp_model.IntVar, cp_model.IntVar]]] = {}

        # 1. Decision Variables and Intra-Train Continuous Trajectory Constraints
        for train in trains:
            earliest_departure = int(max(
                current_time_sec,
                train.stops[0].scheduled_departure if train.stops else current_time_sec
            ) + train.total_delay_sec)

            prev_exit_var = None

            for b_idx, b_id in enumerate(train.route_block_ids):
                block = self.network.get_block(b_id)
                if not block:
                    continue

                min_traversal_sec = int(math.ceil(
                    block.length_km / (min(train.max_speed_kmh, block.max_speed_kmh) / 3600.0)
                ))

                enter_var = model.NewIntVar(
                    earliest_departure if b_idx == 0 else 0,
                    horizon,
                    f"enter_{train.train_id}_{b_id}"
                )
                exit_var = model.NewIntVar(0, horizon, f"exit_{train.train_id}_{b_id}")
                duration_var = model.NewIntVar(min_traversal_sec, horizon, f"dur_{train.train_id}_{b_id}")

                interval_var = model.NewIntervalVar(
                    enter_var,
                    duration_var,
                    exit_var,
                    f"interval_{train.train_id}_{b_id}"
                )

                enter_vars[(train.train_id, b_id)] = enter_var
                exit_vars[(train.train_id, b_id)] = exit_var
                interval_vars[(train.train_id, b_id)] = interval_var

                if prev_exit_var is not None:
                    model.Add(enter_var == prev_exit_var)
                prev_exit_var = exit_var

                conflicting = self.network.get_conflicting_blocks(b_id)
                for cb in conflicting:
                    if cb not in block_intervals:
                        block_intervals[cb] = []
                    block_intervals[cb].append((train.train_id, enter_var, exit_var))

        # 2. Hard Spatial-Temporal Separation & Clearance Headway Constraints
        for b_id, intervals in block_intervals.items():
            for i in range(len(intervals)):
                t1_id, enter1, exit1 = intervals[i]
                for j in range(i + 1, len(intervals)):
                    t2_id, enter2, exit2 = intervals[j]
                    if t1_id == t2_id:
                        continue

                    prec = model.NewBoolVar(f"prec_{t1_id}_{t2_id}_{b_id}")
                    model.Add(enter2 >= exit1 + int(self.min_headway_sec)).OnlyEnforceIf(prec)
                    model.Add(enter1 >= exit2 + int(self.min_headway_sec)).OnlyEnforceIf(prec.Not())

        # 3. Disrupted Block Prevention
        for b_id in disrupted_set:
            if b_id in block_intervals:
                for train_id, enter_v, exit_v in block_intervals[b_id]:
                    model.Add(enter_v >= horizon)

        # 4. Multi-Objective Cost Function: Weighted Terminal Delay + Travel Time
        objective_terms = []
        for train in trains:
            if not train.route_block_ids:
                continue
            last_block_id = train.route_block_ids[-1]
            first_block_id = train.route_block_ids[0]

            if (train.train_id, last_block_id) in exit_vars and (train.train_id, first_block_id) in enter_vars:
                final_exit = exit_vars[(train.train_id, last_block_id)]
                first_enter = enter_vars[(train.train_id, first_block_id)]
                
                st = timetables.get(train.train_id, [])
                sched_final = int(st[-1].get("scheduled_arrival", 0)) if st else 0

                delay_var = model.NewIntVar(0, horizon, f"delay_{train.train_id}")
                model.Add(delay_var >= final_exit - sched_final)

                priority_multiplier = (6 - train.priority.value) * 10
                objective_terms.append(delay_var * priority_multiplier)
                
                travel_time_var = model.NewIntVar(0, horizon, f"travel_{train.train_id}")
                model.Add(travel_time_var == final_exit - first_enter)
                objective_terms.append(travel_time_var)

        if objective_terms:
            model.Minimize(sum(objective_terms))

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.time_limit_sec
        solver.parameters.num_workers = 4
        status = solver.Solve(model)

        schedule_movements: Dict[str, List[Dict[str, Any]]] = {}

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            for train in trains:
                movements = []
                for b_id in train.route_block_ids:
                    if (train.train_id, b_id) in enter_vars:
                        t_enter = solver.Value(enter_vars[(train.train_id, b_id)])
                        t_exit = solver.Value(exit_vars[(train.train_id, b_id)])
                        movements.append({
                            "block_id": b_id,
                            "enter_time": float(t_enter),
                            "exit_time": float(t_exit),
                            "is_hold_stop": False
                        })
                schedule_movements[train.train_id] = movements

            val_result = self.validator.validate_schedule(schedule_movements, disrupted_block_ids)
            cost_breakdown = self.cost_evaluator.evaluate(schedule_movements, train_map, timetables)

            # Evaluate baseline comparison candidates for rich search trace
            try:
                from ..baselines.fcfs import FCFSDispatcher
                from ..baselines.priority import PriorityDispatcher
                fcfs_disp = FCFSDispatcher(self.network, self.min_headway_sec)
                fcfs_res = fcfs_disp.dispatch(trains, current_time_sec, disrupted_block_ids)
                fcfs_cost = fcfs_res.get("cost_breakdown", {}).get("total_cost", 9999.0)
                fcfs_val = fcfs_res.get("validation", {}).get("is_valid", True)
                tracer.log_candidate(
                    candidate_id="CAND_01_FCFS",
                    description="Baseline First-Come-First-Served Sequence",
                    score=fcfs_cost,
                    is_valid=fcfs_val
                )

                prio_disp = PriorityDispatcher(self.network, self.min_headway_sec)
                prio_res = prio_disp.dispatch(trains, current_time_sec, disrupted_block_ids)
                prio_cost = prio_res.get("cost_breakdown", {}).get("total_cost", 8888.0)
                prio_val = prio_res.get("validation", {}).get("is_valid", True)
                tracer.log_candidate(
                    candidate_id="CAND_02_PRIORITY",
                    description="Static Priority Rule Sequence",
                    score=prio_cost,
                    is_valid=prio_val
                )
            except Exception:
                pass

            tracer.log_candidate(
                candidate_id="CAND_CPSAT_OPTIMAL",
                description=f"OR-Tools CP-SAT Solution ({solver.StatusName(status)})",
                score=cost_breakdown.total_cost,
                is_valid=val_result.is_valid,
                rejection_reason=val_result.violations[0].explanation if not val_result.is_valid else None
            )
            trace_result = tracer.finalize()

            return {
                "solver": "OR-Tools_CP-SAT",
                "status": solver.StatusName(status),
                "schedule": schedule_movements,
                "validation": val_result.model_dump(),
                "cost_breakdown": cost_breakdown.model_dump(),
                "trace": trace_result.model_dump(),
                "solver_stats": {
                    "wall_time_sec": round(solver.WallTime(), 3),
                    "branches": solver.NumBranches(),
                    "conflicts": solver.NumConflicts()
                }
            }
        else:
            return self._solve_with_csp_fallback(trains, current_time_sec, disrupted_block_ids)

    def _solve_with_csp_fallback(
        self,
        trains: List[Train],
        current_time_sec: float = 0.0,
        disrupted_block_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Deterministic Interval-Insertion CSP Fallback Scheduler.
        Maintains resource occupancy interval maps and computes conflict-free trajectories
        that strictly satisfy continuous block occupancy and headway separation invariants.
        """
        tracer = OptimizationTracer(solver_name="Deterministic_CSP_Fallback")
        train_map = {t.train_id: t for t in trains}
        timetables = {t.train_id: [s.model_dump() for s in t.stops] for t in trains}

        # Generate candidate precedence sequences
        # 1. Chronological departure sequence
        chrono_order = sorted(
            trains,
            key=lambda t: (t.stops[0].scheduled_departure if t.stops else current_time_sec) + t.total_delay_sec
        )
        # 2. Priority-first sequence
        prio_order = sorted(
            trains,
            key=lambda t: (-t.priority.value, (t.stops[0].scheduled_departure if t.stops else current_time_sec) + t.total_delay_sec)
        )
        # 3. Swapped sequence
        swapped_order = list(chrono_order)
        if len(swapped_order) >= 2:
            swapped_order[0], swapped_order[1] = swapped_order[1], swapped_order[0]

        candidates = [chrono_order, prio_order, swapped_order]

        best_schedule = None
        best_cost = float("inf")
        best_val = None
        best_cost_breakdown = None

        for idx, candidate_trains in enumerate(candidates):
            # Map of block_id -> List of (enter_time, exit_time, train_id)
            block_occupancy_intervals: Dict[str, List[Tuple[float, float, str]]] = {}
            schedule_movements: Dict[str, List[Dict[str, Any]]] = {}

            for train in candidate_trains:
                curr_t = max(
                    current_time_sec,
                    train.stops[0].scheduled_departure if train.stops else current_time_sec
                ) + train.total_delay_sec
                movements = []

                for b_idx, b_id in enumerate(train.route_block_ids):
                    block = self.network.get_block(b_id)
                    if not block:
                        continue

                    min_traversal_sec = block.length_km / (min(train.max_speed_kmh, block.max_speed_kmh) / 3600.0)
                    conflicting_blocks = self.network.get_conflicting_blocks(b_id)

                    # Gather all intervals on conflicting blocks
                    conf_intervals: List[Tuple[float, float, str]] = []
                    for cb in conflicting_blocks:
                        conf_intervals.extend(block_occupancy_intervals.get(cb, []))

                    # Find earliest entry time >= curr_t
                    t_enter = _find_earliest_free_interval(
                        earliest_start=curr_t,
                        duration=min_traversal_sec,
                        min_headway=self.min_headway_sec,
                        conflicting_intervals=conf_intervals
                    )
                    t_exit = t_enter + min_traversal_sec

                    # Maintain continuous dwell on previous block
                    if movements:
                        prev_move = movements[-1]
                        prev_move["exit_time"] = t_enter
                        prev_b_id = prev_move["block_id"]
                        
                        # Update previous block interval in occupancy map
                        for p_cb in self.network.get_conflicting_blocks(prev_b_id):
                            if p_cb in block_occupancy_intervals:
                                for i_idx in range(len(block_occupancy_intervals[p_cb])):
                                    ent, ex, tr_id = block_occupancy_intervals[p_cb][i_idx]
                                    if tr_id == train.train_id:
                                        block_occupancy_intervals[p_cb][i_idx] = (ent, t_enter, tr_id)

                    # Register new occupancy on all conflicting blocks
                    for cb in conflicting_blocks:
                        if cb not in block_occupancy_intervals:
                            block_occupancy_intervals[cb] = []
                        block_occupancy_intervals[cb].append((t_enter, t_exit, train.train_id))

                    movements.append({
                        "block_id": b_id,
                        "enter_time": round(t_enter, 1),
                        "exit_time": round(t_exit, 1),
                        "is_hold_stop": (t_enter > curr_t + 1.0)
                    })
                    curr_t = t_exit

                schedule_movements[train.train_id] = movements

            val_result = self.validator.validate_schedule(schedule_movements, disrupted_block_ids)
            cost_breakdown = self.cost_evaluator.evaluate(schedule_movements, train_map, timetables)

            tracer.log_candidate(
                candidate_id=f"CAND_CSP_{idx:02d}",
                description=f"Interval-Insertion Candidate #{idx}",
                score=cost_breakdown.total_cost,
                is_valid=val_result.is_valid,
                rejection_reason=val_result.violations[0].explanation if not val_result.is_valid else None
            )

            if val_result.is_valid and cost_breakdown.total_cost < best_cost:
                best_cost = cost_breakdown.total_cost
                best_schedule = schedule_movements
                best_val = val_result
                best_cost_breakdown = cost_breakdown
            elif best_schedule is None:
                best_schedule = schedule_movements
                best_val = val_result
                best_cost_breakdown = cost_breakdown

        trace_result = tracer.finalize()

        return {
            "solver": "Deterministic_CSP_Fallback",
            "status": "FEASIBLE" if best_val and best_val.is_valid else "INFEASIBLE",
            "schedule": best_schedule,
            "validation": best_val.model_dump() if best_val else {"is_valid": True, "violations": []},
            "cost_breakdown": best_cost_breakdown.model_dump() if best_cost_breakdown else {},
            "trace": trace_result.model_dump(),
            "solver_stats": {
                "wall_time_sec": round(trace_result.runtime_ms / 1000.0, 3),
                "candidates_explored": trace_result.total_candidates_generated
            }
        }
