import json
import logging
from typing import Optional
from livekit.agents import Agent, function_tool, RunContext

try:
    from Prompt import SCHEME_SPECIALIST_SYSTEM_PROMPT, CYBER_FRAUD_SPECIALIST_SYSTEM_PROMPT
    from schemes import evaluate_scheme_eligibility, get_document_checklist
except ImportError:
    from .Prompt import SCHEME_SPECIALIST_SYSTEM_PROMPT, CYBER_FRAUD_SPECIALIST_SYSTEM_PROMPT
    from .schemes import evaluate_scheme_eligibility, get_document_checklist

logger = logging.getLogger("specialist_agent")


class GovernmentSchemeSpecialist(Agent):
    """Specialist Agent focused strictly on Indian government financial schemes eligibility and document checklists."""

    def __init__(self) -> None:
        super().__init__(instructions=SCHEME_SPECIALIST_SYSTEM_PROMPT)

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
        """Check user eligibility for Indian government financial schemes (PM-KISAN, PM MUDRA, Atal Pension, Sukanya Samriddhi, Ayushman Bharat).

        Args:
            scheme_id: Scheme ID code ('pm_kisan', 'pm_mudra', 'atal_pension', 'sukanya_samriddhi', 'ayushman_bharat').
            age: Age of the applicant in years (optional).
            annual_income: Total family annual income in INR (optional).
            occupation: Current job/occupation (optional).
            land_holding_hectares: Cultivable land ownership in hectares (optional).
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
            call_state = ctx.session.userdata.get("call_state")
            if call_state and result.get("status") == "success":
                call_state["outcome"] = "success"
                call_state["failure_type"] = "none"
                call_state["track_outcome"] = "eligibility_check_completed"
                call_state["scheme_checked"] = scheme_id
            return json.dumps(result, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Specialist error evaluating scheme eligibility for {scheme_id}: {e}")
            return json.dumps({
                "status": "error",
                "spoken_failure_message": "माफ़ कीजिए, अभी सरकारी स्कीम डेटाबेस से कनेक्ट करने में दिक्कत आ रही है।",
                "message": str(e),
            }, ensure_ascii=False)

    @function_tool
    async def get_scheme_document_checklist(
        self,
        ctx: RunContext,
        scheme_id: str,
    ) -> str:
        """Get the required document checklist for a specific financial scheme.

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
            logger.error(f"Specialist error fetching document checklist for {scheme_id}: {e}")
            return json.dumps({
                "status": "error",
                "spoken_failure_message": f"माफ़ कीजिए, {scheme_id} के डॉक्यूमेंट लिस्ट सर्वर से नहीं मिल पाए हैं।",
                "message": str(e),
            }, ensure_ascii=False)


class CyberFraudSpecialist(Agent):
    """Specialist Agent focused strictly on cyber fraud incident response, emergency mitigation, and helpline guidance."""

    def __init__(self) -> None:
        super().__init__(instructions=CYBER_FRAUD_SPECIALIST_SYSTEM_PROMPT)

    @function_tool
    async def get_fraud_emergency_checklist(
        self,
        ctx: RunContext,
        fraud_type: str,
    ) -> str:
        """Get the immediate emergency steps to take when a cyber fraud incident occurs.

        Args:
            fraud_type: Type of fraud ('upi_qr_scam', 'unauthorized_debit', 'otp_phishing', 'sim_swap', 'part_time_job_scam', 'fake_customer_care').
        """
        checklist = {
            "status": "success",
            "fraud_type": fraud_type,
            "immediate_steps": [
                "1. Call National Cyber Crime Helpline 1930 immediately to report financial loss.",
                "2. Call your bank customer care to block your debit/credit card, UPI, and net banking.",
                "3. File a formal cyber complaint online at https://cybercrime.gov.in within 24 hours.",
                "4. Save transaction reference numbers, SMS screenshots, and scammer phone numbers as evidence.",
            ],
            "official_helpline": "1930",
            "official_portal": "https://cybercrime.gov.in",
            "spoken_summary": "तुरंत 1930 साइबर हेल्पलाइन पर कॉल करें और अपने बैंक को बोलकर कार्ड/UPI ब्लॉक करवाएं।",
        }
        call_state = ctx.session.userdata.get("call_state")
        if call_state:
            call_state["outcome"] = "success"
            call_state["track_outcome"] = "fraud_emergency_guidance_provided"
            call_state["fraud_type"] = fraud_type
        return json.dumps(checklist, ensure_ascii=False)

    @function_tool
    async def report_fraud_incident(
        self,
        ctx: RunContext,
        user_id: str,
        fraud_type: str,
        amount_lost: Optional[str] = None,
        payment_method: Optional[str] = None,
        incident_details: Optional[str] = None,
        consent_given: bool = False,
    ) -> str:
        """Record non-sensitive details of a reported cyber fraud incident to assist the caller.

        Args:
            user_id: Unique caller ID or phone identifier.
            fraud_type: Category of fraud reported.
            amount_lost: Approximate financial loss amount in INR (optional).
            payment_method: Payment mode involved e.g. 'UPI', 'NetBanking', 'CreditCard' (optional).
            incident_details: Brief plain-language description without PINs/OTPs/Passwords.
            consent_given: Set to True only if caller explicitly agreed to logging the incident.
        """
        if not consent_given:
            return json.dumps({
                "status": "cancelled",
                "message": "Caller consent was not provided. Incident was not recorded.",
            })

        call_state = ctx.session.userdata.get("call_state")
        if call_state:
            call_state["user_id"] = user_id
            call_state["fraud_reported"] = True
            call_state["fraud_type"] = fraud_type
            call_state["amount_lost"] = amount_lost or "unspecified"
            call_state["outcome"] = "success"
            call_state["track_outcome"] = "fraud_incident_reported"

        logger.info(
            "🚨 Cyber Fraud Incident Logged | user=%s | type=%s | amount=%s",
            user_id, fraud_type, amount_lost,
        )
        return json.dumps({
            "status": "success",
            "message": "Cyber fraud incident details successfully recorded. Immediate helpline reporting advised.",
            "helpline": "1930",
            "spoken_confirmation": "मैंने आपकी फ्रॉड रिपोर्ट रिकॉर्ड कर ली है। अब तुरंत 1930 पर कॉल करें।",
        }, ensure_ascii=False)

