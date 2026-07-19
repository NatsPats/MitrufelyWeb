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
