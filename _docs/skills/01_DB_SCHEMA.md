# SKILL 01 — Modelo de Base de Datos PostgreSQL

> **CUÁNDO USAR:** Antes de crear modelos SQLAlchemy, consultar vistas, o interactuar con lógica de triggers.

---

## 1. Stack de Persistencia

- **Motor:** PostgreSQL (hosted en NeonDB)
- **Driver async:** `asyncpg`
- **ORM:** SQLAlchemy 2.0 async (`AsyncSession`, `select()`, `AsyncAttrs`)
- **Script físico completo:** `_modelBD/Query1.sql`

---

## 2. ENUMs de PostgreSQL

Todos estos tipos deben mapearse en Python como `enum.StrEnum` o `enum.Enum` y declararse en SQLAlchemy con `postgresql.ENUM(name=..., create_type=False)`.

| Enum PostgreSQL | Valores |
|---|---|
| `tipo_rol_enum` | `ADMIN`, `CLIENTE` |
| `tipo_documento_fiscal_enum` | `DNI`, `RUC` |
| `estado_lote_enum` | `VIGENTE`, `AGOTADO`, `VENCIDO` |
| `tipo_movimiento_stock_enum` | `INGRESO_COMPRA`, `VENTA`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `MERMA`, `VENCIMIENTO`, `DEVOLUCION` |
| `estado_cupon_enum` | `DISPONIBLE`, `USADO`, `EXPIRADO` |
| `origen_cupon_enum` | `COMPRA_PUNTOS`, `REGALO_ADMIN`, `PREMIO_JUEGO`, `REGISTRO_NUEVO` |
| `origen_venta_enum` | `WEB` |
| `estado_venta_enum` | `PENDIENTE`, `PAGADO`, `ENTREGADO`, `ANULADO` |
| `estado_pago_enum` | `PENDIENTE`, `PAGADO` |
| `tipo_pago_enum` | `EFECTIVO`, `YAPE`, `TRANSFERENCIA` |
| `estado_transaccion_enum` | `PENDIENTE`, `APROBADO`, `RECHAZADO`, `ANULADO` |
| `tipo_documento_venta_enum` | `BOLETA`, `FACTURA`, `REPORTE` |
| `tipo_movimiento_puntos_enum` | `ACUMULACION_VENTA`, `COMPRA_CUPON`, `PAGO_JUEGO`, `PREMIO_JUEGO`, `EXPIRACION`, `AJUSTE_ADMIN` |

---

## 3. Mapa de Tablas y Entidades

### 3.1 Usuarios e Identidad
| Tabla | Descripción clave |
|---|---|
| `roles` | Catálogo de roles. FK desde `usuarios.id_rol`. |
| `usuarios` | Entidad central. `estado BOOLEAN` = activo/inactivo. `password_hash`. |
| `clientes` | Extensión 1-a-1 de `usuarios` para clientes (dirección, referencia). |
| `datos_fiscales` | Puede haber varios por usuario. `es_predeterminado` tiene índice único parcial (`WHERE es_predeterminado = true`). |

### 3.2 Catálogo e Inventario
| Tabla | Descripción clave |
|---|---|
| `categorias` | Catálogo simple. FK en `productos` y `cupones_maestro`. |
| `productos` | `stock_actual` es un **cache operativo**; el Kardex real está en `movimientos_stock`. |
| `lotes` | Unidad de inventario físico. `cantidad_disponible` se reduce por ventas/vencimiento. `estado_lote_enum`. |
| `movimientos_stock` | Kardex completo. `tipo_movimiento_stock_enum`. Generado mayoritariamente por triggers. |

### 3.3 Cupones
| Tabla | Descripción clave |
|---|---|
| `cupones_maestro` | Plantilla de cupón. `costo_puntos` para canje. `porcentaje_descuento`. |
| `cupones_cliente` | Instancia única por cliente. `codigo_unico VARCHAR(20)`. Estado gestionado por trigger. |

### 3.4 Ventas
| Tabla | Descripción clave |
|---|---|
| `ventas` | Cabecera. `id_cupon_cliente UNIQUE` (un cupón por venta). `puntos_ganados`. |
| `historial_estados_venta` | Auditoría de cambios de estado. Gestionada por trigger. |
| `detalles_venta` | Líneas de producto. **INMUTABLE** tras inserción (bloqueado por trigger). |
| `detalle_venta_lotes` | Traza qué lote físico satisface cada línea. **INMUTABLE** tras inserción. |
| `metodos_pago` | Permite pagos mixtos (EFECTIVO + YAPE). `estado_transaccion_enum`. |
| `documentos` | Boleta/Factura. `numero_serie`, `numero_correlativo`. `url_archivo` al PDF. |
| `logs_sistema` | Log de auditoría de acciones de usuario. |

### 3.5 Recompensas (CriptoTrufas)
| Tabla | Descripción clave |
|---|---|
| `configuracion_recompensas` | Solo una activa (`estado = true`). `tasa_conversion` define puntos por S/. |
| `movimientos_puntos` | Ledger append-only de puntos. `cantidad` puede ser negativo. `saldo_puntos_resultante` es recalculado por trigger. |

---

## 4. Vistas Disponibles

### `vw_saldo_puntos_cliente`
```sql
SELECT c.id_cliente, COALESCE(SUM(mp.cantidad), 0) AS puntos_actuales
FROM clientes c
LEFT JOIN movimientos_puntos mp ON mp.id_cliente = c.id_cliente
GROUP BY c.id_cliente;
```
**Uso en backend:** `SELECT * FROM vw_saldo_puntos_cliente WHERE id_cliente = :id`

### `vw_stock_producto`
```sql
-- Concilia stock_actual (cache) vs stock_calculado_kardex (suma real de movimientos_stock)
```
**Uso:** Dashboard de administrador para detectar descuadres de inventario.

---

## 5. Triggers y Funciones PL/pgSQL — Contratos de Comportamiento

> **REGLA CRÍTICA:** El backend **NO duplica** la lógica de estos triggers. Solo ejecuta la operación DML que los dispara y maneja las excepciones resultantes.

### Trigger: `tg_lotes_post_insert` (AFTER INSERT ON lotes)
- **Qué hace:** Al insertar un lote, actualiza `productos.stock_actual` y registra en `movimientos_stock` con tipo `INGRESO_COMPRA`.
- **Backend:** Solo hace `INSERT INTO lotes (...)`. El trigger hace el resto.

### Trigger: `tg_detalles_venta_asignar_lotes` (AFTER INSERT ON detalles_venta)
- **Qué hace:** Implementa FEFO. Asigna el stock de lotes vigentes ordenados por `fecha_vencimiento NULLS LAST`. Inserta en `detalle_venta_lotes` y `movimientos_stock`. Actualiza `lotes.cantidad_disponible` y `productos.stock_actual`.
- **Backend:** Solo hace `INSERT INTO detalles_venta (...)`. Si el stock es insuficiente, el trigger lanza `RAISE EXCEPTION` que llega al backend como `asyncpg.exceptions.RaiseException`.
- **Excepción a capturar:** `asyncpg.exceptions.RaiseException` → traducir a `InsufficientStockError`.

### Trigger: `tg_ventas_historial` (AFTER INSERT OR UPDATE OF estado ON ventas)
- **Qué hace:** Registra automáticamente en `historial_estados_venta` cada cambio de estado.
- **Backend:** Solo actualiza `ventas.estado`. El historial es automático.

### Trigger: `tg_ventas_otorgar_puntos` (AFTER UPDATE OF estado_pago ON ventas)
- **Qué hace:** Cuando `estado_pago` cambia a `'PAGADO'`, calcula los puntos (`FLOOR(total * tasa_conversion)`), inserta en `movimientos_puntos` con tipo `ACUMULACION_VENTA`, actualiza `ventas.puntos_ganados` y marca el cupón usado.
- **Backend:** Solo actualiza `ventas.estado_pago = 'PAGADO'`.

### Trigger: `tg_ventas_anular` (AFTER UPDATE OF estado ON ventas)
- **Qué hace:** Cuando `estado` cambia a `'ANULADO'`, revierte stock a lotes de origen, libera el cupón, contra-asienta los puntos con `AJUSTE_ADMIN`.
- **Backend:** Solo actualiza `ventas.estado = 'ANULADO'`.

### Trigger: `tg_cupones_cliente_normalizar` (BEFORE INSERT OR UPDATE ON cupones_cliente)
- **Qué hace:** Normaliza el estado del cupón: si `fecha_uso IS NOT NULL` → `USADO`; si `fecha_expiracion <= NOW()` → `EXPIRADO`.

### Trigger: `tg_movimientos_puntos_validar` (BEFORE INSERT ON movimientos_puntos)
- **Qué hace:** Valida que el saldo no quede negativo y recalcula `saldo_puntos_resultante`.

### Triggers de Bloqueo (`detalles_venta`, `detalle_venta_lotes`)
- `BEFORE UPDATE` y `BEFORE DELETE` → Siempre lanzan excepción.
- **Implicación:** Para corregir una venta errónea, el único camino es anular la venta (`estado = 'ANULADO'`).

### Stored Procedures (invocar desde Celery)
| Función | Qué hace |
|---|---|
| `sp_expirar_cupones_vencidos()` | Marca como `EXPIRADO` los cupones vencidos. Retorna cantidad afectada. |
| `sp_expirar_lotes_vencidos()` | Expira lotes, resta stock, inserta `VENCIMIENTO` en Kardex. Retorna cantidad afectada. |

---

## 6. Índices y Restricciones Clave

### Índices de búsqueda frecuente
- `lotes(fecha_vencimiento)` — consultas FEFO
- `lotes(estado_lote)` — filtrar vigentes
- `cupones_cliente(fecha_expiracion)`, `cupones_cliente(estado)` — validación de cupones
- `ventas(estado)`, `ventas(estado_pago)` — consultas operativas
- `movimientos_stock(tipo_movimiento)` — Kardex por tipo

### Restricciones únicas especiales
```sql
-- Solo un dato fiscal predeterminado por usuario
CREATE UNIQUE INDEX uq_datos_fiscales_predeterminado
ON datos_fiscales (id_usuario) WHERE es_predeterminado = true;

-- Correlativo de documento único por tipo+serie
CREATE UNIQUE INDEX uq_documento_serie_correlativo
ON documentos (tipo_documento, numero_serie, numero_correlativo);
```

---

## 7. Reglas de Integridad Referencial

| Relación | ON DELETE |
|---|---|
| `usuarios.id_rol` → `roles` | RESTRICT |
| `clientes.id_usuario` → `usuarios` | CASCADE |
| `datos_fiscales.id_usuario` → `usuarios` | CASCADE |
| `lotes.id_producto` → `productos` | RESTRICT |
| `movimientos_stock.id_usuario` → `usuarios` | SET NULL |
| `detalles_venta.id_venta` → `ventas` | CASCADE |
| `detalle_venta_lotes.id_detalle` → `detalles_venta` | CASCADE |
| `movimientos_puntos.id_cliente` → `clientes` | CASCADE |

---

## 8. Comentarios Importantes (del script)

```sql
-- productos.stock_actual: 'Cache operativa; el kardex real está en movimientos_stock'
-- movimientos_puntos.cantidad: 'Puede ser positivo o negativo según el movimiento'
-- movimientos_puntos.saldo_puntos_resultante: 'Saldo total del cliente luego del movimiento'
```
