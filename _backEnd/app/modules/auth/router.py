"""
Mifrufely Web — Auth Router
FastAPI APIRouter for /auth endpoints
"""

from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.responses import ORJSONResponse

from app.modules.auth.dependencies import get_auth_service
from app.modules.auth.schemas import (
    LoginRequest,
    RefreshTokenRequest,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
)
from app.modules.auth.service import AuthService
from app.security.dependencies import AuthUser

router = APIRouter(prefix="/auth", tags=["Authentication"])

AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Iniciar sesión",
)
async def login(payload: LoginRequest, service: AuthServiceDep) -> TokenResponse:
    """Authenticate user and return JWT access + refresh tokens."""
    return await service.login(payload)


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar nuevo cliente",
)
async def register(
    payload: RegisterRequest,
    service: AuthServiceDep,
) -> RegisterResponse:
    """Create a new client account."""
    return await service.register(payload)


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Renovar access token",
)
async def refresh_token(
    payload: RefreshTokenRequest,
    service: AuthServiceDep,
) -> TokenResponse:
    """Exchange a valid refresh token for a new access token."""
    return await service.refresh(payload)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cerrar sesión",
)
async def logout(current_user: AuthUser) -> None:
    """
    Stateless logout — client must discard the token.
    Optionally add the token to a Redis blocklist here.
    """
    return None
