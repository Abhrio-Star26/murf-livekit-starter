"""
Outbound Call Orchestrator — Financial Services Track
Use Case: Scheme deadline approaching for someone already found eligible.

Telephony: LiveKit SIP → Linphone SIP Trunk (ST_a8gycGKaUFLF)
           ↓
           sip:bipraj9@sip.linphone.org (or any SIP URI / E.164 number)

Usage:
  # Place real outbound calls for all pending deadline alerts in DB:
  uv run python src/outbound_call.py

  # Demo mode — seed a mock eligible caller and place ONE call:
  uv run python src/outbound_call.py --demo

  # Dry run — log what would be called, without actually dialing:
  uv run python src/outbound_call.py --dry-run

  # Call a specific SIP URI or phone number directly:
  uv run python src/outbound_call.py --call-to "sip:bipraj9@sip.linphone.org" \\
      --caller-name "Biprajit" --scheme-id "pm_kisan" --deadline "31 August 2026"
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Bootstrap path so we can import sibling modules (db.py, etc.)
# ---------------------------------------------------------------------------
sys.path.insert(0, os.path.dirname(__file__))

from db import (
    get_callers_with_deadline_alert,
    init_db,
    mark_deadline_alert_dispatched,
    save_caller,
)

# ---------------------------------------------------------------------------
# Load environment — .env.local is one level up (backend root)
# ---------------------------------------------------------------------------
ENV_FILE = os.path.join(os.path.dirname(__file__), "..", ".env.local")
load_dotenv(ENV_FILE)

LIVEKIT_URL = os.getenv("LIVEKIT_URL", "")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY", "")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET", "")
LIVEKIT_SIP_TRUNK_ID = os.getenv("LIVEKIT_SIP_TRUNK_ID", "ST_a8gycGKaUFLF")
AGENT_NAME = os.getenv("AGENT_NAME", "my-agent").strip()

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("outbound_call")


# ---------------------------------------------------------------------------
# LiveKit API (lazy import so the module is importable even without livekit installed)
# ---------------------------------------------------------------------------
def _get_lk_api():
    """Return a configured LiveKitAPI client."""
    try:
        from livekit import api as lk_api  # type: ignore
    except ImportError as exc:
        raise ImportError(
            "livekit package is required. Run: uv sync"
        ) from exc

    if not LIVEKIT_URL or not LIVEKIT_API_KEY or not LIVEKIT_API_SECRET:
        raise EnvironmentError(
            "LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET must be set in .env.local"
        )

    return lk_api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
    )


# ---------------------------------------------------------------------------
# Core: place ONE outbound call
# ---------------------------------------------------------------------------
async def place_outbound_call(
    *,
    sip_call_to: str,
    caller_name: str,
    scheme_id: str,
    scheme_name: str,
    deadline: str,
    user_id: str,
    dry_run: bool = False,
) -> dict:
    """
    Orchestrate a single outbound proactive deadline-alert call.

    Steps:
      1. Create a unique LiveKit room name.
      2. Build metadata payload for the agent.
      3. Dispatch the agent to the room via agent_dispatch API.
      4. Create a SIP participant via the LiveKit SIP API (routes through Linphone trunk).
      5. Mark the alert as dispatched in the database.

    Args:
        sip_call_to:  SIP URI (e.g. "sip:user@sip.linphone.org") or E.164 number ("+91XXXXXXXXXX").
        caller_name:  Full name of the recipient.
        scheme_id:    Scheme identifier (e.g. "pm_kisan").
        scheme_name:  Human-readable scheme name (e.g. "PM-KISAN").
        deadline:     Deadline string to speak (e.g. "31 August 2026").
        user_id:      Caller's unique ID in caller_data.db.
        dry_run:      If True, log all steps but do NOT actually call LiveKit APIs.

    Returns:
        dict with keys: room_name, status, error (if any)
    """
    # Ensure sip_call_to is a clean phone number or SIP username (e.g., 'bipraj9' or '+918653144962'), not full 'sip:bipraj9@domain'
    if sip_call_to.startswith("sip:"):
        sip_call_to = sip_call_to.split("sip:")[1].split("@")[0]

    # Unique room name per call — prevents room collisions
    call_uid = str(uuid.uuid4())[:8]
    room_name = f"outbound-deadline-{user_id}-{call_uid}"

    # Metadata passed to the agent at job dispatch time
    metadata = json.dumps(
        {
            "call_type": "outbound_deadline_alert",
            "phone_number": sip_call_to,
            "caller_name": caller_name,
            "scheme_id": scheme_id,
            "scheme_name": scheme_name,
            "deadline": deadline,
            "user_id": user_id,
            "dispatched_at": datetime.now(timezone.utc).isoformat(),
        },
        ensure_ascii=False,
    )

    logger.info(
        "📞 Preparing outbound call | room=%s | to=%s | scheme=%s | deadline=%s",
        room_name,
        sip_call_to,
        scheme_name,
        deadline,
    )

    if dry_run:
        logger.info("🔵 DRY RUN — Skipping LiveKit API calls.")
        logger.info("   Would dispatch agent '%s' to room '%s'", AGENT_NAME, room_name)
        logger.info("   Would call SIP: %s via trunk %s", sip_call_to, LIVEKIT_SIP_TRUNK_ID)
        logger.info("   Metadata: %s", metadata)
        return {"room_name": room_name, "status": "dry_run", "error": None}

    try:
        from livekit import api as lk_api  # type: ignore

        lkapi = _get_lk_api()

        # ----------------------------------------------------------------
        # Step 1: Dispatch the AI agent to the room BEFORE placing the SIP call
        # This ensures Anjali is ready in the room when the callee answers.
        # ----------------------------------------------------------------
        logger.info("🤖 Dispatching agent '%s' to room '%s'...", AGENT_NAME, room_name)
        dispatch = await lkapi.agent_dispatch.create_dispatch(
            lk_api.CreateAgentDispatchRequest(
                agent_name=AGENT_NAME,
                room=room_name,
                metadata=metadata,
            )
        )
        logger.info("✅ Agent dispatched | dispatch_id=%s", dispatch.id)

        # ----------------------------------------------------------------
        # Step 2: Create SIP Participant — this actually DIALS the number
        # Routes through the Linphone SIP trunk (ST_a8gycGKaUFLF)
        # ----------------------------------------------------------------
        if not LIVEKIT_SIP_TRUNK_ID:
            raise EnvironmentError(
                "LIVEKIT_SIP_TRUNK_ID is not set in .env.local — "
                "Add your LiveKit SIP outbound trunk ID."
            )

        logger.info(
            "📡 Dialing %s via SIP trunk %s...", sip_call_to, LIVEKIT_SIP_TRUNK_ID
        )
        sip_participant = await lkapi.sip.create_sip_participant(
            lk_api.CreateSIPParticipantRequest(
                sip_trunk_id=LIVEKIT_SIP_TRUNK_ID,
                sip_call_to=sip_call_to,
                room_name=room_name,
                participant_identity=f"sip-{user_id}",
                participant_name=caller_name,
                wait_until_answered=True,
            )
        )
        logger.info(
            "✅ SIP call initiated | participant_identity=%s | room=%s",
            sip_participant.participant_identity,
            room_name,
        )

        # ----------------------------------------------------------------
        # Step 3: Mark in DB that the alert was dispatched
        # ----------------------------------------------------------------
        mark_deadline_alert_dispatched(user_id=user_id, scheme_id=scheme_id)
        logger.info("💾 DB updated — alert marked as dispatched for user_id=%s", user_id)

        await lkapi.aclose()
        return {"room_name": room_name, "status": "success", "error": None}

    except Exception as exc:
        logger.error("❌ Failed to place outbound call for user_id=%s: %s", user_id, exc)
        return {"room_name": room_name, "status": "error", "error": str(exc)}


# ---------------------------------------------------------------------------
# Run: process all pending deadline alerts from DB
# ---------------------------------------------------------------------------
async def run_pending_alerts(dry_run: bool = False) -> None:
    """Fetch all callers with a pending deadline alert and call each one."""
    init_db()
    pending = get_callers_with_deadline_alert()

    if not pending:
        logger.info("ℹ️  No pending deadline alert callers found in the database.")
        logger.info(
            "   Tip: Use --demo to seed a test record, or --call-to for a direct call."
        )
        return

    logger.info("📋 Found %d caller(s) with pending deadline alerts.", len(pending))
    results = []

    for caller in pending:
        facts = caller.get("facts", {})
        alert_info = facts.get("scheme_deadline_alert", {})

        result = await place_outbound_call(
            sip_call_to=alert_info.get(
                "sip_uri",
                f"sip:{caller['user_id']}@sip.linphone.org",
            ),
            caller_name=caller.get("name", "Unknown"),
            scheme_id=alert_info.get("scheme_id", ""),
            scheme_name=alert_info.get("scheme_name", ""),
            deadline=alert_info.get("deadline", ""),
            user_id=caller["user_id"],
            dry_run=dry_run,
        )
        results.append(result)

    # Summary
    success = sum(1 for r in results if r["status"] in ("success", "dry_run"))
    failed = sum(1 for r in results if r["status"] == "error")
    logger.info("─" * 60)
    logger.info(
        "📊 Call Summary: %d total | ✅ %d succeeded | ❌ %d failed",
        len(results),
        success,
        failed,
    )


# ---------------------------------------------------------------------------
# Demo: seed one fake caller and call them
# ---------------------------------------------------------------------------
async def run_demo(dry_run: bool = False) -> None:
    """
    Seed a sample eligible caller into the DB and place (or simulate) one outbound call.
    Uses the Linphone SIP URI from .env.local as the demo call target.
    """
    init_db()
    LINPHONE_SIP_URI = os.getenv("LINPHONE_SIP_URI", "sip:bipraj9@sip.linphone.org")

    demo_user_id = "demo_user_91999888777"
    demo_name = "Ramesh Kumar (Demo)"

    logger.info("🌱 Seeding demo eligible caller into database...")
    save_caller(
        user_id=demo_user_id,
        name=demo_name,
        language_preference="hi-IN",
        facts={
            "schemes_checked": ["pm_kisan"],
            "eligibility_status": "eligible",
            "scheme_deadline_alert": {
                "scheme_id": "pm_kisan",
                "scheme_name": "PM-KISAN (प्रधानमंत्री किसान सम्मान निधि)",
                "deadline": "31 August 2026",
                "sip_uri": LINPHONE_SIP_URI,
                "alert_dispatched": False,
            },
        },
    )
    logger.info("✅ Demo caller seeded: %s → %s", demo_user_id, demo_name)

    # If full SIP URI like sip:bipraj9@sip.linphone.org, extract just the user/number part (bipraj9 or +91...)
    clean_call_to = LINPHONE_SIP_URI
    if clean_call_to.startswith("sip:"):
        clean_call_to = clean_call_to.split("sip:")[1].split("@")[0]

    logger.info("📞 Placing demo outbound call to %s...", clean_call_to)
    result = await place_outbound_call(
        sip_call_to=clean_call_to,
        caller_name=demo_name,
        scheme_id="pm_kisan",
        scheme_name="PM-KISAN (प्रधानमंत्री किसान सम्मान निधि)",
        deadline="31 August 2026",
        user_id=demo_user_id,
        dry_run=dry_run,
    )

    logger.info("Demo result: %s", json.dumps(result, indent=2))


# ---------------------------------------------------------------------------
# Direct call: call a specific SIP URI / phone number
# ---------------------------------------------------------------------------
async def run_direct_call(
    call_to: str,
    caller_name: str,
    scheme_id: str,
    deadline: str,
    dry_run: bool = False,
) -> None:
    """Place a single outbound call to the specified SIP URI or phone number."""
    init_db()

    # Build a temporary user_id from the call_to string
    user_id = call_to.replace("sip:", "").replace("@", "_at_").replace(".", "_")
    scheme_names = {
        "pm_kisan": "PM-KISAN (प्रधानमंत्री किसान सम्मान निधि)",
        "pm_mudra": "PM MUDRA (प्रधानमंत्री मुद्रा योजना)",
        "atal_pension": "Atal Pension Yojana (अटल पेंशन योजना)",
        "sukanya_samriddhi": "Sukanya Samriddhi Yojana (सुकन्या समृद्धि योजना)",
        "ayushman_bharat": "Ayushman Bharat PM-JAY",
    }
    scheme_name = scheme_names.get(scheme_id, scheme_id)

    result = await place_outbound_call(
        sip_call_to=call_to,
        caller_name=caller_name,
        scheme_id=scheme_id,
        scheme_name=scheme_name,
        deadline=deadline,
        user_id=user_id,
        dry_run=dry_run,
    )
    logger.info("Direct call result: %s", json.dumps(result, indent=2))


# ---------------------------------------------------------------------------
# CLI Entry Point
# ---------------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Outbound Call Orchestrator — Financial Services Track\n"
            "Use Case: Scheme deadline approaching for eligible beneficiaries.\n\n"
            "Telephony: LiveKit SIP → Linphone SIP Trunk → Linphone client"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--demo",
        action="store_true",
        help="Seed a demo eligible caller and place one outbound call.",
    )
    mode.add_argument(
        "--call-to",
        metavar="SIP_URI_OR_PHONE",
        help=(
            "Place a direct call to this SIP URI or E.164 number. "
            "Example: 'sip:bipraj9@sip.linphone.org' or '+919998887770'"
        ),
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log all steps but do NOT actually call LiveKit APIs or dial anyone.",
    )
    parser.add_argument(
        "--caller-name",
        default="Caller",
        help="(Used with --call-to) Name to address the caller by.",
    )
    parser.add_argument(
        "--scheme-id",
        default="pm_kisan",
        choices=["pm_kisan", "pm_mudra", "atal_pension", "sukanya_samriddhi", "ayushman_bharat"],
        help="(Used with --call-to) Scheme ID for the deadline reminder.",
    )
    parser.add_argument(
        "--deadline",
        default="31 August 2026",
        help="(Used with --call-to) Deadline string to speak (e.g. '31 August 2026').",
    )

    return parser.parse_args()


async def main() -> None:
    args = parse_args()

    logger.info("=" * 60)
    logger.info("🏦 Cyber Suraksha Kendra — Outbound Call Orchestrator")
    logger.info("   Track: Financial Services | Use Case: Scheme Deadline Alert")
    logger.info("   Telephony: LiveKit SIP → Linphone (%s)", LIVEKIT_SIP_TRUNK_ID or "TRUNK NOT SET")
    logger.info("=" * 60)

    if args.demo:
        await run_demo(dry_run=args.dry_run)
    elif args.call_to:
        await run_direct_call(
            call_to=args.call_to,
            caller_name=args.caller_name,
            scheme_id=args.scheme_id,
            deadline=args.deadline,
            dry_run=args.dry_run,
        )
    else:
        # Default: process all pending alerts from DB
        await run_pending_alerts(dry_run=args.dry_run)


if __name__ == "__main__":
    asyncio.run(main())
