# SKILL: M06 — Recompensas SweetCoins (Mytrufely)

> **ID**: `SK-SQL-06`  
> **Módulo SQL**: `M06_recompensas_sweetcoins.sql`  
> **Skill Secundario de Apoyo**: [`SK-SQL-00_convenciones.md`](./SK-SQL-00_convenciones.md)  
> **Depende de**: `SK-SQL-01`, `SK-SQL-02`, `SK-SQL-03`, `SK-SQL-04`, `SK-SQL-05`  
> **Es dependencia de**: _(módulo final — sin dependientes SQL)_

---

## Propósito

Implementa el **programa de fidelización por puntos SweetCoins** de Mytrufely. El saldo de puntos de cada cliente es la **suma de todos los registros** en `movimientos_puntos` (ledger contable). No existe un campo de saldo directo — siempre se calcula.

---

## Tablas

### `configuracion_recompensas`
| Columna                   | Tipo          | Descripción                                              |
|---------------------------|---------------|----------------------------------------------------------|
| `id_config`               | `serial`      | PK                                                       |
| `tasa_conversion`         | `numeric(5,4)`| Puntos ganados por sol gastado (ej: `0.1000` = 1/10 pts)|
| `limite_puntos_billetera` | `int`         | Máximo de puntos que puede acumular un cliente           |
| `dias_expiracion`         | `int`         | Días de vida de los puntos ganados en una venta          |
| `estado`                  | `boolean`     | Solo una configuración activa a la vez                   |

> Solo se usa la configuración más reciente con `estado = true`. Ver `fn_config_recompensas_activa()`.

---

### `movimientos_puntos` (Ledger)
| Columna                  | Tipo                        | Descripción                           |
|--------------------------|-----------------------------|---------------------------------------|
| `id_movimiento_punto`    | `serial`                    | PK                                    |
| `id_cliente`             | `int`                       | FK → `clientes` CASCADE               |
| `id_venta`               | `int`                       | FK → `ventas` CASCADE (nullable)      |
| `id_cupon_cliente`       | `int`                       | FK → `cupones_cliente` CASCADE (nullable) |
| `id_config`              | `int`                       | FK → `configuracion_recompensas`      |
| `tipo_movimiento`        | `tipo_movimiento_puntos_enum`| Clasificación del movimiento          |
| `cantidad`               | `int`                       | ⚠️ CHECK <> 0 (positivo o negativo)   |
| `saldo_puntos_resultante`| `int`                       | Calculado automáticamente por trigger |
| `fecha_movimiento`       | `timestamp`                 | DEFAULT NOW()                         |
| `fecha_expiracion`       | `timestamp`                 | nullable                              |
| `justificacion`          | `text`                      | nullable                              |

**Tipos de movimiento**:

| Tipo               | Signo    | Descripción                                 |
|--------------------|----------|---------------------------------------------|
| `ACUMULACION_VENTA`| positivo | Puntos ganados al pagar una venta           |
| `COMPRA_CUPON`     | negativo | Puntos gastados para canjear un cupón       |
| `PAGO_JUEGO`       | negativo | Costo de participar en minijuego            |
| `PREMIO_JUEGO`     | positivo | Puntos ganados al ganar un minijuego        |
| `EXPIRACION`       | negativo | Puntos que expiraron                        |
| `AJUSTE_ADMIN`     | ±        | Corrección manual por administrador         |

---

## Funciones

### `fn_saldo_puntos_cliente(p_id_cliente int) → int`
```sql
SELECT fn_saldo_puntos_cliente(42); -- Retorna saldo actual del cliente 42
```
Suma todos los movimientos del cliente. Es la fuente de verdad del saldo.

### `fn_config_recompensas_activa() → configuracion_recompensas`
Retorna la fila de configuración más reciente con `estado = true`. Lanza excepción si no existe.

---

## Vista

### `vw_saldo_puntos_cliente`
```sql
SELECT id_cliente, puntos_actuales FROM vw_saldo_puntos_cliente WHERE id_cliente = 42;
```
JOIN entre `clientes` y `SUM(movimientos_puntos.cantidad)`. Útil para APIs de consulta de saldo.

---

## Triggers

### `tg_movimientos_puntos_validar` (BEFORE INSERT)
- Calcula `saldo_puntos_resultante = saldo_actual + NEW.cantidad`.
- Rechaza la inserción si `saldo_nuevo < 0` (no se puede quedar en negativo).
- **Asigna automáticamente** `NEW.saldo_puntos_resultante`.

### `tg_ventas_otorgar_puntos` (AFTER UPDATE OF estado_pago en `ventas`)
Activado cuando `estado_pago` cambia a `'PAGADO'`:
1. Obtiene la configuración activa con `fn_config_recompensas_activa()`.
2. Calcula `puntos = FLOOR(total * tasa_conversion)`.
3. Inserta `ACUMULACION_VENTA` en `movimientos_puntos`.
4. Actualiza `ventas.puntos_ganados`.
5. Si la venta usó cupón → lo marca como `USADO`.

### `tg_ventas_anular` (AFTER UPDATE OF estado en `ventas`)
Activado cuando `estado` cambia a `'ANULADO'`:
1. Revierte stock de cada lote consumido (inserta `DEVOLUCION` en Kardex).
2. Revierte estado del cupón (a `DISPONIBLE` o `EXPIRADO` según fecha).
3. Inserta movimiento `AJUSTE_ADMIN` negativo para revertir los puntos otorgados.
4. Pone `ventas.puntos_ganados = 0`.

---

## Reglas de Negocio

- El saldo nunca puede ser negativo (enforced por trigger).
- La tasa de conversión aplica al `total` de la venta (post-descuento).
- Los puntos tienen fecha de expiración calculada en el trigger de otorgamiento.
- Un mismo `id_venta` no puede tener dos movimientos `ACUMULACION_VENTA` (guard en trigger).

---

## Cómo Usar Este Skill con la IA

```
"Implementa el endpoint de canje de puntos por cupón. Contexto:
@_docs/sql_modules/SK-SQL-00_convenciones.md
@_docs/sql_modules/SK-SQL-06_recompensas_sweetcoins.md
@_docs/sql_modules/SK-SQL-04_cupones.md
@_docs/skills/06_SWEETCOINS.md"
```
