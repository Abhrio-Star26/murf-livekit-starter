import os
import sys
import tempfile
import pytest

src_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "src"))
if src_path not in sys.path:
    sys.path.insert(0, src_path)

from db import get_caller, init_db, sanitize_facts, save_caller


@pytest.fixture
def temp_db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    yield db_path
    if os.path.exists(db_path):
        os.remove(db_path)

def test_init_db(temp_db):
    init_db(temp_db)
    caller = get_caller("user123", temp_db)
    assert caller is None

def test_save_and_get_caller(temp_db):
    facts = {
        "schemes_checked": "PM Kisan",
        "payment_apps_used": "GPay, PhonePe",
        "fraud_topic": "Fake QR Code scam"
    }
    saved = save_caller(
        user_id="user123",
        name="Ramesh Kumar",
        language_preference="hi-IN",
        facts=facts,
        db_path=temp_db
    )

    assert saved["user_id"] == "user123"
    assert saved["name"] == "Ramesh Kumar"
    assert saved["facts"]["schemes_checked"] == "PM Kisan"

    retrieved = get_caller("user123", temp_db)
    assert retrieved is not None
    assert retrieved["user_id"] == "user123"
    assert retrieved["name"] == "Ramesh Kumar"
    assert retrieved["language_preference"] == "hi-IN"
    assert retrieved["facts"]["schemes_checked"] == "PM Kisan"
    assert "last_interaction" in retrieved

def test_sensitive_data_sanitization():
    unsafe_facts = {
        "schemes_checked": "PM Jan Dhan",
        "account_number": "123456789012",
        "upi_pin": "9876",
        "aadhaar": "111122223333",
        "fraud_topic": "Phishing Link"
    }
    clean = sanitize_facts(unsafe_facts)
    assert "schemes_checked" in clean
    assert "fraud_topic" in clean
    assert "account_number" not in clean
    assert "upi_pin" not in clean
    assert "aadhaar" not in clean
