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
