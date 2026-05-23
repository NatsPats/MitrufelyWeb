# SKILL 04 — Flujo de Venta Transaccional (Checkout)

> **CUÁNDO USAR:** Antes de implementar el módulo `orders`, el checkout, o cualquier proceso que involucre venta + pago + lotes + puntos.

---

## 1. Visión General del Flujo

```
Cliente                 Backend (FastAPI)              PostgreSQL (Triggers)
  │                           │                               │
  ├─POST /checkout────────────▶│                               │
  │  { carrito, cupon, pago } │                               │
  │                           │── Validar items y stock ──────▶│
  │                           │── Validar cupón (si aplica) ──▶│
  │                           │── INSERT ventas ───────────────▶│ ←tg_ventas_historial
  │                           │── INSERT metodos_pago ──────────▶│
  │                           │── INSERT detalles_venta ─────────▶│ ←tg_detalles_venta_asignar_lotes
  │                           │   (por cada item del carrito)   │  (FEFO + stock + kardex)
  │                           │── UPDATE ventas.estado_pago ─────▶│ ←tg_ventas_otorgar_puntos
  │                           │   = 'PAGADO'                     │  (SweetCoins + cupón USADO)
  │                           │── [Celery] generar PDF ───────────▶│
  │◀──200 OK, venta_id────────│                               │
```

---

## 2. Tablas Involucradas

| Tabla | Rol en el Flujo |
|---|---|
| `ventas` | Cabecera del pedido. Estado y totales. |
| `detalles_venta` | Una fila por producto. **Inmutable** tras insert. |
| `detalle_venta_lotes` | Traza física: qué lote → qué detalle. Gestionado por trigger. |
| `metodos_pago` | Registro del pago. Puede haber varios por venta. |
| `lotes` | Reducido automáticamente por trigger FEFO. |
| `productos` | `stock_actual` cache actualizado por trigger. |
| `movimientos_stock` | Kardex. Insertado automáticamente por trigger. |
| `cupones_cliente` | Estado cambia a `'USADO'` por trigger. |
| `movimientos_puntos` | Acumulación de SweetCoins. Insertado por trigger. |
| `documentos` | Boleta/Factura. Creado por tarea Celery. |
| `historial_estados_venta` | Auditoría de estados. Gestionado por trigger. |

---

## 3. Pasos de Implementación en el Service

### Paso 1: Validaciones Pre-Transaccionales
```python
async def checkout(self, request: CheckoutRequest, cliente_id: int) -> VentaResponse:
    # 1a. Verificar que todos los productos existen y están activos
    for item in request.items:
        product = await self._product_repo.get_by_id(item.id_producto)
        if not product or not product.estado:
            raise NotFoundError(f"Producto {item.id_producto} no disponible")
        if product.stock_actual < item.cantidad:
            raise InsufficientStockError(...)

    # 1b. Validar cupón (si aplica)
    cupon = None
    if request.id_cupon_cliente:
        cupon = await self._cupon_repo.get_by_id(request.id_cupon_cliente)
        if cupon.id_cliente != cliente_id:
            raise ForbiddenError("Cupón no pertenece al cliente")
        if cupon.estado != "DISPONIBLE":
            raise BusinessRuleError("Cupón no disponible")
        # La fecha_expiracion es validada por el trigger tg_cupones_cliente_normalizar
```

### Paso 2: Calcular Totales
```python
    subtotal = sum(item.precio_unitario * item.cantidad for item in request.items)
    descuento = Decimal("0")
    if cupon:
        descuento = (subtotal * cupon.cupon_maestro.porcentaje_descuento / 100).quantize(Decimal("0.01"))
    total = subtotal + request.costo_envio - descuento
```

### Paso 3: Crear la Venta (Transacción DB)
```python
    async with self._session.begin():
        # 3a. INSERT ventas → tg_ventas_historial se dispara automáticamente
        venta = await self._order_repo.create({
            "id_cliente": cliente_id,
            "id_cupon_cliente": request.id_cupon_cliente,
            "origen_venta": "WEB",
            "estado": "PENDIENTE",
            "estado_pago": "PENDIENTE",
            "subtotal_productos": subtotal,
            "costo_envio": request.costo_envio,
            "monto_descuento_cupon": descuento,
            "total": total,
        })

        # 3b. INSERT metodos_pago
        await self._pago_repo.create({
            "id_venta": venta.id_venta,
            "tipo_pago": request.tipo_pago,
            "monto": total,
            "codigo_transaccion": request.codigo_transaccion,
            "estado_transaccion": "APROBADO",  # después de confirmar con pasarela
        })

        # 3c. INSERT detalles_venta (uno por item)
        # ⚠️ El trigger tg_detalles_venta_asignar_lotes se dispara aquí
        # Puede lanzar RAISE EXCEPTION si hay stock insuficiente
        try:
            for item in request.items:
                await self._detalle_repo.create({
                    "id_venta": venta.id_venta,
                    "id_producto": item.id_producto,
                    "cantidad": item.cantidad,
                    "precio_unitario": item.precio_unitario,
                    "subtotal": item.precio_unitario * item.cantidad,
                })
        except asyncpg.exceptions.RaiseException as e:
            raise InsufficientStockError(str(e))

        # 3d. Confirmar pago → tg_ventas_otorgar_puntos se dispara aquí
        # Asigna SweetCoins y marca cupón como USADO
        await self._order_repo.update(venta.id_venta, {
            "estado_pago": "PAGADO",
            "estado": "PAGADO",
        })
```

### Paso 4: Dispatch de Tareas Asíncronas
```python
    # Fuera de la transacción DB, después del commit
    generate_pdf_task.delay(venta_id=venta.id_venta)
    # Notificación por email/WhatsApp (futuro)
```

---

## 4. Anulación de Venta

### Flujo de Anulación
```python
async def anular_venta(self, venta_id: int, actor_id: int) -> VentaResponse:
    venta = await self._order_repo.get_by_id(venta_id)
    if venta is None:
        raise NotFoundError(...)
    if venta.estado == "ANULADO":
        raise BusinessRuleError("Venta ya está anulada")

    # Solo UPDATE estado = 'ANULADO'
    # El trigger tg_ventas_anular hace TODO lo demás:
    # - Revierte stock a lotes
    # - Libera cupón
    # - Contra-asienta SweetCoins con AJUSTE_ADMIN
    await self._order_repo.update(venta_id, {"estado": "ANULADO"})
```

**⚠️ NUNCA intentar revertir stock o puntos manualmente al anular. El trigger lo hace.**

---

## 5. Estados de la Venta y Transiciones Válidas

```
PENDIENTE ──pagado──▶ PAGADO ──entregado──▶ ENTREGADO
    │                    │
    └──anulado───────────┴──anulado──▶ ANULADO
```

| Transición | Quién la ejecuta |
|---|---|
| `PENDIENTE` → `PAGADO` | Service: `UPDATE ventas.estado_pago = 'PAGADO'` |
| `PAGADO` → `ENTREGADO` | Router de CAJERO/ADMIN |
| Cualquier → `ANULADO` | Solo por ADMIN/CAJERO |

---

## 6. Esquemas Pydantic de Referencia

### Request
```python
class CheckoutItemRequest(BaseModel):
    id_producto: int
    cantidad: int = Field(gt=0)
    precio_unitario: Decimal = Field(ge=0)

class CheckoutRequest(BaseModel):
    items: list[CheckoutItemRequest] = Field(min_length=1)
    id_cupon_cliente: int | None = None
    costo_envio: Decimal = Field(ge=0, default=Decimal("0"))
    tipo_pago: TipoPagoEnum
    codigo_transaccion: str | None = None
```

### Response
```python
class VentaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_venta: int
    estado: EstadoVentaEnum
    estado_pago: EstadoPagoEnum
    total: Decimal
    puntos_ganados: int
    fecha_venta: datetime
```

---

## 7. ENUMs Relevantes (ver Skill 01)

| Python Enum | Valores |
|---|---|
| `EstadoVentaEnum` | `PENDIENTE`, `PAGADO`, `ENTREGADO`, `ANULADO` |
| `EstadoPagoEnum` | `PENDIENTE`, `PAGADO` |
| `TipoPagoEnum` | `EFECTIVO`, `YAPE`, `TRANSFERENCIA` |
| `EstadoTransaccionEnum` | `PENDIENTE`, `APROBADO`, `RECHAZADO`, `ANULADO` |
| `TipoDocumentoVentaEnum` | `BOLETA`, `FACTURA`, `REPORTE` |

---

## 8. Consideraciones de Concurrencia

- Los triggers usan `SELECT ... FOR UPDATE` internamente sobre `lotes` y `productos`.
- No es necesario hacer lock explícito desde el backend.
- Si dos checkouts simultáneos compiten por el mismo stock, uno fallará con `RAISE EXCEPTION` → traducir a `InsufficientStockError`.
- La transacción de checkout debe ser una sola `async with session.begin()` para garantizar rollback completo en caso de error.
