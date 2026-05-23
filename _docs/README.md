# Mytrufely — Documentación Técnica

Esta carpeta contiene toda la documentación técnica viva del proyecto Mytrufely.

## 📂 Estructura General

```
_docs/
├── README.md               # Este archivo (guía de documentación)
├── PRINCIPIOS_Y_PATRONES.md # ← LEER ANTES DE SUSTENTAR (SOLID, MVC y Patrones)
└── skills/                 # Sistema de Skills: contexto técnico para la IA
    ├── 00_INDEX.md         # ← LEER PRIMERO (índice maestro de habilidades)
    ├── 01_DB_SCHEMA.md
    ├── 02_BACKEND_ARCHITECTURE.md
    ├── 03_AUTH_SECURITY.md
    ├── 04_CHECKOUT_FLOW.md
    ├── 05_INVENTORY_STOCK.md
    ├── 06_SWEETCOINS.md
    ├── 07_FRONTEND_ARCHITECTURE.md
    ├── 08_API_CONTRACTS.md
    ├── 09_BACKGROUND_TASKS.md
    └── 10_TESTING.md
```

---

## 🎯 Sustentación Académica (SOLID, MVC y Patrones)

Para la sustentación y revisión con el docente, hemos preparado una guía arquitectónica detallada que explica cómo se aplican los principios modernos de ingeniería de software directamente sobre el código real de Mytrufely:

👉 **[PRINCIPIOS_Y_PATRONES.md](./PRINCIPIOS_Y_PATRONES.md)** — *Explica SOLID (S-O-L-I-D), el patrón MVC desacoplado y patrones de diseño implementados (Repository, Singleton, Dependency Injection, Chain of Responsibility, Observer, etc.) con fragmentos de código del proyecto.*

---

## 🤖 Cómo Usar con la IA

Cuando le pidas a la IA que implemente algo, adjunta el skill relevante al contexto:

```
"Implementa el módulo de inventario. Contexto: @_docs/skills/00_INDEX.md @_docs/skills/05_INVENTORY_STOCK.md @_docs/skills/02_BACKEND_ARCHITECTURE.md"
```

La IA leerá el índice para entender el ecosistema y el skill específico para los detalles técnicos del dominio.

