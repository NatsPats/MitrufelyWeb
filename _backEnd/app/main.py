"""
Mifrufely Web — FastAPI Application Entry Point
Async-first | Enterprise-scale | Clean Architecture
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

from app.core.config import settings
from app.core.logging import configure_logging
from app.infrastructure.database.session import database_engine
from app.middleware.exception_handler import register_exception_handlers
from app.middleware.request_id import RequestIDMiddleware
from app.routers import api_router

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: startup & shutdown events."""
    configure_logging()
    logger.info(
        "application.startup",
        app=settings.APP_NAME,
        env=settings.APP_ENV,
        version=settings.APP_VERSION,
    )
    # Database connection pool is initialized on first use via async engine
    yield
    await database_engine.dispose()
    logger.info("application.shutdown", app=settings.APP_NAME)


def create_application() -> FastAPI:
    """Application factory — returns a fully configured FastAPI instance."""

    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        description="Plataforma transaccional de pastelería — API REST Enterprise",
        docs_url="/api/docs" if settings.DEBUG else None,
        redoc_url="/api/redoc" if settings.DEBUG else None,
        openapi_url="/api/openapi.json" if settings.DEBUG else None,
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
    )

    # ── Middleware Stack (order matters: outermost executes first) ─────────────
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=settings.ALLOWED_METHODS,
        allow_headers=settings.ALLOWED_HEADERS,
    )
    application.add_middleware(GZipMiddleware, minimum_size=1000)
    application.add_middleware(RequestIDMiddleware)

    # ── Exception Handlers ────────────────────────────────────────────────────
    register_exception_handlers(application)

    # ── Routers ───────────────────────────────────────────────────────────────
    application.include_router(api_router, prefix=settings.API_V1_PREFIX)

    return application


app: FastAPI = create_application()
