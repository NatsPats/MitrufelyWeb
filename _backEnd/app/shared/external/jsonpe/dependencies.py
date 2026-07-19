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
