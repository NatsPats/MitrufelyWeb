"""
Mifrufely Web — Centralized Settings
Pydantic Settings v2 with full type safety and validation
"""

from functools import lru_cache
from typing import Literal

from pydantic import AnyUrl, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application-wide settings loaded from environment variables.
    All values are typed and validated by Pydantic v2.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
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
    ALLOWED_HEADERS: list[str] = ["*"]

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 300

    # ── Celery ────────────────────────────────────────────────────────────────
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

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

    # ── Validators ────────────────────────────────────────────────────────────
    @field_validator("ALLOWED_ORIGINS", "ALLOWED_METHODS", "ALLOWED_HEADERS", mode="before")
    @classmethod
    def parse_list_from_string(cls, value: str | list) -> list[str]:
        if isinstance(value, str):
            # Strip surrounding quotes that may come from .env files
            value = value.strip('"\'')
            return [item.strip() for item in value.split(",") if item.strip()]
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
