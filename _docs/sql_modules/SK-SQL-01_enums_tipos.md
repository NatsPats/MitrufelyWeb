# SKILL: M01 — ENUMs y Tipos Base (Mytrufely)

> **ID**: `SK-SQL-01`  
> **Módulo SQL**: `M01_enums_tipos.sql`  
> **Skill Secundario de Apoyo**: [`SK-SQL-00_convenciones.md`](./SK-SQL-00_convenciones.md)  
> **Depende de**: _(ninguno — primer módulo en ejecutar)_  
> **Es dependencia de**: `SK-SQL-02`, `SK-SQL-03`, `SK-SQL-04`, `SK-SQL-05`, `SK-SQL-06`

---

## Propósito

Define todos los **tipos enumerados (`ENUM`)** del sistema Mytrufely. Los ENUMs garantizan validación semántica a nivel de motor: PostgreSQL rechaza cualquier valor que no esté en la lista, sin necesidad de constraints adicionales.

---

## ENUMs definidos

| Nombre                         | Valores posibles                                                                  | Usado en tabla(s)                        |
|--------------------------------|-----------------------------------------------------------------------------------|------------------------------------------|
| `tipo_rol_enum`                | `ADMIN`, `CLIENTE`, `CAJERO`, `ALMACEN`                                           | `usuarios.nombre`                        |
| `tipo_documento_fiscal_enum`   | `DNI`, `RUC`                                                                      | `datos_fiscales.tipo_documento`          |
| `estado_lote_enum`             | `VIGENTE`, `AGOTADO`, `VENCIDO`                                                   | `lotes.estado_lote`                      |
| `tipo_movimiento_stock_enum`   | `INGRESO_COMPRA`, `VENTA`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `MERMA`, `VENCIMIENTO`, `DEVOLUCION` | `movimientos_stock.tipo_movimiento` |
| `estado_cupon_enum`            | `DISPONIBLE`, `USADO`, `EXPIRADO`                                                 | `cupones_cliente.estado`                 |
| `origen_cupon_enum`            | `COMPRA_PUNTOS`, `REGALO_ADMIN`, `PREMIO_JUEGO`, `REGISTRO_NUEVO`                 | `cupones_cliente.origen`                 |
| `origen_venta_enum`            | `WEB`                                                                             | `ventas.origen_venta`                    |
| `estado_venta_enum`            | `PENDIENTE`, `PAGADO`, `ENTREGADO`, `ANULADO`                                     | `ventas.estado`, `historial_estados_venta.estado` |
| `estado_pago_enum`             | `PENDIENTE`, `PAGADO`                                                             | `ventas.estado_pago`                     |
| `tipo_pago_enum`               | `EFECTIVO`, `YAPE`, `TRANSFERENCIA`                                               | `metodos_pago.tipo_pago`                 |
| `estado_transaccion_enum`      | `PENDIENTE`, `APROBADO`, `RECHAZADO`, `ANULADO`                                   | `metodos_pago.estado_transaccion`        |
| `tipo_documento_venta_enum`    | `BOLETA`, `FACTURA`, `REPORTE`                                                    | `documentos.tipo_documento`              |
| `tipo_movimiento_puntos_enum`  | `ACUMULACION_VENTA`, `COMPRA_CUPON`, `PAGO_JUEGO`, `PREMIO_JUEGO`, `EXPIRACION`, `AJUSTE_ADMIN` | `movimientos_puntos.tipo_movimiento` |

---

## Reglas de Uso

- Los ENUMs **deben crearse antes** que cualquier tabla. Ejecutar `M01` siempre primero.
- Para agregar un nuevo valor a un ENUM existente en PostgreSQL:
  ```sql
  ALTER TYPE estado_venta_enum ADD VALUE 'NUEVO_ESTADO';
  ```
  > ⚠️ PostgreSQL no permite eliminar valores de un ENUM sin recrear el tipo.
- Para renombrar o reestructurar un ENUM es necesario crear uno nuevo, migrar los datos y eliminar el antiguo (requiere migración cuidadosa).

---

## Cómo Usar Este Skill con la IA

```
"Añade un nuevo estado al ciclo de venta. Contexto:
@_docs/sql_modules/SK-SQL-00_convenciones.md
@_docs/sql_modules/SK-SQL-01_enums_tipos.md"
```
