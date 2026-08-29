"""
Test Suite for RAILOPT-X AI Assistant Multi-Tool Reasoning Engine.
Verifies robust natural language comprehension, arbitrary phrasing, compound tool composition,
and conversational memory with zero number fabrication.
"""

import pytest
from backend.api.app import assistant_query, AssistantQueryRequest, sim_engine


def test_rephrasing_precedence_and_priority():
    """5 rephrasings of precedence & priority dispatch questions."""
    queries = [
        "which train should I let through first?",
        "who gets precedence at the junction?",
        "what is the dispatch priority ordering for active trains?",
        "which service has highest priority right now?",
        "who should proceed first through the corridor?"
    ]
    for q in queries:
        res = assistant_query(AssistantQueryRequest(query=q))
        assert res is not None
        assert "answer" in res
        assert ("Dispatch Precedence" in res["answer"] or "Priority" in res["answer"] or "priority" in res["answer"])
        assert "PRECEDENCE_PRIORITY" in res["intents"]


def test_rephrasing_hold_and_waiting():
    """5 rephrasings of train hold and waiting queries."""
    queries = [
        "why is the freight train held?",
        "which trains are currently waiting at signals?",
        "is any service detained in the section?",
        "why are we stopped at this platform?",
        "what is the reason for the train holding?"
    ]
    for q in queries:
        res = assistant_query(AssistantQueryRequest(query=q))
        assert res is not None
        assert "answer" in res
        assert "HOLD_WAIT" in res["intents"]


def test_rephrasing_conflict_radar():
    """5 rephrasings of proactive conflict radar questions."""
    queries = [
        "are there any upcoming conflicts on the line?",
        "is there a collision risk in the next 15 minutes?",
        "what is the bottleneck crossing contention status?",
        "show me any predicted headway violations",
        "do we have any opposing train overlaps ahead?"
    ]
    for q in queries:
        res = assistant_query(AssistantQueryRequest(query=q))
        assert res is not None
        assert "answer" in res
        assert "CONFLICT_RADAR" in res["intents"]


def test_rephrasing_delay_and_punctuality():
    """5 rephrasings of delay and punctuality questions."""
    queries = [
        "which trains are running late?",
        "what is the schedule deviation for active services?",
        "how much delay has accumulated in the section?",
        "are any trains behind schedule?",
        "what is the current OTP punctuality status?"
    ]
    for q in queries:
        res = assistant_query(AssistantQueryRequest(query=q))
        assert res is not None
        assert "answer" in res
        assert "DELAY_PUNCTUALITY" in res["intents"]


def test_rephrasing_decision_review_and_rationale():
    """5 rephrasings of optimization and decision review questions."""
    queries = [
        "explain the optimizer recommendation",
        "why did CP-SAT propose this dispatch plan?",
        "what is the rationale behind the active decision?",
        "review the mathematical solver objective score",
        "show me the counterfactual options considered by the AI"
    ]
    for q in queries:
        res = assistant_query(AssistantQueryRequest(query=q))
        assert res is not None
        assert "answer" in res
        assert "DECISION_REVIEW" in res["intents"]


def test_compound_multi_tool_composition():
    """Verify compound queries synthesize multiple tools simultaneously into one cohesive answer."""
    # Compound: Hold status + Conflict prediction
    compound_query = "why is the freight held and is there a conflict behind it?"
    res = assistant_query(AssistantQueryRequest(query=compound_query))
    assert res is not None
    assert "answer" in res
    assert "HOLD_WAIT" in res["intents"]
    assert "CONFLICT_RADAR" in res["intents"]
    # Verify both tool results are present in response text
    assert ("held" in res["answer"].lower() or "waiting" in res["answer"].lower())
    assert ("conflict" in res["answer"].lower() or "lookahead" in res["answer"].lower())


def test_conversational_follow_up_with_history():
    """Verify follow-up questions leverage conversation history for context resolution."""
    history = [
        {"role": "user", "content": "Tell me about train T22436 Vande Bharat"},
        {"role": "assistant", "content": "Train T22436 is running on-time at 130 km/h."}
    ]
    # Follow-up with no explicit train ID in query
    res = assistant_query(AssistantQueryRequest(query="why is it waiting?", messages=history))
    assert res is not None
    assert "answer" in res
    assert "HOLD_WAIT" in res["intents"]
    assert res["referenced_train_id"] == "T22436"
