"""
Mifrufely Web — Reviews Service
"""

from typing import List, Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.infrastructure.database.models.enums import EstadoVentaEnum
from app.infrastructure.database.models.pedidos_ext import OrderReview
from app.infrastructure.database.models.usuarios import Cliente, Usuario
from app.infrastructure.database.models.ventas import Venta
from app.modules.reviews.schemas import (
    CreateReviewRequest,
    ReviewResponse,
    AdminReviewResponse,
    ReviewMetricsResponse,
)
from sqlalchemy import func

logger = structlog.get_logger(__name__)


class ReviewService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def crear_review(
        self,
        id_venta: int,
        id_usuario: int,
        dto: CreateReviewRequest,
    ) -> ReviewResponse:
        """
        Crea una calificación para un pedido ENTREGADO.
        Reglas:
          - El pedido debe estar en estado ENTREGADO.
          - Solo el cliente dueño del pedido puede calificar.
          - Solo se permite una calificación por pedido.
        """
        # Cargar venta
        stmt_venta = select(Venta).where(Venta.id_venta == id_venta)
        result_venta = await self.session.execute(stmt_venta)
        venta = result_venta.scalar_one_or_none()

        if not venta:
            raise NotFoundError(f"Venta #{id_venta} no encontrada.")

        if venta.estado != EstadoVentaEnum.ENTREGADO:
            raise BusinessRuleError(
                f"Solo puedes calificar pedidos entregados. "
                f"Este pedido está en estado '{venta.estado.value}'."
            )

        # Verificar que el cliente sea el dueño
        stmt_cli = select(Cliente).where(Cliente.id_usuario == id_usuario)
        result_cli = await self.session.execute(stmt_cli)
        cliente = result_cli.scalar_one_or_none()

        if not cliente or venta.id_cliente != cliente.id_cliente:
            raise BusinessRuleError("No puedes calificar un pedido que no es tuyo.")

        # Verificar que no exista ya una calificación
        stmt_existing = select(OrderReview).where(OrderReview.id_venta == id_venta)
        result_existing = await self.session.execute(stmt_existing)
        if result_existing.scalar_one_or_none():
            raise BusinessRuleError(f"El pedido #{id_venta} ya fue calificado.")

        review = OrderReview(
            id_venta=id_venta,
            id_cliente=cliente.id_cliente,
            rating=dto.rating,
            comment=dto.comment,
        )
        self.session.add(review)
        await self.session.flush()
        logger.info("review.created", id_venta=id_venta, rating=dto.rating)

        await self.session.refresh(review)
        return ReviewResponse.model_validate(review)

    async def get_review_by_venta(self, id_venta: int) -> Optional[ReviewResponse]:
        stmt = select(OrderReview).where(OrderReview.id_venta == id_venta)
        result = await self.session.execute(stmt)
        review = result.scalar_one_or_none()
        return ReviewResponse.model_validate(review) if review else None

    async def get_all_reviews(self, limit: int = 50, offset: int = 0) -> List[AdminReviewResponse]:
        stmt = (
            select(OrderReview, Cliente, Venta, Usuario)
            .join(Cliente, OrderReview.id_cliente == Cliente.id_cliente)
            .join(Venta, OrderReview.id_venta == Venta.id_venta)
            .join(Usuario, Cliente.id_usuario == Usuario.id_usuario)
            .order_by(OrderReview.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        reviews = []
        for review, cliente, venta, usuario in result:
            data = ReviewResponse.model_validate(review).model_dump()
            data["cliente_nombre"] = f"{usuario.nombres} {usuario.apellidos}"
            data["estado_pedido"] = venta.estado.value
            reviews.append(AdminReviewResponse(**data))
        return reviews

    async def get_metrics(self) -> ReviewMetricsResponse:
        stmt_total = select(func.count(OrderReview.id_review))
        total = await self.session.scalar(stmt_total) or 0

        stmt_avg = select(func.avg(OrderReview.rating))
        avg_rating = await self.session.scalar(stmt_avg) or 0.0

        stmt_dist = select(OrderReview.rating, func.count(OrderReview.id_review)).group_by(OrderReview.rating)
        dist_res = await self.session.execute(stmt_dist)
        dist_dict = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0}
        for rating, count in dist_res:
            dist_dict[rating] = count

        return ReviewMetricsResponse(
            total_reviews=total,
            promedio_calificacion=round(float(avg_rating), 1),
            distribucion_estrellas=dist_dict
        )
