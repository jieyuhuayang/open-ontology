"""Search data access layer — FTS + ILIKE queries."""

import re

from sqlalchemy import (
    String,
    case,
    cast,
    func,
    literal,
    literal_column,
    or_,
    select,
    text,
    union_all,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.postgresql import REGCONFIG

from app.storage.models import (
    LinkTypeEndpointModel,
    LinkTypeModel,
    ObjectTypeModel,
    PropertyModel,
)


def _escape_like(query: str) -> str:
    """Escape special LIKE/ILIKE characters."""
    return query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class SearchStorage:
    @staticmethod
    async def search_object_types(
        session: AsyncSession,
        ontology_rid: str,
        query: str,
        limit: int,
    ) -> list[tuple[ObjectTypeModel, list[str]]]:
        escaped = _escape_like(query)
        pattern = f"{escaped}%"
        tsquery = func.plainto_tsquery(literal_column("'simple'::regconfig"), query)

        # FTS query
        fts_stmt = (
            select(
                ObjectTypeModel,
                func.ts_rank(ObjectTypeModel.search_vector, tsquery).label("rank"),
                literal(True).label("is_fts"),
            )
            .where(
                ObjectTypeModel.ontology_rid == ontology_rid,
                ObjectTypeModel.search_vector.op("@@")(tsquery),
            )
            .order_by(text("rank DESC"))
            .limit(limit)
        )

        # ILIKE prefix query
        ilike_stmt = (
            select(
                ObjectTypeModel,
                literal(0.0).label("rank"),
                literal(False).label("is_fts"),
            )
            .where(
                ObjectTypeModel.ontology_rid == ontology_rid,
                or_(
                    ObjectTypeModel.display_name.ilike(pattern),
                    ObjectTypeModel.api_name.ilike(pattern),
                ),
            )
            .limit(limit)
        )

        # Execute both
        fts_result = await session.execute(fts_stmt)
        fts_rows = fts_result.all()
        fts_rids = {row[0].rid for row in fts_rows}

        ilike_result = await session.execute(ilike_stmt)
        ilike_rows = [row for row in ilike_result.all() if row[0].rid not in fts_rids]

        # Merge: FTS first, then ILIKE-only
        all_rows = list(fts_rows) + ilike_rows
        results = []
        for orm, _rank, _is_fts in all_rows[:limit]:
            matched = _detect_matched_fields_ot(orm, query)
            results.append((orm, matched))
        return results

    @staticmethod
    async def search_properties(
        session: AsyncSession,
        ontology_rid: str,
        query: str,
        limit: int,
    ) -> list[tuple[PropertyModel, list[str]]]:
        escaped = _escape_like(query)
        pattern = f"{escaped}%"
        tsquery = func.plainto_tsquery(literal_column("'simple'::regconfig"), query)

        # FTS
        fts_stmt = (
            select(
                PropertyModel,
                func.ts_rank(PropertyModel.search_vector, tsquery).label("rank"),
            )
            .join(ObjectTypeModel, PropertyModel.object_type_rid == ObjectTypeModel.rid)
            .where(
                ObjectTypeModel.ontology_rid == ontology_rid,
                PropertyModel.search_vector.op("@@")(tsquery),
            )
            .order_by(text("rank DESC"))
            .limit(limit)
        )

        ilike_stmt = (
            select(
                PropertyModel,
                literal(0.0).label("rank"),
            )
            .join(ObjectTypeModel, PropertyModel.object_type_rid == ObjectTypeModel.rid)
            .where(
                ObjectTypeModel.ontology_rid == ontology_rid,
                or_(
                    PropertyModel.display_name.ilike(pattern),
                    PropertyModel.api_name.ilike(pattern),
                ),
            )
            .limit(limit)
        )

        fts_result = await session.execute(fts_stmt)
        fts_rows = fts_result.all()
        fts_rids = {row[0].rid for row in fts_rows}

        ilike_result = await session.execute(ilike_stmt)
        ilike_rows = [row for row in ilike_result.all() if row[0].rid not in fts_rids]

        all_rows = list(fts_rows) + ilike_rows
        results = []
        for orm, _rank in all_rows[:limit]:
            matched = _detect_matched_fields_prop(orm, query)
            results.append((orm, matched))
        return results

    @staticmethod
    async def search_link_types(
        session: AsyncSession,
        ontology_rid: str,
        query: str,
        limit: int,
    ) -> list[tuple[LinkTypeModel, list[str]]]:
        escaped = _escape_like(query)
        pattern = f"{escaped}%"
        tsquery = func.plainto_tsquery(literal_column("'simple'::regconfig"), query)

        # FTS on link_types.search_vector
        fts_stmt = (
            select(
                LinkTypeModel,
                func.ts_rank(LinkTypeModel.search_vector, tsquery).label("rank"),
            )
            .where(
                LinkTypeModel.ontology_rid == ontology_rid,
                LinkTypeModel.search_vector.op("@@")(tsquery),
            )
            .order_by(text("rank DESC"))
            .limit(limit)
        )

        # ILIKE on endpoints
        ilike_stmt = (
            select(
                LinkTypeModel,
                literal(0.0).label("rank"),
            )
            .join(LinkTypeEndpointModel, LinkTypeModel.rid == LinkTypeEndpointModel.link_type_rid)
            .where(
                LinkTypeModel.ontology_rid == ontology_rid,
                or_(
                    LinkTypeEndpointModel.display_name.ilike(pattern),
                    LinkTypeEndpointModel.api_name.ilike(pattern),
                    LinkTypeModel.id.ilike(pattern),
                ),
            )
            .distinct()
            .limit(limit)
        )

        fts_result = await session.execute(fts_stmt)
        fts_rows = fts_result.all()
        fts_rids = {row[0].rid for row in fts_rows}

        ilike_result = await session.execute(ilike_stmt)
        ilike_rows = [row for row in ilike_result.all() if row[0].rid not in fts_rids]

        all_rows = list(fts_rows) + ilike_rows
        results = []
        for orm, _rank in all_rows[:limit]:
            matched = _detect_matched_fields_lt(orm, query)
            results.append((orm, matched))
        return results


def _ci_contains(text_val: str | None, query: str) -> bool:
    if not text_val:
        return False
    return query.lower() in text_val.lower()


def _detect_matched_fields_ot(orm: ObjectTypeModel, query: str) -> list[str]:
    fields = []
    if _ci_contains(orm.display_name, query):
        fields.append("name")
    if _ci_contains(orm.api_name, query):
        fields.append("apiName")
    if _ci_contains(orm.id, query):
        fields.append("id")
    if _ci_contains(orm.description, query):
        fields.append("description")
    return fields or ["name"]  # fallback if FTS matched via tokenization


def _detect_matched_fields_prop(orm: PropertyModel, query: str) -> list[str]:
    fields = []
    if _ci_contains(orm.display_name, query):
        fields.append("name")
    if _ci_contains(orm.api_name, query):
        fields.append("apiName")
    if _ci_contains(orm.description, query):
        fields.append("description")
    return fields or ["name"]


def _detect_matched_fields_lt(orm: LinkTypeModel, query: str) -> list[str]:
    fields = []
    if _ci_contains(orm.id, query):
        fields.append("id")
    # Check endpoints
    for ep in orm.endpoints or []:
        if _ci_contains(ep.display_name, query):
            fields.append("name")
            break
    for ep in orm.endpoints or []:
        if _ci_contains(ep.api_name, query):
            fields.append("apiName")
            break
    return fields or ["name"]
