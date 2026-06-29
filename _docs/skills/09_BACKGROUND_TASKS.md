# SKILL 09 — Background Tasks (Celery + Redis) — ACTUALIZADO

> **CUÁNDO USAR:** Antes de implementar tareas asíncronas, workers, generación de PDF, o jobs de expiración.
> **Última actualización:** 2026-06-29 — Refleja implementación real post-Fase 6.

---

## 1. Stack

| Componente | Tecnología |
|---|---|
| Task Queue | Celery |
| Broker | Redis (DB 1) |
| Result Backend | Redis (DB 2) |
| Beat Scheduler | Celery Beat |
| PDF | WeasyPrint (pendiente) |
| Config | `settings.CELERY_BROKER_URL`, `settings.CELERY_RESULT_BACKEND` |

---

## 2. Estructura de Workers (REAL)

```
app/infrastructure/workers/
├── celery_app.py          # Celery app factory + beat schedule
├── __init__.py
└── tasks/
    ├── __init__.py
    ├── inventory.py       ✅ Expiración de lotes (implementado)
    ├── ventas.py          ✅ Expiración de ventas pendientes (implementado)
    ├── sweetcoins.py      ✅ Expiración de cupones CriptoTrufas (implementado, Fase 6)
    ├── reports.py         ⚠️ Stub — PDF/Excel (pendiente Fase 7)
    ├── analytics.py       ⚠️ Stub — Agregaciones diarias (pendiente Fase 7)
    └── notifications.py   ⚠️ Stub — Email/WhatsApp (pendiente)
```

---

## 3. Celery App Factory (REAL)

```python
# app/infrastructure/workers/celery_app.py
celery_app = Celery(
    "mifrufely",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.infrastructure.workers.tasks.reports",
        "app.infrastructure.workers.tasks.notifications",
        "app.infrastructure.workers.tasks.analytics",
        "app.infrastructure.workers.tasks.inventory",
        "app.infrastructure.workers.tasks.ventas",       # ← Fase 4
        "app.infrastructure.workers.tasks.sweetcoins",   # ← Fase 6
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
            "schedule": 86400.0,
        },
        "expire-lots-daily": {
            "task": "app.infrastructure.workers.tasks.inventory.expire_lots",
            "schedule": 86400.0,
        },
        "expire-pending-ventas": {                                # ← Fase 4
            "task": "app.infrastructure.workers.tasks.ventas.expire_pending",
            "schedule": 300.0,  # Cada 5 minutos
        },
        "expire-sweetcoins-daily": {                               # ← Fase 6
            "task": "app.infrastructure.workers.tasks.sweetcoins.expire_coupons",
            "schedule": 86400.0,  # Diario
        },
    },
)
```

---

## 4. Tareas Implementadas

### 4.1 Expiración de Lotes Vencidos (Fase 3 — implementada)

```python
# app/infrastructure/workers/tasks/inventory.py
@celery_app.task(name="app.infrastructure.workers.tasks.inventory.expire_lots",
                 bind=True, max_retries=3, default_retry_delay=300)
def expire_lots(self) -> dict:
    lotes_expirados = asyncio.run(_run_expire_lots())
    return {"status": "ok", "lotes_expirados": lotes_expirados}

async def _run_expire_lots() -> int:
    async with AsyncSessionFactory() as session:
        async with session.begin():
            result = await session.execute(text("SELECT sp_expirar_lotes_vencidos()"))
            lotes_expirados: int = result.scalar_one()
    return lotes_expirados
```

### 4.2 Expiración de Ventas Pendientes (Fase 4 — implementada)

```python
# app/infrastructure/workers/tasks/ventas.py
@celery_app.task(name="app.infrastructure.workers.tasks.ventas.expire_pending",
                 bind=True, max_retries=3, default_retry_delay=120)
def expire_pending(self) -> dict:
    anuladas = asyncio.run(_run_expire_pending_ventas())
    return {"status": "ok", "ventas_anuladas": anuladas}

async def _run_expire_pending_ventas() -> int:
    async with AsyncSessionFactory() as session:
        async with session.begin():
            result = await session.execute(text("""
                UPDATE ventas SET estado = 'ANULADO'
                WHERE estado = 'PENDIENTE' AND estado_pago = 'PENDIENTE'
                  AND fecha_venta < NOW() - INTERVAL '15 minutes'
            """))
            anuladas: int = result.rowcount
    return anuladas
```

> **Nota:** La anulación dispara `tg_ventas_anular` que revierte stock, libera cupón y contra-asienta puntos automáticamente.

### 4.3 Expiración de Cupones CriptoTrufas (Fase 6 — implementada)

```python
# app/infrastructure/workers/tasks/sweetcoins.py
@celery_app.task(name="app.infrastructure.workers.tasks.sweetcoins.expire_coupons",
                 bind=True, max_retries=3, default_retry_delay=300)
def expire_coupons(self) -> dict:
    vencidos = asyncio.run(_run_expire_coupons())
    return {"status": "ok", "cupones_expirados": vencidos}

async def _run_expire_coupons() -> int:
    async with AsyncSessionFactory() as session:
        async with session.begin():
            result = await session.execute(text("SELECT sp_expirar_cupones_vencidos()"))
            vencidos: int = result.scalar_one()
    return vencidos
```

La lógica de dominio vive en `app/modules/sweetcoins/expiration_service.py` (`CouponExpirationService.expire_all`), que la tarea invoca para mantener el worker desacoplado del servicio. Programa: diario (86400s) en `beat_schedule` como `expire-sweetcoins-daily`. El trigger `tg_cupones_cliente_normalizar` normaliza estados en cada INSERT/UPDATE.

### 4.4 Generación de PDF (stub — pendiente Fase 7)

```python
# app/infrastructure/workers/tasks/reports.py
@celery_app.task(name="app.infrastructure.workers.tasks.reports.generate_sales_pdf",
                 bind=True, max_retries=3)
def generate_sales_pdf(self, report_params):
    raise NotImplementedError("PDF generation not yet implemented (Fase 7)")
```

### 4.5 Agregación Analítica (stub — pendiente Fase 7)

```python
# app/infrastructure/workers/tasks/analytics.py
@celery_app.task(name="app.infrastructure.workers.tasks.analytics.aggregate_daily")
def aggregate_daily():
    raise NotImplementedError("Analytics aggregation not yet implemented (Fase 7)")
```

---

## 5. Variables de Entorno

```env
# .env
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
REDIS_URL=redis://localhost:6379/0
```

---

## 6. Comandos para Ejecutar Workers

```bash
# Worker principal
celery -A app.infrastructure.workers.celery_app worker --loglevel=info

# Beat scheduler
celery -A app.infrastructure.workers.celery_app beat --loglevel=info
```
