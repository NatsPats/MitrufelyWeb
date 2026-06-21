"""
Mifrufely Web — Reviews Schemas
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CreateReviewRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Calificación de 1 a 5 estrellas")
    comment: Optional[str] = Field(None, max_length=1000, description="Comentario opcional")


class ReviewResponse(BaseModel):
    id_review: int
    id_venta: int
    id_cliente: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminReviewResponse(ReviewResponse):
    cliente_nombre: str
    estado_pedido: str

    model_config = ConfigDict(from_attributes=True)


class ReviewMetricsResponse(BaseModel):
    total_reviews: int
    promedio_calificacion: float
    distribucion_estrellas: dict[int, int]  # {5: 10, 4: 5, 3: 2, 2: 0, 1: 1}
