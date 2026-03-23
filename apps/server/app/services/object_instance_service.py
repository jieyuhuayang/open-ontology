"""Object instance query service."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.object_instance import ObjectInstance, ObjectInstanceListResponse
from app.exceptions import AppError
from app.storage.object_instance_storage import ObjectInstanceStorage


class ObjectInstanceService:
    def __init__(self, session: AsyncSession):
        self._session = session

    async def list_by_object_type(
        self, ot_rid: str, page: int = 1, page_size: int = 20
    ) -> ObjectInstanceListResponse:
        items, total = await ObjectInstanceStorage.list_by_object_type(
            self._session, ot_rid, page, page_size
        )
        return ObjectInstanceListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
        )

    async def get_by_rid(self, rid: str) -> ObjectInstance:
        instance = await ObjectInstanceStorage.get_by_rid(self._session, rid)
        if not instance:
            raise AppError(
                code="OBJECT_INSTANCE_NOT_FOUND",
                message=f"Object instance '{rid}' not found",
                status_code=404,
            )
        return instance
