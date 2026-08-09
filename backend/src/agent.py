import json
import logging

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
except ImportError:
    from .db import get_caller, init_db, save_caller
    from .Prompt import SYSTEM_PROMPT


logger = logging.getLogger("agent")

load_dotenv(".env.local")


class Assistant(Agent):
    """Voice AI agent for Cyber Suraksha Kendra with caller database tools."""

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
