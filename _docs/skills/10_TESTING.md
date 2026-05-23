# SKILL 10 — Estrategia de Testing

> **CUÁNDO USAR:** Antes de escribir cualquier test unitario, de integración o E2E.

---

## 1. Stack de Testing

| Herramienta | Propósito |
|---|---|
| `pytest` | Test runner principal |
| `pytest-asyncio` | Soporte para tests async |
| `httpx` (AsyncClient) | HTTP client para tests E2E |
| `pytest-mock` | Mocking de dependencias |
| `factory-boy` | Factories de datos de prueba |
| `pytest-cov` | Coverage reports |

---

## 2. Estructura de Tests

```
tests/
├── conftest.py              # Fixtures globales (DB test, HTTP client, mocks)
├── unit/                    # Tests de servicios puros (sin DB real)
│   ├── test_auth_service.py
│   ├── test_product_service.py
│   ├── test_order_service.py
│   ├── test_inventory_service.py
│   └── test_sweetcoins_service.py
├── integration/             # Tests con DB real (asyncpg + PostgreSQL de test)
│   ├── test_auth_repo.py
│   ├── test_order_repo.py
│   └── test_inventory_repo.py
└── e2e/                     # Tests de flujos completos HTTP
    ├── test_auth_flow.py
    ├── test_checkout_flow.py
    └── test_sweetcoins_flow.py
```

---

## 3. conftest.py Global

```python
# tests/conftest.py
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock

from app.main import app


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest_asyncio.fixture
async def http_client() -> AsyncClient:
    """Cliente HTTP para tests E2E contra la app ASGI."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test"
    ) as client:
        yield client


@pytest.fixture
def mock_auth_repo() -> AsyncMock:
    """Mock del AbstractAuthRepository."""
    mock = AsyncMock()
    mock.get_by_email.return_value = None
    mock.email_exists.return_value = False
    return mock


@pytest.fixture
def mock_product_repo() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def mock_order_repo() -> AsyncMock:
    return AsyncMock()
```

---

## 4. Tests Unitarios — Patrón Estándar

Los tests unitarios **mockean el repository** y prueban solo la lógica del service.

```python
# tests/unit/test_auth_service.py
import pytest
from unittest.mock import AsyncMock, patch
from app.modules.auth.service import AuthService
from app.core.exceptions import InvalidCredentialsError, DuplicateResourceError


class TestAuthService:
    @pytest.fixture
    def service(self, mock_auth_repo: AsyncMock) -> AuthService:
        return AuthService(repo=mock_auth_repo)

    @pytest.mark.asyncio
    async def test_login_invalid_email(self, service: AuthService, mock_auth_repo: AsyncMock):
        mock_auth_repo.get_by_email.return_value = None
        with pytest.raises(InvalidCredentialsError):
            await service.login(email="no@existe.com", password="pass")

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, service: AuthService, mock_auth_repo: AsyncMock):
        mock_user = AsyncMock()
        mock_user.password_hash = "hashed_wrong"
        mock_user.estado = True
        mock_auth_repo.get_by_email.return_value = mock_user

        with patch("app.core.security.verify_password", return_value=False):
            with pytest.raises(InvalidCredentialsError):
                await service.login(email="user@test.com", password="wrong")

    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, service: AuthService, mock_auth_repo: AsyncMock):
        mock_auth_repo.email_exists.return_value = True
        with pytest.raises(DuplicateResourceError):
            await service.register(
                nombres="Juan",
                apellidos="Pérez",
                email="duplicado@test.com",
                password="secure123",
            )
```

---

## 5. Tests de Checkout (Flujo Crítico)

```python
# tests/unit/test_order_service.py
class TestOrderService:
    @pytest.mark.asyncio
    async def test_checkout_insufficient_stock(self, service, mock_product_repo):
        """El service debe lanzar InsufficientStockError si el trigger falla."""
        import asyncpg
        mock_product_repo.get_by_id.return_value = MagicMock(
            estado=True, stock_actual=2
        )
        # Simular que el trigger lanza RAISE EXCEPTION
        mock_detalle_repo.create.side_effect = asyncpg.exceptions.RaiseException(
            "Stock insuficiente para el producto 1. Disponible: 2, solicitado: 5"
        )
        with pytest.raises(InsufficientStockError):
            await service.checkout(
                request=CheckoutRequest(items=[{"id_producto": 1, "cantidad": 5, ...}]),
                cliente_id=1,
            )

    @pytest.mark.asyncio
    async def test_checkout_invalid_coupon_owner(self, service, mock_cupon_repo):
        """El service rechaza cupones de otro cliente."""
        mock_cupon_repo.get_by_id.return_value = MagicMock(
            id_cliente=99,  # ≠ cliente_id=1
            estado="DISPONIBLE",
        )
        with pytest.raises(ForbiddenError):
            await service.checkout(
                request=CheckoutRequest(id_cupon_cliente=5, ...),
                cliente_id=1,
            )
```

---

## 6. Tests E2E — Flujo de Auth

```python
# tests/e2e/test_auth_flow.py
class TestAuthFlow:
    @pytest.mark.asyncio
    async def test_register_and_login(self, http_client: AsyncClient):
        # Register
        response = await http_client.post("/api/v1/auth/register", json={
            "nombres": "Ana",
            "apellidos": "García",
            "email": "ana@test.com",
            "password": "SecurePass123!",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True

        # Login
        response = await http_client.post("/api/v1/auth/login", json={
            "email": "ana@test.com",
            "password": "SecurePass123!",
        })
        assert response.status_code == 200
        tokens = response.json()["data"]
        assert "access_token" in tokens
        assert "refresh_token" in tokens

    @pytest.mark.asyncio
    async def test_protected_endpoint_without_token(self, http_client: AsyncClient):
        response = await http_client.get("/api/v1/users/me/profile")
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "UNAUTHORIZED"
```

---

## 7. Markers de Pytest

```python
# pyproject.toml
[tool.pytest.ini_options]
markers = [
    "unit: Tests sin base de datos real",
    "integration: Tests con DB real (requieren PostgreSQL)",
    "e2e: Tests de flujo HTTP completo",
]
asyncio_mode = "auto"
```

```bash
# Ejecutar solo tests de unidad (CI rápido, sin DB)
pytest -m "unit" -v

# Ejecutar unit + e2e (sin DB real necesaria)
pytest -m "unit or e2e" -v

# Todos (requieren DB de test)
pytest -v --cov=app --cov-report=html
```

---

## 8. Convenciones de Naming

```python
# Formato: test_<acción>_<condición>_<resultado_esperado>
def test_login_invalid_email_raises_invalid_credentials(): ...
def test_checkout_insufficient_stock_raises_error(): ...
def test_register_duplicate_email_raises_conflict(): ...
def test_get_product_nonexistent_returns_not_found(): ...
```

---

## 9. Cobertura Mínima por Módulo

| Módulo | Cobertura mínima |
|---|---|
| `core/` | 95% |
| `modules/*/service.py` | 90% |
| `modules/*/schemas.py` | 80% |
| `security/dependencies.py` | 90% |
| `infrastructure/` | 70% |
