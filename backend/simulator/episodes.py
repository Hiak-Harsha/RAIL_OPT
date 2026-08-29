"""
RAILOPT-X 2.0 — Deterministic Operational Episode Suite.

Defines 7 deterministic, replayable, and physically testable operational railway scenarios.
"""
from typing import Dict, List, Any
from pydantic import BaseModel, Field


class OperationalEpisode(BaseModel):
    episode_id: str
    title: str
    category: str
    description: str
    duration_sim_sec: float
    trigger_time_sec: float
    disruption_type: str
    target_id: str
    involved_train_ids: List[str]
    expected_action: str
    expected_delay_savings_min: float
    safety_invariants_count: int


EPISODES: Dict[str, OperationalEpisode] = {
    "EPISODE_01_NOMINAL": OperationalEpisode(
        episode_id="EPISODE_01_NOMINAL",
        title="Nominal High-Density Corridor Timetable",
        category="NOMINAL",
        description="Standard scheduled running of 12 trains across the 435 km NDLS-CNB corridor with zero initial disruptions.",
        duration_sim_sec=1200.0,
        trigger_time_sec=0.0,
        disruption_type="NONE",
        target_id="NDLS_CNB_CORRIDOR",
        involved_train_ids=["T22436", "T12301", "T04403", "T12004"],
        expected_action="NO_INTERVENTION_REQUIRED",
        expected_delay_savings_min=0.0,
        safety_invariants_count=48,
    ),
    "EPISODE_02_EXPRESS_DELAY": OperationalEpisode(
        episode_id="EPISODE_02_EXPRESS_DELAY",
        title="Rajdhani Express Priority Overtake Recovery",
        category="OVERTAKE",
        description="High-priority Express T22436 experiences 4 min initial departure delay and overtakes slow Freight T04403 at GZB station loop.",
        duration_sim_sec=900.0,
        trigger_time_sec=120.0,
        disruption_type="TRAIN_DELAY",
        target_id="T22436",
        involved_train_ids=["T22436", "T04403"],
        expected_action="LOOP_PRECEDENCE",
        expected_delay_savings_min=14.2,
        safety_invariants_count=24,
    ),
    "EPISODE_03_SINGLE_LINE_CROSSING": OperationalEpisode(
        episode_id="EPISODE_03_SINGLE_LINE_CROSSING",
        title="Single-Line Bottleneck Convergence (Aligarh-Tundla)",
        category="CROSSING_CONFLICT",
        description="Opposing trains T22436 (UP) and T04403 (DN) converge on single-line block B05; CP-SAT schedules optimal loop hold at ALJN.",
        duration_sim_sec=1200.0,
        trigger_time_sec=180.0,
        disruption_type="SINGLE_LINE_CONTENTION",
        target_id="BLK_ALJN_TDL_01",
        involved_train_ids=["T22436", "T04403"],
        expected_action="LOOP_PRECEDENCE",
        expected_delay_savings_min=18.5,
        safety_invariants_count=32,
    ),
    "EPISODE_04_BLOCK_CLOSURE": OperationalEpisode(
        episode_id="EPISODE_04_BLOCK_CLOSURE",
        title="Emergency Track Maintenance Block Closure",
        category="TRACK_MAINTENANCE",
        description="Mainline track block BLK_GZB_ALJN_02 closed for urgent rail fracture repair; traffic regulated across bidirectional loop lines.",
        duration_sim_sec=1500.0,
        trigger_time_sec=60.0,
        disruption_type="BLOCK_CLOSURE",
        target_id="BLK_GZB_ALJN_02",
        involved_train_ids=["T22436", "T12301", "T04403"],
        expected_action="REROUTE",
        expected_delay_savings_min=22.0,
        safety_invariants_count=36,
    ),
    "EPISODE_05_SIGNAL_FAILURE": OperationalEpisode(
        episode_id="EPISODE_05_SIGNAL_FAILURE",
        title="Automatic Signaling Interlocking Red Failure",
        category="SIGNALING",
        description="Signal S17 fails to Red aspect; automated dispatch enforces 25 km/h caution speed and headway separation.",
        duration_sim_sec=900.0,
        trigger_time_sec=150.0,
        disruption_type="SIGNAL_FAILURE",
        target_id="SIG_ALJN_01",
        involved_train_ids=["T22436"],
        expected_action="HOLD",
        expected_delay_savings_min=8.0,
        safety_invariants_count=18,
    ),
    "EPISODE_06_PLATFORM_CONTENTION": OperationalEpisode(
        episode_id="EPISODE_06_PLATFORM_CONTENTION",
        title="Station Platform 2 Overlapping Dwell Contention",
        category="STATION_OPERATION",
        description="Two passenger services scheduled for simultaneous arrival at Kanpur Central Platform 2; optimizer reassigns secondary to Platform 3.",
        duration_sim_sec=800.0,
        trigger_time_sec=90.0,
        disruption_type="PLATFORM_UNAVAILABLE",
        target_id="PLAT_CNB_02",
        involved_train_ids=["T12004", "T64521"],
        expected_action="REASSIGN_PLATFORM",
        expected_delay_savings_min=11.5,
        safety_invariants_count=16,
    ),
    "EPISODE_07_WEATHER_CAUTION": OperationalEpisode(
        episode_id="EPISODE_07_WEATHER_CAUTION",
        title="Dense Fog Visual Caution Speed Restriction",
        category="WEATHER",
        description="Dense winter fog imposes 45 km/h maximum speed limit between Tundla and Etawah; solver balances headway to prevent cascade gridlock.",
        duration_sim_sec=1800.0,
        trigger_time_sec=30.0,
        disruption_type="WEATHER_RESTRICTION",
        target_id="SEC_TDL_ETW",
        involved_train_ids=["T22436", "T12301", "T04403", "T12004"],
        expected_action="SPEED_RESTRICTION",
        expected_delay_savings_min=28.4,
        safety_invariants_count=54,
    ),
}


def get_episode(episode_id: str) -> OperationalEpisode:
    return EPISODES.get(episode_id, EPISODES["EPISODE_01_NOMINAL"])


def list_episodes() -> List[Dict[str, Any]]:
    return [ep.model_dump() for ep in EPISODES.values()]
