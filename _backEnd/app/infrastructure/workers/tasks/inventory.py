"""
Mifrufely Web — Inventory Celery Task: Expiración de Lotes Vencidos (Fase 3)

Tarea periódica que invoca el procedimiento almacenado `sp_expirar_lotes_vencidos()`
en NeonDB para:
  1. Detectar lotes VIGENTE con fecha_vencimiento <= NOW().
  2. Marcarlos como VENCIDO.
  3. Descontar el stock disponible del producto.
  4. Registrar movimiento VENCIMIENTO en el Kardex.

La lógica de negocio reside EXCLUSIVAMENTE en el SP de NeonDB.
Este worker solo actúa como disparador periódico.

Schedule configurado en celery_app.beat_schedule:
  - "expire-lots-daily" → cada 24h (86400 seg) a las 02:00 UTC.
"""

import asyncio

import structlog
from sqlalchemy import text

from app.infrastructure.database.session import AsyncSessionFactory
from app.infrastructure.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


async def _run_expire_lots() -> int:
    """
    Crea una sesión async dedicada y ejecuta sp_expirar_lotes_vencidos().
    Retorna el número de lotes expirados reportado por el SP.
    """
    async with AsyncSessionFactory() as session:
        async with session.begin():
            result = await session.execute(
                text("SELECT sp_expirar_lotes_vencidos()")
            )
            lotes_expirados: int = result.scalar_one()
    return lotes_expirados


@celery_app.task(
    name="app.infrastructure.workers.tasks.inventory.expire_lots",
    bind=True,
    max_retries=3,
    default_retry_delay=300,   # 5 min entre reintentos
)
def expire_lots(self) -> dict:
    """
    Tarea Celery que expira lotes vencidos diariamente.

    Usa asyncio.run() para ejecutar código async dentro del worker síncrono.
    """
    log = logger.bind(task="expire_lots", task_id=self.request.id)
    log.info("inventory.expire_lots.started")

    try:
        lotes_expirados = asyncio.run(_run_expire_lots())
        log.info("inventory.expire_lots.completed", lotes_expirados=lotes_expirados)
        return {"status": "ok", "lotes_expirados": lotes_expirados}

    except Exception as exc:
        log.error("inventory.expire_lots.failed", error=str(exc))
        raise self.retry(exc=exc)
