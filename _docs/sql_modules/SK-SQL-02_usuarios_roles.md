# SKILL: M02 — Usuarios, Roles y Datos Fiscales (Mytrufely)

> **ID**: `SK-SQL-02`  
> **Módulo SQL**: `M02_usuarios_roles.sql`  
> **Skill Secundario de Apoyo**: [`SK-SQL-00_convenciones.md`](./SK-SQL-00_convenciones.md)  
> **Depende de**: `SK-SQL-01` (ENUMs)  
> **Es dependencia de**: `SK-SQL-03`, `SK-SQL-04`, `SK-SQL-05`, `SK-SQL-06`

---

## Propósito

Gestiona toda la **identidad y autenticación** de los actores del sistema: roles, usuarios, perfiles de cliente y datos de facturación. También incluye la tabla `logs_sistema` porque su único FK apunta a `usuarios`.

---

## Tablas

### `roles`
| Columna   | Tipo              | Restricciones        |
|-----------|-------------------|----------------------|
| `id_rol`  | `serial`          | PK                   |
| `nombre`  | `tipo_rol_enum`   | UNIQUE NOT NULL      |

**Valores iniciales esperados**: `ADMIN`, `CLIENTE`, `CAJERO`, `ALMACEN`

---

### `usuarios`
| Columna         | Tipo           | Restricciones            |
|-----------------|----------------|--------------------------|
| `id_usuario`    | `serial`       | PK                       |
| `id_rol`        | `int`          | FK → `roles`, NOT NULL   |
| `nombres`       | `varchar(100)` | NOT NULL                 |
| `apellidos`     | `varchar(100)` | NOT NULL                 |
| `email`         | `varchar(150)` | UNIQUE NOT NULL          |
| `password_hash` | `varchar(255)` | NOT NULL (bcrypt)        |
| `telefono`      | `varchar(20)`  | nullable                 |
| `estado`        | `boolean`      | DEFAULT true             |

> El campo `password_hash` almacena el hash bcrypt/argon2. **Nunca almacenar texto plano.**

---

### `clientes`
| Columna      | Tipo           | Restricciones              |
|--------------|----------------|----------------------------|
| `id_cliente` | `serial`       | PK                         |
| `id_usuario` | `int`          | FK → `usuarios`, UNIQUE    |
| `direccion`  | `varchar(255)` | nullable                   |
| `referencia` | `varchar(255)` | nullable                   |

- Relación 1-a-1 con `usuarios` (UNIQUE en `id_usuario`).
- Se elimina en cascada si el usuario padre es eliminado.

---

### `datos_fiscales`
| Columna              | Tipo                         | Restricciones       |
|----------------------|------------------------------|---------------------|
| `id_dato_fiscal`     | `serial`                     | PK                  |
| `id_usuario`         | `int`                        | FK → `usuarios`     |
| `tipo_documento`     | `tipo_documento_fiscal_enum` | NOT NULL            |
| `numero_documento`   | `varchar(20)`                | UNIQUE NOT NULL     |
| `razon_social`       | `varchar(150)`               | nullable (solo RUC) |
| `direccion_fiscal`   | `varchar(255)`               | nullable            |
| `es_predeterminado`  | `boolean`                    | DEFAULT false       |

**Restricción especial**: solo puede haber **un** dato fiscal `es_predeterminado = true` por usuario (índice único parcial).

---

### `logs_sistema`
| Columna      | Tipo           | Restricciones         |
|--------------|----------------|-----------------------|
| `id_log`     | `serial`       | PK                    |
| `id_usuario` | `int`          | FK → `usuarios` SET NULL |
| `accion`     | `varchar(255)` | NOT NULL              |
| `fecha`      | `timestamp`    | DEFAULT NOW()         |

---

## Índices

```sql
CREATE INDEX ON usuarios       (id_rol);
CREATE INDEX ON datos_fiscales (id_usuario);
CREATE INDEX ON datos_fiscales (numero_documento);
CREATE UNIQUE INDEX uq_datos_fiscales_predeterminado
  ON datos_fiscales (id_usuario) WHERE es_predeterminado = true;
```

---

## Notas de Implementación Backend

- Al registrar un nuevo cliente desde la web: crear `usuarios` → luego `clientes` en la misma transacción.
- La autenticación se realiza con `email` + `password_hash` (verificar con `bcrypt.compare`).
- El `id_rol` determina los permisos (guards de ruta en el backend).
- El `estado = false` equivale a usuario desactivado (soft delete).

---

## Cómo Usar Este Skill con la IA

```
"Implementa el registro de usuario y perfil de cliente. Contexto:
@_docs/sql_modules/SK-SQL-00_convenciones.md
@_docs/sql_modules/SK-SQL-02_usuarios_roles.md
@_docs/skills/03_AUTH_SECURITY.md"
```
