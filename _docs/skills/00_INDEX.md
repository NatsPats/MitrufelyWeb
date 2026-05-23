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
| [`06_SWEETCOINS.md`](./06_SWEETCOINS.md)                       | SweetCoins (Fidelización)                 | Cupones, puntos, canjes, configuración de recompensas    |
| [`07_FRONTEND_ARCHITECTURE.md`](./07_FRONTEND_ARCHITECTURE.md) | Arquitectura React 19 + Vite              | Estado híbrido, routing, componentes, Tailwind v4        |
| [`08_API_CONTRACTS.md`](./08_API_CONTRACTS.md)                 | Contratos de API                          | Envelopes de respuesta, paginación, códigos de error     |
| [`09_BACKGROUND_TASKS.md`](./09_BACKGROUND_TASKS.md)           | Celery / Workers                          | Tareas asíncronas, PDF, notificaciones, expiración batch |
| [`10_TESTING.md`](./10_TESTING.md)                             | Testing Strategy                          | Unit, Integration, E2E con pytest + httpx                |

---

## Contexto Global del Proyecto

- **Nombre comercial:** Mytrufely (pastelería y confitería)
- **Nombre técnico en código:** `mifrufely` / `Mifrufely`
- **BD:** PostgreSQL (NeonDB) — script físico en `_modelBD/Query1.sql`
- **Backend:** FastAPI 0.115 + SQLAlchemy 2.0 async + asyncpg + Pydantic v2
- **Frontend:** React 19 + Vite + TypeScript strict + Tailwind CSS v4
- **Auth:** JWT HS256 + RBAC (roles: ADMIN, CLIENTE, CAJERO, ALMACEN)
- **Queue:** Celery + Redis broker
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
├── products/      # Catálogo, categorías
├── inventory/     # Lotes, Kardex, stock
├── orders/        # Ventas, detalles, estados
├── cart/          # Carrito efímero (Redis)
├── sweetcoins/    # Puntos, cupones, canjes
├── reports/       # PDF, Excel, documentos
└── dashboard/     # Métricas, KPIs
```
