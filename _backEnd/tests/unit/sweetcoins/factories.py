"""
factories.py — Fábricas de objetos de dominio para tests unitarios de SweetCoins.

Uso:
    from tests.unit.sweetcoins.factories import make_cupon_maestro, make_config

No requiere base de datos — crea instancias ORM con valores por defecto
sobreescribibles mediante kwargs.
"""

from datetime import datetime, timezone
from decimal import Decimal

from app.infrastructure.database.models.cupones import CuponMaestro, CuponCliente
from app.infrastructure.database.models.enums import EstadoCuponEnum, OrigenCuponEnum, TipoMovimientoPuntosEnum
from app.infrastructure.database.models.recompensas import ConfiguracionRecompensas, MovimientoPuntos


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _future(days: int = 30) -> datetime:
    from datetime import timedelta
    return _now() + timedelta(days=days)


# ── ConfiguracionRecompensas ──────────────────────────────────────────────────

def make_config(**kwargs) -> ConfiguracionRecompensas:
    """Factory de ConfiguracionRecompensas con valores sensatos por defecto."""
    defaults = {
        "id_config": 1,
        "tasa_conversion": Decimal("0.1000"),
        "limite_puntos_billetera": 50_000,
        "dias_expiracion": 365,
        "estado": True,
    }
    defaults.update(kwargs)
    return ConfiguracionRecompensas(**defaults)


# ── CuponMaestro ──────────────────────────────────────────────────────────────

_cupon_id_counter = 100


def make_cupon_maestro(**kwargs) -> CuponMaestro:
    """Factory de CuponMaestro. Genera IDs únicos por defecto."""
    global _cupon_id_counter
    _cupon_id_counter += 1
    defaults = {
        "id_cupon": _cupon_id_counter,
        "nombre": f"Cupón Test {_cupon_id_counter}",
        "descripcion": "Cupón de prueba autogenerado.",
        "porcentaje_descuento": Decimal("10.00"),
        "costo_puntos": 500,
        "dias_vigencia": 30,
        "estado": True,
    }
    defaults.update(kwargs)
    return CuponMaestro(**defaults)


def make_cupon_maestro_gratuito(**kwargs) -> CuponMaestro:
    """Factory de cupón que NO cuesta puntos (origen REGALO_ADMIN o PREMIO_JUEGO)."""
    return make_cupon_maestro(costo_puntos=None, **kwargs)


def make_cupon_maestro_disabled(**kwargs) -> CuponMaestro:
    """Factory de cupón deshabilitado."""
    return make_cupon_maestro(estado=False, **kwargs)


# ── CuponCliente ──────────────────────────────────────────────────────────────

_cupon_cliente_id_counter = 200


def make_cupon_cliente(
    id_cliente: int = 1,
    cupon_maestro: CuponMaestro | None = None,
    **kwargs,
) -> CuponCliente:
    """Factory de CuponCliente. Vincula un CuponMaestro (o crea uno por defecto)."""
    global _cupon_cliente_id_counter
    _cupon_cliente_id_counter += 1

    if cupon_maestro is None:
        cupon_maestro = make_cupon_maestro()

    defaults = {
        "id_cupon_cliente": _cupon_cliente_id_counter,
        "id_cliente": id_cliente,
        "id_cupon": cupon_maestro.id_cupon,
        "codigo_unico": f"TST-{_cupon_cliente_id_counter:04d}",
        "estado": EstadoCuponEnum.DISPONIBLE,
        "origen": OrigenCuponEnum.COMPRA_PUNTOS,
        "fecha_adquisicion": _now(),
        "fecha_expiracion": _future(30),
        "fecha_uso": None,
    }
    defaults.update(kwargs)
    instance = CuponCliente(**defaults)
    instance.cupon_maestro = cupon_maestro   # relación en memoria
    return instance


def make_cupon_cliente_expirado(**kwargs) -> CuponCliente:
    """Factory de cupón ya expirado."""
    from datetime import timedelta
    return make_cupon_cliente(
        fecha_expiracion=_now() - timedelta(days=1),
        estado=EstadoCuponEnum.EXPIRADO,
        **kwargs,
    )


def make_cupon_cliente_usado(**kwargs) -> CuponCliente:
    """Factory de cupón ya utilizado en una venta."""
    return make_cupon_cliente(
        estado=EstadoCuponEnum.USADO,
        fecha_uso=_now(),
        **kwargs,
    )


# ── MovimientoPuntos ──────────────────────────────────────────────────────────

_mov_id_counter = 300


def make_movimiento_puntos(
    id_cliente: int = 1,
    tipo: TipoMovimientoPuntosEnum = TipoMovimientoPuntosEnum.ACUMULACION_VENTA,
    cantidad: int = 500,
    saldo_resultante: int = 500,
    **kwargs,
) -> MovimientoPuntos:
    """Factory de MovimientoPuntos."""
    global _mov_id_counter
    _mov_id_counter += 1
    defaults = {
        "id_movimiento_punto": _mov_id_counter,
        "id_cliente": id_cliente,
        "id_venta": None,
        "id_cupon_cliente": None,
        "id_config": 1,
        "tipo_movimiento": tipo,
        "cantidad": cantidad,
        "saldo_puntos_resultante": saldo_resultante,
        "fecha_movimiento": _now(),
        "fecha_expiracion": _future(365),
        "justificacion": None,
    }
    defaults.update(kwargs)
    return MovimientoPuntos(**defaults)
