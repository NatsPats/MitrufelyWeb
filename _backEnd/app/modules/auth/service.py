"""
Mifrufely Web — Auth Service
Orchestrates authentication business logic.
No direct DB access — delegates to repository.
"""

from fastapi import BackgroundTasks
import structlog
from redis.asyncio import Redis

from app.core.exceptions import (
    BusinessRuleError,
    DuplicateResourceError,
    ExternalServiceError,
    InvalidCredentialsError,
    InvalidTokenError,
    NotFoundError,
    UnauthorizedError,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.infrastructure.database.models.enums import AuthProviderEnum
from app.infrastructure.database.models.usuarios import Usuario
from app.modules.auth.repository import AbstractAuthRepository
from app.modules.auth.schemas import (
    GoogleLoginRequest,
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
)

logger = structlog.get_logger(__name__)


# ── Google Token Verification ─────────────────────────────────────────────────


async def _verify_google_token(id_token: str, client_id: str) -> dict:
    """
    Valida el ID Token de Google contra el endpoint público de tokeninfo.
    Retorna el payload con los datos del usuario si el token es válido.

    Args:
        id_token: El JWT devuelto por Google Identity Services en el frontend.
        client_id: Nuestro GOOGLE_CLIENT_ID configurado en settings.

    Raises:
        ExternalServiceError: Si el servidor de Google no responde correctamente.
        InvalidTokenError: Si el token es inválido, expirado o de otro cliente.
    """
    import httpx

    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={id_token}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
    except httpx.RequestError as exc:
        logger.error("auth.google.network_error", error=str(exc))
        raise ExternalServiceError("No se pudo contactar con los servidores de Google") from exc

    if response.status_code != 200:
        logger.warning("auth.google.invalid_token", status=response.status_code)
        raise InvalidTokenError("Token de Google inválido o expirado")

    token_info: dict = response.json()

    # Rechazar si el servidor no tiene configurado el Client ID (misconfiguration segura)
    if not client_id:
        logger.error("auth.google.client_id_not_configured")
        raise ExternalServiceError(
            "La autenticación con Google no está habilitada en este servidor"
        )

    # Verificar que el token pertenezca a nuestra aplicación (evita ataques de confusión)
    audience = token_info.get("aud", "")
    if audience != client_id:
        logger.warning(
            "auth.google.audience_mismatch",
            expected=client_id,
            received=audience,
        )
        raise InvalidTokenError("El token de Google no corresponde a esta aplicación")

    # Verificar que el correo esté verificado por Google
    if token_info.get("email_verified") not in ("true", True):
        raise InvalidTokenError("El correo de Google no está verificado")

    return token_info


# ── Auth Service ──────────────────────────────────────────────────────────────


class AuthService:
    """
    Authentication Service.
    Handles login, registration, token refresh, and Google OAuth.
    All operations are async.
    """

    def __init__(self, repository: AbstractAuthRepository, redis: Redis) -> None:
        self._repo = repository
        self._redis = redis

    async def login(self, payload: LoginRequest) -> TokenResponse:
        user = await self._repo.get_by_email(payload.email)
        if not user or not user.password_hash:
            raise InvalidCredentialsError()

        if not verify_password(payload.password, user.password_hash):
            raise InvalidCredentialsError()

        # Reject unverified accounts (estado=False means pending email verification)
        if not user.estado:
            raise UnauthorizedError(
                "Cuenta no verificada. Revisa tu correo electrónico para activar tu cuenta."
            )

        # Bloquear intento de login con contraseña si la cuenta es de Google
        if user.auth_provider == AuthProviderEnum.GOOGLE.value:
            raise InvalidCredentialsError(
                "Esta cuenta fue creada con Google. Inicia sesión con el botón de Google."
            )

        # user.rol is eagerly loaded via selectinload in the repository
        role_name = user.rol.nombre.value if user.rol else "CLIENTE"

        logger.info("auth.login.success", user_id=user.id_usuario, email=user.email)

        return TokenResponse(
            access_token=create_access_token(
                subject=str(user.id_usuario),
                role=role_name,
                extra={
                    "email": user.email,
                    "nombres": user.nombres,
                    "apellidos": user.apellidos,
                },
            ),
            refresh_token=create_refresh_token(subject=str(user.id_usuario)),
            expires_in=3600,
        )

    async def register(
        self,
        payload: RegisterRequest,
        background_tasks: BackgroundTasks,
    ) -> RegisterResponse:
        if await self._repo.email_exists(payload.email):
            raise DuplicateResourceError(f"El email '{payload.email}' ya está registrado")

        # Fetch the dynamic role to assign to the new user
        from sqlalchemy import select
        from app.infrastructure.database.models.usuarios import Rol, Cliente
        from app.infrastructure.database.models.enums import TipoRolEnum
        from app.core.config import settings

        # Determinar rol dinámicamente según dominio
        is_admin = payload.email.lower().endswith(f"@{settings.ADMIN_EMAIL_DOMAIN.lower()}")
        target_role = TipoRolEnum.ADMIN if is_admin else TipoRolEnum.CLIENTE

        # NOTE: We reach into the session via the repository's internal _session.
        stmt = select(Rol).where(Rol.nombre == target_role).limit(1)
        result = await self._repo._session.execute(stmt)  # type: ignore[attr-defined]
        rol_db = result.scalar_one_or_none()

        if rol_db is None:
            raise NotFoundError(
                f"El rol {target_role.value} no existe en la base de datos. "
                "Inserta los roles base antes de registrar usuarios."
            )

        new_user = Usuario(
            id_rol=rol_db.id_rol,
            nombres=payload.first_name,
            apellidos=payload.last_name,
            email=payload.email,
            password_hash=hash_password(payload.password),
            telefono=payload.phone,
            estado=True if is_admin else False,
            auth_provider=AuthProviderEnum.LOCAL.value,
        )

        # Si el rol es CLIENTE, creamos atómicamente su perfil extendido
        if target_role == TipoRolEnum.CLIENTE:
            new_user.cliente = Cliente(
                direccion=None,
                referencia=None,
            )

        saved_user = await self._repo.create(new_user)

        logger.info(
            "auth.register.success",
            user_id=saved_user.id_usuario,
            email=saved_user.email,
            role=target_role.value,
        )

        # Si requiere verificación (rol CLIENTE), enviar correo de confirmación en segundo plano
        if target_role == TipoRolEnum.CLIENTE:
            from app.core.security import create_verification_token
            from app.infrastructure.email.service import EmailService

            verification_token = create_verification_token(str(saved_user.id_usuario))
            background_tasks.add_task(
                EmailService.send_verification_email,
                to_email=saved_user.email,
                token=verification_token,
                user_name=f"{saved_user.nombres} {saved_user.apellidos}",
            )

        return RegisterResponse(
            user_id=saved_user.id_usuario,
            email=saved_user.email,
        )

    async def login_or_register_with_google(self, payload: GoogleLoginRequest) -> TokenResponse:
        """
        Flujo de autenticación con Google OAuth2.

        Comportamiento:
        - Si el token de Google es válido, extrae el perfil del usuario.
        - Si el usuario YA existe (mismo email o google_sub): inicia sesión directamente.
        - Si el usuario NO existe: lo registra automáticamente con estado=True
          (Google ya verificó el correo, no se requiere email de confirmación).
        - Devuelve nuestros propios tokens JWT (access + refresh).
        """
        from app.core.config import settings
        from sqlalchemy import select
        from app.infrastructure.database.models.usuarios import Rol, Cliente
        from app.infrastructure.database.models.enums import TipoRolEnum

        # 1. Verificar el ID Token con Google
        google_info = await _verify_google_token(payload.id_token, settings.GOOGLE_CLIENT_ID)

        email: str = google_info.get("email", "")
        google_sub: str = google_info.get("sub", "")
        first_name: str = google_info.get("given_name", "Usuario")
        last_name: str = google_info.get("family_name", "Google")

        if not email or not google_sub:
            raise InvalidTokenError("El token de Google no contiene email o sub válido")

        # 2. Buscar usuario existente por email
        user = await self._repo.get_by_email(email)

        if user:
            # 2a. Actualizar google_sub si aún no lo tiene (vinculación de cuenta)
            if user.google_sub is None:
                user.google_sub = google_sub
                user.auth_provider = AuthProviderEnum.GOOGLE.value
                # Activar cuenta si estaba pendiente de verificación
                if not user.estado:
                    user.estado = True
                user = await self._repo.update(user)
                logger.info(
                    "auth.google.account_linked",
                    user_id=user.id_usuario,
                    email=user.email,
                )
            else:
                logger.info(
                    "auth.google.login.success",
                    user_id=user.id_usuario,
                    email=user.email,
                )
        else:
            # 3. Registrar nuevo usuario con Google
            stmt = select(Rol).where(Rol.nombre == TipoRolEnum.CLIENTE).limit(1)
            result = await self._repo._session.execute(stmt)  # type: ignore[attr-defined]
            rol_db = result.scalar_one_or_none()

            if rol_db is None:
                raise NotFoundError("El rol CLIENTE no está inicializado en la base de datos.")

            user = Usuario(
                id_rol=rol_db.id_rol,
                nombres=first_name,
                apellidos=last_name,
                email=email,
                password_hash=None,  # Sin contraseña local — autenticación vía Google
                telefono=None,
                estado=True,  # Google ya verificó el correo del usuario
                auth_provider=AuthProviderEnum.GOOGLE.value,
                google_sub=google_sub,
            )
            # Crear perfil de cliente en la misma transacción
            user.cliente = Cliente(direccion=None, referencia=None)

            user = await self._repo.create(user)

            logger.info(
                "auth.google.register.success",
                user_id=user.id_usuario,
                email=user.email,
            )

        # 4. Emitir tokens JWT propios del sistema
        role_name = user.rol.nombre.value if user.rol else "CLIENTE"

        return TokenResponse(
            access_token=create_access_token(
                subject=str(user.id_usuario),
                role=role_name,
                extra={
                    "email": user.email,
                    "nombres": user.nombres,
                    "apellidos": user.apellidos,
                },
            ),
            refresh_token=create_refresh_token(subject=str(user.id_usuario)),
            expires_in=3600,
        )

    async def refresh(self, payload: RefreshTokenRequest) -> TokenResponse:
        """
        Renueva el access token usando un refresh token válido.

        Implementa Refresh Token Rotation (RTR):
        - El JTI del token usado se registra en Redis como consumido.
        - Si el mismo JTI se intenta usar de nuevo, es detectado como replay attack.
        - Se emite siempre un par de tokens completamente nuevo.
        """
        from datetime import datetime, timezone

        token_data = decode_token(payload.refresh_token)

        if token_data.get("type") != "refresh":
            raise InvalidTokenError("Solo se aceptan refresh tokens")

        jti = token_data.get("jti")
        if jti:
            # Verificar que este JTI no haya sido usado ya (replay attack)
            redis_key = f"rt_used:{jti}"
            already_used = await self._redis.exists(redis_key)
            if already_used:
                logger.warning(
                    "auth.refresh.replay_attack_detected",
                    jti=jti,
                    user_id=token_data.get("sub"),
                )
                raise InvalidTokenError(
                    "El refresh token ya fue utilizado. Por seguridad, inicia sesión nuevamente."
                )

            # Marcar este JTI como consumido en Redis con TTL = tiempo restante del token
            exp = token_data.get("exp", 0)
            remaining_ttl = int(exp - datetime.now(tz=timezone.utc).timestamp())
            if remaining_ttl > 0:
                await self._redis.setex(redis_key, remaining_ttl, "used")

        user_id = token_data["sub"]
        user = await self._repo.get_by_id(int(user_id))

        if not user:
            raise NotFoundError("Usuario no encontrado")

        role_name = user.rol.nombre.value if user.rol else "CLIENTE"

        logger.info("auth.refresh.success", user_id=user.id_usuario)

        return TokenResponse(
            access_token=create_access_token(
                subject=str(user.id_usuario),
                role=role_name,
                extra={
                    "email": user.email,
                    "nombres": user.nombres,
                    "apellidos": user.apellidos,
                },
            ),
            refresh_token=create_refresh_token(subject=str(user.id_usuario)),
            expires_in=3600,
        )

    async def verify_email(self, token: str) -> None:
        """
        Validates the verification token and activates the user account.
        All DB changes are flushed.
        """
        token_data = decode_token(token)

        if token_data.get("type") != "verification":
            raise InvalidTokenError("Token inválido para verificación de cuenta")

        user_id = token_data["sub"]
        user = await self._repo.get_by_id(int(user_id))

        if not user:
            raise NotFoundError("Usuario no encontrado")

        if user.estado:
            # Already active
            return

        # Activate the user
        user.estado = True
        await self._repo.update(user)
        logger.info("auth.verification.success", user_id=user.id_usuario, email=user.email)

    async def get_me(self, user_id: int) -> Usuario:
        """
        Retrieve the current user by ID.
        Eagerly loads Rol via selectinload in the repository.
        """
        user = await self._repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("Usuario no encontrado")
        return user

    async def get_datos_fiscales(self, user_id: int):
        """
        Obtiene los datos fiscales predeterminados del usuario.
        Retorna None si no tiene ninguno.
        """
        from app.infrastructure.database.models.usuarios import DatosFiscales
        from sqlalchemy import select
        from sqlalchemy.orm import selectinload

        user = await self._repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("Usuario no encontrado")

        stmt = select(DatosFiscales).where(
            DatosFiscales.id_usuario == user_id,
            DatosFiscales.es_predeterminado == True,
        )
        result = await self._repo._session.execute(stmt)
        return result.scalar_one_or_none()

    async def upsert_datos_fiscales(self, user_id: int, data):
        """
        Crea o actualiza los datos fiscales del usuario.
        Marca el registro como predeterminado.
        """
        from app.infrastructure.database.models.usuarios import DatosFiscales
        from sqlalchemy import select, update

        user = await self._repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("Usuario no encontrado")

        # Validar si el número de documento ya está registrado por otro usuario
        stmt_dup = select(DatosFiscales).where(
            DatosFiscales.numero_documento == data.numero_documento,
            DatosFiscales.id_usuario != user_id
        )
        res_dup = await self._repo._session.execute(stmt_dup)
        if res_dup.scalar_one_or_none():
            raise BusinessRuleError("Este número de documento ya está registrado por otro usuario en el sistema.")

        # Buscar si ya existe un registro predeterminado
        stmt = select(DatosFiscales).where(
            DatosFiscales.id_usuario == user_id,
            DatosFiscales.es_predeterminado == True,
        )
        result = await self._repo._session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            existing.tipo_documento = data.tipo_documento
            existing.numero_documento = data.numero_documento
            existing.razon_social = data.razon_social
            existing.direccion_fiscal = data.direccion_fiscal
            await self._repo._session.flush()
            await self._repo._session.refresh(existing)
            return existing
        else:
            nuevo = DatosFiscales(
                id_usuario=user_id,
                tipo_documento=data.tipo_documento,
                numero_documento=data.numero_documento,
                razon_social=data.razon_social,
                direccion_fiscal=data.direccion_fiscal,
                es_predeterminado=True,
            )
            self._repo._session.add(nuevo)
            await self._repo._session.flush()
            await self._repo._session.refresh(nuevo)
            return nuevo

    async def update_me(self, user_id: int, data):
        """
        Actualiza teléfono, dirección y referencia del usuario autenticado.
        """
        from sqlalchemy import select
        from app.infrastructure.database.models.usuarios import Cliente

        user = await self._repo.get_by_id(user_id)
        if not user:
            raise NotFoundError("Usuario no encontrado")

        if data.telefono is not None:
            user.telefono = data.telefono

        # Buscar o crear cliente
        stmt = select(Cliente).where(Cliente.id_usuario == user_id)
        result = await self._repo._session.execute(stmt)
        cliente = result.scalar_one_or_none()

        if not cliente:
            cliente = Cliente(id_usuario=user_id)
            self._repo._session.add(cliente)

        if data.direccion is not None:
            cliente.direccion = data.direccion
        if data.referencia is not None:
            cliente.referencia = data.referencia
        if data.telefono is not None:
            cliente.telefono = data.telefono

        await self._repo._session.flush()
        return user
