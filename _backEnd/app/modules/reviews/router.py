"""
Mifrufely Web — Reviews Router
"""

from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.modules.reviews.schemas import CreateReviewRequest, ReviewResponse, AdminReviewResponse, ReviewMetricsResponse
from app.modules.reviews.service import ReviewService
from app.security.dependencies import AdminUser, AuthUser

router = APIRouter(tags=["Calificaciones"])


def get_review_service(session: AsyncSession = Depends(get_db_session)) -> ReviewService:
    return ReviewService(session=session)


ReviewServiceDep = Annotated[ReviewService, Depends(get_review_service)]


@router.post(
    "/ventas/{id_venta}/review",
    response_model=ReviewResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Calificar un pedido entregado",
)
async def crear_review(
    id_venta: int,
    payload: CreateReviewRequest,
    current_user: AuthUser,
    service: ReviewServiceDep,
) -> ReviewResponse:
    """Crea una calificación de 1-5 estrellas para un pedido en estado ENTREGADO."""
    return await service.crear_review(
        id_venta=id_venta,
        id_usuario=current_user.user_id,
        dto=payload,
    )


@router.get(
    "/ventas/{id_venta}/review",
    response_model=Optional[ReviewResponse],
    status_code=status.HTTP_200_OK,
    summary="Obtener calificación de un pedido",
)
async def get_review(
    id_venta: int,
    current_user: AuthUser,
    service: ReviewServiceDep,
) -> Optional[ReviewResponse]:
    return await service.get_review_by_venta(id_venta=id_venta)


@router.get(
    "/admin/reviews",
    response_model=List[AdminReviewResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar todas las calificaciones (admin)",
)
async def list_reviews(
    current_user: AdminUser,
    service: ReviewServiceDep,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> List[AdminReviewResponse]:
    return await service.get_all_reviews(limit=limit, offset=offset)


@router.get(
    "/admin/reviews/metrics",
    response_model=ReviewMetricsResponse,
    status_code=status.HTTP_200_OK,
    summary="Métricas de calificaciones (admin)",
)
async def get_review_metrics(
    current_user: AdminUser,
    service: ReviewServiceDep,
) -> ReviewMetricsResponse:
    return await service.get_metrics()
