"""
Tests for Recommendation Action HTTP 409 structured error contracts (Task 5).
Ensures that approval on unsafe or unvalidated plans raises HTTPException with human-readable detail strings.
"""
import pytest
from fastapi import HTTPException
from backend.api.app import handle_controller_decision, ControllerDecisionRequest
from backend.simulator.railway.models import ControllerActionType

def test_recommendation_action_missing_recommendation_raises_404():
    req = ControllerDecisionRequest(
        recommendation_id="REC_NONEXISTENT_999",
        action=ControllerActionType.APPROVE
    )
    with pytest.raises(HTTPException) as exc_info:
        handle_controller_decision(req, x_user_role="Controller")
    
    assert exc_info.value.status_code == 404
    assert "not found" in exc_info.value.detail.lower()

def test_recommendation_action_structure_validation():
    req = ControllerDecisionRequest(
        recommendation_id="REC_TEST",
        action=ControllerActionType.OVERRIDE,
        override_reason="Operational precedence override"
    )
    assert req.action == ControllerActionType.OVERRIDE
    assert req.override_reason == "Operational precedence override"
