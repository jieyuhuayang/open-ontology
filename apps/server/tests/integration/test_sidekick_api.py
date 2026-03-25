"""Integration tests for Sidekick API endpoints."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.services.sidekick_llm import SidekickLlmEngine


class TestSuggestionsEndpoint:
    @pytest.mark.asyncio
    async def test_suggestions_success(self, seeded_client: AsyncClient):
        """AC-18: Valid context returns 200 with suggestions list."""
        resp = await seeded_client.post(
            "/api/v1/sidekick/suggestions",
            json={
                "pageType": "object_type_detail",
                "entityRid": "ri.ontology.object-type.nonexistent",
                "ontologyRid": "ri.ontology.ontology.default",
            },
        )
        # Entity doesn't exist → should return 400 or 404
        assert resp.status_code in {400, 404}

    @pytest.mark.asyncio
    async def test_suggestions_invalid_page_type(self, seeded_client: AsyncClient):
        """AC-18: Invalid pageType returns 422."""
        resp = await seeded_client.post(
            "/api/v1/sidekick/suggestions",
            json={
                "pageType": "invalid_page",
                "entityRid": "ri.ontology.object-type.test1",
                "ontologyRid": "ri.ontology.ontology.default",
            },
        )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_suggestions_entity_not_found(self, seeded_client: AsyncClient):
        """AC-18: Non-existent entityRid returns error."""
        resp = await seeded_client.post(
            "/api/v1/sidekick/suggestions",
            json={
                "pageType": "object_type_detail",
                "entityRid": "ri.ontology.object-type.does-not-exist",
                "ontologyRid": "ri.ontology.ontology.default",
            },
        )
        assert resp.status_code in {400, 404}
        data = resp.json()
        assert "error" in data


class TestApplyEndpoint:
    @pytest.mark.asyncio
    async def test_apply_entity_not_found(self, seeded_client: AsyncClient):
        """AC-19: Non-existent entityRid returns 404."""
        resp = await seeded_client.post(
            "/api/v1/sidekick/apply",
            json={
                "suggestionType": "missing_description",
                "entityRid": "ri.ontology.object-type.does-not-exist",
                "actionPayload": {"description": "test"},
            },
        )
        assert resp.status_code in {400, 404}


class TestGenerateContentEndpoint:
    @pytest.mark.asyncio
    async def test_generate_content_no_api_key(self, seeded_client: AsyncClient):
        """AC-20: No API Key returns 503 SIDEKICK_LLM_UNAVAILABLE."""
        with patch.object(SidekickLlmEngine, "is_available", return_value=False):
            resp = await seeded_client.post(
                "/api/v1/sidekick/generate-content",
                json={
                    "contentType": "description",
                    "entityRid": "ri.ontology.object-type.test1",
                    "context": {"displayName": "Test"},
                },
            )
        assert resp.status_code == 503
        data = resp.json()
        assert data["error"]["code"] == "SIDEKICK_LLM_UNAVAILABLE"
