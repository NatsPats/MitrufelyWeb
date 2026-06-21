"""
Mifrufely Web — System Config Router
Endpoints administrativos para gestionar la configuración del sistema.
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.modules.config.dependencies import get_config_service
from app.modules.config.schemas import ShippingConfigResponse, UpdateShippingConfigRequest
from app.modules.config.service import SystemConfigService
from app.security.dependencies import AdminUser

router = APIRouter(prefix="/admin/config", tags=["Configuración del Sistema"])

ConfigServiceDep = Annotated[SystemConfigService, Depends(get_config_service)]


@router.get(
    "/shipping",
    response_model=ShippingConfigResponse,
    summary="Obtener configuración de envío actual",
)
async def get_shipping_config(
    current_user: AdminUser,
    service: ConfigServiceDep,
) -> ShippingConfigResponse:
    """Retorna la configuración de costo de envío y ETA."""
    return await service.get_shipping_config()


@router.put(
    "/shipping",
    response_model=ShippingConfigResponse,
    summary="Actualizar configuración de envío",
)
async def update_shipping_config(
    payload: UpdateShippingConfigRequest,
    current_user: AdminUser,
    service: ConfigServiceDep,
) -> ShippingConfigResponse:
    """
    Actualiza uno o más parámetros de configuración de envío.
    Solo campos enviados en el payload serán actualizados.
    """
    return await service.update_shipping_config(dto=payload, id_usuario=current_user.user_id)
