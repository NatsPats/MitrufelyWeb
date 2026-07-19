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
