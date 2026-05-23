"""Analytics aggregation tasks."""

import structlog

from app.infrastructure.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="app.infrastructure.workers.tasks.analytics.aggregate_daily")
def aggregate_daily() -> None:
    """Aggregate previous day analytics data."""
    logger.info("task.aggregate_daily.started")
    # TODO: Implement daily aggregation logic
    raise NotImplementedError
