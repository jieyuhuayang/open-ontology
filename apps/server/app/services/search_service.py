"""Search service — cross-resource full-text search with draft merging."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.constants import DEFAULT_ONTOLOGY_RID
from app.domain.object_type import Icon, ResourceStatus, Visibility
from app.domain.search import (
    SearchResourceType,
    SearchResponse,
    SearchResultItem,
    SearchTypeResult,
)
from app.domain.working_state import ChangeState, ResourceType
from app.services.working_state_service import WorkingStateService
from app.storage.search_storage import SearchStorage


class SearchService:
    def __init__(self, session: AsyncSession):
        self._session = session
        self._ws_service = WorkingStateService(session)

    async def search(
        self,
        ontology_rid: str,
        query: str,
        types: list[str],
        limit: int,
    ) -> SearchResponse:
        results: dict[str, SearchTypeResult] = {}

        if "objectType" in types:
            ot_result = await self._search_object_types(ontology_rid, query, limit)
            results["objectTypes"] = ot_result

        if "property" in types:
            prop_result = await self._search_properties(ontology_rid, query, limit)
            results["properties"] = prop_result

        if "linkType" in types:
            lt_result = await self._search_link_types(ontology_rid, query, limit)
            results["linkTypes"] = lt_result

        total_count = sum(r.total for r in results.values())
        return SearchResponse(query=query, results=results, total_count=total_count)

    async def _search_object_types(
        self, ontology_rid: str, query: str, limit: int
    ) -> SearchTypeResult:
        # 1. FTS + ILIKE from published data
        db_results = await SearchStorage.search_object_types(
            self._session, ontology_rid, query, limit
        )
        seen_rids: dict[str, SearchResultItem] = {}
        for orm, matched_fields in db_results:
            status_val = orm.status if isinstance(orm.status, str) else orm.status.value
            vis_val = orm.visibility if isinstance(orm.visibility, str) else orm.visibility.value
            item = SearchResultItem(
                rid=orm.rid,
                resource_type=SearchResourceType.OBJECT_TYPE,
                display_name=orm.display_name,
                description=orm.description,
                icon=Icon.model_validate(orm.icon) if orm.icon else None,
                status=ResourceStatus(status_val),
                visibility=Visibility(vis_val),
                change_state=ChangeState.PUBLISHED,
                matched_fields=matched_fields,
            )
            seen_rids[orm.rid] = item

        # 2. Merge drafts
        merged = await self._ws_service.get_merged_view(ontology_rid, ResourceType.OBJECT_TYPE)
        for data, change_state in merged:
            if change_state == ChangeState.DELETED:
                seen_rids.pop(data.get("rid", ""), None)
                continue
            if change_state == ChangeState.PUBLISHED:
                continue
            rid = data.get("rid", "")
            matched = _build_matched_fields(data, query)
            if not matched and rid not in seen_rids:
                continue
            icon_data = data.get("icon")
            icon = Icon.model_validate(icon_data) if icon_data else None
            item = SearchResultItem(
                rid=rid,
                resource_type=SearchResourceType.OBJECT_TYPE,
                display_name=data.get("displayName", data.get("display_name", "")),
                description=data.get("description"),
                icon=icon,
                status=ResourceStatus(data.get("status", "experimental")),
                visibility=Visibility(data.get("visibility", "normal")),
                change_state=change_state,
                matched_fields=matched
                or seen_rids.get(
                    rid,
                    SearchResultItem(
                        rid="",
                        resource_type=SearchResourceType.OBJECT_TYPE,
                        display_name="",
                        status=ResourceStatus.EXPERIMENTAL,
                        visibility=Visibility.NORMAL,
                        change_state=ChangeState.PUBLISHED,
                        matched_fields=["name"],
                    ),
                ).matched_fields,
            )
            seen_rids[rid] = item

        items = list(seen_rids.values())[:limit]
        return SearchTypeResult(items=items, total=len(seen_rids))

    async def _search_properties(
        self, ontology_rid: str, query: str, limit: int
    ) -> SearchTypeResult:
        db_results = await SearchStorage.search_properties(
            self._session, ontology_rid, query, limit
        )
        seen_rids: dict[str, SearchResultItem] = {}
        for orm, matched_fields in db_results:
            status_val = orm.status if isinstance(orm.status, str) else orm.status.value
            vis_val = orm.visibility if isinstance(orm.visibility, str) else orm.visibility.value
            base_type_val = orm.base_type if isinstance(orm.base_type, str) else orm.base_type.value
            item = SearchResultItem(
                rid=orm.rid,
                resource_type=SearchResourceType.PROPERTY,
                display_name=orm.display_name,
                description=orm.description,
                status=ResourceStatus(status_val),
                visibility=Visibility(vis_val),
                change_state=ChangeState.PUBLISHED,
                matched_fields=matched_fields,
                object_type_rid=orm.object_type_rid,
                base_type=base_type_val,
            )
            seen_rids[orm.rid] = item

        # Merge draft properties
        merged = await self._ws_service.get_merged_view(ontology_rid, ResourceType.PROPERTY)
        for data, change_state in merged:
            if change_state == ChangeState.DELETED:
                seen_rids.pop(data.get("rid", ""), None)
                continue
            if change_state == ChangeState.PUBLISHED:
                continue
            rid = data.get("rid", "")
            matched = _build_matched_fields(data, query)
            if not matched and rid not in seen_rids:
                continue
            item = SearchResultItem(
                rid=rid,
                resource_type=SearchResourceType.PROPERTY,
                display_name=data.get("displayName", data.get("display_name", "")),
                description=data.get("description"),
                status=ResourceStatus(data.get("status", "experimental")),
                visibility=Visibility(data.get("visibility", "normal")),
                change_state=change_state,
                matched_fields=matched
                or (seen_rids[rid].matched_fields if rid in seen_rids else ["name"]),
                object_type_rid=data.get("objectTypeRid", data.get("object_type_rid")),
                base_type=data.get("baseType", data.get("base_type")),
            )
            seen_rids[rid] = item

        # Fill object type display names
        ot_merged = await self._ws_service.get_merged_view(ontology_rid, ResourceType.OBJECT_TYPE)
        ot_map: dict[str, str] = {}
        for data, cs in ot_merged:
            if cs != ChangeState.DELETED:
                ot_rid = data.get("rid", "")
                ot_name = data.get("displayName", data.get("display_name", ""))
                ot_map[ot_rid] = ot_name

        for item in seen_rids.values():
            if item.object_type_rid and item.object_type_rid in ot_map:
                item.object_type_display_name = ot_map[item.object_type_rid]

        items = list(seen_rids.values())[:limit]
        return SearchTypeResult(items=items, total=len(seen_rids))

    async def _search_link_types(
        self, ontology_rid: str, query: str, limit: int
    ) -> SearchTypeResult:
        db_results = await SearchStorage.search_link_types(
            self._session, ontology_rid, query, limit
        )
        seen_rids: dict[str, SearchResultItem] = {}
        for orm, matched_fields in db_results:
            status_val = orm.status if isinstance(orm.status, str) else orm.status.value
            side_a_name = None
            side_b_name = None
            for ep in orm.endpoints or []:
                side_val = ep.side if isinstance(ep.side, str) else ep.side.value
                if side_val == "A":
                    side_a_name = ep.display_name
                elif side_val == "B":
                    side_b_name = ep.display_name

            item = SearchResultItem(
                rid=orm.rid,
                resource_type=SearchResourceType.LINK_TYPE,
                display_name=f"{side_a_name or ''} ↔ {side_b_name or ''}",
                status=ResourceStatus(status_val),
                visibility=Visibility.NORMAL,
                change_state=ChangeState.PUBLISHED,
                matched_fields=matched_fields,
                side_a_display_name=side_a_name,
                side_b_display_name=side_b_name,
            )
            seen_rids[orm.rid] = item

        # Merge draft link types
        merged = await self._ws_service.get_merged_view(ontology_rid, ResourceType.LINK_TYPE)
        for data, change_state in merged:
            if change_state == ChangeState.DELETED:
                seen_rids.pop(data.get("rid", ""), None)
                continue
            if change_state == ChangeState.PUBLISHED:
                continue
            rid = data.get("rid", "")
            matched = _build_matched_fields_lt(data, query)
            if not matched and rid not in seen_rids:
                continue

            side_a = data.get("sideA", data.get("side_a", {})) or {}
            side_b = data.get("sideB", data.get("side_b", {})) or {}
            side_a_name = side_a.get("displayName", side_a.get("display_name", ""))
            side_b_name = side_b.get("displayName", side_b.get("display_name", ""))

            item = SearchResultItem(
                rid=rid,
                resource_type=SearchResourceType.LINK_TYPE,
                display_name=f"{side_a_name} ↔ {side_b_name}",
                status=ResourceStatus(data.get("status", "experimental")),
                visibility=Visibility.NORMAL,
                change_state=change_state,
                matched_fields=matched
                or (seen_rids[rid].matched_fields if rid in seen_rids else ["name"]),
                side_a_display_name=side_a_name or None,
                side_b_display_name=side_b_name or None,
            )
            seen_rids[rid] = item

        items = list(seen_rids.values())[:limit]
        return SearchTypeResult(items=items, total=len(seen_rids))


def _match_keyword(text: str | None, query: str) -> bool:
    if not text:
        return False
    return query.lower() in text.lower()


def _build_matched_fields(data: dict, query: str) -> list[str]:
    fields = []
    if _match_keyword(data.get("displayName") or data.get("display_name"), query):
        fields.append("name")
    if _match_keyword(data.get("apiName") or data.get("api_name"), query):
        fields.append("apiName")
    if _match_keyword(data.get("id"), query):
        fields.append("id")
    if _match_keyword(data.get("description"), query):
        fields.append("description")
    return fields


def _build_matched_fields_lt(data: dict, query: str) -> list[str]:
    fields = []
    if _match_keyword(data.get("id"), query):
        fields.append("id")
    side_a = data.get("sideA", data.get("side_a", {})) or {}
    side_b = data.get("sideB", data.get("side_b", {})) or {}
    if _match_keyword(side_a.get("displayName") or side_a.get("display_name"), query):
        fields.append("name")
    elif _match_keyword(side_b.get("displayName") or side_b.get("display_name"), query):
        fields.append("name")
    if _match_keyword(side_a.get("apiName") or side_a.get("api_name"), query):
        fields.append("apiName")
    elif _match_keyword(side_b.get("apiName") or side_b.get("api_name"), query):
        fields.append("apiName")
    return fields
