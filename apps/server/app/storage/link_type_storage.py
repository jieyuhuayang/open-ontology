"""LinkType data access layer."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.link_type import (
    Cardinality,
    JoinMethod,
    LinkSide,
    LinkType,
)
from app.domain.object_type import ResourceStatus, Visibility
from app.storage.models import (
    LinkTypeEndpointModel,
    LinkTypeModel,
    LinkSide as LinkSideEnum,
)


class LinkTypeStorage:
    @staticmethod
    def _to_domain(orm: LinkTypeModel) -> LinkType:
        """Convert ORM LinkTypeModel + endpoints to domain LinkType."""
        side_a = None
        side_b = None
        for ep in orm.endpoints:
            side_val = ep.side if isinstance(ep.side, str) else ep.side.value
            vis_val = ep.visibility if isinstance(ep.visibility, str) else ep.visibility.value
            link_side = LinkSide(
                object_type_rid=ep.object_type_rid,
                display_name=ep.display_name,
                api_name=ep.api_name,
                visibility=Visibility(vis_val),
            )
            if side_val == "A":
                side_a = link_side
            else:
                side_b = link_side

        if side_a is None or side_b is None:
            raise ValueError(f"LinkType {orm.rid} missing side A or B endpoint")

        card_val = orm.cardinality if isinstance(orm.cardinality, str) else orm.cardinality.value
        jm_val = orm.join_method if isinstance(orm.join_method, str) else orm.join_method.value
        st_val = orm.status if isinstance(orm.status, str) else orm.status.value

        return LinkType(
            rid=orm.rid,
            id=orm.id,
            side_a=side_a,
            side_b=side_b,
            cardinality=Cardinality(card_val),
            join_method=JoinMethod(jm_val),
            status=ResourceStatus(st_val),
            project_rid=orm.project_rid,
            ontology_rid=orm.ontology_rid,
            created_at=orm.created_at,
            created_by=orm.created_by,
            last_modified_at=orm.last_modified_at,
            last_modified_by=orm.last_modified_by,
        )

    @staticmethod
    async def list_by_ontology(
        session: AsyncSession,
        ontology_rid: str,
    ) -> list[LinkType]:
        stmt = (
            select(LinkTypeModel)
            .where(LinkTypeModel.ontology_rid == ontology_rid)
            .options(selectinload(LinkTypeModel.endpoints))
            .order_by(LinkTypeModel.created_at)
        )
        result = await session.execute(stmt)
        return [LinkTypeStorage._to_domain(orm) for orm in result.scalars().all()]

    @staticmethod
    async def get_by_rid(session: AsyncSession, rid: str) -> LinkType | None:
        stmt = (
            select(LinkTypeModel)
            .where(LinkTypeModel.rid == rid)
            .options(selectinload(LinkTypeModel.endpoints))
        )
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return LinkTypeStorage._to_domain(orm) if orm else None

    @staticmethod
    async def get_by_id(
        session: AsyncSession,
        ontology_rid: str,
        id_value: str,
    ) -> LinkType | None:
        stmt = (
            select(LinkTypeModel)
            .where(
                LinkTypeModel.ontology_rid == ontology_rid,
                LinkTypeModel.id == id_value,
            )
            .options(selectinload(LinkTypeModel.endpoints))
        )
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return LinkTypeStorage._to_domain(orm) if orm else None

    @staticmethod
    async def get_api_names_for_object_type(
        session: AsyncSession,
        object_type_rid: str,
    ) -> list[tuple[str, str]]:
        """Return list of (link_type_rid, api_name) for all endpoints of the given ObjectType."""
        stmt = select(
            LinkTypeEndpointModel.link_type_rid,
            LinkTypeEndpointModel.api_name,
        ).where(LinkTypeEndpointModel.object_type_rid == object_type_rid)
        result = await session.execute(stmt)
        return list(result.tuples().all())

    @staticmethod
    async def create(session: AsyncSession, model: LinkType) -> LinkType:
        """Insert link_types row + 2 link_type_endpoints rows."""
        orm = LinkTypeModel(
            rid=model.rid,
            id=model.id,
            cardinality=model.cardinality.value,
            join_method=model.join_method.value,
            status=model.status.value,
            project_rid=model.project_rid,
            ontology_rid=model.ontology_rid,
            created_at=model.created_at,
            created_by=model.created_by,
            last_modified_at=model.last_modified_at,
            last_modified_by=model.last_modified_by,
        )
        session.add(orm)
        await session.flush()

        for side_key, side_data in [("A", model.side_a), ("B", model.side_b)]:
            ep = LinkTypeEndpointModel(
                link_type_rid=model.rid,
                side=side_key,
                object_type_rid=side_data.object_type_rid,
                display_name=side_data.display_name,
                api_name=side_data.api_name,
                visibility=side_data.visibility.value,
            )
            session.add(ep)
        await session.flush()

        return model

    @staticmethod
    async def update(session: AsyncSession, rid: str, data: dict) -> None:
        """Update link_types main table and optionally endpoints."""
        stmt = select(LinkTypeModel).where(LinkTypeModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one()

        # Update main table fields
        main_fields = {
            "cardinality",
            "join_method",
            "status",
            "last_modified_at",
            "last_modified_by",
        }
        for key in main_fields:
            if key in data:
                setattr(orm, key, data[key])
        await session.flush()

        # Update endpoints if side_a or side_b data provided
        for side_key in ("side_a", "side_b"):
            if side_key in data and data[side_key]:
                side_enum = "A" if side_key == "side_a" else "B"
                ep_stmt = select(LinkTypeEndpointModel).where(
                    LinkTypeEndpointModel.link_type_rid == rid,
                    LinkTypeEndpointModel.side == side_enum,
                )
                ep_result = await session.execute(ep_stmt)
                ep_orm = ep_result.scalar_one()
                for field, value in data[side_key].items():
                    setattr(ep_orm, field, value)
                await session.flush()

    @staticmethod
    async def delete(session: AsyncSession, rid: str) -> None:
        stmt = (
            select(LinkTypeModel)
            .where(LinkTypeModel.rid == rid)
            .options(selectinload(LinkTypeModel.endpoints))
        )
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        if orm:
            await session.delete(orm)
            await session.flush()
