# Fase 6: Sistema de Fidelización CriptoTrufas y Cuponería

Esta fase implementa el programa de fidelización gamificado de MitrufelyWeb: la moneda interna **CriptoTrufas** (puntos) y el catálogo de cupones de descuento canjeables. Se introduce un módulo de dominio nuevo (`app/modules/sweetcoins`), una tarea Celery de expiración, una serie de endpoints protegidos para cliente y administrador, y la integración completa del flujo en el carrito, el checkout y el panel de administración.

El nombre interno del módulo es `sweetcoins` (backend), pero la entidad de negocio expuesta a los usuarios y a la API es **CriptoTrufas** (`/api/v1/cripto-trufa`).

## 1. Modelo de Negocio

- **Acumulación:** Los clientes acumulan CriptoTrufas automáticamente cuando una venta pasa a estado `PAGADO`. La acumulación la ejecuta el trigger de base de datos `tg_ventas_otorgar_puntos`, no el backend.
- **Fórmula:** `puntos = FLOOR(venta.total * configuracion_recompensas.tasa_conversion)` (por defecto `0.10` → 10% del total).
- **Canje:** Las CriptoTrufas se gastan en el catálogo de cupones maestros (`cupones_maestro`) generando un `cupones_cliente` con código único.
- **Restricción por categoría:** Un cupón maestro puede definir `id_categoria`. En ese caso, el descuento solo aplica sobre los productos (o los componentes de paquetes) que pertenezcan a esa categoría dentro del carrito.
- **Gamificación:** La *Ruleta Dulce* permite apostar 50 CriptoTrufas por premios aleatorios (puntos extra o cupón sorpresa).

## 2. Subfases Implementadas

La fase se ejecutó en 8 subfases consecutivas, cada una verificada con la suite de `pytest` y `tsc --noEmit` / `npm run build`.

### 2.0 Preparación
- Script de datos demo: `_backEnd/scripts/seed_sweetcoins.py`.
- Setups de pruebas: `_backEnd/tests/unit/sweetcoins/factories.py` y `conftest.py`.

### 2.1 Persistencia
- Esquemas Pydantic v2 con `openapi_examples`: `_backEnd/app/modules/sweetcoins/schemas.py`.
- Repositorios SQLAlchemy async con locks pesimistas `SELECT … FOR UPDATE`: `repository.py` (interfaces) y `repository_impl.py` (implementaciones).

### 2.2 Dominio
- Excepciones de dominio en `app/core/exceptions.py` (`InsufficientSweetCoinsError`, `CouponDisabledError`).
- Helper desacoplado de códigos de cupón: `app/modules/sweetcoins/utils/coupon_code.py` (`generate_coupon_code("MTR" | "WIN")`).
- Lógica de negocio en `service.py`.

### 2.3 API
- Enrutador FastAPI: `router.py`. Incluye soporte de `Idempotency-Key` (Redis) en el canje y caché en Redis (TTL 5 min) para el catálogo de cupones disponibles.

### 2.4 Workers
- Servicio desacoplado `expiration_service.py` (`CouponExpirationService.expire_all`).
- Tarea Celery programada diariamente en `celery_app.py` (`expire-sweetcoins-daily`).

### 2.5 & 2.6 Frontend & Checkout
- Store Zustand conectado a la API real con actualización optimista y rollback: `_frontEnd/src/stores/criptotrufa.store.ts`.
- Selector de cupones, descuento dinámico por categoría e indicador de CriptoTrufas a ganar en `CartView.tsx` y `PaymentModal.tsx`.
- Header público sincronizado (`PublicHeader.tsx`), vista de puntos (`PointsView.tsx`) y panel administrativo (`AdminSweetCoinsPage.tsx`).

### 2.7 QA
- Suite unitaria de SweetCoins (7 tests) y suite completa de backend (146 passed) en verde.
- Compilación estricta del frontend (`npm run build`) limpia.

## 3. Estructura del Módulo Backend

```
_backEnd/app/modules/sweetcoins/
├── __init__.py
├── dependencies.py          # DI: get_sweetcoins_service, get_expiration_service
├── expiration_service.py    # CouponExpirationService (invoca sp_expirar_cupones_vencidos)
├── repository.py            # Interfaces (ICuponMaestroRepository, ICuponClienteRepository,
│                            #   IMovimientoPuntosRepository, IConfiguracionRecompensasRepository)
├── repository_impl.py       # Implementaciones SQLAlchemy async
├── router.py                # Endpoints /cripto-trufa/*
├── schemas.py               # Pydantic v2 con openapi_examples
├── service.py               # SweetCoinsService (canje, ajuste, ruleta, dashboard, admin CRUD)
└── utils/
    └── coupon_code.py       # Generador de códigos únicos
```

## 4. Transacciones y Concurrencia

Las operaciones que modifican el saldo de puntos (`canjear_cupon`, `adjust_points`, `jugar_ruleta`) se ejecutan dentro de un **savepoint** (`async with self._session.begin_nested()`). Esto se debe a que SQLAlchemy 2.0 abre implícitamente una transacción al ejecutar la primera consulta de validación, y un `session.begin()` explícito lanzaría `InvalidRequestError: A transaction is already begun`. FastAPI confirma la transacción externa al cerrar la dependencia `get_db_session`.

Antes de debitar puntos se adquiere un lock pesimista sobre las filas del cliente en `movimientos_puntos`:

```python
async def get_saldo_for_update(self, id_cliente: int) -> int:
    stmt = (select(MovimientoPuntos.id_movimiento_punto)
            .where(MovimientoPuntos.id_cliente == id_cliente)
            .with_for_update())
    await self._session.execute(stmt)
    return await self.get_saldo(id_cliente)
```

El saldo se obtiene siempre vía la función PL/pgSQL `fn_saldo_puntos_cliente(id)` — nunca se lee de un campo cacheado.

## 5. Idempotencia del Canje

El endpoint `POST /cripto-trufa/coupons/redeem` soporta la cabecera opcional `Idempotency-Key`:

1. `SET idempotency:redeem:{user}:{key} = "processing" EX 120 NX`.
2. Si ya existía y está `processing` → HTTP 409.
3. Si ya existía y tiene payload → se devuelve la respuesta cacheada.
4. Tras éxito, el resultado serializado reemplaza `"processing"`.
5. En cualquier error, la clave se elimina para permitir reintentos.

## 6. Regla de Descuento por Categoría

Aplica tanto en el backend (cálculo impositivo real del checkout) como en el frontend (previsualización en el carrito):

- Si `cupones_maestro.id_categoria IS NULL` → el `%` se aplica sobre el subtotal completo.
- Si `cupones_maestro.id_categoria = X` → el `%` se aplica **solo** sobre la suma de subtotales de:
  - productos individuales con `id_categoria = X`;
  - componentes de paquetes cuyo `id_categoria = X` (los paquetes se expanden a sus productos).

El carrito en Redis ahora persiste `id_categoria` y la composición de paquetes; el endpoint `GET /api/v1/cart` repara en caliente los items antiguos que no tengan esos campos consultando la base de datos.

## 7. Ruleta Dulce (Gamificación)

`POST /cripto-trufa/play-ruleta` (CLIENTE). Costo: 50 CriptoTrufas, transacción atómica.

| Probabilidad | Resultado         | Efecto                                                  |
|--------------|-------------------|---------------------------------------------------------|
| 50%          | `mala_suerte`     | Solo débito del costo.                                  |
| 30%          | `puntos_extra`    | +100 CriptoTrufas (`PREMIO_JUEGO`).                     |
| 20%          | `cupon_sorpresa`  | `CuponCliente` con `origen = PREMIO_JUEGO` al azar.     |

Si no hay cupones maestros disponibles en el 20%, se otorgan 100 puntos como premio de consolación. El frontend mantiene una animación mínima de 2s para preservar la experiencia lúdica.

## 8. Acumulación Automática (Cambio de Trigger)

**Causa raíz resuelta:** el trigger original solo disparaba en `AFTER UPDATE OF estado_pago`. Las compras online con tarjeta hacían `INSERT` directo con `estado_pago = 'PAGADO'` y no acumulaban puntos.

**Solución:** el trigger se redefinió para `AFTER INSERT OR UPDATE ON ventas`, distinguiendo `TG_OP` antes de leer `OLD`, y guarda contra duplicación verificando si ya existe un `ACUMULACION_VENTA` para ese `id_venta`. Además, solo inserta el movimiento si `v_puntos > 0` (la restricción `movimientos_puntos_cantidad_check` exige `cantidad > 0`), evitando abortar el checkout en compras de monto muy bajo.

## 9. Panel de Administración

Página `/dashboard/criptotrufas` (`AdminSweetCoinsPage.tsx`) con tres pestañas:

1. **Clientes:** buscador, saldos vía `vw_saldo_puntos_cliente`, modal de historial y formulario de ajuste auditado (justificación obligatoria).
2. **Catálogo de Cupones:** CRUD de `cupones_maestro` con selector de categoría (carga vía `GET /categorias`), borrado lógico y badges informativos.
3. **Configuración Global:** edición de `configuracion_recompensas` (tasa de conversión, límite de billetera, días de expiración, estado).

Los endpoints administrativos invalidan la caché Redis `sweetcoins:coupons:available` tras cada modificación del catálogo.

## 10. Endpoints del Módulo

Prefix `/api/v1/cripto-trufa`. Ver el detalle completo en [SKILL 08 — Contratos de API](../skills/08_API_CONTRACTS.md) y [SKILL 06 — CriptoTrufa](../skills/06_CRIPTOTRUFA.md).

| Método | Ruta                          | Rol     | Descripción                                  |
|--------|-------------------------------|---------|----------------------------------------------|
| `GET`  | `/dashboard`                  | CLIENTE | Saldo + cupones activos + últimos 5 movs.    |
| `GET`  | `/balance`                    | CLIENTE | Saldo actual.                                |
| `GET`  | `/history`                    | CLIENTE | Historial de movimientos.                    |
| `GET`  | `/coupons/available`          | CLIENTE | Catálogo canjeable (cacheado).               |
| `POST` | `/coupons/redeem`             | CLIENTE | Canjear cupón (idempotente).                 |
| `GET`  | `/coupons/mine`               | CLIENTE | Cupones propios.                             |
| `GET`  | `/public-config`              | CLIENTE | Configuración activa (solo lectura).         |
| `POST` | `/play-ruleta`                | CLIENTE | Ruleta Dulce.                                |
| `POST` | `/adjust`                     | ADMIN   | Ajuste manual de puntos.                     |
| `GET`  | `/config`                     | ADMIN   | Configuración activa.                        |
| `PUT`  | `/config`                     | ADMIN   | Actualizar configuración global.             |
| `GET`  | `/admin/clientes`             | ADMIN   | Clientes con saldo.                          |
| `GET`  | `/admin/history/{id_cliente}` | ADMIN   | Historial de un cliente.                     |
| `GET`  | `/admin/coupons`              | ADMIN   | Listar cupones maestros.                     |
| `POST` | `/admin/coupons`              | ADMIN   | Crear cupón maestro.                         |
| `PUT`  | `/admin/coupons/{id}`         | ADMIN   | Actualizar cupón maestro.                    |
| `DELETE` | `/admin/coupons/{id}`       | ADMIN   | Desactivar cupón maestro (borrado lógico).   |

## 11. Frontend — Componentes Clave

| Archivo | Responsabilidad |
|---|---|
| `_frontEnd/src/stores/criptotrufa.store.ts` | Estado Zustand global de fidelización; hydrate, canje, ruleta y ajustes contra la API. |
| `_frontEnd/src/stores/cart.store.ts` | Aplica cupones con cálculo por categoría (productos + componentes de paquetes). |
| `_frontEnd/src/features/cart/components/CartView.tsx` | Selector de "Mis Cupones", descuento dinámico, alerta de incompatibilidad y modal de advertencia. |
| `_frontEnd/src/features/cart/components/PaymentModal.tsx` | Resumen de pago simplificado enlazado al store del carrito. |
| `_frontEnd/src/features/sweetcoins/pages/PointsView.tsx` | Vista `/puntos`: saldo, historial, canje y ruleta. |
| `_frontEnd/src/features/sweetcoins/components/ArcadeSection.tsx` | Ruleta Dulce (animación ≥ 2s + `Promise.all`). |
| `_frontEnd/src/features/sweetcoins/components/CouponCard.tsx` | Tarjeta visual de cupón. |
| `_frontEnd/src/features/sweetcoins/pages/AdminSweetCoinsPage.tsx` | Panel admin (clientes, catálogo, configuración). |
| `_frontEnd/src/shared/components/layout/PublicHeader.tsx` | Badge de saldo sincronizado vía store global. |

## 12. Tarea Celery de Expiración

```python
# beat_schedule (celery_app.py)
"expire-sweetcoins-daily": {
    "task": "app.infrastructure.workers.tasks.sweetcoins.expire_coupons",
    "schedule": 86400.0,  # diario
},
```

La tarea invoca `CouponExpirationService.expire_all()`, que a su vez llama a `SELECT sp_expirar_cupones_vencidos()`. El trigger `tg_cupones_cliente_normalizar` ya normaliza estados en cada INSERT/UPDATE.

## 13. Validaciones de Negocio

- Saldo nunca puede quedar negativo (validado por el trigger `tg_movimientos_puntos_validar` y revalidado en el servicio antes de debitar).
- No se puede canjear un cupón inactivo o sin `costo_puntos`.
- No se puede ajustar puntos con `cantidad == 0`, ni a un cliente inexistente, ni dejando saldo negativo.
- No se pueden crear dos cupones maestros con el mismo `nombre`.
- `porcentaje_descuento` acotado en `(0, 100]`; `tasa_conversion` en `[0, 1]`.
- Datos fiscales: el `numero_documento` debe ser único por usuario (validación proactiva que evita el `UniqueViolationError` de Postgres).

## 14. Dependencias con Otras Fases

- **Fase 4 (Checkout):** el descuento por cupón ahora respeta `id_categoria` sobre productos y componentes de paquetes.
- **Fase 5 (Pedidos):** el cambio de estado a `PAGADO` es lo que dispara la acumulación de CriptoTrufas; el fix del trigger cubre tanto `INSERT` (tarjeta online) como `UPDATE` (pago manual admin).
- **SKILL 04 / SKILL 06 / SKILL 08 / SKILL 09 / SK-SQL-06** reflejan los detalles técnicos de esta fase.

---
**Estado de la Fase**: ✅ **Implementada** en `app/modules/sweetcoins`, `app/modules/orders` (descuento por categoría), `app/infrastructure/workers/tasks/sweetcoins.py`, `_frontEnd/src/features/sweetcoins/`, `_frontEnd/src/features/cart/` y `_frontEnd/src/stores/criptotrufa.store.ts`.
