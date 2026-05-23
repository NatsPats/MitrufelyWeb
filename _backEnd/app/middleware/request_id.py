"""
Mifrufely Web — Request ID Middleware
Injects a unique X-Request-ID into every request for traceability
"""

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Attaches a unique request ID to every request.
    - Respects incoming X-Request-ID header (idempotent for upstream proxies)
    - Binds the ID to structlog context for tracing across log statements
    - Injects X-Request-ID into the response header
    """

    async def dispatch(
        self,
        request: Request,
        call_next: RequestResponseEndpoint,
    ) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id

        with structlog.contextvars.bound_contextvars(request_id=request_id):
            response = await call_next(request)

        response.headers["X-Request-ID"] = request_id
        return response
