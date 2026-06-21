"""
Mifrufely Web — Order State Machine
Implementa la máquina de estados finitos (FSM) para el ciclo de vida de un pedido.

Transiciones válidas:
  PENDIENTE   → PAGADO | CANCELADO
  PAGADO      → PREPARANDO | CANCELADO
  PREPARANDO  → EN_CAMINO | CANCELADO
  EN_CAMINO   → ENTREGADO
  ENTREGADO   → DEVUELTO
  CANCELADO   → REEMBOLSADO
  DEVUELTO    → REEMBOLSADO
  REEMBOLSADO → (terminal)
  ANULADO     → (terminal — solo Celery expire)

Uso:
    from app.modules.orders.state_machine import validate_transition, VALID_TRANSITIONS
    validate_transition(venta.estado, EstadoVentaEnum.PAGADO)  # lanza si inválido
"""

from app.core.exceptions import BusinessRuleError
from app.infrastructure.database.models.enums import EstadoVentaEnum

# Mapa de transiciones: estado_actual → [estados_destino_permitidos]
VALID_TRANSITIONS: dict[EstadoVentaEnum, list[EstadoVentaEnum]] = {
    EstadoVentaEnum.PENDIENTE: [
        EstadoVentaEnum.PAGADO,
        EstadoVentaEnum.CANCELADO,
    ],
    EstadoVentaEnum.PAGADO: [
        EstadoVentaEnum.PREPARANDO,
        EstadoVentaEnum.CANCELADO,
    ],
    EstadoVentaEnum.PREPARANDO: [
        EstadoVentaEnum.EN_CAMINO,
        EstadoVentaEnum.CANCELADO,
    ],
    EstadoVentaEnum.EN_CAMINO: [
        EstadoVentaEnum.ENTREGADO,
    ],
    EstadoVentaEnum.ENTREGADO: [
        EstadoVentaEnum.DEVUELTO,
    ],
    EstadoVentaEnum.CANCELADO: [
        EstadoVentaEnum.REEMBOLSADO,
    ],
    EstadoVentaEnum.DEVUELTO: [
        EstadoVentaEnum.REEMBOLSADO,
    ],
    EstadoVentaEnum.REEMBOLSADO: [],   # Estado terminal
    EstadoVentaEnum.ANULADO: [],        # Estado terminal (Celery expire)
}

# Etiquetas en español para mensajes de error
_ESTADO_LABELS: dict[EstadoVentaEnum, str] = {
    EstadoVentaEnum.PENDIENTE: "Pendiente",
    EstadoVentaEnum.PAGADO: "Pagado",
    EstadoVentaEnum.PREPARANDO: "En Preparación",
    EstadoVentaEnum.EN_CAMINO: "En Camino",
    EstadoVentaEnum.ENTREGADO: "Entregado",
    EstadoVentaEnum.CANCELADO: "Cancelado",
    EstadoVentaEnum.DEVUELTO: "Devuelto",
    EstadoVentaEnum.REEMBOLSADO: "Reembolsado",
    EstadoVentaEnum.ANULADO: "Anulado",
}

# Progreso del pedido en porcentaje (para tracking visual)
ESTADO_PROGRESO: dict[EstadoVentaEnum, int] = {
    EstadoVentaEnum.PENDIENTE: 10,
    EstadoVentaEnum.PAGADO: 25,
    EstadoVentaEnum.PREPARANDO: 50,
    EstadoVentaEnum.EN_CAMINO: 75,
    EstadoVentaEnum.ENTREGADO: 100,
    EstadoVentaEnum.CANCELADO: 0,
    EstadoVentaEnum.DEVUELTO: 0,
    EstadoVentaEnum.REEMBOLSADO: 0,
    EstadoVentaEnum.ANULADO: 0,
}


def validate_transition(
    estado_actual: EstadoVentaEnum,
    nuevo_estado: EstadoVentaEnum,
) -> None:
    """
    Valida que la transición de estado sea permitida por la FSM.

    Args:
        estado_actual: Estado actual de la venta.
        nuevo_estado:  Estado al que se desea transicionar.

    Raises:
        BusinessRuleError: Si la transición no es válida.

    Example:
        validate_transition(EstadoVentaEnum.PENDIENTE, EstadoVentaEnum.PAGADO)  # OK
        validate_transition(EstadoVentaEnum.PENDIENTE, EstadoVentaEnum.ENTREGADO)  # Raises
    """
    permitidos = VALID_TRANSITIONS.get(estado_actual, [])

    if nuevo_estado not in permitidos:
        actual_label = _ESTADO_LABELS.get(estado_actual, estado_actual.value)
        nuevo_label = _ESTADO_LABELS.get(nuevo_estado, nuevo_estado.value)

        if not permitidos:
            raise BusinessRuleError(
                f"El pedido está en estado '{actual_label}' que es un estado terminal. "
                f"No se permiten más transiciones."
            )

        permitidos_labels = [_ESTADO_LABELS.get(e, e.value) for e in permitidos]
        raise BusinessRuleError(
            f"Transición de estado inválida: '{actual_label}' → '{nuevo_label}'. "
            f"Desde '{actual_label}' solo se puede transicionar a: "
            f"{', '.join(permitidos_labels)}."
        )


def get_progress(estado: EstadoVentaEnum) -> int:
    """Retorna el porcentaje de progreso del pedido para la barra visual."""
    return ESTADO_PROGRESO.get(estado, 0)


def is_terminal(estado: EstadoVentaEnum) -> bool:
    """Retorna True si el estado es terminal (no permite más transiciones)."""
    return len(VALID_TRANSITIONS.get(estado, [])) == 0


def can_cancel(estado: EstadoVentaEnum) -> bool:
    """Retorna True si desde este estado se puede cancelar el pedido."""
    return EstadoVentaEnum.CANCELADO in VALID_TRANSITIONS.get(estado, [])


def can_request_refund(estado: EstadoVentaEnum) -> bool:
    """Retorna True si desde este estado se puede solicitar reembolso."""
    return EstadoVentaEnum.REEMBOLSADO in VALID_TRANSITIONS.get(estado, [])
