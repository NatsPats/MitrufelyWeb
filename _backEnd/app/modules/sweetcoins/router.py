"""
Mifrufely Web — API Router: CriptoTrufa / SweetCoins (Módulo M06)
Exposes points and coupon endpoints for clients and administrators.
"""

import json
from typing import Annotated, List
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from redis.asyncio import Redis

from app.core.exceptions import MifrufelyBaseError
from app.infrastructure.cache.redis_client import get_redis
from app.modules.sweetcoins.dependencies import get_sweetcoins_service
from app.modules.sweetcoins.schemas import (
    AdjustPointsRequest,
    ConfigRecompensasResponse,
    CuponClienteResponse,
    CuponMaestroResponse,
    MovimientoPuntosResponse,
    RedeemCouponRequest,
    SweetCoinsDashboardResponse,
    CreateCuponMaestroRequest,
    UpdateCuponMaestroRequest,
    ClienteSaldoResponse,
    UpdateConfigRecompensasRequest,
    RuletaResponse,
)
from app.modules.sweetcoins.service import SweetCoinsService
from app.security.dependencies import AdminUser, AuthUser

router = APIRouter(prefix="/cripto-trufa", tags=["CriptoTrufas & Recompensas"])

SweetCoinsServiceDep = Annotated[SweetCoinsService, Depends(get_sweetcoins_service)]
RedisDep = Annotated[Redis, Depends(get_redis)]


# ── CLIENT ENDPOINTS ──────────────────────────────────────────────────────────

@router.get(
    "/dashboard",
    response_model=SweetCoinsDashboardResponse,
    summary="Obtiene consolidado de fidelización del cliente",
    description="Devuelve el balance actual, los cupones activos y los últimos 5 movimientos en una sola llamada."
)
async def get_dashboard(
    current_user: AuthUser,
    service: SweetCoinsServiceDep
) -> dict:
    try:
        return await service.get_dashboard(current_user.user_id)
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/balance",
    response_model=int,
    summary="Obtiene el saldo de CriptoTrufas actual del cliente"
)
async def get_balance(
    current_user: AuthUser,
    service: SweetCoinsServiceDep
) -> int:
    try:
        return await service.get_balance(current_user.user_id)
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/history",
    response_model=List[MovimientoPuntosResponse],
    summary="Obtiene el historial de movimientos de puntos"
)
async def get_history(
    current_user: AuthUser,
    service: SweetCoinsServiceDep
) -> list:
    try:
        return await service.get_history(current_user.user_id)
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/coupons/available",
    response_model=List[CuponMaestroResponse],
    summary="Obtiene cupones maestros disponibles para canje",
    description="Retorna cupones activos canjeables por puntos. Cacheado en Redis por 5 minutos."
)
async def get_available_coupons(
    current_user: AuthUser,
    service: SweetCoinsServiceDep,
    redis: RedisDep
) -> list:
    cache_key = "sweetcoins:coupons:available"
    try:
        # Intentar leer desde caché de Redis
        cached_data = await redis.get(cache_key)
        if cached_data:
            return json.loads(cached_data)
        
        # Si no hay caché, consultar base de datos
        coupons = await service.get_available_coupons()
        
        # Guardar en caché con TTL de 5 minutos (300 segundos)
        # Convertir objetos ORM a esquemas Pydantic para serializar a JSON
        pydantic_coupons = [CuponMaestroResponse.model_validate(c).model_dump(mode="json") for c in coupons]
        await redis.set(cache_key, json.dumps(pydantic_coupons), ex=300)
        
        return coupons
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post(
    "/coupons/redeem",
    response_model=CuponClienteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Canjea un cupón de descuento por CriptoTrufas",
    description="Valida saldo y genera un cupón del cliente con código único. Soporta cabecera Idempotency-Key."
)
async def redeem_coupon(
    body: RedeemCouponRequest,
    current_user: AuthUser,
    service: SweetCoinsServiceDep,
    redis: RedisDep,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key")
) -> CuponClienteResponse:
    # ── Validación de Idempotencia con Redis ──
    if idempotency_key:
        redis_key = f"idempotency:redeem:{current_user.user_id}:{idempotency_key}"
        # Intentar guardar la clave con setnx (retorna True si se creó de cero, False si ya existía)
        is_new = await redis.set(redis_key, "processing", ex=120, nx=True)
        if not is_new:
            # Obtener estado actual
            status_val = await redis.get(redis_key)
            if status_val == b"processing":
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Tu solicitud de canje ya se está procesando. Por favor, espera."
                )
            else:
                # Si ya finalizó, devolver la respuesta guardada
                return json.loads(status_val)

    try:
        cupon_cliente = await service.canjear_cupon(
            id_usuario=current_user.user_id,
            id_cupon=body.id_cupon,
            idempotency_key=idempotency_key
        )
        
        # Si la operación fue exitosa, serializar y guardar el resultado en Redis para futuras peticiones idénticas
        if idempotency_key:
            res_json = CuponClienteResponse.model_validate(cupon_cliente).model_dump(mode="json")
            await redis.set(redis_key, json.dumps(res_json), ex=120)
            
        return cupon_cliente
        
    except MifrufelyBaseError as e:
        # En caso de error, limpiar la clave de idempotencia de Redis para permitir reintentar
        if idempotency_key:
            await redis.delete(redis_key)
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        if idempotency_key:
            await redis.delete(redis_key)
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/coupons/mine",
    response_model=List[CuponClienteResponse],
    summary="Obtiene los cupones propios adquiridos por el cliente"
)
async def get_my_coupons(
    current_user: AuthUser,
    service: SweetCoinsServiceDep
) -> list:
    try:
        return await service.get_my_coupons(current_user.user_id)
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/public-config",
    response_model=ConfigRecompensasResponse,
    summary="Obtiene la configuración de recompensas activa en el sistema para clientes"
)
async def get_public_config(
    current_user: AuthUser,
    service: SweetCoinsServiceDep
) -> ConfigRecompensasResponse:
    try:
        config = await service._config_repo.get_active()
        if not config:
            raise HTTPException(status_code=404, detail="No se encontró configuración de recompensas activa.")
        return config
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post(
    "/play-ruleta",
    response_model=RuletaResponse,
    summary="Juega en la Ruleta Dulce y obtiene un premio aleatorio",
    description="Deduce 50 CriptoTrufas del saldo del cliente de forma atómica y otorga un premio."
)
async def play_ruleta(
    current_user: AuthUser,
    service: SweetCoinsServiceDep
) -> RuletaResponse:
    try:
        return await service.jugar_ruleta(current_user.user_id)
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── ADMINISTRATOR ENDPOINTS ───────────────────────────────────────────────────

@router.post(
    "/adjust",
    response_model=MovimientoPuntosResponse,
    summary="Realiza un ajuste manual de puntos a un cliente",
    description="Suma o resta puntos de CriptoTrufas a un cliente. Solo ADMIN. Registra auditoría completa."
)
async def adjust_points(
    body: AdjustPointsRequest,
    current_user: AdminUser,
    service: SweetCoinsServiceDep,
    request: Request
) -> MovimientoPuntosResponse:
    client_ip = request.client.host if request.client else "0.0.0.0"
    try:
        return await service.adjust_points(
            id_cliente=body.id_cliente,
            cantidad=body.cantidad,
            justificacion=body.justificacion,
            admin_id=current_user.user_id,
            request_ip=client_ip
        )
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/config",
    response_model=ConfigRecompensasResponse,
    summary="Obtiene la configuración de recompensas activa en el sistema",
    description="Permite ver la tasa de conversión y días de expiración. Solo ADMIN."
)
async def get_active_config(
    current_user: AdminUser,
    service: SweetCoinsServiceDep
) -> ConfigRecompensasResponse:
    try:
        config = await service._config_repo.get_active()
        if not config:
            raise HTTPException(status_code=404, detail="No se encontró configuración de recompensas activa.")
        return config
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put(
    "/config",
    response_model=ConfigRecompensasResponse,
    summary="Actualiza la configuración de recompensas activa en el sistema",
    description="Permite modificar la tasa de conversión, límite de puntos y días de expiración. Solo ADMIN."
)
async def update_active_config(
    body: UpdateConfigRecompensasRequest,
    current_user: AdminUser,
    service: SweetCoinsServiceDep
) -> ConfigRecompensasResponse:
    try:
        return await service.update_config_recompensas(body)
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


# ── ADMIN MANAGEMENT ENDPOINTS (CRUD Y AUDITORÍA) ────────────────────────────

@router.get(
    "/admin/clientes",
    response_model=List[ClienteSaldoResponse],
    summary="Lista todos los clientes con sus saldos de CriptoTrufas",
    description="Solo ADMIN. Retorna una lista con la información de todos los clientes y sus saldos."
)
async def get_clientes_con_saldo(
    current_user: AdminUser,
    service: SweetCoinsServiceDep
) -> list:
    try:
        return await service.get_clientes_con_saldo()
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/admin/history/{id_cliente}",
    response_model=List[MovimientoPuntosResponse],
    summary="Obtiene el historial de puntos de un cliente específico",
    description="Solo ADMIN. Útil para auditoría y visualización de la cuenta de un cliente."
)
async def get_cliente_history_admin(
    id_cliente: int,
    current_user: AdminUser,
    service: SweetCoinsServiceDep
) -> list:
    try:
        return await service.get_cliente_history_admin(id_cliente)
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.get(
    "/admin/coupons",
    response_model=List[CuponMaestroResponse],
    summary="Obtiene la lista de todos los cupones maestros",
    description="Solo ADMIN. Muestra la lista completa de plantillas de cupones, incluyendo las inactivas."
)
async def get_all_coupons_admin(
    current_user: AdminUser,
    service: SweetCoinsServiceDep
) -> list:
    try:
        return await service.get_all_coupons_admin()
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.post(
    "/admin/coupons",
    response_model=CuponMaestroResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crea un nuevo cupón maestro",
    description="Solo ADMIN. Registra un cupón maestro en el catálogo general."
)
async def create_cupon_maestro(
    body: CreateCuponMaestroRequest,
    current_user: AdminUser,
    service: SweetCoinsServiceDep,
    redis: RedisDep
) -> CuponMaestroResponse:
    try:
        cupon = await service.create_cupon_maestro(body)
        # Invalidar la caché de cupones disponibles al hacer cambios en el catálogo
        await redis.delete("sweetcoins:coupons:available")
        return cupon
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.put(
    "/admin/coupons/{id_cupon}",
    response_model=CuponMaestroResponse,
    summary="Actualiza un cupón maestro existente",
    description="Solo ADMIN. Modifica los parámetros de un cupón maestro."
)
async def update_cupon_maestro(
    id_cupon: int,
    body: UpdateCuponMaestroRequest,
    current_user: AdminUser,
    service: SweetCoinsServiceDep,
    redis: RedisDep
) -> CuponMaestroResponse:
    try:
        cupon = await service.update_cupon_maestro(id_cupon, body)
        # Invalidar la caché al actualizar
        await redis.delete("sweetcoins:coupons:available")
        return cupon
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)


@router.delete(
    "/admin/coupons/{id_cupon}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Desactiva un cupón maestro",
    description="Solo ADMIN. Borrado lógico (desactivación) de un cupón maestro."
)
async def delete_cupon_maestro(
    id_cupon: int,
    current_user: AdminUser,
    service: SweetCoinsServiceDep,
    redis: RedisDep
) -> None:
    try:
        await service.delete_cupon_maestro(id_cupon)
        # Invalidar la caché
        await redis.delete("sweetcoins:coupons:available")
    except MifrufelyBaseError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
