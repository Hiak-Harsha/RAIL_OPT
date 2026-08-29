from __future__ import annotations
from typing import Dict, List, Any, Optional
from ...simulator.railway.models import Train
from ...simulator.railway.graph import RailwayNetworkGraph
from ..constraints.safety_validator import SafetyValidator
from ..objectives.cost_function import ObjectiveEvaluator


class GreedyDispatcher:
    """
    Greedy Lookahead Dispatcher.
    Evaluates candidate permutations of trains at bottlenecks and greedily selects the lowest local penalty.
    """

    def __init__(self, network: RailwayNetworkGraph, min_headway_sec: float = 180.0):
        self.network = network
        self.min_headway_sec = min_headway_sec
        self.validator = SafetyValidator(network, min_headway_sec)
        self.cost_evaluator = ObjectiveEvaluator()

    def dispatch(
        self,
        trains: List[Train],
        current_time_sec: float = 0.0,
        disrupted_block_ids: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        train_map = {t.train_id: t for t in trains}
        timetables = {t.train_id: [s.model_dump() for s in t.stops] for t in trains}

        base_order = sorted(
            trains,
            key=lambda t: (-t.priority.value, t.stops[0].scheduled_departure if t.stops else current_time_sec)
        )

        candidates = [base_order]
        for i in range(len(base_order) - 1):
            cand = list(base_order)
            cand[i], cand[i+1] = cand[i+1], cand[i]
            candidates.append(cand)

        time_order = sorted(trains, key=lambda t: t.stops[0].scheduled_departure if t.stops else current_time_sec)
        candidates.append(time_order)

        best_cost = float("inf")
        best_schedule = None
        best_val = None
        best_cost_breakdown = None

        for cand in candidates:
            block_free_at: Dict[str, float] = {}
            schedule_movements: Dict[str, List[Dict[str, Any]]] = {}

            for train in cand:
                curr_time = max(
                    current_time_sec,
                    train.stops[0].scheduled_departure if train.stops else current_time_sec
                ) + train.total_delay_sec
                movements = []

                for b_id in train.route_block_ids:
                    block = self.network.get_block(b_id)
                    if not block:
                        continue

                    min_traversal_sec = (block.length_km / (min(train.max_speed_kmh, block.max_speed_kmh) / 3600.0))
                    conflicting = self.network.get_conflicting_blocks(b_id)

                    earliest_enter = curr_time
                    for cb in conflicting:
                        if cb in block_free_at:
                            earliest_enter = max(earliest_enter, block_free_at[cb] + self.min_headway_sec)

                    t_enter = earliest_enter
                    t_exit = t_enter + min_traversal_sec

                    if movements:
                        movements[-1]["exit_time"] = t_enter
                        prev_b_id = movements[-1]["block_id"]
                        for p_cb in self.network.get_conflicting_blocks(prev_b_id):
                            block_free_at[p_cb] = max(block_free_at.get(p_cb, 0.0), t_enter)

                    for cb in conflicting:
                        block_free_at[cb] = t_exit

                    movements.append({
                        "block_id": b_id,
                        "enter_time": round(t_enter, 1),
                        "exit_time": round(t_exit, 1),
                        "is_hold_stop": (t_enter > curr_time + 1.0)
                    })
                    curr_time = t_exit

                schedule_movements[train.train_id] = movements

            val_result = self.validator.validate_schedule(schedule_movements, disrupted_block_ids)
            cost_breakdown = self.cost_evaluator.evaluate(schedule_movements, train_map, timetables)

            if val_result.is_valid and cost_breakdown.total_cost < best_cost:
                best_cost = cost_breakdown.total_cost
                best_schedule = schedule_movements
                best_val = val_result
                best_cost_breakdown = cost_breakdown
            elif best_schedule is None:
                best_schedule = schedule_movements
                best_val = val_result
                best_cost_breakdown = cost_breakdown

        return {
            "method": "Greedy_Lookahead",
            "schedule": best_schedule,
            "validation": best_val.model_dump() if best_val else {"is_valid": True, "violations": []},
            "cost_breakdown": best_cost_breakdown.model_dump() if best_cost_breakdown else {}
        }

    solve = dispatch
