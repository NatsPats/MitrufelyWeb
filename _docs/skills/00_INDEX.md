# MYTRUFELY — SKILLS INDEX (Mapa de Capacidades Técnicas)

> **INSTRUCCIÓN PARA LA IA:** Este archivo es el punto de entrada del sistema de skills del proyecto Mytrufely.
> Lee este índice primero y luego carga el archivo de skill específico que corresponda a la tarea solicitada.
> **NUNCA** generes código sin antes haber leído el skill correspondiente.

---

## ¿Qué es este sistema?

Cada archivo en `_docs/skills/` representa un **dominio técnico específico** del ecosistema Mytrufely.
Están diseñados para ser pasados a la IA como contexto de referencia antes de implementar cualquier módulo.

---

## Árbol de Skills

| Skill File                                                     | Dominio                                   | Cuándo Usarlo                                            |
| -------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| [`01_DB_SCHEMA.md`](./01_DB_SCHEMA.md)                         | Base de Datos PostgreSQL                  | Modelar entidades ORM, entender triggers, vistas, enums  |
| [`02_BACKEND_ARCHITECTURE.md`](./02_BACKEND_ARCHITECTURE.md)   | Arquitectura FastAPI (Clean Architecture) | Crear módulos, routers, services, repositories, schemas  |
| [`03_AUTH_SECURITY.md`](./03_AUTH_SECURITY.md)                 | Autenticación y RBAC                      | JWT, roles, dependencias de seguridad, permisos          |
| [`04_CHECKOUT_FLOW.md`](./04_CHECKOUT_FLOW.md)                 | Flujo de Venta Transaccional              | Carrito → Checkout → Pago → Lotes FEFO → Puntos          |
| [`05_INVENTORY_STOCK.md`](./05_INVENTORY_STOCK.md)             | Inventario y Lotes                        | Gestión de lotes, Kardex, FEFO, expiración, stock        |
| [`06_CRIPTOTRUFA.md`](./06_CRIPTOTRUFA.md)                     | CriptoTrufas (Fidelización)                | Cupones, puntos, canjes, ruleta, panel admin de fidelización |
| [`07_FRONTEND_ARCHITECTURE.md`](./07_FRONTEND_ARCHITECTURE.md) | Arquitectura React 19 + Vite              | Estado híbrido, routing, componentes, Tailwind v4        |
| [`08_API_CONTRACTS.md`](./08_API_CONTRACTS.md)                 | Contratos de API                          | Envelopes de respuesta, paginación, códigos de error     |
| [`09_BACKGROUND_TASKS.md`](./09_BACKGROUND_TASKS.md)           | Celery / Workers                          | Tareas asíncronas, PDF, notificaciones, expiración batch |
| [`10_TESTING.md`](./10_TESTING.md)                             | Testing Strategy                          | Unit, Integration, E2E con pytest + httpx                |
| [`11_ANALYTICS_BI.md`](./11_ANALYTICS_BI.md)                   | Módulo de Analítica e Inteligencia (BI)   | Gráficos, KPIs, Reportes PDF WeasyPrint y Excel asíncrono |
| [`12_STORAGE_MEDIA.md`](./12_STORAGE_MEDIA.md)                 | Almacenamiento y Multimedia (Cloudinary)  | Subida y optimización de imágenes con Pillow e integridad |
| [`13_PRODUCTS_CATALOG_CRUD.md`](./13_PRODUCTS_CATALOG_CRUD.md) | Catálogo de Productos                     | Patrones avanzados de CRUD, disponibilidad, auto-slug    |
| [`14_REACT_QUERY_LOADERS.md`](./14_REACT_QUERY_LOADERS.md)     | Loaders y Transiciones de Estado          | Manejo de loaders, isPlaceholderData, transiciones UX    |
| [`15_ORDERS_FSM_AND_DELIVERY.md`](./15_ORDERS_FSM_AND_DELIVERY.md)| Máquina de Estados y Delivery M14        | Flujo extendido FSM, tracking, microservicio de envío    |

---

## Contexto Global del Proyecto

- **Nombre comercial:** Mytrufely (pastelería y confitería)
- **Nombre técnico en código:** `mifrufely` / `Mifrufely`
- **BD:** PostgreSQL (NeonDB) — script físico en `_modelBD/Query1.sql`
- **Backend:** FastAPI 0.115 + SQLAlchemy 2.0 async + asyncpg + Pydantic v2
- **Frontend:** React 19 + Vite + TypeScript strict + Tailwind CSS v4
- **Auth:** JWT HS256 + RBAC (roles: ADMIN, CLIENTE)
- **Queue:** Celery + Redis broker
- **Microservicios:** `delivery-service` en puerto 8001
- **API prefix:** `/api/v1`
- **Response envelope:** `{ success, data, message }` / `{ success, error, request_id }`

---

## Convenciones de Nomenclatura (Global)

| Elemento          | Convención            | Ejemplo                         |
| ----------------- | --------------------- | ------------------------------- |
| Archivos Python   | `snake_case`          | `auth_service.py`               |
| Clases Python     | `PascalCase`          | `AuthService`                   |
| Funciones         | `snake_case`          | `get_current_user`              |
| Constantes        | `UPPER_SNAKE`         | `ROLE_PERMISSIONS`              |
| Tablas DB         | `snake_case`          | `detalle_venta_lotes`           |
| Esquemas Pydantic | `PascalCase` + sufijo | `LoginRequest`, `TokenResponse` |
| Endpoints HTTP    | `kebab-case`          | `/api/v1/sweet-coins`           |
| Tests             | `test_<sujeto>.py`    | `test_auth_service.py`          |

---

## Quick Reference — Módulos Backend

```
app/modules/
├── auth/          # Login, registro, tokens
├── users/         # Perfil, datos fiscales
├── categories/    # Categorías CRUD (slug, soft delete)       ← [Fase 2 — M13]
├── products/      # Catálogo, categorías, paquetes comerciales ← [Fase 2]
├── inventory/     # Lotes, Kardex, stock                      ← [Fase 3]
├── orders/        # Ventas, checkout, detalles, estados, FSM   ← [Fase 4 & 5]
├── cart/          # Carrito persistente en Redis               ← [Fase 4]
├── config/        # Configuración dinámica del negocio         ← [Fase 5]
├── reviews/       # Calificaciones e incidencias               ← [Fase 5]
├── notifications/ # Eventos y notificaciones en tiempo real    ← [Fase 5]
├── sweetcoins/    # Puntos CriptoTrufas, cupones, ruleta       ← [Fase 6]
├── reports/       # PDF, Excel, documentos                    ← [Fase 7 pendiente]
└── dashboard/     # Métricas, KPIs                            ← [Fase 5]
```

---

## Documentación de Fases Implementadas

| Fase | Documento | Estado |
|------|-----------|--------|
| Fase 1 — Autenticación | [`_docs/fases/fase1_autenticacion.md`](../fases/fase1_autenticacion.md) | ✅ Implementado |
| Fase 2 — Catálogo y Paquetes | [`_docs/fases/fase2_catalogo.md`](../fases/fase2_catalogo.md) | ✅ Implementado |
| Fase 3 — Inventario FEFO | [`_docs/fases/fase3_inventario_fefo.md`](../fases/fase3_inventario_fefo.md) | ✅ Implementado |
| Fase 4 — Carrito y Checkout | [`_docs/fases/fase4_checkout_ventas.md`](../fases/fase4_checkout_ventas.md) | ✅ Implementado |
| Fase 5 — Pedidos FSM M14 | [`_docs/fases/fase5_pedidos_extendido.md`](../fases/fase5_pedidos_extendido.md) | ✅ Implementado |
| Fase 6 — CriptoTrufas y Cuponería | [`_docs/fases/fase6_criptotrufas_cuponeria.md`](../fases/fase6_criptotrufas_cuponeria.md) | ✅ Implementado |

---

## Skills Relacionadas por Módulo

| Módulo | Skills a Leer |
|--------|---------------|
| `products/` (paquetes) | `04_CHECKOUT_FLOW.md` § Expansión + `08_API_CONTRACTS.md` § Packages + `12_STORAGE_MEDIA.md` |
| `orders/` (checkout & FSM) | `04_CHECKOUT_FLOW.md` + `05_INVENTORY_STOCK.md` + `15_ORDERS_FSM_AND_DELIVERY.md` |
| `sweetcoins/` (CriptoTrufas) | `06_CRIPTOTRUFA.md` + `04_CHECKOUT_FLOW.md` §11 + `09_BACKGROUND_TASKS.md` §4.3 + `SK-SQL-06` |
| `storage/` | `12_STORAGE_MEDIA.md` (subida, Pillow, rollback transaccional) |
| `tests/` | `10_TESTING.md` (conftest real, NullPool, Redis mock) |
| `frontend/` (loaders) | `07_FRONTEND_ARCHITECTURE.md` + `14_REACT_QUERY_LOADERS.md` |
