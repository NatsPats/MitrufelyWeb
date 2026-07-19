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
