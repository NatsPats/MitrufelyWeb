# SKILL 09 — Background Tasks (Celery + Redis)

> **CUÁNDO USAR:** Antes de implementar tareas asíncronas, workers, generación de PDF, o jobs de expiración.

---

## 1. Stack

| Componente | Tecnología |
|---|---|
| Task Queue | Celery |
| Broker | Redis (DB 1) |
| Result Backend | Redis (DB 2) |
| Beat Scheduler | Celery Beat |
| PDF | WeasyPrint / ReportLab |
| Config | `settings.CELERY_BROKER_URL`, `settings.CELERY_RESULT_BACKEND` |

---

## 2. Estructura de Workers

```
app/infrastructure/workers/
├── celery_app.py          # Celery app factory + beat schedule
└── tasks/
    ├── __init__.py
    ├── reports.py         # Generación de PDF/Excel
    ├── analytics.py       # Agregaciones diarias
    └── notifications.py   # Email / WhatsApp (futuro)
```

---

## 3. Celery App Factory

```python
# app/infrastructure/workers/celery_app.py
from celery import Celery
from celery.schedules import crontab
from app.core.config import settings

celery_app = Celery(
    "mytrufely",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.infrastructure.workers.tasks.reports",
        "app.infrastructure.workers.tasks.analytics",
        "app.infrastructure.workers.tasks.notifications",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="America/Lima",
    enable_utc=True,
    task_track_started=True,
    beat_schedule={
        # Expirar lotes vencidos todos los días a las 2:00 AM
        "expire-lots-daily": {
            "task": "inventory.expire_lots",
            "schedule": crontab(hour=2, minute=0),
        },
        # Expirar cupones vencidos cada hora
        "expire-coupons-hourly": {
            "task": "sweetcoins.expire_coupons",
            "schedule": crontab(minute=0),
        },
        # Agregaciones analíticas diarias a las 3:00 AM
        "daily-analytics": {
            "task": "analytics.aggregate_daily",
            "schedule": crontab(hour=3, minute=0),
        },
    },
)
```

---

## 4. Tareas Definidas

### 4.1 Generación de PDF de Comprobante

```python
# app/infrastructure/workers/tasks/reports.py
import asyncio
from app.infrastructure.workers.celery_app import celery_app

@celery_app.task(
    name="reports.generate_sale_document",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def generate_sale_document(self, venta_id: int, tipo_documento: str) -> dict:
    """
    Genera PDF de Boleta o Factura y lo guarda en storage.
    Registra la URL en la tabla `documentos`.
    """
    try:
        result = asyncio.run(_async_generate_document(venta_id, tipo_documento))
        return {"status": "success", "document_url": result}
    except Exception as exc:
        raise self.retry(exc=exc)


async def _async_generate_document(venta_id: int, tipo_documento: str) -> str:
    async with get_async_session() as session:
        # 1. Obtener datos de la venta con todos sus detalles
        venta = await session.execute(
            select(VentaModel)
            .options(
                selectinload(VentaModel.detalles).selectinload(DetalleModel.producto),
                selectinload(VentaModel.cliente).selectinload(ClienteModel.usuario),
                selectinload(VentaModel.metodos_pago),
            )
            .where(VentaModel.id_venta == venta_id)
        )

        # 2. Generar PDF con WeasyPrint o ReportLab
        pdf_bytes = _render_pdf(venta.scalar_one(), tipo_documento)

        # 3. Guardar archivo (local o Cloud Storage)
        url = await _upload_to_storage(pdf_bytes, f"venta_{venta_id}.pdf")

        # 4. Registrar en tabla documentos
        await session.execute(
            insert(DocumentoModel).values(
                id_venta=venta_id,
                tipo_documento=tipo_documento,
                numero_serie="B001",
                numero_correlativo=str(venta_id).zfill(8),
                url_archivo=url,
            )
        )
        await session.commit()
        return url
```

### 4.2 Expiración de Lotes

```python
@celery_app.task(name="inventory.expire_lots")
def expire_lots():
    count = asyncio.run(_run_expire_lots())
    return {"expired_lots": count}

async def _run_expire_lots():
    async with get_async_session() as session:
        result = await session.execute(text("SELECT sp_expirar_lotes_vencidos()"))
        count = result.scalar()
        await session.commit()
        logger.info("inventory.lots_expired", count=count)
        return count
```

### 4.3 Expiración de Cupones

```python
@celery_app.task(name="sweetcoins.expire_coupons")
def expire_coupons():
    count = asyncio.run(_run_expire_coupons())
    return {"expired_coupons": count}

async def _run_expire_coupons():
    async with get_async_session() as session:
        result = await session.execute(text("SELECT sp_expirar_cupones_vencidos()"))
        count = result.scalar()
        await session.commit()
        return count
```

---

## 5. Dispatch de Tareas desde el Service

```python
# Después del commit de la transacción de checkout
from app.infrastructure.workers.tasks.reports import generate_sale_document

# Disparo asíncrono (no bloquea al cliente)
generate_sale_document.delay(
    venta_id=venta.id_venta,
    tipo_documento="BOLETA",
)

# Con resultado posterior (si necesitas el task ID para polling)
task = generate_sale_document.apply_async(
    args=[venta.id_venta, "BOLETA"],
    countdown=2,  # esperar 2 segundos antes de ejecutar
)
task_id = task.id
```

---

## 6. Variables de Entorno

```env
# .env
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2
REDIS_URL=redis://localhost:6379/0
```

---

## 7. Comandos para Ejecutar Workers

```bash
# Worker principal (consume tareas)
celery -A app.infrastructure.workers.celery_app worker --loglevel=info

# Beat scheduler (dispara tareas programadas)
celery -A app.infrastructure.workers.celery_app beat --loglevel=info

# Flower (dashboard de monitoreo, opcional)
celery -A app.infrastructure.workers.celery_app flower --port=5555
```

---

## 8. Configuración en docker-compose.yml

```yaml
services:
  worker:
    build: .
    command: celery -A app.infrastructure.workers.celery_app worker --loglevel=info
    environment:
      - CELERY_BROKER_URL=redis://redis:6379/1
    depends_on:
      - redis

  beat:
    build: .
    command: celery -A app.infrastructure.workers.celery_app beat --loglevel=info
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```
