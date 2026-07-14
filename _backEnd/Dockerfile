# ==============================================================================
# Mifrufely Web — Backend Dockerfile
# Multi-stage build: builder → development | production
# ==============================================================================

# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt


# ── Stage 2: Development ──────────────────────────────────────────────────────
# Target used by docker-compose.yml for local hot-reload development
FROM builder AS development

# Copiar dependencias del builder al path estándar del sistema
RUN cp -r /install/lib /usr/local/ && \
    cp -r /install/bin /usr/local/ 2>/dev/null || true

# Instalar dependencias de desarrollo adicionales
COPY requirements-dev.txt /tmp/requirements-dev.txt
RUN pip install -r /tmp/requirements-dev.txt

ENV PYTHONPATH=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
# El bind mount .:/app en docker-compose.yml sobreescribirá este directorio
# con el código fuente local en tiempo de ejecución.

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app"]


# ── Stage 3: Production ───────────────────────────────────────────────────────
# This is the target used by Render.com.
# Key decisions:
#   - $PORT is injected by Render at runtime (NOT hardcoded).
#   - Single uvicorn process: the app is async-native (asyncpg), so multiple
#     OS processes provide no benefit on a single CPU core and waste RAM.
#   - Non-root user (appuser) for security hardening.
#   - No dev tools (ruff, black, mypy) — they were removed from requirements.txt.
FROM python:3.11-slim AS production

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/* \
    && addgroup --system appgroup \
    && adduser --system --ingroup appgroup appuser

WORKDIR /app

COPY --from=builder /install /usr/local
COPY . .

RUN chown -R appuser:appgroup /app

USER appuser

# Render health check is configured in render.yaml via healthCheckPath.
# This HEALTHCHECK is a fallback for local `docker run` usage only.
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen(f'http://localhost:{__import__(\"os\").environ.get(\"PORT\", 8000)}/api/v1/health')"

# $PORT is injected by Render. Default fallback: 8000 for local production builds.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
