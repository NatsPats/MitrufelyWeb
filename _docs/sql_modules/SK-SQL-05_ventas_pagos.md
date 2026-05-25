# SKILL: M05 — Ventas y Pagos (Mytrufely)

> **ID**: `SK-SQL-05`  
> **Módulo SQL**: `M05_ventas_pagos.sql`  
> **Skill Secundario de Apoyo**: [`SK-SQL-00_convenciones.md`](./SK-SQL-00_convenciones.md)  
> **Depende de**: `SK-SQL-01`, `SK-SQL-02`, `SK-SQL-03`, `SK-SQL-04`  
> **Es dependencia de**: `SK-SQL-06` (SweetCoins referencian `ventas`)

---

## Propósito

Cubre el **ciclo de vida completo de una venta** en Mytrufely:
- Cabecera de venta con estado y pago.
- Líneas de detalle (qué productos y cuántos).
- Asignación automática de lotes físicos por FEFO (First Expired First Out).
- Registro de métodos de pago y documentos fiscales (boleta/factura).
- Historial inmutable de cambios de estado.
- Bloqueo de edición/eliminación de detalles (integridad contable).

---

## Tablas

### `ventas`
| Columna                  | Tipo               | Descripción                         |
|--------------------------|--------------------|-------------------------------------|
| `id_venta`               | `serial`           | PK                                  |
| `id_cliente`             | `int`              | FK → `clientes` RESTRICT            |
| `id_cupon_cliente`       | `int` UNIQUE       | FK → `cupones_cliente` (opcional)   |
| `origen_venta`           | `origen_venta_enum`| Canal (`WEB`)                       |
| `estado`                 | `estado_venta_enum`| `PENDIENTE` → `PAGADO` → `ENTREGADO` / `ANULADO` |
| `estado_pago`            | `estado_pago_enum` | `PENDIENTE` → `PAGADO`              |
| `subtotal_productos`     | `numeric(10,2)`    | Suma de líneas sin descuentos       |
| `costo_envio`            | `numeric(10,2)`    | DEFAULT 0                           |
| `monto_descuento_cupon`  | `numeric(10,2)`    | Descuento aplicado por cupón        |
| `total`                  | `numeric(10,2)`    | `subtotal + envio - descuento`      |
| `puntos_ganados`         | `int`              | Llenado automáticamente al pagar    |
| `fecha_venta`            | `timestamp`        | DEFAULT NOW()                       |

**Máquina de estados de `estado`**:
```
PENDIENTE ──► PAGADO ──► ENTREGADO
    └──────────────────► ANULADO
```

---

### `historial_estados_venta`
Registro inmutable de cada cambio de `estado` en la venta.
- Generado automáticamente por trigger `tg_ventas_historial`.
- Incluye `id_usuario` del operador (nullable si es automático).

---

### `detalles_venta`
| Columna          | Tipo           | Descripción                      |
|------------------|----------------|----------------------------------|
| `id_detalle`     | `serial`       | PK                               |
| `id_venta`       | `int`          | FK → `ventas` CASCADE            |
| `id_producto`    | `int`          | FK → `productos` RESTRICT        |
| `cantidad`       | `int`          | CHECK > 0                        |
| `precio_unitario`| `numeric(10,2)`| Precio al momento de la venta    |
| `subtotal`       | `numeric(10,2)`| `cantidad * precio_unitario`     |

> ⚠️ Protegido por triggers de bloqueo: **no se puede UPDATE ni DELETE**. Para revertir → anular la venta.

---

### `detalle_venta_lotes`
Traza qué lotes físicos se consumieron por cada línea de venta (FEFO).
| Columna           | Tipo  | Descripción                         |
|-------------------|-------|-------------------------------------|
| `id_detalle_lote` | `serial` | PK                               |
| `id_detalle`      | `int`    | FK → `detalles_venta` CASCADE    |
| `id_lote`         | `int`    | FK → `lotes` RESTRICT            |
| `cantidad`        | `int`    | Unidades consumidas del lote     |

---

### `metodos_pago`
| Columna               | Tipo                    | Descripción                  |
|-----------------------|-------------------------|------------------------------|
| `id_pago`             | `serial`                | PK                           |
| `id_venta`            | `int`                   | FK → `ventas` CASCADE        |
| `tipo_pago`           | `tipo_pago_enum`        | EFECTIVO / YAPE / TRANSFERENCIA |
| `monto`               | `numeric(10,2)`         | CHECK > 0                    |
| `codigo_transaccion`  | `varchar(100)`          | nullable (ref de pasarela)   |
| `proveedor`           | `varchar(50)`           | nullable                     |
| `estado_transaccion`  | `estado_transaccion_enum`| DEFAULT 'PENDIENTE'         |
| `fecha_pago`          | `timestamp`             | DEFAULT NOW()                |

---

### `documentos`
Boletas, facturas o reportes generados para cada venta.
- Restricción única: no puede haber dos documentos con igual `(tipo, serie, correlativo)`.

---

## Triggers Clave

### `tg_detalles_venta_asignar_lotes` (AFTER INSERT en `detalles_venta`)
Implementa **FEFO** automáticamente:
1. Verifica que la venta existe y no está ANULADA.
2. Verifica stock disponible en lotes VIGENTE sumado.
3. Itera lotes ordenados por `fecha_vencimiento ASC NULLS LAST`.
4. Descuenta `cantidad_disponible` del lote, actualiza `estado_lote` si se agota.
5. Inserta fila en `detalle_venta_lotes`.
6. Registra movimiento `VENTA` en Kardex.
7. Actualiza `productos.stock_actual`.

### `tg_ventas_historial` (AFTER INSERT OR UPDATE OF estado)
Inserta automáticamente en `historial_estados_venta` cada vez que cambia el estado.

### `tg_detalles_venta_bloquear_*` / `tg_detalle_venta_lotes_bloquear_*`
Bloquean UPDATE y DELETE en tablas de detalle. Solo se puede revertir anulando la venta.

---

## Restricción Única

```sql
CREATE UNIQUE INDEX uq_documento_serie_correlativo
  ON documentos (tipo_documento, numero_serie, numero_correlativo);
```

---

## Cómo Usar Este Skill con la IA

```
"Implementa el endpoint de checkout / creación de venta. Contexto:
@_docs/sql_modules/SK-SQL-00_convenciones.md
@_docs/sql_modules/SK-SQL-05_ventas_pagos.md
@_docs/sql_modules/SK-SQL-03_catalogo_inventario.md
@_docs/skills/04_CHECKOUT_FLOW.md"
```
