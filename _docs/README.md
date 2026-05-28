# Mytrufely — Documentación Técnica

Esta carpeta contiene toda la documentación técnica viva del proyecto Mytrufely.

## 📂 Estructura General

```
_docs/
├── README.md                    # Este archivo (guía de documentación)
├── PRINCIPIOS_Y_PATRONES.md     # ← LEER ANTES DE SUSTENTAR (SOLID, MVC y Patrones)
├── skills/                      # Skills de arquitectura/dominio para la IA
│   ├── 00_INDEX.md              # ← Índice maestro de habilidades
│   ├── 01_DB_SCHEMA.md
│   ├── 02_BACKEND_ARCHITECTURE.md
│   ├── 03_AUTH_SECURITY.md
│   ├── 04_CHECKOUT_FLOW.md
│   ├── 05_INVENTORY_STOCK.md
│   ├── 06_CRIPTOTRUFA.md
│   ├── 07_FRONTEND_ARCHITECTURE.md
│   ├── 08_API_CONTRACTS.md
│   ├── 09_BACKGROUND_TASKS.md
│   └── 10_TESTING.md
└── sql_modules/                 # ← NUEVO: BD factorizada en módulos + skills SQL
    ├── 00_INDEX.md              # ← Índice maestro de módulos SQL
    ├── SK-SQL-00_convenciones.md  # Skill SECUNDARIO (apoyo transversal)
    ├── SK-SQL-01_enums_tipos.md   # Skill M01 — ENUMs
    ├── SK-SQL-02_usuarios_roles.md # Skill M02 — Usuarios/Roles
    ├── SK-SQL-03_catalogo_inventario.md # Skill M03 — Catálogo/Kardex
    ├── SK-SQL-04_cupones.md       # Skill M04 — Cupones
    ├── SK-SQL-05_ventas_pagos.md  # Skill M05 — Ventas/Pagos
    ├── SK-SQL-06_recompensas_sweetcoins.md # Skill M06 — SweetCoins
    ├── M01_enums_tipos.sql
    ├── M02_usuarios_roles.sql
    ├── M03_catalogo_inventario.sql
    ├── M04_cupones.sql
    ├── M05_ventas_pagos.sql
    ├── M06_recompensas_sweetcoins.sql
    └── M07_install_master.sql     # Orden de ejecución
```

---

## 🎯 Sustentación Académica (SOLID, MVC y Patrones)

Para la sustentación y revisión con el docente, hemos preparado una guía arquitectónica detallada que explica cómo se aplican los principios modernos de ingeniería de software directamente sobre el código real de Mytrufely:

👉 **[PRINCIPIOS_Y_PATRONES.md](./PRINCIPIOS_Y_PATRONES.md)** — _Explica SOLID (S-O-L-I-D), el patrón MVC desacoplado y patrones de diseño implementados (Repository, Singleton, Dependency Injection, Chain of Responsibility, Observer, etc.) con fragmentos de código del proyecto._

---

## 🤖 Cómo Usar con la IA

Cuando le pidas a la IA que implemente algo, adjunta el skill relevante al contexto:

```
"Implementa el módulo de inventario. Contexto: @_docs/skills/00_INDEX.md @_docs/skills/05_INVENTORY_STOCK.md @_docs/skills/02_BACKEND_ARCHITECTURE.md"
```

La IA leerá el índice para entender el ecosistema y el skill específico para los detalles técnicos del dominio.
