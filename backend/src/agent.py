import json
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    tokenize,
    room_io,
    UserInputTranscribedEvent,
)
from livekit.plugins import murf, silero, google, deepgram, noise_cancellation
from livekit.plugins.turn_detector.multilingual import MultilingualModel

try:
    from db import get_caller, init_db, save_caller, mark_deadline_alert_dispatched, log_call
    from Prompt import SYSTEM_PROMPT, FIRST_TURN_GREETING
    from outbound_prompt import OUTBOUND_SYSTEM_PROMPT, OUTBOUND_FIRST_TURN_GREETING
    from outbound_prompt_resolution import RESOLUTION_SYSTEM_PROMPT, RESOLUTION_FIRST_TURN_GREETING
    from schemes import evaluate_scheme_eligibility, get_document_checklist, get_available_schemes
    from escalation import create_escalation as _create_escalation, get_escalation_status as _get_escalation_status
except ImportError:
    from .db import get_caller, init_db, save_caller, mark_deadline_alert_dispatched, log_call
    from .Prompt import SYSTEM_PROMPT, FIRST_TURN_GREETING
    from .outbound_prompt import OUTBOUND_SYSTEM_PROMPT, OUTBOUND_FIRST_TURN_GREETING
    from .outbound_prompt_resolution import RESOLUTION_SYSTEM_PROMPT, RESOLUTION_FIRST_TURN_GREETING
    from .schemes import evaluate_scheme_eligibility, get_document_checklist, get_available_schemes
    from .escalation import create_escalation as _create_escalation, get_escalation_status as _get_escalation_status


logger = logging.getLogger("agent")

load_dotenv(".env.local")


class Assistant(Agent):
    """Voice AI agent for Cyber Suraksha Kendra with caller database tools and financial scheme eligibility checking."""

    def __init__(self) -> None:
        init_db()
        super().__init__(instructions=SYSTEM_PROMPT)

    @function_tool
    async def lookup_caller(self, ctx: RunContext, user_id: str) -> str:
        """Look up a caller's saved record and facts from the database using their unique user ID or phone number.

        Args:
            user_id: Unique caller user ID or phone number.
        """
        record = get_caller(user_id)
        if not record:
            return json.dumps({
                "status": "not_found",
                "message": "New caller, no previous interaction record found.",
            })
        return json.dumps({"status": "success", "caller_data": record})

    @function_tool
    async def save_caller_info(
        self,
        ctx: RunContext,
        user_id: str,
        name: str,
        language_preference: str,
        facts: dict,
        user_consent_given: bool,
    ) -> str:
        """Save or update caller information in the SQLite database ONLY AFTER the caller gives explicit consent. Do NOT save sensitive financial credentials!

        Args:
            user_id: Unique user ID of the caller.
            name: Full name of the caller.
            language_preference: Language preference code (e.g. 'hi-IN' or 'en-IN').
            facts: Non-sensitive caller facts such as schemes_checked, payment_apps_used, fraud_awareness_topic, eligibility_answers. STRICTLY DO NOT include bank account numbers, Aadhaar/PAN IDs, UPI PINs, or OTPs.
            user_consent_given: Set to True ONLY IF the caller explicitly agreed to saving their information.
        """
        if not user_consent_given:
            call_state = ctx.session.userdata.get("call_state")
            if call_state:
                call_state["failure_type"] = "user_declined"
            return json.dumps({
                "status": "cancelled",
                "message": "User consent was not granted. Caller details were NOT saved.",
            })

        saved_record = save_caller(
            user_id=user_id,
            name=name,
            language_preference=language_preference,
            facts=facts,
        )
        call_state = ctx.session.userdata.get("call_state")
        if call_state:
            call_state["user_id"] = user_id
            call_state["caller_name"] = name
            call_state["language"] = language_preference
        return json.dumps({
            "status": "success",
            "message": f"Caller info for {name} saved successfully.",
            "record": saved_record,
        })

    @function_tool
    async def check_scheme_eligibility(
        self,
        ctx: RunContext,
        scheme_id: str,
        age: Optional[int] = None,
        annual_income: Optional[float] = None,
        occupation: Optional[str] = None,
        land_holding_hectares: Optional[float] = None,
        is_taxpayer: Optional[bool] = None,
        girl_child_age: Optional[int] = None,
    ) -> str:
        """Check user eligibility for Indian government financial schemes (PM-KISAN, PM MUDRA, Atal Pension, Sukanya Samriddhi, Ayushman Bharat) and retrieve the official document checklist.

        CALL THIS TOOL WHEN:
        1. The user asks if they or a family member qualify for a financial scheme (e.g., "क्या मैं PM Kisan के लिए eligible हूँ?", "PM Mudra loan कैसे मिलेगा?").
        2. The user provides details like age, income, occupation, land ownership, or daughter's age to check scheme eligibility.
        3. The user requests a document checklist or required papers to apply for a scheme.

        DO NOT CALL THIS TOOL FOR:
        - General bank transfers, UPI PIN queries, or fraud helpline questions.

        Args:
            scheme_id: Scheme ID code. Must be one of: 'pm_kisan', 'pm_mudra', 'atal_pension', 'sukanya_samriddhi', 'ayushman_bharat'.
            age: Age of the applicant in years (optional).
            annual_income: Total family annual income in INR (optional).
            occupation: Current job/occupation (e.g. 'farmer', 'shopkeeper', 'daily_wager', 'unorganized_worker') (optional).
            land_holding_hectares: Cultivable land ownership in hectares for farmer schemes (optional).
            is_taxpayer: Whether the applicant pays income tax (optional).
            girl_child_age: Age of girl child for Sukanya Samriddhi Yojana (optional).
        """
        try:
            result = evaluate_scheme_eligibility(
                scheme_id=scheme_id,
                age=age,
                annual_income=annual_income,
                occupation=occupation,
                land_holding_hectares=land_holding_hectares,
                is_taxpayer=is_taxpayer,
                girl_child_age=girl_child_age,
            )
            # Update call analytics outcome
            call_state = ctx.session.userdata.get("call_state")
            if call_state and result.get("status") == "success":
                call_state["outcome"] = "success"
                call_state["failure_type"] = "none"
                call_state["track_outcome"] = "eligibility_check_completed"
                call_state["scheme_checked"] = scheme_id
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error evaluating scheme eligibility for {scheme_id}: {e}")
            call_state = ctx.session.userdata.get("call_state")
            if call_state:
                call_state["outcome"] = "failed"
                call_state["failure_type"] = "tool_failure"
            # Failure path out loud handling
            return json.dumps({
                "status": "error",
                "error_type": "internal_error",
                "data_as_of": "August 2026",
                "spoken_failure_message": f"माफ़ कीजिए, अभी स्कीम डेटाबेस से कनेक्ट करने में दिक्कत आ रही है। कृपया कुछ देर बाद फिर से पूछें।",
                "message": str(e),
            }, ensure_ascii=False)

    @function_tool
    async def get_scheme_document_checklist(
        self,
        ctx: RunContext,
        scheme_id: str,
    ) -> str:
        """Get the required document checklist for a specific financial scheme (PM-KISAN, PM MUDRA, Atal Pension, Sukanya Samriddhi, Ayushman Bharat).

        CALL THIS TOOL WHEN:
        - The user asks specifically about what documents, proofs, or papers are needed to apply for a scheme.

        Args:
            scheme_id: Scheme ID code ('pm_kisan', 'pm_mudra', 'atal_pension', 'sukanya_samriddhi', 'ayushman_bharat').
        """
        try:
            result = get_document_checklist(scheme_id=scheme_id)
            call_state = ctx.session.userdata.get("call_state")
            if call_state and result.get("status") == "success":
                call_state["outcome"] = "success"
                call_state["failure_type"] = "none"
                call_state["track_outcome"] = "document_checklist_received"
                call_state["scheme_checked"] = scheme_id
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error fetching document checklist for {scheme_id}: {e}")
            call_state = ctx.session.userdata.get("call_state")
            if call_state:
                call_state["outcome"] = "failed"
                call_state["failure_type"] = "tool_failure"
            return json.dumps({
                "status": "error",
                "data_as_of": "August 2026",
                "spoken_failure_message": f"माफ़ कीजिए, {scheme_id} के डॉक्यूमेंट लिस्ट सर्वर से नहीं मिल पाए हैं।",
                "message": str(e),
            }, ensure_ascii=False)


    @function_tool
    async def mark_deadline_alert_sent(
        self,
        ctx: RunContext,
        user_id: str,
        scheme_id: str,
    ) -> str:
        """Mark in the database that the outbound deadline alert was successfully delivered for this caller and scheme.

        ALWAYS CALL THIS at the end of an outbound deadline-alert call before hanging up.

        Args:
            user_id: The unique user ID of the caller who received the alert.
            scheme_id: The scheme ID for which the deadline alert was delivered (e.g. 'pm_kisan').
        """
        try:
            updated = mark_deadline_alert_dispatched(user_id=user_id, scheme_id=scheme_id)
            call_state = ctx.session.userdata.get("call_state")
            if call_state and updated:
                call_state["outcome"] = "success"
                call_state["failure_type"] = "none"
                call_state["track_outcome"] = "deadline_alert_delivered"
                call_state["scheme_checked"] = scheme_id
            if updated:
                return json.dumps({
                    "status": "success",
                    "message": f"Deadline alert marked as delivered for user_id={user_id}, scheme={scheme_id}.",
                })
            return json.dumps({
                "status": "not_found",
                "message": f"No pending deadline alert found for user_id={user_id}. Record may not exist or was already dispatched.",
            })
        except Exception as e:
            logger.error(f"Error marking deadline alert dispatched for {user_id}: {e}")
            return json.dumps({"status": "error", "message": str(e)})

    # -------------------------------------------------------------------------
    # Escalation Tools
    # -------------------------------------------------------------------------

    @function_tool
    async def create_escalation(
        self,
        ctx: RunContext,
        user_id: str,
        caller_name: str,
        issue_category: str,
        issue_summary: str,
        what_agent_checked: str,
        urgency: str,
        caller_consent_given: bool,
        language: str = "hi-IN",
        follow_up_method: str = "call",
        sip_uri: str = "",
    ) -> str:
        """Create a human escalation request when the agent cannot resolve the caller's issue alone."""
        call_state = ctx.session.userdata.get("call_state")
        if not caller_consent_given:
            if call_state:
                call_state["failure_type"] = "user_declined"
            return json.dumps({
                "status": "cancelled",
                "message": "Caller did not give consent. Escalation was NOT created. Please inform the caller and offer alternatives.",
            })

        try:
            result = _create_escalation(
                user_id=user_id,
                caller_name=caller_name,
                language=language,
                follow_up_method=follow_up_method,
                issue_category=issue_category,
                issue_summary=issue_summary,
                what_agent_checked=what_agent_checked,
                urgency=urgency,
                sip_uri=sip_uri,
            )
            esc_id = result["id"]
            is_dup = result["is_duplicate"]

            if call_state:
                call_state["outcome"] = "success"
                call_state["failure_type"] = "none"
                call_state["track_outcome"] = "escalation_created"
                call_state["user_id"] = user_id
                call_state["caller_name"] = caller_name

            spoken = (
                f"आपकी request register हो गई है। Reference ID है: {esc_id}। "
                "एक human agent जल्द ही आपसे संपर्क करेगा। "
                "इस ID को संभालकर रखें — आप इससे अपनी request का status check कर सकते हैं।"
            )
            if is_dup:
                spoken = (
                    f"आपकी पहले से एक open request है (ID: {esc_id})। "
                    "हमने उसे नई जानकारी के साथ update कर दिया है। "
                    "एक human agent जल्द आपसे संपर्क करेगा।"
                )

            logger.info(
                "📋 Escalation %s | user=%s | urgency=%s | duplicate=%s",
                esc_id, user_id, urgency, is_dup,
            )
            return json.dumps({
                "status": "success",
                "escalation_id": esc_id,
                "urgency": urgency,
                "is_duplicate": is_dup,
                "spoken_message": spoken,
            }, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error creating escalation for {user_id}: {e}")
            if call_state:
                call_state["failure_type"] = "tool_failure"
            return json.dumps({
                "status": "error",
                "spoken_message": "माफ़ कीजिए, अभी request register करने में दिक्कत आ रही है। कृपया 1930 पर call करें या थोड़ी देर बाद retry करें।",
                "message": str(e),
            }, ensure_ascii=False)

    @function_tool
    async def check_escalation_status(
        self,
        ctx: RunContext,
        escalation_id: str,
    ) -> str:
        """Check the status of an existing human escalation request by its reference ID.

        CALL THIS TOOL WHEN:
        - A returning caller asks 'What happened to my complaint?' or provides a reference ID.

        Args:
            escalation_id: The 8-character reference ID given to the caller when the request was created.
        """
        try:
            result = _get_escalation_status(escalation_id)
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error checking escalation status for {escalation_id}: {e}")
            return json.dumps({
                "status": "error",
                "spoken_message": f"माफ़ कीजिए, ID {escalation_id} की status check करने में दिक्कत आ रही है। कृपया थोड़ी देर बाद retry करें।",
                "message": str(e),
            }, ensure_ascii=False)


server = AgentServer()


def prewarm(proc: JobProcess):
    proc.userdata["vad"] = silero.VAD.load()


server.setup_fnc = prewarm


@server.rtc_session(agent_name="my-agent")
async def my_agent(ctx: JobContext):
    # Logging setup
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }

    # -------------------------------------------------------------------------
    # Outbound Call Detection
    # If this job was dispatched by outbound_call.py, it will carry a JSON
    # metadata payload. We detect the call type and switch the system prompt
    # and first-turn greeting to the outbound deadline-alert variant.
    # -------------------------------------------------------------------------
    call_metadata: dict = {}
    is_outbound_deadline_alert = False

    if ctx.job.metadata:
        try:
            call_metadata = json.loads(ctx.job.metadata)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Could not parse job metadata as JSON: %s", ctx.job.metadata)

    if call_metadata.get("call_type") == "outbound_deadline_alert":
        is_outbound_deadline_alert = True
        caller_name = call_metadata.get("caller_name", "")
        scheme_name = call_metadata.get("scheme_name", "")
        deadline = call_metadata.get("deadline", "")
        outbound_user_id = call_metadata.get("user_id", "")

        agent_instructions = OUTBOUND_SYSTEM_PROMPT.format(
            caller_name=caller_name,
            scheme_name=scheme_name,
            deadline=deadline,
        )
        first_greeting = OUTBOUND_FIRST_TURN_GREETING.format(
            caller_name=caller_name,
            scheme_name=scheme_name,
            deadline=deadline,
        )
        logger.info(
            "📞 OUTBOUND DEADLINE ALERT call | user=%s | scheme=%s | deadline=%s",
            outbound_user_id,
            scheme_name,
            deadline,
        )
    elif call_metadata.get("call_type") == "escalation_resolved":
        is_outbound_deadline_alert = True  # treat as outbound so we speak first
        escalation_id = call_metadata.get("escalation_id", "")
        caller_name = call_metadata.get("caller_name", "")
        issue_category = call_metadata.get("issue_category", "")
        outbound_user_id = call_metadata.get("user_id", "")

        agent_instructions = RESOLUTION_SYSTEM_PROMPT.format(
            caller_name=caller_name,
            escalation_id=escalation_id,
            issue_category=issue_category,
        )
        first_greeting = RESOLUTION_FIRST_TURN_GREETING.format(
            caller_name=caller_name,
            escalation_id=escalation_id,
            issue_category=issue_category,
        )
        logger.info(
            "🔔 RESOLUTION CALLBACK call | user=%s | escalation=%s | category=%s",
            outbound_user_id,
            escalation_id,
            issue_category,
        )
    else:
        # Default: inbound call
        agent_instructions = SYSTEM_PROMPT
        first_greeting = FIRST_TURN_GREETING
        logger.info("📥 INBOUND call | room=%s", ctx.room.name)

    # Set up a voice AI pipeline using Murf Falcon, Gemini, Deepgram, and the LiveKit turn detector
    session = AgentSession(
        # Speech-to-text (STT) is your agent's ears, turning the user's speech into text that the LLM can understand
        # See all available models at https://docs.livekit.io/agents/models/stt/
        stt=deepgram.STT(model="nova-3", language="multi"),
        # A Large Language Model (LLM) is your agent's brain, processing user input and generating a response
        # See all available models at https://docs.livekit.io/agents/models/llm/
        llm=google.LLM(
            model="gemini-3.5-flash",
        ),
        # Text-to-speech (TTS) is your agent's voice, turning the LLM's text into speech that the user can hear
        # See all available models as well as voice selections at https://docs.livekit.io/agents/models/tts/
        tts=murf.TTS(
            voice="Anisha",
            locale="hi-IN",
            style="Conversational",
            tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
            text_pacing=True,
        ),
        # VAD and turn detection are used to determine when the user is speaking and when the agent should respond
        turn_detection=MultilingualModel(),
        vad=ctx.proc.userdata["vad"],
        # Allow the LLM to generate a response while waiting for the end of turn
        preemptive_generation=True,
        userdata={},
    )

    @session.on("user_input_transcribed")
    def on_user_input_transcribed(ev: UserInputTranscribedEvent):
        transcript = getattr(ev, "transcript", "")
        has_devanagari = any("\u0900" <= char <= "\u097F" for char in transcript)

        if has_devanagari:
            session.tts = murf.TTS(
                voice="Anisha",
                locale="hi-IN",
                style="Conversational",
                tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
                text_pacing=True,
            )
        else:
            session.tts = murf.TTS(
                voice="Anisha",
                locale="en-IN",
                style="Conversational",
                tokenizer=tokenize.basic.SentenceTokenizer(min_sentence_len=2),
                text_pacing=True,
            )

    # Start the session, which initializes the voice pipeline and warms up the models
    # For outbound calls the agent_instructions are the outbound deadline-alert prompt;
    # for inbound calls they are the regular SYSTEM_PROMPT.
    agent = Assistant()
    agent._instructions = agent_instructions  # Override with the call-type-specific prompt

    await session.start(
        agent=agent,
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: (
                    noise_cancellation.BVCTelephony()
                    if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP
                    else noise_cancellation.BVC()
                ),
            ),
        ),
    )

    # Join the room and connect to the user
    await ctx.connect()

    # For outbound calls: speak the first-turn greeting immediately after connecting
    # (Anjali initiates — she called them, not the other way around)
    if is_outbound_deadline_alert:
        await session.say(first_greeting, allow_interruptions=True)

    # -------------------------------------------------------------------------
    # Call Analytics & Latency Tracking
    # -------------------------------------------------------------------------
    start_time = datetime.now(timezone.utc)
    first_stt_time: Optional[datetime] = None
    first_tts_time: Optional[datetime] = None
    call_state = {
        "outcome": "failed",
        "failure_type": "incomplete_task",
        "track_outcome": "none",
        "scheme_checked": "",
        "user_id": call_metadata.get("user_id", "anonymous"),
        "caller_name": call_metadata.get("caller_name", "Guest Caller"),
        "language": "hi-IN",
        "channel": "sip" if is_outbound_deadline_alert else "browser",
    }

    # Detect SIP participant channel dynamically
    for p in ctx.room.remote_participants.values():
        if p.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP:
            call_state["channel"] = "sip"

    # Store state on session for tools to update
    session.userdata["call_state"] = call_state

    @session.on("user_input_transcribed")
    def on_stt_transcribed(ev: UserInputTranscribedEvent):
        nonlocal first_stt_time
        if first_stt_time is None:
            first_stt_time = datetime.now(timezone.utc)

    @session.on("agent_speech_started")
    def on_agent_speech_started(ev: Any):
        nonlocal first_tts_time
        if first_tts_time is None:
            first_tts_time = datetime.now(timezone.utc)

    @session.on("close")
    def on_session_close(ev: Any = None):
        end_time = datetime.now(timezone.utc)
        duration = int((end_time - start_time).total_seconds())

        latency_ms = 0
        if first_stt_time and first_tts_time and first_tts_time >= first_stt_time:
            latency_ms = int((first_tts_time - first_stt_time).total_seconds() * 1000)

        # Log call to SQLite
        try:
            log_call(
                room_name=ctx.room.name,
                user_id=call_state["user_id"],
                caller_name=call_state["caller_name"],
                channel=call_state["channel"],
                language=call_state["language"],
                outcome=call_state["outcome"],
                failure_type=call_state["failure_type"],
                track_outcome=call_state["track_outcome"],
                scheme_checked=call_state["scheme_checked"],
                latency_ms=latency_ms,
                duration_seconds=duration,
            )
            logger.info("📊 Logged Call Analytics for room=%s | outcome=%s | track=%s | latency=%dms",
                        ctx.room.name, call_state["outcome"], call_state["track_outcome"], latency_ms)
        except Exception as err:
            logger.error("Failed to log call analytics for room %s: %s", ctx.room.name, err)


if __name__ == "__main__":
    cli.run_app(server)
