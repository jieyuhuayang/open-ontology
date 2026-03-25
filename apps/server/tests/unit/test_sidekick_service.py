"""Unit tests for SidekickService."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.sidekick import (
    GenerateContentRequest,
    SidekickContext,
    SidekickPageType,
    Suggestion,
    SuggestionApplyRequest,
    SuggestionSource,
    SuggestionType,
)
from app.exceptions import AppError


def _make_context() -> SidekickContext:
    return SidekickContext(
        page_type=SidekickPageType.OBJECT_TYPE_DETAIL,
        entity_rid="ri.ontology.object-type.test1",
        ontology_rid="ri.ontology.ontology.default",
    )


def _make_suggestion(
    stype: SuggestionType = SuggestionType.MISSING_DESCRIPTION,
    confidence: float = 1.0,
    requires_llm: bool = True,
) -> Suggestion:
    return Suggestion(
        id="test123",
        suggestion_type=stype,
        title="Test suggestion",
        description="Test description",
        confidence=confidence,
        confidence_level="high" if confidence >= 0.8 else "medium",
        source=SuggestionSource.COMPLETENESS_CHECK,
        reasoning="Test reasoning",
        requires_llm=requires_llm,
    )


@pytest.fixture
def service():
    session = AsyncMock()
    from app.services.sidekick_service import SidekickService

    return SidekickService(session)


class TestGetSuggestions:
    @pytest.mark.asyncio
    async def test_get_suggestions_rules_only(self, service):
        """AC-12: LLM unavailable returns only rule suggestions."""
        rule_suggestions = [_make_suggestion()]

        with (
            patch.object(
                service._rules_engine,
                "analyze",
                new_callable=AsyncMock,
                return_value=rule_suggestions,
            ),
            patch.object(service._llm_engine, "analyze", new_callable=AsyncMock, return_value=[]),
            patch.object(
                service, "_get_entity_data_for_llm", new_callable=AsyncMock, return_value={}
            ),
            patch.object(service, "_get_ontology_summary", new_callable=AsyncMock, return_value={}),
        ):
            result = await service.get_suggestions(_make_context())

        assert len(result.suggestions) == 1
        assert result.has_llm_suggestions is False

    @pytest.mark.asyncio
    async def test_get_suggestions_mixed(self, service):
        """AC-06: Rules + LLM suggestions merged, sorted by confidence desc."""
        rule_sugs = [_make_suggestion(confidence=1.0)]
        llm_sugs = [
            _make_suggestion(
                stype=SuggestionType.SUGGEST_LINK,
                confidence=0.75,
                requires_llm=False,
            )
        ]

        with (
            patch.object(
                service._rules_engine, "analyze", new_callable=AsyncMock, return_value=rule_sugs
            ),
            patch.object(
                service._llm_engine, "analyze", new_callable=AsyncMock, return_value=llm_sugs
            ),
            patch.object(service._llm_engine, "is_available", return_value=True),
            patch.object(
                service, "_get_entity_data_for_llm", new_callable=AsyncMock, return_value={}
            ),
            patch.object(service, "_get_ontology_summary", new_callable=AsyncMock, return_value={}),
        ):
            result = await service.get_suggestions(_make_context())

        assert len(result.suggestions) == 2
        assert result.has_llm_suggestions is True
        # Sorted by confidence descending
        assert result.suggestions[0].confidence >= result.suggestions[1].confidence

    @pytest.mark.asyncio
    async def test_get_suggestions_invalid_context(self, service):
        """AC-18: Invalid entityRid raises SIDEKICK_INVALID_CONTEXT."""
        with patch.object(
            service._rules_engine,
            "analyze",
            new_callable=AsyncMock,
            side_effect=AppError(code="ENTITY_NOT_FOUND", message="Not found", status_code=404),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.get_suggestions(_make_context())

            assert exc_info.value.code in {"ENTITY_NOT_FOUND", "SIDEKICK_INVALID_CONTEXT"}

    @pytest.mark.asyncio
    async def test_suggestions_sorted_by_confidence(self, service):
        """Suggestions are sorted by confidence descending."""
        sugs = [
            _make_suggestion(stype=SuggestionType.MISSING_TITLE_KEY, confidence=0.9),
            _make_suggestion(stype=SuggestionType.MISSING_DESCRIPTION, confidence=1.0),
            _make_suggestion(stype=SuggestionType.SUGGEST_LINK, confidence=0.7),
        ]

        with (
            patch.object(
                service._rules_engine, "analyze", new_callable=AsyncMock, return_value=sugs
            ),
            patch.object(service._llm_engine, "analyze", new_callable=AsyncMock, return_value=[]),
            patch.object(
                service, "_get_entity_data_for_llm", new_callable=AsyncMock, return_value={}
            ),
            patch.object(service, "_get_ontology_summary", new_callable=AsyncMock, return_value={}),
        ):
            result = await service.get_suggestions(_make_context())

        confidences = [s.confidence for s in result.suggestions]
        assert confidences == sorted(confidences, reverse=True)


class TestApplySuggestion:
    @pytest.mark.asyncio
    async def test_apply_missing_description(self, service):
        """AC-07: Accept missing_description generates + updates description."""
        request = SuggestionApplyRequest(
            suggestion_type=SuggestionType.MISSING_DESCRIPTION,
            entity_rid="ri.ontology.object-type.test1",
            action_payload=None,
        )

        mock_ot = MagicMock()
        mock_ot.display_name = "Customer"
        mock_ot.api_name = "customer"

        with (
            patch.object(
                service._ot_service, "get_by_rid", new_callable=AsyncMock, return_value=mock_ot
            ),
            patch.object(
                service._llm_engine,
                "generate_content",
                new_callable=AsyncMock,
                return_value="Generated description",
            ),
            patch.object(service, "_update_ot_description", new_callable=AsyncMock) as mock_update,
        ):
            result = await service.apply_suggestion(request)

        assert result.success is True
        mock_update.assert_called_once_with(
            "ri.ontology.object-type.test1", "Generated description"
        )

    @pytest.mark.asyncio
    async def test_apply_missing_description_with_edit(self, service):
        """AC-09: Edit mode uses user-provided description directly."""
        request = SuggestionApplyRequest(
            suggestion_type=SuggestionType.MISSING_DESCRIPTION,
            entity_rid="ri.ontology.object-type.test1",
            action_payload={"description": "User-edited description"},
        )

        with patch.object(service, "_update_ot_description", new_callable=AsyncMock) as mock_update:
            result = await service.apply_suggestion(request)

        assert result.success is True
        mock_update.assert_called_once_with(
            "ri.ontology.object-type.test1", "User-edited description"
        )

    @pytest.mark.asyncio
    async def test_apply_missing_title_key(self, service):
        """AC-08: Accept missing_title_key selects best property."""
        request = SuggestionApplyRequest(
            suggestion_type=SuggestionType.MISSING_TITLE_KEY,
            entity_rid="ri.ontology.object-type.test1",
        )

        with patch.object(service, "_apply_title_key", new_callable=AsyncMock) as mock_apply:
            mock_apply.return_value = True
            result = await service.apply_suggestion(request)

        assert result.success is True
        mock_apply.assert_called_once()

    @pytest.mark.asyncio
    async def test_apply_entity_not_found(self, service):
        """AC-19: Invalid entityRid raises ENTITY_NOT_FOUND."""
        request = SuggestionApplyRequest(
            suggestion_type=SuggestionType.MISSING_DESCRIPTION,
            entity_rid="ri.ontology.object-type.nonexistent",
        )

        mock_ot = MagicMock()
        mock_ot.display_name = "Test"
        mock_ot.api_name = "test"

        with (
            patch.object(
                service._ot_service, "get_by_rid", new_callable=AsyncMock, return_value=mock_ot
            ),
            patch.object(
                service._llm_engine,
                "generate_content",
                new_callable=AsyncMock,
                return_value="desc",
            ),
            patch.object(
                service,
                "_update_ot_description",
                new_callable=AsyncMock,
                side_effect=AppError(code="ENTITY_NOT_FOUND", message="Not found", status_code=404),
            ),
        ):
            with pytest.raises(AppError) as exc_info:
                await service.apply_suggestion(request)
            assert exc_info.value.code == "ENTITY_NOT_FOUND"


class TestGenerateContent:
    @pytest.mark.asyncio
    async def test_generate_content_success(self, service):
        """AC-20: Generate content delegates to LlmEngine."""
        request = GenerateContentRequest(
            content_type="description",
            entity_rid="ri.ontology.object-type.test1",
            context={"displayName": "Customer"},
        )

        with patch.object(
            service._llm_engine,
            "generate_content",
            new_callable=AsyncMock,
            return_value="Generated content",
        ):
            result = await service.generate_content(request)

        assert result.content == "Generated content"
