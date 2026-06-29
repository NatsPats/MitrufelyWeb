"""
test_sweetcoins_service.py — Unit tests for SweetCoinsService business logic.
Uses pytest mock fixtures from conftest.py.
"""

from datetime import datetime
from decimal import Decimal
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.exceptions import (
    BusinessRuleError,
    CouponDisabledError,
    InsufficientSweetCoinsError,
    NotFoundError,
)
from app.infrastructure.database.models.enums import EstadoCuponEnum, TipoMovimientoPuntosEnum
from app.infrastructure.database.models.usuarios import Cliente
from app.modules.sweetcoins.service import SweetCoinsService
from tests.unit.sweetcoins.factories import make_config, make_cupon_maestro, make_cupon_cliente


@pytest.mark.asyncio
async def test_resolve_cliente_id_existing(sweetcoins_service: SweetCoinsService, mock_session: AsyncMock):
    """Prueba que resuelva el id_cliente si ya existe en la BD."""
    cliente_mock = Cliente(id_cliente=42, id_usuario=10)
    
    # Mockear session.execute para retornar el cliente existente
    execute_result = MagicMock()
    execute_result.scalars.return_value.first.return_value = cliente_mock
    mock_session.execute = AsyncMock(return_value=execute_result)
    
    id_cliente = await sweetcoins_service._resolve_cliente_id(10)
    
    assert id_cliente == 42
    # Comprobar que no se haya llamado a session.add ya que existía
    mock_session.add.assert_not_called()


@pytest.mark.asyncio
async def test_resolve_cliente_id_new(sweetcoins_service: SweetCoinsService, mock_session: AsyncMock):
    """Prueba que cree el registro de Cliente si no existe."""
    # Mockear session.execute para retornar None (no existe)
    execute_result = MagicMock()
    execute_result.scalars.return_value.first.return_value = None
    mock_session.execute = AsyncMock(return_value=execute_result)
    
    # Para capturar el cliente insertado en session.add
    added_cliente = None
    def mock_add(obj):
        nonlocal added_cliente
        if isinstance(obj, Cliente):
            added_cliente = obj
            obj.id_cliente = 99  # Asignar ID simulado
            
    mock_session.add.side_effect = mock_add
    
    id_cliente = await sweetcoins_service._resolve_cliente_id(10)
    
    assert id_cliente == 99
    assert added_cliente is not None
    assert added_cliente.id_usuario == 10
    mock_session.add.assert_called_once()
    mock_session.flush.assert_called_once()


@pytest.mark.asyncio
async def test_get_balance(sweetcoins_service: SweetCoinsService, mock_puntos_repo: AsyncMock):
    """Prueba que obtenga el balance correcto del cliente."""
    # Mockear resolución de cliente a id_cliente = 5
    with patch.object(sweetcoins_service, "_resolve_cliente_id", return_value=5):
        mock_puntos_repo.get_saldo = AsyncMock(return_value=1200)
        
        balance = await sweetcoins_service.get_balance(10)
        
        assert balance == 1200
        mock_puntos_repo.get_saldo.assert_called_once_with(5)


@pytest.mark.asyncio
async def test_canjear_cupon_success(
    sweetcoins_service: SweetCoinsService,
    mock_config_repo: AsyncMock,
    mock_cupon_maestro_repo: AsyncMock,
    mock_puntos_repo: AsyncMock,
    mock_cupon_cliente_repo: AsyncMock,
):
    """Prueba el flujo de canje exitoso con puntos suficientes."""
    id_usuario = 10
    id_cliente = 5
    id_cupon = 2
    
    config = make_config()
    cupon_maestro = make_cupon_maestro(id_cupon=id_cupon, costo_puntos=1000, dias_vigencia=15)
    
    mock_config_repo.get_active.return_value = config
    mock_cupon_maestro_repo.get_by_id.return_value = cupon_maestro
    mock_puntos_repo.get_saldo_for_update.return_value = 1500
    
    # Mockear el guardado de cupones
    created_cupon_cliente = make_cupon_cliente(id_cliente=id_cliente, cupon_maestro=cupon_maestro)
    mock_cupon_cliente_repo.create.return_value = created_cupon_cliente
    
    with patch.object(sweetcoins_service, "_resolve_cliente_id", return_value=id_cliente):
        res = await sweetcoins_service.canjear_cupon(id_usuario, id_cupon)
        
        assert res == created_cupon_cliente
        assert res.cupon_maestro == cupon_maestro
        
        # Verificar débito de puntos
        mock_puntos_repo.create.assert_called_once()
        movimiento = mock_puntos_repo.create.call_args[0][0]
        assert movimiento.id_cliente == id_cliente
        assert movimiento.cantidad == -1000
        assert movimiento.saldo_puntos_resultante == 500
        assert movimiento.tipo_movimiento == TipoMovimientoPuntosEnum.COMPRA_CUPON
        
        # Verificar creación del cupón de cliente
        mock_cupon_cliente_repo.create.assert_called_once()
        cupon_c = mock_cupon_cliente_repo.create.call_args[0][0]
        assert cupon_c.id_cliente == id_cliente
        assert cupon_c.id_cupon == id_cupon
        assert cupon_c.estado == EstadoCuponEnum.DISPONIBLE
        assert cupon_c.codigo_unico.startswith("MTR-")


@pytest.mark.asyncio
async def test_canjear_cupon_insufficient_points(
    sweetcoins_service: SweetCoinsService,
    mock_config_repo: AsyncMock,
    mock_cupon_maestro_repo: AsyncMock,
    mock_puntos_repo: AsyncMock,
    mock_cupon_cliente_repo: AsyncMock,
):
    """Prueba que el canje falle si el cliente no tiene suficientes puntos."""
    id_usuario = 10
    id_cliente = 5
    id_cupon = 2
    
    config = make_config()
    cupon_maestro = make_cupon_maestro(id_cupon=id_cupon, costo_puntos=1000)
    
    mock_config_repo.get_active.return_value = config
    mock_cupon_maestro_repo.get_by_id.return_value = cupon_maestro
    mock_puntos_repo.get_saldo_for_update.return_value = 400
    
    with patch.object(sweetcoins_service, "_resolve_cliente_id", return_value=id_cliente):
        with pytest.raises(InsufficientSweetCoinsError):
            await sweetcoins_service.canjear_cupon(id_usuario, id_cupon)
            
        mock_puntos_repo.create.assert_not_called()
        mock_cupon_cliente_repo.create.assert_not_called()


@pytest.mark.asyncio
async def test_canjear_cupon_disabled(
    sweetcoins_service: SweetCoinsService,
    mock_config_repo: AsyncMock,
    mock_cupon_maestro_repo: AsyncMock,
    mock_puntos_repo: AsyncMock,
):
    """Prueba que falle si el cupón está deshabilitado."""
    id_usuario = 10
    id_cliente = 5
    id_cupon = 2
    
    config = make_config()
    cupon_maestro = make_cupon_maestro(id_cupon=id_cupon, estado=False)
    
    mock_config_repo.get_active.return_value = config
    mock_cupon_maestro_repo.get_by_id.return_value = cupon_maestro
    
    with patch.object(sweetcoins_service, "_resolve_cliente_id", return_value=id_cliente):
        with pytest.raises(CouponDisabledError):
            await sweetcoins_service.canjear_cupon(id_usuario, id_cupon)
            
        mock_puntos_repo.create.assert_not_called()


@pytest.mark.asyncio
async def test_adjust_points_add(
    sweetcoins_service: SweetCoinsService,
    mock_session: AsyncMock,
    mock_puntos_repo: AsyncMock,
    mock_config_repo: AsyncMock,
):
    """Prueba que el administrador pueda sumar puntos manualmente."""
    id_cliente = 8
    config = make_config()
    
    mock_config_repo.get_active.return_value = config
    mock_puntos_repo.get_saldo_for_update.return_value = 100
    
    # Mockear validación de existencia del cliente
    execute_result = MagicMock()
    execute_result.scalars.return_value.first.return_value = True
    mock_session.execute = AsyncMock(return_value=execute_result)
    
    await sweetcoins_service.adjust_points(
        id_cliente=id_cliente,
        cantidad=500,
        justificacion="Ajuste positivo por delay",
        admin_id=1,
        request_ip="127.0.0.1"
    )
    
    mock_puntos_repo.create.assert_called_once()
    movimiento = mock_puntos_repo.create.call_args[0][0]
    assert movimiento.id_cliente == id_cliente
    assert movimiento.cantidad == 500
    assert movimiento.saldo_puntos_resultante == 600
    assert movimiento.tipo_movimiento == TipoMovimientoPuntosEnum.AJUSTE_ADMIN
    assert "Ajuste Admin:" in movimiento.justificacion


@pytest.mark.asyncio
async def test_jugar_ruleta_insufficient_points(
    sweetcoins_service: SweetCoinsService,
    mock_config_repo: AsyncMock,
    mock_puntos_repo: AsyncMock,
):
    """Prueba que jugar a la ruleta lance error si no hay suficientes puntos."""
    id_usuario = 10
    config = make_config()
    mock_config_repo.get_active.return_value = config
    mock_puntos_repo.get_saldo_for_update.return_value = 20  # Menos de 50

    with patch.object(sweetcoins_service, "_resolve_cliente_id", return_value=5):
        with pytest.raises(BusinessRuleError) as exc_info:
            await sweetcoins_service.jugar_ruleta(id_usuario)
        assert "insuficiente" in str(exc_info.value)


@pytest.mark.asyncio
async def test_jugar_ruleta_success(
    sweetcoins_service: SweetCoinsService,
    mock_config_repo: AsyncMock,
    mock_puntos_repo: AsyncMock,
    mock_cupon_maestro_repo: AsyncMock,
    mock_cupon_cliente_repo: AsyncMock,
):
    """Prueba que jugar a la ruleta descuente puntos y retorne resultado válido."""
    id_usuario = 10
    config = make_config()
    mock_config_repo.get_active.return_value = config
    mock_puntos_repo.get_saldo_for_update.return_value = 100

    # Mockear un cupón disponible para la ruleta
    cupon_maestro = make_cupon_maestro(id_cupon=1, dias_vigencia=7)
    mock_cupon_maestro_repo.get_available.return_value = [cupon_maestro]

    with patch.object(sweetcoins_service, "_resolve_cliente_id", return_value=5):
        # Ejecutar 5 veces para cubrir diferentes ramas probabilísticas
        for _ in range(5):
            res = await sweetcoins_service.jugar_ruleta(id_usuario)
            assert res["resultado"] in ("mala_suerte", "puntos_extra", "cupon_sorpresa")
            assert "mensaje" in res
            assert res["puntos_ganados"] in (0, 100)
