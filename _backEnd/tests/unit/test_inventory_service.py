"""
Mifrufely Web — InventoryService Unit Tests (Fase 3)
Tests del servicio de inventario en aislamiento (sin DB real).

Valida:
  - create_lote: éxito, FK violada (producto no existe), trigger rechaza fecha pasada.
  - apply_adjustment: éxito AJUSTE_POSITIVO, MERMA, rechazo en tipo inválido (schema),
                      rechazo de trigger en lote VENCIDO, stock insuficiente.
  - get_kardex: retorna respuesta paginada correctamente.
  - get_next_fefo_lot: retorna NextLotResponse, 404 sin lotes vigentes.
  - get_reconciliation: lista todos y filtra solo descuadrados.
  - LoteCreateRequest validator: rechaza fecha pasada, acepta None.
  - AjusteStockRequest validator: rechaza tipo_movimiento inválido (INGRESO_COMPRA).
"""

from datetime import datetime, timedelta, UTC
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.exc import DBAPIError, IntegrityError

from app.core.exceptions import BusinessRuleError, NotFoundError
from app.infrastructure.database.models.catalogo import Lote, MovimientoStock
from app.infrastructure.database.models.enums import (
    EstadoLoteEnum,
    TipoMovimientoStockEnum,
)
from app.modules.inventory.schemas import (
    AjusteStockRequest,
    LoteCreateRequest,
)
from app.modules.inventory.service import InventoryService


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_lote(
    id_lote: int = 1,
    id_producto: int = 10,
    cantidad_disponible: int = 50,
    estado: EstadoLoteEnum = EstadoLoteEnum.VIGENTE,
    fecha_vencimiento: datetime | None = None,
) -> MagicMock:
    lote = MagicMock(spec=Lote)
    lote.id_lote = id_lote
    lote.id_producto = id_producto
    lote.fecha_ingreso = datetime.now(UTC)
    lote.fecha_vencimiento = fecha_vencimiento
    lote.cantidad_inicial = cantidad_disponible
    lote.cantidad_disponible = cantidad_disponible
    lote.estado_lote = estado
    return lote


def make_movimiento(
    id_movimiento: int = 1,
    tipo: TipoMovimientoStockEnum = TipoMovimientoStockEnum.AJUSTE_POSITIVO,
    stock_resultante: int = 60,
) -> MagicMock:
    mov = MagicMock(spec=MovimientoStock)
    mov.id_movimiento_stock = id_movimiento
    mov.id_producto = 10
    mov.id_lote = 1
    mov.id_venta = None
    mov.id_usuario = 1
    mov.tipo_movimiento = tipo
    mov.cantidad = 10
    mov.stock_resultante = stock_resultante
    mov.costo_unitario = None
    mov.fecha_movimiento = datetime.now(UTC)
    mov.observacion = None
    return mov


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_repo() -> AsyncMock:
    repo = AsyncMock()
    repo.create_lote = AsyncMock()
    repo.get_lotes_by_producto = AsyncMock(return_value=[])
    repo.get_next_fefo_lot = AsyncMock(return_value=None)
    repo.create_movimiento = AsyncMock()
    repo.get_kardex_by_producto = AsyncMock(return_value=([], 0))
    repo.get_reconciliation_all = AsyncMock(return_value=[])
    return repo


@pytest.fixture
def mock_session() -> AsyncMock:
    """Session mock que simula el context manager begin()."""
    session = AsyncMock()
    cm = AsyncMock()
    cm.__aenter__ = AsyncMock(return_value=None)
    cm.__aexit__ = AsyncMock(return_value=None)
    session.begin = MagicMock(return_value=cm)
    return session


@pytest.fixture
def service(mock_repo: AsyncMock, mock_session: AsyncMock) -> InventoryService:
    return InventoryService(repo=mock_repo, session=mock_session)


# ── Schema Validators ─────────────────────────────────────────────────────────

@pytest.mark.unit
class TestInventorySchemas:

    def test_lote_create_fecha_pasada_lanza_error(self) -> None:
        """fecha_vencimiento en el pasado debe rechazarse en el schema."""
        with pytest.raises(Exception, match="posterior a la fecha actual"):
            LoteCreateRequest(
                id_producto=1,
                cantidad_inicial=10,
                fecha_vencimiento=datetime.now(UTC) - timedelta(days=1),
            )

    def test_lote_create_sin_fecha_es_valido(self) -> None:
        """fecha_vencimiento=None es válida (lote sin expiración)."""
        req = LoteCreateRequest(id_producto=1, cantidad_inicial=10, fecha_vencimiento=None)
        assert req.fecha_vencimiento is None

    def test_lote_create_fecha_futura_es_valida(self) -> None:
        """fecha_vencimiento en el futuro debe aceptarse."""
        req = LoteCreateRequest(
            id_producto=1,
            cantidad_inicial=10,
            fecha_vencimiento=datetime.now(UTC) + timedelta(days=30),
        )
        assert req.fecha_vencimiento is not None

    def test_ajuste_tipo_invalido_lanza_error(self) -> None:
        """Tipo INGRESO_COMPRA no permitido en ajustes manuales."""
        with pytest.raises(Exception, match="Tipo de movimiento inválido"):
            AjusteStockRequest(
                id_producto=1,
                id_lote=1,
                tipo_movimiento=TipoMovimientoStockEnum.INGRESO_COMPRA,
                cantidad=5,
            )

    def test_ajuste_tipo_valido_aceptado(self) -> None:
        """MERMA debe ser aceptado como tipo de ajuste."""
        req = AjusteStockRequest(
            id_producto=1,
            id_lote=2,
            tipo_movimiento=TipoMovimientoStockEnum.MERMA,
            cantidad=3,
        )
        assert req.tipo_movimiento == TipoMovimientoStockEnum.MERMA


# ── create_lote ───────────────────────────────────────────────────────────────

@pytest.mark.unit
class TestCreateLote:

    async def test_crea_lote_exitosamente(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Un lote válido es creado y retorna LoteResponse."""
        lote_mock = make_lote()
        mock_repo.create_lote.return_value = lote_mock

        payload = LoteCreateRequest(id_producto=10, cantidad_inicial=50)

        result = await service.create_lote(payload, id_usuario=1)

        assert result.id_lote == 1
        assert result.cantidad_disponible == 50
        mock_repo.create_lote.assert_called_once()

    async def test_producto_no_existe_lanza_not_found(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """IntegrityError (FK) debe convertirse en NotFoundError."""
        # Simular IntegrityError de SQLAlchemy
        orig = MagicMock()
        orig.pgcode = "23503"
        mock_repo.create_lote.side_effect = IntegrityError(
            "INSERT", {}, orig
        )

        payload = LoteCreateRequest(id_producto=999, cantidad_inicial=10)

        with pytest.raises(NotFoundError):
            await service.create_lote(payload, id_usuario=1)

    async def test_trigger_rechaza_fecha_pasada_lanza_business_rule(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """DBAPIError del trigger de NeonDB debe convertirse en BusinessRuleError."""
        orig = MagicMock()
        orig.__str__ = lambda self: "fecha_vencimiento debe ser futura"
        error = DBAPIError("INSERT", {}, orig)
        error.orig = orig
        mock_repo.create_lote.side_effect = error

        payload = LoteCreateRequest(
            id_producto=10,
            cantidad_inicial=10,
            fecha_vencimiento=datetime.now(UTC) + timedelta(days=1),
        )

        with pytest.raises(BusinessRuleError):
            await service.create_lote(payload, id_usuario=1)


# ── apply_adjustment ──────────────────────────────────────────────────────────

@pytest.mark.unit
class TestApplyAdjustment:

    async def test_ajuste_positivo_exitoso(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Un AJUSTE_POSITIVO válido retorna el movimiento registrado."""
        mov_mock = make_movimiento(tipo=TipoMovimientoStockEnum.AJUSTE_POSITIVO, stock_resultante=60)
        mock_repo.create_movimiento.return_value = mov_mock

        payload = AjusteStockRequest(
            id_producto=10,
            id_lote=1,
            tipo_movimiento=TipoMovimientoStockEnum.AJUSTE_POSITIVO,
            cantidad=10,
        )

        result = await service.apply_adjustment(payload, id_usuario=1)

        assert result.tipo_movimiento == TipoMovimientoStockEnum.AJUSTE_POSITIVO
        assert result.stock_resultante == 60

    async def test_merma_exitosa(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Una MERMA válida retorna el movimiento registrado."""
        mov_mock = make_movimiento(tipo=TipoMovimientoStockEnum.MERMA, stock_resultante=40)
        mock_repo.create_movimiento.return_value = mov_mock

        payload = AjusteStockRequest(
            id_producto=10,
            id_lote=1,
            tipo_movimiento=TipoMovimientoStockEnum.MERMA,
            cantidad=10,
        )

        result = await service.apply_adjustment(payload, id_usuario=1)

        assert result.stock_resultante == 40

    async def test_lote_vencido_lanza_business_rule(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """DBAPIError del trigger (lote vencido) debe convertirse en BusinessRuleError."""
        orig = MagicMock()
        orig.__str__ = lambda self: "No se permiten ajustes sobre lotes vencidos"
        error = DBAPIError("INSERT", {}, orig)
        error.orig = orig
        mock_repo.create_movimiento.side_effect = error

        payload = AjusteStockRequest(
            id_producto=10,
            id_lote=5,
            tipo_movimiento=TipoMovimientoStockEnum.AJUSTE_NEGATIVO,
            cantidad=5,
        )

        with pytest.raises(BusinessRuleError, match="lotes vencidos"):
            await service.apply_adjustment(payload, id_usuario=1)

    async def test_stock_insuficiente_lanza_business_rule(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """DBAPIError de stock insuficiente debe convertirse en BusinessRuleError."""
        orig = MagicMock()
        orig.__str__ = lambda self: "Stock insuficiente en lote"
        error = DBAPIError("INSERT", {}, orig)
        error.orig = orig
        mock_repo.create_movimiento.side_effect = error

        payload = AjusteStockRequest(
            id_producto=10,
            id_lote=1,
            tipo_movimiento=TipoMovimientoStockEnum.MERMA,
            cantidad=999,
        )

        with pytest.raises(BusinessRuleError, match="insuficiente"):
            await service.apply_adjustment(payload, id_usuario=1)


# ── get_kardex ────────────────────────────────────────────────────────────────

@pytest.mark.unit
class TestGetKardex:

    async def test_retorna_paginado_vacio(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Sin movimientos el Kardex devuelve total=0 e items vacío."""
        from app.shared.schemas.pagination import PaginationParams

        mock_repo.get_kardex_by_producto.return_value = ([], 0)
        params = PaginationParams(page=1, page_size=20)

        result = await service.get_kardex(id_producto=10, params=params)

        assert result.total == 0
        assert result.items == []
        assert result.total_pages == 0

    async def test_retorna_movimientos_paginados(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Con movimientos retorna la página correctamente."""
        from app.shared.schemas.pagination import PaginationParams

        movs = [
            make_movimiento(id_movimiento=i, stock_resultante=50 + i)
            for i in range(1, 4)
        ]
        mock_repo.get_kardex_by_producto.return_value = (movs, 3)
        params = PaginationParams(page=1, page_size=20)

        result = await service.get_kardex(id_producto=10, params=params)

        assert result.total == 3
        assert len(result.items) == 3
        assert result.total_pages == 1


# ── get_next_fefo_lot ─────────────────────────────────────────────────────────

@pytest.mark.unit
class TestGetNextFefoLot:

    async def test_retorna_next_lot_con_dias_restantes(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Lote con fecha de vencimiento debe retornar dias_restantes >= 0."""
        future = datetime.now(UTC) + timedelta(days=7)
        lote = make_lote(fecha_vencimiento=future)
        mock_repo.get_next_fefo_lot.return_value = lote

        result = await service.get_next_fefo_lot(id_producto=10)

        assert result.id_lote == 1
        assert result.dias_restantes is not None
        assert result.dias_restantes >= 0

    async def test_lote_sin_fecha_dias_restantes_es_none(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Lote sin fecha de vencimiento debe retornar dias_restantes=None."""
        lote = make_lote(fecha_vencimiento=None)
        mock_repo.get_next_fefo_lot.return_value = lote

        result = await service.get_next_fefo_lot(id_producto=10)

        assert result.dias_restantes is None

    async def test_sin_lotes_lanza_not_found(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Sin lotes vigentes debe lanzar NotFoundError."""
        mock_repo.get_next_fefo_lot.return_value = None

        with pytest.raises(NotFoundError):
            await service.get_next_fefo_lot(id_producto=10)


# ── get_reconciliation ────────────────────────────────────────────────────────

@pytest.mark.unit
class TestGetReconciliation:

    async def test_retorna_lista_vacia(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Sin productos retorna lista vacía."""
        mock_repo.get_reconciliation_all.return_value = []

        result = await service.get_reconciliation()

        assert result == []

    async def test_producto_descuadrado_detectado(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Un producto con stock_actual ≠ stock_calculado_kardex está descuadrado."""
        mock_repo.get_reconciliation_all.return_value = [
            {
                "id_producto": 1,
                "nombre": "Trufa Chocolate",
                "stock_actual": 100,
                "stock_calculado_kardex": 95,
                "stock_calculado_lotes": 100,
                "descuadrado": True,
            }
        ]

        result = await service.get_reconciliation()

        assert len(result) == 1
        assert result[0].descuadrado is True
        assert result[0].stock_actual == 100
        assert result[0].stock_calculado_kardex == 95

    async def test_filtra_solo_descuadrados(
        self,
        service: InventoryService,
        mock_repo: AsyncMock,
    ) -> None:
        """Con solo_descuadrados=True, el repo se llama con el flag correcto."""
        mock_repo.get_reconciliation_all.return_value = []

        await service.get_reconciliation(solo_descuadrados=True)

        mock_repo.get_reconciliation_all.assert_called_once_with(solo_descuadrados=True)
