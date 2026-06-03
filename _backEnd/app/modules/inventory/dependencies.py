"""
Mifrufely Web — Inventory Module: FastAPI Dependency Injection (Fase 3)
Fábrica de servicio de inventario inyectable en los endpoints.
"""

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.session import get_db_session
from app.modules.inventory.repository_impl import InventoryRepositoryImpl
from app.modules.inventory.service import InventoryService


def get_inventory_repository(
    session: AsyncSession = Depends(get_db_session),
) -> InventoryRepositoryImpl:
    return InventoryRepositoryImpl(session)


def get_inventory_service(
    repo: InventoryRepositoryImpl = Depends(get_inventory_repository),
    session: AsyncSession = Depends(get_db_session),
) -> InventoryService:
    return InventoryService(repo=repo, session=session)
