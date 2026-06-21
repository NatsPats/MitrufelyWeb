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
