"""
Mifrufely Web — json.pe API Schemas
Espejo exacto de los payloads devueltos por api.json.pe.
Documentación: https://docs.json.pe/api-consulta/
"""

from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class JsonPeEnvelope(BaseModel, Generic[T]):
    """Envelope estándar de json.pe: {success, message, data}."""

    success: bool
    message: str
    data: Optional[T] = None


class JsonPeDniData(BaseModel):
    """Respuesta de POST /api/dni."""

    numero: Optional[str] = None
    nombres: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
    nombre_completo: Optional[str] = None
    direccion: Optional[str] = None
    direccion_completa: Optional[str] = None
    ubigeo_reniec: Optional[str] = None
    ubigeo_sunat: Optional[str] = None


class JsonPeRucData(BaseModel):
    """Respuesta de POST /api/ruc."""

    ruc: Optional[str] = None
    nombre_o_razon_social: Optional[str] = None
    estado: Optional[str] = None
    condicion: Optional[str] = None
    direccion: Optional[str] = None
    direccion_completa: Optional[str] = None
    distrito: Optional[str] = None
    provincia: Optional[str] = None
    departamento: Optional[str] = None
    ubigeo_sunat: Optional[str] = None


class JsonPeDniRucData(BaseModel):
    """Respuesta de POST /api/dni-ruc (verifica si un DNI tiene RUC)."""

    ruc: Optional[str] = Field(None, description="RUC asociado al DNI, si existe.")
