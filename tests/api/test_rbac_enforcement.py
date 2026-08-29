"""
Role-Based Access Control (RBAC) API Enforcement Tests (SIH PS-25022).

Validates that:
1. Privileged mutation endpoints strictly reject unauthorized roles with HTTP 403.
2. Authorized roles succeed with HTTP 200.
3. Analyst (read-only) cannot mutate simulation state, trigger disruptions, or optimize.
4. Controller cannot inject disruptions (requires Supervisor/Admin).
5. Unknown roles are rejected with HTTP 403.
"""
import pytest
from fastapi import HTTPException
from backend.simulator.railway.models import SimulationControlAction, DisruptionType
from backend.api.app import (
    control_simulation, SimControlRequest,
    inject_disruption, DisruptionCreateRequest,
    run_optimization,
    load_scenario_legacy, ScenarioLoadRequest
)
from backend.services.rbac import can_perform, enforce_permission, normalize_role


def test_rbac_matrix_consistency():
    """Ensure can_perform accurately matches the specification across all 4 roles."""
    assert can_perform("Controller", "controlSimulation") is True
    assert can_perform("Controller", "injectDisruption") is False
    assert can_perform("Supervisor", "injectDisruption") is True
    assert can_perform("Admin", "safetyConfig") is True
    assert can_perform("Analyst", "controlSimulation") is False
    assert can_perform("Analyst", "optimize") is False
    assert can_perform("Analyst", "audit") is True
    assert can_perform("Analyst", "analytics") is True


def test_simulation_control_rbac():
    """Simulation control requires Controller, Supervisor, or Admin. Analyst must receive 403."""
    req = SimControlRequest(action=SimulationControlAction.PAUSE)
    
    # Analyst role must be rejected with 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        control_simulation(req, x_user_role="Analyst")
    assert exc_info.value.status_code == 403
    assert "Permission denied" in exc_info.value.detail

    # Admin role must succeed
    res_admin = control_simulation(req, x_user_role="Admin")
    assert res_admin["status"] == "SUCCESS"


def test_disruption_injection_rbac():
    """Disruption injection requires Supervisor or Admin. Controller and Analyst must receive 403."""
    req = DisruptionCreateRequest(
        disruption_type=DisruptionType.TRAIN_DELAY,
        target_id="T04403",
        duration_sec=120.0,
        description="RBAC test delay"
    )

    # Controller cannot inject disruptions
    with pytest.raises(HTTPException) as exc_info:
        inject_disruption(req, x_user_role="Controller")
    assert exc_info.value.status_code == 403

    # Analyst cannot inject disruptions
    with pytest.raises(HTTPException) as exc_info:
        inject_disruption(req, x_user_role="Analyst")
    assert exc_info.value.status_code == 403


def test_optimization_rbac():
    """Optimization requires Controller, Supervisor, or Admin. Analyst must receive 403."""
    # Analyst cannot trigger solver
    with pytest.raises(HTTPException) as exc_info:
        run_optimization(solver_type="Priority", x_user_role="Analyst")
    assert exc_info.value.status_code == 403


from fastapi.testclient import TestClient
from backend.api.app import app

client = TestClient(app)


def test_missing_role_header_rejected_401():
    """Any request to a privileged endpoint without X-User-Role must return HTTP 401 Unauthorized."""
    # Test simulation control without header
    res = client.post("/api/simulation/control", json={"action": "PAUSE"})
    assert res.status_code == 401
    assert "Missing required 'X-User-Role' header" in res.json()["detail"]

    # Test disruption injection without header
    res_dis = client.post("/api/disruptions", json={
        "disruption_type": "BLOCK_CLOSURE",
        "target_id": "BLK_001",
        "duration_sec": 300,
        "description": "Unauthenticated test"
    })
    assert res_dis.status_code == 401

    # Test what-if without header
    res_wif = client.post("/api/what-if", json=[])
    assert res_wif.status_code == 401

    # Test episode loading without header
    res_ep = client.post("/api/episodes/EP_001/load")
    assert res_ep.status_code == 401


def test_live_fastapi_client_rbac_matrix():
    """Live HTTP requests testing RBAC enforcement across roles."""
    # 1. Analyst attempting privileged mutation -> 403
    res_analyst = client.post(
        "/api/simulation/control",
        json={"action": "PAUSE"},
        headers={"X-User-Role": "Analyst"}
    )
    assert res_analyst.status_code == 403
    assert "is not authorized" in res_analyst.json()["detail"]

    # 2. Controller attempting disruption injection -> 403 (needs Supervisor/Admin)
    res_ctrl_dis = client.post(
        "/api/disruptions",
        json={
            "disruption_type": "BLOCK_CLOSURE",
            "target_id": "BLK_001",
            "duration_sec": 300,
            "description": "Unauthorized disruption"
        },
        headers={"X-User-Role": "Controller"}
    )
    assert res_ctrl_dis.status_code == 403

    # 3. Controller performing allowed simulation control -> 200 SUCCESS
    res_ctrl = client.post(
        "/api/simulation/control",
        json={"action": "PAUSE"},
        headers={"X-User-Role": "Controller"}
    )
    assert res_ctrl.status_code == 200
    assert res_ctrl.json()["status"] == "SUCCESS"

    # 4. Supervisor performing disruption injection -> 200 SUCCESS
    res_sup_dis = client.post(
        "/api/disruptions",
        json={
            "disruption_type": "BLOCK_CLOSURE",
            "target_id": "BLK_M1_02",
            "duration_sec": 60,
            "description": "Authorized supervisor disruption"
        },
        headers={"X-User-Role": "Supervisor"}
    )
    assert res_sup_dis.status_code == 200

    # 5. Analyst performing allowed read-only analytics/audit -> 200 SUCCESS
    res_audit = client.get("/api/audit", headers={"X-User-Role": "Analyst"})
    assert res_audit.status_code == 200

    res_bench = client.get("/api/benchmarks", headers={"X-User-Role": "Analyst"})
    assert res_bench.status_code == 200


def test_unknown_role_rejection():
    """Invalid or forged roles must be rejected with HTTP 403."""
    with pytest.raises(HTTPException) as exc_info:
        enforce_permission("audit", x_user_role="HackerRole")
    assert exc_info.value.status_code == 403

    res_fake = client.get("/api/audit", headers={"X-User-Role": "HackerRole"})
    assert res_fake.status_code == 403

