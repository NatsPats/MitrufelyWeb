# json.pe DNI/RUC Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow clients to look up their DNI/RUC data via json.pe from the profile page and the checkout modal, with caching and a "no-overwrite-without-save" flow.

**Architecture:** Backend-only token (`JSONPE_API_TOKEN` in `.env`). A pure HTTP `JsonPeClient` lives in `app/shared/external/jsonpe/`. A new `consultas` module exposes `POST /api/v1/consultas/documento` that checks Redis cache, falls back to the API, normalizes the response, and never persists — saving happens via existing `/auth/me/datos-fiscales` and `/auth/me` endpoints. Frontend adds a `DatosFiscalesSection` to `ProfileInfoPage` and a "Consultar" button to `PaymentModal`.

**Tech Stack:** FastAPI, httpx, Pydantic v2, SQLAlchemy 2.0 async, Redis, slowapi, pytest | React, Vite, TanStack Query, Zod, react-hook-form, Tailwind.

**Spec:** `docs/superpowers/specs/2026-07-19-jsonpe-dni-ruc-design.md`

---

## File Structure

### Backend — new files

| Path | Responsibility |
|---|---|
| `_backEnd/app/shared/external/__init__.py` | Package marker |
| `_backEnd/app/shared/external/jsonpe/__init__.py` | Package marker, exports `JsonPeClient` |
| `_backEnd/app/shared/external/jsonpe/schemas.py` | Pydantic models mirroring json.pe responses |
| `_backEnd/app/shared/external/jsonpe/exceptions.py` | `JsonPeError`, `JsonPeUnavailable`, `JsonPeNotFound` |
| `_backEnd/app/shared/external/jsonpe/client.py` | `JsonPeClient` — httpx wrapper, Bearer token |
| `_backEnd/app/shared/external/jsonpe/dependencies.py` | `get_jsonpe_client` (FastAPI DI) |
| `_backEnd/app/modules/consultas/__init__.py` | Package marker |
| `_backEnd/app/modules/consultas/schemas.py` | `DocumentoLookupRequest`, `DocumentoLookupResult` |
| `_backEnd/app/modules/consultas/service.py` | `ConsultasService` (validate → BD check → cache → API → normalize) |
| `_backEnd/app/modules/consultas/dependencies.py` | `get_consultas_service` (FastAPI DI) |
| `_backEnd/app/modules/consultas/router.py` | `POST /consultas/documento` |
| `_backEnd/tests/unit/test_jsonpe_client.py` | Client unit tests (httpx mocked) |
| `_backEnd/tests/unit/test_consultas_service.py` | Service unit tests (cache + BD + normalize) |
| `_backEnd/tests/integration/test_consultas_router.py` | Endpoint tests with Redis mock |

### Backend — modified files

| Path | Change |
|---|---|
| `_backEnd/app/core/config.py` | Add `JSONPE_*` settings |
| `_backEnd/app/routers/__init__.py` | Register `consultas_router` |

### Frontend — new files

| Path | Responsibility |
|---|---|
| `_frontEnd/src/features/consultas/types.ts` | TS interfaces for request/result |
| `_frontEnd/src/features/consultas/api/consultasApi.ts` | `lookupDocumento(tipo, numero)` |
| `_frontEnd/src/features/consultas/hooks/useConsultarDocumento.ts` | `useMutation` TanStack |
| `_frontEnd/src/features/profile/components/DatosFiscalesSection.tsx` | Datos fiscales section for profile |

### Frontend — modified files

| Path | Change |
|---|---|
| `_frontEnd/src/features/profile/pages/ProfileInfoPage.tsx` | Mount `<DatosFiscalesSection />` below the personal form |
| `_frontEnd/src/features/cart/components/PaymentModal.tsx` | Add "Consultar" button in Step 1, "Usar dirección fiscal como envío" banner in Step 2 |

---

## Task 1: Add JSONPE settings to config

**Files:**
- Modify: `_backEnd/app/core/config.py` (after Cloudinary block, before Rate Limiting block)

- [ ] **Step 1: Locate insertion point**

Find the Cloudinary fields in `_backEnd/app/core/config.py` (around line 98-100) which currently ends with:

```python
    CLOUDINARY_API_SECRET: str | None = Field(None, description="Cloudinary API Secret")
```

- [ ] **Step 2: Add JSONPE settings after the Cloudinary block**

Insert immediately after the `CLOUDINARY_API_SECRET` line:

```python
    # ── JSON.PE (Consulta DNI / RUC) ──────────────────────────────────────────
    # Token obtenido en https://json.pe/ -> Dashboard. Vacío = modo degradado.
    JSONPE_API_TOKEN: SecretStr = Field(
        SecretStr(""),
        description="Token Bearer para api.json.pe (vacío = servicio deshabilitado).",
    )
    JSONPE_BASE_URL: str = Field(
        "https://api.json.pe",
        description="URL base del API externo de consulta.",
    )
    JSONPE_CACHE_TTL_SECONDS: int = Field(
        86400,
        description="TTL en segundos del cache Redis para consultas DNI/RUC (default 24h).",
    )
    JSONPE_TIMEOUT_SECONDS: float = Field(
        10.0,
        description="Timeout HTTP hacia json.pe en segundos.",
    )
```

- [ ] **Step 3: Verify config loads**

Run from `_backEnd/`:

```bash
python -c "from app.core.config import settings; print('token=', settings.JSONPE_API_TOKEN.get_secret_value()); print('url=', settings.JSONPE_BASE_URL); print('ttl=', settings.JSONPE_CACHE_TTL_SECONDS); print('timeout=', settings.JSONPE_TIMEOUT_SECONDS)"
```

Expected: prints `token= ` (empty since you'll fill it in `.env`), `url= https://api.json.pe`, `ttl= 86400`, `timeout= 10.0`.

- [ ] **Step 4: Commit**

```bash
git add _backEnd/app/core/config.py
git commit -m "feat(config): add JSONPE_* settings for json.pe integration"
```

---

## Task 2: Create jsonpe package skeleton + schemas

**Files:**
- Create: `_backEnd/app/shared/external/__init__.py`
- Create: `_backEnd/app/shared/external/jsonpe/__init__.py`
- Create: `_backEnd/app/shared/external/jsonpe/schemas.py`
- Create: `_backEnd/app/shared/external/jsonpe/exceptions.py`

- [ ] **Step 1: Create the `shared/external` package**

Create `_backEnd/app/shared/external/__init__.py` with content:

```python
"""External third-party integrations (HTTP clients, webhooks, etc.)."""
```

- [ ] **Step 2: Create `jsonpe/schemas.py`**

Create `_backEnd/app/shared/external/jsonpe/schemas.py`:

```python
"""
Mifrufely Web — json.pe API Schemas
Espejo exacto de los payloads devueltos por api.json.pe.
Documentación: https://docs.json.pe/api-consulta/
"""

from typing import Generic, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class JsonPeEnvelope(BaseModel, Generic[T]):
    """Envelope estándar de json.pe: {success, message, data}."""

    success: bool
    message: str
    data: Optional[T] = None


class JsonPeDniData(BaseModel):
    """Respuesta de POST /api/dni."""

    numero: Optional[str] = None
    nombres: Optional[str] = None
    apellido_paterno: Optional[str] = None
    apellido_materno: Optional[str] = None
    nombre_completo: Optional[str] = None
    direccion: Optional[str] = None
    direccion_completa: Optional[str] = None
    ubigeo_reniec: Optional[str] = None
    ubigeo_sunat: Optional[str] = None


class JsonPeRucData(BaseModel):
    """Respuesta de POST /api/ruc."""

    ruc: Optional[str] = None
    nombre_o_razon_social: Optional[str] = None
    estado: Optional[str] = None
    condicion: Optional[str] = None
    direccion: Optional[str] = None
    direccion_completa: Optional[str] = None
    distrito: Optional[str] = None
    provincia: Optional[str] = None
    departamento: Optional[str] = None
    ubigeo_sunat: Optional[str] = None


class JsonPeDniRucData(BaseModel):
    """Respuesta de POST /api/dni-ruc (verifica si un DNI tiene RUC)."""

    ruc: Optional[str] = Field(None, description="RUC asociado al DNI, si existe.")
```

- [ ] **Step 3: Create `jsonpe/exceptions.py`**

Create `_backEnd/app/shared/external/jsonpe/exceptions.py`:

```python
"""
Mitrufely Web — json.pe Exception Hierarchy
Excepciones específicas del cliente de json.pe. Son traducidas a HTTP
por el service/router mediante MifrufelyBaseError.
"""

from http import HTTPStatus


class JsonPeError(Exception):
    """Base de la jerarquía de errores de json.pe."""

    def __init__(self, message: str, *, status_code: int = HTTPStatus.BAD_GATEWAY) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class JsonPeUnavailable(JsonPeError):
    """El servicio externo no está disponible (timeout, 5xx, sin token)."""

    def __init__(self, message: str = "Servicio externo no disponible.") -> None:
        super().__init__(message, status_code=HTTPStatus.SERVICE_UNAVAILABLE)


class JsonPeNotFound(JsonPeError):
    """El documento consultado no existe en RENIEC/SUNAT (HTTP 404 del API)."""

    def __init__(self, message: str = "Documento no encontrado.") -> None:
        super().__init__(message, status_code=HTTPStatus.NOT_FOUND)


class JsonPeTimeout(JsonPeError):
    """El servicio externo tardó demasiado en responder."""

    def __init__(self, message: str = "El servicio de consulta tardó demasiado.") -> None:
        super().__init__(message, status_code=HTTPStatus.GATEWAY_TIMEOUT)
```

- [ ] **Step 4: Create `jsonpe/__init__.py`**

Create `_backEnd/app/shared/external/jsonpe/__init__.py`:

```python
"""
json.pe integration client.
Documentación: https://docs.json.pe/
"""

from app.shared.external.jsonpe.client import JsonPeClient
from app.shared.external.jsonpe.exceptions import (
    JsonPeError,
    JsonPeNotFound,
    JsonPeTimeout,
    JsonPeUnavailable,
)

__all__ = [
    "JsonPeClient",
    "JsonPeError",
    "JsonPeNotFound",
    "JsonPeTimeout",
    "JsonPeUnavailable",
]
```

Note: this will fail to import until Task 3 creates `client.py`. That's expected; we'll verify in Task 3.

- [ ] **Step 5: Commit**

```bash
git add _backEnd/app/shared/external/
git commit -m "feat(jsonpe): add package skeleton, schemas and exceptions"
```

---

## Task 3: Implement `JsonPeClient` with TDD

**Files:**
- Test: `_backEnd/tests/unit/test_jsonpe_client.py`
- Create: `_backEnd/app/shared/external/jsonpe/client.py`

- [ ] **Step 1: Write failing tests for the client**

Create `_backEnd/tests/unit/test_jsonpe_client.py`:

```python
"""
Mitrufely Web — JsonPeClient Unit Tests
Valida el cliente HTTP puro (sin Redis/DB), mockeando httpx.AsyncClient.
"""

from typing import Any

import httpx
import pytest
from pydantic import SecretStr
from unittest.mock import AsyncMock, patch

from app.shared.external.jsonpe.client import JsonPeClient
from app.shared.external.jsonpe.exceptions import (
    JsonPeNotFound,
    JsonPeTimeout,
    JsonPeUnavailable,
)


@pytest.mark.unit
class TestJsonPeClient:

    def _client(self, token: str = "tok-123") -> JsonPeClient:
        return JsonPeClient(
            base_url="https://api.json.pe",
            token=SecretStr(token),
            timeout=5.0,
        )

    async def test_consultar_dni_success(self) -> None:
        client = self._client()
        payload: dict[str, Any] = {
            "success": True,
            "message": "exito",
            "data": {
                "numero": "27427864",
                "nombres": "JOSE PEDRO",
                "apellido_paterno": "CASTILLO",
                "apellido_materno": "TERRONES",
                "nombre_completo": "CASTILLO TERRONES, JOSE PEDRO",
                "direccion": "",
                "direccion_completa": "",
            },
        }
        mock_resp = httpx.Response(200, json=payload)
        with patch.object(httpx.AsyncClient, "post", new=AsyncMock(return_value=mock_resp)):
            result = await client.consultar_dni("27427864")

        assert result.nombres == "JOSE PEDRO"
        assert result.apellido_paterno == "CASTILLO"
        assert result.apellido_materno == "TERRONES"

    async def test_consultar_ruc_success(self) -> None:
        client = self._client()
        payload: dict[str, Any] = {
            "success": True,
            "message": "exito",
            "data": {
                "ruc": "20552103816",
                "nombre_o_razon_social": "AGROLIGHT PERU S.A.C.",
                "estado": "HABIDO",
                "condicion": "HABIDO",
                "direccion": "PJ. JORGE BASADRE 158",
                "direccion_completa": "PJ. JORGE BASADRE 158, LIMA - SANTA ANITA",
                "distrito": "SANTA ANITA",
                "provincia": "LIMA",
                "departamento": "LIMA",
            },
        }
        mock_resp = httpx.Response(200, json=payload)
        with patch.object(httpx.AsyncClient, "post", new=AsyncMock(return_value=mock_resp)):
            result = await client.consultar_ruc("20552103816")

        assert result.nombre_o_razon_social == "AGROLIGHT PERU S.A.C."
        assert result.direccion_completa and "SANTA ANITA" in result.direccion_completa

    async def test_consultar_dni_not_found_raises(self) -> None:
        client = self._client()
        mock_resp = httpx.Response(
            404,
            json={"success": False, "message": "DNI no encontrado"},
        )
        with patch.object(httpx.AsyncClient, "post", new=AsyncMock(return_value=mock_resp)):
            with pytest.raises(JsonPeNotFound):
                await client.consultar_dni("00000000")

    async def test_consultar_ruc_timeout_raises_unavailable(self) -> None:
        client = self._client()
        with patch.object(
            httpx.AsyncClient,
            "post",
            new=AsyncMock(side_effect=httpx.TimeoutException("timeout")),
        ):
            with pytest.raises(JsonPeTimeout):
                await client.consultar_ruc("20552103816")

    async def test_consultar_dni_5xx_raises_unavailable(self) -> None:
        client = self._client()
        mock_resp = httpx.Response(503, text="upstream down")
        with patch.object(httpx.AsyncClient, "post", new=AsyncMock(return_value=mock_resp)):
            with pytest.raises(JsonPeUnavailable):
                await client.consultar_dni("27427864")

    async def test_empty_token_raises_unavailable_without_call(self) -> None:
        client = self._client(token="")
        with patch.object(httpx.AsyncClient, "post", new=AsyncMock()) as mock_post:
            with pytest.raises(JsonPeUnavailable):
                await client.consultar_dni("27427864")
            mock_post.assert_not_called()

    async def test_authorization_header_sent(self) -> None:
        client = self._client(token="tok-XYZ")
        mock_resp = httpx.Response(
            200,
            json={"success": True, "message": "ok", "data": {"numero": "12345678"}},
        )
        with patch.object(httpx.AsyncClient, "post", new=AsyncMock(return_value=mock_resp)) as mock_post:
            await client.consultar_dni("12345678")
            _, kwargs = mock_post.call_args
            assert kwargs["headers"]["Authorization"] == "Bearer tok-XYZ"
```

- [ ] **Step 2: Run tests to verify they fail (import error)**

Run from `_backEnd/`:

```bash
python -m pytest tests/unit/test_jsonpe_client.py -v
```

Expected: collection error / `ModuleNotFoundError: app.shared.external.jsonpe.client`.

- [ ] **Step 3: Implement `JsonPeClient`**

Create `_backEnd/app/shared/external/jsonpe/client.py`:

```python
"""
Mitrufely Web — JsonPeClient
Cliente HTTP asíncrono (httpx) para api.json.pe.

Responsabilidad única: hablar con json.pe y devolver schemas tipados.
NO conoce Redis, SQLAlchemy ni la BD — es testeable de forma aislada.

Documentación:
  - DNI: https://docs.json.pe/api-consulta/endpoint/dni
  - RUC: https://docs.json.pe/api-consulta/endpoint/ruc
"""

import httpx
from pydantic import SecretStr

from app.shared.external.jsonpe.exceptions import (
    JsonPeError,
    JsonPeNotFound,
    JsonPeTimeout,
    JsonPeUnavailable,
)
from app.shared.external.jsonpe.schemas import (
    JsonPeDniData,
    JsonPeDniRucData,
    JsonPeEnvelope,
    JsonPeRucData,
)


class JsonPeClient:
    """Cliente async para los endpoints /api/dni, /api/ruc, /api/dni-ruc."""

    def __init__(
        self,
        *,
        base_url: str,
        token: SecretStr,
        timeout: float,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._token = token
        self._timeout = timeout

    # ── Público ───────────────────────────────────────────────────────────────

    async def consultar_dni(self, dni: str) -> JsonPeDniData:
        """POST /api/dni → datos personales (RENIEC)."""
        data = await self._post("/api/dni", body={"dni": dni})
        return JsonPeDniData.model_validate(data)

    async def consultar_ruc(self, ruc: str) -> JsonPeRucData:
        """POST /api/ruc → datos de empresa/persona natural (SUNAT)."""
        data = await self._post("/api/ruc", body={"ruc": ruc})
        return JsonPeRucData.model_validate(data)

    async def dni_tiene_ruc(self, dni: str) -> JsonPeDniRucData:
        """POST /api/dni-ruc → verifica si un DNI tiene RUC asociado."""
        data = await self._post("/api/dni-ruc", body={"dni": dni})
        return JsonPeDniRucData.model_validate(data)

    # ── Privado ───────────────────────────────────────────────────────────────

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._token.get_secret_value()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _post(self, path: str, *, body: dict[str, str]) -> dict:
        token_value = self._token.get_secret_value()
        if not token_value:
            raise JsonPeUnavailable(
                "El servicio de consulta no está configurado. Ingresa los datos manualmente."
            )

        url = f"{self._base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as http:
                response = await http.post(url, json=body, headers=self._headers())
        except httpx.TimeoutException as e:
            raise JsonPeTimeout(str(e) or "Timeout") from e
        except httpx.HTTPError as e:
            raise JsonPeUnavailable(f"Error de red al consultar json.pe: {e}") from e

        if response.status_code == 404:
            raise JsonPeNotFound("El documento no fue encontrado en RENIEC/SUNAT.")
        if response.status_code >= 500:
            raise JsonPeUnavailable(
                f"json.pe respondió {response.status_code}. Inténtalo más tarde."
            )
        if response.status_code >= 400:
            raise JsonPeError(
                f"Error del cliente hacia json.pe (HTTP {response.status_code}).",
                status_code=502,
            )

        try:
            envelope = JsonPeEnvelope[dict].model_validate(response.json())
        except Exception as e:
            raise JsonPeUnavailable("Respuesta inválida de json.pe.") from e

        if not envelope.success or envelope.data is None:
            # 200 con success=false => documento no existe
            raise JsonPeNotFound(envelope.message or "Documento no encontrado.")
        return envelope.data
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/unit/test_jsonpe_client.py -v
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add _backEnd/app/shared/external/jsonpe/client.py _backEnd/tests/unit/test_jsonpe_client.py
git commit -m "feat(jsonpe): implement JsonPeClient (httpx + Bearer token) with tests"
```

---

## Task 4: Create `JsonPeClient` FastAPI dependency

**Files:**
- Create: `_backEnd/app/shared/external/jsonpe/dependencies.py`

- [ ] **Step 1: Create the dependency**

Create `_backEnd/app/shared/external/jsonpe/dependencies.py`:

```python
"""
Mitrufely Web — json.pe FastAPI Dependencies
Provee el JsonPeClient inyectable (una instancia por request).
"""

from functools import lru_cache

from app.core.config import settings
from app.shared.external.jsonpe.client import JsonPeClient


@lru_cache(maxsize=1)
def _build_client() -> JsonPeClient:
    """Factory cacheable — el cliente es stateless más allá de config."""
    return JsonPeClient(
        base_url=settings.JSONPE_BASE_URL,
        token=settings.JSONPE_API_TOKEN,
        timeout=settings.JSONPE_TIMEOUT_SECONDS,
    )


def get_jsonpe_client() -> JsonPeClient:
    """FastAPI dependency: devuelve el singleton del JsonPeClient."""
    return _build_client()
```

- [ ] **Step 2: Verify import works**

```bash
python -c "from app.shared.external.jsonpe.dependencies import get_jsonpe_client; c = get_jsonpe_client(); print('client ok:', type(c).__name__)"
```

Expected: `client ok: JsonPeClient`.

- [ ] **Step 3: Commit**

```bash
git add _backEnd/app/shared/external/jsonpe/dependencies.py
git commit -m "feat(jsonpe): add FastAPI dependency for JsonPeClient"
```

---

## Task 5: Create `consultas` module schemas

**Files:**
- Create: `_backEnd/app/modules/consultas/__init__.py`
- Create: `_backEnd/app/modules/consultas/schemas.py`

- [ ] **Step 1: Create module package**

Create `_backEnd/app/modules/consultas/__init__.py` (empty file):

```python
"""Módulo Consultas — integración con json.pe para DNI/RUC."""
```

- [ ] **Step 2: Create schemas**

Create `_backEnd/app/modules/consultas/schemas.py`:

```python
"""
Mitrufely Web — Consultas Module Schemas
Contrato del endpoint POST /consultas/documento hacia el frontend.
"""

from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class DocumentoLookupRequest(BaseModel):
    """Payload de entrada. Tipo + número de documento."""

    tipo_documento: Literal["DNI", "RUC"] = Field(..., description="DNI o RUC.")
    numero_documento: str = Field(..., min_length=8, max_length=11)

    @field_validator("numero_documento")
    @classmethod
    def _solo_digitos(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("El número de documento solo debe contener dígitos.")
        return v

    def longitud_ok(self) -> bool:
        esperado = 8 if self.tipo_documento == "DNI" else 11
        return len(self.numero_documento) == esperado


class DocumentoLookupResult(BaseModel):
    """Respuesta normalizada, agnóstica del tipo de documento.

    El frontend rellena el formulario con estos campos y el usuario decide
    si guardarlos (vía /auth/me/datos-fiscales) o descartarlos.
    """

    model_config = ConfigDict(from_attributes=True)

    tipo_documento: Literal["DNI", "RUC"]
    numero_documento: str
    # DNI
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    # RUC
    razon_social: Optional[str] = None
    direccion_fiscal: Optional[str] = None
    # Metadatos útiles para el frontend
    origen: Literal["api", "cache"] = Field(
        ..., description="Si el dato viene fresco de json.pe o del cache Redis."
    )
    ya_tiene_datos: bool = Field(
        ..., description="True si el usuario ya tenía datos fiscales guardados en BD."
    )
```

- [ ] **Step 3: Verify schema validation**

```bash
python -c "
from app.modules.consultas.schemas import DocumentoLookupRequest, DocumentoLookupResult
req = DocumentoLookupRequest(tipo_documento='DNI', numero_documento='27427864')
print('req ok', req.longitud_ok())
res = DocumentoLookupResult(tipo_documento='DNI', numero_documento='27427864', nombres='X', apellidos='Y', origen='api', ya_tiene_datos=False)
print('res ok', res.model_dump())
"
```

Expected: `req ok True` and a dict with all fields.

- [ ] **Step 4: Commit**

```bash
git add _backEnd/app/modules/consultas/
git commit -m "feat(consultas): add module skeleton and DocumentoLookup schemas"
```

---

## Task 6: Implement `ConsultasService` with TDD

**Files:**
- Test: `_backEnd/tests/unit/test_consultas_service.py`
- Create: `_backEnd/app/modules/consultas/service.py`

- [ ] **Step 1: Write failing tests for the service**

Create `_backEnd/tests/unit/test_consultas_service.py`:

```python
"""
Mitrufely Web — ConsultasService Unit Tests
Valida orquestación: BD check + cache Redis + cliente externo + normalización.
"""

import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from pydantic import SecretStr

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.modules.consultas.schemas import DocumentoLookupResult
from app.modules.consultas.service import ConsultasService
from app.shared.external.jsonpe.client import JsonPeClient
from app.shared.external.jsonpe.exceptions import JsonPeNotFound, JsonPeUnavailable
from app.shared.external.jsonpe.schemas import JsonPeDniData, JsonPeRucData


@pytest.mark.unit
class TestConsultasService:

    def _build(
        self,
        *,
        existing_fiscal=None,
        cached: dict | None = None,
        client: JsonPeClient | None = None,
        user_id: int = 5,
    ) -> ConsultasService:
        session = AsyncMock()
        # Simulation of SELECT DatosFiscales predeterminado
        result_mock = MagicMock()
        result_mock.scalar_one_or_none.return_value = existing_fiscal
        session.execute = AsyncMock(return_value=result_mock)

        redis = AsyncMock()
        if cached is None:
            redis.get = AsyncMock(return_value=None)
        else:
            redis.get = AsyncMock(return_value=json.dumps(cached))
        redis.setex = AsyncMock()

        if client is None:
            client = MagicMock(spec=JsonPeClient)

        return ConsultasService(
            session=session, redis=redis, jsonpe_client=client, user_id=user_id
        )

    async def test_dni_formato_invalido_raises(self) -> None:
        svc = self._build()
        with pytest.raises(BusinessRuleError):
            await svc.consultar_documento("DNI", "1234567")  # 7 dígitos

    async def test_ruc_formato_invalido_raises(self) -> None:
        svc = self._build()
        with pytest.raises(BusinessRuleError):
            await svc.consultar_documento("RUC", "12345678")  # 8 dígitos

    async def test_dni_cache_hit_no_llama_api(self) -> None:
        cached = {
            "tipo_documento": "DNI",
            "numero_documento": "27427864",
            "nombres": "JOSE",
            "apellidos": "CASTILLO TERRONES",
            "razon_social": None,
            "direccion_fiscal": None,
            "origen": "api",  # origen original guardado en cache
            "ya_tiene_datos": False,
        }
        client = MagicMock(spec=JsonPeClient)
        client.consultar_dni = AsyncMock()
        svc = self._build(cached=cached, client=client)

        result = await svc.consultar_documento("DNI", "27427864")

        assert result.origen == "cache"
        assert result.nombres == "JOSE"
        client.consultar_dni.assert_not_called()

    async def test_dni_cache_miss_llama_api_y_guarda_cache(self) -> None:
        client = MagicMock(spec=JsonPeClient)
        client.consultar_dni = AsyncMock(
            return_value=JsonPeDniData(
                numero="27427864",
                nombres="JOSE PEDRO",
                apellido_paterno="CASTILLO",
                apellido_materno="TERRONES",
            )
        )
        svc = self._build(cached=None, client=client)

        result = await svc.consultar_documento("DNI", "27427864")

        assert result.origen == "api"
        assert result.nombres == "JOSE PEDRO"
        assert result.apellidos == "CASTILLO TERRONES"
        client.consultar_dni.assert_awaited_once_with("27427864")
        svc._redis.setex.assert_awaited_once()
        # clave cache
        args, _ = svc._redis.setex.call_args
        assert args[0] == "jsonpe:dni:27427864"

    async def test_ruc_empresa_se_mapea_a_razon_social(self) -> None:
        client = MagicMock(spec=JsonPeClient)
        client.consultar_ruc = AsyncMock(
            return_value=JsonPeRucData(
                ruc="20552103816",
                nombre_o_razon_social="AGROLIGHT PERU S.A.C.",
                direccion_completa="PJ. JORGE BASADRE 158, LIMA - SANTA ANITA",
            )
        )
        svc = self._build(cached=None, client=client)

        result = await svc.consultar_documento("RUC", "20552103816")

        assert result.razon_social == "AGROLIGHT PERU S.A.C."
        assert result.nombres is None
        assert result.apellidos is None
        assert result.direccion_fiscal and "SANTA ANITA" in result.direccion_fiscal

    async def test_ruc_persona_natural_se_mapea_a_nombres_apellidos(self) -> None:
        client = MagicMock(spec=JsonPeClient)
        client.consultar_ruc = AsyncMock(
            return_value=JsonPeRucData(
                ruc="10000123456",  # empieza con 10 -> persona natural
                nombre_o_razon_social="GARCIA LOPEZ MARIA",
                direccion_completa="AV X",
            )
        )
        svc = self._build(cached=None, client=client)

        result = await svc.consultar_documento("RUC", "10000123456")

        assert result.razon_social is None
        assert result.nombres and "MARIA" in result.nombres
        assert result.apellidos and "GARCIA" in result.apellidos

    async def test_ya_tiene_datos_true_si_bd_tiene_fiscal(self) -> None:
        fiscal = MagicMock()
        fiscal.numero_documento = "27427864"
        client = MagicMock(spec=JsonPeClient)
        client.consultar_dni = AsyncMock(
            return_value=JsonPeDniData(numero="27427864", nombres="X")
        )
        svc = self._build(existing_fiscal=fiscal, cached=None, client=client)

        result = await svc.consultar_documento("DNI", "27427864")

        assert result.ya_tiene_datos is True

    async def test_jsonpe_unavailable_propaga_como_external_error(self) -> None:
        client = MagicMock(spec=JsonPeClient)
        client.consultar_dni = AsyncMock(side_effect=JsonPeUnavailable("caído"))
        svc = self._build(cached=None, client=client)

        from app.core.exceptions import ExternalServiceError
        with pytest.raises(ExternalServiceError):
            await svc.consultar_documento("DNI", "27427864")

    async def test_jsonpe_not_found_propaga_como_not_found(self) -> None:
        client = MagicMock(spec=JsonPeClient)
        client.consultar_dni = AsyncMock(side_effect=JsonPeNotFound("no existe"))
        svc = self._build(cached=None, client=client)

        with pytest.raises(NotFoundError):
            await svc.consultar_documento("DNI", "27427864")
```

- [ ] **Step 2: Run tests to verify they fail (import error)**

```bash
python -m pytest tests/unit/test_consultas_service.py -v
```

Expected: `ModuleNotFoundError: app.modules.consultas.service`.

- [ ] **Step 3: Implement `ConsultasService`**

Create `_backEnd/app/modules/consultas/service.py`:

```python
"""
Mitrufely Web — Consultas Service
Orquesta: validación + BD check + cache Redis + cliente json.pe + normalización.
NUNCA persiste — solo devuelve datos para que el frontend los guarde.
"""

import json
from typing import Optional

import structlog
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import (
    BusinessRuleError,
    ExternalServiceError,
    NotFoundError,
)
from app.infrastructure.database.models.usuarios import DatosFiscales
from app.modules.consultas.schemas import DocumentoLookupResult
from app.shared.external.jsonpe.client import JsonPeClient
from app.shared.external.jsonpe.exceptions import (
    JsonPeError,
    JsonPeNotFound,
    JsonPeTimeout,
    JsonPeUnavailable,
)

logger = structlog.get_logger(__name__)


class ConsultasService:
    """Servicio de consulta de documentos DNI/RUC."""

    def __init__(
        self,
        *,
        session: AsyncSession,
        redis: Redis,
        jsonpe_client: JsonPeClient,
        user_id: int,
    ) -> None:
        self._session = session
        self._redis = redis
        self._client = jsonpe_client
        self._user_id = user_id

    # ── Público ───────────────────────────────────────────────────────────────

    async def consultar_documento(
        self,
        tipo: str,
        numero: str,
    ) -> DocumentoLookupResult:
        """
        Consulta DNI/RUC. Flujo:
          1. Validar formato
          2. Revisar si el usuario ya tiene datos fiscales (ya_tiene_datos)
          3. Cache Redis (jsonpe:{tipo}:{numero})
          4. Si miss → llamar a json.pe, normalizar, cachear
          5. Devolver DocumentoLookupResult (NO persiste)
        """
        self._validar_formato(tipo, numero)
        ya_tiene_datos = await self._usuario_tiene_datos_fiscales()
        cache_key = f"jsonpe:{tipo.lower()}:{numero}"

        # 1. Cache
        cached_raw = await self._redis.get(cache_key)
        if cached_raw:
            try:
                payload = json.loads(cached_raw)
                payload["origen"] = "cache"
                payload["ya_tiene_datos"] = ya_tiene_datos
                logger.info(
                    "consultas.cache.hit",
                    tipo=tipo,
                    numero=numero,
                    user_id=self._user_id,
                )
                return DocumentoLookupResult.model_validate(payload)
            except Exception:
                # Cache corrupto: lo ignoramos y consultamos fresco
                logger.warning("consultas.cache.corrupt", key=cache_key)

        # 2. API
        try:
            if tipo == "DNI":
                data = await self._client.consultar_dni(numero)
                result = self._normalizar_dni(numero, data)
            else:
                data = await self._client.consultar_ruc(numero)
                result = self._normalizar_ruc(numero, data)
        except JsonPeNotFound as e:
            logger.info("consultas.api.not_found", tipo=tipo, numero=numero)
            raise NotFoundError(
                "El documento no fue encontrado en RENIEC/SUNAT. Verifica el número."
            ) from e
        except JsonPeTimeout as e:
            logger.warning("consultas.api.timeout", tipo=tipo, numero=numero)
            raise ExternalServiceError(
                "El servicio de consulta tardó demasiado. Inténtalo de nuevo o ingresa los datos manualmente."
            ) from e
        except JsonPeUnavailable as e:
            logger.warning("consultas.api.unavailable", message=e.message)
            raise ExternalServiceError(
                "Servicio de consulta no disponible. Ingresa los datos manualmente."
            ) from e
        except JsonPeError as e:
            logger.error("consultas.api.error", message=e.message)
            raise ExternalServiceError(
                "Error al consultar el servicio externo."
            ) from e

        # 3. Cachear y devolver
        result.origen = "api"
        result.ya_tiene_datos = ya_tiene_datos
        await self._redis.setex(
            cache_key,
            settings.JSONPE_CACHE_TTL_SECONDS,
            result.model_dump_json(),
        )
        logger.info(
            "consultas.api.success",
            tipo=tipo,
            numero=numero,
            user_id=self._user_id,
        )
        return result

    # ── Privado ───────────────────────────────────────────────────────────────

    @staticmethod
    def _validar_formato(tipo: str, numero: str) -> None:
        if not numero.isdigit():
            raise BusinessRuleError("El documento solo debe contener dígitos.")
        esperado = 8 if tipo == "DNI" else 11
        if len(numero) != esperado:
            raise BusinessRuleError(
                f"El {tipo} debe tener exactamente {esperado} dígitos."
            )

    async def _usuario_tiene_datos_fiscales(self) -> bool:
        stmt = select(DatosFiscales).where(
            DatosFiscales.id_usuario == self._user_id,
            DatosFiscales.es_predeterminado.is_(True),
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none() is not None

    @staticmethod
    def _normalizar_dni(numero: str, data) -> DocumentoLookupResult:
        apellidos = " ".join(
            p for p in [data.apellido_paterno, data.apellido_materno] if p
        ).strip() or None
        return DocumentoLookupResult(
            tipo_documento="DNI",
            numero_documento=numero,
            nombres=data.nombres,
            apellidos=apellidos,
            razon_social=None,
            direccion_fiscal=(data.direccion_completa or data.direccion or None),
            origen="api",
            ya_tiene_datos=False,
        )

    @staticmethod
    def _normalizar_ruc(numero: str, data) -> DocumentoLookupResult:
        """
        Heurística: RUC que empieza con '10' = persona natural.
        Resto (15, 20, etc.) = empresa.
        """
        nombre = (data.nombre_o_razon_social or "").strip()
        direccion = (data.direccion_completa or data.direccion or None)

        if numero.startswith("10") and nombre:
            # Persona natural: asumimos "APELLIDOS NOMBRES"
            partes = nombre.split()
            if len(partes) >= 2:
                apellidos = " ".join(partes[:2])
                nombres = " ".join(partes[2:]) or None
            else:
                apellidos = nombre
                nombres = None
            return DocumentoLookupResult(
                tipo_documento="RUC",
                numero_documento=numero,
                nombres=nombres,
                apellidos=apellidos,
                razon_social=None,
                direccion_fiscal=direccion,
                origen="api",
                ya_tiene_datos=False,
            )

        return DocumentoLookupResult(
            tipo_documento="RUC",
            numero_documento=numero,
            nombres=None,
            apellidos=None,
            razon_social=nombre or None,
            direccion_fiscal=direccion,
            origen="api",
            ya_tiene_datos=False,
        )
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/unit/test_consultas_service.py -v
```

Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add _backEnd/app/modules/consultas/service.py _backEnd/tests/unit/test_consultas_service.py
git commit -m "feat(consultas): implement ConsultasService with BD+cache+API flow"
```

---

## Task 7: Create `consultas` module dependency wiring

**Files:**
- Create: `_backEnd/app/modules/consultas/dependencies.py`

- [ ] **Step 1: Create the dependency**

Create `_backEnd/app/modules/consultas/dependencies.py`:

```python
"""
Mitrufely Web — Consultas Module Dependencies
Wiring FastAPI para el ConsultasService.
"""

from typing import Annotated

from fastapi import Depends
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.cache.redis_client import get_redis
from app.infrastructure.database.session import get_db_session
from app.modules.consultas.service import ConsultasService
from app.security.dependencies import AuthUser, get_current_user
from app.shared.external.jsonpe.client import JsonPeClient
from app.shared.external.jsonpe.dependencies import get_jsonpe_client


def get_consultas_service(
    session: Annotated[AsyncSession, Depends(get_db_session)],
    redis: Annotated[Redis, Depends(get_redis)],
    jsonpe_client: Annotated[JsonPeClient, Depends(get_jsonpe_client)],
    current_user: Annotated[AuthUser, Depends(get_current_user)],
) -> ConsultasService:
    """Factory del ConsultasService (una instancia por request)."""
    return ConsultasService(
        session=session,
        redis=redis,
        jsonpe_client=jsonpe_client,
        user_id=current_user.user_id,
    )


ConsultasServiceDep = Annotated[ConsultasService, Depends(get_consultas_service)]
```

- [ ] **Step 2: Verify import**

```bash
python -c "from app.modules.consultas.dependencies import ConsultasServiceDep; print('wiring ok')"
```

Expected: `wiring ok`. (Requires `get_current_user` to be importable — verify it exists in `_backEnd/app/security/dependencies.py`.)

- [ ] **Step 3: Commit**

```bash
git add _backEnd/app/modules/consultas/dependencies.py
git commit -m "feat(consultas): wire ConsultasService via FastAPI dependencies"
```

---

## Task 8: Implement `consultas` router with TDD

**Files:**
- Test: `_backEnd/tests/integration/test_consultas_router.py`
- Create: `_backEnd/app/modules/consultas/router.py`

- [ ] **Step 1: Write failing integration tests**

Create `_backEnd/tests/integration/test_consultas_router.py`:

```python
"""
Mitrufely Web — Consultas Router Integration Tests
Valida el endpoint POST /consultas/documento con httpx mockeado + Redis real/mocked.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from pydantic import SecretStr

from app.shared.external.jsonpe.client import JsonPeClient


@pytest.mark.integration
class TestConsultasRouter:

    async def test_unauthenticated_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        resp = await client.post(
            "/consultas/documento",
            json={"tipo_documento": "DNI", "numero_documento": "27427864"},
        )
        assert resp.status_code == 401

    async def test_dni_formato_invalido_returns_422(
        self,
        client: httpx.AsyncClient,
        auth_headers_client: dict[str, str],
    ) -> None:
        resp = await client.post(
            "/consultas/documento",
            json={"tipo_documento": "DNI", "numero_documento": "1234567"},  # 7 dígitos
            headers=auth_headers_client,
        )
        # DNI con longitud incorrecta pasa Pydantic (min 8) pero BusinessRule 400.
        # Actualmente min_length=8 en schema => 422 antes de llegar al service.
        assert resp.status_code in (400, 422)

    async def test_dni_success_flujo_completo(
        self,
        client: httpx.AsyncClient,
        auth_headers_client: dict[str, str],
    ) -> None:
        """Mockea el JsonPeClient para devolver datos exitosos."""
        payload = {
            "success": True,
            "message": "exito",
            "data": {
                "numero": "27427864",
                "nombres": "JOSE PEDRO",
                "apellido_paterno": "CASTILLO",
                "apellido_materno": "TERRONES",
                "direccion": "",
                "direccion_completa": "",
            },
        }
        mock_resp = httpx.Response(200, json=payload)

        with patch.object(httpx.AsyncClient, "post", new=AsyncMock(return_value=mock_resp)):
            # Limpiar Redis antes del test (si hay cache real)
            from app.infrastructure.cache.redis_client import redis_client
            await redis_client.delete("jsonpe:dni:27427864")

            resp = await client.post(
                "/consultas/documento",
                json={"tipo_documento": "DNI", "numero_documento": "27427864"},
                headers=auth_headers_client,
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        data = body["data"]
        assert data["tipo_documento"] == "DNI"
        assert data["nombres"] == "JOSE PEDRO"
        assert data["apellidos"] == "CASTILLO TERRONES"
        assert data["origen"] in ("api", "cache")
        # limpiar cache generado
        await redis_client.delete("jsonpe:dni:27427864")

    async def test_dni_no_encontrado_returns_404(
        self,
        client: httpx.AsyncClient,
        auth_headers_client: dict[str, str],
    ) -> None:
        mock_resp = httpx.Response(
            404,
            json={"success": False, "message": "DNI no encontrado"},
        )
        with patch.object(httpx.AsyncClient, "post", new=AsyncMock(return_value=mock_resp)):
            from app.infrastructure.cache.redis_client import redis_client
            await redis_client.delete("jsonpe:dni:00000000")
            resp = await client.post(
                "/consultas/documento",
                json={"tipo_documento": "DNI", "numero_documento": "00000000"},
                headers=auth_headers_client,
            )
        assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail (no router)**

```bash
python -m pytest tests/integration/test_consultas_router.py -v
```

Expected: 404 on `/consultas/documento` (router not registered yet).

- [ ] **Step 3: Implement router**

Create `_backEnd/app/modules/consultas/router.py`:

```python
"""
Mitrufely Web — Consultas Router
Endpoint de consulta de DNI/RUC contra json.pe (con cache Redis).
NO persiste — solo devuelve datos para que el frontend rellene el formulario.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings
from app.modules.consultas.dependencies import ConsultasServiceDep
from app.modules.consultas.schemas import DocumentoLookupRequest, DocumentoLookupResult
from app.security.dependencies import AuthUser, get_current_user
from app.shared.schemas.response import APIResponse

router = APIRouter(prefix="/consultas", tags=["Consultas DNI/RUC"])

# Limiter local: 10 consultas por minuto por IP.
# El endpoint requiere AuthUser, así que el rate limit efectivo es por usuario autenticado.
_limiter = Limiter(key_func=get_remote_address, storage_uri=settings.REDIS_URL)


@router.post(
    "/documento",
    response_model=APIResponse[DocumentoLookupResult],
    summary="Consultar DNI/RUC",
    description=(
        "Consulta datos de identidad (DNI) o fiscales (RUC) contra json.pe, "
        "usando cache Redis de 24h. No persiste — el frontend debe guardar "
        "los datos devueltos vía /auth/me/datos-fiscales."
    ),
)
@_limiter.limit("10/minute")
async def lookup_documento(
    request: Request,  # inyectado por slowapi (debe estar como parámetro)
    payload: DocumentoLookupRequest,
    current_user: Annotated[AuthUser, Depends(get_current_user)],
    service: ConsultasServiceDep,
) -> APIResponse[DocumentoLookupResult]:
    result = await service.consultar_documento(
        tipo=payload.tipo_documento,
        numero=payload.numero_documento,
    )
    return APIResponse(success=True, data=result)
```

Note: slowapi requires the `request: Request` parameter to be present in the function signature (anywhere — order doesn't matter). Keep it first by convention.

- [ ] **Step 4: Register router in aggregator**

Edit `_backEnd/app/routers/__init__.py` — add to the imports section (after the `users_router` import):

```python
from app.modules.consultas.router import router as consultas_router
```

And add to the registration section (after `api_router.include_router(users_router)`):

```python
api_router.include_router(consultas_router)
```

- [ ] **Step 5: Run integration tests**

```bash
python -m pytest tests/integration/test_consultas_router.py -v
```

Expected: 4 passed (401, 422, success, 404). If Redis isn't running locally, the success test may fail on cache writes — in that case ensure Redis is started (`docker-compose up -d redis`).

- [ ] **Step 6: Commit**

```bash
git add _backEnd/app/modules/consultas/router.py _backEnd/app/routers/__init__.py _backEnd/tests/integration/test_consultas_router.py
git commit -m "feat(consultas): add POST /consultas/documento endpoint with rate limit"
```

---

## Task 9: Manual smoke test backend

- [ ] **Step 1: Fill in the token**

Edit `_backEnd/.env`, set `JSONPE_API_TOKEN=tu-token-real-aqui`.

- [ ] **Step 2: Start the backend**

```bash
cd _backEnd
uvicorn app.main:app --reload --port 8000
```

- [ ] **Step 3: Login as a client and copy the access token**

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@test.com","password":"TU_PASSWORD"}'
```

Copy `access_token` from the response.

- [ ] **Step 4: Test the endpoint with a real DNI**

```bash
curl -X POST http://localhost:8000/api/v1/consultas/documento \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tipo_documento":"DNI","numero_documento":"27427864"}'
```

Expected: `{"success":true,"data":{"tipo_documento":"DNI","numero_documento":"27427864","nombres":"JOSE PEDRO","apellidos":"CASTILLO TERRONES",...,"origen":"api","ya_tiene_datos":false}}`.

- [ ] **Step 5: Test cache (second call returns origen="cache")**

Run the same curl again. Expected `"origen":"cache"`.

- [ ] **Step 6: Test RUC**

```bash
curl -X POST http://localhost:8000/api/v1/consultas/documento \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tipo_documento":"RUC","numero_documento":"20552103816"}'
```

Expected: `razon_social` populated with `"AGROLIGHT PERU S.A.C."` and `direccion_fiscal` populated.

- [ ] **Step 7: Commit nothing (smoke test only)**

No code changes. Proceed to frontend.

---

## Task 10: Frontend — `consultas` feature API + hook + types

**Files:**
- Create: `_frontEnd/src/features/consultas/types.ts`
- Create: `_frontEnd/src/features/consultas/api/consultasApi.ts`
- Create: `_frontEnd/src/features/consultas/hooks/useConsultarDocumento.ts`

- [ ] **Step 1: Create types**

Create `_frontEnd/src/features/consultas/types.ts`:

```typescript
/**
 * Tipos del feature de consultas DNI/RUC.
 */

export type TipoDocumento = 'DNI' | 'RUC'

export interface DocumentoLookupRequest {
  tipo_documento: TipoDocumento
  numero_documento: string
}

export interface DocumentoLookupResult {
  tipo_documento: TipoDocumento
  numero_documento: string
  nombres: string | null
  apellidos: string | null
  razon_social: string | null
  direccion_fiscal: string | null
  origen: 'api' | 'cache'
  ya_tiene_datos: boolean
}
```

- [ ] **Step 2: Create API client**

Create `_frontEnd/src/features/consultas/api/consultasApi.ts`:

```typescript
/**
 * consultasApi.ts — cliente HTTP para /consultas/documento.
 */
import api from '@/lib/axios'
import type { DocumentoLookupRequest, DocumentoLookupResult, TipoDocumento } from '../types'

export const consultasApi = {
  lookupDocumento: async (
    tipo: TipoDocumento,
    numero: string,
  ): Promise<DocumentoLookupResult> => {
    const payload: DocumentoLookupRequest = {
      tipo_documento: tipo,
      numero_documento: numero,
    }
    const { data } = await api.post<{ success: boolean; data: DocumentoLookupResult }>(
      '/consultas/documento',
      payload,
    )
    return data.data
  },
}
```

- [ ] **Step 3: Create the hook**

Create `_frontEnd/src/features/consultas/hooks/useConsultarDocumento.ts`:

```typescript
/**
 * useConsultarDocumento — mutation TanStack para consultar DNI/RUC.
 */
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { consultasApi } from '../api/consultasApi'
import type { TipoDocumento } from '../types'

export function useConsultarDocumento() {
  return useMutation({
    mutationFn: ({ tipo, numero }: { tipo: TipoDocumento; numero: string }) =>
      consultasApi.lookupDocumento(tipo, numero),
    onError: (error: any) => {
      const msg =
        error?.response?.data?.error?.message ||
        'No se pudo consultar el documento. Ingrésalo manualmente.'
      toast.error(msg)
    },
  })
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd _frontEnd
npx tsc --noEmit
```

Expected: no errors in the new files.

- [ ] **Step 5: Commit**

```bash
git add _frontEnd/src/features/consultas/
git commit -m "feat(consultas-fe): add types, API client and useConsultarDocumento hook"
```

---

## Task 11: Frontend — `DatosFiscalesSection` component

**Files:**
- Create: `_frontEnd/src/features/profile/components/DatosFiscalesSection.tsx`

- [ ] **Step 1: Create the component**

Create `_frontEnd/src/features/profile/components/DatosFiscalesSection.tsx`:

```tsx
/**
 * DatosFiscalesSection.tsx — Sección "Datos Fiscales" para ProfileInfoPage.
 *
 * Flujo:
 *   - Vista lectura si el usuario ya tiene datos fiscales guardados
 *   - Botón "Editar" entra en modo edición
 *   - Botón "🔍 Consultar" llama a /consultas/documento y rellena el form
 *   - Botón "Guardar cambios" hace upsert + update_profile
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, Save, ShieldCheck, Search, AlertCircle, CheckCircle2, Pencil, X } from 'lucide-react'
import { useDatosFiscales, useUpsertDatosFiscales, useUpdateProfile } from '@/features/auth/hooks/useProfile'
import { useConsultarDocumento } from '@/features/consultas/hooks/useConsultarDocumento'
import type { TipoDocumento } from '@/features/consultas/types'
import { toast } from 'sonner'

interface FormState {
  tipo_documento: TipoDocumento
  numero_documento: string
  razon_social: string
  direccion_fiscal: string
  nombres: string
  apellidos: string
}

export function DatosFiscalesSection() {
  const { data: fiscalData } = useDatosFiscales()
  const upsertFiscal = useUpsertDatosFiscales()
  const updateProfile = useUpdateProfile()
  const consultar = useConsultarDocumento()

  const [editando, setEditando] = useState(!fiscalData?.numero_documento)
  const [consultadoOk, setConsultadoOk] = useState(false)
  const [form, setForm] = useState<FormState>({
    tipo_documento: fiscalData?.tipo_documento ?? 'DNI',
    numero_documento: fiscalData?.numero_documento ?? '',
    razon_social: fiscalData?.razon_social ?? '',
    direccion_fiscal: fiscalData?.direccion_fiscal ?? '',
    nombres: '',
    apellidos: '',
  })

  const longitudOk =
    form.tipo_documento === 'DNI'
      ? form.numero_documento.length === 8
      : form.numero_documento.length === 11

  const handleConsultar = async () => {
    if (!longitudOk) {
      toast.error(
        form.tipo_documento === 'DNI'
          ? 'El DNI debe tener 8 dígitos.'
          : 'El RUC debe tener 11 dígitos.',
      )
      return
    }
    try {
      const result = await consultar.mutateAsync({
        tipo: form.tipo_documento,
        numero: form.numero_documento,
      })
      setForm((prev) => ({
        ...prev,
        razon_social: result.razon_social ?? prev.razon_social,
        direccion_fiscal: result.direccion_fiscal ?? prev.direccion_fiscal,
        nombres: result.nombres ?? prev.nombres,
        apellidos: result.apellidos ?? prev.apellidos,
      }))
      setConsultadoOk(true)
      toast.success('Datos cargados desde RENIEC/SUNAT.')
    } catch {
      // el hook ya muestra el toast de error
    }
  }

  const handleGuardar = async () => {
    // Validaciones mínimas
    if (!form.numero_documento || !longitudOk) {
      toast.error('Documento inválido.')
      return
    }
    if (form.tipo_documento === 'RUC' && !form.razon_social.trim()) {
      toast.error('La razón social es obligatoria para RUC.')
      return
    }
    if (!form.direccion_fiscal.trim()) {
      toast.error('La dirección fiscal es obligatoria.')
      return
    }

    // 1. Upsert fiscal
    await upsertFiscal.mutateAsync({
      tipo_documento: form.tipo_documento,
      numero_documento: form.numero_documento,
      razon_social: form.tipo_documento === 'RUC' ? form.razon_social : null,
      direccion_fiscal: form.direccion_fiscal,
    })

    // 2. Si la API dio nombres/apellidos (DNI o RUC persona natural), actualizar perfil
    if (form.nombres || form.apellidos) {
      await updateProfile.mutateAsync({
        nombres: form.nombres || null,
        apellidos: form.apellidos || null,
      })
    }

    setEditando(false)
    setConsultadoOk(false)
  }

  const handleCancelar = () => {
    // Restaurar valores desde fiscalData
    setForm({
      tipo_documento: fiscalData?.tipo_documento ?? 'DNI',
      numero_documento: fiscalData?.numero_documento ?? '',
      razon_social: fiscalData?.razon_social ?? '',
      direccion_fiscal: fiscalData?.direccion_fiscal ?? '',
      nombres: '',
      apellidos: '',
    })
    setEditando(false)
    setConsultadoOk(false)
  }

  // ── Vista de lectura ──────────────────────────────────────────────────────
  if (fiscalData?.numero_documento && !editando) {
    return (
      <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-[#2a1115] text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#5c0f1b]" />
            Datos Fiscales
          </h2>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1 text-xs font-bold text-[#5c0f1b] hover:text-[#ff7a45] cursor-pointer"
          >
            <Pencil className="h-3 w-3" /> Editar
          </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs font-black uppercase text-stone-500">Documento</dt>
            <dd className="font-bold text-[#2a1115]">
              {fiscalData.tipo_documento}: {fiscalData.numero_documento}
            </dd>
          </div>
          {fiscalData.razon_social && (
            <div>
              <dt className="text-xs font-black uppercase text-stone-500">Razón Social</dt>
              <dd className="font-bold text-[#2a1115]">{fiscalData.razon_social}</dd>
            </div>
          )}
          <div className="sm:col-span-2">
            <dt className="text-xs font-black uppercase text-stone-500">Dirección Fiscal</dt>
            <dd className="font-bold text-[#2a1115]">
              {fiscalData.direccion_fiscal || '—'}
            </dd>
          </div>
        </dl>
      </div>
    )
  }

  // ── Vista de edición ──────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl border border-[#5c0f1b]/8 p-5 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-black text-[#2a1115] text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-[#5c0f1b]" />
          Datos Fiscales
        </h2>
      </div>

      <div className="space-y-4">
        {/* Tipo + Número + Consultar */}
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-stone-500">
              Tipo <span className="text-red-500">*</span>
            </label>
            <select
              value={form.tipo_documento}
              onChange={(e) => {
                setForm({ ...form, tipo_documento: e.target.value as TipoDocumento })
                setConsultadoOk(false)
              }}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none cursor-pointer"
            >
              <option value="DNI">DNI</option>
              <option value="RUC">RUC</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-stone-500">
              Número <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={form.numero_documento}
              onChange={(e) => {
                setForm({ ...form, numero_documento: e.target.value.replace(/\D/g, '') })
                setConsultadoOk(false)
              }}
              maxLength={form.tipo_documento === 'DNI' ? 8 : 11}
              placeholder={form.tipo_documento === 'DNI' ? '8 dígitos' : '11 dígitos'}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleConsultar}
            disabled={!longitudOk || consultar.isPending}
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#5c0f1b] text-white text-sm font-bold hover:bg-[#7a1525] transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {consultar.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Consultando...</>
            ) : consultadoOk ? (
              <><CheckCircle2 className="h-4 w-4" /> Consultado</>
            ) : (
              <><Search className="h-4 w-4" /> Consultar</>
            )}
          </button>
        </div>

        <p className="text-xs text-stone-500 font-medium bg-stone-50 p-3 rounded-lg border border-stone-100">
          <AlertCircle className="inline h-3 w-3 mr-1 text-stone-400" />
          Presiona "Consultar" para autocompletar desde RENIEC/SUNAT. Los campos que la API no traiga debes llenarlos manualmente.
        </p>

        {/* Campos opcionales (DNI) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-stone-500">
              Nombres
            </label>
            <input
              type="text"
              value={form.nombres}
              onChange={(e) => setForm({ ...form, nombres: e.target.value })}
              placeholder="Autocompleta con DNI"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-wide text-stone-500">
              Apellidos
            </label>
            <input
              type="text"
              value={form.apellidos}
              onChange={(e) => setForm({ ...form, apellidos: e.target.value })}
              placeholder="Autocompleta con DNI"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none"
            />
          </div>
        </div>

        {/* RUC */}
        <AnimatePresence>
          {form.tipo_documento === 'RUC' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1.5"
            >
              <label className="text-xs font-black uppercase tracking-wide text-stone-500">
                Razón Social <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.razon_social}
                onChange={(e) => setForm({ ...form, razon_social: e.target.value })}
                placeholder="Autocompleta con RUC"
                className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none"
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-1.5">
          <label className="text-xs font-black uppercase tracking-wide text-stone-500">
            Dirección Fiscal <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.direccion_fiscal}
            onChange={(e) => setForm({ ...form, direccion_fiscal: e.target.value })}
            placeholder="Av. / Jr. / Calle"
            className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-[#faf8f5] text-sm font-semibold text-[#2a1115] focus:border-[#5c0f1b] outline-none"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {fiscalData?.numero_documento && (
            <button
              type="button"
              onClick={handleCancelar}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-[#5c0f1b]/20 text-[#5c0f1b] font-bold text-sm hover:border-[#5c0f1b]/40 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" /> Cancelar
            </button>
          )}
          <button
            type="button"
            onClick={handleGuardar}
            disabled={upsertFiscal.isPending || updateProfile.isPending}
            className="inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#5c0f1b] hover:bg-[#7a1525] text-white text-sm font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {(upsertFiscal.isPending || updateProfile.isPending) ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="h-4 w-4" /> Guardar cambios</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Mount it in `ProfileInfoPage.tsx`**

Edit `_frontEnd/src/features/profile/pages/ProfileInfoPage.tsx`:

Add import at the top (after the existing `useAuthStore` import line ~4):

```tsx
import { DatosFiscalesSection } from '@/features/profile/components/DatosFiscalesSection'
```

Find the closing of the personal-info form container. Around line 475 the form's outer `</div>` (closing `bg-white rounded-2xl`) ends. After that `</div>` and before the modal block, add:

```tsx
      {/* ── Datos Fiscales ─────────────────────────────────────────── */}
      <DatosFiscalesSection />
```

The exact anchor: look for `</form>` followed by `</div>` (closing the white card) around line 475. Insert the `<DatosFiscalesSection />` immediately after that closing `</div>`.

- [ ] **Step 3: Verify TS compiles**

```bash
cd _frontEnd
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run `npm run dev`, log in as a client, go to profile → Información Personal. You should see the "Datos Fiscales" section below the personal form. Test the "Consultar" button with a real DNI.

- [ ] **Step 5: Commit**

```bash
git add _frontEnd/src/features/profile/components/DatosFiscalesSection.tsx _frontEnd/src/features/profile/pages/ProfileInfoPage.tsx
git commit -m "feat(profile): add DatosFiscalesSection with json.pe lookup"
```

---

## Task 12: Frontend — PaymentModal "Consultar" button + "Usar dirección fiscal como envío"

**Files:**
- Modify: `_frontEnd/src/features/cart/components/PaymentModal.tsx`

- [ ] **Step 1: Add imports at top**

At the top of `PaymentModal.tsx`, after the existing imports (around line 27-31), add:

```tsx
import { useConsultarDocumento } from '@/features/consultas/hooks/useConsultarDocumento'
import type { DocumentoLookupResult } from '@/features/consultas/types'
import { Search, CheckCircle2 } from 'lucide-react'
```

(`Search` and `CheckCircle2` are new icons; `CheckCircle` is already imported but `CheckCircle2` is a different icon — verify it's not already imported. If it is, omit it.)

- [ ] **Step 2: Add state for the lookup result and the lookup hook**

Inside the `PaymentModal` component body, after the existing `const tarjetaForm = useForm...` block (around line 121-124), add:

```tsx
  const consultarDocumento = useConsultarDocumento()
  const [lookupResult, setLookupResult] = useState<DocumentoLookupResult | null>(null)
  const [consultadoOk, setConsultadoOk] = useState(false)
```

- [ ] **Step 3: Add the "Consultar" handler**

Below the existing `handleEnvioSubmit` (around line 237), add:

```tsx
  const handleConsultarDocumento = async () => {
    const tipo = fiscalForm.getValues('tipo_documento')
    const numero = fiscalForm.getValues('numero_documento')
    const esperado = tipo === 'DNI' ? 8 : 11
    if (numero.length !== esperado) return
    try {
      const result = await consultarDocumento.mutateAsync({ tipo, numero })
      setLookupResult(result)
      setConsultadoOk(true)
      // Rellena los campos del form
      if (result.razon_social) {
        fiscalForm.setValue('razon_social', result.razon_social)
      }
      if (result.direccion_fiscal) {
        fiscalForm.setValue('direccion_fiscal', result.direccion_fiscal)
      }
    } catch {
      setConsultadoOk(false)
    }
  }
```

- [ ] **Step 4: Reset lookup state on modal open**

In the `useEffect` that resets state when `isOpen` changes (around lines 133-147), add inside the `if (isOpen) {` block:

```tsx
      setLookupResult(null)
      setConsultadoOk(false)
```

- [ ] **Step 5: Add the "Consultar" button next to the document number input**

In the Step 1 form, find the "Número de Documento" Field (around lines 422-424). Replace that Field block with:

```tsx
                    <div>
                      <Field label="Número de Documento" error={fiscalForm.formState.errors.numero_documento?.message} required>
                        <div className="flex gap-2">
                          <Input
                            id="fiscal-numero"
                            placeholder={fiscalForm.watch('tipo_documento') === 'RUC' ? '11 dígitos' : '8 dígitos'}
                            error={!!fiscalForm.formState.errors.numero_documento}
                            {...fiscalForm.register('numero_documento')}
                            onChange={(e) => {
                              fiscalForm.setValue('numero_documento', e.target.value.replace(/\D/g, ''), { shouldValidate: true })
                              setConsultadoOk(false)
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleConsultarDocumento}
                            disabled={
                              consultarDocumento.isPending ||
                              (fiscalForm.watch('tipo_documento') === 'DNI'
                                ? fiscalForm.watch('numero_documento').length !== 8
                                : fiscalForm.watch('numero_documento').length !== 11)
                            }
                            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#5c0f1b] text-white text-xs font-black hover:bg-[#7a1525] transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Consultar DNI/RUC en RENIEC/SUNAT"
                          >
                            {consultarDocumento.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : consultadoOk ? (
                              <><CheckCircle2 className="h-3.5 w-3.5" /> OK</>
                            ) : (
                              <><Search className="h-3.5 w-3.5" /> Consultar</>
                            )}
                          </button>
                        </div>
                      </Field>
                    </div>
```

- [ ] **Step 6: Add the "Usar dirección fiscal como envío" banner in Step 2**

In the Step 2 (`{step === 2 && (`), right after the `<MapPin />` header block (around line 457), add before the conditional `profileData && ...` block:

```tsx
                {/* Banner: usar dirección fiscal como envío */}
                {lookupResult?.direccion_fiscal && !editEnvio && (
                  <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                    <p className="text-xs font-bold text-amber-900 mb-2">
                      💡 Detectamos la dirección fiscal de tu RUC:
                    </p>
                    <p className="text-xs text-amber-800 mb-3 font-medium">
                      {lookupResult.direccion_fiscal}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDireccion(lookupResult.direccion_fiscal || '')
                        setEditEnvio(true)
                      }}
                      className="text-xs font-black text-[#5c0f1b] underline hover:text-[#ff7a45] cursor-pointer"
                    >
                      Usar esta dirección para envío
                    </button>
                  </div>
                )}
```

- [ ] **Step 7: Verify TS compiles**

```bash
cd _frontEnd
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual smoke test**

1. Add products to cart, open checkout.
2. In Step 1 (Datos Fiscales), enter a real DNI, click "Consultar". Names should fill.
3. Try with RUC. Razón social and dirección fiscal should fill.
4. In Step 2, the "Usar esta dirección" banner should appear if the RUC returned a dirección fiscal.

- [ ] **Step 9: Commit**

```bash
git add _frontEnd/src/features/cart/components/PaymentModal.tsx
git commit -m "feat(checkout): add Consultar button + Use fiscal address banner"
```

---

## Task 13: Update ARCHITECTURE.md and README

**Files:**
- Modify: `_backEnd/ARCHITECTURE.md`
- Modify: `README.md` (root)

- [ ] **Step 1: Update ARCHITECTURE.md module list**

In `_backEnd/ARCHITECTURE.md`, find the modules list (around line 50-60, the `modules/` directory listing):

```
│   ├── modules/                   # Feature modules (vertical slices)
│   │   ├── auth/
│   │   ├── products/
│   │   ├── orders/
```

Add `consultas/` to the list:

```
│   ├── modules/                   # Feature modules (vertical slices)
│   │   ├── auth/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── consultas/             # json.pe DNI/RUC lookup
```

Also find the infrastructure section and add `shared/external/`:

```
│   ├── shared/
│   │   └── schemas/
│   │       ├── pagination.py
│   │       └── response.py
│   │   └── external/              # Third-party HTTP clients
│   │       └── jsonpe/            # json.pe (DNI/RUC)
```

- [ ] **Step 2: Add a section to README.md (root)**

Append a new section to `README.md` (at root, before the License or final section):

```markdown
## 🪪 Consulta de DNI/RUC (json.pe)

Los clientes pueden autocompletar sus datos de identidad (DNI) o fiscales (RUC)
desde su perfil y desde el checkout mediante la API de [json.pe](https://json.pe/).

**Flujo:**
1. El cliente presiona "🔍 Consultar" junto al número de documento.
2. El backend consulta `https://api.json.pe` con el token `JSONPE_API_TOKEN` (en `.env`).
3. Los datos se cachean en Redis 24h para no gastar créditos en consultas repetidas.
4. El formulario se rellena — el cliente revisa y presiona "Guardar" para persistir.

**Variables de entorno (`_backEnd/.env`):**

| Variable | Descripción | Default |
|---|---|---|
| `JSONPE_API_TOKEN` | Token Bearer de api.json.pe. Vacío = modo degradado. | `""` |
| `JSONPE_BASE_URL` | URL base del API. | `https://api.json.pe` |
| `JSONPE_CACHE_TTL_SECONDS` | TTL del cache Redis (segundos). | `86400` |
| `JSONPE_TIMEOUT_SECONDS` | Timeout HTTP (segundos). | `10` |
```

- [ ] **Step 3: Commit**

```bash
git add _backEnd/ARCHITECTURE.md README.md
git commit -m "docs: document json.pe DNI/RUC integration in ARCHITECTURE.md and README"
```

---

## Task 14: Final verification

- [ ] **Step 1: Run all backend tests**

```bash
cd _backEnd
python -m pytest tests/unit/test_jsonpe_client.py tests/unit/test_consultas_service.py tests/integration/test_consultas_router.py -v
```

Expected: all pass.

- [ ] **Step 2: Run full backend test suite (regression check)**

```bash
cd _backEnd
python -m pytest -x
```

Expected: no regressions.

- [ ] **Step 3: Run frontend type check + build**

```bash
cd _frontEnd
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Final manual E2E**

1. Log in as client → Profile → Información Personal → "Datos Fiscales" section visible.
2. Click "Consultar" with a real DNI → form fills.
3. Click "Guardar" → reload page → data persists.
4. Add to cart → checkout → Step 1 "Consultar" works → Step 2 banner appears with RUC.
5. Test "Usar esta dirección para envío" → fills input.

- [ ] **Step 5: Commit any remaining fixes (if any)**

```bash
git add -A
git commit -m "chore: final fixes from manual testing" || echo "nothing to commit"
```

---

## Self-Review Notes

### Spec coverage

- ✅ Token in backend only → Task 1 + Task 3
- ✅ "Consultar" explicit button → Task 11 + Task 12
- ✅ Redis cache 24h → Task 6 (setex with `JSONPE_CACHE_TTL_SECONDS`)
- ✅ BD check (`ya_tiene_datos`) → Task 6 (`_usuario_tiene_datos_fiscales`)
- ✅ DNI: nombres+apellidos → Task 6 (`_normalizar_dni`)
- ✅ RUC: razón social + dirección → Task 6 (`_normalizar_ruc`)
- ✅ Copy RUC address to shipping with explicit button → Task 12 Step 6
- ✅ Section inside ProfileInfoPage → Task 11
- ✅ Consult → fill form → Save → Task 11 + Task 12
- ✅ Endpoint `POST /consultas/documento` → Task 8
- ✅ Reuse `/auth/me/datos-fiscales` and `/auth/me` → Task 11 Step 1 (handleGuardar)
- ✅ Rate limiting 10/min → Task 8 (`@_limiter.limit("10/minute")`)
- ✅ Error handling (404/timeout/unavailable) → Task 3 + Task 6
- ✅ Heurística RUC persona natural → Task 6 (`_normalizar_ruc`)
- ✅ Tests: client unit + service unit + router integration → Task 3 + Task 6 + Task 8
- ✅ ARCHITECTURE.md + README → Task 13

### Type / signature consistency

- `JsonPeClient.consultar_dni(dni: str) -> JsonPeDniData` ✅ (used in Task 6)
- `JsonPeClient.consultar_ruc(ruc: str) -> JsonPeRucData` ✅ (used in Task 6)
- `ConsultasService.consultar_documento(tipo, numero) -> DocumentoLookupResult` ✅ (used in Task 8)
- `DocumentoLookupResult` fields: `nombres, apellidos, razon_social, direccion_fiscal, origen, ya_tiene_datos` ✅ consistent between Task 5 (schema), Task 6 (normalize), Task 10 (TS), Task 11 (component)
- Frontend `useConsultarDocumento` returns `{mutateAsync({tipo, numero})}` ✅ matches both consumers (Task 11, Task 12)

### Known gotchas to watch during implementation

1. **slowapi `Request` param order:** slowapi requires `request: Request` as a function parameter for the decorator to inject — keep it first.
2. **Redis `decode_responses=True`:** the project's Redis client uses `decode_responses=True` so `redis.get()` returns `str` directly (not bytes). The service code calls `json.loads()` on it directly, which is safe.
3. **`get_current_user` import:** the function is named `get_current_user` and the alias type is `AuthUser` — both confirmed in `app/security/dependencies.py`.
4. **CRLF warnings:** Git on Windows may warn about line endings — harmless.
5. **Redis availability in tests:** the router integration tests (`test_consultas_router.py`) need a running Redis instance. If the local environment lacks Redis, those 2-3 tests will fail to write cache — either start Redis (`docker-compose up -d redis`) or skip with `pytest -m "not integration"`.
6. **JsonPeClient singleton:** because the client is built once via `lru_cache`, changing `JSONPE_API_TOKEN` in `.env` requires a process restart to take effect (no hot reload of the singleton).
