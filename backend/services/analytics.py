from typing import Dict, List, Any, Optional
from pydantic import BaseModel
from ..simulator.railway.models import Train, TrainStatus, TrackBlock


class OperationalKPIs(BaseModel):
    throughput_trains_per_hr: float
    section_clearances_per_hr: float
    average_delay_minutes: float
    maximum_delay_minutes: float
    punctuality_otp_pct: float
    track_utilization_pct: float
    total_active_trains: int
    running_trains_count: int
    delayed_trains_count: int
    stopped_or_waiting_count: int
    conflicts_prevented_total: int
    active_conflicts_predicted: int
    average_dwell_time_sec: float
    recommendation_acceptance_pct: Optional[float] = None


class AnalyticsEngine:
    """
    Computes authentic real-time section performance KPIs from active simulation digital twin state.
    """

    def __init__(self):
        self.conflicts_prevented_counter = 0
        self.total_recommendations_count = 0
        self.approved_recommendations_count = 0

    def compute_kpis(
        self,
        trains: List[Train],
        blocks: List[TrackBlock],
        sim_time_sec: float,
        predicted_conflicts_count: int = 0,
        total_block_transitions: int = 0
    ) -> OperationalKPIs:
        active_trains = [t for t in trains if t.status not in (TrainStatus.CANCELLED, TrainStatus.ARRIVED)]
        arrived_trains = [t for t in trains if t.status == TrainStatus.ARRIVED]
        
        # 1. Section Throughput = Arrived trains / elapsed simulation hours
        if sim_time_sec > 60.0 and len(arrived_trains) > 0:
            elapsed_hours = sim_time_sec / 3600.0
            throughput = round(len(arrived_trains) / elapsed_hours, 1)
        else:
            throughput = 0.0

        # Section Clearances per Hour (Instantaneous block section transitions)
        if sim_time_sec > 30.0:
            elapsed_hours = sim_time_sec / 3600.0
            clearances = round(total_block_transitions / elapsed_hours, 1)
        else:
            clearances = 0.0

        # 2. Delays
        total_delay_sec = sum(t.total_delay_sec for t in trains)
        avg_delay_min = round((total_delay_sec / max(1, len(trains))) / 60.0, 1)
        max_delay_min = round(max((t.total_delay_sec for t in trains), default=0.0) / 60.0, 1)

        # 3. On-Time Performance (OTP)
        on_time = sum(1 for t in trains if t.total_delay_sec <= 300.0)
        otp = round((on_time / max(1, len(trains))) * 100.0, 1)

        # 4. Track Utilization
        occupied_blocks = sum(1 for b in blocks if b.is_occupied)
        utilization = round((occupied_blocks / max(1, len(blocks))) * 100.0, 1)

        # 5. Status breakdowns
        running = sum(1 for t in trains if t.status == TrainStatus.RUNNING)
        delayed = sum(1 for t in trains if t.status == TrainStatus.DELAYED or t.total_delay_sec > 300.0)
        stopped = sum(1 for t in trains if t.status in (TrainStatus.WAITING, TrainStatus.STOPPED, TrainStatus.DISRUPTED))

        acceptance_rate = round(
            (self.approved_recommendations_count / self.total_recommendations_count) * 100.0, 1
        ) if self.total_recommendations_count > 0 else None

        # 6. Dwell time: compute dynamically from timetable stop allocations
        DEFAULT_CORRIDOR_SCHEDULED_DWELL_SEC = 120.0  # Standard 2-min operational passenger halt
        dwell_samples = []
        for t in trains:
            for s in t.stops:
                dwell = max(0.0, float(s.scheduled_departure - s.scheduled_arrival))
                if dwell > 0:
                    dwell_samples.append(dwell)
        avg_dwell = round(sum(dwell_samples) / max(1, len(dwell_samples)), 1) if dwell_samples else DEFAULT_CORRIDOR_SCHEDULED_DWELL_SEC

        return OperationalKPIs(
            throughput_trains_per_hr=throughput,
            section_clearances_per_hr=clearances,
            average_delay_minutes=avg_delay_min,
            maximum_delay_minutes=max_delay_min,
            punctuality_otp_pct=otp,
            track_utilization_pct=utilization,
            total_active_trains=len(active_trains),
            running_trains_count=running,
            delayed_trains_count=delayed,
            stopped_or_waiting_count=stopped,
            conflicts_prevented_total=self.conflicts_prevented_counter,
            active_conflicts_predicted=predicted_conflicts_count,
            average_dwell_time_sec=avg_dwell,
            recommendation_acceptance_pct=acceptance_rate
        )
