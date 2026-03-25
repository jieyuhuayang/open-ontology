"""Unit tests for SidekickLlmEngine."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.domain.sidekick import (
    GenerateContentRequest,
    SidekickContext,
    SidekickPageType,
    SuggestionSource,
)
from app.exceptions import AppError
from app.services.sidekick_llm import SidekickLlmEngine


def _make_context() -> SidekickContext:
    return SidekickContext(
        page_type=SidekickPageType.OBJECT_TYPE_DETAIL,
        entity_rid="ri.ontology.object-type.test1",
        ontology_rid="ri.ontology.ontology.default",
    )


def _mock_llm_response(suggestions_json: list[dict]) -> MagicMock:
    """Create a mock Anthropic API response."""
    content_block = MagicMock()
    content_block.text = json.dumps(suggestions_json)
    response = MagicMock()
    response.content = [content_block]
    return response


class TestAnalyze:
    @pytest.mark.asyncio
    async def test_analyze_returns_suggestions(self):
        """AC-06: LLM returns properly parsed suggestions."""
        engine = SidekickLlmEngine()
        context = _make_context()
        entity_data = {"displayName": "Customer", "description": "A customer"}
        ontology_summary = {"objectTypeCount": 5}

        mock_suggestions = [
            {
                "type": "suggest_link",
                "title": "建议添加链接到 Order",
                "description": "Customer 与 Order 可能存在关联",
                "confidence": 0.75,
                "source": "semantic_inference",
                "reasoning": "基于语义分析",
            }
        ]

        with patch.object(
            engine,
            "_call_llm",
            new_callable=AsyncMock,
            return_value=_mock_llm_response(mock_suggestions),
        ):
            with patch.object(engine, "_is_available", return_value=True):
                suggestions = await engine.analyze(context, entity_data, ontology_summary)

        assert len(suggestions) == 1
        s = suggestions[0]
        assert 0.5 <= s.confidence <= 0.9
        assert s.source == SuggestionSource.SEMANTIC_INFERENCE

    @pytest.mark.asyncio
    async def test_analyze_no_api_key(self):
        """AC-12: No API Key returns empty list without error."""
        engine = SidekickLlmEngine()
        context = _make_context()

        with patch.object(engine, "_is_available", return_value=False):
            suggestions = await engine.analyze(context, {}, {})

        assert suggestions == []

    @pytest.mark.asyncio
    async def test_analyze_llm_error(self):
        """LLM error returns empty list and logs warning."""
        engine = SidekickLlmEngine()
        context = _make_context()

        with patch.object(engine, "_is_available", return_value=True):
            with patch.object(
                engine,
                "_call_llm",
                new_callable=AsyncMock,
                side_effect=Exception("LLM timeout"),
            ):
                suggestions = await engine.analyze(context, {}, {})

        assert suggestions == []

    @pytest.mark.asyncio
    async def test_suggestion_has_required_fields(self):
        """AC-14: Each suggestion must have confidence + source + reasoning."""
        engine = SidekickLlmEngine()
        context = _make_context()

        mock_suggestions = [
            {
                "type": "naming_improvement",
                "title": "建议改名",
                "description": "更好的名称",
                "confidence": 0.6,
                "source": "best_practices",
                "reasoning": "命名约定",
            }
        ]

        with patch.object(engine, "_is_available", return_value=True):
            with patch.object(
                engine,
                "_call_llm",
                new_callable=AsyncMock,
                return_value=_mock_llm_response(mock_suggestions),
            ):
                suggestions = await engine.analyze(context, {}, {})

        for s in suggestions:
            assert s.confidence is not None
            assert s.source is not None
            assert s.reasoning is not None


class TestGenerateContent:
    @pytest.mark.asyncio
    async def test_generate_content_success(self):
        """AC-20: Generate content returns text."""
        engine = SidekickLlmEngine()
        request = GenerateContentRequest(
            content_type="description",
            entity_rid="ri.ontology.object-type.test1",
            context={"displayName": "Customer", "propertyNames": ["name", "email"]},
        )

        mock_response = MagicMock()
        content_block = MagicMock()
        content_block.text = "Customer 表示系统中的客户实体"
        mock_response.content = [content_block]

        with patch.object(engine, "_is_available", return_value=True):
            with patch.object(
                engine,
                "_call_llm",
                new_callable=AsyncMock,
                return_value=mock_response,
            ):
                result = await engine.generate_content(request)

        assert result == "Customer 表示系统中的客户实体"

    @pytest.mark.asyncio
    async def test_generate_content_no_api_key(self):
        """AC-20: No API Key raises SIDEKICK_LLM_UNAVAILABLE."""
        engine = SidekickLlmEngine()
        request = GenerateContentRequest(
            content_type="description",
            entity_rid="ri.ontology.object-type.test1",
        )

        with patch.object(engine, "_is_available", return_value=False):
            with pytest.raises(AppError) as exc_info:
                await engine.generate_content(request)

        assert exc_info.value.code == "SIDEKICK_LLM_UNAVAILABLE"
        assert exc_info.value.status_code == 503
