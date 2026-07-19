"""
Mitrufely Web — Consultas Module Schemas
Contrato del endpoint POST /consultas/documento hacia el frontend.
"""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DocumentoLookupRequest(BaseModel):
    """Payload de entrada. Tipo + número de documento."""

    tipo_documento: Literal["DNI", "RUC"] = Field(..., description="DNI o RUC.")
    numero_documento: str = Field(..., min_length=8, max_length=11)

    @field_validator("numero_documento")
    @classmethod
    def _solo_digitos(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("El número de documento solo debe contener dígitos.")
        return v

    def longitud_ok(self) -> bool:
        esperado = 8 if self.tipo_documento == "DNI" else 11
        return len(self.numero_documento) == esperado


class DocumentoLookupResult(BaseModel):
    """Respuesta normalizada, agnóstica del tipo de documento.

    El frontend rellena el formulario con estos campos y el usuario decide
    si guardarlos (vía /auth/me/datos-fiscales) o descartarlos.
    """

    model_config = ConfigDict(from_attributes=True)

    tipo_documento: Literal["DNI", "RUC"]
    numero_documento: str
    # DNI
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    # RUC
    razon_social: Optional[str] = None
    direccion_fiscal: Optional[str] = None
    # Metadatos útiles para el frontend
    origen: Literal["api", "cache"] = Field(
        ..., description="Si el dato viene fresco de json.pe o del cache Redis."
    )
    ya_tiene_datos: bool = Field(
        ..., description="True si el usuario ya tenía datos fiscales guardados en BD."
    )
