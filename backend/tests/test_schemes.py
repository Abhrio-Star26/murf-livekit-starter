import json
import pytest
from livekit.agents import RunContext
from unittest.mock import MagicMock

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from schemes import evaluate_scheme_eligibility, get_document_checklist, load_schemes_data
from agent import Assistant


def test_load_schemes_data():
    data = load_schemes_data()
    assert "schemes" in data
    assert len(data["schemes"]) >= 5
    assert data.get("data_as_of") == "August 2026"


def test_pm_kisan_eligibility_eligible():
    result = evaluate_scheme_eligibility(
        scheme_id="pm_kisan",
        age=35,
        occupation="farmer",
        land_holding_hectares=1.5,
        is_taxpayer=False,
    )
    assert result["status"] == "success"
    assert result["is_eligible"] is True
    assert result["data_as_of"] == "August 2026"
    assert len(result["document_checklist"]) > 0


def test_pm_kisan_eligibility_taxpayer_ineligible():
    result = evaluate_scheme_eligibility(
        scheme_id="pm_kisan",
        age=35,
        occupation="farmer",
        land_holding_hectares=1.5,
        is_taxpayer=True,
    )
    assert result["status"] == "success"
    assert result["is_eligible"] is False
    assert any("tax" in r.lower() for r in result["evaluation_reasons"])


def test_sukanya_samriddhi_eligibility():
    result = evaluate_scheme_eligibility(
        scheme_id="sukanya_samriddhi",
        girl_child_age=6,
    )
    assert result["status"] == "success"
    assert result["is_eligible"] is True

    ineligible_result = evaluate_scheme_eligibility(
        scheme_id="sukanya_samriddhi",
        girl_child_age=12,
    )
    assert ineligible_result["is_eligible"] is False


def test_failure_path_unknown_scheme():
    result = evaluate_scheme_eligibility(scheme_id="non_existent_scheme")
    assert result["status"] == "error"
    assert "spoken_failure_message" in result
    assert result["data_as_of"] == "August 2026"


def test_get_document_checklist():
    result = get_document_checklist("pm_mudra")
    assert result["status"] == "success"
    assert len(result["required_documents"]) >= 3
    assert result["data_as_of"] == "August 2026"


@pytest.mark.asyncio
async def test_agent_tool_check_scheme_eligibility():
    agent = Assistant()
    mock_ctx = MagicMock(spec=RunContext)
    
    res_str = await agent.check_scheme_eligibility(
        ctx=mock_ctx,
        scheme_id="pm_kisan",
        age=40,
        occupation="farmer",
        land_holding_hectares=1.0,
    )
    res = json.loads(res_str)
    assert res["status"] == "success"
    assert res["data_as_of"] == "August 2026"


@pytest.mark.asyncio
async def test_agent_tool_failure_path_handling():
    agent = Assistant()
    mock_ctx = MagicMock(spec=RunContext)
    
    res_str = await agent.check_scheme_eligibility(
        ctx=mock_ctx,
        scheme_id="invalid_scheme_xyz",
    )
    res = json.loads(res_str)
    assert res["status"] == "error"
    assert "spoken_failure_message" in res
