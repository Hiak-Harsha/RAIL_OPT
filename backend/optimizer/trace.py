from __future__ import annotations
import time
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class OptimizationCandidateLog(BaseModel):
    candidate_id: str
    description: str
    objective_score: float
    is_valid: bool
    rejection_reason: Optional[str] = None
    projected_delay_reduction_sec: float = 0.0


class OptimizationTrace(BaseModel):
    solver_name: str
    start_time_unix: float
    runtime_ms: float
    total_candidates_generated: int = 0
    rejected_by_block_conflicts: int = 0
    rejected_by_platform_conflicts: int = 0
    rejected_by_headway: int = 0
    rejected_by_speed_limits: int = 0
    feasible_candidates_count: int = 0
    best_candidate_id: Optional[str] = None
    best_objective_score: float = float("inf")
    candidate_logs: List[OptimizationCandidateLog] = Field(default_factory=list)


class OptimizationTracer:
    """
    Records genuine search state during optimization so controllers and judges
    can inspect real candidate schedule exploration.
    """

    def __init__(self, solver_name: str):
        self.trace = OptimizationTrace(
            solver_name=solver_name,
            start_time_unix=time.time(),
            runtime_ms=0.0
        )
        self._start_perf = time.perf_counter()

    def log_candidate(
        self,
        candidate_id: str,
        description: str,
        score: float,
        is_valid: bool,
        rejection_reason: Optional[str] = None,
        delay_reduction_sec: float = 0.0
    ):
        self.trace.total_candidates_generated += 1
        if is_valid:
            self.trace.feasible_candidates_count += 1
            if score < self.trace.best_objective_score:
                self.trace.best_objective_score = score
                self.trace.best_candidate_id = candidate_id
        else:
            reason = rejection_reason or ""
            if "BLOCK_CONFLICT" in reason or "SINGLE_LINE" in reason:
                self.trace.rejected_by_block_conflicts += 1
            elif "PLATFORM" in reason:
                self.trace.rejected_by_platform_conflicts += 1
            elif "HEADWAY" in reason:
                self.trace.rejected_by_headway += 1
            elif "SPEED" in reason:
                self.trace.rejected_by_speed_limits += 1

        self.trace.candidate_logs.append(
            OptimizationCandidateLog(
                candidate_id=candidate_id,
                description=description,
                objective_score=round(score, 2),
                is_valid=is_valid,
                rejection_reason=rejection_reason,
                projected_delay_reduction_sec=round(delay_reduction_sec, 2)
            )
        )

    def finalize(self) -> OptimizationTrace:
        self.trace.runtime_ms = round((time.perf_counter() - self._start_perf) * 1000.0, 2)
        return self.trace
