"""
Mifrufely Web — System Config Repository Interface
"""

from abc import ABC, abstractmethod
from typing import List, Optional

from app.infrastructure.database.models.pedidos_ext import SystemConfig


class ISystemConfigRepository(ABC):
    @abstractmethod
    async def get_by_key(self, key: str) -> Optional[SystemConfig]:
        pass

    @abstractmethod
    async def get_all(self) -> List[SystemConfig]:
        pass

    @abstractmethod
    async def set_value(self, key: str, value: str, updated_by: Optional[int] = None) -> SystemConfig:
        pass
