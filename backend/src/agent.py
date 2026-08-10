import json
import logging
from typing import Optional

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
    from db import get_caller, init_db, save_caller
    from Prompt import SYSTEM_PROMPT
    from schemes import evaluate_scheme_eligibility, get_document_checklist, get_available_schemes
except ImportError:
    from .db import get_caller, init_db, save_caller
    from .Prompt import SYSTEM_PROMPT
    from .schemes import evaluate_scheme_eligibility, get_document_checklist, get_available_schemes


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
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error evaluating scheme eligibility for {scheme_id}: {e}")
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
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error fetching document checklist for {scheme_id}: {e}")
            return json.dumps({
                "status": "error",
                "data_as_of": "August 2026",
                "spoken_failure_message": f"माफ़ कीजिए, {scheme_id} के डॉक्यूमेंट लिस्ट सर्वर से नहीं मिल पाए हैं।",
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
    await session.start(
        agent=Assistant(),
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


if __name__ == "__main__":
    cli.run_app(server)
