"""
Mifrufely Web — Notifications Service
"""

from datetime import datetime
from typing import List

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.infrastructure.database.models.pedidos_ext import Notification
from app.modules.notifications.schemas import NotificationResponse, UnreadCountResponse

logger = structlog.get_logger(__name__)


class NotificationService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_mis_notificaciones(
        self,
        id_usuario: int,
        limit: int = 50,
        solo_no_leidas: bool = False,
    ) -> List[NotificationResponse]:
        stmt = select(Notification).where(Notification.id_usuario == id_usuario)
        if solo_no_leidas:
            stmt = stmt.where(Notification.is_read.is_(False))
        stmt = stmt.order_by(Notification.created_at.desc()).limit(limit)
        result = await self.session.execute(stmt)
        return [NotificationResponse.model_validate(n) for n in result.scalars()]

    async def get_unread_count(self, id_usuario: int) -> UnreadCountResponse:
        from sqlalchemy import func
        stmt = (
            select(func.count(Notification.id_notification))
            .where(
                Notification.id_usuario == id_usuario,
                Notification.is_read.is_(False),
            )
        )
        result = await self.session.execute(stmt)
        count = result.scalar_one_or_none() or 0
        return UnreadCountResponse(unread_count=count)

    async def marcar_leida(self, id_notification: int, id_usuario: int) -> NotificationResponse:
        stmt = select(Notification).where(
            Notification.id_notification == id_notification,
            Notification.id_usuario == id_usuario,
        )
        result = await self.session.execute(stmt)
        notif = result.scalar_one_or_none()

        if not notif:
            raise NotFoundError(f"Notificación #{id_notification} no encontrada.")

        async with self.session.begin():
            notif.is_read = True
            notif.read_at = datetime.utcnow()
            await self.session.flush()

        await self.session.refresh(notif)
        return NotificationResponse.model_validate(notif)

    async def marcar_todas_leidas(self, id_usuario: int) -> int:
        """Marca todas las notificaciones del usuario como leídas. Retorna cantidad afectada."""
        async with self.session.begin():
            stmt = (
                update(Notification)
                .where(
                    Notification.id_usuario == id_usuario,
                    Notification.is_read.is_(False),
                )
                .values(is_read=True, read_at=datetime.utcnow())
            )
            result = await self.session.execute(stmt)
            return result.rowcount
