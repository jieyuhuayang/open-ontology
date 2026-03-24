"""Agent material data access layer — file upload metadata persistence."""

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.storage.models import AgentMaterialModel


class MaterialStorage:
    @staticmethod
    async def create(session: AsyncSession, model: AgentMaterialModel) -> AgentMaterialModel:
        session.add(model)
        await session.flush()
        return model

    @staticmethod
    async def get(session: AsyncSession, rid: str) -> AgentMaterialModel | None:
        stmt = select(AgentMaterialModel).where(AgentMaterialModel.rid == rid)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_by_session(session: AsyncSession, session_rid: str) -> list[AgentMaterialModel]:
        stmt = (
            select(AgentMaterialModel)
            .where(AgentMaterialModel.session_rid == session_rid)
            .order_by(AgentMaterialModel.created_at.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def count_by_session(session: AsyncSession, session_rid: str) -> int:
        stmt = (
            select(func.count())
            .select_from(AgentMaterialModel)
            .where(AgentMaterialModel.session_rid == session_rid)
        )
        return (await session.execute(stmt)).scalar_one()

    @staticmethod
    async def update_analysis_status(
        session: AsyncSession,
        rid: str,
        status: str,
        result: dict | None = None,
        error_message: str | None = None,
    ) -> AgentMaterialModel | None:
        orm = await MaterialStorage.get(session, rid)
        if orm is None:
            return None
        orm.analysis_status = status
        if result is not None:
            orm.analysis_result = result
        if error_message is not None:
            orm.error_message = error_message
        await session.flush()
        await session.refresh(orm)
        return orm

    @staticmethod
    async def delete(session: AsyncSession, rid: str) -> bool:
        stmt = delete(AgentMaterialModel).where(AgentMaterialModel.rid == rid)
        result = await session.execute(stmt)
        return result.rowcount > 0

    @staticmethod
    async def delete_by_session(session: AsyncSession, session_rid: str) -> int:
        stmt = delete(AgentMaterialModel).where(AgentMaterialModel.session_rid == session_rid)
        result = await session.execute(stmt)
        return result.rowcount
