"""ObjectType data access layer."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.object_type import Icon, ObjectType, ResourceStatus, Visibility
from app.storage.models import LinkTypeEndpointModel, ObjectTypeModel


class ObjectTypeStorage:
    @staticmethod
    def _to_domain(orm: ObjectTypeModel) -> ObjectType:
        return ObjectType(
            rid=orm.rid,
            id=orm.id,
            api_name=orm.api_name,
            display_name=orm.display_name,
            plural_display_name=orm.plural_display_name,
            description=orm.description,
            icon=Icon.model_validate(orm.icon),
            status=ResourceStatus(orm.status if isinstance(orm.status, str) else orm.status.value),
            visibility=Visibility(
                orm.visibility if isinstance(orm.visibility, str) else orm.visibility.value
            ),
            backing_datasource=orm.backing_datasource,
            primary_key_property_id=orm.primary_key_property_id,
            title_key_property_id=orm.title_key_property_id,
            project_rid=orm.project_rid,
            ontology_rid=orm.ontology_rid,
            created_at=orm.created_at,
            created_by=orm.created_by,
            last_modified_at=orm.last_modified_at,
            last_modified_by=orm.last_modified_by,
        )

    @staticmethod
    def _to_dict(model: ObjectType) -> dict:
        data = model.model_dump()
        # JSONB fields need dict/list, not Pydantic model instances
        if model.icon:
            data["icon"] = model.icon.model_dump(mode="json")
        return data

    @staticmethod
    async def list_by_ontology(
        session: AsyncSession,
        ontology_rid: str,
    ) -> list[ObjectType]:
        stmt = (
            select(ObjectTypeModel)
            .where(ObjectTypeModel.ontology_rid == ontology_rid)
            .order_by(ObjectTypeModel.created_at)
        )
        result = await session.execute(stmt)
        return [ObjectTypeStorage._to_domain(orm) for orm in result.scalars().all()]

    @staticmethod
    async def get_by_rid(session: AsyncSession, rid: str) -> ObjectType | None:
        stmt = select(ObjectTypeModel).where(ObjectTypeModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return ObjectTypeStorage._to_domain(orm) if orm else None

    @staticmethod
    async def get_by_id(
        session: AsyncSession,
        ontology_rid: str,
        id_value: str,
    ) -> ObjectType | None:
        stmt = select(ObjectTypeModel).where(
            ObjectTypeModel.ontology_rid == ontology_rid,
            ObjectTypeModel.id == id_value,
        )
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return ObjectTypeStorage._to_domain(orm) if orm else None

    @staticmethod
    async def get_by_api_name(
        session: AsyncSession,
        ontology_rid: str,
        api_name: str,
    ) -> ObjectType | None:
        stmt = select(ObjectTypeModel).where(
            ObjectTypeModel.ontology_rid == ontology_rid,
            ObjectTypeModel.api_name == api_name,
        )
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return ObjectTypeStorage._to_domain(orm) if orm else None

    @staticmethod
    async def create(session: AsyncSession, model: ObjectType) -> ObjectType:
        data = ObjectTypeStorage._to_dict(model)
        data["icon"] = model.icon.model_dump(mode="json")
        data.pop("aliases", None)
        orm = ObjectTypeModel(**data)
        session.add(orm)
        await session.flush()
        return model

    @staticmethod
    async def update(session: AsyncSession, rid: str, data: dict) -> None:
        stmt = select(ObjectTypeModel).where(ObjectTypeModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one()
        for key, value in data.items():
            setattr(orm, key, value)
        await session.flush()

    @staticmethod
    async def delete(session: AsyncSession, rid: str) -> None:
        stmt = select(ObjectTypeModel).where(ObjectTypeModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        if orm:
            await session.delete(orm)
            await session.flush()

    @staticmethod
    async def get_related_link_type_rids(
        session: AsyncSession,
        object_type_rid: str,
    ) -> list[str]:
        stmt = select(LinkTypeEndpointModel.link_type_rid).where(
            LinkTypeEndpointModel.object_type_rid == object_type_rid,
        )
        result = await session.execute(stmt)
        return list(set(result.scalars().all()))
