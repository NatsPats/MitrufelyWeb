# SKILL 03 — Autenticación y RBAC (JWT + Roles)

> **CUÁNDO USAR:** Antes de implementar endpoints protegidos, lógica de login/registro, o validación de roles.

---

## 1. Modelo de Roles (DB → Backend)

### En la Base de Datos
```sql
CREATE TYPE tipo_rol_enum AS ENUM ('ADMIN', 'CLIENTE', 'CAJERO', 'ALMACEN');
CREATE TABLE roles (id_rol serial PRIMARY KEY, nombre tipo_rol_enum UNIQUE NOT NULL);
```

### En Python (`app/core/constants.py`)
```python
class UserRole(StrEnum):
    ADMIN = "administrador"
    CLIENT = "cliente"

# ⚠️ PENDIENTE: Agregar CAJERO y ALMACEN cuando se implementen sus módulos
# UserRole.CASHIER = "cajero"
# UserRole.WAREHOUSE = "almacen"
```

### Matriz de Permisos (`ROLE_PERMISSIONS`)
```python
ROLE_PERMISSIONS: dict[UserRole, set[Permission]] = {
    UserRole.ADMIN: set(Permission),  # Todos los permisos
    UserRole.CLIENT: {
        Permission.PRODUCT_READ,
        Permission.ORDER_READ_OWN,
        Permission.ORDER_CREATE,
        Permission.USER_READ_OWN,
        Permission.SWEETCOINS_READ,
    },
}
```

### Permisos disponibles (`Permission(StrEnum)`)
```python
# Inventario
INVENTORY_READ, INVENTORY_WRITE, INVENTORY_DELETE

# Órdenes/Ventas
ORDER_READ_OWN, ORDER_READ_ALL, ORDER_CREATE, ORDER_UPDATE

# Productos
PRODUCT_READ, PRODUCT_WRITE, PRODUCT_DELETE

# Usuarios
USER_READ_OWN, USER_READ_ALL, USER_UPDATE

# Reportes y Dashboard
REPORT_GENERATE, DASHBOARD_READ

# SweetCoins
SWEETCOINS_READ, SWEETCOINS_ADJUST
```

---

## 2. JWT — Configuración

| Parámetro | Valor |
|---|---|
| Algoritmo | `HS256` |
| Clave | `settings.SECRET_KEY` (min 32 chars, en `.env`) |
| Access Token TTL | `settings.ACCESS_TOKEN_EXPIRE_MINUTES` (60 min) |
| Refresh Token TTL | `settings.REFRESH_TOKEN_EXPIRE_DAYS` (30 días) |

### Payload del Access Token
```python
{
    "sub": str(user.id_usuario),   # Subject = user ID
    "role": "ADMIN",               # Rol del usuario
    "type": "access",
    "iat": datetime,
    "exp": datetime,
}
```

### Payload del Refresh Token
```python
{
    "sub": str(user.id_usuario),
    "type": "refresh",
    "iat": datetime,
    "exp": datetime,
}
```

---

## 3. Funciones de Seguridad (`app/core/security.py`)

```python
# Hash de contraseña
hash_password(plain: str) -> str
verify_password(plain: str, hashed: str) -> bool

# Creación de tokens
create_access_token(subject: str, role: str, extra: dict | None) -> str
create_refresh_token(subject: str) -> str

# Validación de token (lanza InvalidTokenError si falla)
decode_token(token: str) -> dict[str, Any]
```

---

## 4. Dependencias FastAPI (`app/security/dependencies.py`)

### Patrón estándar para dependencias de seguridad:

```python
from typing import Annotated
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UsuarioModel:
    """Valida JWT y retorna el usuario activo."""
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise InvalidTokenError()
    user_id = int(payload["sub"])
    # Consultar usuario en DB...
    if not user or not user.estado:
        raise UnauthorizedError("Usuario inactivo o no encontrado")
    return user


async def get_current_active_admin(
    current_user: Annotated[UsuarioModel, Depends(get_current_user)],
) -> UsuarioModel:
    """Verifica rol ADMIN."""
    if current_user.rol.nombre != "ADMIN":
        raise InsufficientRoleError()
    return current_user


def require_permissions(*permissions: Permission):
    """Factory de dependencia para permisos granulares."""
    async def _check(
        current_user: Annotated[UsuarioModel, Depends(get_current_user)],
    ) -> UsuarioModel:
        user_role = UserRole(current_user.rol.nombre)
        allowed = ROLE_PERMISSIONS.get(user_role, set())
        if not all(p in allowed for p in permissions):
            raise InsufficientRoleError()
        return current_user
    return _check
```

---

## 5. Uso en Routers

```python
# Endpoint solo autenticado
@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[UsuarioModel, Depends(get_current_user)],
) -> UserResponse:
    return UserResponse.model_validate(current_user)


# Endpoint solo ADMIN
@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    _: Annotated[UsuarioModel, Depends(get_current_active_admin)],
    service: Annotated[UserService, Depends(get_user_service)],
) -> MessageResponse:
    await service.delete(user_id)
    return MessageResponse(message="Usuario eliminado")


# Endpoint con permiso específico
@router.post("/adjust")
async def adjust_stock(
    _: Annotated[UsuarioModel, Depends(require_permissions(Permission.INVENTORY_WRITE))],
    ...
```

---

## 6. Flujo de Autenticación (Login)

```
POST /api/v1/auth/login
Body: { email, password }
                ↓
AuthService.login()
    ├── repo.get_by_email(email)        → UsuarioModel | None
    ├── verify_password(plain, hash)    → bool
    ├── if not user.estado → raise UnauthorizedError
    ├── create_access_token(sub=user_id, role=role_name)
    └── create_refresh_token(sub=user_id)
                ↓
Response: { access_token, refresh_token, token_type: "bearer" }
```

---

## 7. Flujo de Refresco de Token

```
POST /api/v1/auth/refresh
Body: { refresh_token }
                ↓
decode_token(refresh_token)
    ├── Verificar type == "refresh"
    ├── Extraer sub (user_id)
    └── create_access_token(sub, role)
                ↓
Response: { access_token }
```

---

## 8. Relación en la Base de Datos

```
usuarios
  └── id_rol → roles.id_rol
               └── nombre: tipo_rol_enum ('ADMIN'|'CLIENTE'|'CAJERO'|'ALMACEN')

clientes (extensión de usuarios para tipo CLIENTE)
  └── id_usuario → usuarios.id_usuario (UNIQUE, 1-a-1)
```

**Al hacer login**, el servicio de auth debe hacer JOIN con `roles` para obtener el nombre del rol y embeber en el JWT.

---

## 9. Seguridad de Contraseñas

- Hash: `bcrypt` via `passlib.CryptContext`
- **NUNCA** almacenar ni loggear passwords en texto plano
- Al registrar: `hash_password(request.password)` antes de insertar en DB
- Al login: `verify_password(request.password, user.password_hash)`
