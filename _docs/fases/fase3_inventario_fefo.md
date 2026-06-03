# Fase 3: Gestión de Lotes, Kardex e Inventario (Control FEFO)

> **Estado:** ✅ Completado e Implementado  
> **Última revisión:** 2026-06-03  
> **Autor:** Antigravity (Pair Programming Partner)

---

## 1. Visión General y Gobernanza Única del Stock

Esta fase se enfoca en la **gestión física y contable del inventario** de Mytrufely. Dado que las trufas artesanales son productos altamente perecederos, el control de existencias debe realizarse a nivel de **lotes físicos numerados** y despacharse estrictamente bajo el algoritmo **FEFO (First Expired, First Out)**.

### ⚠️ Regla de Oro: Gobernanza Única en NeonDB (PostgreSQL)
Para evitar discrepancias e inconsistencias de stock ante condiciones de concurrencia y carrera:
* **NeonDB es el ÚNICO responsable de modificar el inventario físico.**
* El backend en Python **NUNCA** modificará directamente `productos.stock_actual` ni `lotes.cantidad_disponible`.
* El backend únicamente **insertará** registros en `movimientos_stock` (para ajustes manuales) o `lotes` (para ingresos de compras).
* Los triggers de base de datos reaccionarán de forma automática e inmediata a estas inserciones para propagar los cambios y recalcular existencias.

---

## 2. Diseño Físico de Base de Datos: Triggers y Vistas (PostgreSQL)

Se definen a continuación los triggers y vistas en NeonDB que implementan la gobernanza del stock y la conciliación contable.

### 2.1. Trigger de Ajustes Manuales (`BEFORE INSERT ON movimientos_stock`)
Se implementa un trigger `tg_movimientos_stock_ajustes` de tipo **BEFORE INSERT** para calcular `stock_resultante` de manera determinista en base de datos antes de escribir la línea del Kardex (Append-Only), actualizando stock en productos y lotes.

```sql
CREATE OR REPLACE FUNCTION fn_tg_movimientos_stock_ajustes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_actual    int;
  v_stock_resultante int;
  v_lote_cantidad   int;
BEGIN
  -- 1. Validar y actualizar lote físico (id_lote es estrictamente obligatorio para ajustes)
  IF NEW.id_lote IS NULL THEN
    RAISE EXCEPTION 'El ID de lote (id_lote) es estrictamente obligatorio para registrar ajustes.';
  END IF;

  -- Bloquear fila del lote para evitar condiciones de carrera concurrentes
  SELECT cantidad_disponible, estado_lote INTO v_lote_cantidad, NEW.estado_lote
  FROM lotes WHERE id_lote = NEW.id_lote FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El lote % no existe.', NEW.id_lote;
  END IF;

  -- Prevenir modificación sobre lotes vencidos
  IF (SELECT estado_lote FROM lotes WHERE id_lote = NEW.id_lote) = 'VENCIDO' THEN
    RAISE EXCEPTION 'No se permiten ajustes sobre lotes vencidos.';
  END IF;

  -- Aplicar decremento o incremento al lote
  IF NEW.tipo_movimiento IN ('AJUSTE_NEGATIVO', 'MERMA') THEN
    IF v_lote_cantidad < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente en el lote %. Disponible: %, solicitado: %',
        NEW.id_lote, v_lote_cantidad, NEW.cantidad;
    END IF;

    UPDATE lotes
    SET cantidad_disponible = cantidad_disponible - NEW.cantidad,
        estado_lote = CASE WHEN cantidad_disponible - NEW.cantidad = 0 THEN 'AGOTADO' ELSE 'VIGENTE' END
    WHERE id_lote = NEW.id_lote;
    
  ELSIF NEW.tipo_movimiento = 'AJUSTE_POSITIVO' THEN
    UPDATE lotes
    SET cantidad_disponible = cantidad_disponible + NEW.cantidad,
        estado_lote = 'VIGENTE'
    WHERE id_lote = NEW.id_lote;
  END IF;

  -- 2. Bloquear y obtener stock actual del producto (FOR UPDATE garantiza exclusión mutua)
  SELECT stock_actual INTO v_stock_actual
  FROM productos WHERE id_producto = NEW.id_producto FOR UPDATE;

  -- 3. Calcular stock resultante y guardarlo en el registro del Kardex antes de insertar
  IF NEW.tipo_movimiento IN ('AJUSTE_NEGATIVO', 'MERMA') THEN
    v_stock_resultante := GREATEST(v_stock_actual - NEW.cantidad, 0);
  ELSIF NEW.tipo_movimiento = 'AJUSTE_POSITIVO' THEN
    v_stock_resultante := v_stock_actual + NEW.cantidad;
  ELSE
    -- Movimientos automáticos (VENTA, INGRESO_COMPRA, VENCIMIENTO) ya tienen sus propios flujos
    RETURN NEW;
  END IF;

  NEW.stock_resultante := v_stock_resultante;

  -- 4. Actualizar tabla maestra de productos
  UPDATE productos
  SET stock_actual = v_stock_resultante
  WHERE id_producto = NEW.id_producto;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_movimientos_stock_ajustes
BEFORE INSERT ON movimientos_stock
FOR EACH ROW
EXECUTE FUNCTION fn_tg_movimientos_stock_ajustes();
```

### 2.2. Garantías de Concurrencia y Bloqueos
* **Ingresos de Lotes (`registrar_lote`):** El trigger `tg_lotes_post_insert` bloquea la fila del producto involucrado mediante `SELECT ... FOR UPDATE`. Esto garantiza que si se ingresan dos lotes concurrentemente para el mismo producto, el cálculo de `stock_actual` sea completamente determinista y secuencial, evitando condiciones de carrera.
* **Ajustes de Inventario:** El trigger de movimientos de stock aplica un bloqueo doble pesimista: primero adquiere un bloqueo exclusivo sobre el lote específico (`FOR UPDATE`) y luego sobre el producto correspondiente (`FOR UPDATE`). Esto evita interbloqueos (deadlocks) al mantener un orden estricto de bloqueo (`lotes` -> `productos`) y asegura la integridad transaccional completa.

### 2.3. Vista de Conciliación Triple (`vw_inventory_reconciliation`)
Esta vista audita que no existan inconsistencias entre el stock cacheado, el Kardex y las existencias reales distribuidas en lotes:

```sql
CREATE OR REPLACE VIEW vw_inventory_reconciliation AS
SELECT
  p.id_producto,
  p.nombre,
  p.stock_actual,
  COALESCE((
    SELECT SUM(
      CASE
        WHEN ms.tipo_movimiento IN ('INGRESO_COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCION') THEN ms.cantidad
        WHEN ms.tipo_movimiento IN ('VENTA', 'AJUSTE_NEGATIVO', 'MERMA', 'VENCIMIENTO') THEN -ms.cantidad
        ELSE 0
      END
    ) FROM movimientos_stock ms WHERE ms.id_producto = p.id_producto
  ), 0) AS stock_calculado_kardex,
  COALESCE((
    SELECT SUM(l.cantidad_disponible)
    FROM lotes l
    WHERE l.id_producto = p.id_producto 
      AND l.estado_lote = 'VIGENTE'
  ), 0) AS stock_calculado_lotes
FROM productos p;
```

---

## 3. Arquitectura del Módulo `inventory/`

El módulo sigue la estructura vertical slice de Clean Architecture:

```
app/modules/inventory/
├── __init__.py
├── router.py          # Endpoints HTTP (/api/v1/inventory)
├── service.py         # InventoryService: Reglas de negocio y orquestación
├── repository.py      # IInventoryRepository (Contrato abstracto)
├── repository_impl.py # InventoryRepositoryImpl (SQLAlchemy Async)
├── schemas.py         # Pydantic v2: Validación y serialización UTC
└── dependencies.py    # DI: get_inventory_repository, get_inventory_service
```

---

## 4. Diseño de Componentes de Backend

### 4.1. Schemas de Pydantic (`app/modules/inventory/schemas.py`)
Manejo estricto de zonas horarias en UTC. Normaliza todo timestamp entrante a UTC aware antes de aplicar reglas de validación.

```python
from datetime import datetime, UTC
from decimal import Decimal
from pydantic import BaseModel, Field, ConfigDict, field_validator
from app.infrastructure.database.models.enums import EstadoLoteEnum, TipoMovimientoStockEnum

class LoteCreateRequest(BaseModel):
    id_producto: int = Field(..., gt=0, description="ID del producto físico")
    cantidad_inicial: int = Field(..., gt=0, description="Cantidad inicial ingresada")
    fecha_vencimiento: datetime | None = Field(
        None, 
        description="Fecha de vencimiento. Debe ser futura (UTC)"
    )

    @field_validator("fecha_vencimiento")
    def validate_future_date(cls, v: datetime | None) -> datetime | None:
        if v is not None:
            # Normalizar a UTC aware
            v_utc = v.astimezone(UTC) if v.tzinfo else v.replace(tzinfo=UTC)
            now_utc = datetime.now(UTC)
            if v_utc <= now_utc:
                raise ValueError("La fecha de vencimiento debe ser estrictamente posterior a la fecha actual.")
            return v_utc
        return v

class LoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_lote: int
    id_producto: int
    fecha_ingreso: datetime
    fecha_vencimiento: datetime | None
    cantidad_inicial: int
    cantidad_disponible: int
    estado_lote: EstadoLoteEnum

class AjusteStockRequest(BaseModel):
    id_producto: int = Field(..., gt=0)
    id_lote: int = Field(..., description="Lote específico a ajustar. Obligatorio para todos los tipos de ajustes.")
    tipo_movimiento: TipoMovimientoStockEnum = Field(
        ..., 
        description="Tipo de ajuste manual: AJUSTE_POSITIVO, AJUSTE_NEGATIVO o MERMA"
    )
    cantidad: int = Field(..., gt=0, description="Cantidad física a ajustar")
    observacion: str | None = Field(None, max_length=500)

    @field_validator("tipo_movimiento")
    def validate_manual_type(cls, v: TipoMovimientoStockEnum) -> TipoMovimientoStockEnum:
        allowed = {
            TipoMovimientoStockEnum.AJUSTE_POSITIVO,
            TipoMovimientoStockEnum.AJUSTE_NEGATIVO,
            TipoMovimientoStockEnum.MERMA
        }
        if v not in allowed:
            raise ValueError("El tipo de movimiento debe ser AJUSTE_POSITIVO, AJUSTE_NEGATIVO o MERMA.")
        return v

class MovimientoStockResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id_movimiento_stock: int
    id_producto: int
    id_lote: int | None
    id_venta: int | None
    id_usuario: int | None
    tipo_movimiento: TipoMovimientoStockEnum
    cantidad: int
    stock_resultante: int
    costo_unitario: Decimal | None
    fecha_movimiento: datetime
    observacion: str | None

class ReconciliationResponse(BaseModel):
    id_producto: int
    nombre: str
    stock_actual: int
    stock_calculado_kardex: int
    stock_calculado_lotes: int
    descuadrado: bool

class NextLotResponse(BaseModel):
    id_lote: int
    id_producto: int
    fecha_vencimiento: datetime | None
    cantidad_disponible: int
    dias_restantes: int | None
```

---

### 4.2. Repositorio (`app/modules/inventory/repository.py` & `repository_impl.py`)

#### Contrato Abstracto (`repository.py`)
```python
from abc import ABC, abstractmethod
from typing import List, Tuple, Optional
from app.domain.repositories.base import AbstractRepository
from app.infrastructure.database.models.catalogo import Lote, MovimientoStock

class IInventoryRepository(AbstractRepository[Lote, int], ABC):
    @abstractmethod
    async def get_lots_paginated(
        self, *, id_producto: Optional[int] = None, active_only: bool = False, page: int = 1, size: int = 20
    ) -> Tuple[int, List[Lote]]:
        """Obtiene una lista paginada de lotes físicos."""
        pass

    @abstractmethod
    async def get_kardex_paginated(
        self, producto_id: int, *, page: int = 1, size: int = 20
    ) -> Tuple[int, List[MovimientoStock]]:
        """Obtiene el historial de movimientos de un producto."""
        pass

    @abstractmethod
    async def get_reconciliation_info(self, id_producto: Optional[int] = None) -> List[dict]:
        """Compara stock cached contra Kardex y Lotes usando la vista vw_inventory_reconciliation."""
        pass

    @abstractmethod
    async def get_next_fefo_lot(self, producto_id: int) -> Optional[Lote]:
        """Obtiene el próximo lote físico que será consumido por FEFO (Informativo)."""
        pass
```

#### Implementación SQLAlchemy Async (`repository_impl.py`)
```python
from typing import List, Tuple, Optional
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload
from app.infrastructure.database.models.catalogo import Lote, MovimientoStock, Producto
from app.infrastructure.database.models.enums import EstadoLoteEnum
from app.modules.inventory.repository import IInventoryRepository

class InventoryRepositoryImpl(IInventoryRepository):
    async def get_by_id(self, pk: int) -> Optional[Lote]:
        stmt = select(Lote).options(selectinload(Lote.producto)).where(Lote.id_lote == pk)
        res = await self._session.execute(stmt)
        return res.scalars().first()

    async def get_all(self, *, limit: int = 100, offset: int = 0) -> List[Lote]:
        stmt = select(Lote).order_by(Lote.fecha_ingreso.desc()).limit(limit).offset(offset)
        res = await self._session.execute(stmt)
        return list(res.scalars().all())

    async def get_lots_paginated(
        self, *, id_producto: Optional[int] = None, active_only: bool = False, page: int = 1, size: int = 20
    ) -> Tuple[int, List[Lote]]:
        query = select(Lote).options(selectinload(Lote.producto))
        
        if id_producto is not None:
            query = query.where(Lote.id_producto == id_producto)
        if active_only:
            query = query.where(Lote.cantidad_disponible > 0, Lote.estado_lote == EstadoLoteEnum.VIGENTE)
            
        count_stmt = select(func.count()).select_from(query.subquery())
        count_res = await self._session.execute(count_stmt)
        total = count_res.scalar_one()

        query = query.order_by(Lote.fecha_vencimiento.asc(), Lote.id_lote.asc())
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)
        
        res = await self._session.execute(query)
        return total, list(res.scalars().all())

    async def get_kardex_paginated(
        self, producto_id: int, *, page: int = 1, size: int = 20
    ) -> Tuple[int, List[MovimientoStock]]:
        query = select(MovimientoStock).where(MovimientoStock.id_producto == producto_id)
        
        count_stmt = select(func.count()).select_from(query.subquery())
        count_res = await self._session.execute(count_stmt)
        total = count_res.scalar_one()

        query = query.order_by(MovimientoStock.fecha_movimiento.desc(), MovimientoStock.id_movimiento_stock.desc())
        offset = (page - 1) * size
        query = query.offset(offset).limit(size)
        
        res = await self._session.execute(query)
        return total, list(res.scalars().all())

    async def get_reconciliation_info(self, id_producto: Optional[int] = None) -> List[dict]:
        sql = "SELECT * FROM vw_inventory_reconciliation"
        params = {}
        if id_producto is not None:
            sql += " WHERE id_producto = :id_producto"
            params["id_producto"] = id_producto
            
        res = await self._session.execute(text(sql), params)
        return [dict(row) for row in res.mappings().all()]

    async def get_next_fefo_lot(self, producto_id: int) -> Optional[Lote]:
        stmt = (
            select(Lote)
            .where(
                Lote.id_producto == producto_id,
                Lote.estado_lote == EstadoLoteEnum.VIGENTE,
                Lote.cantidad_disponible > 0
            )
            .order_by(
                Lote.fecha_vencimiento.asc(),
                Lote.fecha_ingreso.asc(),
                Lote.id_lote.asc()
            )
            .limit(1)
        )
        res = await self._session.execute(stmt)
        return res.scalars().first()

    async def create(self, entity: Lote) -> Lote:
        self._session.add(entity)
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def update(self, entity: Lote) -> Lote:
        await self._session.flush()
        await self._session.refresh(entity)
        return entity

    async def delete(self, pk: int) -> None:
        raise NotImplementedError("Los lotes físicos no se eliminan.")

    async def exists(self, pk: int) -> bool:
        stmt = select(Lote.id_lote).where(Lote.id_lote == pk)
        res = await self._session.execute(stmt)
        return res.scalars().first() is not None
```

---

### 4.3. Servicio de Negocio (`app/modules/inventory/service.py`)

No actualiza en Python `productos` ni `lotes`. Solamente inserta la entidad correspondiente y delega la consistencia a NeonDB. Exige ID de lote en todos los ajustes manuales de stock.

```python
import structlog
from datetime import datetime, UTC
from typing import List, Tuple, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.infrastructure.database.models.catalogo import Lote, MovimientoStock, Producto
from app.infrastructure.database.models.enums import TipoMovimientoStockEnum, EstadoLoteEnum
from app.modules.inventory.repository import IInventoryRepository
from app.modules.inventory.schemas import (
    LoteCreateRequest, LoteResponse, AjusteStockRequest,
    MovimientoStockResponse, ReconciliationResponse, NextLotResponse
)
from app.shared.schemas.pagination import PaginatedResponse

logger = structlog.get_logger(__name__)

class InventoryService:
    def __init__(self, repo: IInventoryRepository, session: AsyncSession) -> None:
        self.repo = repo
        self.session = session

    async def registrar_lote(self, dto: LoteCreateRequest) -> LoteResponse:
        """
        Registra una compra/producción física.
        La DB (after_insert trigger en lotes) actualizará stock_actual e insertará INGRESO_COMPRA.
        """
        stmt = select(Producto).where(Producto.id_producto == dto.id_producto)
        res = await self.session.execute(stmt)
        producto = res.scalar_one_or_none()
        if not producto or not producto.estado:
            raise NotFoundError(f"Producto {dto.id_producto} no encontrado o inactivo.")

        nuevo_lote = Lote(
            id_producto=dto.id_producto,
            fecha_vencimiento=dto.fecha_vencimiento,
            cantidad_inicial=dto.cantidad_inicial,
        )

        lote_creado = await self.repo.create(nuevo_lote)
        await self.session.commit()
        
        logger.info("inventory.lot_registered", id_lote=lote_creado.id_lote, cantidad=lote_creado.cantidad_inicial)
        return LoteResponse.model_validate(lote_creado)

    async def ajustar_stock(self, dto: AjusteStockRequest, id_usuario: int) -> MovimientoStockResponse:
        """
        Ajuste manual de stock.
        El backend únicamente inserta en movimientos_stock.
        El trigger tg_movimientos_stock_ajustes (BEFORE INSERT) recalculará stock y actualizará el lote.
        No se crean lotes automáticamente; para mercancía física nueva debe registrarse un lote formalmente primero.
        """
        # 1. Validar existencia del producto
        stmt = select(Producto).where(Producto.id_producto == dto.id_producto)
        res = await self.session.execute(stmt)
        producto = res.scalar_one_or_none()
        if not producto or not producto.estado:
            raise NotFoundError(f"Producto {dto.id_producto} no encontrado.")

        # 2. Validar existencia de lote (id_lote es obligatorio para todos los ajustes)
        lote = await self.repo.get_by_id(dto.id_lote)
        if not lote:
            raise NotFoundError(f"Lote {dto.id_lote} no encontrado.")
        if lote.id_producto != dto.id_producto:
            raise ValidationError("El lote seleccionado no corresponde al producto.")
        
        # Bloquear ajustes sobre lotes vencidos (inmutables)
        if lote.estado_lote == EstadoLoteEnum.VENCIDO:
            raise ValidationError("No se permiten ajustes manuales sobre lotes vencidos (inmutables).")
        
        # 3. Registrar movimiento manual directo en la base de datos (con lote asociado)
        # El cálculo exacto y persistencia de stock_resultante se realiza por trigger BEFORE INSERT.
        movimiento = MovimientoStock(
            id_producto=dto.id_producto,
            id_lote=dto.id_lote,
            id_usuario=id_usuario,
            tipo_movimiento=dto.tipo_movimiento,
            cantidad=dto.cantidad,
            stock_resultante=0, # Sobreescrito por trigger BEFORE INSERT en NeonDB
            observacion=dto.observacion
        )
        
        self.session.add(movimiento)
        
        try:
            await self.session.commit()
            await self.session.refresh(movimiento)
        except Exception as e:
            await self.session.rollback()
            raise ValidationError(f"Error de base de datos al aplicar ajuste: {str(e)}")

        logger.info("inventory.manual_adjustment_registered", id_producto=dto.id_producto, tipo=dto.tipo_movimiento.value)
        return MovimientoStockResponse.model_validate(movimiento)

    async def get_lots_paginated(
        self, id_producto: Optional[int], active_only: bool, page: int, size: int
    ) -> PaginatedResponse[LoteResponse]:
        total, items = await self.repo.get_lots_paginated(
            id_producto=id_producto, active_only=active_only, page=page, size=size
        )
        pages = (total + size - 1) // size
        return PaginatedResponse[LoteResponse](
            items=[LoteResponse.model_validate(i) for i in items],
            page=page,
            size=size,
            total=total,
            pages=pages
        )

    async def get_kardex(self, producto_id: int, page: int, size: int) -> PaginatedResponse[MovimientoStockResponse]:
        stmt = select(Producto.id_producto).where(Producto.id_producto == producto_id)
        res = await self.session.execute(stmt)
        if not res.scalars().first():
            raise NotFoundError(f"Producto {producto_id} no existe.")

        total, items = await self.repo.get_kardex_paginated(producto_id, page=page, size=size)
        pages = (total + size - 1) // size
        return PaginatedResponse[MovimientoStockResponse](
            items=[MovimientoStockResponse.model_validate(i) for i in items],
            page=page,
            size=size,
            total=total,
            pages=pages
        )

    async def check_reconciliation(self, id_producto: Optional[int]) -> List[ReconciliationResponse]:
        rows = await self.repo.get_reconciliation_info(id_producto)
        return [
            ReconciliationResponse(
                id_producto=r["id_producto"],
                nombre=r["nombre"],
                stock_actual=r["stock_actual"],
                stock_calculado_kardex=r["stock_calculado_kardex"],
                stock_calculado_lotes=r["stock_calculado_lotes"],
                descuadrado=(
                    r["stock_actual"] != r["stock_calculado_kardex"] or
                    r["stock_actual"] != r["stock_calculado_lotes"] or
                    r["stock_calculado_kardex"] != r["stock_calculado_lotes"]
                )
            )
            for r in rows
        ]

    async def get_next_fefo_lot(self, producto_id: int) -> NextLotResponse:
        """
        Obtiene el próximo lote físico que consumirá el algoritmo FEFO.
        ⚠️ ADVERTENCIA: Este endpoint es estrictamente INFORMATIVO. Sirve para visualización,
        auditoría y alertas en el frontend, y NO interviene en la lógica de ventas ni del despacho FEFO real (gobernado en DB).
        """
        stmt = select(Producto).where(Producto.id_producto == producto_id)
        res = await self.session.execute(stmt)
        if not res.scalars().first():
            raise NotFoundError(f"Producto {producto_id} no encontrado.")

        lote = await self.repo.get_next_fefo_lot(producto_id)
        if not lote:
            raise NotFoundError(f"No se encontraron lotes vigentes para el producto {producto_id}.")

        dias = None
        if lote.fecha_vencimiento:
            now = datetime.now(UTC)
            fecha_lote_utc = lote.fecha_vencimiento.replace(tzinfo=UTC) if not lote.fecha_vencimiento.tzinfo else lote.fecha_vencimiento.astimezone(UTC)
            dias = max((fecha_lote_utc - now).days, 0)

        return NextLotResponse(
            id_lote=lote.id_lote,
            id_producto=lote.id_producto,
            fecha_vencimiento=lote.fecha_vencimiento,
            cantidad_disponible=lote.cantidad_disponible,
            dias_restantes=dias
        )

    async def run_expiration_procedure(self) -> int:
        from sqlalchemy import text
        res = await self.session.execute(text("SELECT sp_expirar_lotes_vencidos()"))
        count = res.scalar() or 0
        await self.session.commit()
        return count
```

---

### 4.4. Router HTTP (`app/modules/inventory/router.py`)

Añade el nuevo endpoint `lots/next/{producto_id}` con requerimiento de rol de lectura de inventario.

```python
from typing import Optional
from fastapi import APIRouter, Depends, Query, status

from app.core.constants import Permission
from app.modules.inventory.schemas import (
    LoteCreateRequest, LoteResponse, AjusteStockRequest,
    MovimientoStockResponse, ReconciliationResponse, NextLotResponse
)
from app.modules.inventory.service import InventoryService
from app.modules.inventory.dependencies import get_inventory_service
from app.security.dependencies import require_permission, AuthUser
from app.shared.schemas.pagination import PaginatedResponse

router = APIRouter(prefix="/inventory", tags=["Inventario & Kardex"])

@router.post(
    "/lots",
    response_model=LoteResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission(Permission.INVENTORY_WRITE))]
)
async def registrar_lote(
    dto: LoteCreateRequest,
    service: InventoryService = Depends(get_inventory_service)
):
    """Permite registrar un nuevo lote de producto al almacén físico."""
    return await service.registrar_lote(dto)

@router.get(
    "/lots",
    response_model=PaginatedResponse[LoteResponse],
    dependencies=[Depends(require_permission(Permission.INVENTORY_READ))]
)
async def list_lotes(
    id_producto: Optional[int] = Query(None, description="Filtrar por producto"),
    active_only: bool = Query(False, description="Solo lotes vigentes con stock"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    service: InventoryService = Depends(get_inventory_service)
):
    """Lista todos los lotes de productos registrados."""
    return await service.get_lots_paginated(id_producto, active_only, page, size)

@router.get(
    "/lots/next/{producto_id}",
    response_model=NextLotResponse,
    dependencies=[Depends(require_permission(Permission.INVENTORY_READ))]
)
async def ver_siguiente_lote_fefo(
    producto_id: int,
    service: InventoryService = Depends(get_inventory_service)
):
    """Obtiene el próximo lote físico que consumirá el algoritmo FEFO para un producto (Solo informativo)."""
    return await service.get_next_fefo_lot(producto_id)

@router.post(
    "/adjustments",
    response_model=MovimientoStockResponse,
    dependencies=[Depends(require_permission(Permission.INVENTORY_WRITE))]
)
async def ajustar_stock(
    dto: AjusteStockRequest,
    current_user: AuthUser,
    service: InventoryService = Depends(get_inventory_service)
):
    """Registra una merma o ajuste manual sobre un lote específico."""
    return await service.ajustar_stock(dto, current_user.user_id)

@router.get(
    "/kardex/{producto_id}",
    response_model=PaginatedResponse[MovimientoStockResponse],
    dependencies=[Depends(require_permission(Permission.INVENTORY_READ))]
)
async def ver_kardex(
    producto_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    service: InventoryService = Depends(get_inventory_service)
):
    """Obtiene el historial cronológico (Kardex) de un producto físico."""
    return await service.get_kardex(producto_id, page, size)

@router.get(
    "/reconciliation",
    response_model=list[ReconciliationResponse],
    dependencies=[Depends(require_permission(Permission.INVENTORY_READ))]
)
async def ver_conciliacion(
    id_producto: Optional[int] = Query(None),
    service: InventoryService = Depends(get_inventory_service)
):
    """Concilia el stock del cache contra la suma de Kardex y Lotes (Auditoría)."""
    return await service.check_reconciliation(id_producto)

@router.post(
    "/expire-lots",
    dependencies=[Depends(require_permission(Permission.INVENTORY_WRITE))]
)
async def forzar_expiracion_lotes(
    service: InventoryService = Depends(get_inventory_service)
):
    """Invoca la expiración de lotes obsoletos inmediatamente (uso administrativo)."""
    lots_expired = await service.run_expiration_procedure()
    return {"status": "success", "lots_expired": lots_expired}
```

---

## 5. Tarea en Segundo Plano Celery Beat (Corrección de asyncio)

Se simplifica la tarea de Celery para utilizar directamente `asyncio.run()`, evitando fallos causados por el loop de eventos en workers síncronos.

### 5.1. Definición Corrección de la Tarea (`app/infrastructure/workers/tasks/inventory.py`)
```python
import asyncio
import structlog
from app.infrastructure.workers.celery_app import celery_app
from app.infrastructure.database.session import AsyncSessionFactory
from app.modules.inventory.repository_impl import InventoryRepositoryImpl
from app.modules.inventory.service import InventoryService

logger = structlog.get_logger(__name__)

async def _run_expiration():
    async with AsyncSessionFactory() as session:
        repo = InventoryRepositoryImpl(session)
        service = InventoryService(repo, session)
        count = await service.run_expiration_procedure()
        logger.info("inventory.lots_expired_batch", count=count)
        return count

@celery_app.task(name="app.infrastructure.workers.tasks.inventory.expire_lots_daily")
def expire_lots_daily_task() -> int:
    """Tarea determinista diaria para expirar lotes obsoletos."""
    try:
        return asyncio.run(_run_expiration())
    except Exception as e:
        logger.error("inventory.expiration_failed", error=str(e))
        raise e
```

---

## 6. Control de Acceso Basado en Roles (RBAC) y Seguridad

El control de accesos para el módulo de inventario está restringido de forma exclusiva al rol de administrador. Los clientes no tienen acceso al inventario ni al Kardex.

```python
class UserRole(StrEnum):
    ADMIN = "ADMIN"
    CLIENT = "CLIENTE"

# Mapeo formal de privilegios en Python
ROLE_PERMISSIONS: dict[UserRole, set[Permission]] = {
    UserRole.ADMIN: set(Permission),
    UserRole.CLIENT: {
        Permission.PRODUCT_READ,
        Permission.ORDER_READ_OWN,
        Permission.ORDER_CREATE,
        Permission.USER_READ_OWN,
        Permission.SWEETCOINS_READ,
    },
}
```

---

## 7. Plan de Pruebas Integradas

### 7.1. Pruebas de Conciliación Triple
- Registrar un producto físico.
- Agregar 2 lotes con distintas cantidades.
- Insertar ajustes y mermas a través del servicio de ajustes.
- **Assert:** El servicio `check_reconciliation()` no debe reportar descuadres.
- Modificar manualmente la tabla `productos` sin movimiento de Kardex (simulando corrupción).
- **Assert:** El servicio `check_reconciliation()` debe marcar el producto como descuadrado.

### 7.2. Pruebas de Lotes Vencidos
- Registrar un lote vencido.
- Intentar realizar un ajuste negativo sobre dicho lote.
- **Assert:** Debe arrojar error de validación `ValidationError("No se permiten ajustes sobre lotes vencidos.")`.
- Modificar la fecha a UTC aware y validar que no arroje errores por desfase horario.
