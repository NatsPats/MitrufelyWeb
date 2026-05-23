# ==============================================================================
# Mifrufely Web — Backend Dockerfile
# Multi-stage build: builder → production
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
FROM python:3.11-slim AS production

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

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

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/api/v1/health').raise_for_status()"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
