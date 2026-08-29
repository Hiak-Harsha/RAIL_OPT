from __future__ import annotations
from typing import Dict, List, Any
from pydantic import BaseModel
from ...simulator.railway.models import Train, PriorityClass
from ...services.operational_objective import compute_J, ObjectiveWeights, DecisionEvaluation


class CostWeights(BaseModel):
    w_delay: float = 1.0
    w_priority_penalty: float = 2.5
    w_travel_time: float = 0.2
    w_platform_wait: float = 0.5
    w_unnecessary_stops: float = 150.0  # High penalty for bringing heavy trains to complete stop
    w_disruption_cost: float = 1.8


class ScheduleCostBreakdown(BaseModel):
    total_cost: float
    delay_cost: float
    priority_penalty_cost: float
    travel_time_cost: float
    platform_wait_cost: float
    stop_penalty_cost: float
    disruption_cost: float
    total_delay_minutes: float
    max_train_delay_minutes: float
    punctuality_percentage: float
    throughput_trains_per_hr: float = 0.0
    conflicts_count: int = 0

    def to_unified_j(self, priority_weight: float = 1.0, safety_valid: bool = True) -> float:
        """
        Bridge method: map ScheduleCostBreakdown → compute_J() for direct comparability.

        This ensures CP-SAT schedule evaluation and CandidateEvaluator physical branch
        simulation produce scores on the SAME scale using the SAME unified objective.
        """
        return compute_J(
            total_delay_min=self.total_delay_minutes,
            max_delay_min=self.max_train_delay_minutes,
            conflicts_count=self.conflicts_count,
            total_travel_time_min=self.travel_time_cost / max(0.001, 0.2),  # reverse travel_time_w
            throughput_trains_hr=self.throughput_trains_per_hr,
            priority_weight=priority_weight,
            safety_valid=safety_valid,
        )


class ObjectiveEvaluator:
    """
    Mathematical cost evaluation of candidate train schedules.
    Minimizes aggregate delay, priority inversion, and throughput bottlenecks.

    OUTPUT: All scores are bridged to compute_J() via to_unified_j() so that
    CP-SAT schedules are directly comparable to CandidateEvaluator branch results.
    """

    def __init__(self, weights: CostWeights = CostWeights()):
        self.weights = weights

    def evaluate(
        self,
        schedule_movements: Dict[str, List[Dict[str, Any]]],
        train_map: Dict[str, Train],
        scheduled_timetables: Dict[str, List[Dict[str, Any]]]
    ) -> ScheduleCostBreakdown:
        total_delay_sec = 0.0
        priority_penalty = 0.0
        total_travel_time_sec = 0.0
        platform_wait_sec = 0.0
        stop_count = 0
        disruption_penalty = 0.0
        max_delay_sec = 0.0
        on_time_trains = 0

        all_enters: List[float] = []
        all_exits: List[float] = []

        for train_id, movements in schedule_movements.items():
            train = train_map.get(train_id)
            priority_weight = (6 - train.priority.value) if train else 3.0  # P5 delay costs more

            if not movements:
                continue

            # First enter and final exit
            first_enter = movements[0]["enter_time"]
            last_exit = movements[-1]["exit_time"]
            travel_time = last_exit - first_enter
            total_travel_time_sec += travel_time
            all_enters.append(first_enter)
            all_exits.append(last_exit)

            # Compute terminal delay vs scheduled arrival
            st = scheduled_timetables.get(train_id, [])
            if st:
                scheduled_final_arrival = st[-1].get("scheduled_arrival", last_exit)
                delay_sec = max(0.0, last_exit - scheduled_final_arrival)
            else:
                delay_sec = 0.0

            total_delay_sec += delay_sec
            max_delay_sec = max(max_delay_sec, delay_sec)

            # Punctuality threshold (< 5 minutes / 300s is considered on-time in IR standards)
            if delay_sec <= 300.0:
                on_time_trains += 1

            # Priority-weighted delay penalty
            priority_penalty += delay_sec * priority_weight

            # Stop penalty (e.g. dwell/wait at loop lines)
            for m in movements:
                if m.get("is_hold_stop", False):
                    stop_count += 1
                    platform_wait_sec += (m["exit_time"] - m["enter_time"])

        total_trains = max(1, len(schedule_movements))
        punctuality = (on_time_trains / total_trains) * 100.0

        # Compute throughput from schedule span
        if all_enters and all_exits:
            span_sec = max(60.0, max(all_exits) - min(all_enters))
            throughput = round(total_trains / (span_sec / 3600.0), 2)
        else:
            throughput = 0.0

        delay_cost = self.weights.w_delay * (total_delay_sec / 60.0)
        p_cost = self.weights.w_priority_penalty * (priority_penalty / 60.0)
        tt_cost = self.weights.w_travel_time * (total_travel_time_sec / 60.0)
        pw_cost = self.weights.w_platform_wait * (platform_wait_sec / 60.0)
        stop_cost = self.weights.w_unnecessary_stops * stop_count
        disrupt_cost = self.weights.w_disruption_cost * disruption_penalty

        total_j = delay_cost + p_cost + tt_cost + pw_cost + stop_cost + disrupt_cost

        return ScheduleCostBreakdown(
            total_cost=round(total_j, 2),
            delay_cost=round(delay_cost, 2),
            priority_penalty_cost=round(p_cost, 2),
            travel_time_cost=round(tt_cost, 2),
            platform_wait_cost=round(pw_cost, 2),
            stop_penalty_cost=round(stop_cost, 2),
            disruption_cost=round(disrupt_cost, 2),
            total_delay_minutes=round(total_delay_sec / 60.0, 2),
            max_train_delay_minutes=round(max_delay_sec / 60.0, 2),
            punctuality_percentage=round(punctuality, 1),
            throughput_trains_per_hr=throughput,
            conflicts_count=0,  # Set externally from validation results
        )
