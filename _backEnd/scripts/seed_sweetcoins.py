"""
seed_sweetcoins.py — Seed inicial del módulo CriptoTrufa / SweetCoins.

Inserta:
  - 1 configuracion_recompensas activa (tasa 10%, 365 días expiración)
  - 4 cupones_maestro de prueba

Uso:
    cd _backEnd
    python -m scripts.seed_sweetcoins

Requisitos: .env configurado con DATABASE_URL válido.
"""

import asyncio
import sys
from pathlib import Path

# ── Asegurar que el módulo raíz esté en el PYTHONPATH ─────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import structlog
from sqlalchemy import select, text

from app.core.logging import configure_logging
from app.infrastructure.database.models.cupones import CuponMaestro
from app.infrastructure.database.models.recompensas import ConfiguracionRecompensas
from app.infrastructure.database.session import AsyncSessionFactory

configure_logging()
logger = structlog.get_logger("seed_sweetcoins")

# ── Datos de configuración base ───────────────────────────────────────────────

CONFIG_SEED = {
    "tasa_conversion": 0.1000,   # 0.10 → 1 CriptoTrufa por cada S/.10 gastados
    "limite_puntos_billetera": 50_000,
    "dias_expiracion": 365,
    "estado": True,
}

# ── Cupones maestro demo ───────────────────────────────────────────────────────

CUPONES_SEED = [
    {
        "nombre": "El Clásico Antojo",
        "descripcion": "Descuento del 10% en tu próxima compra. El favorito de nuestra comunidad.",
        "porcentaje_descuento": 10.00,
        "costo_puntos": 500,
        "dias_vigencia": 30,
        "estado": True,
    },
    {
        "nombre": "Locura por el Oreo",
        "descripcion": "Cupón especial de 20% para fans de nuestras trufas de Oreo.",
        "porcentaje_descuento": 20.00,
        "costo_puntos": 1000,
        "dias_vigencia": 15,
        "estado": True,
    },
    {
        "nombre": "Súper Trufa VIP",
        "descripcion": "El cupón más exclusivo: 30% de descuento para clientes premium.",
        "porcentaje_descuento": 30.00,
        "costo_puntos": 1800,
        "dias_vigencia": 20,
        "estado": True,
    },
    {
        "nombre": "Dulce Arranque",
        "descripcion": "Para nuevos pedidos: 15% de descuento en cualquier producto.",
        "porcentaje_descuento": 15.00,
        "costo_puntos": 750,
        "dias_vigencia": 30,
        "estado": True,
    },
]


async def run() -> None:
    async with AsyncSessionFactory() as session:
        async with session.begin():
            # ── 1. Verificar si ya existe config activa ────────────────────────
            result = await session.execute(
                select(ConfiguracionRecompensas).where(
                    ConfiguracionRecompensas.estado == True  # noqa: E712
                )
            )
            config_existente = result.scalars().first()

            if config_existente:
                logger.info(
                    "seed.config_exists",
                    id=config_existente.id_config,
                    tasa=float(config_existente.tasa_conversion),
                )
            else:
                config = ConfiguracionRecompensas(**CONFIG_SEED)
                session.add(config)
                await session.flush()
                logger.info("seed.config_created", id=config.id_config)

            # ── 2. Insertar cupones maestro si no existen (por nombre) ─────────
            result = await session.execute(
                select(CuponMaestro.nombre)
            )
            nombres_existentes = {row[0] for row in result.fetchall()}

            created = 0
            for cupon_data in CUPONES_SEED:
                if cupon_data["nombre"] in nombres_existentes:
                    logger.info("seed.cupon_skip", nombre=cupon_data["nombre"])
                    continue
                cupon = CuponMaestro(**cupon_data)
                session.add(cupon)
                created += 1

            await session.flush()

        logger.info("seed.completed", cupones_creados=created)
        print(f"\n✓ Seed SweetCoins completado — {created} cupones creados.")


if __name__ == "__main__":
    asyncio.run(run())
