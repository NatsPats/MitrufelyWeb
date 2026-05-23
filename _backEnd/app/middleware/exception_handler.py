"""
Mifrufely Web — Centralized Exception Handler Registration
Maps domain exceptions to structured HTTP responses
"""

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import ORJSONResponse
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import MifrufelyBaseError

logger = structlog.get_logger(__name__)


def _error_response(
    status_code: int,
    error_code: str,
    message: str,
    request_id: str | None = None,
    details: list | None = None,
) -> ORJSONResponse:
    content: dict = {
        "success": False,
        "error": {
            "code": error_code,
            "message": message,
        },
    }
    if details:
        content["error"]["details"] = details
    if request_id:
        content["request_id"] = request_id

    return ORJSONResponse(status_code=status_code, content=content)


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(MifrufelyBaseError)
    async def domain_exception_handler(
        request: Request,
        exc: MifrufelyBaseError,
    ) -> ORJSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.warning(
            "domain.exception",
            error_code=exc.error_code,
            message=exc.message,
            path=request.url.path,
            request_id=request_id,
        )
        return _error_response(
            status_code=exc.status_code,
            error_code=exc.error_code,
            message=exc.message,
            request_id=request_id,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request,
        exc: RequestValidationError,
    ) -> ORJSONResponse:
        request_id = getattr(request.state, "request_id", None)
        details = [
            {
                "loc": list(error["loc"]),
                "msg": error["msg"],
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        logger.warning(
            "validation.error",
            path=request.url.path,
            errors=details,
            request_id=request_id,
        )
        return _error_response(
            status_code=422,
            error_code="VALIDATION_ERROR",
            message="Error de validación en los datos enviados",
            request_id=request_id,
            details=details,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(
        request: Request,
        exc: Exception,
    ) -> ORJSONResponse:
        request_id = getattr(request.state, "request_id", None)
        logger.exception(
            "unhandled.exception",
            path=request.url.path,
            request_id=request_id,
            exc_info=exc,
        )
        return _error_response(
            status_code=500,
            error_code="INTERNAL_ERROR",
            message="Error interno del servidor",
            request_id=request_id,
        )
