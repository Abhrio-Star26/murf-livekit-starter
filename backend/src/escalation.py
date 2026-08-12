"""
Escalation Module — Financial Services Track
Cyber Suraksha Kendra | Human-in-the-Loop

This module is the single entry point for:
  - Creating / updating escalation tickets (with PII scrubbing + duplicate detection).
  - Checking the status of an existing ticket.
  - Resolving a ticket and triggering an outbound resolution callback.

All public functions return plain dicts suitable for JSON serialisation.
"""

import logging
import os
import sys
from typing import Any, Dict, Optional

# Allow running as a standalone script inside src/
sys.path.insert(0, os.path.dirname(__file__))

from db import (
    create_or_update_escalation,
    get_escalation_by_id,
    list_escalations,
    update_escalation_status,
)

logger = logging.getLogger("escalation")

# ---------------------------------------------------------------------------
# Urgency helpers
# ---------------------------------------------------------------------------

URGENCY_LABELS = {
    "low":       "🟢 Low",
    "medium":    "🟡 Medium",
    "high":      "🟠 High",
    "emergency": "🔴 Emergency",
}

STATUS_LABELS = {
    "open":        "Open",
    "in_progress": "In Progress",
    "resolved":    "Resolved",
}

# Maps caller-reported issue keywords → default urgency level
_URGENCY_HINTS: list[tuple[list[str], str]] = [
    (["fraud", "फ्रॉड", "scam", "money lost", "पैसे कट", "पैसे गए", "stolen", "hack"], "emergency"),
    (["suspicious", "OTP received", "unknown transaction", "अनजान"], "high"),
    (["scheme", "loan", "eligibility", "document", "deadline"], "low"),
]


def infer_urgency(text: str) -> str:
    """Infer an urgency level from free-text issue summary. Returns 'medium' if no hint matches."""
    lower = text.lower()
    for keywords, level in _URGENCY_HINTS:
        if any(kw.lower() in lower for kw in keywords):
            return level
    return "medium"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def create_escalation(
    *,
    user_id: str,
    caller_name: str,
    language: str = "hi-IN",
    follow_up_method: str = "call",
    issue_category: str,
    issue_summary: str,
    what_agent_checked: str = "",
    urgency: Optional[str] = None,
    sip_uri: str = "",
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create (or update an existing open) escalation ticket.

    Steps:
    1. Infer urgency from summary text if not explicitly set.
    2. Delegate to db.create_or_update_escalation (which sanitises PII and
       checks for duplicate open tickets before inserting).
    3. Return a structured result the agent can relay to the caller.

    Returns:
        {
            "id": "ABCD1234",
            "status": "open",
            "is_duplicate": bool,
            "urgency": "high",
            "message": "...",
        }
    """
    resolved_urgency = urgency if urgency in ("low", "medium", "high", "emergency") else infer_urgency(issue_summary)

    result = create_or_update_escalation(
        user_id=user_id,
        caller_name=caller_name,
        language=language,
        follow_up_method=follow_up_method,
        issue_category=issue_category,
        issue_summary=issue_summary,
        what_agent_checked=what_agent_checked,
        urgency=resolved_urgency,
        sip_uri=sip_uri,
        db_path=db_path,
    )

    esc_id = result["id"]
    is_dup = result["is_duplicate"]

    if is_dup:
        msg = (
            f"Your existing request (ID: {esc_id}) has been updated with the latest details. "
            "A human agent will review it shortly."
        )
        logger.info("🔄 Updated duplicate escalation id=%s user=%s category=%s", esc_id, user_id, issue_category)
    else:
        msg = (
            f"A new help request has been created (ID: {esc_id}). "
            "A human agent will review your case. "
            f"You will be contacted via {follow_up_method} once it is resolved."
        )
        logger.info(
            "🆕 Created escalation id=%s user=%s category=%s urgency=%s",
            esc_id, user_id, issue_category, resolved_urgency,
        )

    return {
        "id": esc_id,
        "status": result["status"],
        "is_duplicate": is_dup,
        "urgency": resolved_urgency,
        "message": msg,
    }


def get_escalation_status(
    escalation_id: str,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Return the current status of an escalation ticket.
    Used by the agent to answer "what happened to my complaint?".
    """
    record = get_escalation_by_id(escalation_id, db_path=db_path)
    if not record:
        return {
            "found": False,
            "message": f"No escalation found with ID '{escalation_id}'. Please check the reference ID.",
        }

    status_label = STATUS_LABELS.get(record["status"], record["status"])
    urgency_label = URGENCY_LABELS.get(record["urgency"], record["urgency"])

    spoken = (
        f"Your request {escalation_id} is currently '{status_label}' "
        f"(priority: {urgency_label}). "
    )
    if record["status"] == "resolved":
        spoken += f"It was resolved on {record.get('resolved_at', 'N/A')}."
    elif record["status"] == "in_progress":
        spoken += "A human agent is actively working on it."
    else:
        spoken += "It is in the queue and will be picked up by a human agent soon."

    return {
        "found": True,
        "id": escalation_id,
        "status": record["status"],
        "urgency": record["urgency"],
        "issue_category": record["issue_category"],
        "created_at": record["created_at"],
        "resolved_at": record.get("resolved_at"),
        "spoken_message": spoken,
    }


def resolve_escalation_and_callback(
    escalation_id: str,
    trigger_callback: bool = True,
    db_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Mark an escalation as resolved and optionally trigger an outbound SIP callback
    to inform the caller.

    Args:
        escalation_id: The escalation ticket ID.
        trigger_callback: If True, attempt to place an outbound resolution call.
        db_path: Optional custom DB path (used in tests).

    Returns:
        dict with resolution outcome and callback status.
    """
    updated = update_escalation_status(escalation_id, "resolved", db_path=db_path)
    if not updated:
        return {"success": False, "message": f"Escalation ID '{escalation_id}' not found."}

    result: Dict[str, Any] = {
        "success": True,
        "id": escalation_id,
        "status": "resolved",
        "resolved_at": updated.get("resolved_at"),
        "callback_attempted": False,
        "callback_status": "skipped",
    }

    if trigger_callback and updated.get("sip_uri"):
        try:
            import asyncio
            # Import here to avoid circular imports
            from outbound_call import place_resolution_callback  # type: ignore

            loop = asyncio.new_event_loop()
            cb_result = loop.run_until_complete(
                place_resolution_callback(
                    escalation_id=escalation_id,
                    user_id=updated["user_id"],
                    caller_name=updated["caller_name"],
                    sip_uri=updated["sip_uri"],
                    issue_category=updated["issue_category"],
                )
            )
            loop.close()
            result["callback_attempted"] = True
            result["callback_status"] = cb_result.get("status", "unknown")
            logger.info("📞 Resolution callback placed for escalation=%s status=%s", escalation_id, cb_result.get("status"))
        except Exception as exc:
            logger.error("❌ Resolution callback failed for escalation=%s: %s", escalation_id, exc)
            result["callback_attempted"] = True
            result["callback_status"] = f"error: {exc}"
    elif not updated.get("sip_uri"):
        result["callback_status"] = "no_sip_uri"

    return result
