# SKILL: M04 — Cupones (Mytrufely)

> **ID**: `SK-SQL-04`  
> **Módulo SQL**: `M04_cupones.sql`  
> **Skill Secundario de Apoyo**: [`SK-SQL-00_convenciones.md`](./SK-SQL-00_convenciones.md)  
> **Depende de**: `SK-SQL-01`, `SK-SQL-02`, `SK-SQL-03`  
> **Es dependencia de**: `SK-SQL-05` (ventas usa `id_cupon_cliente`), `SK-SQL-06` (puntos por canje)

---

## Propósito

Define el **sistema de cupones de descuento** de Mytrufely. Hay dos niveles:
1. **Cupones Maestro** — plantillas configuradas por el admin.
2. **Cupones Cliente** — instancias emitidas y asignadas individualmente, con código único y ciclo de vida propio.

---

## Tablas

### `cupones_maestro`
| Columna                | Tipo           | Restricciones                              |
|------------------------|----------------|--------------------------------------------|
| `id_cupon`             | `serial`       | PK                                         |
| `id_categoria`         | `int`          | FK → `categorias` RESTRICT (nullable)      |
| `nombre`               | `varchar(100)` | NOT NULL                                   |
| `descripcion`          | `text`         | nullable                                   |
| `porcentaje_descuento` | `numeric(5,2)` | NOT NULL, CHECK (> 0 AND <= 100)           |
| `costo_puntos`         | `int`          | nullable (si es canjeable con SweetCoins)  |
| `dias_vigencia`        | `int`          | NOT NULL, CHECK > 0                        |
| `estado`               | `boolean`      | DEFAULT true                               |

---

### `cupones_cliente`
| Columna            | Tipo               | Restricciones                       |
|--------------------|--------------------|-------------------------------------|
| `id_cupon_cliente` | `serial`           | PK                                  |
| `id_cliente`       | `int`              | FK → `clientes` CASCADE             |
| `id_cupon`         | `int`              | FK → `cupones_maestro` RESTRICT     |
| `codigo_unico`     | `varchar(20)`      | UNIQUE NOT NULL (generado en app)   |
| `estado`           | `estado_cupon_enum`| DEFAULT 'DISPONIBLE'                |
| `origen`           | `origen_cupon_enum`| NOT NULL                            |
| `fecha_adquisicion`| `timestamp`        | DEFAULT NOW()                       |
| `fecha_uso`        | `timestamp`        | nullable (se llena al usarlo)       |
| `fecha_expiracion` | `timestamp`        | NOT NULL                            |

**Cálculo de `fecha_expiracion`**:
```
fecha_expiracion = fecha_adquisicion + (cupones_maestro.dias_vigencia || ' days')::interval
```

---

## Ciclo de Vida de un Cupón Cliente

```
DISPONIBLE ──► USADO     (se aplica en una venta pagada)
           ──► EXPIRADO  (fecha_expiracion <= NOW, por trigger o sp)
```

---

## Trigger

### `tg_cupones_cliente_normalizar` (BEFORE INSERT OR UPDATE)
Mantiene coherencia entre `fecha_uso`, `fecha_expiracion` y `estado`:
- Si `fecha_uso IS NOT NULL` → `estado = 'USADO'`
- Si `fecha_expiracion <= NOW AND estado != 'USADO'` → `estado = 'EXPIRADO'`
- Si `estado = 'USADO' AND fecha_uso IS NULL` → `fecha_uso = NOW()`

---

## Procedimiento

### `sp_expirar_cupones_vencidos()` → `int`
- Marca como `EXPIRADO` todos los cupones `DISPONIBLE` cuya `fecha_expiracion <= NOW`.
- Retorna el número de cupones actualizados.
- **Llamar diariamente**.

---

## Reglas de Negocio

- El `codigo_unico` se genera en la capa de aplicación (UUID truncado o alfanumérico de 20 chars).
- Un cupón puede aplicarse a una venta solo si `estado = 'DISPONIBLE'` y `fecha_expiracion > NOW`.
- Al anular una venta se revierte el cupón a `DISPONIBLE` (lógica en `M06`, trigger `tg_ventas_anular`).
- Un cupón solo puede estar en **una** venta activa a la vez (FK UNIQUE en `ventas.id_cupon_cliente`).

---

## Cómo Usar Este Skill con la IA

```
"Implementa el flujo de canje de cupón con SweetCoins. Contexto:
@_docs/sql_modules/SK-SQL-00_convenciones.md
@_docs/sql_modules/SK-SQL-04_cupones.md
@_docs/sql_modules/SK-SQL-06_recompensas_sweetcoins.md
@_docs/skills/06_SWEETCOINS.md"
```
