"""
Mifrufely Web — Auth Schemas (Pydantic v2)
Request/Response contracts for authentication endpoints
"""

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10, max_length=4096)


# ── Recuperación de Contraseña ──────────────────────────────────────────────────


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=10, max_length=4096)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("La contraseña debe contener al menos una mayúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número")
        return v


class RegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=100)
    last_name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    phone: str | None = Field(None, pattern=r"^\+?[\d\s\-]{7,20}$")

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("La contraseña debe contener al menos una mayúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número")
        return v


class RegisterResponse(BaseModel):
    user_id: int
    email: str
    message: str = "Cuenta creada exitosamente"


class GoogleLoginRequest(BaseModel):
    """Payload enviado por el frontend tras el flujo de Google Sign-In."""

    id_token: str = Field(
        ...,
        min_length=10,
        max_length=4096,
        description="ID Token JWT devuelto por Google Identity Services en el frontend.",
    )


class RolResponse(BaseModel):
    id_rol: int
    nombre: str

    model_config = ConfigDict(from_attributes=True)


class ClienteResponse(BaseModel):
    id_cliente: int
    direccion: str | None = None
    referencia: str | None = None
    telefono: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UserMeResponse(BaseModel):
    id_usuario: int
    nombres: str
    apellidos: str
    email: str
    telefono: str | None
    estado: bool
    auth_provider: str
    avatar_url: str | None = None
    rol: RolResponse
    cliente: ClienteResponse | None = None

    model_config = ConfigDict(from_attributes=True)


# ── Datos Fiscales ─────────────────────────────────────────────────────────────


class DatosFiscalesResponse(BaseModel):
    id_dato_fiscal: int
    id_usuario: int
    tipo_documento: str
    numero_documento: str
    razon_social: str | None = None
    direccion_fiscal: str | None = None
    es_predeterminado: bool

    model_config = ConfigDict(from_attributes=True)


class DatosFiscalesUpsert(BaseModel):
    tipo_documento: str = Field(..., pattern=r"^(DNI|RUC)$")
    numero_documento: str = Field(..., min_length=8, max_length=20)
    razon_social: str | None = None
    direccion_fiscal: str | None = None

    @field_validator("razon_social")
    @classmethod
    def validate_razon_social(cls, v: str | None, info) -> str | None:
        tipo = info.data.get("tipo_documento", "")
        if tipo == "RUC" and (not v or not v.strip()):
            raise ValueError("La razón social es obligatoria para RUC")
        return v


# ── Perfil / Envío ─────────────────────────────────────────────────────────────


class UserProfileUpdate(BaseModel):
    nombres: str | None = Field(None, min_length=2, max_length=100)
    apellidos: str | None = Field(None, min_length=2, max_length=100)
    email: EmailStr | None = None
    telefono: str | None = Field(None, pattern=r"^\+?[\d\s\-]{7,20}$")
    direccion: str | None = Field(None, min_length=5, max_length=255)
    referencia: str | None = Field(None, min_length=3, max_length=255)

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(...)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not any(c.isupper() for c in v):
            raise ValueError("La contraseña debe contener al menos una mayúscula")
        if not any(c.isdigit() for c in v):
            raise ValueError("La contraseña debe contener al menos un número")
        return v
