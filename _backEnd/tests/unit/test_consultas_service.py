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
