from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db_session

router = APIRouter(prefix="/api/v1", tags=["health"])


@router.get("/health")
async def health_check(session: AsyncSession = Depends(get_db_session)):
    await session.execute(text("SELECT 1"))
    return {"status": "healthy"}
