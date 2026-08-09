import json
import os
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Optional

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
    """Initialize the SQLite database schema."""
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
