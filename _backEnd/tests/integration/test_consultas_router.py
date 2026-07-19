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
        from app.shared.external.jsonpe.schemas import JsonPeDniData
        mock_dni_data = JsonPeDniData(
            numero="27427864",
            nombres="JOSE PEDRO",
            apellido_paterno="CASTILLO",
            apellido_materno="TERRONES",
            direccion="",
            direccion_completa="",
        )

        with patch.object(JsonPeClient, "consultar_dni", new=AsyncMock(return_value=mock_dni_data)):
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
        from app.shared.external.jsonpe.exceptions import JsonPeNotFound
        with patch.object(JsonPeClient, "consultar_dni", new=AsyncMock(side_effect=JsonPeNotFound("DNI no encontrado"))):
            from app.infrastructure.cache.redis_client import redis_client
            await redis_client.delete("jsonpe:dni:00000000")
            resp = await client.post(
                "/consultas/documento",
                json={"tipo_documento": "DNI", "numero_documento": "00000000"},
                headers=auth_headers_client,
            )
        assert resp.status_code == 404
