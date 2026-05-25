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
from app.infrastructure.database.models.usuarios import Usuario
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

        # user.rol is eagerly loaded via selectinload in the repository
        role_name = user.rol.nombre.value if user.rol else "CLIENTE"

        logger.info("auth.login.success", user_id=user.id_usuario, email=user.email)

        return TokenResponse(
            access_token=create_access_token(
                subject=str(user.id_usuario),
                role=role_name,
                extra={"email": user.email},
            ),
            refresh_token=create_refresh_token(subject=str(user.id_usuario)),
            expires_in=3600,
        )

    async def register(self, payload: RegisterRequest) -> RegisterResponse:
        if await self._repo.email_exists(payload.email):
            raise DuplicateResourceError(f"El email '{payload.email}' ya está registrado")

        # Fetch the CLIENTE role PK to assign it to the new user
        from sqlalchemy import select
        from app.infrastructure.database.models.usuarios import Rol
        from app.infrastructure.database.models.enums import TipoRolEnum

        # NOTE: We reach into the session via the repository's internal _session.
        # This is acceptable here because AuthService orchestrates the use case.
        stmt = select(Rol).where(Rol.nombre == TipoRolEnum.CLIENTE).limit(1)
        result = await self._repo._session.execute(stmt)  # type: ignore[attr-defined]
        rol_cliente = result.scalar_one_or_none()

        if rol_cliente is None:
            from app.core.exceptions import NotFoundError
            raise NotFoundError(
                "El rol CLIENTE no existe en la base de datos. "
                "Inserta los roles base antes de registrar usuarios."
            )

        new_user = Usuario(
            id_rol=rol_cliente.id_rol,
            nombres=payload.first_name,
            apellidos=payload.last_name,
            email=payload.email,
            password_hash=hash_password(payload.password),
            telefono=payload.phone,
            estado=True,
        )

        saved_user = await self._repo.create(new_user)

        logger.info("auth.register.success", user_id=saved_user.id_usuario, email=saved_user.email)

        return RegisterResponse(
            user_id=saved_user.id_usuario,
            email=saved_user.email,
        )

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

        role_name = user.rol.nombre.value if user.rol else "CLIENTE"

        return TokenResponse(
            access_token=create_access_token(
                subject=str(user.id_usuario),
                role=role_name,
                extra={"email": user.email},
            ),
            refresh_token=create_refresh_token(subject=str(user.id_usuario)),
            expires_in=3600,
        )
