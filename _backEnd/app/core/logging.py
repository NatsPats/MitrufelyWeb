"""
Mifrufely Web — Structured Logging Configuration
Structlog + Python logging integration
"""

import logging
import sys
from typing import Any

import structlog
from structlog.types import EventDict, WrappedLogger

from app.core.config import settings


def add_app_context(
    logger: WrappedLogger,
    method_name: str,
    event_dict: EventDict,
) -> EventDict:
    """Inject application metadata into every log entry."""
    event_dict["app"] = settings.APP_NAME
    event_dict["env"] = settings.APP_ENV
    event_dict["version"] = settings.APP_VERSION
    return event_dict


def configure_logging() -> None:
    """
    Configure structlog and stdlib logging.
    Call once at application startup.
    """
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)

    shared_processors: list[Any] = [
        structlog.contextvars.merge_contextvars,
        add_app_context,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
    ]

    if settings.LOG_FORMAT == "json":
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            *shared_processors,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Suppress noisy third-party loggers
    for noisy in ("uvicorn.access", "sqlalchemy.engine"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
