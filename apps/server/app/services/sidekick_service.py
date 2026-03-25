"""SidekickService — orchestrates rule engine + LLM engine for Sidekick suggestions."""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.sidekick import (
    GenerateContentRequest,
    GenerateContentResponse,
    SidekickContext,
    Suggestion,
    SuggestionApplyRequest,
    SuggestionApplyResponse,
    SuggestionsResponse,
    SuggestionType,
)
from app.exceptions import AppError
from app.services.object_type_service import ObjectTypeService
from app.services.property_service import PropertyService
from app.services.sidekick_llm import SidekickLlmEngine
from app.services.sidekick_rules import SidekickRulesEngine

logger = logging.getLogger(__name__)

# Property names that are good candidates for title key
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
        # Get rule-based suggestions (may raise AppError if entity not found)
        rule_suggestions = await self._rules_engine.analyze(context)

        # Get LLM suggestions (never raises, returns [] on failure)
        entity_data = await self._get_entity_data_for_llm(context)
        ontology_summary = await self._get_ontology_summary()
        llm_suggestions = await self._llm_engine.analyze(context, entity_data, ontology_summary)

        # Merge and sort by confidence descending
        all_suggestions = rule_suggestions + llm_suggestions
        all_suggestions.sort(key=lambda s: s.confidence, reverse=True)

        return SuggestionsResponse(
            suggestions=all_suggestions,
            has_llm_suggestions=len(llm_suggestions) > 0,
        )

    async def apply_suggestion(self, request: SuggestionApplyRequest) -> SuggestionApplyResponse:
        """Apply a single suggestion."""
        if request.suggestion_type == SuggestionType.MISSING_DESCRIPTION:
            return await self._apply_description(request)
        elif request.suggestion_type == SuggestionType.MISSING_TITLE_KEY:
            await self._apply_title_key(request.entity_rid, request.action_payload)
            return SuggestionApplyResponse(success=True, message="标题键已更新")
        elif request.suggestion_type == SuggestionType.MISSING_PRIMARY_KEY:
            await self._apply_primary_key(request.entity_rid, request.action_payload)
            return SuggestionApplyResponse(success=True, message="主键已更新")
        else:
            return SuggestionApplyResponse(
                success=True,
                message="建议已记录，该类型暂不支持自动应用",
            )

    async def generate_content(self, request: GenerateContentRequest) -> GenerateContentResponse:
        """Generate content via LLM."""
        content = await self._llm_engine.generate_content(request)
        return GenerateContentResponse(content=content)

    # --- Private helpers ---

    async def _apply_description(self, request: SuggestionApplyRequest) -> SuggestionApplyResponse:
        """Apply missing_description suggestion."""
        if request.action_payload and request.action_payload.get("description"):
            # User edited: use provided description directly
            description = request.action_payload["description"]
        else:
            # Auto-generate via LLM
            ot = await self._ot_service.get_by_rid(request.entity_rid)
            gen_request = GenerateContentRequest(
                content_type="description",
                entity_rid=request.entity_rid,
                context={
                    "displayName": ot.display_name,
                    "apiName": ot.api_name,
                },
            )
            description = await self._llm_engine.generate_content(gen_request)

        await self._update_ot_description(request.entity_rid, description)
        return SuggestionApplyResponse(success=True, message="描述已更新")

    async def _update_ot_description(self, entity_rid: str, description: str) -> None:
        """Update OT description via ObjectTypeService."""
        from app.domain.object_type import ObjectTypeUpdateRequest

        req = ObjectTypeUpdateRequest(description=description)
        await self._ot_service.update(entity_rid, req)

    async def _apply_title_key(self, entity_rid: str, action_payload: dict | None) -> None:
        """Set title key property for an OT."""
        if action_payload and action_payload.get("propertyId"):
            property_id = action_payload["propertyId"]
        else:
            property_id = await self._find_best_property(entity_rid, _TITLE_KEY_CANDIDATES)

        if property_id:
            from app.domain.property import PropertyUpdateRequest

            prop_list = await self._prop_service.list(entity_rid)
            for prop in prop_list.items:
                if prop.id == property_id or prop.display_name.lower() in _TITLE_KEY_CANDIDATES:
                    if prop.id == property_id or (
                        not action_payload and prop.display_name.lower() in _TITLE_KEY_CANDIDATES
                    ):
                        target_rid = prop.rid
                        req = PropertyUpdateRequest(is_title_key=True)
                        await self._prop_service.update(entity_rid, target_rid, req)
                        return

    async def _apply_primary_key(self, entity_rid: str, action_payload: dict | None) -> None:
        """Set primary key property for an OT."""
        if action_payload and action_payload.get("propertyId"):
            property_id = action_payload["propertyId"]
        else:
            property_id = await self._find_best_property(entity_rid, _PRIMARY_KEY_CANDIDATES)

        if property_id:
            from app.domain.property import PropertyUpdateRequest

            prop_list = await self._prop_service.list(entity_rid)
            for prop in prop_list.items:
                if prop.id == property_id:
                    req = PropertyUpdateRequest(is_primary_key=True)
                    await self._prop_service.update(entity_rid, prop.rid, req)
                    return

    async def _find_best_property(self, entity_rid: str, candidates: set[str]) -> str | None:
        """Find the best matching property by name."""
        prop_list = await self._prop_service.list(entity_rid)
        for prop in prop_list.items:
            if prop.display_name.lower() in candidates:
                return prop.id
        # Fallback: first property
        if prop_list.items:
            return prop_list.items[0].id
        return None

    async def _get_entity_data_for_llm(self, context: SidekickContext) -> dict:
        """Get entity data for LLM context. Never raises."""
        try:
            data = await self._rules_engine._get_entity_data(context)
            return data
        except AppError:
            return {}

    async def _get_ontology_summary(self) -> dict:
        """Get a brief ontology summary for LLM context."""
        try:
            ot_list = await self._ot_service.list(page=1, page_size=100)
            return {
                "objectTypeCount": ot_list.total_count,
                "objectTypeNames": [ot.display_name for ot in ot_list.items[:20]],
            }
        except Exception:
            return {}
