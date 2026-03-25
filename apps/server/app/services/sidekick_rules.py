"""SidekickRulesEngine — rule-based suggestion detection for Sidekick."""

from __future__ import annotations

import logging
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.constants import DEFAULT_ONTOLOGY_RID
from app.domain.sidekick import (
    SidekickContext,
    SidekickPageType,
    Suggestion,
    SuggestionSource,
    SuggestionType,
)
from app.exceptions import AppError
from app.services.link_type_service import LinkTypeService
from app.services.object_type_service import ObjectTypeService
from app.services.property_service import PropertyService

logger = logging.getLogger(__name__)


class SidekickRulesEngine:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._ot_service = ObjectTypeService(session)
        self._prop_service = PropertyService(session)
        self._lt_service = LinkTypeService(session)

    async def analyze(self, context: SidekickContext) -> list[Suggestion]:
        """Analyze current entity and return rule-based suggestions."""
        entity_data = await self._get_entity_data(context)

        if context.page_type == SidekickPageType.OBJECT_TYPE_DETAIL:
            return self._analyze_object_type(entity_data)
        elif context.page_type == SidekickPageType.LINK_TYPE_DETAIL:
            return await self._analyze_link_type(entity_data)
        elif context.page_type == SidekickPageType.PROPERTY_LIST:
            return await self._analyze_property_list(context, entity_data)
        return []

    async def _get_entity_data(self, context: SidekickContext) -> dict:
        """Fetch entity data based on page type."""
        try:
            if context.page_type == SidekickPageType.OBJECT_TYPE_DETAIL:
                result = await self._ot_service.get_by_rid(context.entity_rid)
                return result.model_dump(mode="json", by_alias=True)
            elif context.page_type == SidekickPageType.LINK_TYPE_DETAIL:
                result = await self._lt_service.get_by_rid(context.entity_rid)
                return result.model_dump(mode="json", by_alias=True)
            elif context.page_type == SidekickPageType.PROPERTY_LIST:
                result = await self._ot_service.get_by_rid(context.entity_rid)
                return result.model_dump(mode="json", by_alias=True)
        except AppError:
            raise
        return {}

    def _analyze_object_type(self, ot_data: dict) -> list[Suggestion]:
        """Check OT for missing fields."""
        suggestions: list[Suggestion] = []

        if not ot_data.get("description"):
            suggestions.append(
                Suggestion(
                    id=self._gen_id(),
                    suggestion_type=SuggestionType.MISSING_DESCRIPTION,
                    title="对象类型缺少描述",
                    description=f"{ot_data.get('displayName', '')} 对象类型没有描述信息，添加描述可提高 Agent 理解准确度",
                    confidence=1.0,
                    confidence_level="high",
                    source=SuggestionSource.COMPLETENESS_CHECK,
                    reasoning="completeness_check 规则检测到 description 字段为空",
                    requires_llm=True,
                )
            )

        if not ot_data.get("titleKeyPropertyId"):
            suggestions.append(
                Suggestion(
                    id=self._gen_id(),
                    suggestion_type=SuggestionType.MISSING_TITLE_KEY,
                    title="缺少标题键属性",
                    description=f"{ot_data.get('displayName', '')} 对象类型未设置标题键属性（titleKeyPropertyId），建议选择一个代表性属性作为标题键",
                    confidence=0.9,
                    confidence_level="high",
                    source=SuggestionSource.COMPLETENESS_CHECK,
                    reasoning="completeness_check 规则检测到 titleKeyPropertyId 字段为空",
                    requires_llm=False,
                )
            )

        if not ot_data.get("primaryKeyPropertyId"):
            suggestions.append(
                Suggestion(
                    id=self._gen_id(),
                    suggestion_type=SuggestionType.MISSING_PRIMARY_KEY,
                    title="缺少主键属性",
                    description=f"{ot_data.get('displayName', '')} 对象类型未设置主键属性（primaryKeyPropertyId），建议选择一个唯一标识属性",
                    confidence=0.9,
                    confidence_level="high",
                    source=SuggestionSource.COMPLETENESS_CHECK,
                    reasoning="completeness_check 规则检测到 primaryKeyPropertyId 字段为空",
                    requires_llm=False,
                )
            )

        return suggestions

    async def _analyze_link_type(self, lt_data: dict) -> list[Suggestion]:
        """Check LinkType for orphan references."""
        suggestions: list[Suggestion] = []

        side_a = lt_data.get("sideA", {})
        side_b = lt_data.get("sideB", {})

        side_a_ot_rid = side_a.get("objectTypeRid")
        side_b_ot_rid = side_b.get("objectTypeRid")

        if side_a_ot_rid and not await self._check_ot_exists(side_a_ot_rid):
            suggestions.append(
                Suggestion(
                    id=self._gen_id(),
                    suggestion_type=SuggestionType.ORPHAN_LINK,
                    title="链接类型引用了不存在的对象类型",
                    description=f"链接类型 {lt_data.get('id', '')} 的 Side A 引用的对象类型 ({side_a_ot_rid}) 不存在或已被删除",
                    confidence=1.0,
                    confidence_level="high",
                    source=SuggestionSource.CONSISTENCY_CHECK,
                    reasoning=f"consistency_check 规则检测到 sideA.objectTypeRid ({side_a_ot_rid}) 不存在",
                    requires_llm=False,
                )
            )

        if side_b_ot_rid and not await self._check_ot_exists(side_b_ot_rid):
            suggestions.append(
                Suggestion(
                    id=self._gen_id(),
                    suggestion_type=SuggestionType.ORPHAN_LINK,
                    title="链接类型引用了不存在的对象类型",
                    description=f"链接类型 {lt_data.get('id', '')} 的 Side B 引用的对象类型 ({side_b_ot_rid}) 不存在或已被删除",
                    confidence=1.0,
                    confidence_level="high",
                    source=SuggestionSource.CONSISTENCY_CHECK,
                    reasoning=f"consistency_check 规则检测到 sideB.objectTypeRid ({side_b_ot_rid}) 不存在",
                    requires_llm=False,
                )
            )

        return suggestions

    async def _analyze_property_list(
        self, context: SidekickContext, ot_data: dict
    ) -> list[Suggestion]:
        """Check for duplicate property names across OTs."""
        suggestions: list[Suggestion] = []

        duplicates = await self._find_duplicate_property_names(context.ontology_rid)
        if duplicates:
            names = set()
            for prop in duplicates:
                names.add(prop.get("displayName", ""))
            for name in names:
                count = sum(1 for p in duplicates if p.get("displayName") == name)
                if count > 1:
                    suggestions.append(
                        Suggestion(
                            id=self._gen_id(),
                            suggestion_type=SuggestionType.DUPLICATE_PROPERTY_NAME,
                            title=f"存在 {count} 个同名属性 '{name}'",
                            description=f"属性 '{name}' 在 {count} 个不同对象类型中重复出现，可考虑合并为共享属性",
                            confidence=0.7,
                            confidence_level="medium",
                            source=SuggestionSource.PATTERN_MATCHING,
                            reasoning=f"pattern_matching 规则检测到属性名 '{name}' 在 {count} 个对象类型中重复",
                            requires_llm=False,
                        )
                    )

        # Also check OT-level fields for the property list page
        suggestions.extend(self._analyze_object_type(ot_data))

        return suggestions

    async def _check_ot_exists(self, ot_rid: str) -> bool:
        """Check if an ObjectType exists."""
        try:
            await self._ot_service.get_by_rid(ot_rid)
            return True
        except AppError:
            return False

    async def _find_duplicate_property_names(self, ontology_rid: str) -> list[dict]:
        """Find properties with duplicate displayNames across OTs."""
        all_ots = await self._ot_service.list(page=1, page_size=100)
        all_props: list[dict] = []
        for ot in all_ots.items:
            ot_rid = ot.rid
            try:
                prop_list = await self._prop_service.list(ot_rid)
                for prop in prop_list.items:
                    all_props.append(
                        {
                            "displayName": prop.display_name,
                            "objectTypeRid": ot_rid,
                        }
                    )
            except AppError:
                continue

        name_counts: dict[str, int] = {}
        for prop in all_props:
            name = prop.get("displayName", "")
            name_counts[name] = name_counts.get(name, 0) + 1

        return [p for p in all_props if name_counts.get(p.get("displayName", ""), 0) > 1]

    @staticmethod
    def _gen_id() -> str:
        return uuid.uuid4().hex[:12]
