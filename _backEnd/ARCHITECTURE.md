# Mifrufely Web — Backend Architecture & Conventions

## Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI 0.115 |
| Runtime | Python 3.11+ |
| Schemas | Pydantic v2 |
| ORM | SQLAlchemy 2.0 async |
| Database | PostgreSQL (NeonDB) via asyncpg |
| Cache | Redis 7 (async) |
| Queue | Celery + Redis Broker |
| Auth | JWT (HS256) via python-jose |
| Passwords | bcrypt via passlib |
| Logging | structlog (JSON) |
| Linting | Ruff + Black |
| Types | MyPy strict |
| Testing | Pytest + httpx |

---

## Directory Structure

```
_backEnd/
├── app/
│   ├── main.py                    # Application factory
│   ├── core/
│   │   ├── config.py              # Pydantic Settings (singleton)
│   │   ├── constants.py           # RBAC roles, permissions
│   │   ├── exceptions.py          # Domain exception hierarchy
│   │   ├── logging.py             # Structlog configuration
│   │   └── security.py            # JWT + bcrypt utilities
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── base.py            # SQLAlchemy DeclarativeBase
│   │   │   └── session.py         # Async engine + session factory
│   │   ├── cache/
│   │   │   └── redis_client.py    # Async Redis client
│   │   └── workers/
│   │       ├── celery_app.py      # Celery app + beat schedule
│   │       └── tasks/
│   │           ├── reports.py     # PDF/Excel generation tasks
│   │           ├── analytics.py   # Daily aggregation task
│   │           └── notifications.py
│   ├── middleware/
│   │   ├── exception_handler.py   # Centralized error → HTTP response
│   │   └── request_id.py          # X-Request-ID tracing
│   ├── security/
│   │   └── dependencies.py        # JWT auth + RBAC FastAPI deps
│   ├── domain/
│   │   ├── repositories/
│   │   │   └── base.py            # AbstractRepository[Model, PK]
│   │   └── services/
│   │       └── base.py            # AbstractService[Schema...]
│   ├── modules/                   # Feature modules (vertical slices)
│   │   ├── auth/
│   │   │   ├── router.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   ├── repository.py      # Abstract interface
│   │   │   └── dependencies.py    # DI wiring
│   │   ├── products/
│   │   ├── orders/
│   │   ├── inventory/
│   │   ├── cart/
│   │   ├── sweetcoins/
│   │   ├── reports/
│   │   ├── dashboard/
│   │   ├── users/
│   │   └── consultas/             # json.pe DNI/RUC lookup
│   ├── routers/
│   │   └── __init__.py            # api_router aggregator
│   └── shared/
│       ├── schemas/
│       │   ├── pagination.py      # PaginatedResponse[T]
│       │   └── response.py        # APIResponse[T], MessageResponse
│       └── external/              # Third-party HTTP clients
│           └── jsonpe/            # json.pe (DNI/RUC)
├── tests/
│   ├── conftest.py                # Shared fixtures
│   ├── unit/                      # Pure business logic tests
│   ├── integration/               # DB/Redis integration tests
│   └── e2e/                       # Full HTTP flow tests
├── scripts/
│   └── dev.sh                     # Developer CLI
├── .env.example
├── .gitignore
├── Dockerfile                     # Multi-stage build
├── docker-compose.yml             # Dev environment
├── pyproject.toml                 # Ruff + Black + MyPy + Pytest
├── render.yaml                    # Render.com IaC
├── requirements.txt
└── requirements-dev.txt
```

---

## Architectural Rules

### Layer Dependencies (strictly enforced)

```
Router → Service → Repository → Database
              ↓
           Schemas (Pydantic)
              ↓
           Core (config, exceptions, security)
```

**Violations forbidden:**
- Routers may NOT import repositories directly
- Services may NOT import SQLAlchemy session directly
- Repositories may NOT contain business logic
- Any layer may import from `core/` and `shared/`

### Module Structure (per feature)

Every module in `app/modules/<name>/` must contain:

| File | Responsibility |
|---|---|
| `router.py` | HTTP endpoints — thin, delegates to service |
| `schemas.py` | Pydantic v2 request/response contracts |
| `service.py` | Business logic orchestration |
| `repository.py` | Abstract data-access interface |
| `dependencies.py` | FastAPI DI wiring |

The concrete SQLAlchemy repository lives in `infrastructure/database/repositories/<name>.py` and is injected via `dependencies.py`.

---

## Naming Conventions

| Element | Convention | Example |
|---|---|---|
| Files | `snake_case` | `auth_service.py` |
| Classes | `PascalCase` | `AuthService` |
| Functions | `snake_case` | `get_current_user` |
| Variables | `snake_case` | `access_token` |
| Constants | `UPPER_SNAKE` | `ROLE_PERMISSIONS` |
| DB tables | `snake_case` | `pedido_detalle` |
| Pydantic models | `PascalCase` + suffix | `LoginRequest`, `TokenResponse` |
| Endpoints | kebab-case paths | `/api/v1/sweet-coins` |
| Test files | `test_<subject>.py` | `test_auth_service.py` |

---

## Response Envelope Standard

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "message": null
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Credenciales incorrectas"
  },
  "request_id": "uuid-v4"
}
```

**Paginated:**
```json
{
  "items": [...],
  "total": 150,
  "page": 2,
  "page_size": 20,
  "total_pages": 8
}
```

---

## Module Implementation Checklist

When implementing a new module:

- [ ] Create `app/modules/<name>/` directory with all 5 files
- [ ] Define Pydantic schemas (request + response)
- [ ] Define `Abstract<Name>Repository` extending `AbstractRepository`
- [ ] Implement `<Name>Service` depending only on the abstract repo
- [ ] Wire DI in `dependencies.py`
- [ ] Register router in `app/routers/__init__.py`
- [ ] Create `tests/unit/test_<name>_service.py`
- [ ] Later: implement `SQLAlchemy<Name>Repository` in `infrastructure/`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | NeonDB asyncpg connection string |
| `SECRET_KEY` | ✅ | Min 32 chars, random |
| `REDIS_URL` | For workers | Redis connection |
| `CELERY_BROKER_URL` | For tasks | Redis broker |
| All others | Optional | Have safe defaults |

---

## CI/CD Readiness

The project is structured for GitHub Actions / Render CI:

1. **Lint gate**: `ruff check` + `black --check` + `mypy`
2. **Test gate**: `pytest -m "unit or e2e"` (no DB needed)
3. **Build gate**: `docker build --target production`
4. **Deploy**: `render.yaml` drives Render.com deployment
