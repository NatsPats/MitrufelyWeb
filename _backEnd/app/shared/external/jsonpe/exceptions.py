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
