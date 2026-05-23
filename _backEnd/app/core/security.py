"""
Mifrufely Web — Security Core
JWT creation/validation + Password hashing
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import structlog
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.exceptions import InvalidTokenError, UnauthorizedError

logger = structlog.get_logger(__name__)

# ── Password Hashing ──────────────────────────────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────


def _build_payload(
    subject: str,
    extra: dict[str, Any],
    expires_delta: timedelta,
) -> dict[str, Any]:
    now = datetime.now(tz=timezone.utc)
    return {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
        **extra,
    }


def create_access_token(
    subject: str,
    role: str,
    extra: dict[str, Any] | None = None,
) -> str:
    payload = _build_payload(
        subject=subject,
        extra={"role": role, "type": "access", **(extra or {})},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(subject: str) -> str:
    payload = _build_payload(
        subject=subject,
        extra={"type": "refresh"},
        expires_delta=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload: dict[str, Any] = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except JWTError as exc:
        logger.warning("jwt.decode_failed", error=str(exc))
        raise InvalidTokenError("Token inválido o expirado") from exc
