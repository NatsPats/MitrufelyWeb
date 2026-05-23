"""
Mifrufely Web — Auth Service
Orchestrates authentication business logic.
No direct DB access — delegates to repository.
"""

import structlog

from app.core.exceptions import DuplicateResourceError, InvalidCredentialsError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.auth.repository import AbstractAuthRepository
from app.modules.auth.schemas import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
)

logger = structlog.get_logger(__name__)


class AuthService:
    """
    Authentication Service.
    Handles login, registration, and token refresh.
    All operations are async.
    """

    def __init__(self, repository: AbstractAuthRepository) -> None:
        self._repo = repository

    async def login(self, payload: LoginRequest) -> TokenResponse:
        user = await self._repo.get_by_email(payload.email)
        if not user or not verify_password(payload.password, user.password_hash):
            raise InvalidCredentialsError()

        logger.info("auth.login.success", user_id=user.id, email=user.email)

        return TokenResponse(
            access_token=create_access_token(
                subject=str(user.id),
                role=user.role,
                extra={"email": user.email},
            ),
            refresh_token=create_refresh_token(subject=str(user.id)),
            expires_in=3600,
        )

    async def register(self, payload: RegisterRequest) -> RegisterResponse:
        if await self._repo.email_exists(payload.email):
            raise DuplicateResourceError(f"El email '{payload.email}' ya está registrado")

        # TODO: Build ORM entity and persist via repository
        logger.info("auth.register.success", email=payload.email)

        # Placeholder — real implementation maps payload → ORM model
        raise NotImplementedError("Implementar mapeo de schema a modelo ORM")

    async def refresh(self, payload: RefreshTokenRequest) -> TokenResponse:
        token_data = decode_token(payload.refresh_token)

        if token_data.get("type") != "refresh":
            from app.core.exceptions import InvalidTokenError
            raise InvalidTokenError("Solo se aceptan refresh tokens")

        user_id = token_data["sub"]
        user = await self._repo.get_by_id(int(user_id))

        if not user:
            from app.core.exceptions import NotFoundError
            raise NotFoundError("Usuario no encontrado")

        return TokenResponse(
            access_token=create_access_token(
                subject=str(user.id),
                role=user.role,
                extra={"email": user.email},
            ),
            refresh_token=create_refresh_token(subject=str(user.id)),
            expires_in=3600,
        )
