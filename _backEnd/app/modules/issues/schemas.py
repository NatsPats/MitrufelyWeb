"""
Mifrufely Web — Issues Schemas
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field

from app.infrastructure.database.models.enums import EstadoIncidenciaEnum, TipoIncidenciaEnum, TipoResolucionEnum


class CreateIssueRequest(BaseModel):
    issue_type: TipoIncidenciaEnum = Field(..., description="Tipo de incidencia")
    description: str = Field(..., min_length=10, max_length=2000)


class UpdateIssueRequest(BaseModel):
    status: EstadoIncidenciaEnum = Field(..., description="Nuevo estado de la incidencia")
    resolution: Optional[str] = Field(None, max_length=2000, description="Resolución aplicada")
    resolution_type: Optional[TipoResolucionEnum] = Field(None, description="Tipo de resolución contable")
    monto_reembolso: Optional[float] = Field(None, description="Monto a reembolsar si aplica")


class IssueResponse(BaseModel):
    id_issue: int
    id_venta: int
    issue_type: str
    description: str
    status: str
    reported_by: Optional[int] = None
    resolved_by: Optional[int] = None
    resolution: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminIssueResponse(IssueResponse):
    cliente_nombre: str
    estado_pedido: str

    model_config = ConfigDict(from_attributes=True)


class IssueMetricsResponse(BaseModel):
    total_incidencias: int
    abiertas: int
    resueltas: int
    cerradas: int
    en_revision: int
    por_tipo: dict[str, int]
