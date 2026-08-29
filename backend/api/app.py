from __future__ import annotations
import os
import asyncio
from pathlib import Path
from typing import Dict, List, Any, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Body, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ..simulator.engine import RailwaySimulationEngine
from ..simulator.railway.models import (
    Disruption, DisruptionType, Recommendation, DecisionAction,
    ControllerActionType, TrainStatus, SimulationControlAction
)
from ..simulator.what_if import WhatIfSimulator
from ..simulator.scenario_director import ScenarioDirector
from ..ai.prediction.conflict_radar import ConflictRadar
from ..ai.prediction.delay_propagation import DelayPropagationEstimator
from ..ai.xai.explainer import DecisionExplainer
from ..services.analytics import AnalyticsEngine
from ..services.benchmark import BenchmarkRunner
from ..services.audit import AuditLogger
from ..services.decision_orchestrator import DecisionOrchestrator
from ..services.rbac import enforce_permission, can_perform, check_role_permission
from ..websocket.server import WebSocketManager

@asynccontextmanager
async def lifespan(app: FastAPI):
    global sim_task
    sim_task = asyncio.create_task(simulation_loop())
    yield
    if sim_task:
        sim_task.cancel()
        try:
            await sim_task
        except asyncio.CancelledError:
            pass

app = FastAPI(
    title="RAILOPT-X Railway Traffic Decision-Support Engine",
    description="Real-time AI & Mathematical Optimization Platform for Section Controllers (SIH PS 25022)",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://localhost:80",
        "http://localhost",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize Core Services
SCENARIO_PATH = Path(__file__).parent.parent / "data" / "scenarios" / "synthetic_section.json"
sim_engine = RailwaySimulationEngine(str(SCENARIO_PATH))
ws_manager = WebSocketManager()
conflict_radar = ConflictRadar(sim_engine.network)
delay_estimator = DelayPropagationEstimator(sim_engine.network)
explainer = DecisionExplainer(sim_engine.network, sim_engine)
analytics = AnalyticsEngine()
benchmark_runner = BenchmarkRunner(sim_engine.network)
audit_logger = AuditLogger()
what_if_simulator = WhatIfSimulator(sim_engine)

# Sole AI decision pipeline — ALL conflict-to-recommendation logic runs through here
decision_orchestrator = DecisionOrchestrator(
    network=sim_engine.network,
    engine=sim_engine,
    optimizer=sim_engine.optimizer,
    explainer=explainer,
    delay_estimator=delay_estimator,
)

# Cooldown tracker for rejected recommendations to prevent infinite duplicate loops
rejected_fingerprints: Dict[str, float] = {}
# Pending post-approval outcome verifier to accurately measure prevented conflicts
pending_outcomes: List[Dict[str, Any]] = []

# Connect simulation engine events to WebSocket broadcaster
def on_sim_event(event: Dict[str, Any]):
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(ws_manager.broadcast_event("SIM_EVENT", event))
    except RuntimeError:
        pass

sim_engine.register_event_listener(on_sim_event)

# Background simulation ticker task
sim_task: Optional[asyncio.Task] = None

async def simulation_loop():
    while True:
        if sim_engine.state.is_running:
            sim_engine.tick(delta_sec=0.5)

            # Scan proactive conflicts via ConflictRadar
            trains_list = list(sim_engine.state.trains.values())
            conflicts = conflict_radar.scan_conflicts(trains_list, sim_engine.state.sim_time_sec)

            # If critical conflict and no active recommendation:
            # delegate ENTIRELY to DecisionOrchestrator — the sole AI pipeline
            if conflicts and not sim_engine.state.active_recommendations:
                conf = conflicts[0]
                fp = f"{conf.location_block_id}_{'_'.join(sorted(conf.involved_train_ids))}"
                now_sim = sim_engine.state.sim_time_sec

                # 60s cooldown to prevent repeated rejection loops
                if now_sim - rejected_fingerprints.get(fp, -9999.0) >= 60.0:
                    rec = await asyncio.to_thread(
                        decision_orchestrator.handle_predicted_conflict,
                        conf,
                        trains_list,
                        list(sim_engine.network.blocks.values()),
                        now_sim,
                    )
                    if rec:
                        sim_engine.state.active_recommendations[rec.recommendation_id] = rec
                        sim_engine.emit_event("RECOMMENDATION_CREATED", rec.model_dump())

            # Preserve recommendations while actionable: only retire when the conflict is resolved or superseded
            active_conflict_blocks = {c.location_block_id for c in conflicts}
            active_conflict_trains = {t_id for c in conflicts for t_id in c.involved_train_ids}
            stale_keys = [
                k for k, r in sim_engine.state.active_recommendations.items()
                if (r.target_block_id and r.target_block_id not in active_conflict_blocks)
                and (not any(t_id in active_conflict_trains for t_id in r.affected_train_ids))
            ]
            for k in stale_keys:
                del sim_engine.state.active_recommendations[k]

            # Measure actual post-approval outcomes
            for po in pending_outcomes:
                if not po["resolved"] and (sim_engine.state.sim_time_sec - po["approved_at_sec"]) >= 30.0:
                    current_conflicts = [
                        c for c in conflicts
                        if c.location_block_id == po["target_block_id"]
                    ]
                    if not current_conflicts:
                        analytics.conflicts_prevented_counter += 1
                        po["resolved"] = True
                        sim_engine.emit_event("OUTCOME_VERIFIED", {
                            "recommendation_id": po["recommendation_id"],
                            "status": "CONFLICT_PREVENTED_VERIFIED",
                            "timestamp_sec": sim_engine.state.sim_time_sec
                        })

            # Broadcast live state update every tick
            snapshot = sim_engine.get_snapshot()
            kpis = analytics.compute_kpis(
                trains=trains_list,
                blocks=list(sim_engine.network.blocks.values()),
                sim_time_sec=sim_engine.state.sim_time_sec,
                predicted_conflicts_count=len(conflicts),
                total_block_transitions=sim_engine.total_block_transitions
            )
            snapshot["kpis"] = kpis.model_dump()
            snapshot["predicted_conflicts"] = [c.model_dump() for c in conflicts]
            await ws_manager.broadcast_event("STATE_UPDATE", snapshot)

        await asyncio.sleep(0.5)


# --- REST API Endpoints ---

@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "system": "RAILOPT-X",
        "sim_time_sec": sim_engine.state.sim_time_sec,
        "is_running": sim_engine.state.is_running
    }


@app.get("/api/topology")
def get_topology():
    return {
        "corridor_name": "NDLS - CNB High-Density Triple-Action Corridor",
        "stations": [stn.model_dump() for stn in sim_engine.network.stations.values()],
        "blocks": [blk.model_dump() for blk in sim_engine.network.blocks.values()],
        "signals": [sig.model_dump() for sig in sim_engine.network.signals.values()],
        "platforms": [plat.model_dump() for plat in sim_engine.network.platforms.values()]
    }


@app.get("/api/state")
def get_state():
    trains_list = list(sim_engine.state.trains.values())
    conflicts = conflict_radar.scan_conflicts(trains_list, sim_engine.state.sim_time_sec)
    kpis = analytics.compute_kpis(
        trains=trains_list,
        blocks=list(sim_engine.network.blocks.values()),
        sim_time_sec=sim_engine.state.sim_time_sec,
        predicted_conflicts_count=len(conflicts),
        total_block_transitions=sim_engine.total_block_transitions
    )
    snapshot = sim_engine.get_snapshot()
    snapshot["kpis"] = kpis.model_dump()
    snapshot["predicted_conflicts"] = [c.model_dump() for c in conflicts]
    return snapshot


class ScenarioLoadRequest(BaseModel):
    scenario_id: str


@app.post("/api/scenarios/load", deprecated=True)
def load_scenario_legacy(req: ScenarioLoadRequest, x_user_role: Optional[str] = Header(None)):
    """Legacy scenario loading endpoint; delegates to ScenarioDirector."""
    enforce_permission("controlSimulation", x_user_role)
    result = ScenarioDirector.apply_scenario(sim_engine, req.scenario_id)
    if result.get("status") == "FAILED":
        raise HTTPException(status_code=404, detail=result.get("reason", "Scenario loading failed"))
    rejected_fingerprints.clear()
    pending_outcomes.clear()
    return result


class SimControlRequest(BaseModel):
    action: SimulationControlAction
    time_scale: Optional[float] = Field(default=None, ge=0.1, le=20.0)
    target_time_sec: Optional[float] = Field(default=None, ge=0.0)
    event_type: Optional[str] = None


@app.post("/api/simulation/control")
def control_simulation(req: SimControlRequest, x_user_role: Optional[str] = Header(None)):
    enforce_permission("controlSimulation", x_user_role)
    if req.action == SimulationControlAction.START:
        sim_engine.state.is_running = True
    elif req.action == SimulationControlAction.PAUSE:
        sim_engine.state.is_running = False
    elif req.action == SimulationControlAction.SET_SCALE:
        if req.time_scale is None:
            raise HTTPException(status_code=400, detail="time_scale parameter (0.1 - 20.0) required for SET_SCALE")
        sim_engine.state.time_scale = req.time_scale
    elif req.action == SimulationControlAction.RESET:
        sim_engine.reset()
        rejected_fingerprints.clear()
        pending_outcomes.clear()
    elif req.action == SimulationControlAction.JUMP_TO_TIME:
        if req.target_time_sec is None:
            raise HTTPException(status_code=400, detail="target_time_sec parameter required for JUMP_TO_TIME")
        sim_engine.fast_forward_to(req.target_time_sec)
    elif req.action == SimulationControlAction.JUMP_TO_DEMO:
        target = req.target_time_sec if req.target_time_sec is not None else 600.0
        sim_engine.jump_to_demo_window(target)
    elif req.action == SimulationControlAction.JUMP_TO_NEXT_CONFLICT:
        sim_engine.jump_to_next_conflict()
    elif req.action == SimulationControlAction.JUMP_TO_NEXT_EVENT:
        sim_engine.jump_to_next_event(req.event_type or "ANY")
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported simulation action '{req.action}'")
    
    sim_engine.emit_event("SIMULATION_CONTROL_CHANGED", {
        "is_running": sim_engine.state.is_running,
        "time_scale": sim_engine.state.time_scale,
        "sim_time_sec": sim_engine.state.sim_time_sec
    })
    return {
        "status": "SUCCESS",
        "is_running": sim_engine.state.is_running,
        "time_scale": sim_engine.state.time_scale,
        "sim_time_sec": sim_engine.state.sim_time_sec
    }


@app.get("/api/scenarios")
def list_scenarios():
    """List all deterministic pre-configured simulation scenarios."""
    return {"status": "SUCCESS", "scenarios": ScenarioDirector.list_scenarios()}


@app.post("/api/scenarios/{scenario_id}/load")
def load_scenario(scenario_id: str, x_user_role: Optional[str] = Header(None)):
    """Load and initialize a deterministic simulation scenario."""
    enforce_permission("controlSimulation", x_user_role)
    result = ScenarioDirector.apply_scenario(sim_engine, scenario_id)
    if result.get("status") == "FAILED":
        raise HTTPException(status_code=404, detail=result.get("reason", "Scenario loading failed"))
    rejected_fingerprints.clear()
    pending_outcomes.clear()
    return result


class DisruptionCreateRequest(BaseModel):
    disruption_type: DisruptionType
    target_id: str
    duration_sec: float
    description: str


@app.post("/api/disruptions")
def inject_disruption(req: DisruptionCreateRequest, x_user_role: Optional[str] = Header(None)):
    enforce_permission("injectDisruption", x_user_role)
    disruption = Disruption(
        id=f"DIS_{len(sim_engine.state.disruptions)+1:03d}",
        disruption_type=req.disruption_type,
        target_id=req.target_id,
        start_time_sec=sim_engine.state.sim_time_sec,
        duration_sec=req.duration_sec,
        description=req.description
    )
    res = sim_engine.inject_disruption(disruption)
    return res


@app.post("/api/optimize")
def run_optimization(solver_type: str = Query("OR-Tools_CP-SAT"), x_user_role: Optional[str] = Header(None)):
    enforce_permission("optimize", x_user_role)
    trains_list = list(sim_engine.state.trains.values())
    disrupted_blocks = [d.target_id for d in sim_engine.state.disruptions.values() if d.disruption_type == DisruptionType.BLOCK_CLOSURE]
    
    if solver_type == "OR-Tools_CP-SAT":
        res = sim_engine.optimizer.solve(trains_list, sim_engine.state.sim_time_sec, disrupted_blocks)
    elif solver_type == "Priority":
        res = sim_engine.priority_baseline.dispatch(trains_list, sim_engine.state.sim_time_sec, disrupted_blocks)
    else:
        res = sim_engine.priority_baseline.dispatch(trains_list, sim_engine.state.sim_time_sec, disrupted_blocks)
    
    if "trace" in res:
        sim_engine.emit_event("OPTIMIZER_TRACE", {
            "solver": solver_type,
            "status": res.get("status", "OPTIMAL"),
            "trace": res["trace"]
        })
    return res


class ControllerDecisionRequest(BaseModel):
    recommendation_id: str
    action: ControllerActionType  # APPROVE, REJECT, OVERRIDE
    override_reason: Optional[str] = None
    selected_candidate_id: Optional[str] = None


def _candidate_for_request(rec: Recommendation, candidate_id: Optional[str]) -> Optional[Dict[str, Any]]:
    """Return an evaluated candidate by id; never infer a plan from a display label."""
    if not candidate_id:
        candidate_id = rec.source_candidate_id
    if not candidate_id:
        return None
    return next((opt for opt in rec.counterfactual_options if opt.get("candidate_id", opt.get("option_id")) == candidate_id), None)


@app.get("/api/recommendations/{recommendation_id}/preview")
def preview_recommendation_candidate(recommendation_id: str, candidate_id: str, horizon_sec: float = 300.0):
    rec = sim_engine.state.active_recommendations.get(recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found or already resolved")
    candidate = _candidate_for_request(rec, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate does not belong to this recommendation")
    if not candidate.get("safety_valid", False):
        raise HTTPException(status_code=409, detail="Unsafe candidates cannot be previewed as executable futures")
    return sim_engine.preview_candidate_actions(candidate.get("actions", []), min(max(horizon_sec, 30.0), 900.0))


@app.post("/api/recommendations/action")
def handle_controller_decision(req: ControllerDecisionRequest, x_user_role: Optional[str] = Header(None)):
    enforce_permission("approveDecision", x_user_role)
    rec = sim_engine.state.active_recommendations.get(req.recommendation_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    rec.controller_decision = req.action
    rec.override_reason = req.override_reason
    analytics.total_recommendations_count += 1

    target_train_id = rec.primary_train_id
    action_name = rec.action.value if hasattr(rec.action, "value") else str(rec.action)
    target_block = rec.target_block_id
    hold_duration = rec.duration_sec

    chosen_opt = _candidate_for_request(rec, req.selected_candidate_id)
    if req.selected_candidate_id and not chosen_opt:
        raise HTTPException(status_code=404, detail="Selected candidate does not belong to this recommendation")
    if chosen_opt:
        if not chosen_opt.get("safety_valid", False) and req.action == ControllerActionType.APPROVE:
            raise HTTPException(status_code=409, detail="Cannot approve an unsafe candidate branch")
        rec.source_candidate_id = chosen_opt.get("candidate_id", chosen_opt.get("option_id"))

    affected_pair = rec.affected_train_ids if rec.affected_train_ids else [target_train_id]

    if req.action == ControllerActionType.APPROVE:
        if not rec.safety_valid:
            raise HTTPException(
                status_code=409,
                detail="Cannot approve: no safety-validated plan exists for this conflict. Reject the recommendation or submit an explicit OVERRIDE with a mandatory logged reason."
            )
        analytics.approved_recommendations_count += 1
        
        # Track pending outcome measurement instead of prematurely incrementing conflicts_prevented
        pending_outcomes.append({
            "recommendation_id": rec.recommendation_id,
            "approved_at_sec": sim_engine.state.sim_time_sec,
            "target_block_id": target_block,
            "affected_train_ids": affected_pair,
            "resolved": False
        })
        
        # Apply the exact evaluated branch; fall back only for legacy recommendations.
        result = sim_engine.apply_candidate_actions(chosen_opt.get("actions", [])) if chosen_opt else sim_engine.apply_controller_action(
            action_type=action_name, train_id=target_train_id,
            hold_duration_sec=hold_duration, target_block_id=target_block)
        if result.get("status") != "SUCCESS":
            raise HTTPException(status_code=409, detail=result.get("reason", "Unable to apply dispatch plan"))

        rec.applied = True
        sim_engine.emit_event("DECISION_APPROVED", rec.model_dump())

    elif req.action == ControllerActionType.REJECT:
        rec.applied = False
        fp = f"{rec.target_block_id}_{'_'.join(sorted(affected_pair))}"
        rejected_fingerprints[fp] = sim_engine.state.sim_time_sec
        sim_engine.emit_event("DECISION_REJECTED", rec.model_dump())

    elif req.action == ControllerActionType.OVERRIDE:
        if not req.override_reason or not req.override_reason.strip():
            raise HTTPException(
                status_code=400,
                detail="Controller manual override requires a mandatory non-empty justification reason."
            )
        rec.applied = True
        action_name = rec.action.value if hasattr(rec.action, "value") else str(rec.action)
        sim_engine.apply_controller_action(
            action_type=action_name,
            train_id=target_train_id,
            hold_duration_sec=rec.duration_sec,
            target_block_id=rec.target_block_id
        )
        sim_engine.emit_event("DECISION_OVERRIDDEN", {
            "recommendation_id": req.recommendation_id,
            "override_reason": req.override_reason
        })

    # Log to immutable audit trail
    audit_logger.record_decision(
        recommendation_id=rec.recommendation_id,
        train_id=target_train_id,
        action=rec.action,
        ai_reason=rec.reason_summary,
        controller_action=req.action,
        projected_delay_saved_sec=rec.projected_metrics_diff.get("delay_saved_min", 0.0) * 60.0,
        override_reason=req.override_reason
    )

    del sim_engine.state.active_recommendations[req.recommendation_id]
    return {"status": "SUCCESS", "recommendation": rec.model_dump()}


@app.post("/api/what-if")
def run_what_if_analysis(disruptions: List[DisruptionCreateRequest] = Body(...), x_user_role: Optional[str] = Header(None)):
    enforce_permission("whatIf", x_user_role)
    disruption_models = [
        Disruption(
            id=f"WIF_{i+1:02d}",
            disruption_type=d.disruption_type,
            target_id=d.target_id,
            start_time_sec=sim_engine.state.sim_time_sec,
            duration_sec=d.duration_sec,
            description=d.description
        )
        for i, d in enumerate(disruptions)
    ]
    report = what_if_simulator.run_what_if_analysis(disruption_models)
    return report.model_dump()


class WhatIfCandidateRequest(BaseModel):
    disruptions: List[DisruptionCreateRequest] = []
    candidate_actions: List[Dict[str, Any]] = []


@app.post("/api/what-if/candidate")
def run_candidate_what_if_analysis(req: WhatIfCandidateRequest, x_user_role: Optional[str] = Header(None)):
    """Compare an exact controller candidate with baseline/heuristic/CP-SAT branches."""
    enforce_permission("whatIf", x_user_role)
    disruption_models = [
        Disruption(
            id=f"WIF_{i+1:02d}", disruption_type=d.disruption_type, target_id=d.target_id,
            start_time_sec=sim_engine.state.sim_time_sec, duration_sec=d.duration_sec,
            description=d.description,
        ) for i, d in enumerate(req.disruptions)
    ]
    return what_if_simulator.run_what_if_analysis(disruption_models, req.candidate_actions).model_dump()


@app.get("/api/branches/{branch_id}/diff")
def get_branch_diff(branch_id: str):
    """Compare a candidate or What-If scenario branch against the live operational twin.

    Clones the live engine state, fast-forwards both baseline and branch,
    then computes the authentic delta between them. No hardcoded metrics.
    """
    horizon_sec = 900.0  # 15-minute evaluation window

    # --- Baseline branch: clone current state, advance with no intervention ---
    baseline_engine = sim_engine.clone()
    baseline_start = baseline_engine.state.sim_time_sec
    baseline_engine.fast_forward_to(baseline_start + horizon_sec)
    baseline_trains = list(baseline_engine.state.trains.values())
    baseline_delay = sum(t.total_delay_sec for t in baseline_trains) / 60.0
    baseline_conflicts = len(baseline_engine.state.predicted_conflicts)
    baseline_arrived = sum(
        1 for t in baseline_trains
        if getattr(t.status, "value", str(t.status)) == "ARRIVED"
    )
    baseline_throughput = baseline_arrived / (horizon_sec / 3600.0) if horizon_sec > 0 else 0.0

    # --- Branch: check if there are pending recommendations to apply ---
    branch_engine = sim_engine.clone()
    branch_actions_applied = False
    for rec in list(branch_engine.state.active_recommendations.values()):
        try:
            branch_engine.apply_controller_action(
                action_type=rec.action.value if hasattr(rec.action, "value") else str(rec.action),
                train_id=rec.affected_train_ids[0] if rec.affected_train_ids else "",
            )
            branch_actions_applied = True
        except Exception:
            pass

    branch_engine.fast_forward_to(branch_engine.state.sim_time_sec + horizon_sec)
    branch_trains = list(branch_engine.state.trains.values())
    branch_delay = sum(t.total_delay_sec for t in branch_trains) / 60.0
    branch_conflicts = len(branch_engine.state.predicted_conflicts)
    branch_arrived = sum(
        1 for t in branch_trains
        if getattr(t.status, "value", str(t.status)) == "ARRIVED"
    )
    branch_throughput = branch_arrived / (horizon_sec / 3600.0) if horizon_sec > 0 else 0.0

    # --- Compute delta ---
    delay_saved = round(baseline_delay - branch_delay, 2)
    conflicts_prevented = max(0, baseline_conflicts - branch_conflicts)
    throughput_gain = round(
        ((branch_throughput - baseline_throughput) / max(baseline_throughput, 0.01)) * 100.0, 2
    )
    safety_valid = branch_conflicts == 0

    return {
        "branch_id": branch_id,
        "base_sim_time_sec": sim_engine.state.sim_time_sec,
        "is_live_twin": False,
        "status": "EVALUATED" if branch_actions_applied else "NO_ACTIONS_AVAILABLE",
        "delta": {
            "delay_saved_min": delay_saved,
            "conflicts_prevented": conflicts_prevented,
            "throughput_gain_pct": throughput_gain,
            "safety_valid": safety_valid,
        },
    }


@app.get("/api/benchmarks")
def get_benchmarks(x_user_role: Optional[str] = Header(None)):
    enforce_permission("analytics", x_user_role)
    trains_list = list(sim_engine.state.trains.values())
    res = benchmark_runner.run_full_suite(trains_list)
    return res.model_dump()


@app.get("/api/audit")
def get_audit_trail(x_user_role: Optional[str] = Header(None)):
    enforce_permission("audit", x_user_role)
    return [entry.model_dump() for entry in audit_logger.get_all_logs()]


@app.get("/api/audit/verify")
def verify_audit_trail(x_user_role: Optional[str] = Header(None)):
    enforce_permission("audit", x_user_role)
    return audit_logger.verify_chain_integrity()


@app.get("/api/episodes")
def get_episodes_list():
    from ..simulator.episodes import list_episodes
    return list_episodes()


@app.post("/api/episodes/{episode_id}/load")
def load_operational_episode(episode_id: str, x_user_role: Optional[str] = Header(None)):
    enforce_permission("controlSimulation", x_user_role)
    from ..simulator.episodes import get_episode
    ep = get_episode(episode_id)
    
    # 1. Reset simulator to clean initial state
    sim_engine.reset()
    
    # 2. If episode specifies a disruption, inject it
    if ep.disruption_type and ep.disruption_type != "NONE":
        from ..simulator.railway.models import Disruption, DisruptionType
        dtype = DisruptionType.BLOCK_CLOSURE
        try:
            dtype = DisruptionType(ep.disruption_type)
        except Exception:
            pass

        dis = Disruption(
            id=f"DIS_{ep.episode_id}",
            disruption_type=dtype,
            target_id=ep.target_id,
            start_time_sec=sim_engine.state.sim_time_sec,
            duration_sec=ep.duration_sim_sec,
            description=ep.description
        )
        sim_engine.inject_disruption(dis)

    # 3. Advance to trigger time if non-zero
    if ep.trigger_time_sec > 0:
        sim_engine.fast_forward_to(ep.trigger_time_sec)

    return {
        "status": "LOADED",
        "episode_id": ep.episode_id,
        "title": ep.title,
        "sim_time_sec": sim_engine.state.sim_time_sec,
        "active_trains": len(sim_engine.state.trains)
    }


class AssistantQueryRequest(BaseModel):
    query: str
    messages: Optional[List[Dict[str, str]]] = None


@app.post("/api/assistant/query")
def assistant_query(req: AssistantQueryRequest):
    """
    Intelligent multi-tool operational reasoner and semantic intent router.
    Executes grounded operational tools over live simulation state with zero fabrication.
    """
    from ..ai.assistant.reasoning_engine import AssistantReasoningEngine

    res = AssistantReasoningEngine.execute_reasoning_pipeline(
        query=req.query,
        sim_engine=sim_engine,
        conflict_radar=conflict_radar,
        analytics=analytics,
        audit_logger=audit_logger,
        conversation_history=req.messages
    )
    return res


# --- Real-Time WebSocket Endpoint ---

@app.websocket("/ws/live")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial snapshot
        snapshot = sim_engine.get_snapshot()
        trains_list = list(sim_engine.state.trains.values())
        conflicts = conflict_radar.scan_conflicts(trains_list, sim_engine.state.sim_time_sec)
        kpis = analytics.compute_kpis(
            trains=trains_list,
            blocks=list(sim_engine.network.blocks.values()),
            sim_time_sec=sim_engine.state.sim_time_sec,
            predicted_conflicts_count=len(conflicts),
            total_block_transitions=sim_engine.total_block_transitions
        )
        snapshot["kpis"] = kpis.model_dump()
        snapshot["predicted_conflicts"] = [c.model_dump() for c in conflicts]
        await websocket.send_json({
            "type": "INITIAL_STATE",
            "data": snapshot
        })
        
        while True:
            # Keep receiving client heartbeats or messages and reply to PING with PONG
            msg = await websocket.receive_text()
            if msg == "PING" or '"type":"PING"' in msg or '"type": "PING"' in msg:
                await websocket.send_json({
                    "type": "PONG",
                    "data": {"sim_time_sec": sim_engine.state.sim_time_sec}
                })
    except (WebSocketDisconnect, RuntimeError, Exception):
        pass
    finally:
        ws_manager.disconnect(websocket)
