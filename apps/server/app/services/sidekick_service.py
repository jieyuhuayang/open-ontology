"""SidekickService — orchestrates rule engine + LLM engine for Sidekick suggestions."""

from __future__ import annotations

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.sidekick import (
    GenerateContentRequest,
    GenerateContentResponse,
    SidekickContext,
    SuggestionApplyRequest,
    SuggestionApplyResponse,
    SuggestionsResponse,
    SuggestionType,
)
from app.domain.property import PropertyUpdateRequest
from app.exceptions import AppError
from app.services.object_type_service import ObjectTypeService
from app.services.property_service import PropertyService
from app.services.sidekick_llm import SidekickLlmEngine
from app.services.sidekick_rules import SidekickRulesEngine

logger = logging.getLogger(__name__)

_TITLE_KEY_CANDIDATES = {"name", "title", "displayName", "display_name", "label", "email"}
_PRIMARY_KEY_CANDIDATES = {"id", "uid", "uuid", "key", "code"}


class SidekickService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._rules_engine = SidekickRulesEngine(session)
        self._llm_engine = SidekickLlmEngine()
        self._ot_service = ObjectTypeService(session)
        self._prop_service = PropertyService(session)

    async def get_suggestions(self, context: SidekickContext) -> SuggestionsResponse:
        """Get suggestions for the given page context."""
        llm_available = self._llm_engine.is_available()

        # Sequential: all operations share the same AsyncSession (no concurrent DB ops)
        rule_suggestions = await self._rules_engine.analyze(context)
        entity_data = await self._get_entity_data_for_llm(context)
        ontology_summary = await self._get_ontology_summary()
        llm_suggestions = await self._llm_engine.analyze(context, entity_data, ontology_summary)

        all_suggestions = rule_suggestions + llm_suggestions
        all_suggestions.sort(key=lambda s: s.confidence, reverse=True)

        return SuggestionsResponse(
            suggestions=all_suggestions,
            has_llm_suggestions=llm_available,
        )

    async def apply_suggestion(self, request: SuggestionApplyRequest) -> SuggestionApplyResponse:
        """Apply a single suggestion."""
        if request.suggestion_type == SuggestionType.MISSING_DESCRIPTION:
            return await self._apply_description(request)
        elif request.suggestion_type == SuggestionType.MISSING_TITLE_KEY:
            applied = await self._apply_key_property(
                request.entity_rid, request.action_payload, _TITLE_KEY_CANDIDATES, "is_title_key"
            )
            if applied:
                return SuggestionApplyResponse(success=True, message="Title key updated")
            return SuggestionApplyResponse(
                success=False, message="No suitable property found for title key"
            )
        elif request.suggestion_type == SuggestionType.MISSING_PRIMARY_KEY:
            applied = await self._apply_key_property(
                request.entity_rid,
                request.action_payload,
                _PRIMARY_KEY_CANDIDATES,
                "is_primary_key",
            )
            if applied:
                return SuggestionApplyResponse(success=True, message="Primary key updated")
            return SuggestionApplyResponse(
                success=False, message="No suitable property found for primary key"
            )
        else:
            return SuggestionApplyResponse(
                success=True,
                message="Suggestion noted; auto-apply not supported for this type",
            )

    async def generate_content(self, request: GenerateContentRequest) -> GenerateContentResponse:
        """Generate content via LLM."""
        content = await self._llm_engine.generate_content(request)
        return GenerateContentResponse(content=content)

    async def _apply_description(self, request: SuggestionApplyRequest) -> SuggestionApplyResponse:
        if request.action_payload and request.action_payload.get("description"):
            description = request.action_payload["description"]
        else:
            ot = await self._ot_service.get_by_rid(request.entity_rid)
            gen_request = GenerateContentRequest(
                content_type="description",
                entity_rid=request.entity_rid,
                context={"displayName": ot.display_name, "apiName": ot.api_name},
            )
            description = await self._llm_engine.generate_content(gen_request)

        from app.domain.object_type import ObjectTypeUpdateRequest

        await self._ot_service.update(
            request.entity_rid, ObjectTypeUpdateRequest(description=description)
        )
        return SuggestionApplyResponse(success=True, message="Description updated")

    async def _apply_key_property(
        self,
        entity_rid: str,
        action_payload: dict | None,
        candidates: set[str],
        update_field: str,
    ) -> bool:
        """Set a key property (title or primary) for an OT. Single fetch."""
        prop_list = await self._prop_service.list(entity_rid)

        # Determine target property id
        if action_payload and action_payload.get("propertyId"):
            target_id = action_payload["propertyId"]
        else:
            # Pick best candidate by name, fallback to first property
            target_id = None
            for prop in prop_list.items:
                if prop.display_name.lower() in candidates:
                    target_id = prop.id
                    break
            if not target_id and prop_list.items:
                target_id = prop_list.items[0].id

        if target_id:
            for prop in prop_list.items:
                if prop.id == target_id:
                    req = PropertyUpdateRequest(**{update_field: True})
                    await self._prop_service.update(entity_rid, prop.rid, req)
                    return True
        return False

    async def _get_entity_data_for_llm(self, context: SidekickContext) -> dict:
        try:
            return await self._rules_engine.get_entity_data(context)
        except AppError:
            return {}

    async def _get_ontology_summary(self) -> dict:
        try:
            ot_list = await self._ot_service.list(page=1, page_size=100)
            return {
                "objectTypeCount": ot_list.total_count,
                "objectTypeNames": [ot.display_name for ot in ot_list.items[:20]],
            }
        except Exception:
            return {}
