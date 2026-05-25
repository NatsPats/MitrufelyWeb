# SKILL: M03 — Catálogo de Productos e Inventario (Mytrufely)

> **ID**: `SK-SQL-03`  
> **Módulo SQL**: `M03_catalogo_inventario.sql`  
> **Skill Secundario de Apoyo**: [`SK-SQL-00_convenciones.md`](./SK-SQL-00_convenciones.md)  
> **Depende de**: `SK-SQL-01` (ENUMs), `SK-SQL-02` (usuarios)  
> **Es dependencia de**: `SK-SQL-04`, `SK-SQL-05`, `SK-SQL-06`

---

## Propósito

Gestiona el **catálogo de productos** y el **inventario físico** de Mytrufely. El inventario usa un modelo de **lotes múltiples con Kardex**: cada producto tiene N lotes físicos y un Kardex de movimientos que permite auditar todo cambio de stock.

---

## Tablas

### `categorias`
| Columna        | Tipo           | Restricciones |
|----------------|----------------|---------------|
| `id_categoria` | `serial`       | PK            |
| `nombre`       | `varchar(100)` | NOT NULL      |
| `descripcion`  | `text`         | nullable      |

---

### `productos`
| Columna        | Tipo           | Restricciones                |
|----------------|----------------|------------------------------|
| `id_producto`  | `serial`       | PK                           |
| `id_categoria` | `int`          | FK → `categorias` RESTRICT   |
| `nombre`       | `varchar(150)` | NOT NULL                     |
| `descripcion`  | `text`         | nullable                     |
| `precio`       | `numeric(10,2)`| NOT NULL, CHECK >= 0         |
| `stock_actual` | `int`          | DEFAULT 0, CHECK >= 0        |
| `stock_minimo` | `int`          | DEFAULT 0, CHECK >= 0        |
| `imagen_url`   | `varchar(255)` | nullable                     |
| `estado`       | `boolean`      | DEFAULT true                 |

> ⚠️ `stock_actual` es un **cache operativo**. El stock real se reconstruye sumando `movimientos_stock`. Ambos deben ser coherentes (el trigger `tg_lotes_post_insert` los sincroniza).

---

### `lotes`
| Columna              | Tipo               | Restricciones                  |
|----------------------|--------------------|--------------------------------|
| `id_lote`            | `serial`           | PK                             |
| `id_producto`        | `int`              | FK → `productos` RESTRICT      |
| `fecha_ingreso`      | `timestamp`        | DEFAULT NOW()                  |
| `fecha_vencimiento`  | `timestamp`        | nullable (sin fecha = no vence)|
| `cantidad_inicial`   | `int`              | CHECK > 0                      |
| `cantidad_disponible`| `int`              | DEFAULT 0, CHECK >= 0          |
| `estado_lote`        | `estado_lote_enum` | DEFAULT 'VIGENTE'              |

**Ciclo de vida de un lote**:
```
INSERT → VIGENTE → AGOTADO (cuando cantidad_disponible = 0 por ventas)
                → VENCIDO  (cuando fecha_vencimiento <= NOW, via sp_expirar_lotes_vencidos)
```

---

### `movimientos_stock` (Kardex)
| Columna              | Tipo                        | Descripción                    |
|----------------------|-----------------------------|--------------------------------|
| `id_movimiento_stock`| `serial`                    | PK                             |
| `id_producto`        | `int`                       | FK → `productos`               |
| `id_lote`            | `int`                       | FK → `lotes` (nullable)        |
| `id_venta`           | `int`                       | FK → `ventas` (nullable, M05)  |
| `id_usuario`         | `int`                       | FK → `usuarios` (nullable)     |
| `tipo_movimiento`    | `tipo_movimiento_stock_enum`| Clasificación del movimiento   |
| `cantidad`           | `int`                       | CHECK > 0 (siempre positivo)   |
| `stock_resultante`   | `int`                       | Stock tras el movimiento       |
| `costo_unitario`     | `numeric(10,2)`             | nullable                       |
| `fecha_movimiento`   | `timestamp`                 | DEFAULT NOW()                  |
| `observacion`        | `text`                      | nullable                       |

---

## Triggers y Procedimientos

### `tg_lotes_validar_insert` (BEFORE INSERT en `lotes`)
- Rechaza lotes con `fecha_vencimiento` ya pasada.
- Normaliza: `cantidad_disponible = cantidad_inicial`, `estado_lote = 'VIGENTE'`.

### `tg_lotes_post_insert` (AFTER INSERT en `lotes`)
- Suma `cantidad_inicial` a `productos.stock_actual`.
- Registra movimiento `INGRESO_COMPRA` en el Kardex.

### `sp_expirar_lotes_vencidos()` → `int`
- Itera lotes VIGENTE con `fecha_vencimiento <= NOW`.
- Descuenta stock del producto, marca lote como VENCIDO, registra `VENCIMIENTO` en Kardex.
- Retorna el número de lotes procesados.
- **Llamar diariamente** (cron / pg_cron).

---

## Vista

### `vw_stock_producto`
```sql
-- Compara stock en cache vs stock calculado desde el Kardex
SELECT id_producto, nombre, stock_actual, stock_calculado_kardex
FROM vw_stock_producto;
```
Útil para auditorías y detección de inconsistencias.

---

## Cómo Usar Este Skill con la IA

```
"Implementa el ingreso de un nuevo lote de producto. Contexto:
@_docs/sql_modules/SK-SQL-00_convenciones.md
@_docs/sql_modules/SK-SQL-03_catalogo_inventario.md
@_docs/skills/05_INVENTORY_STOCK.md"
```
