"""
Mitrufely Web — Consultas Module Dependencies
Wiring FastAPI para el ConsultasService.
"""

from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.database.session import get_db_session
from app.modules.consultas.service import ConsultasService
from app.security.dependencies import AuthUser, get_current_user
from app.shared.external.jsonpe.client import JsonPeClient
from app.shared.external.jsonpe.dependencies import get_jsonpe_client


def get_consultas_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    redis: Annotated[Redis, Depends(get_redis)],
    jsonpe_client: Annotated[JsonPeClient, Depends(get_jsonpe_client)],
    current_user: Annotated[AuthUser, Depends(get_current_user)],
) -> ConsultasService:
    """Factory del ConsultasService (una instancia por request)."""
    return ConsultasService(
        session=session,
        redis=redis,
        jsonpe_client=jsonpe_client,
        user_id=current_user.user_id,
    )


ConsultasServiceDep = Annotated[ConsultasService, Depends(get_consultas_service)]
