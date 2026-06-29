"""
Mifrufely Web — Repository Interfaces: CriptoTrufa / SweetCoins (Módulo M06)
Defines abstract contracts for data-access decoupled from SQL.
"""

from abc import ABC, abstractmethod
from typing import List, Optional

from app.domain.repositories.base import AbstractRepository
from app.infrastructure.database.models.cupones import CuponCliente, CuponMaestro
from app.infrastructure.database.models.recompensas import ConfiguracionRecompensas, MovimientoPuntos


class ICuponMaestroRepository(AbstractRepository[CuponMaestro, int], ABC):
    """Interfaz abstracta para el repositorio de Cupones Maestro."""

    @abstractmethod
    async def get_available(self) -> List[CuponMaestro]:
        """Recupera todas las plantillas de cupones activas que son canjeables con puntos."""
        ...


class ICuponClienteRepository(AbstractRepository[CuponCliente, int], ABC):
    """Interfaz abstracta para el repositorio de Cupones de Cliente."""

    @abstractmethod
    async def get_by_codigo(self, codigo_unico: str) -> Optional[CuponCliente]:
        """Obtiene un cupón del cliente por su código único de canje."""
        ...

    @abstractmethod
    async def get_active_by_cliente(self, id_cliente: int) -> List[CuponCliente]:
        """Obtiene los cupones activos (DISPONIBLE) y no vencidos de un cliente."""
        ...

    @abstractmethod
    async def get_all_by_cliente(self, id_cliente: int) -> List[CuponCliente]:
        """Obtiene todos los cupones (historial completo de cupones) de un cliente."""
        ...

    @abstractmethod
    async def expire_vencidos(self) -> int:
        """Cambia el estado de DISPONIBLE a EXPIRADO para todos los cupones cuya fecha de expiración sea menor a la actual."""
        ...


class IMovimientoPuntosRepository(AbstractRepository[MovimientoPuntos, int], ABC):
    """Interfaz abstracta para el repositorio de Movimientos de Puntos (Ledger)."""

    @abstractmethod
    async def get_saldo(self, id_cliente: int) -> int:
        """Obtiene el saldo total actual de puntos de un cliente."""
        ...

    @abstractmethod
    async def get_saldo_for_update(self, id_cliente: int) -> int:
        """
        Obtiene el saldo actual del cliente aplicando un lock pesimista (SELECT FOR UPDATE)
        a nivel de los registros de movimientos de puntos de ese cliente, para evitar
        condiciones de carrera y sobre-giros.
        """
        ...

    @abstractmethod
    async def get_history(self, id_cliente: int, *, limit: int = 50) -> List[MovimientoPuntos]:
      """Obtiene el historial cronológico de movimientos de puntos del cliente (orden DESC por fecha)."""
      ...

    @abstractmethod
    async def get_todos_clientes_con_saldo(self) -> List[dict]:
      """Obtiene todos los clientes con su información y su saldo acumulado."""
      ...


class IConfiguracionRecompensasRepository(AbstractRepository[ConfiguracionRecompensas, int], ABC):
    """Interfaz abstracta para el repositorio de Configuración de Recompensas."""

    @abstractmethod
    async def get_active(self) -> Optional[ConfiguracionRecompensas]:
        """Recupera la configuración global de recompensas activa en el sistema."""
        ...
