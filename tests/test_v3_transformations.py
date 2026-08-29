import pytest
from backend.simulator.railway.wait_reason import WaitReason, WaitReasonType
from backend.ai.xai.explainer import EvidenceFact
from backend.services.decision_orchestrator import DecisionOrchestrator
from backend.services.operational_objective import compute_J, DECISION_HORIZON_SEC, PERFORMANCE_HORIZON_SEC


def test_wait_reason_factory_methods():
    hw = WaitReason.headway(180.0, "T12004")
    assert hw.type == WaitReasonType.HEADWAY_INSUFFICIENT
    assert hw.remaining_sec == 180.0
    assert hw.severity == "HIGH"
    assert "T12004" in hw.message

    rt = WaitReason.route("BLK_NDLS_GZB_UP_01", "T22436")
    assert rt.type == WaitReasonType.ROUTE_NOT_RESERVED
    assert "BLK_NDLS_GZB_UP_01" in rt.message

    sig = WaitReason.signal_red("SIG_ALJN_01", "BLK_ALJN_01")
    assert sig.type == WaitReasonType.SIGNAL_RED
    assert "SIG_ALJN_01" in sig.message


def test_evidence_fact_delta_and_verification():
    fact = EvidenceFact(
        code="CONFLICT_REDUCED",
        train_ids=["T12002", "T22436"],
        metric_name="conflicts_count",
        metric_before=2.0,
        metric_after=0.0,
        verified=True,
        rendered_text="Action physically eliminates 2 projected crossing conflicts."
    )
    assert fact.delta == -2.0
    assert fact.is_improvement() is True
    assert fact.verified is True


def test_decision_orchestrator_initialization():
    orch = DecisionOrchestrator()
    assert orch.network is None
    assert orch.handle_predicted_conflict(None, [], [], 0.0) is None


def test_objective_horizons_and_safety_gate():
    assert DECISION_HORIZON_SEC == 900.0
    assert PERFORMANCE_HORIZON_SEC == 14400.0

    j_safe = compute_J(total_delay_min=10.0, max_delay_min=4.0, conflicts_count=0)
    assert j_safe > 0.0

    j_unsafe = compute_J(total_delay_min=0.0, max_delay_min=0.0, conflicts_count=0, safety_valid=False)
    assert j_unsafe == 99999.0
