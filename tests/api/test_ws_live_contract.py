import pytest
from backend.api.app import health_check, get_state, get_topology, get_branch_diff


def test_api_health_endpoint():
    data = health_check()
    assert data["status"] == "HEALTHY"
    assert data["system"] == "RAILOPT-X"
    assert "sim_time_sec" in data


def test_api_state_snapshot_contract():
    data = get_state()
    assert "sequence" in data
    assert "topology_revision" in data
    assert "trains" in data
    assert "blocks" in data
    assert "signals" in data
    assert "platforms" in data
    assert "kpis" in data


def test_api_topology_contract():
    data = get_topology()
    assert "stations" in data
    assert "blocks" in data
    assert "signals" in data
    assert "platforms" in data


def test_api_branch_diff_contract():
    data = get_branch_diff("BRANCH_OPT_A")
    assert data["branch_id"] == "BRANCH_OPT_A"
    assert data["is_live_twin"] is False
    assert "delta" in data
    assert "delay_saved_min" in data["delta"]
