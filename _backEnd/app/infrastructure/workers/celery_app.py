"""
Mifrufely Web — Celery Application
Distributed task queue for background processing:
- PDF report generation
- Excel export
- SweetCoins processing
- Email notifications
- Periodic analytics aggregation
"""

from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "mifrufely",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.infrastructure.workers.tasks.reports",
        "app.infrastructure.workers.tasks.notifications",
        "app.infrastructure.workers.tasks.analytics",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Lima",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
    beat_schedule={
        "aggregate-daily-analytics": {
            "task": "app.infrastructure.workers.tasks.analytics.aggregate_daily",
            "schedule": 86400.0,  # Every 24h
        },
    },
)
