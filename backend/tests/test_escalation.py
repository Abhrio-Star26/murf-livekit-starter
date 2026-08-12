"""
Tests for the Human Escalation System
Financial Services Track — Cyber Suraksha Kendra

Run:
    uv run pytest tests/test_escalation.py -v
"""

import json
import os
import tempfile
import sys

import pytest

# Make src importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from db import (
    init_db,
    sanitize_escalation_summary,
    create_or_update_escalation,
    get_escalation_by_id,
    list_escalations,
    update_escalation_status,
)
from escalation import create_escalation, get_escalation_status, infer_urgency


# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def tmp_db(tmp_path):
    """Return a fresh temp DB path for each test."""
    db_file = str(tmp_path / "test_escalations.db")
    init_db(db_path=db_file)
    return db_file


# ─── PII Sanitizer Tests ──────────────────────────────────────────────────────

class TestSanitizeEscalationSummary:

    def test_removes_16_digit_card_number(self):
        text = "Caller said card 4111 1111 1111 1111 was charged unknowingly."
        result = sanitize_escalation_summary(text)
        assert "4111" not in result
        assert "[REDACTED]" in result

    def test_removes_aadhaar_12_digits(self):
        text = "Aadhaar number 123456789012 was mentioned."
        result = sanitize_escalation_summary(text)
        assert "123456789012" not in result

    def test_removes_pan(self):
        text = "PAN card ABCDE1234F was shared."
        result = sanitize_escalation_summary(text)
        assert "ABCDE1234F" not in result

    def test_removes_labelled_otp(self):
        text = "Caller said OTP: 847291 was entered on a fake site."
        result = sanitize_escalation_summary(text)
        assert "847291" not in result

    def test_removes_labelled_pin(self):
        text = "PIN=1234 was visible on screen."
        result = sanitize_escalation_summary(text)
        assert "1234" not in result

    def test_keeps_clean_text_intact(self):
        text = "Caller lost money to a QR code scam. Bank was notified. 1930 was called."
        result = sanitize_escalation_summary(text)
        # No PII → text preserved (1930 has only 4 digits, should be redacted by 4-digit rule)
        assert "QR code scam" in result
        assert "Bank was notified" in result

    def test_empty_string(self):
        assert sanitize_escalation_summary("") == ""


# ─── Urgency Inference Tests ──────────────────────────────────────────────────

class TestInferUrgency:

    def test_fraud_keyword_gives_emergency(self):
        assert infer_urgency("caller reports fraud happening right now") == "emergency"

    def test_hindi_fraud_keyword(self):
        assert infer_urgency("पैसे कट गए अभी") == "emergency"

    def test_scheme_keyword_gives_low(self):
        assert infer_urgency("caller needs help with scheme eligibility") == "low"

    def test_suspicious_gives_high(self):
        assert infer_urgency("Suspicious activity on account") == "high"

    def test_unknown_gives_medium(self):
        assert infer_urgency("caller wants to know general information") == "medium"


# ─── Escalation CRUD Tests ────────────────────────────────────────────────────

class TestCreateOrUpdateEscalation:

    def test_creates_new_escalation(self, tmp_db):
        result = create_or_update_escalation(
            user_id="user_001",
            caller_name="Ramesh Kumar",
            issue_category="fraud_active",
            issue_summary="Caller received unknown UPI debit.",
            urgency="high",
            db_path=tmp_db,
        )
        assert result["is_duplicate"] is False
        assert len(result["id"]) == 8
        assert result["status"] == "open"

    def test_returns_duplicate_for_same_user_and_category(self, tmp_db):
        create_or_update_escalation(
            user_id="user_001",
            caller_name="Ramesh Kumar",
            issue_category="fraud_active",
            issue_summary="First report.",
            urgency="high",
            db_path=tmp_db,
        )
        result2 = create_or_update_escalation(
            user_id="user_001",
            caller_name="Ramesh Kumar",
            issue_category="fraud_active",
            issue_summary="Second report with more details.",
            urgency="emergency",
            db_path=tmp_db,
        )
        assert result2["is_duplicate"] is True

    def test_duplicate_does_not_create_second_record(self, tmp_db):
        create_or_update_escalation(
            user_id="user_002",
            caller_name="Sita Devi",
            issue_category="account_blocked",
            issue_summary="Account frozen after unknown login.",
            urgency="medium",
            db_path=tmp_db,
        )
        create_or_update_escalation(
            user_id="user_002",
            caller_name="Sita Devi",
            issue_category="account_blocked",
            issue_summary="Still blocked, calling again.",
            urgency="medium",
            db_path=tmp_db,
        )
        all_esc = list_escalations(db_path=tmp_db)
        user_esc = [e for e in all_esc if e["user_id"] == "user_002"]
        assert len(user_esc) == 1  # No duplicate row

    def test_different_category_creates_new_ticket(self, tmp_db):
        create_or_update_escalation(
            user_id="user_003",
            caller_name="Mohan Lal",
            issue_category="fraud_active",
            issue_summary="Fraud complaint.",
            urgency="high",
            db_path=tmp_db,
        )
        result2 = create_or_update_escalation(
            user_id="user_003",
            caller_name="Mohan Lal",
            issue_category="scheme_help",
            issue_summary="PM-KISAN document help.",
            urgency="low",
            db_path=tmp_db,
        )
        assert result2["is_duplicate"] is False
        all_esc = list_escalations(db_path=tmp_db)
        user_esc = [e for e in all_esc if e["user_id"] == "user_003"]
        assert len(user_esc) == 2

    def test_pii_is_stripped_from_summary(self, tmp_db):
        result = create_or_update_escalation(
            user_id="user_004",
            caller_name="Priya Sharma",
            issue_category="fraud_active",
            issue_summary="Caller's card 4111111111111111 was charged.",
            urgency="emergency",
            db_path=tmp_db,
        )
        record = get_escalation_by_id(result["id"], db_path=tmp_db)
        assert "4111111111111111" not in record["issue_summary"]
        assert "[REDACTED]" in record["issue_summary"]


# ─── Status Update Tests ──────────────────────────────────────────────────────

class TestUpdateEscalationStatus:

    def test_open_to_in_progress(self, tmp_db):
        r = create_or_update_escalation(
            user_id="user_010",
            caller_name="Dev",
            issue_category="fraud_active",
            issue_summary="Test.",
            urgency="medium",
            db_path=tmp_db,
        )
        updated = update_escalation_status(r["id"], "in_progress", db_path=tmp_db)
        assert updated["status"] == "in_progress"

    def test_resolved_sets_resolved_at(self, tmp_db):
        r = create_or_update_escalation(
            user_id="user_011",
            caller_name="Anita",
            issue_category="general_complaint",
            issue_summary="Test.",
            urgency="low",
            db_path=tmp_db,
        )
        updated = update_escalation_status(r["id"], "resolved", db_path=tmp_db)
        assert updated["status"] == "resolved"
        assert updated["resolved_at"] is not None

    def test_invalid_status_raises(self, tmp_db):
        r = create_or_update_escalation(
            user_id="user_012",
            caller_name="Raj",
            issue_category="account_blocked",
            issue_summary="Test.",
            urgency="high",
            db_path=tmp_db,
        )
        with pytest.raises(ValueError, match="Invalid status"):
            update_escalation_status(r["id"], "flying", db_path=tmp_db)

    def test_not_found_returns_none(self, tmp_db):
        result = update_escalation_status("NONEXIST", "resolved", db_path=tmp_db)
        assert result is None


# ─── List & Filter Tests ──────────────────────────────────────────────────────

class TestListEscalations:

    def test_filter_by_status(self, tmp_db):
        r = create_or_update_escalation(
            user_id="user_020", caller_name="X",
            issue_category="fraud_active", issue_summary="s.", urgency="high", db_path=tmp_db,
        )
        update_escalation_status(r["id"], "resolved", db_path=tmp_db)
        create_or_update_escalation(
            user_id="user_021", caller_name="Y",
            issue_category="scheme_help", issue_summary="s.", urgency="low", db_path=tmp_db,
        )
        open_only = list_escalations(status="open", db_path=tmp_db)
        assert all(e["status"] == "open" for e in open_only)

    def test_filter_by_urgency(self, tmp_db):
        create_or_update_escalation(
            user_id="user_030", caller_name="A",
            issue_category="fraud_active", issue_summary="s.", urgency="emergency", db_path=tmp_db,
        )
        create_or_update_escalation(
            user_id="user_031", caller_name="B",
            issue_category="scheme_help", issue_summary="s.", urgency="low", db_path=tmp_db,
        )
        emergency_only = list_escalations(urgency="emergency", db_path=tmp_db)
        assert all(e["urgency"] == "emergency" for e in emergency_only)


# ─── High-Level Escalation API Tests ─────────────────────────────────────────

class TestEscalationModule:

    def test_create_escalation_returns_spoken_message(self, tmp_db):
        result = create_escalation(
            user_id="user_100",
            caller_name="Test Caller",
            issue_category="fraud_active",
            issue_summary="Money was debited without consent.",
            what_agent_checked="Advised caller to call 1930.",
            urgency="high",
            db_path=tmp_db,
        )
        assert "id" in result
        assert "message" in result
        assert result["status"] == "open"

    def test_get_escalation_status_found(self, tmp_db):
        r = create_escalation(
            user_id="user_101",
            caller_name="Ramesh",
            issue_category="account_blocked",
            issue_summary="Account frozen.",
            what_agent_checked="Referred to bank helpline.",
            urgency="medium",
            db_path=tmp_db,
        )
        status = get_escalation_status(r["id"], db_path=tmp_db)
        assert status["found"] is True
        assert "spoken_message" in status

    def test_get_escalation_status_not_found(self, tmp_db):
        status = get_escalation_status("BADID99", db_path=tmp_db)
        assert status["found"] is False
