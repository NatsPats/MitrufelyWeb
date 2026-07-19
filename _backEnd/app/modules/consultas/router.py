"""
Mitrufely Web — Consultas Router
Endpoint de consulta de DNI/RUC contra json.pe (con cache Redis).
NO persiste — solo devuelve datos para que el frontend rellene el formulario.
"""

from typing import Annotated

import sys
from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.modules.consultas.dependencies import ConsultasServiceDep
from app.modules.consultas.schemas import DocumentoLookupRequest, DocumentoLookupResult
from app.security.dependencies import AuthUser, get_current_user
from app.shared.schemas.response import APIResponse

router = APIRouter(prefix="/consultas", tags=["Consultas DNI/RUC"])

# Limiter local: 10 consultas por minuto por IP.
# Bajo pytest se utiliza almacenamiento en memoria para no requerir Redis levantado.
_storage_uri = "memory://" if "pytest" in sys.modules else settings.REDIS_URL
_limiter = Limiter(key_func=get_remote_address, storage_uri=_storage_uri)


@router.post(
    "/documento",
    response_model=APIResponse[DocumentoLookupResult],
    summary="Consultar DNI/RUC",
    description=(
        "Consulta datos de identidad (DNI) o fiscales (RUC) contra json.pe, "
        "usando cache Redis de 24h. No persiste — el frontend debe guardar "
        "los datos devueltos vía /auth/me/datos-fiscales."
    ),
)
@_limiter.limit("10/minute")
async def lookup_documento(
    request: Request,  # inyectado por slowapi (debe estar como parámetro)
    payload: DocumentoLookupRequest,
    current_user: Annotated[AuthUser, Depends(get_current_user)],
    service: ConsultasServiceDep,
) -> APIResponse[DocumentoLookupResult]:
    result = await service.consultar_documento(
        tipo=payload.tipo_documento,
        numero=payload.numero_documento,
    )
    return APIResponse(success=True, data=result)
