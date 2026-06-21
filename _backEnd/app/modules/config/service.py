"""
Mifrufely Web — System Config Service
Gestiona la configuración persistente del sistema con caché Redis (TTL 5 min).

Claves de configuración manejadas:
  - shipping_cost                 → Costo de envío en S/
  - free_shipping_threshold       → Umbral para envío gratis
  - delivery_base_time_minutes    → Tiempo base de entrega
  - preparation_base_time_minutes → Tiempo base de preparación
  - eta_factor_per_product        → Factor de ETA por producto
"""

import json
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

import structlog

from app.modules.config.repository import ISystemConfigRepository
from app.modules.config.schemas import (
    ShippingCalculationResult,
    ShippingConfigResponse,
    UpdateShippingConfigRequest,
)

logger = structlog.get_logger(__name__)

# Claves de configuración
KEY_SHIPPING_COST = "shipping_cost"
KEY_FREE_SHIPPING_THRESHOLD = "free_shipping_threshold"
KEY_DELIVERY_BASE_TIME = "delivery_base_time_minutes"
KEY_PREPARATION_BASE_TIME = "preparation_base_time_minutes"
KEY_ETA_FACTOR = "eta_factor_per_product"

# Valores por defecto (usados si no existe la clave en BD)
DEFAULTS: dict[str, str] = {
    KEY_SHIPPING_COST: "3.00",
    KEY_FREE_SHIPPING_THRESHOLD: "15.00",
    KEY_DELIVERY_BASE_TIME: "30",
    KEY_PREPARATION_BASE_TIME: "15",
    KEY_ETA_FACTOR: "2",
}

REDIS_CACHE_KEY = "system_config:shipping"
REDIS_TTL = 300  # 5 minutos


class SystemConfigService:
    def __init__(
        self,
        repo: ISystemConfigRepository,
        redis=None,  # Redis client opcional para cache
    ) -> None:
        self.repo = repo
        self.redis = redis

    async def _get_value(self, key: str) -> str:
        """Obtiene un valor de configuración, usando el default si no existe."""
        config = await self.repo.get_by_key(key)
        if config:
            return config.config_value
        return DEFAULTS.get(key, "")

    async def get_shipping_config(self) -> ShippingConfigResponse:
        """
        Retorna la configuración de envío completa.
        Usa caché Redis si está disponible.
        """
        # Intentar desde cache
        if self.redis:
            try:
                cached = await self.redis.get(REDIS_CACHE_KEY)
                if cached:
                    data = json.loads(cached)
                    return ShippingConfigResponse(**data)
            except Exception:
                pass  # Cache miss — continuar con BD

        config = ShippingConfigResponse(
            shipping_cost=Decimal(await self._get_value(KEY_SHIPPING_COST)),
            free_shipping_threshold=Decimal(await self._get_value(KEY_FREE_SHIPPING_THRESHOLD)),
            delivery_base_time_minutes=int(await self._get_value(KEY_DELIVERY_BASE_TIME)),
            preparation_base_time_minutes=int(await self._get_value(KEY_PREPARATION_BASE_TIME)),
            eta_factor_per_product=int(await self._get_value(KEY_ETA_FACTOR)),
        )

        # Guardar en cache
        if self.redis:
            try:
                await self.redis.setex(
                    REDIS_CACHE_KEY,
                    REDIS_TTL,
                    json.dumps({
                        "shipping_cost": str(config.shipping_cost),
                        "free_shipping_threshold": str(config.free_shipping_threshold),
                        "delivery_base_time_minutes": config.delivery_base_time_minutes,
                        "preparation_base_time_minutes": config.preparation_base_time_minutes,
                        "eta_factor_per_product": config.eta_factor_per_product,
                    }),
                )
            except Exception:
                pass

        return config

    async def update_shipping_config(
        self,
        dto: UpdateShippingConfigRequest,
        id_usuario: Optional[int] = None,
    ) -> ShippingConfigResponse:
        """Actualiza uno o más valores de configuración de envío."""
        updates: dict[str, str] = {}

        if dto.shipping_cost is not None:
            updates[KEY_SHIPPING_COST] = str(dto.shipping_cost)
        if dto.free_shipping_threshold is not None:
            updates[KEY_FREE_SHIPPING_THRESHOLD] = str(dto.free_shipping_threshold)
        if dto.delivery_base_time_minutes is not None:
            updates[KEY_DELIVERY_BASE_TIME] = str(dto.delivery_base_time_minutes)
        if dto.preparation_base_time_minutes is not None:
            updates[KEY_PREPARATION_BASE_TIME] = str(dto.preparation_base_time_minutes)
        if dto.eta_factor_per_product is not None:
            updates[KEY_ETA_FACTOR] = str(dto.eta_factor_per_product)

        for key, value in updates.items():
            await self.repo.set_value(key, value, updated_by=id_usuario)
            logger.info("config.updated", key=key, value=value, by=id_usuario)

        # Invalidar cache
        if self.redis:
            try:
                await self.redis.delete(REDIS_CACHE_KEY)
            except Exception:
                pass

        return await self.get_shipping_config()

    async def calculate_shipping(self, subtotal: Decimal) -> ShippingCalculationResult:
        """
        Calcula el costo de envío para un subtotal dado.

        Regla de negocio:
          - Si subtotal >= free_shipping_threshold → envío gratis (S/0.00)
          - Si subtotal < free_shipping_threshold  → cobra shipping_cost

        Returns:
            ShippingCalculationResult con todos los montos calculados.
        """
        config = await self.get_shipping_config()

        if subtotal >= config.free_shipping_threshold:
            shipping = Decimal("0.00")
            free = True
            msg = f"¡Envío gratis! Superaste el mínimo de S/{config.free_shipping_threshold:.2f}"
        else:
            shipping = config.shipping_cost
            free = False
            faltante = config.free_shipping_threshold - subtotal
            msg = f"Envío: S/{shipping:.2f}. Agrega S/{faltante:.2f} más para envío gratis."

        return ShippingCalculationResult(
            subtotal=subtotal,
            shipping_cost=shipping,
            free_shipping_applied=free,
            free_shipping_threshold=config.free_shipping_threshold,
            total_final=subtotal + shipping,
            mensaje=msg,
        )

    async def calculate_eta(self, n_productos: int) -> datetime:
        """
        Calcula el ETA de entrega.
        ETA = ahora + preparation_base + delivery_base + (n_productos × factor)
        """
        config = await self.get_shipping_config()
        total_minutos = (
            config.preparation_base_time_minutes
            + config.delivery_base_time_minutes
            + (n_productos * config.eta_factor_per_product)
        )
        return datetime.utcnow() + timedelta(minutes=total_minutos)
