# Mytrufely — Documentación Técnica

Esta carpeta contiene toda la documentación técnica viva del proyecto Mytrufely.

## 📂 Estructura General

```
_docs/
├── README.md                          # Este archivo (guía de documentación)
├── PRINCIPIOS_Y_PATRONES.md           # ← LEER ANTES DE SUSTENTAR (SOLID, MVC y Patrones)
├── ARQUITECTURA_Y_DESARROLLO.md       # Visión arquitectónica integral
├── AUDITORIA_SISTEMA_2026-07-08.md    # ← Auditoría integral + cambios recientes + flujos críticos
├── fases/                             # Documentación por fase de desarrollo
│   ├── plan_fases.md                  # ← Mapa estratégico de las 8 fases
│   ├── fase1_autenticacion.md
│   ├── fase2_catalogo.md
│   ├── fase3_inventario_fefo.md
│   ├── fase4_checkout_ventas.md
│   ├── fase5_pedidos_extendido.md     # FSM de pedidos + mejoras julio 2026
│   ├── fase6_criptotrufas_cuponeria.md
│   └── fase7_reportes_dashboard.md    # ← 7 reportes + comprobantes PDF/Excel
├── skills/                            # Skills de arquitectura/dominio para la IA
│   ├── 00_INDEX.md                    # ← Índice maestro de habilidades
│   ├── 01_DB_SCHEMA.md ... 10_TESTING.md
│   ├── 11_ANALYTICS_BI.md
│   ├── 13_PRODUCTS_CATALOG_CRUD.md
│   ├── 14_REACT_QUERY_LOADERS.md
│   └── 15_ORDERS_FSM_AND_DELIVERY.md  # ← FSM ampliada + titularidad + stock vencido
└── sql_modules/                       # BD factorizada en módulos + skills SQL
    ├── 00_INDEX.md                    # ← Índice maestro de módulos SQL
    └── (M01-M14, SK-SQL-00 a SK-SQL-06)
```

---

## 📋 Plan de Fases y Estado

| Fase | Estado | Documentación |
|---|---|---|
| 1 — Autenticación & Seguridad | ✅ | [fase1](./fases/fase1_autenticacion.md) |
| 2 — Catálogo & Categorías | ✅ | [fase2](./fases/fase2_catalogo.md) |
| 3 — Inventario & Control FEFO | ✅ | [fase3](./fases/fase3_inventario_fefo.md) |
| 4 — Carrito & Checkout Transaccional | ✅ | [fase4](./fases/fase4_checkout_ventas.md) |
| 5 — Pedidos y E-Commerce Extendido | ✅ | [fase5](./fases/fase5_pedidos_extendido.md) |
| 6 — Fidelización CriptoTrufas | ✅ | [fase6](./fases/fase6_criptotrufas_cuponeria.md) |
| 7 — Reportes, Dashboard y Comprobantes | ✅ | [fase7](./fases/fase7_reportes_dashboard.md) |
| 8 — Pruebas, Optimización & Despliegue | ⏳ Pendiente | — |

Mapa estratégico completo en [plan_fases.md](./fases/plan_fases.md). Auditoría integral del estado actual del sistema en [AUDITORIA_SISTEMA_2026-07-08.md](./AUDITORIA_SISTEMA_2026-07-08.md).

---

## 🎯 Sustentación Académica (SOLID, MVC y Patrones)

Para la sustentación y revisión con el docente, hemos preparado una guía arquitectónica detallada que explica cómo se aplican los principios modernos de ingeniería de software directamente sobre el código real de Mytrufely:

👉 **[PRINCIPIOS_Y_PATRONES.md](./PRINCIPIOS_Y_PATRONES.md)** — _Explica SOLID (S-O-L-I-D), el patrón MVC desacoplado y patrones de diseño implementados (Repository, Singleton, Dependency Injection, Chain of Responsibility, Observer, etc.) con fragmentos de código del proyecto._

---

## 🤖 Cómo Usar con la IA

Cuando le pidas a la IA que implemente algo, adjunta el skill relevante al contexto:

```
"Implementa el módulo de inventario. Contexto: @_docs/skills/00_INDEX.md @_docs/skills/05_INVENTORY_STOCK.md @_docs/skills/02_BACKEND_ARCHITECTURE.md"
```

La IA leerá el índice para entender el ecosistema y el skill específico para los detalles técnicos del dominio.

---

## 🔒 Contratos de Autenticación y Seguridad (Para el Frontend)

Hemos actualizado la arquitectura de seguridad y autenticación. A continuación se presentan los contratos de API y flujos exactos que debe consumir el **Frontend**:

### 1. Registro (`POST /api/v1/auth/register`)
Crea un nuevo usuario en la base de datos de forma segura.
* **Payload (JSON):**
  ```json
  {
    "first_name": "Nombre",
    "last_name": "Apellido",
    "email": "cliente@correo.com",
    "password": "Password123",
    "phone": "+51999999999"
  }
  ```
  *(La contraseña requiere al menos 1 mayúscula y 1 número).*
* **Respuesta Exitosa (201 Created):**
  ```json
  {
    "user_id": 12,
    "email": "cliente@correo.com",
    "message": "Cuenta creada exitosamente"
  }
  ```
* **Lógica de negocio:**
  * Si el correo termina en `@mitrufely.com` (dominio administrador especial), se le asigna rol `ADMIN` y `estado = True` (activado inmediatamente).
  * Si es cualquier otro correo, se crea con rol `CLIENTE`, `estado = False` y se le envía un correo HTML interactivo con el link de verificación de cuenta.

### 2. Verificación de Cuenta (`GET /api/v1/auth/verify`)
Activa la cuenta del cliente para permitirle hacer login.
* **Query Params:** `?token=<jwt_verification_token>`
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Cuenta verificada exitosamente. Ya puedes iniciar sesión."
  }
  ```

### 3. Iniciar Sesión (`POST /api/v1/auth/login`)
Autentica al usuario y devuelve los tokens JWT de sesión.
* **Payload (JSON):**
  ```json
  {
    "email": "cliente@correo.com",
    "password": "Password123"
  }
  ```
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in": 3600
  }
  ```
  *(Si el usuario tiene `estado = False`, el backend responderá con `401 Unauthorized` indicando que debe verificar su cuenta vía correo electrónico).*

### 4. Cerrar Sesión (`POST /api/v1/auth/logout`)
Invalida el JWT de manera real e inmediata mediante la lista de bloqueo (blocklist) de Redis.
* **Headers:** `Authorization: Bearer <access_token>`
* **Respuesta Exitosa:** `204 No Content`
* **Lógica de negocio:** El backend calcula el tiempo de vida restante del token (`exp - now`) y lo añade a Redis con ese TTL. Cualquier petición posterior con ese token será rechazada con `401 Unauthorized`.

Para más detalles, consulta el skill específico: 👉 **[03_AUTH_SECURITY.md](./skills/03_AUTH_SECURITY.md)**.

---

## 🛒 Módulo de Carrito, Checkout y Ventas (Fase 4)

Se ha implementado el backend completo para el flujo de compra: carrito persistente en Redis, checkout transaccional con integridad FEFO, generación automática de comprobantes y expiración de ventas pendientes.

### 🛍️ Carrito en Redis
* **Persistencia:** `cart:{user_id}` en formato JSON, TTL de 7 días con sliding expiration.
* **Endpoints:** CRUD completo (`GET /cart`, `POST /cart/items`, `PUT /cart/items/{id}`, `DELETE /cart/items/{id}`, `DELETE /cart`).

### 💳 Checkout Transaccional
* **Checkout directo:** `POST /api/v1/ventas/checkout` — acepta productos y paquetes explícitos.
* **Checkout desde carrito:** `POST /api/v1/ventas/checkout/cart` — lee carrito de Redis, crea venta, vacía carrito.
* **Transacción única:** `async with session.begin()` con rollback automático.
* **FEFO automático:** El trigger `tg_detalles_venta_asignar_lotes` ejecuta `FOR UPDATE` sobre lotes y productos para integridad bajo concurrencia.
* **Documento automático:** Cada checkout genera un `Documento` (BOLETA) en la misma transacción.
* **Sin pasarelas de pago reales:** Alcance universitario. La venta se crea como `PENDIENTE`/`PENDIENTE`. Un admin puede marcarla como `PAGADA` vía `PUT /ventas/{id}/pagar` para pruebas.
* **Puntos automáticos:** Al marcar como `PAGADA`, el trigger `tg_ventas_otorgar_puntos` acumula CriptoTrufas.

### ⏱️ Expiración Automática
* **Celery beat cada 5 minutos:** Anula ventas con más de 15 minutos en estado `PENDIENTE`/`PENDIENTE`.
* **Reversión automática:** El trigger `tg_ventas_anular` restaura stock y libera cupones.

### 🧪 Pruebas
* 50 tests implementados (12 unit CartService, 18 unit VentaService, 8 E2E Cart API, 7 E2E Checkout API, 4 integration Checkout Flow).

Para más detalles, consulta la documentación técnica: 👉 **[fase4_checkout_ventas.md](./fases/fase4_checkout_ventas.md)**.

---

## 📦 Módulo de Inventario y Control de Lotes FEFO (Fase 3)

Se ha implementado el backend completo para la gestión física e inventario de trufas. Dado que son productos perecederos, el sistema utiliza un estricto despacho **FEFO (First Expired, First Out)** a través de triggers de base de datos.

### ⚠️ Regla de Oro: Gobernanza Única en NeonDB (PostgreSQL)
* **Gobernanza del stock:** El backend nunca actualiza directamente `productos.stock_actual` o `lotes.cantidad_disponible`.
* **Triggers automáticos:**
  * **Ingreso de lote (`POST /inventory/lots`):** Registra el lote y activa `tg_lotes_post_insert` para sumar el stock y registrar `INGRESO_COMPRA` en el Kardex.
  * **Ajustes manuales (`POST /inventory/adjustments`):** Registra ajustes de tipo `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO` o `MERMA`. Activa `tg_movimientos_stock_ajustes` (migración [M09_trigger_ajustes_stock.sql](file:///c:/Users/lordm/Desktop/Proyectos%20y%20clases/UTP%20CICLO%206/Integrador%20de%20Sistemas/proyecto/MitrufelyWeb/_modelBD/M09_trigger_ajustes_stock.sql)) que valida la inmutabilidad de lotes vencidos, actualiza el stock disponible del lote/producto y calcula el `stock_resultante` de forma atómica.
  * **Ventas:** El trigger de detalles de venta asocia automáticamente lotes vigentes siguiendo el orden FEFO (fecha de vencimiento más próxima).

### 🛠️ Contratos de API de Inventario (Solo ADMIN)
Todos los endpoints requieren autorización de administrador (Bearer Token con rol `ADMIN`):

#### 1. Registrar Lote (`POST /api/v1/inventory/lots`)
* **Payload (JSON):**
  ```json
  {
    "id_producto": 1,
    "cantidad_inicial": 50,
    "fecha_vencimiento": "2026-06-08T18:04:21Z"
  }
  ```
* **Respuesta (201 Created):** Retorna el lote registrado (con `cantidad_disponible` normalizada a la cantidad inicial y `estado_lote` en `VIGENTE`).

#### 2. Aplicar Ajuste Manual (`POST /api/v1/inventory/adjustments`)
* **Payload (JSON):**
  ```json
  {
    "id_producto": 1,
    "id_lote": 12,
    "tipo_movimiento": "AJUSTE_POSITIVO",
    "cantidad": 15,
    "observacion": "Corrección de inventario"
  }
  ```
  *(Tipos permitidos: `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `MERMA`)*
* **Respuesta (200 OK):** Retorna el movimiento de stock insertado con el `stock_resultante` real calculado por base de datos.

#### 3. Ver Kardex (`GET /api/v1/inventory/kardex/{producto_id}`)
* Devuelve el historial de movimientos ordenados cronológicamente de forma descendente.

#### 4. Conciliación de Stock (`GET /api/v1/inventory/reconciliation`)
* Compara el stock en caché (`productos.stock_actual`) frente al Kardex y las existencias reales por lotes para auditoría de descuadres.

Para más detalles, consulta la documentación técnica específica: 👉 **[fase3_inventario_fefo.md](./fases/fase3_inventario_fefo.md)**.


