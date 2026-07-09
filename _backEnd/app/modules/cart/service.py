import json
from datetime import datetime, timezone
from decimal import Decimal

import structlog
from redis.asyncio import Redis

from app.modules.cart.schemas import (
    AddCartItemRequest,
    CartItemResponse,
    CartResponse,
    UpdateCartItemRequest,
    PackageComponentResponse,
)

logger = structlog.get_logger(__name__)

CART_KEY_PREFIX = "cart"
CART_TTL_SECONDS = 604800  # 7 días


class CartService:
    def __init__(self, redis: Redis) -> None:
        self._redis = redis

    def _cart_key(self, user_id: int) -> str:
        return f"{CART_KEY_PREFIX}:{user_id}"

    async def get_cart(self, user_id: int) -> CartResponse:
        raw = await self._redis.get(self._cart_key(user_id))
        if not raw:
            return CartResponse()

        try:
            data = json.loads(raw)
            items = [
                CartItemResponse(
                    id_producto=item["id_producto"],
                    nombre=item["nombre"],
                    cantidad=item["cantidad"],
                    precio_unitario=Decimal(str(item["precio_unitario"])),
                    imagen_url=item.get("imagen_url"),
                    es_paquete=item.get("es_paquete", False),
                    id_paquete=item.get("id_paquete"),
                    id_categoria=item.get("id_categoria"),
                    stock_actual=item.get("stock_actual"),
                    productos=[
                        PackageComponentResponse(
                            id_producto=p["id_producto"],
                            nombre=p["nombre"],
                            cantidad=p["cantidad"],
                            precio_unitario=Decimal(str(p["precio_unitario"])),
                            id_categoria=p["id_categoria"],
                        )
                        for p in item.get("productos")
                    ] if item.get("productos") else None
                )
                for item in data.get("items", [])
            ]
            total_items = sum(i.cantidad for i in items)
            subtotal = sum(i.precio_unitario * i.cantidad for i in items)
            updated_at = data.get("updated_at")
            return CartResponse(
                items=items,
                total_items=total_items,
                subtotal=subtotal,
                updated_at=(datetime.fromisoformat(updated_at) if updated_at else None),
            )
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            logger.warning("cart.deserialize_error", user_id=user_id, error=str(exc))
            await self.clear_cart(user_id)
            return CartResponse()

    async def add_item(
        self,
        user_id: int,
        nombre: str,
        precio_unitario: Decimal,
        item: AddCartItemRequest,
        imagen_url: str | None = None,
        id_categoria: int | None = None,
        productos: list | None = None,
    ) -> CartResponse:
        cart = await self.get_cart(user_id)

        existing = next((i for i in cart.items if i.id_producto == item.id_producto), None)
        if existing:
            existing.cantidad += item.cantidad
        else:
            cart.items.append(
                CartItemResponse(
                    id_producto=item.id_producto,
                    nombre=nombre,
                    cantidad=item.cantidad,
                    precio_unitario=precio_unitario,
                    imagen_url=imagen_url,
                    es_paquete=item.es_paquete,
                    id_paquete=item.id_paquete,
                    id_categoria=id_categoria,
                    stock_actual=None,
                    productos=productos,
                )
            )

        cart.total_items = sum(i.cantidad for i in cart.items)
        cart.subtotal = sum(i.precio_unitario * i.cantidad for i in cart.items)
        cart.updated_at = datetime.now(tz=timezone.utc)

        await self._persist(user_id, cart)
        return cart

    async def update_item(
        self,
        user_id: int,
        id_producto: int,
        payload: UpdateCartItemRequest,
    ) -> CartResponse:
        cart = await self.get_cart(user_id)
        item = next((i for i in cart.items if i.id_producto == id_producto), None)
        if not item:
            raise ValueError(f"El producto {id_producto} no está en el carrito.")

        item.cantidad = payload.cantidad
        cart.total_items = sum(i.cantidad for i in cart.items)
        cart.subtotal = sum(i.precio_unitario * i.cantidad for i in cart.items)
        cart.updated_at = datetime.now(tz=timezone.utc)

        await self._persist(user_id, cart)
        return cart

    async def remove_item(self, user_id: int, id_producto: int) -> CartResponse:
        cart = await self.get_cart(user_id)
        cart.items = [i for i in cart.items if i.id_producto != id_producto]
        cart.total_items = sum(i.cantidad for i in cart.items)
        cart.subtotal = sum(i.precio_unitario * i.cantidad for i in cart.items)
        cart.updated_at = datetime.now(tz=timezone.utc)

        await self._persist(user_id, cart)
        return cart

    async def clear_cart(self, user_id: int) -> None:
        await self._redis.delete(self._cart_key(user_id))

    async def _persist(self, user_id: int, cart: CartResponse) -> None:
        data = {
            "items": [
                {
                    "id_producto": i.id_producto,
                    "nombre": i.nombre,
                    "cantidad": i.cantidad,
                    "precio_unitario": str(i.precio_unitario),
                    "imagen_url": i.imagen_url,
                    "es_paquete": i.es_paquete,
                    "id_paquete": i.id_paquete,
                    "id_categoria": i.id_categoria,
                    "productos": [
                        {
                            "id_producto": p.id_producto,
                            "nombre": p.nombre,
                            "cantidad": p.cantidad,
                            "precio_unitario": str(p.precio_unitario),
                            "id_categoria": p.id_categoria,
                        }
                        for p in (i.productos or [])
                    ] if i.productos else None
                }
                for i in cart.items
            ],
            "updated_at": (cart.updated_at.isoformat() if cart.updated_at else None),
        }
        await self._redis.setex(
            self._cart_key(user_id),
            CART_TTL_SECONDS,
            json.dumps(data),
        )
        logger.debug(
            "cart.persisted",
            user_id=user_id,
            items_count=cart.total_items,
        )
