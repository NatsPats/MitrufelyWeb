"""
Mifrufely Web — Integration Tests: Inventory DB Layer (Fase 3)
Tests contra NeonDB real que verifican triggers, ORM mappings y la vista de conciliación.

IMPORTANTE: Todos los writes usan ROLLBACK explícito — ningún dato persiste en NeonDB.

Ejecutar con:
    pytest tests/integration/test_inventory_db.py -v

O dentro de Docker:
    docker compose exec api pytest tests/integration/test_inventory_db.py -v

Requisitos:
  - DATABASE_URL configurado en .env
  - M03_catalogo_inventario.sql y M08_fase3_triggers_ajustes.sql aplicados en NeonDB
  - Al menos un producto activo en la BD (id_producto=1 o ajustar el PRODUCTO_ID_FIXTURE)
"""

import pytest
import pytest_asyncio
from collections.abc import AsyncGenerator
from datetime import datetime, timedelta, UTC

from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.infrastructure.database.session import _async_url, _connect_args
from app.infrastructure.database.models.catalogo import Lote, MovimientoStock, Producto
from app.infrastructure.database.models.enums import (
    EstadoLoteEnum,
    TipoMovimientoStockEnum,
)
from app.modules.inventory.repository_impl import InventoryRepositoryImpl

# ── Configuración ─────────────────────────────────────────────────────────────
# Ajusta PRODUCTO_ID_FIXTURE si el id 1 no existe en tu NeonDB.
PRODUCTO_ID_FIXTURE = 1


# ── Engine + Session (función-scoped) ─────────────────────────────────────────

@pytest_asyncio.fixture
async def engine() -> AsyncGenerator[AsyncEngine, None]:
    eng = create_async_engine(
        _async_url,
        echo=False,
        connect_args=_connect_args,
        poolclass=NullPool,
    )
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture
async def db_session(engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """Sesión con rollback automático — no contamina NeonDB."""
    factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )
    async with factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def repo(db_session: AsyncSession) -> InventoryRepositoryImpl:
    return InventoryRepositoryImpl(db_session)


# ── Helper: buscar un producto existente ──────────────────────────────────────

async def _get_existing_product(session: AsyncSession) -> Producto | None:
    stmt = select(Producto).where(Producto.estado.is_(True)).limit(1)
    result = await session.execute(stmt)
    return result.scalars().first()


# ── Tests: tg_lotes_validar_insert ───────────────────────────────────────────

@pytest.mark.integration
@pytest.mark.asyncio
async def test_lote_insert_normaliza_cantidad_disponible(db_session: AsyncSession, repo: InventoryRepositoryImpl) -> None:
    """
    WHAT: Al insertar un lote con cantidad_disponible=0,
          el trigger tg_lotes_validar_insert debe normalizarlo a cantidad_inicial.
    VALIDATES: Trigger de inserción de lotes activo en NeonDB.
    """
    producto = await _get_existing_product(db_session)
    if producto is None:
        pytest.skip("No hay productos activos en la BD para ejecutar el test.")

    lote = Lote(
        id_producto=producto.id_producto,
        cantidad_inicial=25,
        cantidad_disponible=0,   # El trigger debe normalizar esto a 25
        fecha_vencimiento=datetime.now(UTC) + timedelta(days=90),
        estado_lote=EstadoLoteEnum.VIGENTE,
    )

    lote_creado = await repo.create_lote(lote)

    assert lote_creado.id_lote is not None
    assert lote_creado.cantidad_disponible == 25, (
        "El trigger tg_lotes_validar_insert debe normalizar cantidad_disponible = cantidad_inicial"
    )
    assert lote_creado.estado_lote == EstadoLoteEnum.VIGENTE


@pytest.mark.integration
@pytest.mark.asyncio
async def test_lote_insert_rechaza_fecha_vencida(db_session: AsyncSession, repo: InventoryRepositoryImpl) -> None:
    """
    WHAT: Insertar un lote con fecha_vencimiento en el pasado debe ser rechazado
          por el trigger tg_lotes_validar_insert con RAISE EXCEPTION.
    VALIDATES: Trigger de validación de fecha activo.
    """
    producto = await _get_existing_product(db_session)
    if producto is None:
        pytest.skip("No hay productos activos en la BD para ejecutar el test.")

    lote_vencido = Lote(
        id_producto=producto.id_producto,
        cantidad_inicial=10,
        cantidad_disponible=0,
        fecha_vencimiento=datetime.now(UTC) - timedelta(days=1),  # PASADA
        estado_lote=EstadoLoteEnum.VIGENTE,
    )

    with pytest.raises(DBAPIError):
        await repo.create_lote(lote_vencido)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_lote_insert_registra_ingreso_compra_en_kardex(db_session: AsyncSession, repo: InventoryRepositoryImpl) -> None:
    """
    WHAT: Al insertar un lote, el trigger tg_lotes_post_insert debe crear
          automáticamente un movimiento INGRESO_COMPRA en el Kardex.
    VALIDATES: Trigger post-insert de lotes activo.
    """
    producto = await _get_existing_product(db_session)
    if producto is None:
        pytest.skip("No hay productos activos en la BD para ejecutar el test.")

    lote = Lote(
        id_producto=producto.id_producto,
        cantidad_inicial=15,
        cantidad_disponible=0,
        estado_lote=EstadoLoteEnum.VIGENTE,
    )
    lote_creado = await repo.create_lote(lote)

    # Verificar que el Kardex tiene el INGRESO_COMPRA del lote recién insertado
    stmt = (
        select(MovimientoStock)
        .where(
            MovimientoStock.id_lote == lote_creado.id_lote,
            MovimientoStock.tipo_movimiento == TipoMovimientoStockEnum.INGRESO_COMPRA,
        )
    )
    result = await db_session.execute(stmt)
    movimiento = result.scalars().first()

    assert movimiento is not None, (
        "El trigger tg_lotes_post_insert debe crear un movimiento INGRESO_COMPRA en el Kardex"
    )
    assert movimiento.cantidad == 15


# ── Tests: tg_movimientos_stock_ajustes ───────────────────────────────────────

@pytest.mark.integration
@pytest.mark.asyncio
async def test_ajuste_positivo_actualiza_stock(db_session: AsyncSession, repo: InventoryRepositoryImpl) -> None:
    """
    WHAT: Un AJUSTE_POSITIVO debe incrementar cantidad_disponible del lote
          y stock_actual del producto vía el trigger.
    VALIDATES: tg_movimientos_stock_ajustes (BEFORE INSERT) activo.
    """
    producto = await _get_existing_product(db_session)
    if producto is None:
        pytest.skip("No hay productos activos en la BD para ejecutar el test.")

    # Crear lote base
    lote = Lote(
        id_producto=producto.id_producto,
        cantidad_inicial=10,
        cantidad_disponible=0,
        estado_lote=EstadoLoteEnum.VIGENTE,
    )
    lote_creado = await repo.create_lote(lote)

    # Capturar stock actual antes del ajuste
    await db_session.refresh(producto)
    stock_antes = producto.stock_actual

    # Insertar AJUSTE_POSITIVO
    movimiento = MovimientoStock(
        id_producto=producto.id_producto,
        id_lote=lote_creado.id_lote,
        id_usuario=None,
        tipo_movimiento=TipoMovimientoStockEnum.AJUSTE_POSITIVO,
        cantidad=5,
        stock_resultante=0,  # el trigger lo sobreescribe
    )
    mov_creado = await repo.create_movimiento(movimiento)

    # El trigger BEFORE INSERT calcula stock_resultante
    assert mov_creado.stock_resultante > 0, "El trigger debe calcular stock_resultante"

    # El lote debe haber aumentado en 5
    await db_session.refresh(lote_creado)
    assert lote_creado.cantidad_disponible == 15   # 10 inicial + 5 ajuste


@pytest.mark.integration
@pytest.mark.asyncio
async def test_ajuste_sin_lote_es_rechazado(db_session: AsyncSession, repo: InventoryRepositoryImpl) -> None:
    """
    WHAT: Un AJUSTE_POSITIVO sin id_lote debe ser rechazado por el trigger.
    VALIDATES: Validación de id_lote obligatorio en el trigger.
    """
    producto = await _get_existing_product(db_session)
    if producto is None:
        pytest.skip("No hay productos activos en la BD para ejecutar el test.")

    movimiento = MovimientoStock(
        id_producto=producto.id_producto,
        id_lote=None,   # Sin lote — debe ser rechazado
        tipo_movimiento=TipoMovimientoStockEnum.AJUSTE_POSITIVO,
        cantidad=5,
        stock_resultante=0,
    )

    with pytest.raises(DBAPIError, match="id_lote es obligatorio"):
        await repo.create_movimiento(movimiento)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_ajuste_negativo_stock_insuficiente_rechazado(db_session: AsyncSession, repo: InventoryRepositoryImpl) -> None:
    """
    WHAT: Un AJUSTE_NEGATIVO mayor al stock disponible debe ser rechazado por el trigger.
    VALIDATES: Validación de stock suficiente en el trigger.
    """
    producto = await _get_existing_product(db_session)
    if producto is None:
        pytest.skip("No hay productos activos en la BD para ejecutar el test.")

    # Crear lote con solo 2 unidades
    lote = Lote(
        id_producto=producto.id_producto,
        cantidad_inicial=2,
        cantidad_disponible=0,
        estado_lote=EstadoLoteEnum.VIGENTE,
    )
    lote_creado = await repo.create_lote(lote)

    movimiento = MovimientoStock(
        id_producto=producto.id_producto,
        id_lote=lote_creado.id_lote,
        tipo_movimiento=TipoMovimientoStockEnum.AJUSTE_NEGATIVO,
        cantidad=999,    # Mucho mayor al disponible
        stock_resultante=0,
    )

    with pytest.raises(DBAPIError):
        await repo.create_movimiento(movimiento)


# ── Tests: Vista vw_inventory_reconciliation ─────────────────────────────────

@pytest.mark.integration
@pytest.mark.asyncio
async def test_reconciliation_view_existe(db_session: AsyncSession, repo: InventoryRepositoryImpl) -> None:
    """
    WHAT: La vista vw_inventory_reconciliation debe existir y ser consultable.
    VALIDATES: M08_fase3_triggers_ajustes.sql fue aplicado en NeonDB.
    """
    result = await repo.get_reconciliation_all()
    # No lanzó excepción = la vista existe
    assert isinstance(result, list)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_reconciliation_view_tiene_columnas_esperadas(db_session: AsyncSession) -> None:
    """
    WHAT: Verifica que la vista retorna las columnas requeridas por la conciliación triple.
    VALIDATES: Esquema de columnas de vw_inventory_reconciliation.
    """
    result = await db_session.execute(
        text("""
            SELECT id_producto, nombre, stock_actual,
                   stock_calculado_kardex, stock_calculado_lotes
            FROM vw_inventory_reconciliation
            LIMIT 1
        """)
    )
    row = result.fetchone()
    if row is None:
        pytest.skip("No hay productos en la BD para verificar la vista.")

    # Si llegamos aquí sin excepción, las columnas existen
    assert row is not None
