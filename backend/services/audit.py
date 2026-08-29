from __future__ import annotations
import os
import json
import time
import hashlib
from typing import List, Optional, Dict, Any
from ..simulator.railway.models import AuditLogEntry, ControllerActionType, DecisionAction


class AuditLogger:
    """
    Tamper-Evident SHA-256 Hash-Chained Regulatory Decision Audit Logger.
    Logs every AI recommendation, operational justification, controller intervention,
    and resulting delay mitigation metrics with cryptographic link chaining and disk persistence.
    """

    def __init__(self, persistence_file_path: Optional[str] = None):
        self.persistence_file_path = persistence_file_path or os.path.join(
            os.path.dirname(__file__), "..", "data", "audit_trail.jsonl"
        )
        os.makedirs(os.path.dirname(os.path.abspath(self.persistence_file_path)), exist_ok=True)
        self.logs: List[AuditLogEntry] = []
        self._load_from_disk()

    def _load_from_disk(self):
        if os.path.exists(self.persistence_file_path):
            try:
                with open(self.persistence_file_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line:
                            data = json.loads(line)
                            self.logs.append(AuditLogEntry(**data))
            except Exception as e:
                print(f"[AuditLogger] Warning loading existing audit records: {e}")

    def _persist_entry(self, entry: AuditLogEntry):
        try:
            with open(self.persistence_file_path, "a", encoding="utf-8") as f:
                f.write(entry.model_dump_json() + "\n")
        except Exception as e:
            print(f"[AuditLogger] Disk persistence error: {e}")

    def _calculate_hash(self, entry: AuditLogEntry, prev_hash: str) -> str:
        payload = (
            f"{prev_hash}|{entry.entry_id}|{entry.timestamp_sec}|{entry.recommendation_id}|"
            f"{entry.train_id}|{entry.action.value}|{entry.controller_action.value}|"
            f"{entry.override_reason or ''}|{entry.projected_delay_saved_sec}"
        )
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def record_decision(
        self,
        recommendation_id: str,
        train_id: str,
        action: DecisionAction,
        ai_reason: str,
        controller_action: ControllerActionType,
        projected_delay_saved_sec: float,
        override_reason: Optional[str] = None
    ) -> AuditLogEntry:
        prev_hash = self.logs[-1].entry_hash if self.logs and self.logs[-1].entry_hash else "GENESIS_ROOT_00000000000000000000000000000000"
        
        entry = AuditLogEntry(
            entry_id=f"AUDIT_{len(self.logs)+1:04d}",
            timestamp_sec=time.time(),
            recommendation_id=recommendation_id,
            train_id=train_id,
            action=action,
            ai_reason=ai_reason,
            controller_action=controller_action,
            override_reason=override_reason,
            projected_delay_saved_sec=projected_delay_saved_sec,
            prev_hash=prev_hash,
            entry_hash=""
        )
        entry.entry_hash = self._calculate_hash(entry, prev_hash)

        self.logs.append(entry)
        self._persist_entry(entry)
        return entry

    def verify_chain_integrity(self) -> Dict[str, Any]:
        """Cryptographically verify all block hashes in the audit chain"""
        if not self.logs:
            return {"is_tamper_free": True, "entries_verified": 0, "status": "EMPTY"}

        expected_prev_hash = "GENESIS_ROOT_00000000000000000000000000000000"
        for idx, entry in enumerate(self.logs):
            if entry.prev_hash != expected_prev_hash:
                return {
                    "is_tamper_free": False,
                    "tampered_at_index": idx,
                    "tampered_entry_id": entry.entry_id,
                    "reason": "Previous hash pointer mismatch"
                }

            computed_hash = self._calculate_hash(entry, expected_prev_hash)
            if computed_hash != entry.entry_hash:
                return {
                    "is_tamper_free": False,
                    "tampered_at_index": idx,
                    "tampered_entry_id": entry.entry_id,
                    "reason": "Cryptographic payload signature altered"
                }
            expected_prev_hash = entry.entry_hash

        return {
            "is_tamper_free": True,
            "entries_verified": len(self.logs),
            "latest_root_hash": expected_prev_hash
        }

    def verify_chain(self) -> bool:
        """Convenience boolean check for audit chain integrity."""
        return self.verify_chain_integrity().get("is_tamper_free", False)

    def get_all_logs(self) -> List[AuditLogEntry]:
        return list(reversed(self.logs))
