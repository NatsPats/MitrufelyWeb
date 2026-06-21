"""
Mifrufely Web — Issues Router
"""

from typing import Annotated, List

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.modules.issues.schemas import CreateIssueRequest, IssueResponse, UpdateIssueRequest, AdminIssueResponse, IssueMetricsResponse
from app.modules.issues.service import IssueService
from app.modules.issues.dependencies import get_issue_service
from app.security.dependencies import AdminUser, AuthUser

router = APIRouter(tags=["Incidencias"])



IssueServiceDep = Annotated[IssueService, Depends(get_issue_service)]


@router.post(
    "/ventas/{id_venta}/incidencia",
    response_model=IssueResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Reportar una incidencia en un pedido",
)
async def crear_incidencia(
    id_venta: int,
    payload: CreateIssueRequest,
    current_user: AuthUser,
    service: IssueServiceDep,
) -> IssueResponse:
    return await service.crear_incidencia(
        id_venta=id_venta,
        id_usuario=current_user.user_id,
        dto=payload,
    )


@router.get(
    "/ventas/{id_venta}/incidencias",
    response_model=List[IssueResponse],
    status_code=status.HTTP_200_OK,
    summary="Incidencias de un pedido",
)
async def get_incidencias_venta(
    id_venta: int,
    current_user: AuthUser,
    service: IssueServiceDep,
) -> List[IssueResponse]:
    return await service.get_by_venta(id_venta=id_venta)


@router.get(
    "/admin/incidencias",
    response_model=List[AdminIssueResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar todas las incidencias (admin)",
)
async def list_incidencias(
    current_user: AdminUser,
    service: IssueServiceDep,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
) -> List[AdminIssueResponse]:
    return await service.get_all(limit=limit, offset=offset)


@router.get(
    "/admin/incidencias/metrics",
    response_model=IssueMetricsResponse,
    status_code=status.HTTP_200_OK,
    summary="Métricas de incidencias (admin)",
)
async def get_incidencias_metrics(
    current_user: AdminUser,
    service: IssueServiceDep,
) -> IssueMetricsResponse:
    return await service.get_metrics()


@router.put(
    "/admin/incidencias/{id_issue}",
    response_model=IssueResponse,
    status_code=status.HTTP_200_OK,
    summary="Actualizar estado de una incidencia (admin)",
)
async def actualizar_incidencia(
    id_issue: int,
    payload: UpdateIssueRequest,
    current_user: AdminUser,
    service: IssueServiceDep,
) -> IssueResponse:
    return await service.actualizar_incidencia(
        id_issue=id_issue,
        id_usuario=current_user.user_id,
        dto=payload,
    )
