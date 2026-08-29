import pytest
import tempfile
import os
from backend.services.audit import AuditLogger
from backend.simulator.railway.models import ControllerActionType, DecisionAction


def test_audit_logger_hash_chaining_and_tamper_detection():
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as tf:
        temp_path = tf.name

    try:
        logger = AuditLogger(persistence_file_path=temp_path)
        
        # Log decisions
        e1 = logger.record_decision(
            recommendation_id="REC_01",
            train_id="T22436",
            action=DecisionAction.HOLD,
            ai_reason="Wait at loop line for Rajdhani passage",
            controller_action=ControllerActionType.APPROVE,
            projected_delay_saved_sec=420.0
        )
        
        e2 = logger.record_decision(
            recommendation_id="REC_02",
            train_id="T12301",
            action=DecisionAction.CHANGE_PRECEDENCE,
            ai_reason="Priority corridor clearance",
            controller_action=ControllerActionType.APPROVE,
            projected_delay_saved_sec=600.0
        )

        assert e1.prev_hash == "GENESIS_ROOT_00000000000000000000000000000000"
        assert e2.prev_hash == e1.entry_hash
        assert e1.entry_hash != ""
        assert e2.entry_hash != ""

        # Verify integrity
        integrity = logger.verify_chain_integrity()
        assert integrity["is_tamper_free"] is True
        assert integrity["entries_verified"] == 2

        # Simulate tampering
        logger.logs[0].projected_delay_saved_sec = 9999.0
        tampered_check = logger.verify_chain_integrity()
        assert tampered_check["is_tamper_free"] is False
        assert tampered_check["tampered_entry_id"] == "AUDIT_0001"

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
