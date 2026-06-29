# SKILL 06 — CriptoTrufa (Sistema de Fidelización) — ACTUALIZADO FASE 6

> **CUÁNDO USAR:** Antes de implementar el módulo `sweetcoins`, cupones, consulta de puntos, canjes, ruleta o panel admin de fidelización.
> **Última actualización:** 2026-06-29 — Refleja implementación real post-Fase 6.
> **Módulo backend:** `app/modules/sweetcoins/` · **Prefix API:** `/api/v1/cripto-trufa`

---

## 1. Modelo de Negocio

**CriptoTrufa** es el programa de puntos de fidelización de Mytrufely:

- Los clientes acumulan puntos por cada compra pagada.
- Los puntos pueden canjearse para obtener cupones de descuento.
- Los cupones tienen fecha de expiración y son de uso único por venta.

---

## 2. Tablas Involucradas

| Tabla                       | Rol                                                                  |
| --------------------------- | -------------------------------------------------------------------- |
| `configuracion_recompensas` | Singleton activo. Define `tasa_conversion` y `dias_expiracion`.      |
| `movimientos_puntos`        | Ledger append-only de puntos (positivos y negativos).                |
| `cupones_maestro`           | Plantilla del cupón (porcentaje, costo en puntos, días de vigencia). |
| `cupones_cliente`           | Instancia única por cliente. `codigo_unico VARCHAR(20)`.             |
| `vw_saldo_puntos_cliente`   | Vista para saldo actual.                                             |

---

## 3. Acumulación de Puntos (Automática)

**El backend NO inserta en `movimientos_puntos` directamente para acumulación.**

La acumulación ocurre por el trigger `tg_ventas_otorgar_puntos` definido como `AFTER INSERT OR UPDATE ON ventas` (se dispara tanto si la venta se inserta directamente como `PAGADO` —tarjeta online— como si se actualiza luego —pago manual admin—). El trigger distingue `TG_OP` antes de leer `OLD` y solo inserta el movimiento si `v_puntos > 0` (la restricción `movimientos_puntos_cantidad_check` exige `cantidad > 0`).

**Fórmula del trigger:**

```python
puntos = FLOOR(venta.total * config.tasa_conversion)
# Ejemplo: total=S/.50, tasa=0.10 → 5 CriptoTrufas
```

El trigger también:

1. Inserta en `movimientos_puntos` con tipo `ACUMULACION_VENTA` (con guarda anti-duplicación por `id_venta`).
2. Actualiza `ventas.puntos_ganados`.
3. Marca `cupones_cliente.estado = 'USADO'` si la venta usó cupón.

---

## 4. Consulta de Saldo

### Vía Vista (recomendado para mostrar saldo al cliente)

```python
result = await session.execute(
    text("SELECT puntos_actuales FROM vw_saldo_puntos_cliente WHERE id_cliente = :id"),
    {"id": cliente_id}
)
saldo = result.scalar() or 0
```

### Vía función PL/pgSQL (para validaciones internas)

```python
result = await session.execute(
    text("SELECT fn_saldo_puntos_cliente(:id)"),
    {"id": cliente_id}
)
saldo = result.scalar()
```

---

## 5. Canje de Cupón (Backend sí ejecuta esto)

```http
POST /api/v1/cripto-trufa/coupons/redeem
Idempotency-Key: <uuid-opcional>
{ "id_cupon": <id_cupon_maestro> }
```

### Idempotencia (Redis)

Si llega `Idempotency-Key`, el router hace `SET idempotency:redeem:{user}:{key} = "processing" EX 120 NX`:
- Si ya existe y está `processing` → HTTP 409.
- Si ya existe con payload → se devuelve la respuesta cacheada.
- Tras éxito, se guarda el resultado serializado; ante cualquier error se elimina la clave para permitir reintento.

### Flujo del Service (`SweetCoinsService.canjear_cupon`)

```python
async def canjear_cupon(self, id_usuario: int, id_cupon: int, idempotency_key: str | None = None) -> CuponCliente:
    id_cliente = await self._resolve_cliente_id(id_usuario)  # crea el perfil si no existe
    config = await self._config_repo.get_active()
    cupon_maestro = await self._cupon_maestro_repo.get_by_id(id_cupon)
    # validaciones: existe, activo, costo_puntos > 0

    async with self._session.begin_nested():   # ⚠️ savepoint, NO session.begin()
        saldo_actual = await self._puntos_repo.get_saldo_for_update(id_cliente)  # SELECT ... FOR UPDATE
        if saldo_actual < cupon_maestro.costo_puntos:
            raise InsufficientSweetCoinsError(...)
        # 1. Movimiento COMPRA_CUPON (cantidad negativa, saldo_puntos_resultante calculado)
        # 2. CuponCliente(codigo_unico=generate_coupon_code("MTR"), estado=DISPONIBLE, origen=COMPRA_PUNTOS)
    return cupon_cliente
```

> **⚠️ Transacciones:** usar siempre `begin_nested()` (savepoint). SQLAlchemy 2.0 abre una transacción implícita al ejecutar la primera consulta de validación; un `session.begin()` explícito lanzaría `InvalidRequestError`. FastAPI confirma la transacción externa al cerrar `get_db_session`.

---

## 6. Tipos de Movimiento de Puntos (`tipo_movimiento_puntos_enum`)

| Tipo                | Efecto      | Generado por                                  |
| ------------------- | ----------- | --------------------------------------------- |
| `ACUMULACION_VENTA` | `+puntos`   | `tg_ventas_otorgar_puntos` (auto, INSERT/UPDATE) |
| `COMPRA_CUPON`      | `-puntos`   | Service `canjear_cupon`                       |
| `AJUSTE_ADMIN`      | `+/-puntos` | Service admin `adjust_points`                 |
| `EXPIRACION`        | `-puntos`   | Celery `sp_expirar_cupones_vencidos`          |
| `PAGO_JUEGO`        | `-puntos`   | Service `jugar_ruleta` (costo 50 pts)         |
| `PREMIO_JUEGO`      | `+puntos`   | Service `jugar_ruleta` (premio 100 pts)       |

---

## 7. Expiración de Cupones (Celery)

```python
@celery_app.task(name="criptotrufa.expire_coupons")
async def expire_coupons_task():
    async with get_async_session() as session:
        result = await session.execute(text("SELECT sp_expirar_cupones_vencidos()"))
        count = result.scalar()
        logger.info("criptotrufa.coupons_expired", count=count)
    return count
```

**Trigger `tg_cupones_cliente_normalizar`** también normaliza el estado automáticamente en cada INSERT/UPDATE de `cupones_cliente`.

---

## 8. Configuración de Recompensas

### Solo debe existir UNA configuración activa

```sql
SELECT * FROM configuracion_recompensas WHERE estado = true ORDER BY id_config DESC LIMIT 1;
-- Función equivalente: SELECT fn_config_recompensas_activa()
```

### Campos relevantes

```python
class ConfigRecompensasResponse(BaseModel):
    id_config: int
    tasa_conversion: Decimal    # Puntos por cada S/. gastado (ej: 0.10 → 1 punto cada S/.10)
    limite_puntos_billetera: int # Máximo acumulable (futuro uso)
    dias_expiracion: int         # Días de validez de los puntos acumulados
    estado: bool
```

---

## 9. Schemas Pydantic de Referencia

```python
class CuponMaestroResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_cupon: int
    nombre: str
    descripcion: str | None
    porcentaje_descuento: Decimal
    costo_puntos: int | None       # None si no es canjeable con puntos
    dias_vigencia: int
    estado: bool

class CuponClienteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_cupon_cliente: int
    codigo_unico: str
    estado: EstadoCuponEnum
    origen: OrigenCuponEnum
    fecha_adquisicion: datetime
    fecha_expiracion: datetime
    fecha_uso: datetime | None
    cupon: CuponMaestroResponse    # Nested

class MovimientoPuntosResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_movimiento_punto: int
    tipo_movimiento: TipoMovimientoPuntosEnum
    cantidad: int                   # Positivo o negativo
    saldo_puntos_resultante: int
    fecha_movimiento: datetime
    justificacion: str | None
```

---

## 10. Endpoints del Módulo CriptoTrufa

Prefix `/api/v1/cripto-trufa`.

| Método | Ruta                            | Rol     | Descripción                                |
| ------ | ------------------------------- | ------- | ------------------------------------------ |
| `GET`  | `/dashboard`                    | CLIENTE | Saldo + cupones activos + últimos 5 movs.  |
| `GET`  | `/balance`                      | CLIENTE | Saldo actual del cliente                   |
| `GET`  | `/history`                      | CLIENTE | Historial de movimientos                   |
| `GET`  | `/coupons/available`            | CLIENTE | Cupones maestro canjeables (cacheado Redis 5 min) |
| `POST` | `/coupons/redeem`               | CLIENTE | Canjear cupón (soporta `Idempotency-Key`)  |
| `GET`  | `/coupons/mine`                 | CLIENTE | Cupones propios del cliente                |
| `GET`  | `/public-config`                | CLIENTE | Configuración activa (solo lectura)        |
| `POST` | `/play-ruleta`                  | CLIENTE | Ruleta Dulce (costo 50 pts)                |
| `POST` | `/adjust`                       | ADMIN   | Ajuste manual de puntos (auditado)         |
| `GET`  | `/config`                       | ADMIN   | Ver configuración activa                   |
| `PUT`  | `/config`                       | ADMIN   | Actualizar configuración global            |
| `GET`  | `/admin/clientes`               | ADMIN   | Lista de clientes con saldo                |
| `GET`  | `/admin/history/{id_cliente}`   | ADMIN   | Historial de un cliente específico         |
| `GET`  | `/admin/coupons`                | ADMIN   | Listar todos los cupones maestros          |
| `POST` | `/admin/coupons`                | ADMIN   | Crear cupón maestro                        |
| `PUT`  | `/admin/coupons/{id_cupon}`     | ADMIN   | Actualizar cupón maestro                   |
| `DELETE` | `/admin/coupons/{id_cupon}`   | ADMIN   | Desactivar cupón maestro (borrado lógico)  |

Los endpoints ADMIN que mutan el catálogo invalidan la caché `sweetcoins:coupons:available`.

---

## 11. Dashboard Consolidado (cliente)

`GET /cripto-trufa/dashboard` devuelve en una sola llamada:

```json
{
  "balance": 1650,
  "cupones_activos": [ CuponClienteResponse, ... ],   // estado DISPONIBLE, no expirados
  "historial_reciente": [ MovimientoPuntosResponse, ... ]  // últimos 5
}
```

Reduce latencia en el frontend (`PointsView.tsx`, `PublicHeader.tsx`) frente a tres llamadas separadas.

---

## 12. Ruleta Dulce (`jugar_ruleta`)

`POST /cripto-trufa/play-ruleta`. Operación atómica con `begin_nested()` + `SELECT FOR UPDATE`.

| Probabilidad | `resultado`       | Efecto                                                   |
| ------------ | ----------------- | -------------------------------------------------------- |
| 50%          | `mala_suerte`     | Solo débito de 50 pts (`PAGO_JUEGO`).                    |
| 30%          | `puntos_extra`    | +100 pts (`PREMIO_JUEGO`).                               |
| 20%          | `cupon_sorpresa`  | `CuponCliente` con `origen=PREMIO_JUEGO` al azar (código prefijo `WIN`). Si no hay catálogo, cae a 100 pts de consolación. |

El frontend mantiene animación mínima de 2s (`Promise.all`) para preservar la experiencia.

---

## 13. Restricción de Cupón por Categoría

`cupones_maestro.id_categoria` (nullable):

- `NULL` → el `%` aplica sobre el subtotal completo del carrito.
- `X` → el `%` aplica **solo** sobre la suma de subtotales de:
  - productos individuales con `id_categoria = X`;
  - componentes de paquetes con `id_categoria = X` (los paquetes se expanden a sus productos).

Implementado de forma idéntica en backend (`orders/service.py` → `create_checkout`) y frontend (`cart.store.ts`). El carrito en Redis persiste `id_categoria` y la composición de paquetes; `GET /api/v1/cart` repara en caliente los items antiguos sin esos campos.

---

## 14. Panel de Administración

Página `/dashboard/criptotrufas` (`AdminSweetCoinsPage.tsx`) con tres pestañas:

1. **Clientes** — buscador, saldos vía `vw_saldo_puntos_cliente`, modal de historial y ajuste auditado (justificación obligatoria).
2. **Catálogo de Cupones** — CRUD de `cupones_maestro` con selector de categoría, borrado lógico y badges.
3. **Configuración Global** — edición de `configuracion_recompensas` (tasa, límite, días, estado).

---

## 15. Frontend — Stores y Componentes

| Archivo | Rol |
| ------- | --- |
| `stores/criptotrufa.store.ts` | Estado Zustand: hydrate, canje, ruleta, ajustes. Actualización optimista + rollback. |
| `stores/cart.store.ts` | Aplica cupones con cálculo por categoría (productos + componentes de paquetes). |
| `features/cart/components/CartView.tsx` | Selector "Mis Cupones", descuento dinámico, alerta de incompatibilidad, modal de advertencia. |
| `features/cart/components/PaymentModal.tsx` | Resumen de pago enlazado al store del carrito. |
| `features/sweetcoins/pages/PointsView.tsx` | Vista `/puntos`. |
| `features/sweetcoins/components/ArcadeSection.tsx` | Ruleta Dulce. |
| `features/sweetcoins/pages/AdminSweetCoinsPage.tsx` | Panel admin. |
| `shared/components/layout/PublicHeader.tsx` | Badge de saldo sincronizado. |

---

## 16. Excepciones de Dominio

Definidas en `app/core/exceptions.py`:

| Excepción | HTTP | Cuándo |
| --------- | ---- | ------ |
| `InsufficientSweetCoinsError` | 422 | Saldo de CriptoTrufas insuficiente para canje/ruleta. |
| `CouponDisabledError` | 422 | Cupón maestro inactivo o no existe. |
| `BusinessRuleError` | 422 | Regla de negocio (ajuste 0, saldo negativo, nombre duplicado). |
| `NotFoundError` | 404 | Cliente o cupón no encontrado. |

---

## 17. Validaciones Clave

- Saldo nunca negativo (trigger + service revalidan).
- No canjér de cupón inactivo o sin `costo_puntos`.
- Ajuste admin: `cantidad != 0`, cliente existente, saldo resultante ≥ 0, justificación obligatoria (5–255 chars).
- Nombre de cupón maestro único.
- `porcentaje_descuento ∈ (0, 100]`; `tasa_conversion ∈ [0, 1]`.
- `numero_documento` fiscal único por usuario (validación proactiva anti-`UniqueViolationError`).
