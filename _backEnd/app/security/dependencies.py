"""
Mifrufely Web — FastAPI Security Dependencies
JWT authentication + RBAC enforcement as FastAPI dependencies
"""

from typing import Annotated

import structlog
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.constants import Permission, ROLE_PERMISSIONS, UserRole
from app.core.exceptions import InsufficientRoleError, UnauthorizedError
from app.core.security import decode_token

logger = structlog.get_logger(__name__)

_bearer_scheme = HTTPBearer(auto_error=False)


class CurrentUser:
    """Value object representing the authenticated user extracted from JWT."""

    def __init__(self, user_id: int, email: str, role: UserRole) -> None:
        self.user_id = user_id
        self.email = email
        self.role = role

    def has_permission(self, permission: Permission) -> bool:
        return permission in ROLE_PERMISSIONS.get(self.role, set())

    def is_admin(self) -> bool:
        return self.role == UserRole.ADMIN

    def __repr__(self) -> str:
        return f"<CurrentUser id={self.user_id} role={self.role}>"


async def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(_bearer_scheme),
    ] = None,
) -> CurrentUser:
    """
    Extract and validate the JWT bearer token.
    Returns a CurrentUser value object.
    Raises UnauthorizedError if the token is missing or invalid.
    """
    if not credentials:
        raise UnauthorizedError("Token de autenticación requerido")

    payload = decode_token(credentials.credentials)

    user_id = payload.get("sub")
    role_str = payload.get("role")
    email = payload.get("email", "")

    if not user_id or not role_str:
        raise UnauthorizedError("Token malformado")

    try:
        role = UserRole(role_str)
    except ValueError:
        raise UnauthorizedError(f"Rol desconocido: {role_str}")

    return CurrentUser(user_id=int(user_id), email=email, role=role)


# ── Pre-built Role Dependencies ───────────────────────────────────────────────

async def require_admin(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    """Dependency that restricts the endpoint to admins only."""
    if not current_user.is_admin():
        raise InsufficientRoleError()
    return current_user


def require_permission(permission: Permission):
    """
    Dependency factory that restricts an endpoint to users with a specific permission.

    Usage:
        @router.get("/...", dependencies=[Depends(require_permission(Permission.REPORT_GENERATE))])
    """

    async def _check(
        current_user: Annotated[CurrentUser, Depends(get_current_user)],
    ) -> CurrentUser:
        if not current_user.has_permission(permission):
            raise InsufficientRoleError(
                f"Permiso requerido: {permission}"
            )
        return current_user

    return _check


# ── Type Aliases for Cleaner Endpoint Signatures ─────────────────────────────

AuthUser = Annotated[CurrentUser, Depends(get_current_user)]
AdminUser = Annotated[CurrentUser, Depends(require_admin)]
