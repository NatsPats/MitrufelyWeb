"""
Mifrufely Web — Issues Service
"""

from datetime import datetime
from typing import List, Optional

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, BusinessRuleError
from app.infrastructure.database.models.pedidos_ext import OrderIssue
from app.infrastructure.database.models.usuarios import Cliente, Usuario
from app.infrastructure.database.models.ventas import Venta
from app.infrastructure.database.models.enums import EstadoIncidenciaEnum, TipoResolucionEnum
from app.modules.issues.schemas import (
    CreateIssueRequest,
    IssueResponse,
    UpdateIssueRequest,
    AdminIssueResponse,
    IssueMetricsResponse,
)
from sqlalchemy import func

logger = structlog.get_logger(__name__)


class IssueService:
    def __init__(self, session: AsyncSession, venta_service: "VentaService" = None) -> None:
        self.session = session
        self.venta_service = venta_service

    async def crear_incidencia(
        self,
        id_venta: int,
        id_usuario: int,
        dto: CreateIssueRequest,
    ) -> IssueResponse:
        stmt_venta = select(Venta).where(Venta.id_venta == id_venta)
        result = await self.session.execute(stmt_venta)
        if not result.scalar_one_or_none():
            raise NotFoundError(f"Venta #{id_venta} no encontrada.")

        issue = OrderIssue(
            id_venta=id_venta,
            issue_type=dto.issue_type,
            description=dto.description,
            reported_by=id_usuario,
        )
        self.session.add(issue)
        await self.session.flush()
        logger.info("issue.created", id_venta=id_venta, type=dto.issue_type)

        await self.session.refresh(issue)
        return IssueResponse.model_validate(issue)

    async def actualizar_incidencia(
        self,
        id_issue: int,
        id_usuario: int,
        dto: UpdateIssueRequest,
    ) -> IssueResponse:
        stmt = select(OrderIssue).where(OrderIssue.id_issue == id_issue)
        result = await self.session.execute(stmt)
        issue = result.scalar_one_or_none()

        if not issue:
            raise NotFoundError(f"Incidencia #{id_issue} no encontrada.")

        # Update status and resolution
        issue.status = dto.status
        if dto.resolution:
            issue.resolution = dto.resolution
            issue.resolved_by = id_usuario
        issue.updated_at = datetime.utcnow()
        await self.session.flush()

        # Handle resolution type contable actions if status is RESUELTA
        if dto.status == EstadoIncidenciaEnum.RESUELTA and dto.resolution_type:
            # Import request schemas locally to avoid circular dependencies
            from app.modules.orders.schemas import DevolucionRequest, ReembolsoRequest
            
            # Since IssueService shares the session and has already started a transaction,
            # VentaService.solicitar_devolucion will crash when it calls `async with self.session.begin():`.
            # To fix this, we can commit the current transaction first, so VentaService can start a new one.
            await self.session.commit()
            
            if dto.resolution_type == TipoResolucionEnum.DEVOLUCION:
                if self.venta_service:
                    req = DevolucionRequest(motivo=dto.resolution or "Resolución de incidencia", observaciones="Automático desde incidencias")
                    await self.venta_service.solicitar_devolucion(issue.id_venta, id_usuario, req, es_admin=True)
            elif dto.resolution_type == TipoResolucionEnum.REEMBOLSO:
                if self.venta_service:
                    monto = dto.monto_reembolso or 0.0
                    if monto <= 0.0:
                        raise BusinessRuleError("El monto a reembolsar debe ser mayor que 0.")
                    req = ReembolsoRequest(monto=monto, motivo=dto.resolution or "Resolución de incidencia")
                    await self.venta_service.procesar_reembolso(issue.id_venta, id_usuario, req)
                    
            # Re-fetch the issue since the session was committed
            stmt = select(OrderIssue).where(OrderIssue.id_issue == id_issue)
            result = await self.session.execute(stmt)
            issue = result.scalar_one()

        await self.session.refresh(issue)
        return IssueResponse.model_validate(issue)

    async def get_all(self, limit: int = 50, offset: int = 0) -> List[AdminIssueResponse]:
        stmt = (
            select(OrderIssue, Cliente, Venta, Usuario)
            .join(Venta, OrderIssue.id_venta == Venta.id_venta)
            .join(Cliente, Venta.id_cliente == Cliente.id_cliente)
            .join(Usuario, Cliente.id_usuario == Usuario.id_usuario)
            .order_by(OrderIssue.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        issues = []
        for issue, cliente, venta, usuario in result:
            data = IssueResponse.model_validate(issue).model_dump()
            data["cliente_nombre"] = f"{usuario.nombres} {usuario.apellidos}"
            data["estado_pedido"] = venta.estado.value
            issues.append(AdminIssueResponse(**data))
        return issues

    async def get_by_venta(self, id_venta: int) -> List[IssueResponse]:
        stmt = select(OrderIssue).where(OrderIssue.id_venta == id_venta)
        result = await self.session.execute(stmt)
        return [IssueResponse.model_validate(i) for i in result.scalars()]

    async def get_metrics(self) -> IssueMetricsResponse:
        stmt_total = select(func.count(OrderIssue.id_issue))
        total = await self.session.scalar(stmt_total) or 0

        # Estados
        stmt_states = select(OrderIssue.status, func.count(OrderIssue.id_issue)).group_by(OrderIssue.status)
        states_res = await self.session.execute(stmt_states)
        
        abiertas = 0
        resueltas = 0
        cerradas = 0
        en_revision = 0
        
        for status_enum, count in states_res:
            val = status_enum.value if hasattr(status_enum, 'value') else status_enum
            if val == EstadoIncidenciaEnum.ABIERTA.value: abiertas = count
            elif val == EstadoIncidenciaEnum.RESUELTA.value: resueltas = count
            elif val == EstadoIncidenciaEnum.CERRADA.value: cerradas = count
            elif val == EstadoIncidenciaEnum.EN_REVISION.value: en_revision = count

        # Tipos
        stmt_types = select(OrderIssue.issue_type, func.count(OrderIssue.id_issue)).group_by(OrderIssue.issue_type)
        types_res = await self.session.execute(stmt_types)
        
        por_tipo = {}
        for t_enum, count in types_res:
            val = t_enum.value if hasattr(t_enum, 'value') else t_enum
            por_tipo[val] = count

        return IssueMetricsResponse(
            total_incidencias=total,
            abiertas=abiertas,
            resueltas=resueltas,
            cerradas=cerradas,
            en_revision=en_revision,
            por_tipo=por_tipo
        )
