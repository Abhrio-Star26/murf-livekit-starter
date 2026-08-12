import json
import os
import re
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# Path to SQLite database file
DB_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
DB_PATH = os.path.join(DB_DIR, "caller_data.db")

# Prohibited sensitive keys/patterns for Financial Services safety rules
SENSITIVE_PATTERNS = [
    "account", "account_number", "acc_no", "bank_acc",
    "aadhaar", "adhar", "pan", "pan_card", "ssn",
    "pin", "upi_pin", "atm_pin", "otp", "password",
    "cvv", "card_number", "credit_card", "debit_card"
]

def get_db_connection(db_path: Optional[str] = None) -> sqlite3.Connection:
    target_path = db_path or DB_PATH
    os.makedirs(os.path.dirname(target_path), exist_ok=True)
    conn = sqlite3.connect(target_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(db_path: Optional[str] = None) -> None:
    """Initialize the SQLite database schema (callers + escalations tables)."""
    conn = get_db_connection(db_path)
    try:
        with conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS callers (
                    user_id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    language_preference TEXT NOT NULL DEFAULT 'hi-IN',
                    facts TEXT NOT NULL DEFAULT '{}',
                    last_interaction TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS escalations (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    caller_name TEXT NOT NULL,
                    language TEXT NOT NULL DEFAULT 'hi-IN',
                    follow_up_method TEXT NOT NULL DEFAULT 'call',
                    issue_category TEXT NOT NULL,
                    issue_summary TEXT NOT NULL,
                    what_agent_checked TEXT NOT NULL DEFAULT '',
                    urgency TEXT NOT NULL DEFAULT 'medium',
                    status TEXT NOT NULL DEFAULT 'open',
                    sip_uri TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    resolved_at TEXT
                )
            """)
    finally:
        conn.close()

def sanitize_facts(facts: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sanitize facts dictionary to enforce Financial Services track rules:
    Do NOT store account or ID numbers, PINs, OTPs, or passwords.
    """
    clean_facts = {}
    if not isinstance(facts, dict):
        return clean_facts

    for key, value in facts.items():
        key_lower = str(key).lower().strip()
        val_str = str(value).lower().strip()

        # Reject keys matching sensitive patterns
        if any(pattern in key_lower for pattern in SENSITIVE_PATTERNS):
            continue
        
        clean_facts[key] = value

    return clean_facts

def get_caller(user_id: str, db_path: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Retrieve caller record by user_id."""
    init_db(db_path)
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT user_id, name, language_preference, facts, last_interaction FROM callers WHERE user_id = ?", (user_id,))
        row = cur.fetchone()
        if not row:
            return None
        
        facts = json.loads(row["facts"]) if row["facts"] else {}
        return {
            "user_id": row["user_id"],
            "name": row["name"],
            "language_preference": row["language_preference"],
            "facts": facts,
            "last_interaction": row["last_interaction"]
        }
    finally:
        conn.close()

def save_caller(
    user_id: str,
    name: str,
    language_preference: str = "hi-IN",
    facts: Optional[Dict[str, Any]] = None,
    db_path: Optional[str] = None
) -> Dict[str, Any]:
    """Save or update a caller record in SQLite database after consent."""
    init_db(db_path)
    clean_facts = sanitize_facts(facts or {})
    timestamp = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection(db_path)
    try:
        with conn:
            conn.execute("""
                INSERT INTO callers (user_id, name, language_preference, facts, last_interaction)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    name = excluded.name,
                    language_preference = excluded.language_preference,
                    facts = excluded.facts,
                    last_interaction = excluded.last_interaction
            """, (
                user_id,
                name,
                language_preference,
                json.dumps(clean_facts, ensure_ascii=False),
                timestamp
            ))
        return {
            "user_id": user_id,
            "name": name,
            "language_preference": language_preference,
            "facts": clean_facts,
            "last_interaction": timestamp
        }
    finally:
        conn.close()


# =============================================================================
# Outbound Call Support Functions
# Added for: Financial Services Track — Scheme Deadline Alert outbound use case
# =============================================================================

def get_callers_with_deadline_alert(db_path: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Retrieve all callers who have a 'scheme_deadline_alert' entry in their facts
    AND where the alert has NOT yet been dispatched (alert_dispatched != True).

    Used by outbound_call.py to build the list of people to call.

    Returns:
        List of caller dicts: {user_id, name, language_preference, facts, last_interaction}
    """
    init_db(db_path)
    conn = get_db_connection(db_path)
    results = []
    try:
        cur = conn.cursor()
        # Fetch all callers — filter in Python since facts is stored as JSON text
        cur.execute(
            "SELECT user_id, name, language_preference, facts, last_interaction FROM callers"
        )
        rows = cur.fetchall()
        for row in rows:
            facts = json.loads(row["facts"]) if row["facts"] else {}
            alert_info = facts.get("scheme_deadline_alert")
            if not alert_info:
                continue
            # Only include callers where the alert has NOT been dispatched yet
            if alert_info.get("alert_dispatched") is True:
                continue
            results.append({
                "user_id": row["user_id"],
                "name": row["name"],
                "language_preference": row["language_preference"],
                "facts": facts,
                "last_interaction": row["last_interaction"],
            })
        return results
    finally:
        conn.close()


def mark_deadline_alert_dispatched(
    user_id: str,
    scheme_id: str,
    db_path: Optional[str] = None,
) -> bool:
    """
    Mark a deadline alert as dispatched for a specific caller + scheme.
    Updates the 'scheme_deadline_alert.alert_dispatched' flag to True
    and records the dispatch timestamp.

    Called by outbound_call.py after successfully placing a SIP call.

    Args:
        user_id:   The caller's unique ID.
        scheme_id: The scheme ID that was alerted about.
        db_path:   Optional custom DB path (used in tests).

    Returns:
        True if the record was found and updated, False otherwise.
    """
    init_db(db_path)
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT facts FROM callers WHERE user_id = ?", (user_id,)
        )
        row = cur.fetchone()
        if not row:
            return False

        facts = json.loads(row["facts"]) if row["facts"] else {}
        alert_info = facts.get("scheme_deadline_alert", {})

        # Update if this alert is for the matching scheme (or scheme_id is unset)
        if alert_info.get("scheme_id") == scheme_id or not alert_info.get("scheme_id"):
            alert_info["alert_dispatched"] = True
            alert_info["dispatched_at"] = datetime.now(timezone.utc).isoformat()
            facts["scheme_deadline_alert"] = alert_info

            with conn:
                conn.execute(
                    "UPDATE callers SET facts = ? WHERE user_id = ?",
                    (json.dumps(facts, ensure_ascii=False), user_id),
                )
            return True
        return False
    finally:
        conn.close()


# =============================================================================
# Escalation Support Functions
# Financial Services Track — Human-in-the-Loop Escalation
# =============================================================================

# Patterns that must never appear in escalation summaries
_ESCALATION_PII_PATTERNS = [
    r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",  # 16-digit card
    r"\b\d{12}\b",                                        # Aadhaar
    r"\b[A-Z]{5}\d{4}[A-Z]\b",                          # PAN
    r"\b\d{6}\b",                                         # 6-digit OTP / PIN
    r"\b\d{4}\b",                                         # 4-digit PIN
    r"(?i)(otp|pin|password|passcode)[\s:=]+\S+",        # labelled credentials
    r"(?i)account\s*(number|no\.?|num)[\s:=]+\S+",      # labelled account numbers
    r"(?i)cvv[\s:=]+\d+",                                # CVV
]
_PII_REDACTION = "[REDACTED]"


def sanitize_escalation_summary(text: str) -> str:
    """Remove PII (OTP, PIN, card numbers, Aadhaar, PAN, passwords) from an escalation summary."""
    for pattern in _ESCALATION_PII_PATTERNS:
        text = re.sub(pattern, _PII_REDACTION, text)
    return text.strip()


def create_or_update_escalation(
    *,
    user_id: str,
    caller_name: str,
    language: str = "hi-IN",
    follow_up_method: str = "call",
    issue_category: str,
    issue_summary: str,
    what_agent_checked: str = "",
    urgency: str = "medium",
    sip_uri: str = "",
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a new escalation or update an existing open one for the same user + category.
    Runs PII sanitization on issue_summary and what_agent_checked before saving.

    Returns:
        dict with keys: id, user_id, status, is_duplicate, created_at, updated_at
    """
    init_db(db_path)
    # Sanitize before persisting
    clean_summary = sanitize_escalation_summary(issue_summary)
    clean_checked = sanitize_escalation_summary(what_agent_checked)
    valid_urgency = urgency if urgency in ("low", "medium", "high", "emergency") else "medium"
    now = datetime.now(timezone.utc).isoformat()

    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        # Duplicate check: open escalation for same user + category
        cur.execute(
            """
            SELECT id, created_at FROM escalations
            WHERE user_id = ? AND issue_category = ? AND status IN ('open', 'in_progress')
            ORDER BY created_at DESC LIMIT 1
            """,
            (user_id, issue_category),
        )
        existing = cur.fetchone()

        if existing:
            # Update the existing ticket instead of creating a duplicate
            esc_id = existing["id"]
            with conn:
                conn.execute(
                    """
                    UPDATE escalations
                    SET issue_summary = ?, what_agent_checked = ?, urgency = ?,
                        follow_up_method = ?, sip_uri = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (clean_summary, clean_checked, valid_urgency, follow_up_method, sip_uri, now, esc_id),
                )
            return {
                "id": esc_id,
                "user_id": user_id,
                "status": "open",
                "is_duplicate": True,
                "created_at": existing["created_at"],
                "updated_at": now,
            }

        # New escalation
        esc_id = str(uuid.uuid4())[:8].upper()
        with conn:
            conn.execute(
                """
                INSERT INTO escalations
                    (id, user_id, caller_name, language, follow_up_method,
                     issue_category, issue_summary, what_agent_checked,
                     urgency, status, sip_uri, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
                """,
                (
                    esc_id, user_id, caller_name, language, follow_up_method,
                    issue_category, clean_summary, clean_checked,
                    valid_urgency, sip_uri, now, now,
                ),
            )
        return {
            "id": esc_id,
            "user_id": user_id,
            "status": "open",
            "is_duplicate": False,
            "created_at": now,
            "updated_at": now,
        }
    finally:
        conn.close()


def get_escalation_by_id(
    escalation_id: str,
    db_path: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Return a single escalation record by ID, or None if not found."""
    init_db(db_path)
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM escalations WHERE id = ?", (escalation_id,))
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)
    finally:
        conn.close()


def list_escalations(
    status: Optional[str] = None,
    urgency: Optional[str] = None,
    db_path: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """List escalations, optionally filtered by status and/or urgency."""
    init_db(db_path)
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        query = "SELECT * FROM escalations WHERE 1=1"
        params: list = []
        if status:
            query += " AND status = ?"
            params.append(status)
        if urgency:
            query += " AND urgency = ?"
            params.append(urgency)
        query += " ORDER BY created_at DESC"
        cur.execute(query, params)
        return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()


def update_escalation_status(
    escalation_id: str,
    new_status: str,
    db_path: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Update escalation status to 'open', 'in_progress', or 'resolved'.
    Sets resolved_at when transitioning to 'resolved'.

    Returns updated escalation dict, or None if not found.
    """
    valid_statuses = ("open", "in_progress", "resolved")
    if new_status not in valid_statuses:
        raise ValueError(f"Invalid status '{new_status}'. Must be one of: {valid_statuses}")

    init_db(db_path)
    now = datetime.now(timezone.utc).isoformat()
    conn = get_db_connection(db_path)
    try:
        cur = conn.cursor()
        cur.execute("SELECT * FROM escalations WHERE id = ?", (escalation_id,))
        row = cur.fetchone()
        if not row:
            return None

        resolved_at = now if new_status == "resolved" else row["resolved_at"]
        with conn:
            conn.execute(
                "UPDATE escalations SET status = ?, updated_at = ?, resolved_at = ? WHERE id = ?",
                (new_status, now, resolved_at, escalation_id),
            )
        updated = dict(row)
        updated["status"] = new_status
        updated["updated_at"] = now
        updated["resolved_at"] = resolved_at
        return updated
    finally:
        conn.close()
