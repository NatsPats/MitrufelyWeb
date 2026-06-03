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
    ├── SK-SQL-06_recompensas_CriptoTrufas.md # Skill M06 — CriptoTrufas
    ├── M01_enums_tipos.sql
    ├── M02_usuarios_roles.sql
    ├── M03_catalogo_inventario.sql
    ├── M04_cupones.sql
    ├── M05_ventas_pagos.sql
    ├── M06_recompensas_CriptoTrufas.sql
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

---

## 🔒 Contratos de Autenticación y Seguridad (Para el Frontend)

Hemos actualizado la arquitectura de seguridad y autenticación. A continuación se presentan los contratos de API y flujos exactos que debe consumir el **Frontend**:

### 1. Registro (`POST /api/v1/auth/register`)
Crea un nuevo usuario en la base de datos de forma segura.
* **Payload (JSON):**
  ```json
  {
    "first_name": "Nombre",
    "last_name": "Apellido",
    "email": "cliente@correo.com",
    "password": "Password123",
    "phone": "+51999999999"
  }
  ```
  *(La contraseña requiere al menos 1 mayúscula y 1 número).*
* **Respuesta Exitosa (201 Created):**
  ```json
  {
    "user_id": 12,
    "email": "cliente@correo.com",
    "message": "Cuenta creada exitosamente"
  }
  ```
* **Lógica de negocio:**
  * Si el correo termina en `@mitrufely.com` (dominio administrador especial), se le asigna rol `ADMIN` y `estado = True` (activado inmediatamente).
  * Si es cualquier otro correo, se crea con rol `CLIENTE`, `estado = False` y se le envía un correo HTML interactivo con el link de verificación de cuenta.

### 2. Verificación de Cuenta (`GET /api/v1/auth/verify`)
Activa la cuenta del cliente para permitirle hacer login.
* **Query Params:** `?token=<jwt_verification_token>`
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "message": "Cuenta verificada exitosamente. Ya puedes iniciar sesión."
  }
  ```

### 3. Iniciar Sesión (`POST /api/v1/auth/login`)
Autentica al usuario y devuelve los tokens JWT de sesión.
* **Payload (JSON):**
  ```json
  {
    "email": "cliente@correo.com",
    "password": "Password123"
  }
  ```
* **Respuesta Exitosa (200 OK):**
  ```json
  {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "token_type": "bearer",
    "expires_in": 3600
  }
  ```
  *(Si el usuario tiene `estado = False`, el backend responderá con `401 Unauthorized` indicando que debe verificar su cuenta vía correo electrónico).*

### 4. Cerrar Sesión (`POST /api/v1/auth/logout`)
Invalida el JWT de manera real e inmediata mediante la lista de bloqueo (blocklist) de Redis.
* **Headers:** `Authorization: Bearer <access_token>`
* **Respuesta Exitosa:** `204 No Content`
* **Lógica de negocio:** El backend calcula el tiempo de vida restante del token (`exp - now`) y lo añade a Redis con ese TTL. Cualquier petición posterior con ese token será rechazada con `401 Unauthorized`.

Para más detalles, consulta el skill específico: 👉 **[03_AUTH_SECURITY.md](./skills/03_AUTH_SECURITY.md)**.

---

## 📦 Módulo de Inventario y Control de Lotes FEFO (Fase 3)

Se ha implementado el backend completo para la gestión física e inventario de trufas. Dado que son productos perecederos, el sistema utiliza un estricto despacho **FEFO (First Expired, First Out)** a través de triggers de base de datos.

### ⚠️ Regla de Oro: Gobernanza Única en NeonDB (PostgreSQL)
* **Gobernanza del stock:** El backend nunca actualiza directamente `productos.stock_actual` o `lotes.cantidad_disponible`.
* **Triggers automáticos:**
  * **Ingreso de lote (`POST /inventory/lots`):** Registra el lote y activa `tg_lotes_post_insert` para sumar el stock y registrar `INGRESO_COMPRA` en el Kardex.
  * **Ajustes manuales (`POST /inventory/adjustments`):** Registra ajustes de tipo `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO` o `MERMA`. Activa `tg_movimientos_stock_ajustes` (migración [M09_trigger_ajustes_stock.sql](file:///c:/Users/lordm/Desktop/Proyectos%20y%20clases/UTP%20CICLO%206/Integrador%20de%20Sistemas/proyecto/MitrufelyWeb/_modelBD/M09_trigger_ajustes_stock.sql)) que valida la inmutabilidad de lotes vencidos, actualiza el stock disponible del lote/producto y calcula el `stock_resultante` de forma atómica.
  * **Ventas:** El trigger de detalles de venta asocia automáticamente lotes vigentes siguiendo el orden FEFO (fecha de vencimiento más próxima).

### 🛠️ Contratos de API de Inventario (Solo ADMIN)
Todos los endpoints requieren autorización de administrador (Bearer Token con rol `ADMIN`):

#### 1. Registrar Lote (`POST /api/v1/inventory/lots`)
* **Payload (JSON):**
  ```json
  {
    "id_producto": 1,
    "cantidad_inicial": 50,
    "fecha_vencimiento": "2026-06-08T18:04:21Z"
  }
  ```
* **Respuesta (201 Created):** Retorna el lote registrado (con `cantidad_disponible` normalizada a la cantidad inicial y `estado_lote` en `VIGENTE`).

#### 2. Aplicar Ajuste Manual (`POST /api/v1/inventory/adjustments`)
* **Payload (JSON):**
  ```json
  {
    "id_producto": 1,
    "id_lote": 12,
    "tipo_movimiento": "AJUSTE_POSITIVO",
    "cantidad": 15,
    "observacion": "Corrección de inventario"
  }
  ```
  *(Tipos permitidos: `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `MERMA`)*
* **Respuesta (200 OK):** Retorna el movimiento de stock insertado con el `stock_resultante` real calculado por base de datos.

#### 3. Ver Kardex (`GET /api/v1/inventory/kardex/{producto_id}`)
* Devuelve el historial de movimientos ordenados cronológicamente de forma descendente.

#### 4. Conciliación de Stock (`GET /api/v1/inventory/reconciliation`)
* Compara el stock en caché (`productos.stock_actual`) frente al Kardex y las existencias reales por lotes para auditoría de descuadres.

Para más detalles, consulta la documentación técnica específica: 👉 **[fase3_inventario_fefo.md](./fases/fase3_inventario_fefo.md)**.


