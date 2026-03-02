"""Property data access layer."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.object_type import ResourceStatus, Visibility
from app.domain.property import Property, StructField
from app.storage.models import ObjectTypeModel, PropertyModel


class PropertyStorage:
    @staticmethod
    def _to_domain(orm: PropertyModel) -> Property:
        struct_schema = None
        if orm.struct_schema is not None:
            struct_schema = [StructField.model_validate(f) for f in orm.struct_schema]

        base_type = orm.base_type if isinstance(orm.base_type, str) else orm.base_type.value
        array_inner_type = None
        if orm.array_inner_type is not None:
            array_inner_type = (
                orm.array_inner_type
                if isinstance(orm.array_inner_type, str)
                else orm.array_inner_type.value
            )

        return Property(
            rid=orm.rid,
            id=orm.id,
            api_name=orm.api_name,
            object_type_rid=orm.object_type_rid,
            display_name=orm.display_name,
            description=orm.description,
            base_type=base_type,
            array_inner_type=array_inner_type,
            struct_schema=struct_schema,
            backing_column=orm.backing_column,
            status=ResourceStatus(orm.status if isinstance(orm.status, str) else orm.status.value),
            visibility=Visibility(
                orm.visibility if isinstance(orm.visibility, str) else orm.visibility.value
            ),
            is_primary_key=orm.is_primary_key,
            is_title_key=orm.is_title_key,
            sort_order=orm.sort_order,
            created_at=orm.created_at,
            created_by=orm.created_by,
            last_modified_at=orm.last_modified_at,
            last_modified_by=orm.last_modified_by,
        )

    @staticmethod
    async def list_by_ontology(session: AsyncSession, ontology_rid: str) -> list[Property]:
        """List all properties across all object types in an ontology."""
        stmt = (
            select(PropertyModel)
            .join(ObjectTypeModel, PropertyModel.object_type_rid == ObjectTypeModel.rid)
            .where(ObjectTypeModel.ontology_rid == ontology_rid)
            .order_by(PropertyModel.sort_order, PropertyModel.created_at)
        )
        result = await session.execute(stmt)
        return [PropertyStorage._to_domain(orm) for orm in result.scalars().all()]

    @staticmethod
    async def list_by_object_type(session: AsyncSession, object_type_rid: str) -> list[Property]:
        """List all properties for a specific object type."""
        stmt = (
            select(PropertyModel)
            .where(PropertyModel.object_type_rid == object_type_rid)
            .order_by(PropertyModel.sort_order, PropertyModel.created_at)
        )
        result = await session.execute(stmt)
        return [PropertyStorage._to_domain(orm) for orm in result.scalars().all()]

    @staticmethod
    async def get_by_rid(session: AsyncSession, rid: str) -> Property | None:
        stmt = select(PropertyModel).where(PropertyModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        return PropertyStorage._to_domain(orm) if orm else None

    @staticmethod
    async def create(session: AsyncSession, model: Property) -> Property:
        struct_schema_json = None
        if model.struct_schema is not None:
            struct_schema_json = [
                f.model_dump(mode="json", by_alias=True) for f in model.struct_schema
            ]

        orm = PropertyModel(
            rid=model.rid,
            id=model.id,
            api_name=model.api_name,
            object_type_rid=model.object_type_rid,
            display_name=model.display_name,
            description=model.description,
            base_type=model.base_type,
            array_inner_type=model.array_inner_type,
            struct_schema=struct_schema_json,
            backing_column=model.backing_column,
            status=model.status.value,
            visibility=model.visibility.value,
            is_primary_key=model.is_primary_key,
            is_title_key=model.is_title_key,
            sort_order=model.sort_order,
            created_at=model.created_at,
            created_by=model.created_by,
            last_modified_at=model.last_modified_at,
            last_modified_by=model.last_modified_by,
        )
        session.add(orm)
        await session.flush()
        return model

    @staticmethod
    async def update(session: AsyncSession, rid: str, data: dict) -> None:
        """Update property fields using snake_case keys."""
        stmt = select(PropertyModel).where(PropertyModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one()
        for key, value in data.items():
            setattr(orm, key, value)
        await session.flush()

    @staticmethod
    async def delete(session: AsyncSession, rid: str) -> None:
        stmt = select(PropertyModel).where(PropertyModel.rid == rid)
        result = await session.execute(stmt)
        orm = result.scalar_one_or_none()
        if orm:
            await session.delete(orm)
            await session.flush()

    @staticmethod
    async def count_by_object_type(session: AsyncSession, object_type_rid: str) -> int:
        """Count published properties for a specific object type (for limit check)."""
        stmt = (
            select(func.count())
            .select_from(PropertyModel)
            .where(PropertyModel.object_type_rid == object_type_rid)
        )
        result = await session.execute(stmt)
        return result.scalar_one()
