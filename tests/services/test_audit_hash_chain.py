"""
Tests for SHA-256 Hash-Chained Regulatory Audit Log (Audit Trail Truth).
"""
import pytest
import os
import tempfile
from backend.services.audit import AuditLogger
from backend.simulator.railway.models import DecisionAction, ControllerActionType

def test_audit_hash_chain_creation_and_verification():
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as tmp:
        temp_path = tmp.name

    try:
        logger = AuditLogger(persistence_file_path=temp_path)
        
        # Record multiple decision events
        logger.record_decision(
            recommendation_id="REC_01",
            train_id="T22436",
            action=DecisionAction.HOLD,
            ai_reason="Prevent conflict at TDL junction",
            controller_action=ControllerActionType.APPROVE,
            projected_delay_saved_sec=240.0
        )

        logger.record_decision(
            recommendation_id="REC_02",
            train_id="T12423",
            action=DecisionAction.REROUTE,
            ai_reason="Overtake by premium express",
            controller_action=ControllerActionType.APPROVE,
            projected_delay_saved_sec=180.0
        )

        # Verify integrity
        integrity = logger.verify_chain_integrity()
        assert integrity["is_tamper_free"] is True
        assert integrity["entries_verified"] == 2

    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
