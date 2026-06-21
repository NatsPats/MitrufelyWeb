"""
Mifrufely Web — Notifications Router
"""

from typing import Annotated, List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.modules.notifications.schemas import NotificationResponse, UnreadCountResponse
from app.modules.notifications.service import NotificationService
from app.security.dependencies import AuthUser

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


def get_notification_service(session: AsyncSession = Depends(get_db_session)) -> NotificationService:
    return NotificationService(session=session)


NotifServiceDep = Annotated[NotificationService, Depends(get_notification_service)]


@router.get(
    "",
    response_model=List[NotificationResponse],
    status_code=status.HTTP_200_OK,
    summary="Obtener mis notificaciones",
)
async def get_mis_notificaciones(
    current_user: AuthUser,
    service: NotifServiceDep,
    limit: int = Query(50, ge=1, le=100),
    solo_no_leidas: bool = Query(False, description="Filtrar solo no leídas"),
) -> List[NotificationResponse]:
    """Retorna las notificaciones del usuario autenticado, ordenadas por fecha desc."""
    return await service.get_mis_notificaciones(
        id_usuario=current_user.user_id,
        limit=limit,
        solo_no_leidas=solo_no_leidas,
    )


@router.get(
    "/no-leidas",
    response_model=UnreadCountResponse,
    status_code=status.HTTP_200_OK,
    summary="Conteo de notificaciones no leídas",
)
async def get_unread_count(
    current_user: AuthUser,
    service: NotifServiceDep,
) -> UnreadCountResponse:
    """Útil para el badge del bell icon en la navbar."""
    return await service.get_unread_count(id_usuario=current_user.user_id)


@router.put(
    "/{id_notification}/leer",
    response_model=NotificationResponse,
    status_code=status.HTTP_200_OK,
    summary="Marcar notificación como leída",
)
async def marcar_leida(
    id_notification: int,
    current_user: AuthUser,
    service: NotifServiceDep,
) -> NotificationResponse:
    return await service.marcar_leida(
        id_notification=id_notification,
        id_usuario=current_user.user_id,
    )


@router.put(
    "/leer-todas",
    status_code=status.HTTP_200_OK,
    summary="Marcar todas las notificaciones como leídas",
)
async def marcar_todas_leidas(
    current_user: AuthUser,
    service: NotifServiceDep,
) -> dict:
    count = await service.marcar_todas_leidas(id_usuario=current_user.user_id)
    return {"message": f"{count} notificación(es) marcada(s) como leída(s)."}
