# SKILL 02 — Arquitectura Backend FastAPI (Clean Architecture)

> **CUÁNDO USAR:** Antes de crear cualquier módulo, router, service, repository o schema en el backend.

---

## 1. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | FastAPI 0.115 |
| Runtime | Python 3.11+ |
| ORM | SQLAlchemy 2.0 async |
| Schemas | Pydantic v2 |
| Driver DB | asyncpg (via NeonDB) |
| Auth | JWT HS256 (python-jose) |
| Passwords | bcrypt (passlib) |
| Logging | structlog (JSON) |
| Linting | Ruff + Black |
| Types | MyPy strict |

---

## 2. Flujo de Dependencias de Capas

```
Router (HTTP) → Service (Lógica) → Repository (Interfaz) → DB (SQLAlchemy)
                      ↓
                   Schemas (Pydantic v2)
                      ↓
                   Core (config, exceptions, security, constants)
```

**Reglas HARD:**
- Routers **NO** importan repositories directamente
- Services **NO** importan `AsyncSession` directamente
- Repositories **NO** contienen lógica de negocio
- Todos pueden importar de `core/` y `shared/`

---

## 3. Estructura de Directorios

```
app/
├── main.py                          # Application factory (create_application())
├── core/
│   ├── config.py                    # Settings (Pydantic Settings v2, @lru_cache singleton)
│   ├── constants.py                 # UserRole(StrEnum), Permission(StrEnum), ROLE_PERMISSIONS
│   ├── exceptions.py                # Jerarquía de excepciones de dominio
│   ├── logging.py                   # Structlog config (JSON output)
│   └── security.py                  # JWT (create_access_token, decode_token) + bcrypt
├── infrastructure/
│   ├── database/
│   │   ├── base.py                  # DeclarativeBase (AsyncAttrs)
│   │   ├── session.py               # async engine + AsyncSessionFactory + get_db()
│   │   └── repositories/            # Implementaciones SQLAlchemy concretas
│   │       └── <nombre>.py          # SQLAlchemy<Nombre>Repository
│   ├── cache/
│   │   └── redis_client.py          # Redis async client
│   └── workers/
│       ├── celery_app.py            # Celery app + beat schedule
│       └── tasks/
│           ├── reports.py           # PDF/Excel generation
│           ├── analytics.py         # Daily aggregation
│           └── notifications.py     # Email/WhatsApp
├── middleware/
│   ├── exception_handler.py         # MifrufelyBaseError → HTTPResponse
│   └── request_id.py                # X-Request-ID header
├── security/
│   └── dependencies.py             # FastAPI Depends: get_current_user, require_role
├── domain/
│   ├── repositories/
│   │   └── base.py                  # AbstractRepository[Model, PK] (ABC)
│   └── services/
│       └── base.py                  # AbstractService[...] (ABC)
├── modules/                         # Feature modules (vertical slices)
│   ├── auth/
│   ├── users/
│   ├── products/
│   ├── inventory/
│   ├── orders/
│   ├── cart/
│   ├── sweetcoins/
│   ├── reports/
│   └── dashboard/
├── routers/
│   └── __init__.py                  # api_router aggregator (include_router x módulo)
└── shared/
    └── schemas/
        ├── pagination.py            # PaginatedResponse[T]
        └── response.py              # APIResponse[T], MessageResponse
```

---

## 4. Estructura Obligatoria por Módulo

Cada módulo en `app/modules/<nombre>/` **DEBE** tener exactamente estos 5 archivos:

### `router.py`
- Solo endpoints HTTP. Thin layer. Delega 100% al service.
- Importa: `APIRouter`, schemas, `Depends` del módulo.
- **NO** contiene lógica de negocio.

```python
router = APIRouter(prefix="/<nombre>s", tags=["<Nombre>s"])

@router.get("/", response_model=PaginatedResponse[<Nombre>Response])
async def list_<nombre>s(
    service: Annotated[<Nombre>Service, Depends(get_<nombre>_service)],
    pagination: Annotated[PaginationParams, Depends()],
) -> PaginatedResponse[<Nombre>Response]:
    return await service.list_all(pagination)
```

### `schemas.py`
- Pydantic v2 request + response DTOs.
- Clases: `<Nombre>CreateRequest`, `<Nombre>UpdateRequest`, `<Nombre>Response`.
- Usar `model_config = ConfigDict(from_attributes=True)` en responses.

```python
class ProductResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_producto: int
    nombre: str
    precio: Decimal
    estado: bool
```

### `service.py`
- Lógica de negocio pura. Orquesta llamadas al repository.
- Recibe el **abstract** repository vía constructor (inyectado).
- Lanza excepciones de dominio (`NotFoundError`, `BusinessRuleError`, etc.).

```python
class ProductService:
    def __init__(self, repo: AbstractProductRepository) -> None:
        self._repo = repo

    async def get_by_id(self, product_id: int) -> ProductResponse:
        product = await self._repo.get_by_id(product_id)
        if product is None:
            raise NotFoundError(f"Producto {product_id} no encontrado")
        return ProductResponse.model_validate(product)
```

### `repository.py`
- **Interfaz abstracta** (ABC) que extiende `AbstractRepository`.
- Define los métodos de acceso a datos del dominio.
- La implementación concreta va en `infrastructure/database/repositories/<nombre>.py`.

```python
class AbstractProductRepository(AbstractRepository):
    @abstractmethod
    async def get_by_categoria(self, categoria_id: int) -> list[Any]: ...

    @abstractmethod
    async def search(self, query: str) -> list[Any]: ...
```

### `dependencies.py`
- Wiring de inyección de dependencias FastAPI.
- Instancia el repository concreto e inyecta en el service.

```python
async def get_product_service(
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ProductService:
    repo = SQLAlchemyProductRepository(session)
    return ProductService(repo)
```

---

## 5. AbstractRepository Base

```python
# app/domain/repositories/base.py
class AbstractRepository(ABC, Generic[ModelT, PkT]):
    @abstractmethod
    async def get_by_id(self, pk: PkT) -> ModelT | None: ...
    @abstractmethod
    async def get_all(self) -> list[ModelT]: ...
    @abstractmethod
    async def create(self, data: dict[str, Any]) -> ModelT: ...
    @abstractmethod
    async def update(self, pk: PkT, data: dict[str, Any]) -> ModelT | None: ...
    @abstractmethod
    async def delete(self, pk: PkT) -> bool: ...
```

---

## 6. Manejo de Excepciones de Dominio

Jerarquía en `app/core/exceptions.py`:

| Excepción | HTTP | error_code |
|---|---|---|
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `BusinessRuleError` | 422 | `BUSINESS_RULE_ERROR` |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` |
| `InvalidTokenError` | 401 | `INVALID_TOKEN` |
| `InvalidCredentialsError` | 401 | `INVALID_CREDENTIALS` |
| `ForbiddenError` | 403 | `FORBIDDEN` |
| `InsufficientRoleError` | 403 | `INSUFFICIENT_ROLE` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `DuplicateResourceError` | 409 | `DUPLICATE_RESOURCE` |
| `InsufficientStockError` | 422 | `INSUFFICIENT_STOCK` |
| `InsufficientSweetCoinsError` | 422 | `INSUFFICIENT_SWEETCOINS` |
| `DatabaseError` | 500 | `DATABASE_ERROR` |
| `ExternalServiceError` | 503 | `EXTERNAL_SERVICE_ERROR` |

**Al capturar excepciones de asyncpg** (RAISE EXCEPTION de triggers):
```python
except asyncpg.exceptions.RaiseException as e:
    if "Stock insuficiente" in str(e):
        raise InsufficientStockError(str(e))
    raise DatabaseError(str(e))
```

---

## 7. Settings (config.py)

Importar siempre como:
```python
from app.core.config import settings

settings.DATABASE_URL
settings.SECRET_KEY
settings.API_V1_PREFIX       # "/api/v1"
settings.ACCESS_TOKEN_EXPIRE_MINUTES  # 60
settings.REFRESH_TOKEN_EXPIRE_DAYS    # 30
settings.SWEETCOINS_CONVERSION_RATE   # 10
settings.SWEETCOINS_EXPIRY_DAYS       # 365
```

---

## 8. Logging — Structlog

```python
import structlog
logger = structlog.get_logger(__name__)

# Uso estándar (event.verb_noun, snake_case)
logger.info("user.login_success", user_id=user.id_usuario, role=user.role)
logger.warning("auth.invalid_token", error=str(exc))
logger.error("database.query_failed", table="ventas", error=str(exc))
```

---

## 9. Registro de Routers

En `app/routers/__init__.py`:
```python
api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(products_router, prefix="/products", tags=["Products"])
# ... etc
```

En `main.py`:
```python
application.include_router(api_router, prefix=settings.API_V1_PREFIX)
# Resultado: /api/v1/auth/..., /api/v1/products/...
```

---

## 10. Checklist de Implementación de Módulo

- [ ] `app/modules/<nombre>/` con los 5 archivos obligatorios
- [ ] Schemas Pydantic definidos (Request + Response)
- [ ] `Abstract<Nombre>Repository` extiende `AbstractRepository`
- [ ] `<Nombre>Service` depende solo del abstract repo
- [ ] `dependencies.py` conecta repo concreto → service
- [ ] Router registrado en `app/routers/__init__.py`
- [ ] `tests/unit/test_<nombre>_service.py` creado
- [ ] `SQLAlchemy<Nombre>Repository` en `infrastructure/database/repositories/`
