"""
Mifrufely Web — Abstract Service Base
Generic service layer contract — all services must extend this.
"""

from abc import ABC
from typing import Generic, TypeVar

SchemaT = TypeVar("SchemaT")
CreateT = TypeVar("CreateT")
UpdateT = TypeVar("UpdateT")
IDTYPE = TypeVar("IDTYPE")


class AbstractService(ABC, Generic[SchemaT, CreateT, UpdateT, IDTYPE]):
    """
    Abstract base service.
    Orchestrates repositories, enforces business rules.
    All operations are async.
    """
    pass
