"""
Mifrufely Web — SweetCoins Celery Task: Expiración de Cupones Vencidos (Fase 6)
Disparador periódico de Celery para expirar cupones.
"""

import asyncio
import structlog

from app.infrastructure.database.session import AsyncSessionFactory
from app.infrastructure.workers.celery_app import celery_app
from app.modules.sweetcoins.expiration_service import CouponExpirationService
from app.modules.sweetcoins.repository_impl import CuponClienteRepositoryImpl

logger = structlog.get_logger(__name__)


async def _run_expire_coupons() -> int:
    """
    Instancia una sesión async y ejecuta la expiración de cupones.
    Retorna el número de cupones expirados.
    """
    async with AsyncSessionFactory() as session:
        async with session.begin():
            repo = CuponClienteRepositoryImpl(session)
            service = CouponExpirationService(repo)
            return await service.expire_all()


@celery_app.task(
    name="app.infrastructure.workers.tasks.sweetcoins.expire_coupons",
    bind=True,
    max_retries=3,
    default_retry_delay=300,  # 5 min de espera para reintentos
)
def expire_coupons(self) -> dict:
    """
    Tarea periódica de Celery que busca y expira cupones de clientes vencidos.
    Se ejecuta de forma síncrona dentro del worker delegando a un event loop.
    """
    log = logger.bind(task="expire_coupons", task_id=self.request.id)
    log.info("sweetcoins.expire_coupons.started")

    try:
        cupones_expirados = asyncio.run(_run_expire_coupons())
        log.info("sweetcoins.expire_coupons.completed", cupones_expirados=cupones_expirados)
        return {"status": "ok", "cupones_expirados": cupones_expirados}

    except Exception as exc:
        log.error("sweetcoins.expire_coupons.failed", error=str(exc))
        raise self.retry(exc=exc)
