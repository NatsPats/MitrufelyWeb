# SKILL 03 — Autenticación y RBAC (JWT + Roles)

> **CUÁNDO USAR:** Antes de implementar endpoints protegidos, lógica de login/registro, o validación de roles.

---

## 1. Modelo de Roles (DB → Backend)

### En la Base de Datos
```sql
CREATE TYPE tipo_rol_enum AS ENUM ('ADMIN', 'CLIENTE');
CREATE TABLE roles (id_rol serial PRIMARY KEY, nombre tipo_rol_enum UNIQUE NOT NULL);
```

### En Python (`app/infrastructure/database/models/enums.py` e `infrastructure/database/models/usuarios.py`)
```python
class TipoRolEnum(str, enum.Enum):
    ADMIN = "ADMIN"
    CLIENTE = "CLIENTE"

class AuthProviderEnum(str, enum.Enum):
    LOCAL = "local"
    GOOGLE = "google"
```

### Matriz de Permisos (`ROLE_PERMISSIONS`)
```python
ROLE_PERMISSIONS: dict[TipoRolEnum, set[Permission]] = {
    TipoRolEnum.ADMIN: set(Permission),  # Todos los permisos
    TipoRolEnum.CLIENTE: {
        Permission.PRODUCT_READ,
        Permission.ORDER_READ_OWN,
        Permission.ORDER_CREATE,
        Permission.USER_READ_OWN,
        Permission.CriptoTrufas_READ,
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

# CriptoTrufas
CriptoTrufas_READ, CriptoTrufas_ADJUST
```

---

## 2. JWT — Configuración

| Parámetro | Valor |
|---|---|
| Algoritmo | `HS256` |
| Clave | `settings.SECRET_KEY` (min 32 chars, en `.env`) |
| Access Token TTL | `settings.ACCESS_TOKEN_EXPIRE_MINUTES` (60 min) |
| Refresh Token TTL | `settings.REFRESH_TOKEN_EXPIRE_DAYS` (30 días) |
| Verification Token TTL | 2 horas (reducido de 24h por seguridad) |

### Payload del Access Token
```json
{
    "sub": "12",                     // Subject = user ID (id_usuario)
    "role": "CLIENTE",               // Rol del usuario
    "type": "access",
    "email": "cliente@correo.com",   // Email en raíz del payload
    "nombres": "Pedro",              // Nombre real de Gmail o local
    "apellidos": "Pérez",            // Apellido real de Gmail o local
    "iat": 1782012900,
    "exp": 1782016500
}
```

### Payload del Refresh Token (con JTI único)
```json
{
    "sub": "12",
    "type": "refresh",
    "jti": "550e8400-e29b-41d4-a716-446655440000", // UUID único por token
    "iat": 1782012900,
    "exp": 1782022900
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
create_refresh_token(subject: str) -> str  # Genera JTI único
create_verification_token(subject: str) -> str  # TTL de 2 horas

# Validación de token (lanza InvalidTokenError si falla)
decode_token(token: str) -> dict[str, Any]
```

---

## 4. Dependencias FastAPI (`app/security/dependencies.py`)

```python
from typing import Annotated
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    session: Annotated[AsyncSession, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> Usuario:
    """Valida JWT y retorna el usuario activo, rechazando tokens en blocklist."""
    # Comprobar token blocklist en Redis
    blocklist_key = f"token_blocklist:{token}"
    if await redis.exists(blocklist_key):
        raise UnauthorizedError("Token revocado (sesión cerrada)")

    payload = decode_token(token)
    if payload.get("type") != "access":
        raise InvalidTokenError()
    user_id = int(payload["sub"])
    ...
```

---

## 5. Google OAuth 2.0 y Validación Segura (`/auth/google`)

El inicio de sesión y registro automático de Google se gestiona validando el `id_token` obtenido por el frontend:

1. **Validación de Token con Google (`_verify_google_token`)**:
   * Envía el token al endpoint seguro de Google: `https://oauth2.googleapis.com/tokeninfo?id_token={token}`.
   * **Validación Obligatoria de Audiencia (`aud`):** Falla instantáneamente si `settings.GOOGLE_CLIENT_ID` está vacío en el servidor, o si la audiencia recibida no coincide con la configurada, protegiendo al backend de ataques de confusión de token de aplicaciones externas.
   * Verifica que `email_verified` sea `True`.

2. **Lógica de Autenticación / Registro**:
   * **Usuario no existe**: Lo registra automáticamente con `estado = True` (activado inmediatamente, ya validado por Google) y `auth_provider = 'google'`. El campo `password_hash` queda `NULL`. Se crea atómicamente el perfil del `Cliente`.
   * **Usuario existe (local)**: Si el usuario existe pero no tenía vinculado Google, actualiza `google_sub` y asocia la cuenta si el correo electrónico coincide, activando la cuenta si estaba pendiente.
   * **Emisión de Tokens**: Emite `access_token` (con nombres/apellidos reales de la cuenta de Gmail) y `refresh_token` con JTI único.

---

## 6. Rotación de Refresh Tokens (RTR) y Replay Attacks

Para prevenir la interceptación y el uso indefinido de refresh tokens:

1. Cada `refresh_token` contiene una clave única `"jti"` (UUID).
2. Cuando el endpoint `/auth/refresh` recibe un refresh token:
   * Extrae el `jti` y comprueba en Redis si existe la clave `rt_used:{jti}`.
   * **Si ya existe:** Significa que el token se está reusando (intento de Replay Attack). El backend deniega la renovación y lanza `InvalidTokenError` de forma inmediata.
   * **Si es la primera vez:** Se registra el `jti` en Redis con la clave `rt_used:{jti}` y expiración igual al TTL restante del token (`exp - now`).
3. El backend devuelve un **nuevo access_token** y un **nuevo refresh_token** con un `jti` fresco (Rotación).

---

## 7. Control de Tasa (Rate Limiting) en `/auth/login`

Para evitar ataques de fuerza bruta y denegación de servicio (DoS) por la carga de CPU de `bcrypt`:

- Se implementa un limitador por IP de forma distribuida en Redis.
- Por defecto, permite un máximo de **5 intentos** de login en un periodo de **60 segundos** (`settings.LOGIN_RATE_LIMIT_ATTEMPTS` y `settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS`).
- Al exceder el límite, el backend responde con **HTTP 429 Too Many Requests** y un JSON estructurado con los segundos restantes de bloqueo. El frontend muestra el mensaje dinámicamente mediante notificaciones Toast.

---

## 8. Flujo de Registro Tradicional y Verificación

```
POST /api/v1/auth/register
Body: { first_name, last_name, email, password, phone }
                ↓
AuthService.register()
    ├── Valida duplicados de email
    ├── Comprueba dominio administrador especial (@mitrufely.com)
    │     ├── Sí (ADMIN): estado=True, rol="ADMIN"
    │     └── No (CLIENTE): estado=False, rol="CLIENTE", crea Cliente en DB (Transaccional)
    ├── Si es CLIENTE:
    │     ├── Genera token de verificación (JWT con TTL de 2 horas, type="verification")
    │     └── BackgroundTask -> EmailService.send_verification_email()
    └── Retorna: { user_id, email, message: "Cuenta creada exitosamente" }
```
  * **Access Token**: 60 minutos (`ACCESS_TOKEN_EXPIRE_MINUTES`).
  * **Refresh Token**: 30 días (`REFRESH_TOKEN_EXPIRE_DAYS`).
  * **Verification Token**: 24 horas (JWT local seguro).
