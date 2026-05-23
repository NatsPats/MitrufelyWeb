"""
Mifrufely Web — Domain Exception Hierarchy
Centralized, typed exception tree for the entire application
"""

from http import HTTPStatus


class MifrufelyBaseError(Exception):
    """Root of the Mifrufely exception hierarchy."""

    status_code: int = HTTPStatus.INTERNAL_SERVER_ERROR
    error_code: str = "INTERNAL_ERROR"
    message: str = "Error interno del servidor"

    def __init__(self, message: str | None = None) -> None:
        self.message = message or self.__class__.message
        super().__init__(self.message)

    def to_dict(self) -> dict:
        return {
            "error_code": self.error_code,
            "message": self.message,
        }


# ── HTTP 400 ─────────────────────────────────────────────────────────────────

class ValidationError(MifrufelyBaseError):
    status_code = HTTPStatus.BAD_REQUEST
    error_code = "VALIDATION_ERROR"
    message = "Error de validación"


class BusinessRuleError(MifrufelyBaseError):
    status_code = HTTPStatus.UNPROCESSABLE_ENTITY
    error_code = "BUSINESS_RULE_ERROR"
    message = "Regla de negocio violada"


# ── HTTP 401 ─────────────────────────────────────────────────────────────────

class UnauthorizedError(MifrufelyBaseError):
    status_code = HTTPStatus.UNAUTHORIZED
    error_code = "UNAUTHORIZED"
    message = "No autenticado"


class InvalidTokenError(MifrufelyBaseError):
    status_code = HTTPStatus.UNAUTHORIZED
    error_code = "INVALID_TOKEN"
    message = "Token inválido o expirado"


class InvalidCredentialsError(MifrufelyBaseError):
    status_code = HTTPStatus.UNAUTHORIZED
    error_code = "INVALID_CREDENTIALS"
    message = "Credenciales incorrectas"


# ── HTTP 403 ─────────────────────────────────────────────────────────────────

class ForbiddenError(MifrufelyBaseError):
    status_code = HTTPStatus.FORBIDDEN
    error_code = "FORBIDDEN"
    message = "Acceso denegado"


class InsufficientRoleError(MifrufelyBaseError):
    status_code = HTTPStatus.FORBIDDEN
    error_code = "INSUFFICIENT_ROLE"
    message = "Rol insuficiente para esta operación"


# ── HTTP 404 ─────────────────────────────────────────────────────────────────

class NotFoundError(MifrufelyBaseError):
    status_code = HTTPStatus.NOT_FOUND
    error_code = "NOT_FOUND"
    message = "Recurso no encontrado"


# ── HTTP 409 ─────────────────────────────────────────────────────────────────

class ConflictError(MifrufelyBaseError):
    status_code = HTTPStatus.CONFLICT
    error_code = "CONFLICT"
    message = "Conflicto con el estado actual del recurso"


class DuplicateResourceError(MifrufelyBaseError):
    status_code = HTTPStatus.CONFLICT
    error_code = "DUPLICATE_RESOURCE"
    message = "El recurso ya existe"


# ── HTTP 422 ─────────────────────────────────────────────────────────────────

class InsufficientStockError(MifrufelyBaseError):
    status_code = HTTPStatus.UNPROCESSABLE_ENTITY
    error_code = "INSUFFICIENT_STOCK"
    message = "Stock insuficiente"


class InsufficientSweetCoinsError(MifrufelyBaseError):
    status_code = HTTPStatus.UNPROCESSABLE_ENTITY
    error_code = "INSUFFICIENT_SWEETCOINS"
    message = "SweetCoins insuficientes"


# ── HTTP 500 ─────────────────────────────────────────────────────────────────

class DatabaseError(MifrufelyBaseError):
    status_code = HTTPStatus.INTERNAL_SERVER_ERROR
    error_code = "DATABASE_ERROR"
    message = "Error de base de datos"


class ExternalServiceError(MifrufelyBaseError):
    status_code = HTTPStatus.SERVICE_UNAVAILABLE
    error_code = "EXTERNAL_SERVICE_ERROR"
    message = "Error en servicio externo"
