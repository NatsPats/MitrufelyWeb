"""
Mifrufely Web — System Config Repository Implementation (SQLAlchemy)
"""

from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.database.models.pedidos_ext import SystemConfig, ConfigAuditLog
from app.modules.config.repository import ISystemConfigRepository


class SystemConfigRepositoryImpl(ISystemConfigRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_key(self, key: str) -> Optional[SystemConfig]:
        stmt = select(SystemConfig).where(SystemConfig.config_key == key)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self) -> List[SystemConfig]:
        stmt = select(SystemConfig).order_by(SystemConfig.config_key)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def set_value(
        self,
        key: str,
        value: str,
        updated_by: Optional[int] = None,
    ) -> SystemConfig:
        config = await self.get_by_key(key)
        old_val = None
        
        if config:
            old_val = config.config_value
            config.config_value = value
            if updated_by:
                config.updated_by = updated_by
        else:
            config = SystemConfig(
                config_key=key,
                config_value=value,
                updated_by=updated_by,
            )
            self._session.add(config)
            
        # Create audit log if value changed
        if old_val != value:
            audit = ConfigAuditLog(
                config_key=key,
                old_value=old_val,
                new_value=value,
                changed_by=updated_by
            )
            self._session.add(audit)
            
        await self._session.flush()
        return config
