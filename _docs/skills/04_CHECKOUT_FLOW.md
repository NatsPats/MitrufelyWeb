# SKILL 04 — Flujo de Venta Transaccional (Checkout) — ACTUALIZADO FASE 4

> **CUÁNDO USAR:** Antes de implementar el módulo `orders`, el checkout, o cualquier proceso que involucre venta + lotes + puntos.
> **Última actualización:** 2026-06-09 — Refleja implementación real post-Fase 4.
> **NOTA FASE 5:** Este documento describe el flujo básico hasta la Fase 4. Para ver la evolución del ciclo de vida (FSM), la integración del microservicio de delivery y costos de envío dinámicos, **LEE OBLIGATORIAMENTE el [SKILL 15 — Máquina de Estados de Pedidos y Delivery](./15_ORDERS_FSM_AND_DELIVERY.md)**.

---

## 1. Visión General del Flujo (REAL)

```
Cliente                 Backend (FastAPI)              PostgreSQL (Triggers)
  │                           │                               │
  ├─POST /ventas/checkout──────▶│                               │
  │  { productos, paquetes }   │                               │
  │                           │── Pre-validar items y stock ───▶│  (sin lock, fast-fail)
  │                           │── Expandir paquetes            │
  │                           │── Calcular totales + IGV       │
  │                           │                               │
  │                           │── async with session.begin():  │
  │                           │   ├─ session.add(venta)        │
  │                           │   ├─ flush()                   │  ←tg_ventas_historial
  │                           │   │                            │  ←tg_detalles_venta_asignar_lotes
  │                           │   │                            │    (FEFO + FOR UPDATE + Kardex)
  │                           │   └─ session.add(Documento)    │
  │                           │                               │
  │◀──201 VentaResponse───────│                               │
  │                           │                               │
  │  [POST /ventas/{id}/pagar] (ADMIN, manual)                │
  │                           │── async with session.begin():  │
  │                           │   ├─ venta.estado_pago=PAGADO  │  ←tg_ventas_otorgar_puntos
  │                           │   └─ pago.estado=APROBADO      │    (CriptoTrufas + cupón USADO)
```

**Flujo alternativo — Checkout desde carrito Redis:**
```
Cliente → POST /ventas/checkout/cart
  → CartService.get_cart(user_id)  →  transformar a VentaRequest  →  create_checkout()  →  clear_cart()
```

---

## 2. Tablas Involucradas

| Tabla | Rol en el Flujo |
|---|---|
| `ventas` | Cabecera del pedido. Se crea como `estado=PENDIENTE, estado_pago=PENDIENTE`. |
| `detalles_venta` | Una fila por producto. **Inmutable** tras insert. Incluye componentes de paquetes expandidos. |
| `detalle_venta_lotes` | Traza física: qué lote → qué detalle. Gestionado por trigger. |
| `metodos_pago` | Registro del pago. `estado_transaccion=PENDIENTE` al crear. Solo `TARJETA`. |
| `venta_paquetes` | Trazabilidad comercial: snapshot del paquete vendido (nombre + composición JSONB). |
| `lotes` | Reducido automáticamente por trigger FEFO con `FOR UPDATE`. |
| `productos` | `stock_actual` cache actualizado por trigger. |
| `movimientos_stock` | Kardex. Insertado automáticamente por trigger. |
| `cupones_cliente` | Estado cambia a `'USADO'` por trigger. |
| `movimientos_puntos` | Acumulación de CriptoTrufas. Insertado por trigger al pagar. |
| `documentos` | Boleta/Factura. Creado en la misma transacción del checkout. |
| `historial_estados_venta` | Auditoría de estados. Gestionado por trigger. |

---

## 3. Pasos de Implementación en el Service (REAL)

### Paso 1: Validaciones Pre-Transaccionales (sin lock)
```python
async def create_checkout(self, id_cliente: int, dto: VentaRequest,
                          tipo_documento=TipoDocumentoVentaEnum.BOLETA) -> VentaResponse:
    # 1a. Carrito vacío
    if not dto.has_items():
        raise BusinessRuleError("La orden debe contener al menos un producto o paquete.")

    # 1b. Validar productos individuales
    for item in dto.productos or []:
        producto = await self.session.execute(select(Producto).where(...))
        if not producto:
            raise NotFoundError(f"Producto {item.id_producto} no encontrado.")
        if not producto.estado:
            raise BusinessRuleError(f"Producto '{producto.nombre}' no disponible.")
        if producto.stock_actual < item.cantidad:
            raise InsufficientStockError(...)

    # 1c. Validar paquetes (expansión)
    for item in dto.paquetes or []:
        paquete_db = await self.paquete_repo.get_by_id(item.id_paquete)
        if not paquete_db or not paquete_db.estado:
            raise BusinessRuleError(f"Paquete no existe o no está activo.")
        for pp in paquete_db.productos:
            if not pp.producto.estado or pp.producto.stock_actual < (pp.cantidad * item.cantidad):
                raise InsufficientStockError(...)
```

### Paso 2: Calcular Totales e IGV
```python
    # 2a. Acumular subtotal de productos y paquetes expandidos
    subtotal = Decimal("0.0")
    # ... sumatoria de productos individuales + componentes de paquetes

    # 2b. Calcular base imponible e IGV (18%)
    base_imponible = (subtotal / Decimal("1.18")).quantize(Decimal("0.01"))
    igv = (subtotal - base_imponible).quantize(Decimal("0.01"))

    nueva_venta.subtotal_productos = subtotal
    nueva_venta.base_imponible = base_imponible
    nueva_venta.igv = igv
    nueva_venta.total = subtotal

    # 2c. MetodoPago PENDIENTE (sin pasarela de pago real)
    nueva_venta.metodos_pago.append(MetodoPago(
        tipo_pago=dto.tipo_pago,
        monto=subtotal,
        estado_transaccion="PENDIENTE",
    ))
```

### Paso 3: Transacción DB (única, atómica)
```python
    try:
        async with self.session.begin():
            # 3a. INSERT ventas → tg_ventas_historial se dispara automáticamente
            self.session.add(nueva_venta)
            await self.session.flush()
            # En el flush se disparan los triggers:
            # tg_detalles_venta_asignar_lotes → FEFO + FOR UPDATE + Kardex
            # tg_ventas_historial → auditoría de estado

            # 3b. INSERT documento (boleta preliminar)
            self.session.add(Documento(
                id_venta=nueva_venta.id_venta,
                tipo_documento=tipo_documento,
            ))

    except DBAPIError as exc:
        error_msg = str(exc.orig) if exc.orig else str(exc)
        if "Stock insuficiente" in error_msg:
            raise InsufficientStockError(error_msg) from exc
        raise DatabaseError(error_msg) from exc
    except Exception as exc:
        raise DatabaseError("Error inesperado al procesar el checkout.") from exc
```

**⚠️ FEFO y Kardex operan solo sobre `detalles_venta`. Los triggers de NeonDB no saben ni les importa si el detalle vino de un producto individual o de la expansión de un paquete.**

### Paso 4: Confirmación de Pago (ADMIN, manual)
```python
async def confirmar_pago(self, id_venta: int) -> VentaResponse:
    venta = await self.session.execute(select(Venta).where(Venta.id_venta == id_venta))
    if not venta:
        raise NotFoundError(...)
    if venta.estado.value == "ANULADO":
        raise BusinessRuleError("No se puede pagar una venta anulada.")
    if venta.estado_pago == EstadoPagoEnum.PAGADO:
        raise BusinessRuleError("La venta ya está pagada.")

    async with self.session.begin():
        venta.estado_pago = EstadoPagoEnum.PAGADO
        pago = await self.session.execute(select(MetodoPago).where(...))
        if pago:
            pago.estado_transaccion = EstadoTransaccionEnum.APROBADO
        await self.session.flush()
        # tg_ventas_otorgar_puntos se dispara → acumula CriptoTrufas
        # tg_ventas_historial → audita cambio de estado
```

**IMPORTANTE:** El pago NO ocurre en el checkout. La venta se crea PENDIENTE/PENDIENTE. Un admin (profesor para pruebas) la marca como PAGADA manualmente vía `PUT /ventas/{id}/pagar`.

---

## 4. Anulación de Venta

### Flujo de Anulación (automático por Celery o manual por admin)
```python
# Celery: expire_pending task
UPDATE ventas SET estado = 'ANULADO'
WHERE estado = 'PENDIENTE' AND estado_pago = 'PENDIENTE'
  AND fecha_venta < NOW() - INTERVAL '15 minutes'
```

**El trigger `tg_ventas_anular` hace TODO lo demás:**
- Revierte stock a lotes
- Libera cupón
- Contra-asienta CriptoTrufas con `AJUSTE_ADMIN`

**⚠️ NUNCA intentar revertir stock o puntos manualmente al anular. El trigger lo hace.**

---

## 5. Estados de la Venta y Transiciones Válidas

```
PENDIENTE ──pagar (ADMIN)──► estado_pago=PAGADO ──► tg_ventas_otorgar_puntos
    │
    └──anular (Celery/ADMIN)──► ANULADO ──► tg_ventas_anular
```

| Transición | Quién la ejecuta |
|---|---|
| `estado_pago: PENDIENTE → PAGADO` | ADMIN vía `PUT /ventas/{id}/pagar` |
| `estado: PENDIENTE → ANULADO` | Celery `expire_pending` (automático, cada 5 min) |

---

## 6. Esquemas Pydantic de Referencia (REAL)

### Request (implementación real)
```python
class ItemProducto(BaseModel):
    id_producto: int = Field(..., gt=0)
    cantidad: int = Field(..., gt=0)

class ItemPaquete(BaseModel):
    id_paquete: int = Field(..., gt=0)
    cantidad: int = Field(..., gt=0)

class VentaRequest(BaseModel):
    origen_venta: OrigenVentaEnum = OrigenVentaEnum.WEB
    id_cupon_cliente: int | None = None
    productos: list[ItemProducto] | None = []
    paquetes: list[ItemPaquete] | None = []
    tipo_pago: TipoPagoEnum = TipoPagoEnum.TARJETA

    def has_items(self) -> bool:
        return len(self.productos or []) > 0 or len(self.paquetes or []) > 0
```

### Response
```python
class VentaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_venta: int
    id_cliente: int
    estado: str
    estado_pago: str
    total: Decimal
    puntos_ganados: int
    fecha_venta: datetime
```

---

## 7. ENUMs Relevantes

| Python Enum | Valores |
|---|---|
| `EstadoVentaEnum` | `PENDIENTE`, `PAGADO`, `ENTREGADO`, `ANULADO` |
| `EstadoPagoEnum` | `PENDIENTE`, `PAGADO` |
| `TipoPagoEnum` | `TARJETA` *(único método activo — EFECTIVO/YAPE/TRANSFERENCIA deprecados)* |
| `EstadoTransaccionEnum` | `PENDIENTE`, `APROBADO`, `RECHAZADO`, `ANULADO` |
| `TipoDocumentoVentaEnum` | `BOLETA`, `FACTURA`, `REPORTE` |
| `OrigenVentaEnum` | `WEB` *(único valor activo)* |

> **Nota:** `OrigenVentaEnum` solo tiene `WEB` en la implementación actual. `APP` y `PRESENCIAL` no están implementados.

---

## 8. Consideraciones de Concurrencia

- Los triggers usan `SELECT ... FOR UPDATE` internamente sobre `productos` y `lotes` (ver `M12_correcion_triggers_ventas.sql`).
- No es necesario hacer lock explícito desde el backend.
- Las pre-validaciones de stock son lecturas sin lock (fast-fail). La integridad real la garantiza el `FOR UPDATE` en el trigger.
- Si dos checkouts simultáneos compiten por el mismo stock, uno fallará con `RAISE EXCEPTION` → el backend captura `DBAPIError` y mapea a `InsufficientStockError`.
- La transacción de checkout usa `async with self.session.begin()` para garantizar rollback completo en caso de error.
- El doble commit (service + DI `get_db_session`) es inofensivo: el segundo commit sobre una sesión ya commiteada es no-op en SQLAlchemy.

---

## 9. Cart Endpoints (Fase 4)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/v1/cart` | Obtener carrito desde Redis |
| `POST` | `/api/v1/cart/items` | Agregar producto o paquete |
| `PUT` | `/api/v1/cart/items/{id}` | Actualizar cantidad |
| `DELETE` | `/api/v1/cart/items/{id}` | Eliminar item |
| `DELETE` | `/api/v1/cart` | Vaciar carrito |

---

## 10. Restricciones de Alcance (Universitario)

| Restricción | Detalle |
|-------------|---------|
| Sin pasarelas de pago reales | No Culqi, Izipay, MercadoPago |
| Sin procesamiento monetario externo | No webhooks de pago, no cobros con tarjeta |
| Pago manual por ADMIN | `PUT /ventas/{id}/pagar` marca como PAGADA |
| Sin PDF de comprobante | `url_archivo` en `None`. Pendiente Fase 7. |
| Sin numeración de documentos | `numero_serie`/`numero_correlativo` en `None` |

> **Nota Fase 6:** El descuento por cupón **sí está implementado**. Ver sección 11.

---

## 11. Descuento por Cupón de Fidelización (Fase 6)

Durante el checkout, si `VentaRequest.id_cupon_cliente` viene informado, `VentaService.create_checkout` aplica el descuento sobre la base imponible elegible según la restricción de categoría del cupón maestro:

- Se recopilan los subtotales junto con el `id_categoria` de cada **producto individual** y de cada **componente de paquete** (los paquetes se expanden a sus productos).
- Si `cupones_maestro.id_categoria IS NULL` → el `%` aplica sobre el subtotal completo.
- Si `cupones_maestro.id_categoria = X` → el `%` aplica solo sobre los subtotales de los items cuya categoría coincida.

```python
# Pseudoclip del cálculo
productos_comprados = []  # (subtotal_linea, id_categoria)
for item in dto.productos or []:
    productos_comprados.append((producto.precio * item.cantidad, producto.id_categoria))
for item in dto.paquetes or []:
    for comp in paquete.componentes:
        productos_comprados.append((comp.precio * comp.cantidad * item.cantidad_paquete, comp.id_categoria))

if cupon_maestro.id_categoria is None:
    base_descuento = sum(s for s, _ in productos_comprados)
else:
    base_descuento = sum(s for s, cid in productos_comprados if cid == cupon_maestro.id_categoria)

monto_descuento = (base_descuento * cupon_maestro.porcentaje_descuento / 100).quantize(Decimal("0.01"))
```

El descuento se aplica **antes** de calcular IGV y envío. El carrito en Redis persiste `id_categoria` y la composición de paquetes; `GET /api/v1/cart` repara en caliente los items antiguos sin esos campos.

---

## 12. Unicidad de Datos Fiscales (Fase 6)

`upsert_datos_fiscales` valida proactivamente que el `numero_documento` no esté registrado por otro usuario antes de intentar el `INSERT`/`UPDATE`, devolviendo `BusinessRuleError` (HTTP 422) en lugar de permitir el `UniqueViolationError` de Postgres. Esto evita errores 500 y problemas de CORS derivados.
