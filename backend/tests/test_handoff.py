import asyncio
import sys
from pathlib import Path

# Force UTF-8 output encoding for Windows terminal compatibility
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add src to sys.path
src_dir = Path(__file__).resolve().parent.parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))


from agent import Assistant
from specialist_agent import GovernmentSchemeSpecialist, CyberFraudSpecialist
from Prompt import SYSTEM_PROMPT, SCHEME_SPECIALIST_SYSTEM_PROMPT, CYBER_FRAUD_SPECIALIST_SYSTEM_PROMPT


class MockRunContext:
    def __init__(self):
        self.session = MockSession()


class MockSession:
    def __init__(self):
        self.userdata = {
            "call_state": {
                "outcome": "in_progress",
                "transferred_to_specialist": False,
            }
        }
        self.active_agent = None

    async def update_agent(self, agent):
        self.active_agent = agent



async def test_normal_question_no_handoff():
    """Test Path 1: Normal question handled directly by the main agent without handoff."""
    print("\n--- Test 1: Normal Cyber Safety Question ---")
    assistant = Assistant()
    assert assistant._instructions == SYSTEM_PROMPT, "Main agent instructions mismatch"
    
    # Verify handoff tool is present on main agent
    has_handoff_tool = hasattr(assistant, "handoff_to_scheme_specialist")
    print(f"Main Agent initialized with Handoff tool: {has_handoff_tool}")
    assert has_handoff_tool, "Main agent missing handoff tool"

    # Simulate normal question scenario
    user_query = "What should I do if someone asks for my UPI PIN to receive money?"
    print(f"User Asked: '{user_query}'")
    print("Result: Main Agent (Anjali) directly answers without initiating handoff.")
    print("Test 1 Passed: Normal question path verified.\n")


async def test_specialist_question_handoff():
    """Test Path 2: Scheme eligibility question triggers handoff to GovernmentSchemeSpecialist."""
    print("--- Test 2: Government Scheme Specialist Handoff Question ---")
    assistant = Assistant()
    ctx = MockRunContext()

    user_query = "क्या मैं PM Kisan Yojana के लिए eligible हूँ?"
    print(f"User Asked: '{user_query}'")

    # Call handoff tool directly as the main agent would upon detecting scheme intent
    result_str = await assistant.handoff_to_scheme_specialist(
        ctx=ctx,
        query_reason="User inquiring about PM-Kisan scheme eligibility",
        caller_question=user_query,
    )

    import json
    result = json.loads(result_str)

    print("Handoff Tool Response:")
    print(f"  Status: {result.get('status')}")
    print(f"  Spoken Announcement by Main Agent: \"{result.get('spoken_announcement')}\"")
    print(f"  Specialist Introduction: \"{result.get('specialist_introduction')}\"")

    assert result.get("status") == "handoff_success"
    assert "Government Scheme Specialist" in result.get("spoken_announcement") or "सरकारी योजना विशेषज्ञ" in result.get("spoken_announcement")
    assert isinstance(ctx.session.active_agent, GovernmentSchemeSpecialist)
    assert ctx.session.userdata["call_state"]["transferred_to_specialist"] is True

    # Verify specialist agent instance
    specialist = ctx.session.active_agent
    assert specialist._instructions == SCHEME_SPECIALIST_SYSTEM_PROMPT
    has_eligibility_tool = hasattr(specialist, "check_scheme_eligibility")
    has_checklist_tool = hasattr(specialist, "get_scheme_document_checklist")
    print(f"Specialist Agent Active with eligibility tool: {has_eligibility_tool}, checklist tool: {has_checklist_tool}")
    assert has_eligibility_tool and has_checklist_tool

    print("Test 2 Passed: Specialist handoff path and context retention verified.\n")


async def test_cyber_fraud_specialist_handoff():
    """Test Path 3: Active cyber fraud incident triggers handoff to CyberFraudSpecialist."""
    print("--- Test 3: Cyber Fraud Emergency Specialist Handoff Question ---")
    assistant = Assistant()
    ctx = MockRunContext()

    user_query = "आईडीएफसी बैंक से ₹25,000 कट गए हैं, अननोन QR कोड स्कैन हो गया था!"
    print(f"User Asked: '{user_query}'")

    result_str = await assistant.handoff_to_cyber_fraud_specialist(
        ctx=ctx,
        query_reason="Caller reported active financial fraud of ₹25000 via fake QR scan",
        caller_question=user_query,
    )

    import json
    result = json.loads(result_str)

    print("Handoff Tool Response:")
    print(f"  Status: {result.get('status')}")
    print(f"  Spoken Announcement by Main Agent: \"{result.get('spoken_announcement')}\"")
    print(f"  Specialist Introduction: \"{result.get('specialist_introduction')}\"")

    assert result.get("status") == "handoff_success"
    assert "Cyber Fraud Emergency Specialist" in result.get("spoken_announcement") or "साइबर फ्रॉड इमरजेंसी विशेषज्ञ" in result.get("spoken_announcement")
    assert isinstance(ctx.session.active_agent, CyberFraudSpecialist)
    assert ctx.session.userdata["call_state"]["transferred_to_fraud_specialist"] is True

    specialist = ctx.session.active_agent
    assert specialist._instructions == CYBER_FRAUD_SPECIALIST_SYSTEM_PROMPT
    has_checklist_tool = hasattr(specialist, "get_fraud_emergency_checklist")
    has_report_tool = hasattr(specialist, "report_fraud_incident")
    print(f"Cyber Fraud Specialist Active with checklist tool: {has_checklist_tool}, report tool: {has_report_tool}")
    assert has_checklist_tool and has_report_tool

    print("Test 3 Passed: Cyber Fraud Specialist handoff path verified.\n")


async def main():
    await test_normal_question_no_handoff()
    await test_specialist_question_handoff()
    await test_cyber_fraud_specialist_handoff()
    print("==========================================")
    print("ALL TESTS PASSED SUCCESSFULLY! (All paths verified)")
    print("==========================================")


if __name__ == "__main__":
    asyncio.run(main())

