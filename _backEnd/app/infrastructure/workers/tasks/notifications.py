"""Notification tasks stub."""

import structlog

from app.infrastructure.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(bind=True, name="tasks.notifications.send_order_confirmation", max_retries=5)
def send_order_confirmation(self, order_id: int, user_email: str) -> None:
    """Send order confirmation notification."""
    logger.info("task.send_order_confirmation.started", order_id=order_id)
    # TODO: Implement email/push notification
    raise NotImplementedError
