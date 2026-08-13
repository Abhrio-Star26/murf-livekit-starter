import pytest
from db import init_db, log_call, list_calls, get_call_analytics

def test_call_analytics_crud():
    # Log sample calls
    c1 = log_call(
        room_name="test-room-1",
        user_id="user1",
        caller_name="Ramesh",
        channel="browser",
        language="hi-IN",
        outcome="success",
        failure_type="none",
        track_outcome="eligibility_check_completed",
        scheme_checked="pm_kisan",
        latency_ms=450,
        duration_seconds=42
    )
    assert c1["outcome"] == "success"
    assert c1["track_outcome"] == "eligibility_check_completed"

    c2 = log_call(
        room_name="test-room-2",
        user_id="user2",
        caller_name="Sita",
        channel="sip",
        language="hi-IN",
        outcome="failed",
        failure_type="user_declined",
        track_outcome="none",
        latency_ms=620,
        duration_seconds=15
    )
    assert c2["outcome"] == "failed"
    assert c2["failure_type"] == "user_declined"

    # Test list_calls
    all_calls = list_calls()
    assert len(all_calls) >= 2

    # Test analytics aggregation
    analytics = get_call_analytics()
    assert analytics["total_calls"] >= 2
    assert analytics["successful_calls"] >= 1
    assert analytics["failed_calls"] >= 1
    assert analytics["success_rate"] > 0
    assert analytics["failure_types"]["user_declined"] >= 1
    assert analytics["track_outcomes"]["eligibility_check_completed"] >= 1
