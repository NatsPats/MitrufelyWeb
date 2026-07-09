from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class AddCartItemRequest(BaseModel):
    id_producto: int = Field(..., gt=0)
    cantidad: int = Field(..., gt=0)
    es_paquete: bool = False
    id_paquete: Optional[int] = None


class UpdateCartItemRequest(BaseModel):
    cantidad: int = Field(..., gt=0)


class PackageComponentResponse(BaseModel):
    id_producto: int
    nombre: str
    cantidad: int
    precio_unitario: Decimal
    id_categoria: int


class CartItemResponse(BaseModel):
    id_producto: int
    nombre: str
    cantidad: int
    precio_unitario: Decimal
    imagen_url: Optional[str] = None
    es_paquete: bool = False
    id_paquete: Optional[int] = None
    id_categoria: Optional[int] = None
    stock_actual: Optional[int] = None
    productos: Optional[List[PackageComponentResponse]] = None


class CartResponse(BaseModel):
    items: List[CartItemResponse] = Field(default_factory=list)
    total_items: int = 0
    subtotal: Decimal = Decimal("0.00")
    updated_at: Optional[datetime] = None


class CartCheckoutResponse(BaseModel):
    id_venta: int
    total: Decimal
    estado: str
    estado_pago: str
    mensaje: str = "Venta creada desde el carrito exitosamente."
