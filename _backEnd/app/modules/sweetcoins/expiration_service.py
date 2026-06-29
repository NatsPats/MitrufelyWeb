"""
Mifrufely Web — Coupon Expiration Service (Módulo M06)
Decoupled service to manage automatic expiration of coupons.
"""

import structlog

from app.modules.sweetcoins.repository import ICuponClienteRepository

logger = structlog.get_logger(__name__)


class CouponExpirationService:
    """Servicio encargado de la lógica de expiración de cupones."""

    def __init__(self, cupon_cliente_repo: ICuponClienteRepository) -> None:
        self._cupon_repo = cupon_cliente_repo

    async def expire_all(self) -> int:
        """
        Invoque la expiración de cupones cuya fecha de validez ha vencido.
        Retorna la cantidad de cupones marcados como EXPIRADOS.
        """
        logger.info("sweetcoins.expiration_job.started")
        try:
            count = await self._cupon_repo.expire_vencidos()
            
            if count > 0:
                logger.info("coupon.expired", count=count)
            else:
                logger.info("sweetcoins.expiration_job.no_expired_coupons")
                
            return count
        except Exception as exc:
            logger.error("sweetcoins.expiration_job.failed", error=str(exc))
            raise
