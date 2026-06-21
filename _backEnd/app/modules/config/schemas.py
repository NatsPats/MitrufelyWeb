"""
Mifrufely Web — System Config Schemas
Pydantic schemas for the system configuration module.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class SystemConfigResponse(BaseModel):
    """Representa un par clave-valor de configuración del sistema."""
    id_config: int
    config_key: str
    config_value: str
    description: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ShippingConfigResponse(BaseModel):
    """Configuración de envío consolidada."""
    shipping_cost: Decimal = Field(..., description="Costo de envío en S/")
    free_shipping_threshold: Decimal = Field(..., description="Monto mínimo para envío gratis (S/)")
    delivery_base_time_minutes: int = Field(..., description="Tiempo base de entrega en minutos")
    preparation_base_time_minutes: int = Field(..., description="Tiempo base de preparación en minutos")
    eta_factor_per_product: int = Field(..., description="Minutos extra de ETA por producto")


class UpdateShippingConfigRequest(BaseModel):
    """Payload para actualizar la configuración de envío desde el panel admin."""
    shipping_cost: Optional[Decimal] = Field(
        None, ge=Decimal("0"), description="Costo de envío en S/ (0 = envío siempre gratis)"
    )
    free_shipping_threshold: Optional[Decimal] = Field(
        None, ge=Decimal("0"), description="Subtotal mínimo para envío gratis. 0 = siempre cobra."
    )
    delivery_base_time_minutes: Optional[int] = Field(
        None, ge=1, le=1440, description="Tiempo base de entrega en minutos (1-1440)"
    )
    preparation_base_time_minutes: Optional[int] = Field(
        None, ge=1, le=480, description="Tiempo base de preparación en minutos (1-480)"
    )
    eta_factor_per_product: Optional[int] = Field(
        None, ge=0, le=60, description="Minutos extra de ETA por producto (0-60)"
    )


class ShippingCalculationResult(BaseModel):
    """Resultado del cálculo de costo de envío para un subtotal dado."""
    subtotal: Decimal
    shipping_cost: Decimal
    free_shipping_applied: bool
    free_shipping_threshold: Decimal
    total_final: Decimal
    mensaje: str
