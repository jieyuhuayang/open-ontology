"""Agent data access layer — sessions, messages, audit logs."""

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.storage.models import AgentAuditLogModel, AgentMessageModel, AgentSessionModel


class AgentStorage:
    @staticmethod
    async def create_session(session: AsyncSession, model: AgentSessionModel) -> AgentSessionModel:
        session.add(model)
        await session.flush()
        return model

    @staticmethod
    async def get_session(session: AsyncSession, rid: str) -> AgentSessionModel | None:
        stmt = select(AgentSessionModel).where(AgentSessionModel.rid == rid)
        result = await session.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def list_sessions(
        session: AsyncSession, page: int, page_size: int
    ) -> tuple[list[AgentSessionModel], int]:
        count_stmt = select(func.count()).select_from(AgentSessionModel)
        total = (await session.execute(count_stmt)).scalar_one()

        stmt = (
            select(AgentSessionModel)
            .order_by(AgentSessionModel.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await session.execute(stmt)
        return list(result.scalars().all()), total

    @staticmethod
    async def update_session_status(
        session: AsyncSession, rid: str, status: str
    ) -> AgentSessionModel | None:
        orm = await AgentStorage.get_session(session, rid)
        if orm is None:
            return None
        orm.status = status
        await session.flush()
        return orm

    @staticmethod
    async def delete_session(session: AsyncSession, rid: str) -> bool:
        stmt = delete(AgentSessionModel).where(AgentSessionModel.rid == rid)
        result = await session.execute(stmt)
        return result.rowcount > 0

    @staticmethod
    async def count_active_sessions(session: AsyncSession) -> int:
        stmt = (
            select(func.count())
            .select_from(AgentSessionModel)
            .where(AgentSessionModel.status == "active")
        )
        return (await session.execute(stmt)).scalar_one()

    @staticmethod
    async def create_message(session: AsyncSession, model: AgentMessageModel) -> AgentMessageModel:
        session.add(model)
        await session.flush()
        return model

    @staticmethod
    async def list_messages_by_session(
        session: AsyncSession, session_rid: str
    ) -> list[AgentMessageModel]:
        stmt = (
            select(AgentMessageModel)
            .where(AgentMessageModel.session_rid == session_rid)
            .order_by(AgentMessageModel.created_at.asc())
        )
        result = await session.execute(stmt)
        return list(result.scalars().all())

    @staticmethod
    async def create_audit_log(
        session: AsyncSession, model: AgentAuditLogModel
    ) -> AgentAuditLogModel:
        session.add(model)
        await session.flush()
        return model
