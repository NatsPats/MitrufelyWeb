# Índice de Módulos SQL — Mytrufely

> **Carpeta**: `_docs/sql_modules/`  
> **Propósito**: Factorización modular del script físico de BD (`Query1.sql`) en unidades independientes, documentadas y listas para usar como skills de contexto con la IA.

---

## Arquitectura de Skills

Cada módulo tiene **dos capas de documentación**:

```
SK-SQL-00_convenciones.md     ← Skill SECUNDARIO (apoyo transversal)
│   Se incluye SIEMPRE junto al skill de módulo específico
│
├── SK-SQL-01_enums_tipos.md            → M01_enums_tipos.sql
├── SK-SQL-02_usuarios_roles.md         → M02_usuarios_roles.sql
├── SK-SQL-03_catalogo_inventario.md    → M03_catalogo_inventario.sql
├── SK-SQL-04_cupones.md                → M04_cupones.sql
├── SK-SQL-05_ventas_pagos.md           → M05_ventas_pagos.sql
└── SK-SQL-06_recompensas_sweetcoins.md → M06_recompensas_sweetcoins.sql
```

---

## Mapa de Módulos y Dependencias

```
M01_enums_tipos
    └── M02_usuarios_roles
            └── M03_catalogo_inventario
                    └── M04_cupones
                            └── M05_ventas_pagos
                                    └── M06_recompensas_sweetcoins
```

> Ejecutar siempre en este orden. Cada módulo depende de todos los anteriores.

---

## Tabla de Módulos

| ID   | Archivo SQL                      | Skill                                    | Contenido Principal                                    |
|------|----------------------------------|------------------------------------------|--------------------------------------------------------|
| M01  | `M01_enums_tipos.sql`            | `SK-SQL-01_enums_tipos.md`               | 13 tipos ENUM del dominio                              |
| M02  | `M02_usuarios_roles.sql`         | `SK-SQL-02_usuarios_roles.md`            | roles, usuarios, clientes, datos_fiscales, logs        |
| M03  | `M03_catalogo_inventario.sql`    | `SK-SQL-03_catalogo_inventario.md`       | categorias, productos, lotes, movimientos_stock, vw_stock |
| M04  | `M04_cupones.sql`                | `SK-SQL-04_cupones.md`                   | cupones_maestro, cupones_cliente, trigger normalización |
| M05  | `M05_ventas_pagos.sql`           | `SK-SQL-05_ventas_pagos.md`              | ventas, detalles, detalle_lotes, metodos_pago, documentos |
| M06  | `M06_recompensas_sweetcoins.sql` | `SK-SQL-06_recompensas_sweetcoins.md`    | configuracion_recompensas, movimientos_puntos, triggers |
| M07  | `M07_install_master.sql`         | _(referencia de instalación)_            | Script orquestador del orden de ejecución              |

---

## Skill Secundario Transversal

| Archivo                      | Descripción                                                       |
|------------------------------|-------------------------------------------------------------------|
| `SK-SQL-00_convenciones.md`  | Nomenclatura, tipos de datos, reglas de FK, orden de ejecución   |

---

## Resumen de Objetos por Módulo

| Módulo | Tablas | Vistas | Funciones/SPs | Triggers |
|--------|--------|--------|---------------|----------|
| M01    | 0      | 0      | 0             | 0        |
| M02    | 4      | 0      | 0             | 0        |
| M03    | 3      | 1      | 2 (fn+sp)     | 2        |
| M04    | 2      | 0      | 1 sp          | 1        |
| M05    | 5      | 0      | 3 fn          | 6        |
| M06    | 2      | 1      | 4 (fn+sp)     | 3        |
| **Total** | **16** | **2** | **10**      | **12**   |

---

## Uso Rápido con la IA

### Preguntas de BD / esquema:
```
@_docs/sql_modules/SK-SQL-00_convenciones.md @_docs/sql_modules/SK-SQL-0X_<modulo>.md
```

### Implementar checkout:
```
@_docs/sql_modules/SK-SQL-00_convenciones.md
@_docs/sql_modules/SK-SQL-05_ventas_pagos.md
@_docs/sql_modules/SK-SQL-03_catalogo_inventario.md
@_docs/skills/04_CHECKOUT_FLOW.md
```

### Implementar SweetCoins / puntos:
```
@_docs/sql_modules/SK-SQL-00_convenciones.md
@_docs/sql_modules/SK-SQL-06_recompensas_sweetcoins.md
@_docs/sql_modules/SK-SQL-04_cupones.md
@_docs/skills/06_SWEETCOINS.md
```

### Inventario y lotes:
```
@_docs/sql_modules/SK-SQL-00_convenciones.md
@_docs/sql_modules/SK-SQL-03_catalogo_inventario.md
@_docs/skills/05_INVENTORY_STOCK.md
```
