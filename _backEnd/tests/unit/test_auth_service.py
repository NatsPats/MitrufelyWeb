"""
Mifrufely Web — Auth Service Unit Tests
Tests business logic in isolation (no real DB/Redis)
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from app.core.exceptions import DuplicateResourceError, InvalidCredentialsError
from app.core.security import hash_password
from app.modules.auth.schemas import LoginRequest, RegisterRequest
from app.modules.auth.service import AuthService


@pytest.mark.unit
class TestAuthService:

    @pytest.fixture
    def service(self, mock_auth_repo: AsyncMock) -> AuthService:
        return AuthService(repository=mock_auth_repo)

    async def test_login_invalid_credentials_raises(
        self,
        service: AuthService,
        mock_auth_repo: AsyncMock,
    ) -> None:
        mock_auth_repo.get_by_email.return_value = None

        with pytest.raises(InvalidCredentialsError):
            await service.login(
                LoginRequest(email="unknown@test.com", password="WrongPass1!")
            )

    async def test_login_wrong_password_raises(
        self,
        service: AuthService,
        mock_auth_repo: AsyncMock,
    ) -> None:
        fake_user = MagicMock()
        fake_user.id = 1
        fake_user.email = "user@test.com"
        fake_user.role = "cliente"
        fake_user.password_hash = hash_password("CorrectPass1!")
        mock_auth_repo.get_by_email.return_value = fake_user

        with pytest.raises(InvalidCredentialsError):
            await service.login(
                LoginRequest(email="user@test.com", password="WrongPass1!")
            )

    async def test_login_success_returns_tokens(
        self,
        service: AuthService,
        mock_auth_repo: AsyncMock,
    ) -> None:
        fake_user = MagicMock()
        fake_user.id = 1
        fake_user.email = "user@test.com"
        fake_user.role = "cliente"
        fake_user.password_hash = hash_password("Correct1!")
        mock_auth_repo.get_by_email.return_value = fake_user

        result = await service.login(
            LoginRequest(email="user@test.com", password="Correct1!")
        )

        assert result.access_token
        assert result.refresh_token
        assert result.token_type == "bearer"

    async def test_register_duplicate_email_raises(
        self,
        service: AuthService,
        mock_auth_repo: AsyncMock,
    ) -> None:
        mock_auth_repo.email_exists.return_value = True

        with pytest.raises(DuplicateResourceError):
            await service.register(
                RegisterRequest(
                    first_name="Juan",
                    last_name="Pérez",
                    email="existing@test.com",
                    password="ValidPass1!",
                )
            )
