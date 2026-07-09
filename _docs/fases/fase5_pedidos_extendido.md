# Fase 5: Sistema de Pedidos y E-commerce (Extendido)

Esta fase representa la modernización del ciclo de vida del pedido, transformando la simple lógica de venta en un sistema de e-commerce real con estados definidos, control de entregas con un microservicio asíncrono, cálculo de envío, tracking de envíos, notificaciones en tiempo real (polling), panel de métricas administrativas, calificaciones de pedidos y gestión de incidencias y reembolsos (que reintegran stock al Kardex).

## 1. Máquina de Estados Finita (FSM) Inmutable

El ciclo de vida del pedido ya no depende de cambios de estado arbitrarios. Se ha implementado un patrón State Machine que restringe qué transiciones son válidas y bajo qué condiciones.

### Estados Válidos
* `PENDIENTE`: Estado inicial al crear el carrito o generar el checkout sin pago.
* `PAGADO`: El administrador o pasarela confirma el pago. Dispara la asignación a preparación.
* `PREPARANDO`: El operario inicia el proceso en tienda.
* `EN_CAMINO`: El pedido sale con el microservicio de `delivery-service`.
* `ENTREGADO`: El cliente recibe el pedido, fin del ciclo feliz. Permite la calificación (`reviews`).
* `CANCELADO`: Se anula antes del pago.
* `DEVUELTO`: El pedido físico regresa a la tienda tras un rechazo en puerta.
* `REEMBOLSADO`: Se reintegra el dinero al cliente por una falla (`issues`).
* `ANULADO`: Error de sistema, la venta nunca debió procesarse.

### Reglas de Transición (FSM)
Cualquier intento de mover un pedido de `PENDIENTE` a `ENTREGADO` fallará a nivel de servicio (`BusinessRuleError`). Todas las transiciones registran un log inmutable en la tabla `order_events` con fecha, IP, usuario que ejecuta la acción y payload.

## 2. Microservicio de Delivery

Para simular latencias reales del mundo físico sin bloquear el backend de la tienda, se ha creado el `_deliveryService`.
* Es un servicio de Python independiente en FastAPI que corre en el puerto `8001`.
* Cuando un pedido pasa a `PAGADO`, el backend de MitrufelyWeb llama a este microservicio mediante webhook.
* El `delivery-service` simula la preparación (ej: 5s) y el tránsito en ruta (ej: 10s).
* Al finalizar el tránsito, llama de regreso al backend (`/api/v1/ventas/{id}/delivery-completed`) para transicionar la venta a `ENTREGADO`.

## 3. Configuración Dinámica y Envíos (Módulo Config)

Los costos y tiempos de envío ya no están "hardcodeados":
* Se creó la tabla `system_config` para almacenar el costo base de envío (`shipping_base_cost`) y el umbral de envío gratuito (`free_shipping_threshold`).
* Un servicio de caché con `Redis` almacena esta configuración para que el cálculo en tiempo real no golpee PostgreSQL en cada iteración del carrito.
* El `SystemConfigService.calcular_costo_envio(subtotal)` determina si cobra o no.

## 4. Historial, Incidentes y Calificaciones

### Tracking y Eventos (`order_events`)
Cada vez que el pedido cambia de estado se crea un evento inmutable. El cliente puede consultar `GET /ventas/{id}/tracking` para ver la línea de tiempo real.

### Calificaciones (`reviews`)
Solo aplicable a pedidos en estado `ENTREGADO`. El cliente evalúa del 1 al 5 estrellas. Sirve como KPI para el dashboard de administración.

### Incidencias (`issues`) y Reembolsos (`refunds`)
Un cliente puede reportar un problema (ej: "Trufa derretida"). Esto abre un issue. Si el administrador decide reembolsar, la venta pasa a `REEMBOLSADO`, y mediante reglas de negocio **el inventario del Kardex se reintegra usando un movimiento de tipo `DEVOLUCION`**, asegurando coherencia contable y logística (FEFO estricto).

## 5. Dashboard Administrativo

Un router completamente nuevo (`/admin/dashboard/metrics`) que agrupa la carga analítica para que el panel administrativo del frontend (React) lo consuma.
Provee:
* Conteo general de pedidos por cada estado del FSM.
* Venta bruta total y total reembolsado.
* Tiempo promedio de entrega.
* Los 10 productos más vendidos (cantidades y montos).
* Tendencia financiera de ventas agrupada por día de los últimos 30 días.
* Rating global promedio.

## 6. Sistema de Notificaciones

Tabla `notifications` que alerta de forma asíncrona al cliente: "Tu pedido está en camino", "Tu reembolso ha sido aprobado". Preparado para implementarse en el frontend con Long Polling nativo y visualizado como una "campana" en la NavBar.

---
**Estado de la Fase**: ✅ **Implementada** en `app/modules/orders`, `app/modules/config`, `app/modules/reviews`, `app/modules/dashboard`, `app/modules/issues`, `app/modules/notifications` y `_deliveryService`.

## 7. Ajustes Menores Introducidos durante la Fase 6

Durante la integración de la Fase 6 se detectaron y corrigieron varios detalles de estabilidad en el módulo de pedidos:

- **`greenlet_spawn` al serializar la venta:** el validador raíz `extract_has_review` en `orders/schemas.py` ahora detecta si el objeto de entrada es una entidad SQLAlchemy real y construye un dict solo con las columnas/relaciones ya cargadas (`col.key not in insp.unloaded`), impidiendo lazy-loads síncronos que rompían el event loop al validar `VentaResponse`.
- **Indicadores de carga en transiciones:** `OrdersPage.tsx` mantiene el modal de confirmación abierto durante la petición HTTP, mostrando un spinner y deshabilitando ambos botones para evitar doble-submit.
- **Validación de transiciones (frontend):** el flujo de FSM refleja de forma reactiva los estados del backend con feedback inmediato (toasts) en cada éxito o error.

Estos cambios no alteran el contrato de la Fase 5; refuerzan su robustez operativa.

## 8. Mejoras Introducidas en Julio 2026 (FSM robusta + seguridad + stock vencido)

Tras la implementación inicial se detectaron varios problemas operativos que requirieron extender la FSM, añadir control de autorización y corregir el reintegro de stock. El detalle técnico completo está en [SKILL 15](../skills/15_ORDERS_FSM_AND_DELIVERY.md) y en la [Auditoría del Sistema](../AUDITORIA_SISTEMA_2026-07-08.md).

### 8.1 FSM ampliada con escenarios de error

La FSM original tenía una brecha crítica: un pedido `EN_CAMINO` **solo podía ir a `ENTREGADO`**. Si la entrega fallaba (cliente no ubicado, dirección errada, producto dañado en ruta), el pedido quedaba **atascado** sin transición válida.

**Transiciones añadidas:**
- `EN_CAMINO → DEVUELTO`: pedido en tránsito que retorna a tienda.
- `ENTREGADO → REEMBOLSADO`: reembolso directo sin forzar pasar por `DEVUELTO`.

Ver diagrama completo en [SKILL 15 §1](../skills/15_ORDERS_FSM_AND_DELIVERY.md). Nuevo helper `can_devolver(estado)` añadido.

### 8.2 Bug bloqueante: cancelación desde el panel no funcionaba

**Síntoma:** el admin intentaba cancelar un pedido desde `/orders` y la acción fallaba silenciosamente.

**Causa raíz:** el modal de confirmación del frontend (`OrdersPage.tsx`) llamaba a la mutación **sin enviar el `motivo`** obligatorio que el backend exige (`CancelRequest.motivo`, mín. 5 caracteres). Resultado: HTTP 422 (validación de Pydantic) **antes** de que la FSM se evaluara.

**Fix:** el modal ahora captura `motivo` (para cancelar/devolver) y `monto` (para reembolsar), valida cliente-side (mín. 5 caracteres) y construye el payload antes de enviar. Además, **ya no se cierra ante un error** — muestra el mensaje dentro del modal para permitir reintentar.

### 8.3 Alineación UI ↔ FSM

Los botones de acción del panel admin ahora reflejan exactamente las transiciones permitidas:
- `CANCELADO`: disponible en `PENDIENTE`, `PAGADO` y `PREPARANDO` (antes solo en `PENDIENTE`).
- `DEVOLVER`: disponible en `EN_CAMINO` (nuevo) y `ENTREGADO`.
- `REEMBOLSAR`: disponible en `ENTREGADO`, `CANCELADO`, `DEVUELTO`; **removido de `PAGADO`** (no permitido por la FSM).
- `CANCELADO`/`DEVUELTO`: muestran `REEMBOLSAR` como única acción.

### 8.4 Verificación de titularidad (seguridad)

**Brecha detectada:** los endpoints `PUT /ventas/{id}/cancelar` y `/devolver` usaban `AuthUser` (cualquier usuario autenticado) y **no verificaban titularidad**. Un cliente podía cancelar/devolver el pedido de otro pasando un `id_venta` ajeno.

**Fix:** `VentaService._verificar_titularidad(venta, id_usuario, es_admin)` — si el usuario es cliente, valida que `venta.cliente.id_usuario == id_usuario`; si no coincide, lanza `ForbiddenError` (403). Los ADMIN tienen bypass. El flag `es_admin` se deriva de `current_user.is_admin()` en el router.

### 8.5 Cancelación por el cliente

Antes, **solo el admin** podía cancelar pedidos. Ahora el cliente puede cancelar sus propios pedidos desde `CustomerOrderDetailPage` cuando el estado es cancelable (`PENDIENTE`/`PAGADO`/`PREPARANDO`), con un modal de motivo. El backend valida la titularidad.

### 8.6 Fix de regresión: resolución de incidencias

La verificación de titularidad (§8.4) rompió el flujo de `IssueService.actualizar_incidencia`: al resolver una incidencia como devolución, llamaba a `venta_service.solicitar_devolucion` **sin** `es_admin=True`, por lo que el admin fallaba el chequeo de titularidad (`ForbiddenError`). Corregido: ahora pasa `es_admin=True`, coherente con que `/admin/incidencias/*` está protegido por `AdminUser`.

### 8.7 Fix de stock negativo en devolución de lotes vencidos

**Bug:** al devolver unidades de un lote vencido, `_devolver_stock` insertaba un `MovimientoStock(VENCIMIENTO)` que **restaba** del Kardex, pero esas unidades ya habían sido restadas por el movimiento `VENTA` original → **doble sustracción** → stock negativo y descuadre en la conciliación.

**Fix:** la rama de lote vencido en `_devolver_stock` **ya no inserta ningún movimiento** en el Kardex. Las unidades se descartan sin afectar el balance contable. La trazabilidad se conserva vía `OrderEvent` ("N unidad(es) eliminada(s) por vencimiento") y log estructurado. Ver auditoría contable completa en [AUDITORIA §2.2](../AUDITORIA_SISTEMA_2026-07-08.md).

### 8.8 Tests añadidos

- `tests/unit/test_state_machine.py` (55 tests): transiciones válidas/inválidas, estados terminales, helpers.
- Extensión de `tests/unit/test_venta_service.py` (`TestVentaServiceCancelar`): titularidad, admin cross-user, estado no cancelable, dueño exitoso.

**Suite completa: 200 passed, 0 failed.**
