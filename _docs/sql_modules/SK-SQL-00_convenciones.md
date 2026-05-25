# SKILL SECUNDARIO: Convenciones Transversales de BD — Mytrufely

> **Tipo**: Skill Secundario (apoyo)  
> **Conectado a**: Todos los skills de módulo SQL (`SK-SQL-01` … `SK-SQL-06`)  
> **Archivo**: `_docs/sql_modules/SK-SQL-00_convenciones.md`

---

## Propósito

Este skill documenta las **convenciones, restricciones y patrones globales** que aplican a **todos** los módulos del esquema físico PostgreSQL de Mytrufely. Cualquier skill de módulo **debe cargarse junto a este skill** para garantizar contexto completo.

---

## Convenciones de Nomenclatura

| Elemento        | Patrón                                 | Ejemplo                        |
|-----------------|----------------------------------------|--------------------------------|
| Tablas          | `snake_case` plural                    | `movimientos_stock`            |
| Columnas        | `snake_case`                           | `stock_actual`                 |
| PKs             | `id_<tabla_singular>`                  | `id_producto`                  |
| FKs             | `id_<tabla_referenciada_singular>`     | `id_cliente`                   |
| ENUMs           | `<concepto>_enum`                      | `estado_venta_enum`            |
| Funciones de TG | `fn_tg_<tabla>_<accion>()`             | `fn_tg_lotes_validar_insert()` |
| Triggers        | `tg_<tabla>_<accion>`                  | `tg_lotes_validar_insert`      |
| Stored Procs    | `sp_<accion>_<objeto>()`               | `sp_expirar_lotes_vencidos()`  |
| Vistas          | `vw_<concepto>`                        | `vw_stock_producto`            |
| Índices únicos  | `uq_<tabla>_<descripcion>`             | `uq_datos_fiscales_predeterminado` |

---

## Tipos de Datos Estándar

| Dato              | Tipo PostgreSQL        |
|-------------------|------------------------|
| PKs / FKs enteras | `serial` / `int`       |
| Textos cortos     | `varchar(N)`           |
| Textos libres     | `text`                 |
| Montos            | `numeric(10,2)`        |
| Porcentajes       | `numeric(5,2)`         |
| Tasas de conv.    | `numeric(5,4)`         |
| Fechas/horas      | `timestamp`            |
| Flags             | `boolean`              |
| Enumerados        | `<nombre>_enum`        |

---

## Reglas de Integridad Generales

- **ON DELETE RESTRICT** por defecto en FKs de negocio (nunca se borra en cascada lo que tiene valor contable).
- **ON DELETE CASCADE** solo para relaciones de composición (ej. `detalles_venta → ventas`).
- **ON DELETE SET NULL** para referencias opcionales de auditoría (ej. `id_usuario` en logs).
- Todas las columnas `estado` de tipo booleano tienen `DEFAULT true`.
- Las columnas de monto nunca aceptan negativos (`CHECK >= 0`).
- Los campos `cantidad` en lotes y detalles exigen `CHECK > 0` (no se registra cantidad cero).
- `movimientos_puntos.cantidad` puede ser negativo (descuento de puntos), validado por trigger.

---

## Orden de Ejecución de Módulos

```
M01_enums_tipos.sql            (sin dependencias)
  └── M02_usuarios_roles.sql
        └── M03_catalogo_inventario.sql
              └── M04_cupones.sql
                    └── M05_ventas_pagos.sql
                          └── M06_recompensas_sweetcoins.sql
```

---

## Tareas de Mantenimiento Periódico

| Procedimiento               | Frecuencia recomendada | Descripción                          |
|-----------------------------|------------------------|--------------------------------------|
| `sp_expirar_cupones_vencidos()` | Diaria             | Marca cupones expirados              |
| `sp_expirar_lotes_vencidos()`   | Diaria             | Reduce stock y marca lotes vencidos  |

---

## Cómo Usar Este Skill con la IA

Carga siempre este skill junto al módulo específico:

```
"Implementa [feature]. Contexto: @_docs/sql_modules/SK-SQL-00_convenciones.md @_docs/sql_modules/SK-SQL-0X_<modulo>.md"
```
