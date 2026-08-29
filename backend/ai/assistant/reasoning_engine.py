"""
RAILOPT-X AI Copilot Reasoning & Multi-Tool Dispatch Engine
Provides semantic natural-language intent recognition, multi-tool composition,
and zero-fabrication operational grounding over live railway simulation state.
"""

from typing import Dict, List, Any, Optional, Tuple, Set
import re
from pydantic import BaseModel


class AssistantTurn(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AssistantReasoningEngine:
    """
    Intelligent tool-using operational reasoner.
    Routes queries to structured operational tools, composes multi-tool responses
    for compound questions, and grounds all output in live simulation telemetry.
    """

    # Semantic Intent Trigger Vocabulary (Regex / Keyword Patterns)
    INTENT_PATTERNS = {
        "PRECEDENCE_PRIORITY": [
            r"\b(which|who)\b.*\b(first|priority|precedence|pass|let through|clear)\b",
            r"\b(priority|precedence|dispatch order|dispatch priority|preference)\b",
            r"\bwho should go first\b",
            r"\bwhich train (should|to) (go|move|proceed|pass|clear)\b"
        ],
        "HOLD_WAIT": [
            r"\b(hold|held|holding|wait|waiting|stopped|detained|halted|stationary)\b",
            r"\bwhy is .* (held|waiting|stopped|halted)\b",
            r"\bwhich train(s)? (is|are) (held|waiting|stopped)\b",
            r"\bwhy (stop|wait|hold)\b"
        ],
        "CONFLICT_RADAR": [
            r"\b(conflict|conflicts|collision|collisions|contention|overlap|overlaps|crossing|crossings|deadlock|deadlocks|bottleneck|opposing|near miss)\b",
            r"\b(headway|separation|spacing|margin)\b",
            r"\bis there (a|any) (conflict|risk|problem|contention|deadlock)\b",
            r"\bwhat (is|are) the (risk|conflict|risks|conflicts)\b",
            r"\bheadway (violation|compression|margin|violations)\b"
        ],
        "DELAY_PUNCTUALITY": [
            r"\b(delay|delayed|late|behind schedule|overtime|punctuality|otp|schedule deviation)\b",
            r"\bhow (late|delayed) (is|are)\b",
            r"\bwhich train(s)? (is|are) (late|delayed)\b"
        ],
        "DECISION_REVIEW": [
            r"\b(recommendation|decision|rationale|reasoning|solver|cpsat|cp-sat|plan|counterfactual|objective|score|why did (the )?optimizer)\b",
            r"\bexplain (the )?(decision|recommendation|plan|reasoning|action)\b",
            r"\bwhat (did|does) the (ai|solver|optimizer) (say|recommend|propose)\b"
        ],
        "SECTION_OVERVIEW": [
            r"\b(overview|summary|status|network status|traffic status|health|kpi|throughput|how is the corridor|corridor status)\b",
            r"\bwhat is happening\b",
            r"\bcurrent state\b"
        ]
    }

    @staticmethod
    def _extract_referenced_train_id(text: str, trains: List[Any]) -> Optional[str]:
        """Find if a specific train ID or number is referenced in text."""
        text_upper = text.upper()
        # Direct train_id match (e.g. T22436, 22436, 12419, 04403)
        for t in trains:
            if t.train_id.upper() in text_upper or t.train_number in text_upper:
                return t.train_id
            if t.train_name.upper() in text_upper:
                return t.train_id
        # Regex search for standard Indian Railways 5-digit number or T-prefixed ID
        match = re.search(r"\b(T\d{4,5}|\d{5})\b", text_upper)
        if match:
            cand = match.group(1)
            for t in trains:
                if t.train_id == cand or t.train_number == cand or f"T{t.train_number}" == cand:
                    return t.train_id
        return None

    @classmethod
    def classify_intents(cls, query: str, conversation_history: Optional[List[Dict[str, str]]] = None) -> Set[str]:
        """
        Multi-intent classification supporting arbitrary phrasing, question words,
        and compound requests.
        """
        q = query.lower()
        active_intents = set()

        for intent, patterns in cls.INTENT_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, q, re.IGNORECASE):
                    active_intents.add(intent)
                    break

        # Check conversational context for follow-up questions
        if not active_intents and conversation_history:
            recent_turns = [m.get("content", "").lower() for m in conversation_history[-3:] if m.get("role") == "user"]
            for prev_q in reversed(recent_turns):
                for intent, patterns in cls.INTENT_PATTERNS.items():
                    for pat in patterns:
                        if re.search(pat, prev_q, re.IGNORECASE):
                            active_intents.add(intent)
                            break
                if active_intents:
                    break

        # Default to overview if no specific intent recognized
        if not active_intents:
            active_intents.add("SECTION_OVERVIEW")

        return active_intents

    # --- Tool Implementations (Strictly Grounded, Zero Fabrication) ---

    @staticmethod
    def tool_decision_review(sim_engine: Any, audit_logger: Any) -> Dict[str, Any]:
        """Inspects active AI dispatch recommendation or recent audit ledger decisions."""
        recs = list(sim_engine.state.active_recommendations.values())
        if recs:
            rec = recs[0]
            action_str = rec.action.value if hasattr(rec.action, "value") else str(rec.action)
            raw_score = rec.optimization_objective_score
            eval_score = getattr(rec, "evaluated_objective_score", None)
            score_text = f"Evaluated J={eval_score:.1f}" if eval_score is not None else f"Raw Solver J={raw_score:.1f}"
            
            reasons_text = " ".join(rec.reasons_bullet_points[:2]) if rec.reasons_bullet_points else "Optimal loop precedence sequence."
            savings = rec.projected_metrics_diff.get("delay_saved_min", 0.0)
            
            return {
                "summary": (
                    f"AI Decision Review & Dispatch Plan ({rec.solver_name}): Proposes {action_str} on train {rec.primary_train_id} "
                    f"at block {rec.target_block_id} ({score_text}, Status: {rec.solver_status}). "
                    f"Safety Interlocking: {'PASSED (0 violations)' if rec.safety_valid else 'SAFETY OVERRIDE'}. "
                    f"Rationale: {reasons_text} Projected network delay savings: {savings:.1f} min."
                ),
                "data": rec.model_dump()
            }
        else:
            recent_audits = audit_logger.get_all_logs()
            if recent_audits:
                latest = recent_audits[-1]
                return {
                    "summary": (
                        f"No pending recommendation. Latest executed decision in audit ledger: {latest.action} on train {latest.train_id} "
                        f"(Controller: {latest.controller_action}, SHA-256: {latest.entry_hash[:12]}...). "
                        f"AI Reason: {latest.ai_reason}"
                    ),
                    "data": {"audit_entry": latest.model_dump()}
                }
            return {
                "summary": "No active recommendations or past controller decisions recorded yet. Operating under nominal timetable.",
                "data": None
            }

    @staticmethod
    def tool_hold_wait_status(sim_engine: Any, target_train_id: Optional[str] = None) -> Dict[str, Any]:
        """Inspects trains currently in WAITING status or recommended to be held."""
        trains = list(sim_engine.state.trains.values())
        if target_train_id:
            trains = [t for t in trains if t.train_id == target_train_id]

        recs = list(sim_engine.state.active_recommendations.values())
        rec_hold = [r for r in recs if "HOLD" in (r.action.value if hasattr(r.action, "value") else str(r.action))]

        waiting_trains = [t for t in trains if getattr(t.status, "value", str(t.status)) in ("WAITING", "STOPPED")]

        if rec_hold:
            r = rec_hold[0]
            reasons = " ".join(r.reasons_bullet_points) if r.reasons_bullet_points else "Precedence clearance."
            return {
                "summary": f"Train {r.primary_train_id} is recommended for a {r.duration_sec/60.0:.1f}-minute hold at {r.target_block_id}. Rationale: {reasons}",
                "data": [r.model_dump() for r in rec_hold]
            }

        if waiting_trains:
            details = []
            for t in waiting_trains:
                loc = t.held_at_block_id or t.current_block_id or "Station Loop"
                rem = f", {t.hold_duration_remaining_sec:.0f}s remaining" if t.hold_duration_remaining_sec > 0 else ""
                details.append(f"{t.train_name} ({t.train_id}) held at {loc}{rem}")
            return {
                "summary": f"{len(waiting_trains)} train(s) currently held: {'; '.join(details)}.",
                "data": [t.model_dump() for t in waiting_trains]
            }

        return {
            "summary": "No trains are currently held or waiting. All active services are operating unimpeded.",
            "data": []
        }

    @staticmethod
    def tool_delayed_trains(sim_engine: Any, target_train_id: Optional[str] = None) -> Dict[str, Any]:
        """Inspects delayed trains and schedule deviations."""
        trains = list(sim_engine.state.trains.values())
        if target_train_id:
            trains = [t for t in trains if t.train_id == target_train_id]

        delayed = [t for t in trains if t.total_delay_sec > 0]
        delayed.sort(key=lambda t: t.total_delay_sec, reverse=True)

        if delayed:
            details = [f"{t.train_name} ({t.train_id}, +{t.total_delay_sec/60.0:.1f}m delay)" for t in delayed]
            return {
                "summary": f"{len(delayed)} train(s) experiencing delay: {', '.join(details)}.",
                "data": [t.model_dump() for t in delayed]
            }

        return {
            "summary": "All trains are currently operating on schedule with zero recorded delay.",
            "data": []
        }

    @staticmethod
    def tool_conflict_radar(sim_engine: Any, conflict_radar: Any, target_train_id: Optional[str] = None) -> Dict[str, Any]:
        """Scans the 15-minute lookahead horizon for block contention and crossing conflicts."""
        trains = list(sim_engine.state.trains.values())
        conflicts = conflict_radar.scan_conflicts(trains, sim_engine.state.sim_time_sec)

        if target_train_id:
            conflicts = [c for c in conflicts if target_train_id in c.involved_train_ids]

        if conflicts:
            c = conflicts[0]
            train1 = c.involved_train_names[0] if len(c.involved_train_names) > 0 else "Train 1"
            train2 = c.involved_train_names[1] if len(c.involved_train_names) > 1 else "Train 2"
            ttc = c.time_to_conflict_sec / 60.0
            
            root_cause = getattr(c, "explanation", None)
            cause_text = f" Root cause: {root_cause.root_cause}" if root_cause and root_cause.root_cause else ""

            return {
                "summary": (
                    f"Conflict Radar alert: {c.conflict_nature} predicted between {train1} and {train2} "
                    f"at {c.location_block_name} in {ttc:.1f} minutes.{cause_text}"
                ),
                "data": [conf.model_dump() for conf in conflicts]
            }

        return {
            "summary": "Zero upcoming conflicts detected in the 15-minute lookahead horizon. Headways and block safety invariants verified.",
            "data": []
        }

    @staticmethod
    def tool_precedence_priority(sim_engine: Any) -> Dict[str, Any]:
        """Determines dispatch precedence and priority ordering based on train class and timetable."""
        trains = list(sim_engine.state.trains.values())
        # Sort by PriorityClass (Higher value = higher priority), then by schedule
        trains_by_priority = sorted(
            trains,
            key=lambda t: (
                t.priority.value if hasattr(t.priority, "value") else int(t.priority),
                -t.total_delay_sec
            ),
            reverse=True
        )

        if not trains_by_priority:
            return {
                "summary": "No active train movements to prioritize in the corridor.",
                "data": []
            }

        top_train = trains_by_priority[0]
        precedence_list = [
            f"#{idx+1} {t.train_name} ({t.train_id}, Priority {t.priority.name if hasattr(t.priority, 'name') else t.priority})"
            for idx, t in enumerate(trains_by_priority[:4])
        ]

        recs = list(sim_engine.state.active_recommendations.values())
        rec_text = f" Active optimizer order: {recs[0].reason_summary}." if recs else ""

        return {
            "summary": (
                f"Dispatch Precedence: High-priority service {top_train.train_name} ({top_train.train_id}) has highest movement priority. "
                f"Corridor priority ranking: {', '.join(precedence_list)}.{rec_text}"
            ),
            "data": [t.model_dump() for t in trains_by_priority]
        }

    @staticmethod
    def tool_kpi_overview(sim_engine: Any, analytics: Any) -> Dict[str, Any]:
        """Computes comprehensive operational KPIs and traffic state."""
        trains = list(sim_engine.state.trains.values())
        kpis = analytics.compute_kpis(
            trains=trains,
            blocks=list(sim_engine.network.blocks.values()),
            sim_time_sec=sim_engine.state.sim_time_sec,
            predicted_conflicts_count=len(sim_engine.state.predicted_conflicts),
            total_block_transitions=sim_engine.total_block_transitions
        )

        running = [t for t in trains if getattr(t.status, "value", str(t.status)) in ("RUNNING", "DELAYED", "WAITING")]
        delayed = [t for t in trains if t.total_delay_sec > 60]

        if len(running) == 0:
            traffic_state = "NO_ACTIVE_TRAFFIC"
        elif len(delayed) > 0:
            traffic_state = "ACTIVE_CONGESTION"
        else:
            traffic_state = "NOMINAL_TRAFFIC"

        return {
            "summary": (
                f"RAILOPT-X is monitoring {len(trains)} train movements across {len(sim_engine.network.stations)} stations "
                f"and {len(sim_engine.network.blocks)} track blocks. Section Status: {traffic_state}. "
                f"Real-time Section OTP: {kpis.punctuality_otp_pct:.1f}%, Throughput: {kpis.throughput_trains_per_hr:.1f} trains/hr, "
                f"Active Conflicts: {len(sim_engine.state.predicted_conflicts)}."
            ),
            "data": kpis.model_dump()
        }

    @classmethod
    def execute_reasoning_pipeline(
        cls,
        query: str,
        sim_engine: Any,
        conflict_radar: Any,
        analytics: Any,
        audit_logger: Any,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Executes semantic classification, multi-tool composition, and returns
        a fully grounded synthesized response.
        """
        trains = list(sim_engine.state.trains.values())
        referenced_train = cls._extract_referenced_train_id(query, trains)
        
        # If no train extracted from query, check recent conversation context
        if not referenced_train and conversation_history:
            for turn in reversed(conversation_history[-3:]):
                referenced_train = cls._extract_referenced_train_id(turn.get("content", ""), trains)
                if referenced_train:
                    break

        intents = cls.classify_intents(query, conversation_history)

        tool_results: List[Dict[str, Any]] = []
        summary_paragraphs: List[str] = []

        # 1. Precedence & Priority Tool
        if "PRECEDENCE_PRIORITY" in intents:
            res = cls.tool_precedence_priority(sim_engine)
            tool_results.append({"tool": "precedence_priority", "data": res["data"]})
            summary_paragraphs.append(res["summary"])

        # 2. Decision Review Tool
        if "DECISION_REVIEW" in intents:
            res = cls.tool_decision_review(sim_engine, audit_logger)
            tool_results.append({"tool": "decision_review", "data": res["data"]})
            summary_paragraphs.append(res["summary"])

        # 3. Hold & Waiting Status Tool
        if "HOLD_WAIT" in intents:
            res = cls.tool_hold_wait_status(sim_engine, referenced_train)
            tool_results.append({"tool": "hold_wait_status", "data": res["data"]})
            summary_paragraphs.append(res["summary"])

        # 4. Conflict Radar Tool
        if "CONFLICT_RADAR" in intents:
            res = cls.tool_conflict_radar(sim_engine, conflict_radar, referenced_train)
            tool_results.append({"tool": "conflict_radar", "data": res["data"]})
            summary_paragraphs.append(res["summary"])

        # 5. Delay Tool
        if "DELAY_PUNCTUALITY" in intents:
            res = cls.tool_delayed_trains(sim_engine, referenced_train)
            tool_results.append({"tool": "delayed_trains", "data": res["data"]})
            summary_paragraphs.append(res["summary"])

        # 6. Overview Tool
        if "SECTION_OVERVIEW" in intents or not summary_paragraphs:
            res = cls.tool_kpi_overview(sim_engine, analytics)
            tool_results.append({"tool": "kpi_overview", "data": res["data"]})
            summary_paragraphs.append(res["summary"])

        final_answer = " ".join(summary_paragraphs)
        combined_data = tool_results[0]["data"] if len(tool_results) == 1 else {"tools": tool_results}

        return {
            "answer": final_answer,
            "data": combined_data,
            "intents": list(intents),
            "referenced_train_id": referenced_train
        }
