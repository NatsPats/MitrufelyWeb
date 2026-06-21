# SKILL 15 — Máquina de Estados de Pedidos (FSM) y Delivery Service (Fase 5 - M14)

> **CUÁNDO USAR:** Antes de implementar lógicas relacionadas con el ciclo de vida extendido de pedidos, tracking, envíos, y notificaciones al cliente.
> **Última actualización:** Junio 2026

---

## 1. Visión General del Nuevo Ciclo de Vida (FSM)

El módulo de pedidos evoluciona de un flujo simple (Pendiente -> Pagado -> Entregado) a una **Máquina de Estados Finita (FSM)** que modela un ciclo de e-commerce real. 

### Estados Posibles

- **`PENDIENTE`**: Pedido creado, a la espera de pago.
- **`PAGADO`**: Pago confirmado (manualmente en admin).
- **`PREPARANDO`**: El pedido entra en fase de preparación física/empacado.
- **`EN_CAMINO`**: El pedido ha sido entregado al transportista y está en ruta.
- **`ENTREGADO`**: El cliente recibe su pedido exitosamente.
- **`CANCELADO`**: Anulado antes del pago (o por falta de pago) (Mapeado también desde `ANULADO`).
- **`DEVUELTO`**: El cliente retorna el producto después de la entrega.
- **`REEMBOLSADO`**: El pago es regresado al cliente por problemas tras haber pagado.

### Transiciones Válidas (FSM Rules)
- **`pagar`**: PENDIENTE → PAGADO
- **`preparar`**: PAGADO → PREPARANDO
- **`despachar`**: PREPARANDO → EN_CAMINO
- **`entregar`**: EN_CAMINO → ENTREGADO
- **`cancelar`**: PENDIENTE → CANCELADO
- **`reembolsar`**: PAGADO | PREPARANDO → REEMBOLSADO
- **`devolver`**: ENTREGADO → DEVUELTO

**Regla de Negocio Crítica:** Las transiciones fallarán (Lanzando `BusinessRuleError`) si se intenta brincar estados no permitidos.

---

## 2. Emisión de Eventos (Order Tracking)

Cada transición exitosa en la FSM emite un evento interno en base de datos hacia la tabla `order_events` (historial de tracking).

| Transición | Descripción Generada para el Evento |
|---|---|
| `pagar` | "Pago confirmado. Tu pedido está en la cola de procesamiento." |
| `preparar` | "Tu pedido está siendo preparado y empaquetado." |
| `despachar` | "Tu pedido ha sido entregado al transportista." |
| `entregar` | "El pedido ha sido entregado exitosamente." |
| `reembolsar` | "Se ha procesado un reembolso por tu pedido. Motivo: ..." |
| `devolver` | "El pedido ha sido devuelto a nuestras instalaciones. Motivo: ..." |

Estos eventos se consultan de manera pública/privada vía el endpoint `/ventas/{id}/tracking` para alimentar el componente `OrderTrackingTimeline` del frontend.

---

## 3. Microservicio de Delivery (FastAPI Independiente)

Para separar responsabilidades y simular integraciones de terceros (como un courier), se ha extraído la lógica de costo de envío a un microservicio independiente.

- **Ubicación:** `delivery-service/`
- **Puerto:** `8001` (vía Docker)
- **Responsabilidad:** Calcular el costo de envío dependiendo del subtotal y de la configuración de negocio en tiempo real.
- **Endpoint Principal:** `GET /delivery/quote?subtotal={amount}`

**Flujo de Comunicación:**
1. El frontend envía la petición al Backend Principal (`GET /config/shipping-cost?subtotal=X`).
2. El Backend Principal delega de manera síncrona (vía `httpx`) la cotización al `delivery-service`.
3. El Backend Principal enriquece la respuesta con reglas de negocio (ej. "Aplica envío gratis").
4. El Frontend (`CartView` o `CheckoutPage`) pinta el resultado dinámico en la UI.

---

## 4. Configuración Dinámica de Negocio

El administrador puede cambiar en tiempo real los costos base y los umbrales de envío gratuito sin modificar código ni variables de entorno.

- **Entidad:** `SystemConfig` (Tabla unifilar `system_config` limit 1).
- **Columnas Relevantes:**
  - `shipping_base_cost`: Costo por defecto del envío (ej. S/. 15.00).
  - `free_shipping_threshold`: Monto del carrito para que el envío sea S/. 0.00 (ej. S/. 100.00).
- **Backend Endpoint:** `PUT /admin/config/shipping`
- **Frontend Page:** `/dashboard/config` (`AdminConfigPage.tsx`)

---

## 5. Incidencias y Reseñas (Reviews & Issues)

Se ha añadido la capacidad de que el usuario interactúe sobre su pedido según el estado en el que se encuentre:

1. **Incidencias (Issues)**: 
   - Se habilitan cuando el estado es `EN_CAMINO` o posteriores.
   - Permite reportar "Pedido no llegó", "Paquete dañado", etc.
2. **Reseñas (Reviews)**:
   - Se habilitan exclusivamente cuando el estado es `ENTREGADO`.
   - Permite otorgar una calificación (1-5 estrellas) y un comentario público.

Estas métricas alimentan automáticamente el Dashboard Administrativo.

---

## 6. Sistema de Notificaciones (Polling)

La FSM también genera notificaciones dirigidas al cliente cuando su pedido cambia de estado.

- **Entidad:** `Notificacion`
- **Frontend:** Implementado mediante `react-query` con polling en `useNotifications.ts` (cada 30 seg).
- **UI:** Componente visual de campanita (`NotificationBell.tsx`) en el `Navbar`.

---

## 7. Alcance y Restricciones (Proyecto Universitario)
- **Docker Compose:** La comunicación Backend <-> Delivery Service se realiza por nombre de contenedor en Docker (`http://delivery:8001`), o `localhost:8001` en dev puro.
- **Notificaciones WebSockets:** Deprecadas en favor de Polling simple para evitar la complejidad de infraestructura bidireccional en el alcance de este proyecto, dado que hay múltiples contenedores.
