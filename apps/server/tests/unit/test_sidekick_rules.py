"""Unit tests for SidekickRulesEngine."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.domain.sidekick import (
    SidekickContext,
    SidekickPageType,
    SuggestionSource,
    SuggestionType,
)


@pytest.fixture
def engine():
    session = AsyncMock()
    from app.services.sidekick_rules import SidekickRulesEngine

    return SidekickRulesEngine(session)


def _make_context(
    page_type: SidekickPageType = SidekickPageType.OBJECT_TYPE_DETAIL,
    entity_rid: str = "ri.ontology.object-type.test1",
    ontology_rid: str = "ri.ontology.ontology.default",
) -> SidekickContext:
    return SidekickContext(
        page_type=page_type,
        entity_rid=entity_rid,
        ontology_rid=ontology_rid,
    )


class TestMissingDescription:
    @pytest.mark.asyncio
    async def test_missing_description_detected(self, engine):
        """AC-03: OT without description triggers missing_description suggestion."""
        ot_data = {
            "rid": "ri.ontology.object-type.test1",
            "displayName": "Customer",
            "description": "",
            "titleKeyPropertyId": "name",
            "primaryKeyPropertyId": "id",
        }
        context = _make_context()

        with patch.object(engine, "get_entity_data", new_callable=AsyncMock, return_value=ot_data):
            suggestions = await engine.analyze(context)

        desc_suggestions = [
            s for s in suggestions if s.suggestion_type == SuggestionType.MISSING_DESCRIPTION
        ]
        assert len(desc_suggestions) == 1
        s = desc_suggestions[0]
        assert s.confidence == 1.0
        assert s.source == SuggestionSource.COMPLETENESS_CHECK
        assert s.requires_llm is True

    @pytest.mark.asyncio
    async def test_missing_description_not_triggered(self, engine):
        """OT with description should not trigger missing_description."""
        ot_data = {
            "rid": "ri.ontology.object-type.test1",
            "displayName": "Customer",
            "description": "A customer entity",
            "titleKeyPropertyId": "name",
            "primaryKeyPropertyId": "id",
        }
        context = _make_context()

        with patch.object(engine, "get_entity_data", new_callable=AsyncMock, return_value=ot_data):
            suggestions = await engine.analyze(context)

        desc_suggestions = [
            s for s in suggestions if s.suggestion_type == SuggestionType.MISSING_DESCRIPTION
        ]
        assert len(desc_suggestions) == 0


class TestMissingTitleKey:
    @pytest.mark.asyncio
    async def test_missing_title_key_detected(self, engine):
        """AC-04: OT without titleKeyPropertyId triggers missing_title_key suggestion."""
        ot_data = {
            "rid": "ri.ontology.object-type.test1",
            "displayName": "Customer",
            "description": "A customer",
            "titleKeyPropertyId": None,
            "primaryKeyPropertyId": "id",
        }
        context = _make_context()

        with patch.object(engine, "get_entity_data", new_callable=AsyncMock, return_value=ot_data):
            suggestions = await engine.analyze(context)

        tk_suggestions = [
            s for s in suggestions if s.suggestion_type == SuggestionType.MISSING_TITLE_KEY
        ]
        assert len(tk_suggestions) == 1
        assert tk_suggestions[0].confidence == 0.9
        assert tk_suggestions[0].requires_llm is False


class TestMissingPrimaryKey:
    @pytest.mark.asyncio
    async def test_missing_primary_key_detected(self, engine):
        """OT without primaryKeyPropertyId triggers missing_primary_key suggestion."""
        ot_data = {
            "rid": "ri.ontology.object-type.test1",
            "displayName": "Customer",
            "description": "A customer",
            "titleKeyPropertyId": "name",
            "primaryKeyPropertyId": None,
        }
        context = _make_context()

        with patch.object(engine, "get_entity_data", new_callable=AsyncMock, return_value=ot_data):
            suggestions = await engine.analyze(context)

        pk_suggestions = [
            s for s in suggestions if s.suggestion_type == SuggestionType.MISSING_PRIMARY_KEY
        ]
        assert len(pk_suggestions) == 1
        assert pk_suggestions[0].requires_llm is False


class TestOrphanLink:
    @pytest.mark.asyncio
    async def test_orphan_link_detected(self, engine):
        """AC-05: LinkType referencing deleted OT triggers orphan_link suggestion."""
        lt_data = {
            "rid": "ri.ontology.link-type.test1",
            "id": "customerOrder",
            "sideA": {
                "objectTypeRid": "ri.ontology.object-type.deleted1",
                "apiName": "customer",
            },
            "sideB": {
                "objectTypeRid": "ri.ontology.object-type.existing1",
                "apiName": "order",
            },
        }
        context = _make_context(
            page_type=SidekickPageType.LINK_TYPE_DETAIL,
            entity_rid="ri.ontology.link-type.test1",
        )

        with (
            patch.object(engine, "get_entity_data", new_callable=AsyncMock, return_value=lt_data),
            patch.object(
                engine,
                "_check_ot_exists",
                new_callable=AsyncMock,
                side_effect=[False, True],  # sideA deleted, sideB exists
            ),
        ):
            suggestions = await engine.analyze(context)

        orphan_suggestions = [
            s for s in suggestions if s.suggestion_type == SuggestionType.ORPHAN_LINK
        ]
        assert len(orphan_suggestions) == 1
        assert orphan_suggestions[0].confidence == 1.0
        assert orphan_suggestions[0].source == SuggestionSource.CONSISTENCY_CHECK


class TestDuplicatePropertyName:
    @pytest.mark.asyncio
    async def test_duplicate_property_name_detected(self, engine):
        """Duplicate property names across OTs trigger suggestion."""
        ot_data = {
            "rid": "ri.ontology.object-type.test1",
            "displayName": "Customer",
            "description": "A customer",
            "titleKeyPropertyId": "name",
            "primaryKeyPropertyId": "id",
        }
        duplicate_props = [
            {"displayName": "name", "objectTypeRid": "ri.ontology.object-type.test1"},
            {"displayName": "name", "objectTypeRid": "ri.ontology.object-type.test2"},
            {"displayName": "name", "objectTypeRid": "ri.ontology.object-type.test3"},
        ]
        context = _make_context(
            page_type=SidekickPageType.PROPERTY_LIST,
        )

        with (
            patch.object(engine, "get_entity_data", new_callable=AsyncMock, return_value=ot_data),
            patch.object(
                engine,
                "_find_duplicate_property_names",
                new_callable=AsyncMock,
                return_value=duplicate_props,
            ),
        ):
            suggestions = await engine.analyze(context)

        dup_suggestions = [
            s for s in suggestions if s.suggestion_type == SuggestionType.DUPLICATE_PROPERTY_NAME
        ]
        assert len(dup_suggestions) >= 1


class TestNoIssues:
    @pytest.mark.asyncio
    async def test_no_issues_empty_list(self, engine):
        """When everything is fine, return empty list."""
        ot_data = {
            "rid": "ri.ontology.object-type.test1",
            "displayName": "Customer",
            "description": "A well-described customer entity",
            "titleKeyPropertyId": "name",
            "primaryKeyPropertyId": "id",
        }
        context = _make_context()

        with patch.object(engine, "get_entity_data", new_callable=AsyncMock, return_value=ot_data):
            suggestions = await engine.analyze(context)

        assert len(suggestions) == 0


class TestPageTypeFiltering:
    @pytest.mark.asyncio
    async def test_ot_detail_page_rules(self, engine):
        """pageType=object_type_detail only returns OT-related rules."""
        ot_data = {
            "rid": "ri.ontology.object-type.test1",
            "displayName": "Customer",
            "description": "",
            "titleKeyPropertyId": None,
            "primaryKeyPropertyId": None,
        }
        context = _make_context(page_type=SidekickPageType.OBJECT_TYPE_DETAIL)

        with patch.object(engine, "get_entity_data", new_callable=AsyncMock, return_value=ot_data):
            suggestions = await engine.analyze(context)

        for s in suggestions:
            assert s.suggestion_type in {
                SuggestionType.MISSING_DESCRIPTION,
                SuggestionType.MISSING_TITLE_KEY,
                SuggestionType.MISSING_PRIMARY_KEY,
            }

    @pytest.mark.asyncio
    async def test_link_type_detail_page_rules(self, engine):
        """pageType=link_type_detail only returns LinkType-related rules."""
        lt_data = {
            "rid": "ri.ontology.link-type.test1",
            "id": "customerOrder",
            "sideA": {
                "objectTypeRid": "ri.ontology.object-type.existing1",
                "apiName": "customer",
            },
            "sideB": {
                "objectTypeRid": "ri.ontology.object-type.existing2",
                "apiName": "order",
            },
        }
        context = _make_context(
            page_type=SidekickPageType.LINK_TYPE_DETAIL,
            entity_rid="ri.ontology.link-type.test1",
        )

        with (
            patch.object(engine, "get_entity_data", new_callable=AsyncMock, return_value=lt_data),
            patch.object(
                engine,
                "_check_ot_exists",
                new_callable=AsyncMock,
                return_value=True,
            ),
        ):
            suggestions = await engine.analyze(context)

        for s in suggestions:
            assert s.suggestion_type in {
                SuggestionType.ORPHAN_LINK,
            }
