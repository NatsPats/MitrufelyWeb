"""
Mifrufely Web — System Config Dependencies (DI Wiring)
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.database.session import get_db_session
from app.modules.config.repository_impl import SystemConfigRepositoryImpl
from app.modules.config.service import SystemConfigService


def get_config_repository(
    session: AsyncSession = Depends(get_db_session),
) -> SystemConfigRepositoryImpl:
    return SystemConfigRepositoryImpl(session)


async def get_config_service(
    repo: SystemConfigRepositoryImpl = Depends(get_config_repository),
    redis=Depends(get_redis),
) -> SystemConfigService:
    return SystemConfigService(repo=repo, redis=redis)
