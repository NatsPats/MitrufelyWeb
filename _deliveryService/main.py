"""
Mifrufely Web — Delivery Microservice
Servicio independiente que simula el proceso de preparación y entrega.

Puerto: 8001 (independiente del backend principal en 8000)
Flujo:
  1. Recibe POST /deliveries {id_venta, n_productos}
  2. Simula preparación (PREPARATION_DELAY_SECONDS)
  3. Simula tránsito (DELIVERY_DELAY_SECONDS)
  4. Llama al backend: POST /api/v1/ventas/{id}/delivery-completed

Para ejecutar:
  cd _deliveryService
  pip install -r requirements.txt
  uvicorn main:app --port 8001 --reload
"""

import asyncio
import os
from datetime import datetime

import httpx
import structlog
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Configuración ──────────────────────────────────────────────────────────────
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
DELIVERY_WEBHOOK_TOKEN = os.getenv("DELIVERY_WEBHOOK_TOKEN", "dev-webhook-token")
PREPARATION_DELAY_SECONDS = int(os.getenv("PREPARATION_DELAY_SECONDS", "5"))
DELIVERY_DELAY_SECONDS = int(os.getenv("DELIVERY_DELAY_SECONDS", "10"))

logger = structlog.get_logger(__name__)

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Mifrufely Delivery Service",
    description="Microservicio de simulación de entregas para MitrufelyWeb",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://localhost:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# In-memory store de entregas activas (para demo)
deliveries: dict[int, dict] = {}


# ── Schemas ────────────────────────────────────────────────────────────────────
class DeliveryRequest(BaseModel):
    id_venta: int
    n_productos: int


class DeliveryStatus(BaseModel):
    id_venta: int
    status: str
    created_at: str
    eta_seconds: int
    completed_at: str | None = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "delivery-service", "port": 8001}


@app.post("/deliveries", status_code=status.HTTP_202_ACCEPTED)
async def create_delivery(payload: DeliveryRequest) -> DeliveryStatus:
    """
    Inicia el proceso de entrega para un pedido.
    La entrega se simula de forma asíncrona en segundo plano.
    """
    eta_seconds = PREPARATION_DELAY_SECONDS + DELIVERY_DELAY_SECONDS + (payload.n_productos * 2)

    deliveries[payload.id_venta] = {
        "id_venta": payload.id_venta,
        "status": "ASIGNADO",
        "created_at": datetime.utcnow().isoformat(),
        "eta_seconds": eta_seconds,
        "completed_at": None,
    }

    logger.info("delivery.created", id_venta=payload.id_venta, eta_seconds=eta_seconds)

    # Ejecutar simulación en background
    asyncio.create_task(_simulate_delivery(payload.id_venta, payload.n_productos))

    return DeliveryStatus(**deliveries[payload.id_venta])


@app.get("/deliveries/{id_venta}")
async def get_delivery(id_venta: int) -> DeliveryStatus:
    if id_venta not in deliveries:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Entrega para venta #{id_venta} no encontrada.")
    return DeliveryStatus(**deliveries[id_venta])


# ── Simulación de Entrega ──────────────────────────────────────────────────────

async def _simulate_delivery(id_venta: int, n_productos: int) -> None:
    """Simula el proceso completo de preparación y entrega."""
    try:
        # Fase 1: Preparación
        logger.info("delivery.preparing", id_venta=id_venta)
        deliveries[id_venta]["status"] = "RECOGIDO"
        await asyncio.sleep(PREPARATION_DELAY_SECONDS)

        # Fase 2: En ruta
        logger.info("delivery.in_route", id_venta=id_venta)
        deliveries[id_venta]["status"] = "EN_RUTA"
        await asyncio.sleep(DELIVERY_DELAY_SECONDS + (n_productos * 2))

        # Fase 3: Entregado
        delivered_at = datetime.utcnow().isoformat()
        deliveries[id_venta]["status"] = "ENTREGADO"
        deliveries[id_venta]["completed_at"] = delivered_at

        logger.info("delivery.completed", id_venta=id_venta)

        # Notificar al backend principal
        await _notify_backend(id_venta)

    except Exception as e:
        logger.error("delivery.simulation_error", id_venta=id_venta, error=str(e))
        deliveries[id_venta]["status"] = "ERROR"


async def _notify_backend(id_venta: int) -> None:
    """Notifica al backend que la entrega fue completada."""
    url = f"{BACKEND_URL}/api/v1/ventas/{id_venta}/delivery-completed"
    headers = {"x-delivery-token": DELIVERY_WEBHOOK_TOKEN}

    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, headers=headers)
                if response.status_code == 200:
                    logger.info("delivery.webhook_success", id_venta=id_venta)
                    return
                else:
                    logger.warning(
                        "delivery.webhook_failed",
                        id_venta=id_venta,
                        status=response.status_code,
                        attempt=attempt + 1,
                    )
        except Exception as e:
            logger.warning("delivery.webhook_error", id_venta=id_venta, error=str(e), attempt=attempt + 1)

        await asyncio.sleep(2 ** attempt)  # Exponential backoff

    logger.error("delivery.webhook_exhausted", id_venta=id_venta)
