"""
Escalation REST API — Cyber Suraksha Kendra
FastAPI app (port 8001) that exposes escalation CRUD endpoints
for the Next.js dashboard to consume.

Run:
    uv run python src/escalation_api.py
Or with uvicorn directly:
    uv run uvicorn src.escalation_api:app --host 0.0.0.0 --port 8001 --reload
"""

import logging
import os
import sys

from dotenv import load_dotenv

# Allow running from backend root
sys.path.insert(0, os.path.dirname(__file__))

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

try:
    from fastapi import FastAPI, HTTPException, Query
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel
except ImportError as exc:
    raise ImportError(
        "fastapi and pydantic are required. Run: uv add fastapi uvicorn pydantic"
    ) from exc

from db import (
    init_db,
    list_escalations,
    get_escalation_by_id,
    update_escalation_status,
    create_or_update_escalation,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("escalation_api")

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Cyber Suraksha Kendra — Escalation API",
    description="REST API for the Human Escalation dashboard.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    logger.info("✅ Escalation DB initialized.")


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class StatusUpdateRequest(BaseModel):
    status: str  # "open" | "in_progress" | "resolved"
    trigger_callback: bool = False  # if True, place outbound SIP call on resolve


class CreateEscalationRequest(BaseModel):
    user_id: str
    caller_name: str
    language: str = "hi-IN"
    follow_up_method: str = "call"
    issue_category: str
    issue_summary: str
    what_agent_checked: str = ""
    urgency: str = "medium"
    sip_uri: str = ""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok", "service": "escalation_api"}


@app.get("/escalations")
def list_all_escalations(
    status: str = Query(default=None, description="Filter by status: open, in_progress, resolved"),
    urgency: str = Query(default=None, description="Filter by urgency: low, medium, high, emergency"),
):
    """List all escalation tickets, optionally filtered by status and/or urgency."""
    return list_escalations(status=status, urgency=urgency)


@app.get("/escalations/{escalation_id}")
def get_escalation(escalation_id: str):
    """Get a single escalation by ID."""
    record = get_escalation_by_id(escalation_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Escalation '{escalation_id}' not found.")
    return record


@app.post("/escalations", status_code=201)
def create_escalation_endpoint(body: CreateEscalationRequest):
    """Create or update an escalation (duplicate detection: updates existing open ticket)."""
    result = create_or_update_escalation(
        user_id=body.user_id,
        caller_name=body.caller_name,
        language=body.language,
        follow_up_method=body.follow_up_method,
        issue_category=body.issue_category,
        issue_summary=body.issue_summary,
        what_agent_checked=body.what_agent_checked,
        urgency=body.urgency,
        sip_uri=body.sip_uri,
    )
    return result


@app.patch("/escalations/{escalation_id}/status")
def update_status(escalation_id: str, body: StatusUpdateRequest):
    """
    Update the status of an escalation.
    If status='resolved' and trigger_callback=True, places an outbound SIP resolution call.
    """
    try:
        updated = update_escalation_status(escalation_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if not updated:
        raise HTTPException(status_code=404, detail=f"Escalation '{escalation_id}' not found.")

    response = {**updated, "callback_status": "skipped"}

    if body.status == "resolved" and body.trigger_callback and updated.get("sip_uri"):
        try:
            import asyncio
            from escalation import resolve_escalation_and_callback  # type: ignore
            result = resolve_escalation_and_callback(
                escalation_id=escalation_id,
                trigger_callback=True,
            )
            response["callback_status"] = result.get("callback_status", "unknown")
            logger.info("📞 Resolution callback triggered for %s: %s", escalation_id, response["callback_status"])
        except Exception as exc:
            logger.error("Resolution callback error for %s: %s", escalation_id, exc)
            response["callback_status"] = f"error: {exc}"

    return response


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("escalation_api:app", host="0.0.0.0", port=8001, reload=True, log_level="info")
