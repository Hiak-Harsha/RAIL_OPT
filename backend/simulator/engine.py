from __future__ import annotations
import json
import time
import math
from typing import Dict, List, Optional, Any, Callable
from .railway.models import (
    Train, TrackBlock, Station, Platform, Signal,
    TrainStatus, SignalAspect, BlockType, BlockDirection,
    Disruption, DisruptionType, Recommendation, DecisionAction,
    ControllerActionType, AuditLogEntry, PredictedConflict
)
from .railway.graph import RailwayNetworkGraph
from ..optimizer.constraints.safety_validator import SafetyValidator
from ..optimizer.solvers.cpsat_solver import CPSATScheduler
from ..optimizer.baselines.priority import PriorityDispatcher


class SimulationState:
    def __init__(
        self,
        network: RailwayNetworkGraph,
        trains: List[Train],
        sim_time_sec: float = 0.0,
        time_scale: float = 1.0
    ):
        self.network = network
        self.trains: Dict[str, Train] = {t.train_id: t for t in trains}
        self.sim_time_sec = sim_time_sec
        self.time_scale = time_scale
        self.is_running = False
        self.disruptions: Dict[str, Disruption] = {}
        self.active_recommendations: Dict[str, Recommendation] = {}
        self.predicted_conflicts: List[PredictedConflict] = []
        self.audit_log: List[AuditLogEntry] = []
        self.events: List[Dict[str, Any]] = []

    def clone(self) -> SimulationState:
        """Create a deep copy for What-If sandbox simulations with isolated network and trains"""
        cloned_trains = [Train(**t.model_dump()) for t in self.trains.values()]
        cloned_state = SimulationState(
            network=self.network.deep_copy(),
            trains=cloned_trains,
            sim_time_sec=self.sim_time_sec,
            time_scale=self.time_scale
        )
        cloned_state.disruptions = {k: Disruption(**d.model_dump()) for k, d in self.disruptions.items()}
        return cloned_state


class RailwaySimulationEngine:
    """
    High-fidelity discrete-event railway physics and traffic simulation engine.
    Maintains digital twin state, physical block interlocking, signal aspects, and real-time event generation.
    Enforces strict physical safety: trains halt before occupied or conflicting track blocks and maintain 180s headway.
    """

    def __init__(self, config_json_path: str):
        self.config_json_path = config_json_path
        self.event_callbacks: List[Callable[[Dict[str, Any]], None]] = []
        self.block_clearance_times: Dict[str, float] = {}
        self.points_moving_until_sec: Dict[str, float] = {}
        self.total_block_transitions: int = 0
        self.sequence: int = 0
        self.topology_revision: str = "2026.08.v2"
        if config_json_path:
            self.reset()

    @classmethod
    def from_state(cls, state: SimulationState, config_path: str = "") -> RailwaySimulationEngine:
        """Create an active simulation engine from an existing or cloned SimulationState"""
        engine = cls(config_json_path="")
        engine.config_json_path = config_path
        engine.network = state.network
        engine.state = state
        engine.validator = SafetyValidator(state.network)
        engine.optimizer = CPSATScheduler(state.network)
        engine.priority_baseline = PriorityDispatcher(state.network)
        return engine

    def clone(self) -> RailwaySimulationEngine:
        """Create an isolated, runnable simulation clone with identical physics and network topology"""
        cloned_state = self.state.clone()
        cloned_engine = RailwaySimulationEngine.from_state(cloned_state, self.config_json_path)
        cloned_engine.block_clearance_times = dict(self.block_clearance_times)
        cloned_engine.points_moving_until_sec = dict(self.points_moving_until_sec)
        return cloned_engine

    def reset(self):
        """Reset simulation state back to initial timetable and cleared network while strictly preserving event listeners"""
        with open(self.config_json_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.network = RailwayNetworkGraph()
        
        # Load Stations and Platforms
        for stn_data in data["network"]["stations"]:
            stn = Station(**stn_data)
            self.network.add_station(stn)

        # Load Track Blocks and populate signals
        for blk_data in data["network"]["blocks"]:
            blk = TrackBlock(**blk_data)
            if not blk.signals:
                sig_id = f"SIG_{blk.id}"
                sig = Signal(id=sig_id, name=f"{blk.name} Signal", block_id=blk.id, position_km=0.0, aspect=SignalAspect.GREEN)
                self.network.add_signal(sig)
                blk.signals.append(sig.id)
            self.network.add_block(blk)

        # Load Trains with explicit rolling stock classification
        initial_trains = []
        for t in data["trains"]:
            t_dict = dict(t)
            if "rolling_stock_type" not in t_dict:
                name_num = f"{t_dict.get('train_name', '')} {t_dict.get('train_number', '')}".lower()
                if "vande" in name_num or "22436" in name_num:
                    t_dict["rolling_stock_type"] = "VANDE_BHARAT"
                    t_dict["coach_count"] = t_dict.get("coach_count", 16)
                    t_dict["rake_length_meters"] = t_dict.get("rake_length_meters", 400.0)
                elif "freight" in name_num or "goods" in name_num or "cont" in name_num or "04403" in name_num or "wag" in name_num:
                    t_dict["rolling_stock_type"] = "WAG9_FREIGHT"
                    t_dict["coach_count"] = t_dict.get("coach_count", 36)
                    t_dict["rake_length_meters"] = t_dict.get("rake_length_meters", 550.0)
                elif "memu" in name_num or "emu" in name_num or "local" in name_num or "6440" in name_num:
                    t_dict["rolling_stock_type"] = "MEMU"
                    t_dict["coach_count"] = t_dict.get("coach_count", 12)
                    t_dict["rake_length_meters"] = t_dict.get("rake_length_meters", 260.0)
                else:
                    t_dict["rolling_stock_type"] = "WAP7_LHB"
                    t_dict["coach_count"] = t_dict.get("coach_count", 22)
                    t_dict["rake_length_meters"] = t_dict.get("rake_length_meters", 500.0)
            initial_trains.append(Train(**t_dict))
        
        self.state = SimulationState(
            network=self.network,
            trains=initial_trains,
            sim_time_sec=0.0,
            time_scale=1.0
        )
        
        self.block_clearance_times.clear()
        self.points_moving_until_sec.clear()
        self.total_block_transitions = 0
        self.validator = SafetyValidator(self.network)
        self.optimizer = CPSATScheduler(self.network)
        self.priority_baseline = PriorityDispatcher(self.network)
        self.emit_event("SIM_RESET", {"sim_time_sec": 0.0})

    def register_event_listener(self, callback: Callable[[Dict[str, Any]], None]):
        self.event_callbacks.append(callback)

    def emit_event(self, event_type: str, payload: Dict[str, Any]):
        event = {
            "event_type": event_type,
            "sim_time_sec": round(self.state.sim_time_sec, 1),
            "timestamp_unix": time.time(),
            "payload": payload
        }
        self.state.events.append(event)
        for cb in self.event_callbacks:
            try:
                cb(event)
            except Exception:
                pass

    def inject_disruption(self, disruption: Disruption) -> Dict[str, Any]:
        """Inject real-time operational disruption on train, track block, platform, or signal"""
        self.state.disruptions[disruption.id] = disruption
        
        if disruption.disruption_type == DisruptionType.TRAIN_DELAY:
            if disruption.target_id in self.state.trains:
                train = self.state.trains[disruption.target_id]
                train.total_delay_sec += disruption.duration_sec
                train.status = TrainStatus.DELAYED
        elif disruption.disruption_type == DisruptionType.TRAIN_BREAKDOWN:
            if disruption.target_id in self.state.trains:
                train = self.state.trains[disruption.target_id]
                train.current_speed_kmh = 0.0
                train.status = TrainStatus.DISRUPTED
        elif disruption.disruption_type == DisruptionType.BLOCK_CLOSURE:
            block = self.network.get_block(disruption.target_id)
            if block:
                block.is_blocked = True
        elif disruption.disruption_type == DisruptionType.SPEED_RESTRICTION:
            block = self.network.get_block(disruption.target_id)
            if block:
                block.current_speed_limit_kmh = 30.0
        elif disruption.disruption_type == DisruptionType.WEATHER_RESTRICTION:
            block = self.network.get_block(disruption.target_id)
            if block:
                block.current_speed_limit_kmh = min(block.current_speed_limit_kmh, 45.0)  # Dense fog / visibility cap
        elif disruption.disruption_type == DisruptionType.SIGNAL_FAILURE:
            sig = self.network.signals.get(disruption.target_id)
            if sig:
                sig.aspect = SignalAspect.RED
        elif disruption.disruption_type == DisruptionType.PLATFORM_UNAVAILABLE:
            block = self.network.get_block(disruption.target_id)
            if block:
                block.is_blocked = True

        self.emit_event("DISRUPTION_CREATED", disruption.model_dump())
        return {"status": "SUCCESS", "disruption": disruption.model_dump()}

    def apply_controller_action(
        self,
        action_type: str,
        train_id: str,
        hold_duration_sec: float = 300.0,
        target_block_id: Optional[str] = None
    ) -> Dict[str, Any]:
        train = self.state.trains.get(train_id)
        if not train:
            return {"status": "FAILED", "reason": f"Train {train_id} not found"}

        if action_type in ("HOLD", "HOLD_TRAIN"):
            train.current_speed_kmh = 0.0
            train.current_accel_ms2 = 0.0
            train.status = TrainStatus.WAITING
            train.held_at_block_id = target_block_id or train.current_block_id
            train.hold_duration_remaining_sec = hold_duration_sec
            train.total_delay_sec += hold_duration_sec

        elif action_type == "LOOP_PRECEDENCE":
            # 1. Strictly validate loop block connectivity at current or target station
            curr_blk = self.network.get_block(train.current_block_id) if train.current_block_id else None
            
            loop_block = None
            if target_block_id and target_block_id in self.network.blocks:
                cand_blk = self.network.blocks[target_block_id]
                if cand_blk.block_type in (BlockType.LOOP_LINE, "LOOP_LINE", "STATION_LOOP"):
                    if not cand_blk.is_occupied or cand_blk.occupied_by_train_id == train.train_id:
                        loop_block = cand_blk

            if not loop_block:
                # Find available loop block at adjacent or nearest station along the corridor
                candidate_stations = []
                if curr_blk:
                    for node_id in [curr_blk.from_node, curr_blk.to_node]:
                        if node_id in self.network.stations:
                            candidate_stations.append(self.network.stations[node_id])
                
                if not candidate_stations:
                    # Sort stations by distance to train's position
                    train_km = train.current_position_km or 0.0
                    candidate_stations = sorted(
                        self.network.stations.values(),
                        key=lambda s: abs(s.position_km - train_km)
                    )

                for stn in candidate_stations:
                    for l_id in stn.loop_blocks:
                        if l_id in self.network.blocks:
                            cand = self.network.blocks[l_id]
                            if not cand.is_occupied and not cand.is_blocked:
                                loop_block = cand
                                break
                    if loop_block:
                        break

            if not loop_block:
                return {
                    "status": "FAILED",
                    "reason": f"No valid, clear loop line available adjacent to train {train_id} location"
                }

            loop_id = loop_block.id
            
            # 2. Release mainline block reservation for preceding/opposing express train
            blocks_to_release = {train.current_block_id, target_block_id} - {None, loop_id}
            for b_id in blocks_to_release:
                old_blk = self.network.get_block(b_id)
                if old_blk and old_blk.occupied_by_train_id == train.train_id:
                    old_blk.is_occupied = False
                    old_blk.occupied_by_train_id = None
                    self.block_clearance_times[old_blk.id] = self.state.sim_time_sec

            # 3. Interlocking transition into loop line & hold
            train.current_block_id = loop_id
            train.held_at_block_id = loop_id
            train.current_speed_kmh = 0.0
            train.current_accel_ms2 = 0.0
            train.status = TrainStatus.WAITING
            train.hold_duration_remaining_sec = hold_duration_sec
            train.total_delay_sec += hold_duration_sec

            loop_block.is_occupied = True
            loop_block.occupied_by_train_id = train.train_id

            if loop_id not in train.route_block_ids:
                train.route_block_ids.insert(max(0, train.route_index), loop_id)

        elif action_type == "CHANGE_PRECEDENCE":
            # Demote yielding train priority & hold until higher priority train clears
            train.priority = max(1, (train.priority or 3) - 1)
            train.current_speed_kmh = 0.0
            train.current_accel_ms2 = 0.0
            train.status = TrainStatus.WAITING
            train.held_at_block_id = target_block_id or train.current_block_id
            train.hold_duration_remaining_sec = hold_duration_sec
            train.total_delay_sec += hold_duration_sec

        elif action_type == "ALLOW_CROSSING":
            train.held_at_block_id = None
            train.hold_duration_remaining_sec = 0.0
            train.status = TrainStatus.RUNNING

        elif action_type == "REASSIGN_PLATFORM" and target_block_id:
            if train.stops and train.route_index < len(train.stops):
                old_platform_id = train.stops[train.route_index].assigned_platform_id
                train.stops[train.route_index].assigned_platform_id = target_block_id
                # Update platform lock state in interlocking
                if old_platform_id in self.network.platforms:
                    self.network.platforms[old_platform_id].is_occupied = False
                if target_block_id in self.network.platforms:
                    self.network.platforms[target_block_id].is_occupied = True

        elif action_type == "REROUTE" and target_block_id:
            if train.route_block_ids and target_block_id in self.network.blocks:
                # Graph-validate that target_block_id connects cleanly
                train.route_block_ids.insert(min(len(train.route_block_ids), train.route_index + 1), target_block_id)

        elif action_type == "RELEASE":
            train.held_at_block_id = None
            train.hold_duration_remaining_sec = 0.0
            train.status = TrainStatus.RUNNING

        self.emit_event("CONTROLLER_ACTION_APPLIED", {
            "action_type": action_type,
            "train_id": train_id,
            "hold_duration_sec": hold_duration_sec,
            "target_block_id": target_block_id
        })
        return {"status": "SUCCESS", "train_id": train_id, "action_type": action_type}

    def apply_candidate_actions(self, actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Apply an evaluated candidate exactly as it was simulated.

        This is deliberately the single adapter between candidate schedules and
        the live interlocking.  Keeping it here prevents the UI from turning a
        labelled future into a different, generic controller action.
        """
        applied: List[Dict[str, Any]] = []
        for action in actions:
            raw_act = action.get("action_type", "HOLD")
            action_type = raw_act.value if hasattr(raw_act, "value") else str(raw_act)
            train_id = action.get("train_id")
            if not train_id:
                return {"status": "FAILED", "reason": "Candidate action has no train_id", "applied": applied}
            if train_id not in self.state.trains:
                return {"status": "FAILED", "reason": f"Candidate train {train_id} not found", "applied": applied}
            # Candidate vocabulary is intentionally mapped only at this boundary.
            if action_type == "SPEED_RESTRICT":
                block_id = action.get("target_block_id") or self.state.trains[train_id].current_block_id
                block = self.network.get_block(block_id) if block_id else None
                speed = action.get("restricted_speed_kmh")
                if not block or speed is None or float(speed) <= 0:
                    return {"status": "FAILED", "reason": "Speed restriction needs a valid block and positive speed", "applied": applied}
                block.current_speed_limit_kmh = min(block.current_speed_limit_kmh, float(speed))
                applied.append({**action, "controller_action": "SPEED_RESTRICT"})
                continue
            controller_action = {
                "HOLD": "HOLD",
                "LOOP_PRECEDENCE": "LOOP_PRECEDENCE",
                "PLATFORM_REASSIGN": "REASSIGN_PLATFORM",
                "PROCEED_NORMAL": "ALLOW_CROSSING",
            }.get(action_type)
            if controller_action is None:
                return {"status": "FAILED", "reason": f"Unsupported candidate action {action_type}", "applied": applied}
            result = self.apply_controller_action(
                action_type=controller_action,
                train_id=train_id,
                hold_duration_sec=float(action.get("duration_sec") or 0.0),
                target_block_id=action.get("target_platform_id") or action.get("target_block_id"),
            )
            if result.get("status") != "SUCCESS":
                return {"status": "FAILED", "reason": result.get("reason", "Action failed"), "applied": applied}
            applied.append({**action, "controller_action": controller_action})
        self.emit_event("CANDIDATE_PLAN_APPLIED", {"actions": applied})
        return {"status": "SUCCESS", "applied": applied}

    def preview_candidate_actions(
        self, actions: List[Dict[str, Any]], horizon_sec: float = 300.0, sample_every_sec: float = 30.0
    ) -> Dict[str, Any]:
        """Run the same physics/interlocking engine in an isolated branch for UI preview."""
        branch = self.clone()
        result = branch.apply_candidate_actions(actions)
        if result.get("status") != "SUCCESS":
            return result
        frames: List[Dict[str, Any]] = []
        elapsed = 0.0
        while elapsed <= horizon_sec:
            frames.append({
                "offset_sec": round(elapsed, 1),
                "trains": [{
                    "train_id": t.train_id, "block_id": t.current_block_id,
                    "position_km": round(t.current_position_km, 3), "speed_kmh": round(t.current_speed_kmh, 1),
                    "status": t.status.value if hasattr(t.status, "value") else str(t.status),
                } for t in branch.state.trains.values()]
            })
            branch.tick(min(sample_every_sec, horizon_sec - elapsed) if elapsed < horizon_sec else 0.0)
            elapsed += sample_every_sec
        return {"status": "SUCCESS", "horizon_sec": horizon_sec, "frames": frames, "applied_actions": result["applied"]}

    def tick(self, delta_sec: float = 1.0):
        """Advance discrete simulation by delta_sec * time_scale"""
        effective_delta = delta_sec * self.state.time_scale
        self.state.sim_time_sec += effective_delta
        self.sequence += 1

        # 1. Update signals based on block occupancies and route interlocking
        self._update_signals()

        # 2. Advance train physics with strict interlocking checks
        for train in self.state.trains.values():
            self._update_train(train, effective_delta)

        # 3. Check for predicted conflicts and bottleneck queues
        self._check_conflicts()

    def fast_forward_to(self, target_sim_time_sec: float, dt: float = 0.5):
        """Deterministically advance simulation physics tick-by-tick to target simulation time"""
        if target_sim_time_sec <= self.state.sim_time_sec:
            return
        
        while self.state.sim_time_sec < target_sim_time_sec:
            step = min(dt, target_sim_time_sec - self.state.sim_time_sec)
            self.tick(delta_sec=step)

    def jump_to_demo_window(self, window_sec: float = 600.0):
        """Fast-forward simulation state directly to an active operational corridor window where multiple trains are running"""
        self.fast_forward_to(window_sec)
        self.emit_event("SIM_JUMP_DEMO", {
            "message": f"Simulation jumped to active operational window at T+{round(self.state.sim_time_sec)}s",
            "active_trains": len([t for t in self.state.trains.values() if t.status in (TrainStatus.RUNNING, TrainStatus.DELAYED, TrainStatus.WAITING)])
        })

    def jump_to_next_conflict(self) -> Optional[float]:
        """Advance simulation until the next crossing conflict is actively predicted or triggered"""
        return self.jump_to_next_event("CONFLICT_PREDICTED")

    def jump_to_next_event(self, event_type: str = "ANY") -> Optional[float]:
        """
        Advance simulation until the specified event condition occurs:
        - SIGNAL_CHANGED: any signal aspect changes
        - DEPARTURE: a train departs from scheduled origin
        - CONFLICT_PREDICTED: a conflict is predicted by the radar
        - RECOMMENDATION: an active AI recommendation is ready
        """
        initial_signals = {s_id: s.aspect for s_id, s in self.network.signals.items()}
        initial_departed = {t_id: (t.status == TrainStatus.RUNNING) for t_id, t in self.state.trains.items()}
        max_advance = self.state.sim_time_sec + 1800.0

        while self.state.sim_time_sec < max_advance:
            self.tick(delta_sec=1.0)
            
            if event_type == "SIGNAL_CHANGED":
                for s_id, s in self.network.signals.items():
                    if initial_signals.get(s_id) != s.aspect:
                        self.emit_event("SIM_JUMP_EVENT", {
                            "event_type": "SIGNAL_CHANGED",
                            "message": f"Jumped to signal change on {s_id} ({s.aspect}) at T+{round(self.state.sim_time_sec)}s"
                        })
                        return self.state.sim_time_sec

            elif event_type == "DEPARTURE":
                for t_id, t in self.state.trains.items():
                    if not initial_departed.get(t_id, False) and t.status == TrainStatus.RUNNING:
                        self.emit_event("SIM_JUMP_EVENT", {
                            "event_type": "DEPARTURE",
                            "message": f"Jumped to departure of {t_id} ({t.train_name}) at T+{round(self.state.sim_time_sec)}s"
                        })
                        return self.state.sim_time_sec

            elif event_type in ("CONFLICT_PREDICTED", "CONFLICT"):
                if self.state.predicted_conflicts:
                    self.emit_event("SIM_JUMP_EVENT", {
                        "event_type": "CONFLICT_PREDICTED",
                        "message": f"Jumped to predicted conflict {self.state.predicted_conflicts[0].conflict_id} at T+{round(self.state.sim_time_sec)}s"
                    })
                    return self.state.sim_time_sec

            elif event_type == "RECOMMENDATION":
                if self.state.active_recommendations or self.state.predicted_conflicts:
                    self.emit_event("SIM_JUMP_EVENT", {
                        "event_type": "RECOMMENDATION",
                        "message": f"Jumped to AI recommendation window at T+{round(self.state.sim_time_sec)}s"
                    })
                    return self.state.sim_time_sec

        return self.state.sim_time_sec

    def _is_block_clear_for_train(self, block_id: str, train_id: str) -> bool:
        """Check if block and all its conflicting graph links are completely free and min headway has elapsed"""
        block = self.network.get_block(block_id)
        if not block or block.is_blocked:
            return False

        # CRITICAL SAFETY INVARIANT: Block cannot be occupied by another train
        if block.is_occupied and block.occupied_by_train_id != train_id:
            return False

        # Signal safety: RED signal protecting this block prevents entry
        for sig_id in block.signals:
            sig = self.network.signals.get(sig_id)
            if sig and sig.aspect == SignalAspect.RED:
                return False

        # Headway safety invariant: verify 180s block separation
        last_cleared = self.block_clearance_times.get(block_id, -9999.0)
        if (self.state.sim_time_sec - last_cleared) < 180.0:
            return False

        conflicting_blocks = self.network.get_conflicting_blocks(block_id)
        for cb_id in conflicting_blocks:
            cb = self.network.get_block(cb_id)
            if cb and cb.is_occupied and cb.occupied_by_train_id != train_id:
                return False
            cb_last_cleared = self.block_clearance_times.get(cb_id, -9999.0)
            if (self.state.sim_time_sec - cb_last_cleared) < 180.0:
                return False
        return True

    def _update_signals(self):
        for block_id, block in self.network.blocks.items():
            conflicting_blocks = self.network.get_conflicting_blocks(block_id)
            is_self_occupied = block.is_occupied or block.is_blocked
            is_conflict_occupied = any(
                self.network.blocks[cb].is_occupied for cb in conflicting_blocks if cb in self.network.blocks
            )

            # Determine downstream aspect progression (Green -> Double Yellow -> Yellow -> Red)
            for sig_id in block.signals:
                sig = self.network.signals.get(sig_id)
                if not sig:
                    continue

                if is_self_occupied or is_conflict_occupied:
                    sig.aspect = SignalAspect.RED
                else:
                    # Look ahead at adjacent connected downstream blocks
                    next_blocks = self.network.get_next_blocks(block_id, block.direction)
                    if not next_blocks:
                        sig.aspect = SignalAspect.GREEN
                        continue

                    # Check 1st block ahead
                    first_ahead_occupied = any(
                        nb.is_occupied or nb.is_blocked for nb in next_blocks
                    )
                    if first_ahead_occupied:
                        sig.aspect = SignalAspect.YELLOW
                    else:
                        # Check 2nd block ahead
                        second_ahead_occupied = False
                        for nb in next_blocks:
                            second_blocks = self.network.get_next_blocks(nb.id, nb.direction)
                            if any(snb.is_occupied or snb.is_blocked for snb in second_blocks):
                                second_ahead_occupied = True
                                break
                        if second_ahead_occupied:
                            sig.aspect = SignalAspect.DOUBLE_YELLOW
                        else:
                            sig.aspect = SignalAspect.GREEN

    def _update_train(self, train: Train, dt: float):
        if train.status in (TrainStatus.CANCELLED, TrainStatus.ARRIVED):
            return

        # 1. Initial Station Departure
        if train.status in (TrainStatus.SCHEDULED, TrainStatus.READY_TO_DEPART):
            scheduled_dep_time = (
                train.stops[0].scheduled_departure if train.stops else 0.0
            ) + train.total_delay_sec

            if self.state.sim_time_sec >= scheduled_dep_time:
                # Departure time has passed — mark as READY_TO_DEPART if not already
                if train.status == TrainStatus.SCHEDULED:
                    train.status = TrainStatus.READY_TO_DEPART
                    self.emit_event("TRAIN_READY_TO_DEPART", {
                        "train_id": train.train_id,
                        "train_name": train.train_name,
                    })

                if train.route_block_ids:
                    first_block_id = train.route_block_ids[0]
                    if self._is_block_clear_for_train(first_block_id, train.train_id):
                        train.status = TrainStatus.RUNNING
                        train.current_block_id = first_block_id
                        first_block = self.network.get_block(first_block_id)
                        if first_block:
                            first_block.is_occupied = True
                            first_block.occupied_by_train_id = train.train_id

                        # Immediate initial acceleration on departure tick
                        accel_kmh = (train.acceleration_ms2 or 0.5) * 3.6 * dt
                        train.current_speed_kmh = min(first_block.current_speed_limit_kmh, accel_kmh)
                        train.current_position_km = (train.current_speed_kmh / 3600.0) * dt

                        self.emit_event("TRAIN_ENTERED_BLOCK", {
                            "train_id": train.train_id,
                            "block_id": first_block_id,
                        })
                    else:
                        # Waiting at origin for track clearance — accumulate delay
                        train.total_delay_sec += dt
            return

        # 2. Active Controller / Dispatcher Hold
        if train.hold_duration_remaining_sec > 0:
            train.hold_duration_remaining_sec = max(0.0, train.hold_duration_remaining_sec - dt)
            decel_kmh = (train.deceleration_ms2 or 0.7) * 3.6 * dt
            train.current_speed_kmh = max(0.0, train.current_speed_kmh - decel_kmh)
            train.status = TrainStatus.WAITING
            train.total_delay_sec += dt
            return

        # 3. Intermediate Station Dwell Lifecycle State Machine
        if train.is_dwelling:
            train.dwell_remaining_sec = max(0.0, train.dwell_remaining_sec - dt)
            decel_kmh = (train.deceleration_ms2 or 0.7) * 3.6 * dt
            train.current_speed_kmh = max(0.0, train.current_speed_kmh - decel_kmh)
            train.status = TrainStatus.WAITING

            # Find matching intermediate stop scheduled departure
            curr_stop = next((s for s in train.stops[1:] if s.assigned_platform_id == train.current_block_id or s.station_code in (train.current_block_id or "")), None)
            scheduled_dep = (curr_stop.scheduled_departure + train.total_delay_sec) if curr_stop else 0.0

            if train.dwell_remaining_sec <= 0.0 and self.state.sim_time_sec >= scheduled_dep:
                # Dwell complete: check forward track clearance
                next_index = train.route_index + 1
                next_block_id = train.route_block_ids[next_index] if next_index < len(train.route_block_ids) else None
                if not next_block_id or self._is_block_clear_for_train(next_block_id, train.train_id):
                    train.is_dwelling = False
                    train.status = TrainStatus.RUNNING
                    self.emit_event("TRAIN_DEPARTED_STATION", {
                        "train_id": train.train_id,
                        "block_id": train.current_block_id
                    })
                else:
                    train.total_delay_sec += dt
            else:
                train.total_delay_sec += dt
            return

        # 4. Running & Physical Traversal with 4-Aspect Signal Speed Response
        if train.status in (TrainStatus.RUNNING, TrainStatus.DELAYED, TrainStatus.WAITING):
            curr_block = self.network.get_block(train.current_block_id) if train.current_block_id else None
            if not curr_block:
                return

            next_index = train.route_index + 1
            has_next_block = next_index < len(train.route_block_ids)
            next_block_id = train.route_block_ids[next_index] if has_next_block else None
            is_next_clear = self._is_block_clear_for_train(next_block_id, train.train_id) if next_block_id else True

            # Calculate physical braking distance: d = v^2 / (2 * a) in km
            speed_ms = train.current_speed_kmh / 3.6
            decel_ms2 = train.deceleration_ms2 or 0.7
            braking_dist_km = (speed_ms ** 2) / (2.0 * decel_ms2 * 1000.0)
            dist_to_block_end = max(0.0, curr_block.length_km - train.current_position_km)

            # Signal Aspect speed limit determination
            signal_target_speed_kmh = curr_block.current_speed_limit_kmh
            if curr_block.signals:
                first_sig = self.network.signals.get(curr_block.signals[0])
                if first_sig:
                    if first_sig.aspect == SignalAspect.YELLOW:
                        signal_target_speed_kmh = min(signal_target_speed_kmh, 30.0)
                    elif first_sig.aspect == SignalAspect.DOUBLE_YELLOW:
                        signal_target_speed_kmh = min(signal_target_speed_kmh, 60.0)

            # Curve & Permanent Speed Restrictions (PSR) within the block
            for sr in getattr(curr_block, "speed_restrictions", []):
                if sr.start_km_in_block <= train.current_position_km <= sr.end_km_in_block:
                    signal_target_speed_kmh = min(signal_target_speed_kmh, sr.restricted_speed_kmh)

            block_limit_kmh = min(train.max_speed_kmh, signal_target_speed_kmh)
            target_speed_kmh = block_limit_kmh

            # If next block is not clear and train is within braking zone, smoothly decelerate
            if has_next_block and not is_next_clear and dist_to_block_end <= (braking_dist_km + 0.15):
                target_speed_kmh = max(0.0, math.sqrt(max(0.0, 2.0 * decel_ms2 * max(0.0, dist_to_block_end - 0.01) * 1000.0)) * 3.6)

            # Block Boundary Transition
            if train.current_position_km >= curr_block.length_km - 0.01:
                if has_next_block and next_block_id:
                    if not is_next_clear:
                        train.current_speed_kmh = 0.0
                        train.current_accel_ms2 = 0.0
                        train.status = TrainStatus.WAITING
                        train.total_delay_sec += dt
                        return

                    # Path is clear: perform safe transition
                    curr_block.is_occupied = False
                    curr_block.occupied_by_train_id = None
                    self.block_clearance_times[curr_block.id] = self.state.sim_time_sec
                    self.emit_event("TRAIN_LEFT_BLOCK", {
                        "train_id": train.train_id,
                        "block_id": curr_block.id
                    })

                    # Update platform physical occupancy on departure
                    for stn in self.network.stations.values():
                        for plat in stn.platforms:
                            if plat.id == curr_block.id or curr_block.id in stn.loop_blocks:
                                plat.is_occupied = False
                                plat.occupied_by = None

                    train.route_index = next_index
                    train.current_block_id = next_block_id
                    train.current_position_km = 0.0
                    train.status = TrainStatus.RUNNING
                    self.total_block_transitions += 1

                    next_block = self.network.get_block(next_block_id)
                    if next_block:
                        next_block.is_occupied = True
                        next_block.occupied_by_train_id = train.train_id

                    # Update platform physical occupancy on arrival
                    for stn in self.network.stations.values():
                        for plat in stn.platforms:
                            if plat.id == next_block_id or next_block_id in stn.loop_blocks:
                                plat.is_occupied = True
                                plat.occupied_by = train.train_id

                    # Check if entering an intermediate scheduled station platform stop
                    is_station_stop = any(
                        s.assigned_platform_id == next_block_id or s.station_code in next_block_id
                        for s in train.stops[1:-1]
                    )
                    if is_station_stop:
                        train.is_dwelling = True
                        train.dwell_remaining_sec = 120.0  # 2-minute standard operational station dwell

                    self.emit_event("TRAIN_ENTERED_BLOCK", {
                        "train_id": train.train_id,
                        "block_id": next_block_id
                    })
                    return
                else:
                    # Final destination reached
                    curr_block.is_occupied = False
                    curr_block.occupied_by_train_id = None
                    self.block_clearance_times[curr_block.id] = self.state.sim_time_sec
                    train.status = TrainStatus.ARRIVED
                    train.current_block_id = None
                    train.current_speed_kmh = 0.0
                    train.current_accel_ms2 = 0.0
                    self.emit_event("TRAIN_ARRIVED", {
                        "train_id": train.train_id,
                        "destination": train.destination
                    })
                    return

            # Realistic S-Curve Jerk-Limited Acceleration & Gradient Resistance
            GRAVITY = 9.81
            gradient_pct = getattr(curr_block, "gradient_percent", 0.0) or 0.0
            effective_grad = gradient_pct if train.direction == BlockDirection.UP else -gradient_pct
            grad_resistance_accel = (GRAVITY * (effective_grad / 100.0)) * (getattr(train, "gradient_sensitivity", 1.0) or 1.0)

            if train.current_speed_kmh < target_speed_kmh:
                base_accel = max(0.02, (train.acceleration_ms2 or 0.5) - grad_resistance_accel)
                target_accel = base_accel
            elif train.current_speed_kmh > target_speed_kmh:
                base_decel = max(0.05, (train.deceleration_ms2 or 0.7) + grad_resistance_accel)
                target_accel = -base_decel
            else:
                target_accel = 0.0

            jerk_limit = getattr(train, "jerk_limit_ms3", 0.15) or 0.15
            jerk_step = jerk_limit * dt
            diff_accel = target_accel - train.current_accel_ms2
            train.current_accel_ms2 += max(-jerk_step, min(jerk_step, diff_accel))

            # Integrate speed from acceleration
            dv_kmh = train.current_accel_ms2 * 3.6 * dt
            if train.current_accel_ms2 >= 0:
                train.current_speed_kmh = min(target_speed_kmh, max(0.0, train.current_speed_kmh + dv_kmh))
            else:
                train.current_speed_kmh = max(target_speed_kmh, max(0.0, train.current_speed_kmh + dv_kmh))
            
            dist_km = (train.current_speed_kmh / 3600.0) * dt
            train.current_position_km = min(curr_block.length_km, train.current_position_km + dist_km)
            train.status = TrainStatus.DELAYED if train.total_delay_sec > 60 else TrainStatus.RUNNING

    def _check_conflicts(self):
        """Active runtime bottleneck and opposing single-line detection"""
        conflicts = []
        active_trains = [t for t in self.state.trains.values() if t.status in (TrainStatus.RUNNING, TrainStatus.DELAYED, TrainStatus.WAITING)]

        for i in range(len(active_trains)):
            t1 = active_trains[i]
            for j in range(i + 1, len(active_trains)):
                t2 = active_trains[j]
                
                # Check for single-line bottleneck convergence
                t1_future_blocks = set(t1.route_block_ids[t1.route_index:t1.route_index + 3])
                t2_future_blocks = set(t2.route_block_ids[t2.route_index:t2.route_index + 3])
                overlap = t1_future_blocks.intersection(t2_future_blocks)

                for blk_id in overlap:
                    blk = self.network.get_block(blk_id)
                    if blk and blk.block_type in (BlockType.SINGLE_LINE_SECTION, BlockType.JUNCTION_CROSSOVER) and t1.direction != t2.direction:
                        conflicts.append(PredictedConflict(
                            conflict_id=f"CONF_RUNTIME_{t1.train_id}_{t2.train_id}_{blk_id}",
                            conflict_type="SINGLE_LINE_CROSSING",
                            location_block_id=blk_id,
                            train_ids=[t1.train_id, t2.train_id],
                            estimated_time_to_conflict_sec=max(60.0, 900.0 - (t1.total_delay_sec + t2.total_delay_sec)),
                            severity="HIGH",
                            recommended_action_type="HOLD_TRAIN",
                            description=f"Opposing convergence detected on single line {blk.name} between {t1.train_name} and {t2.train_name}"
                        ))
        self.state.predicted_conflicts = conflicts
        return conflicts

    def get_snapshot(self) -> Dict[str, Any]:
        def train_snapshot(train: Train) -> Dict[str, Any]:
            """Add absolute corridor chainage while retaining block-relative physics state."""
            data = train.model_dump()
            block = self.network.get_block(train.current_block_id) if train.current_block_id else None
            if block:
                start = self.network.get_station(block.from_node)
                end = self.network.get_station(block.to_node)
                if start and end:
                    progress = min(1.0, max(0.0, train.current_position_km / max(0.001, block.length_km)))
                    data["corridor_position_km"] = round(start.position_km + (end.position_km - start.position_km) * progress, 3)
            return data
        return {
            "sequence": getattr(self, "sequence", 0),
            "topology_revision": getattr(self, "topology_revision", "2026.08.v2"),
            "sim_time_sec": round(self.state.sim_time_sec, 1),
            "sim_time_formatted": time.strftime("%H:%M:%S", time.gmtime(self.state.sim_time_sec)),
            "time_scale": self.state.time_scale,
            "is_running": self.state.is_running,
            "trains": [train_snapshot(t) for t in self.state.trains.values()],
            # Aspect is sent with its protected block so every visual surface
            # reads the actual interlocking state instead of inventing colour.
            "blocks": [{
                **b.model_dump(),
                "signal_aspect": next((
                    (self.network.signals[sid].aspect.value if hasattr(self.network.signals[sid].aspect, "value") else str(self.network.signals[sid].aspect))
                    for sid in b.signals if sid in self.network.signals
                ), "GREEN")
            } for b in self.network.blocks.values()],
            "signals": [s.model_dump() for s in self.network.signals.values()],
            "platforms": [p.model_dump() for p in self.network.platforms.values()],
            "disruptions": [d.model_dump() for d in self.state.disruptions.values()],
            "active_recommendations": [r.model_dump() for r in self.state.active_recommendations.values()],
            "predicted_conflicts": [c.model_dump() for c in self.state.predicted_conflicts],
            "recent_events": self.state.events[-15:]
        }
