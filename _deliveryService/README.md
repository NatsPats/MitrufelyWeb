# Mifrufely Delivery Service

Microservicio independiente de simulación de entregas.

## Configuración

Copia `.env.example` y ajusta las variables:

```env
BACKEND_URL=http://localhost:8000
DELIVERY_WEBHOOK_TOKEN=dev-webhook-token
PREPARATION_DELAY_SECONDS=5
DELIVERY_DELAY_SECONDS=10
```

## Ejecución

```bash
cd _deliveryService
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

## Endpoints

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/deliveries` | Inicia una entrega simulada |
| `GET` | `/deliveries/{id_venta}` | Estado actual de la entrega |

## Flujo de Simulación

```
POST /deliveries {id_venta, n_productos}
  → status: ASIGNADO (inmediato)
  → asyncio.sleep(PREPARATION_DELAY_SECONDS)
  → status: RECOGIDO
  → asyncio.sleep(DELIVERY_DELAY_SECONDS + n_productos*2)
  → status: EN_RUTA
  → entregado
  → POST {BACKEND_URL}/api/v1/ventas/{id}/delivery-completed
    (con header X-Delivery-Token)
```

## Variables de Entorno

| Variable | Default | Descripción |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8000` | URL del backend FastAPI principal |
| `DELIVERY_WEBHOOK_TOKEN` | `dev-webhook-token` | Token de seguridad del webhook |
| `PREPARATION_DELAY_SECONDS` | `5` | Segundos de simulación de preparación |
| `DELIVERY_DELAY_SECONDS` | `10` | Segundos de simulación de tránsito |
