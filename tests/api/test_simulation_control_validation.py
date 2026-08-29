"""
Tests for Simulation Control parameter validation and strict enum rejection (CI Baseline).
"""
import pytest
from pydantic import ValidationError
from backend.simulator.railway.models import SimulationControlAction
from backend.api.app import SimControlRequest, control_simulation
from fastapi import HTTPException

def test_sim_control_valid_actions():
    req_start = SimControlRequest(action=SimulationControlAction.START)
    assert req_start.action == SimulationControlAction.START

    req_scale = SimControlRequest(action=SimulationControlAction.SET_SCALE, time_scale=5.0)
    assert req_scale.time_scale == 5.0

def test_sim_control_out_of_bounds_scale():
    # Negative time scale must fail Pydantic validation
    with pytest.raises(ValidationError):
        SimControlRequest(action=SimulationControlAction.SET_SCALE, time_scale=-2.0)

    # Scale greater than 20.0 must fail
    with pytest.raises(ValidationError):
        SimControlRequest(action=SimulationControlAction.SET_SCALE, time_scale=50.0)

def test_sim_control_missing_required_params_raises_http_400():
    req = SimControlRequest(action=SimulationControlAction.SET_SCALE, time_scale=None)
    with pytest.raises(HTTPException) as exc_info:
        control_simulation(req, x_user_role="Controller")
    assert exc_info.value.status_code == 400
