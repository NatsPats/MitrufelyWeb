from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.catalogo import Producto
from app.infrastructure.database.session import get_db_session
from app.modules.cart.dependencies import get_cart_service
from app.modules.cart.schemas import (
    AddCartItemRequest,
    CartResponse,
    UpdateCartItemRequest,
    PackageComponentResponse,
)
from app.modules.cart.service import CartService
from app.security.dependencies import AuthUser

router = APIRouter(prefix="/cart", tags=["Carrito"])
CartServiceDep = Annotated[CartService, Depends(get_cart_service)]

logger = structlog.get_logger(__name__)


async def _decorate_cart(
    cart: CartResponse,
    session: AsyncSession,
    service: CartService,
    user_id: int,
) -> CartResponse:
    modified = False
    for item in cart.items:
        if not item.es_paquete:
            # Obtener categoría y stock actual en tiempo real para productos individuales
            stmt = select(Producto.stock_actual, Producto.id_categoria).where(
                Producto.id_producto == item.id_producto
            )
            res = await session.execute(stmt)
            prod_data = res.fetchone()
            if prod_data:
                item.stock_actual = prod_data[0]
                item.id_categoria = prod_data[1]
                modified = True
        else:
            # Obtener componentes del paquete de la base de datos y calcular stock del paquete
            from app.infrastructure.database.models.catalogo import Paquete, PaqueteProducto
            from sqlalchemy.orm import selectinload
            stmt = (
                select(Paquete)
                .options(selectinload(Paquete.productos).selectinload(PaqueteProducto.producto))
                .where(Paquete.id_paquete == item.id_paquete)
            )
            res = await session.execute(stmt)
            paquete = res.scalar_one_or_none()
            if paquete:
                # El stock disponible del paquete es la capacidad mínima de sus componentes
                min_pack_stock = None
                for pp in paquete.productos:
                    if pp.producto.estado:
                        pack_stock = pp.producto.stock_actual // pp.cantidad
                        if min_pack_stock is None or pack_stock < min_pack_stock:
                            min_pack_stock = pack_stock
                item.stock_actual = min_pack_stock if min_pack_stock is not None else 0

                item.productos = [
                    PackageComponentResponse(
                        id_producto=pp.producto.id_producto,
                        nombre=pp.producto.nombre,
                        cantidad=pp.cantidad,
                        precio_unitario=pp.producto.precio,
                        id_categoria=pp.producto.id_categoria,
                    )
                    for pp in paquete.productos if pp.producto.estado
                ]
                modified = True

    if modified:
        # Actualizar la caché de Redis
        await service._persist(user_id=user_id, cart=cart)

    return cart


@router.get(
    "",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
    summary="Obtener carrito del usuario",
)
async def get_cart(
    current_user: AuthUser,
    service: CartServiceDep,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CartResponse:
    cart = await service.get_cart(user_id=current_user.user_id)
    return await _decorate_cart(cart, session, service, current_user.user_id)


@router.post(
    "/items",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
    summary="Agregar producto al carrito",
)
async def add_item(
    payload: AddCartItemRequest,
    current_user: AuthUser,
    service: CartServiceDep,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CartResponse:
    if payload.es_paquete and payload.id_paquete is not None:
        from app.infrastructure.database.models.catalogo import Paquete, PaqueteProducto
        from sqlalchemy.orm import selectinload

        stmt = (
            select(Paquete)
            .options(selectinload(Paquete.productos).selectinload(PaqueteProducto.producto))
            .where(
                Paquete.id_paquete == payload.id_paquete,
                Paquete.estado == True,
            )
        )
        result = await session.execute(stmt)
        paquete = result.scalar_one_or_none()
        if not paquete:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Paquete con ID {payload.id_paquete} no encontrado.",
            )
        precio_estimado = sum(
            pp.producto.precio * pp.cantidad for pp in paquete.productos if pp.producto.estado
        )
        componentes = [
            PackageComponentResponse(
                id_producto=pp.producto.id_producto,
                nombre=pp.producto.nombre,
                cantidad=pp.cantidad,
                precio_unitario=pp.producto.precio,
                id_categoria=pp.producto.id_categoria,
            )
            for pp in paquete.productos if pp.producto.estado
        ]
        cart = await service.add_item(
            user_id=current_user.user_id,
            nombre=paquete.nombre,
            precio_unitario=precio_estimado,
            item=payload,
            imagen_url=paquete.imagen_url,
            productos=componentes,
        )
        return await _decorate_cart(cart, session, service, current_user.user_id)

    stmt = select(Producto).where(
        Producto.id_producto == payload.id_producto,
        Producto.estado == True,
    )
    result = await session.execute(stmt)
    producto = result.scalar_one_or_none()
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto con ID {payload.id_producto} no encontrado.",
        )

    cart = await service.add_item(
        user_id=current_user.user_id,
        nombre=producto.nombre,
        precio_unitario=producto.precio,
        item=payload,
        imagen_url=producto.imagen_url,
        id_categoria=producto.id_categoria,
    )
    return await _decorate_cart(cart, session, service, current_user.user_id)


@router.put(
    "/items/{id_producto}",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
    summary="Actualizar cantidad de un item en el carrito",
)
async def update_item(
    id_producto: int,
    payload: UpdateCartItemRequest,
    current_user: AuthUser,
    service: CartServiceDep,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CartResponse:
    try:
        cart = await service.update_item(
            user_id=current_user.user_id,
            id_producto=id_producto,
            payload=payload,
        )
        return await _decorate_cart(cart, session, service, current_user.user_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )


@router.delete(
    "/items/{id_producto}",
    response_model=CartResponse,
    status_code=status.HTTP_200_OK,
    summary="Eliminar un item del carrito",
)
async def remove_item(
    id_producto: int,
    current_user: AuthUser,
    service: CartServiceDep,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CartResponse:
    cart = await service.remove_item(
        user_id=current_user.user_id,
        id_producto=id_producto,
    )
    return await _decorate_cart(cart, session, service, current_user.user_id)


@router.delete(
    "",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Vaciar carrito",
)
async def clear_cart(
    current_user: AuthUser,
    service: CartServiceDep,
) -> None:
    await service.clear_cart(user_id=current_user.user_id)
