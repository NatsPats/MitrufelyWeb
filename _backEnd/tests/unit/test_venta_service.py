"""
Mifrufely Web — VentaService Unit Tests (Fase 4)
Tests checkout business logic in isolation (no real DB/NeonDB).

Validates:
  - Empty cart raises BusinessRuleError.
  - Single product purchase: calculates subtotal, creates DetalleVenta.
  - Single package purchase: expands components, creates trazabilidad.
  - Mixed cart (product + package): aggregates totals correctly.
  - Product not found raises NotFoundError.
  - Inactive product raises BusinessRuleError.
  - Insufficient stock (product) raises InsufficientStockError.
  - Insufficient stock (package component) raises InsufficientStockError.
  - Non-existent package raises BusinessRuleError.
  - IGV and base_imponible are calculated correctly.
  - Documento is created inside the transaction.
  - MetodoPago is created with PENDIENTE state.
"""

from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.exceptions import (
    BusinessRuleError,
    InsufficientStockError,
    NotFoundError,
)
from app.infrastructure.database.models.enums import (
    OrigenVentaEnum,
    TipoDocumentoVentaEnum,
    TipoPagoEnum,
    EstadoPagoEnum,
    EstadoVentaEnum,
)
from app.modules.orders.schemas import ItemPaquete, ItemProducto, VentaRequest
from app.modules.orders.service import VentaService


# ── Helpers ────────────────────────────────────────────────────────────────────


def make_producto_db(
    id_producto: int = 1,
    nombre: str = "Torta",
    precio: str = "20.00",
    stock_actual: int = 10,
    estado: bool = True,
) -> MagicMock:
    p = MagicMock()
    p.id_producto = id_producto
    p.nombre = nombre
    p.precio = Decimal(precio)
    p.stock_actual = stock_actual
    p.estado = estado
    return p


def make_paquete_producto(producto: MagicMock, cantidad: int = 1) -> MagicMock:
    pp = MagicMock()
    pp.id_paquete_producto = 1
    pp.id_paquete = 1
    pp.id_producto = producto.id_producto
    pp.cantidad = cantidad
    pp.producto = producto
    return pp


def make_paquete_db(
    id_paquete: int = 1,
    nombre: str = "Caja Premium",
    estado: bool = True,
    componentes: list | None = None,
) -> MagicMock:
    pkg = MagicMock()
    pkg.id_paquete = id_paquete
    pkg.nombre = nombre
    pkg.estado = estado
    pkg.productos = componentes or []
    return pkg


def make_venta_mock(
    id_venta: int = 1,
    id_cliente: int = 1,
    estado: EstadoVentaEnum = EstadoVentaEnum.PENDIENTE,
    estado_pago: EstadoPagoEnum = EstadoPagoEnum.PENDIENTE,
    total: str = "50.00",
    puntos_ganados: int = 5,
) -> MagicMock:
    venta = MagicMock()
    venta.id_venta = id_venta
    venta.id_cliente = id_cliente
    venta.estado = estado
    venta.estado_pago = estado_pago
    venta.total = Decimal(total)
    venta.total_final = Decimal(total)
    venta.shipping_cost_applied = Decimal("0.00")
    venta.free_shipping_applied = False
    venta.cancellation_reason = None
    venta.refund_amount = None
    venta.puntos_ganados = puntos_ganados
    venta.fecha_venta = datetime.now()
    venta.subtotal_productos = Decimal(total)
    venta.costo_envio = Decimal("0.00")
    venta.monto_descuento_cupon = Decimal("0.00")
    venta.base_imponible = Decimal(total)
    venta.igv = Decimal("0.00")
    venta.detalles = []
    venta.paquetes_vendidos = []
    venta.metodos_pago = []
    venta.documentos = []
    return venta


# ── Fixtures ───────────────────────────────────────────────────────────────────


@pytest.fixture
def mock_venta_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.create_venta_transactional = AsyncMock()
    return repo


@pytest.fixture
def mock_paquete_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.get_by_id = AsyncMock(return_value=None)
    return repo


@pytest.fixture
def mock_session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    session.flush = AsyncMock()
    session.refresh = AsyncMock()

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    session.execute = AsyncMock(return_value=mock_result)

    class _Transaction:
        async def __aenter__(self):
            return None

        async def __aexit__(self, *args):
            return None

    session.begin = MagicMock(return_value=_Transaction())
    return session


from datetime import datetime, timezone


def _apply_venta_defaults(obj):
    """Simula defaults del ORM/DB en objetos mockeados tras flush."""
    if hasattr(obj, "puntos_ganados") and not isinstance(getattr(obj, "puntos_ganados", None), int):
        object.__setattr__(obj, "puntos_ganados", 0)
    if hasattr(obj, "fecha_venta") and not isinstance(getattr(obj, "fecha_venta", None), datetime):
        object.__setattr__(obj, "fecha_venta", datetime.now(timezone.utc))
    if hasattr(obj, "id_venta") and obj.id_venta is None:
        object.__setattr__(obj, "id_venta", 1)
    if hasattr(obj, "id_cliente") and obj.id_cliente is None:
        object.__setattr__(obj, "id_cliente", 1)


@pytest.fixture
def service(
    mock_venta_repo: AsyncMock,
    mock_paquete_repo: AsyncMock,
    mock_session: AsyncMock,
) -> VentaService:
    return VentaService(
        repo=mock_venta_repo,
        paquete_repo=mock_paquete_repo,
        session=mock_session,
    )


# ── Tests ──────────────────────────────────────────────────────────────────────


@pytest.mark.unit
class TestVentaServiceCheckout:
    # ── Validaciones de entrada ────────────────────────────────────────────────

    async def test_carrito_vacio_lanza_error(self, service: VentaService) -> None:
        dto = VentaRequest(
            productos=[],
            paquetes=[],
            tipo_pago=TipoPagoEnum.TARJETA,
        )
        with pytest.raises(BusinessRuleError) as exc_info:
            await service.create_checkout(id_cliente=1, dto=dto)
        assert exc_info.value.status_code == 422
        assert "contener al menos" in exc_info.value.message.lower()

    async def test_producto_no_encontrado_lanza_404(
        self,
        service: VentaService,
        mock_session: AsyncMock,
    ) -> None:
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        dto = VentaRequest(
            productos=[ItemProducto(id_producto=999, cantidad=1)],
            paquetes=[],
            tipo_pago=TipoPagoEnum.TARJETA,
        )
        with pytest.raises(NotFoundError) as exc_info:
            await service.create_checkout(id_cliente=1, dto=dto)
        assert exc_info.value.status_code == 404

    async def test_producto_inactivo_lanza_error(
        self,
        service: VentaService,
        mock_session: AsyncMock,
    ) -> None:
        prod = make_producto_db(estado=False)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = prod
        mock_session.execute = AsyncMock(return_value=mock_result)

        dto = VentaRequest(
            productos=[ItemProducto(id_producto=1, cantidad=1)],
            paquetes=[],
            tipo_pago=TipoPagoEnum.TARJETA,
        )
        with pytest.raises(BusinessRuleError) as exc_info:
            await service.create_checkout(id_cliente=1, dto=dto)
        assert exc_info.value.status_code == 422
        assert "disponible" in exc_info.value.message.lower()

    async def test_stock_insuficiente_producto_lanza_error(
        self,
        service: VentaService,
        mock_session: AsyncMock,
    ) -> None:
        prod = make_producto_db(stock_actual=2)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = prod
        mock_session.execute = AsyncMock(return_value=mock_result)

        dto = VentaRequest(
            productos=[ItemProducto(id_producto=1, cantidad=5)],
            paquetes=[],
            tipo_pago=TipoPagoEnum.TARJETA,
        )
        with pytest.raises(InsufficientStockError) as exc_info:
            await service.create_checkout(id_cliente=1, dto=dto)
        assert exc_info.value.status_code == 422
        assert "stock" in exc_info.value.message.lower()

    # ── Paquetes ───────────────────────────────────────────────────────────────

    async def test_paquete_inexistente_lanza_error(
        self,
        service: VentaService,
        mock_paquete_repo: AsyncMock,
    ) -> None:
        mock_paquete_repo.get_by_id.return_value = None

        dto = VentaRequest(
            productos=[],
            paquetes=[ItemPaquete(id_paquete=999, cantidad=1)],
            tipo_pago=TipoPagoEnum.TARJETA,
        )
        with pytest.raises(BusinessRuleError) as exc_info:
            await service.create_checkout(id_cliente=1, dto=dto)
        assert exc_info.value.status_code == 422

    async def test_stock_insuficiente_componente_paquete_lanza_error(
        self,
        service: VentaService,
        mock_paquete_repo: AsyncMock,
    ) -> None:
        prod_sin_stock = make_producto_db(stock_actual=0)
        paquete = make_paquete_db(componentes=[make_paquete_producto(prod_sin_stock, cantidad=1)])
        mock_paquete_repo.get_by_id.return_value = paquete

        dto = VentaRequest(
            productos=[],
            paquetes=[ItemPaquete(id_paquete=1, cantidad=1)],
            tipo_pago=TipoPagoEnum.TARJETA,
        )
        with pytest.raises(InsufficientStockError) as exc_info:
            await service.create_checkout(id_cliente=1, dto=dto)
        assert exc_info.value.status_code == 422
        assert "stock insuficiente" in exc_info.value.message.lower()

    # ── Cálculos de totales e IGV ─────────────────────────────────────────────

    async def test_igv_y_base_imponible_calculados(
        self,
        service: VentaService,
        mock_session: AsyncMock,
    ) -> None:
        prod = make_producto_db(precio="118.00", stock_actual=5)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = prod
        mock_session.execute = AsyncMock(return_value=mock_result)

        captured: list = []
        session_add_calls: list = []

        mock_session.add.side_effect = lambda obj: session_add_calls.append(obj)

        async def flush_apply():
            for obj in session_add_calls:
                _apply_venta_defaults(obj)

        mock_session.flush.side_effect = flush_apply

        dto = VentaRequest(
            productos=[ItemProducto(id_producto=1, cantidad=1)],
            paquetes=[],
            tipo_pago=TipoPagoEnum.TARJETA,
        )

        await service.create_checkout(id_cliente=1, dto=dto)

        venta_obj = None
        for obj in session_add_calls:
            if type(obj).__name__ == "Venta":
                venta_obj = obj
                break

        assert venta_obj is not None
        assert venta_obj.subtotal_productos == Decimal("118.00")
        assert venta_obj.total == Decimal("118.00")
        assert venta_obj.base_imponible == Decimal("100.00")
        assert venta_obj.igv == Decimal("18.00")
        assert len(venta_obj.detalles) == 1

    async def test_paquete_acumula_precio_en_total(
        self,
        service: VentaService,
        mock_paquete_repo: AsyncMock,
        mock_session: AsyncMock,
    ) -> None:
        prod1 = make_producto_db(id_producto=1, precio="25.00", stock_actual=10)
        prod2 = make_producto_db(id_producto=2, precio="10.00", stock_actual=10)
        paquete = make_paquete_db(
            componentes=[
                make_paquete_producto(prod1, cantidad=2),
                make_paquete_producto(prod2, cantidad=1),
            ]
        )
        mock_paquete_repo.get_by_id.return_value = paquete

        session_add_calls: list = []
        mock_session.add.side_effect = lambda obj: session_add_calls.append(obj)

        async def flush_apply():
            for obj in session_add_calls:
                _apply_venta_defaults(obj)

        mock_session.flush.side_effect = flush_apply

        dto = VentaRequest(
            productos=[],
            paquetes=[ItemPaquete(id_paquete=1, cantidad=1)],
            tipo_pago=TipoPagoEnum.TARJETA,
        )

        await service.create_checkout(id_cliente=1, dto=dto)

        venta_obj = None
        for obj in session_add_calls:
            if type(obj).__name__ == "Venta":
                venta_obj = obj
                break

        assert venta_obj is not None
        assert venta_obj.total == Decimal("60.00")
        assert len(venta_obj.detalles) == 2

    async def test_checkout_mixto_producto_y_paquete(
        self,
        service: VentaService,
        mock_session: AsyncMock,
        mock_paquete_repo: AsyncMock,
    ) -> None:
        prod_individual = make_producto_db(id_producto=10, precio="15.00", stock_actual=5)
        prod_en_paquete = make_producto_db(id_producto=20, precio="10.00", stock_actual=5)

        paquete = make_paquete_db(componentes=[make_paquete_producto(prod_en_paquete, cantidad=1)])
        mock_paquete_repo.get_by_id.return_value = paquete

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = prod_individual
        mock_session.execute = AsyncMock(return_value=mock_result)

        session_add_calls: list = []
        mock_session.add.side_effect = lambda obj: session_add_calls.append(obj)

        async def flush_apply():
            for obj in session_add_calls:
                _apply_venta_defaults(obj)

        mock_session.flush.side_effect = flush_apply

        dto = VentaRequest(
            productos=[ItemProducto(id_producto=10, cantidad=1)],
            paquetes=[ItemPaquete(id_paquete=1, cantidad=1)],
            tipo_pago=TipoPagoEnum.TARJETA,
        )

        await service.create_checkout(id_cliente=1, dto=dto)

        venta_obj = None
        for obj in session_add_calls:
            if type(obj).__name__ == "Venta":
                venta_obj = obj
                break

        assert venta_obj is not None
        assert venta_obj.total == Decimal("25.00")
        assert len(venta_obj.detalles) == 2
        assert len(venta_obj.paquetes_vendidos) == 1

    async def test_checkout_package_with_category_coupon(
        self,
        service: VentaService,
        mock_session: AsyncMock,
        mock_paquete_repo: AsyncMock,
    ) -> None:
        from app.infrastructure.database.models.cupones import CuponCliente, CuponMaestro
        from app.infrastructure.database.models.enums import EstadoCuponEnum, OrigenCuponEnum
        from datetime import datetime, timedelta

        # 1. Producto 1 (id_categoria=3, precio=S/. 10)
        prod1 = make_producto_db(id_producto=1, precio="10.00", stock_actual=10)
        prod1.id_categoria = 3

        # 2. Producto 2 (id_categoria=5, precio=S/. 20)
        prod2 = make_producto_db(id_producto=2, precio="20.00", stock_actual=10)
        prod2.id_categoria = 5

        # 3. Paquete (contiene 2 de prod1 y 1 de prod2)
        # Precio del paquete: 2 * 10 + 1 * 20 = S/. 40
        # Categoría 3 subtotal elegible dentro del paquete: 2 * 10 = S/. 20 per package
        paquete = make_paquete_db(
            id_paquete=1,
            nombre="Combo Test",
            componentes=[
                make_paquete_producto(prod1, cantidad=2),
                make_paquete_producto(prod2, cantidad=1),
            ]
        )
        mock_paquete_repo.get_by_id.return_value = paquete

        # 4. Cupón maestro con restricción a categoría 3 y 50% de descuento
        cupon_maestro = CuponMaestro(
            id_cupon=1,
            nombre="Cupon Cat 3",
            porcentaje_descuento=Decimal("50.00"),
            id_categoria=3,
            dias_vigencia=7,
            estado=True
        )
        cupon_cliente = CuponCliente(
            id_cupon_cliente=99,
            id_cliente=1,
            id_cupon=1,
            codigo_unico="CAT3-50",
            estado=EstadoCuponEnum.DISPONIBLE,
            origen=OrigenCuponEnum.PREMIO_JUEGO,
            fecha_adquisicion=datetime.now(),
            fecha_expiracion=datetime.now() + timedelta(days=7),
            cupon_maestro=cupon_maestro
        )

        # 5. Mockear las ejecuciones de SQLAlchemy en la session
        from app.infrastructure.database.models.usuarios import Cliente
        mock_cliente = Cliente(id_cliente=1, id_usuario=1)

        def mock_execute(stmt):
            stmt_str = str(stmt).lower()
            res = MagicMock()
            if "cupon" in stmt_str or "id_cupon_cliente" in stmt_str:
                res.scalar_one_or_none.return_value = cupon_cliente
            elif "cliente" in stmt_str:
                res.scalar_one_or_none.return_value = mock_cliente
            else:
                res.scalar_one_or_none.return_value = None
            return res

        mock_session.execute.side_effect = mock_execute

        # 6. Request de checkout con 2 paquetes
        # Total subtotal de productos en los 2 paquetes: 2 * 40 = S/. 80
        # Total elegible para descuento (Cat 3): 2 * 20 = S/. 40
        # Descuento (50%): S/. 20
        dto = VentaRequest(
            productos=[],
            paquetes=[ItemPaquete(id_paquete=1, cantidad=2)],
            tipo_pago=TipoPagoEnum.TARJETA,
            id_cupon_cliente=99
        )

        session_add_calls: list = []
        mock_session.add.side_effect = lambda obj: session_add_calls.append(obj)

        async def flush_apply():
            for obj in session_add_calls:
                _apply_venta_defaults(obj)
        mock_session.flush.side_effect = flush_apply

        # 7. Ejecutar el checkout
        await service.create_checkout(id_cliente=1, dto=dto)

        # 8. Validar resultados
        venta_obj = next(obj for obj in session_add_calls if type(obj).__name__ == "Venta")
        assert venta_obj.subtotal_productos == Decimal("80.00")
        assert venta_obj.monto_descuento_cupon == Decimal("20.00")
        assert venta_obj.total_final == Decimal("60.00")  # 80 - 20

    # ── Documento y MetodoPago ────────────────────────────────────────────────

    async def test_crea_documento_boleta_en_checkout(
        self,
        service: VentaService,
        mock_session: AsyncMock,
    ) -> None:
        prod = make_producto_db(precio="50.00", stock_actual=5)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = prod
        mock_session.execute = AsyncMock(return_value=mock_result)

        session_add_calls: list = []
        mock_session.add.side_effect = lambda obj: session_add_calls.append(obj)

        async def flush_apply():
            for obj in session_add_calls:
                _apply_venta_defaults(obj)

        mock_session.flush.side_effect = flush_apply

        dto = VentaRequest(
            productos=[ItemProducto(id_producto=1, cantidad=1)],
            paquetes=[],
            tipo_pago=TipoPagoEnum.TARJETA,
        )

        await service.create_checkout(
            id_cliente=1,
            dto=dto,
            tipo_documento=TipoDocumentoVentaEnum.BOLETA,
        )

        documentos = [o for o in session_add_calls if type(o).__name__ == "Documento"]
        assert len(documentos) == 1
        assert documentos[0].tipo_documento == TipoDocumentoVentaEnum.BOLETA
        assert documentos[0].id_venta == 1

    async def test_crea_metodo_pago_tarjeta_aprobado(
        self,
        service: VentaService,
        mock_session: AsyncMock,
    ) -> None:
        prod = make_producto_db(precio="30.00", stock_actual=3)
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = prod
        mock_session.execute = AsyncMock(return_value=mock_result)

        session_add_calls: list = []
        mock_session.add.side_effect = lambda obj: session_add_calls.append(obj)

        async def flush_apply():
            for obj in session_add_calls:
                _apply_venta_defaults(obj)

        mock_session.flush.side_effect = flush_apply

        dto = VentaRequest(
            productos=[ItemProducto(id_producto=1, cantidad=1)],
            paquetes=[],
            tipo_pago=TipoPagoEnum.TARJETA,
        )

        await service.create_checkout(id_cliente=1, dto=dto)

        venta_obj = None
        for obj in session_add_calls:
            if type(obj).__name__ == "Venta":
                venta_obj = obj
                break

        assert venta_obj is not None
        pagos = venta_obj.metodos_pago
        assert len(pagos) == 1
        assert pagos[0].tipo_pago == TipoPagoEnum.TARJETA
        assert pagos[0].monto == Decimal("30.00")
        assert pagos[0].estado_transaccion == "APROBADO"


@pytest.mark.unit
class TestVentaServiceConfirmarPago:
    async def test_confirmar_pago_venta_no_encontrada(
        self,
        service: VentaService,
        mock_session: AsyncMock,
    ) -> None:
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(NotFoundError):
            await service.confirmar_pago(id_venta=999, id_usuario=999)

    async def test_confirmar_pago_venta_anulada(
        self,
        service: VentaService,
        mock_session: AsyncMock,
    ) -> None:
        venta = make_venta_mock(estado=EstadoVentaEnum.ANULADO)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = venta
        mock_session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(BusinessRuleError) as exc_info:
            await service.confirmar_pago(id_venta=1, id_usuario=1)
        assert "anulado" in exc_info.value.message.lower()

    async def test_confirmar_pago_ya_entregada(
        self,
        service: VentaService,
        mock_session: AsyncMock,
    ) -> None:
        venta = make_venta_mock(estado=EstadoVentaEnum.ENTREGADO)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = venta
        mock_session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(BusinessRuleError) as exc_info:
            await service.confirmar_pago(id_venta=1, id_usuario=1)
        assert "entregado" in exc_info.value.message.lower()

    async def test_confirmar_pago_exitoso(
        self,
        service: VentaService,
        mock_session: AsyncMock,
    ) -> None:
        pago_mock = MagicMock()
        pago_mock.tipo_pago = "TARJETA"
        pago_mock.monto = Decimal("50.00")
        pago_mock.estado_transaccion = "PENDIENTE"
        pago_mock.codigo_transaccion = None
        pago_mock.proveedor = None
        pago_mock.fecha_pago = None

        venta = make_venta_mock(estado=EstadoVentaEnum.PENDIENTE, estado_pago=EstadoPagoEnum.PENDIENTE)
        venta.metodos_pago = [pago_mock]

        mock_result_venta = MagicMock()
        mock_result_venta.scalar_one_or_none.return_value = venta

        mock_session.execute = AsyncMock(return_value=mock_result_venta)

        result = await service.confirmar_pago(id_venta=1, id_usuario=1)

        assert result.estado == "PAGADO"
        assert result.estado_pago == "PAGADO"
        assert pago_mock.estado_transaccion == "APROBADO"


@pytest.mark.unit
class TestVentaServiceConsultas:
    async def test_get_by_id_no_encontrada(
        self,
        service: VentaService,
        mock_venta_repo: AsyncMock,
    ) -> None:
        mock_venta_repo.get_by_id.return_value = None

        with pytest.raises(NotFoundError):
            await service.get_by_id(999)

    async def test_get_by_cliente_vacio(
        self,
        service: VentaService,
        mock_venta_repo: AsyncMock,
    ) -> None:
        mock_venta_repo.find_by_cliente.return_value = []

        result = await service.get_by_cliente(id_cliente=1)
        assert result == []
