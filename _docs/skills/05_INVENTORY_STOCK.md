# SKILL 05 — Inventario y Gestión de Lotes (FEFO + Kardex)

> **CUÁNDO USAR:** Antes de implementar el módulo `inventory`, ingreso de lotes, consulta de Kardex, o expiración de stock.

---

## 1. Modelo de Inventario

### Dos niveles de stock
| Campo | Tabla | Descripción |
|---|---|---|
| `productos.stock_actual` | Cache operativo | Actualizado por triggers automáticamente. **NO modificar directamente.** |
| `movimientos_stock` | Kardex real | Fuente de verdad. Cada transacción tiene su entrada. |

### Tablas involucradas
- `productos` — catálogo con stock cache
- `lotes` — unidades físicas de inventario
- `movimientos_stock` — Kardex completo (append-only)
- `vw_stock_producto` — vista de conciliación cache vs Kardex

---

## 2. Ciclo de Vida de un Lote

```
INSERT INTO lotes                   ← Almacén registra entrada
    ↓
tg_lotes_validar_insert (BEFORE)    ← Valida que no esté ya vencido
    ↓                                  Setea cantidad_disponible = cantidad_inicial
                                        Setea estado_lote = 'VIGENTE'
tg_lotes_post_insert (AFTER)        ← Suma stock_actual en productos
    ↓                                  Inserta INGRESO_COMPRA en movimientos_stock
    Estado: VIGENTE
    ↓
INSERT detalles_venta               ← Trigger FEFO reduce cantidad_disponible
    ↓
    cantidad_disponible = 0 → Estado: AGOTADO
    fecha_vencimiento <= NOW() → Estado: VENCIDO (por sp_expirar_lotes_vencidos)
```

---

## 3. Estados de Lote (`estado_lote_enum`)

| Estado | Condición | Puede venderse |
|---|---|---|
| `VIGENTE` | `cantidad_disponible > 0` y no vencido | ✅ Sí |
| `AGOTADO` | `cantidad_disponible = 0` | ❌ No |
| `VENCIDO` | `fecha_vencimiento <= NOW()` | ❌ No |

**Filtro para FEFO en el trigger:**
```sql
WHERE estado_lote = 'VIGENTE'
  AND cantidad_disponible > 0
  AND (fecha_vencimiento IS NULL OR fecha_vencimiento > CURRENT_TIMESTAMP)
ORDER BY fecha_vencimiento NULLS LAST, fecha_ingreso, id_lote
```

---

## 4. Tipos de Movimiento de Stock (`tipo_movimiento_stock_enum`)

| Tipo | Efecto en stock | Generado por |
|---|---|---|
| `INGRESO_COMPRA` | `+cantidad` | `tg_lotes_post_insert` (auto) |
| `VENTA` | `-cantidad` | `tg_detalles_venta_asignar_lotes` (auto) |
| `DEVOLUCION` | `+cantidad` | `tg_ventas_anular` (auto) |
| `VENCIMIENTO` | `-cantidad` | `sp_expirar_lotes_vencidos()` (Celery) |
| `AJUSTE_POSITIVO` | `+cantidad` | Servicio de inventario (manual) |
| `AJUSTE_NEGATIVO` | `-cantidad` | Servicio de inventario (manual) |
| `MERMA` | `-cantidad` | Servicio de inventario (manual) |

---

## 5. Implementación del Servicio de Inventario

### Ingresar un Lote (única acción que el backend ejecuta directamente)
```python
async def registrar_lote(
    self, request: LoteCreateRequest, actor_id: int
) -> LoteResponse:
    # Verificar que el producto existe y está activo
    producto = await self._product_repo.get_by_id(request.id_producto)
    if not producto or not producto.estado:
        raise NotFoundError(f"Producto {request.id_producto} no encontrado")

    # Validar fecha de vencimiento (el trigger también lo hace, pero validar antes)
    if request.fecha_vencimiento and request.fecha_vencimiento <= datetime.now(UTC):
        raise ValidationError("La fecha de vencimiento debe ser futura")

    # Solo INSERT: el trigger tg_lotes_validar_insert + tg_lotes_post_insert hacen el resto
    lote = await self._lote_repo.create({
        "id_producto": request.id_producto,
        "fecha_vencimiento": request.fecha_vencimiento,
        "cantidad_inicial": request.cantidad_inicial,
        # cantidad_disponible y estado_lote los setea el trigger BEFORE INSERT
    })
    return LoteResponse.model_validate(lote)
```

### Ajuste Manual de Stock
```python
async def ajustar_stock(self, request: AjusteStockRequest, actor_id: int) -> MovimientoResponse:
    """
    Para ajustes manuales (mermas, ajustes positivos/negativos).
    NO usar para ventas ni ingresos de lotes.
    El backend actualiza stock_actual y crea el movimiento manualmente aquí
    porque NO hay trigger para ajustes manuales.
    """
    producto = await self._product_repo.get_by_id(request.id_producto)
    if not producto:
        raise NotFoundError(...)

    tipo = request.tipo_movimiento  # AJUSTE_POSITIVO | AJUSTE_NEGATIVO | MERMA
    delta = request.cantidad if tipo == "AJUSTE_POSITIVO" else -request.cantidad
    nuevo_stock = producto.stock_actual + delta

    if nuevo_stock < 0:
        raise InsufficientStockError("El ajuste dejaría el stock negativo")

    async with self._session.begin():
        await self._product_repo.update(request.id_producto, {"stock_actual": nuevo_stock})
        movimiento = await self._movimiento_repo.create({
            "id_producto": request.id_producto,
            "id_lote": request.id_lote,  # Opcional
            "id_usuario": actor_id,
            "tipo_movimiento": tipo,
            "cantidad": request.cantidad,
            "stock_resultante": nuevo_stock,
            "observacion": request.observacion,
        })
    return MovimientoResponse.model_validate(movimiento)
```

---

## 6. Consulta del Kardex

### Endpoint: `GET /api/v1/inventory/kardex/{producto_id}`
```python
async def get_kardex(
    self, producto_id: int, pagination: PaginationParams
) -> PaginatedResponse[MovimientoResponse]:
    # Consultar movimientos_stock ordenados por fecha DESC
    # Incluir joins con lotes y ventas para contexto
    movimientos = await self._movimiento_repo.get_by_producto(
        producto_id, pagination
    )
    return PaginatedResponse[MovimientoResponse].from_list(movimientos, pagination)
```

### Consulta SQL de referencia para el repository:
```python
stmt = (
    select(MovimientoStockModel)
    .where(MovimientoStockModel.id_producto == producto_id)
    .order_by(MovimientoStockModel.fecha_movimiento.desc())
    .offset(pagination.offset)
    .limit(pagination.page_size)
)
```

---

## 7. Consulta de Vistas

### `vw_stock_producto` — Conciliación de inventario
```python
# Usando text() de SQLAlchemy para consultar la vista
result = await session.execute(
    text("SELECT * FROM vw_stock_producto WHERE id_producto = :id"),
    {"id": producto_id}
)
row = result.mappings().first()
# row["stock_actual"]           → cache en productos
# row["stock_calculado_kardex"] → suma real del Kardex
# Si difieren → hay descuadre contable
```

---

## 8. Expiración de Lotes (Tarea Celery)

```python
# app/infrastructure/workers/tasks/reports.py (o inventory.py)
@celery_app.task(name="inventory.expire_lots")
async def expire_lots_task():
    """Ejecutar sp_expirar_lotes_vencidos() — llamar desde beat schedule."""
    async with get_async_session() as session:
        result = await session.execute(text("SELECT sp_expirar_lotes_vencidos()"))
        count = result.scalar()
        logger.info("inventory.lots_expired", count=count)
    return count

# Beat schedule en celery_app.py:
# "expire-lots": {"task": "inventory.expire_lots", "schedule": crontab(hour=2, minute=0)}
```

---

## 9. Schemas Pydantic de Referencia

```python
class LoteCreateRequest(BaseModel):
    id_producto: int
    fecha_vencimiento: datetime | None = None
    cantidad_inicial: int = Field(gt=0)

class LoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_lote: int
    id_producto: int
    fecha_ingreso: datetime
    fecha_vencimiento: datetime | None
    cantidad_inicial: int
    cantidad_disponible: int
    estado_lote: EstadoLoteEnum

class MovimientoStockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_movimiento_stock: int
    id_producto: int
    id_lote: int | None
    id_venta: int | None
    tipo_movimiento: TipoMovimientoStockEnum
    cantidad: int
    stock_resultante: int
    costo_unitario: Decimal | None
    fecha_movimiento: datetime
    observacion: str | None
```

---

## 10. Índices Relevantes para Queries de Inventario

```sql
CREATE INDEX ON lotes (id_producto);
CREATE INDEX ON lotes (fecha_vencimiento);   -- Crítico para FEFO
CREATE INDEX ON lotes (estado_lote);
CREATE INDEX ON movimientos_stock (id_producto);
CREATE INDEX ON movimientos_stock (id_lote);
CREATE INDEX ON movimientos_stock (tipo_movimiento);
```

Estos índices garantizan que el Kardex y las consultas FEFO sean eficientes incluso con miles de movimientos.
