"""
Mifrufely Web — Centralized Settings
Pydantic Settings v2 with full type safety and validation
"""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """
    Application-wide settings loaded from environment variables.
    All values are typed and validated by Pydantic v2.
    """

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "Mifrufely Web"
    APP_ENV: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    ADMIN_EMAIL_DOMAIN: str = "mitrufely.com"
    FRONTEND_URL: str = "http://localhost:5173"

    # ── Server ───────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1

    # ── Database (NeonDB / PostgreSQL) ────────────────────────────────────────
    DATABASE_URL: str = Field(..., description="PostgreSQL async connection string")
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_POOL_RECYCLE: int = 1800

    # ── JWT / Security ────────────────────────────────────────────────────────
    SECRET_KEY: str = Field(..., min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── CORS ─────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    ALLOWED_METHODS: list[str] = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    # Lista explícita de headers permitidos (no usar "*" con allow_credentials=True)
    ALLOWED_HEADERS: list[str] = ["Authorization", "Content-Type", "X-Request-ID", "Idempotency-Key"]

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://redis:6399/0"
    REDIS_CACHE_TTL: int = 300

    # ── Celery ────────────────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://redis:6399/1"
    CELERY_RESULT_BACKEND: str = "redis://redis:6399/2"

    # ── Logging ───────────────────────────────────────────────────────────────
    LOG_LEVEL: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    LOG_FORMAT: Literal["json", "console"] = "json"

    # ── SweetCoins ────────────────────────────────────────────────────────────
    SWEETCOINS_CONVERSION_RATE: int = 10
    SWEETCOINS_EXPIRY_DAYS: int = 365

    # ── Reports & PDF ─────────────────────────────────────────────────────────
    PDF_TEMP_DIR: str = "/tmp/mifrufely/pdf"
    REPORTS_TEMP_DIR: str = "/tmp/mifrufely/reports"

    # ── Render Deployment ─────────────────────────────────────────────────────
    RENDER_EXTERNAL_URL: str | None = None

    # ── Email / SMTP (Gmail) ──────────────────────────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: SecretStr = SecretStr("")  # Nunca se serializa en texto plano
    SMTP_FROM: str = ""

    # ── Google OAuth ──────────────────────────────────────────────────
    # Obtener en: https://console.cloud.google.com/ → APIs & Services → Credentials
    GOOGLE_CLIENT_ID: str = Field("", description="Google OAuth 2.0 Client ID")

    # ── Cloudinary ────────────────────────────────────────────────────────────
    CLOUDINARY_CLOUD_NAME: str | None = Field(None, description="Cloudinary Cloud Name")
    CLOUDINARY_API_KEY: str | None = Field(None, description="Cloudinary API Key")
    CLOUDINARY_API_SECRET: str | None = Field(None, description="Cloudinary API Secret")

    # ── JSON.PE (Consulta DNI / RUC) ──────────────────────────────────────────
    # Token obtenido en https://json.pe/ -> Dashboard. Vacío = modo degradado.
    JSONPE_API_TOKEN: SecretStr = Field(
        SecretStr(""),
        description="Token Bearer para api.json.pe (vacío = servicio deshabilitado).",
    )
    JSONPE_BASE_URL: str = Field(
        "https://api.json.pe",
        description="URL base del API externo de consulta.",
    )
    JSONPE_CACHE_TTL_SECONDS: int = Field(
        86400,
        description="TTL en segundos del cache Redis para consultas DNI/RUC (default 24h).",
    )
    JSONPE_TIMEOUT_SECONDS: float = Field(
        10.0,
        description="Timeout HTTP hacia json.pe en segundos.",
    )

    # ── Rate Limiting (Login) ─────────────────────────────────────────
    # Máximo de intentos fallidos de inicio de sesión por IP antes de bloquear
    LOGIN_RATE_LIMIT_ATTEMPTS: int = Field(5, description="Max failed login attempts per window")
    # Ventana de tiempo en segundos para el rate limit (default: 60 seg)
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: int = Field(60, description="Rate limit window in seconds")

    # ── Rate Limiting Global (slowapi) ───────────────────────────────
    # Límite por defecto aplicado a TODOS los endpoints vía slowapi.
    # Formato: "N per period" (ej. "100 per minute", "1000 per hour").
    RATE_LIMIT_DEFAULT: str = Field("120 per minute", description="Default rate limit for all endpoints")

    # ── Rate Limiting (Password Reset) ────────────────────────────────
    # Máximo de solicitudes de recuperación de contraseña por IP antes de bloquear
    PASSWORD_RESET_RATE_LIMIT_ATTEMPTS: int = Field(3, description="Max forgot-password requests per window")
    # Ventana de tiempo para el rate limit de recuperación (default: 1 hora)
    PASSWORD_RESET_RATE_LIMIT_WINDOW_SECONDS: int = Field(3600, description="Rate limit window in seconds")
    # Vigencia del token de restablecimiento de contraseña (default: 15 min)
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = Field(15, description="Password reset token validity (minutes)")

    # ── Validators ────────────────────────────────────────────────────────────
    @field_validator("ALLOWED_ORIGINS", "ALLOWED_METHODS", "ALLOWED_HEADERS", mode="before")
    @classmethod
    def parse_list_from_string(cls, value: str | list) -> list[str]:
        if isinstance(value, str):
            value = value.strip()
            # If it's a JSON array representation
            if value.startswith("[") and value.endswith("]"):
                import json
                try:
                    parsed = json.loads(value)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed]
                except json.JSONDecodeError:
                    pass
            # Fallback: strip outer quotes and square brackets, then split by comma
            value = value.strip('"\'[]')
            return [item.strip().strip('"\'') for item in value.split(",") if item.strip()]
        if isinstance(value, list):
            # Already a list — flatten if nested (pydantic-settings v2 edge case)
            result: list[str] = []
            for item in value:
                if isinstance(item, list):
                    result.extend(str(i).strip() for i in item)
                else:
                    result.append(str(item).strip())
            return result
        return list(value)

    @model_validator(mode="after")
    def validate_cloudinary_in_production(self) -> "Settings":
        if self.APP_ENV == "production":
            if not all([self.CLOUDINARY_CLOUD_NAME, self.CLOUDINARY_API_KEY, self.CLOUDINARY_API_SECRET]):
                raise ValueError("Las credenciales de Cloudinary (CLOUD_NAME, API_KEY, API_SECRET) son obligatorias en producción.")
        return self

    @model_validator(mode="after")
    def validate_cors_safety(self) -> "Settings":
        """
        Rechaza ALLOWED_ORIGINS=["*"] — con allow_credentials=True esto es
        un anti-patrón de seguridad (los navegadores lo rechazan, pero degrada
        silenciosamente). También advierte si DEBUG=True en producción.
        """
        if "*" in self.ALLOWED_ORIGINS:
            raise ValueError(
                "ALLOWED_ORIGINS no puede contener '*' cuando allow_credentials=True. "
                "Especifica los orígenes explícitamente."
            )
        if self.APP_ENV == "production" and self.DEBUG:
            import warnings

            warnings.warn(
                "DEBUG=True en producción expone /api/docs y /api/openapi.json. "
                "Considera establecer DEBUG=False o gatear los docs en APP_ENV.",
                stacklevel=2,
            )
        return self

    @property
    def expose_docs(self) -> bool:
        """
        Los docs de Swagger/OpenAPI se exponen solo en entornos no productivos.
        Antes se gated con DEBUG, lo que obligaba a DEBUG=true para ver los docs
        en staging — un side-effect no deseado. Ahora depende de APP_ENV.
        """
        return self.APP_ENV != "production"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"

    @property
    def is_development(self) -> bool:
        return self.APP_ENV == "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Cached settings instance — singleton pattern."""
    return Settings()  # type: ignore[call-arg]


settings: Settings = get_settings()
