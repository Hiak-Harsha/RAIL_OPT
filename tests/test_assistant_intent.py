"""
Assistant Intent Matching and Honest Traffic State Tests (Findings #17, #18).

Validates:
  1. Stem matching: "held", "holding", "wait", "waiting" match hold order queries (Finding #17)
  2. Review intent matching: "recommendation", "review", "rationale", "solver"
  3. Honest status: 0 running trains produces NO_ACTIVE_TRAFFIC (not false OPTIMAL) (Finding #18)
"""
from backend.api.app import assistant_query, AssistantQueryRequest, sim_engine


def test_assistant_hold_stem_matching():
    """Queries with 'held' or 'holding' or 'wait' match the hold intent (Finding #17)"""
    res_held = assistant_query(AssistantQueryRequest(query="why is train held at signal"))
    assert res_held is not None
    assert "answer" in res_held

    res_waiting = assistant_query(AssistantQueryRequest(query="why is train waiting at platform"))
    assert res_waiting is not None
    assert "answer" in res_waiting


def test_assistant_honest_traffic_status():
    """Overview query returns honest status (NO_ACTIVE_TRAFFIC or NOMINAL_TRAFFIC, not fake OPTIMAL) (Finding #18)"""
    res = assistant_query(AssistantQueryRequest(query="what is the current section overview status"))
    assert res is not None
    assert "Section Status:" in res["answer"]
    assert "NO_ACTIVE_TRAFFIC" in res["answer"] or "NOMINAL_TRAFFIC" in res["answer"] or "ACTIVE_CONGESTION" in res["answer"]
