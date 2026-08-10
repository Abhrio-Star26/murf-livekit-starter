import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("schemes")

DATA_FILE = Path(__file__).parent / "schemes_data.json"


def load_schemes_data() -> Dict[str, Any]:
    """Load scheme data from local dataset with error/fallback handling."""
    if not DATA_FILE.exists():
        logger.error(f"Schemes data file not found at {DATA_FILE}")
        return {"data_as_of": "August 2026", "source": "Unavailable", "schemes": []}
    
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to parse schemes_data.json: {e}")
        return {"data_as_of": "August 2026", "source": "Unavailable", "schemes": []}


def get_available_schemes() -> List[Dict[str, str]]:
    """Return a summary list of all supported schemes."""
    data = load_schemes_data()
    return [
        {
            "scheme_id": s["scheme_id"],
            "name_en": s["name_en"],
            "name_hi": s["name_hi"],
            "category": s.get("category", ""),
        }
        for s in data.get("schemes", [])
    ]


def evaluate_scheme_eligibility(
    scheme_id: str,
    age: Optional[int] = None,
    annual_income: Optional[float] = None,
    occupation: Optional[str] = None,
    land_holding_hectares: Optional[float] = None,
    is_taxpayer: Optional[bool] = None,
    girl_child_age: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Evaluate user eligibility for a specific financial scheme based on submitted criteria.
    Returns eligibility result, reasons, required documents, data recency, and spoken failure instructions.
    """
    dataset = load_schemes_data()
    schemes = dataset.get("schemes", [])
    as_of = dataset.get("data_as_of", "August 2026")
    source = dataset.get("source", "Government Scheme Open Guidelines")

    matched_scheme = next((s for s in schemes if s["scheme_id"].lower() == scheme_id.lower()), None)
    
    # Handle failure path when scheme is not found
    if not matched_scheme:
        available_ids = [s["scheme_id"] for s in schemes]
        return {
            "status": "error",
            "error_type": "scheme_not_found",
            "message": f"Scheme '{scheme_id}' was not found in our database.",
            "available_schemes": available_ids,
            "data_as_of": as_of,
            "spoken_failure_message": f"माफ़ कीजिए, मुझे '{scheme_id}' स्कीम की जानकारी नहीं मिली। उपलब्ध स्कीमों में PM-KISAN, MUDRA, Atal Pension, Sukanya Samriddhi, और Ayushman Bharat शामिल हैं।",
        }

    rules = matched_scheme.get("eligibility", {})
    checklist = matched_scheme.get("required_documents", [])
    reasons: List[str] = []
    eligible = True

    # Rule check: Min Age
    if age is not None and "min_age" in rules:
        if age < rules["min_age"]:
            eligible = False
            reasons.append(f"Age {age} is below minimum required age of {rules['min_age']}.")

    # Rule check: Max Age
    if age is not None and "max_age" in rules:
        if age > rules["max_age"]:
            eligible = False
            reasons.append(f"Age {age} exceeds maximum limit of {rules['max_age']}.")

    # Rule check: Girl child age for Sukanya Samriddhi
    if girl_child_age is not None and "girl_child_max_age" in rules:
        if girl_child_age > rules["girl_child_max_age"]:
            eligible = False
            reasons.append(f"Girl child age {girl_child_age} exceeds maximum limit of {rules['girl_child_max_age']} years.")

    # Rule check: Max annual income
    if annual_income is not None and "max_annual_income" in rules:
        if annual_income > rules["max_annual_income"]:
            eligible = False
            reasons.append(f"Annual income ₹{annual_income:,.0f} exceeds max limit of ₹{rules['max_annual_income']:,.0f}.")

    # Rule check: Max landholding
    if land_holding_hectares is not None and "max_landholding_hectares" in rules:
        if land_holding_hectares > rules["max_landholding_hectares"]:
            eligible = False
            reasons.append(f"Landholding {land_holding_hectares} hectares exceeds max threshold of {rules['max_landholding_hectares']} hectares.")

    # Rule check: Taxpayer exclusion
    if is_taxpayer is True and "taxpayer" in rules.get("exclusions", []):
        eligible = False
        reasons.append("Income tax payers are excluded from this scheme.")

    # Rule check: Occupation matching
    if occupation and "occupations" in rules and "any" not in rules["occupations"]:
        occ_clean = occupation.lower().strip()
        matching_occs = [o.lower() for o in rules["occupations"]]
        if not any(req_occ in occ_clean or occ_clean in req_occ for req_occ in matching_occs):
            # Soft warning rather than immediate hard disqualification if occupation is broad
            reasons.append(f"Occupation '{occupation}' may require verification against target group ({', '.join(rules['occupations'])}).")

    status_str = "eligible" if eligible else "ineligible"

    return {
        "status": "success",
        "eligibility_result": status_str,
        "is_eligible": eligible,
        "scheme_id": matched_scheme["scheme_id"],
        "scheme_name": matched_scheme["name_hi"],
        "scheme_name_en": matched_scheme["name_en"],
        "benefits": matched_scheme["benefits_summary"],
        "evaluation_reasons": reasons,
        "document_checklist": checklist,
        "official_portal": matched_scheme.get("official_portal", ""),
        "data_as_of": as_of,
        "data_source": source,
    }


def get_document_checklist(scheme_id: str) -> Dict[str, Any]:
    """Fetch the official document checklist for a specific scheme."""
    dataset = load_schemes_data()
    schemes = dataset.get("schemes", [])
    as_of = dataset.get("data_as_of", "August 2026")

    matched_scheme = next((s for s in schemes if s["scheme_id"].lower() == scheme_id.lower()), None)
    
    if not matched_scheme:
        return {
            "status": "error",
            "message": f"Scheme '{scheme_id}' not found.",
            "data_as_of": as_of,
            "spoken_failure_message": f"माफ़ कीजिए, मुझे '{scheme_id}' की डॉक्यूमेंट लिस्ट नहीं मिली।",
        }

    return {
        "status": "success",
        "scheme_id": matched_scheme["scheme_id"],
        "scheme_name": matched_scheme["name_hi"],
        "scheme_name_en": matched_scheme["name_en"],
        "required_documents": matched_scheme.get("required_documents", []),
        "official_portal": matched_scheme.get("official_portal", ""),
        "data_as_of": as_of,
    }
