# SKILL 08 — Contratos de API (Response Envelopes y Endpoints)

> **CUÁNDO USAR:** Antes de definir respuestas de endpoints, manejar errores en el frontend, o escribir schemas Pydantic de salida.

---

## 1. Envelope de Respuesta Estándar

### Success (2xx)
```json
{
  "success": true,
  "data": { ... },
  "message": null
}
```

### Error (4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Producto 42 no encontrado"
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Paginado
```json
{
  "items": [...],
  "total": 150,
  "page": 2,
  "page_size": 20,
  "total_pages": 8
}
```

---

## 2. Schemas Pydantic Base (`app/shared/schemas/`)

```python
# response.py
from typing import Generic, TypeVar
T = TypeVar("T")

class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T
    message: str | None = None

class MessageResponse(BaseModel):
    success: bool = True
    message: str

class ErrorDetail(BaseModel):
    code: str
    message: str

class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail
    request_id: str

# pagination.py
class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int

    @classmethod
    def from_list(cls, items: list[T], total: int, params: PaginationParams):
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            total_pages=ceil(total / params.page_size),
        )
```

---

## 3. Mapa de Endpoints por Módulo

### Auth (`/api/v1/auth`)
| Método | Ruta | Roles | Body / Query / Headers | Descripción |
|---|---|---|---|---|
| `POST` | `/login` | Público | `{ "email": "...", "password": "..." }` | Inicia sesión, retorna JWTs. |
| `POST` | `/register` | Público | `{ "first_name": "...", "last_name": "...", "email": "...", "password": "...", "phone": "..." }` | Crea usuario. Si es CLIENTE envía email. |
| `POST` | `/refresh` | Público | `{ "refresh_token": "..." }` | Renueva el token de acceso JWT. |
| `GET` | `/verify` | Público | Query: `?token=<jwt_verification_token>` | Verifica y activa la cuenta del cliente. |
| `POST` | `/logout` | Autenticado | Header: `Authorization: Bearer <token>` | Cierra sesión e invalida el JWT en Redis. |
| `GET` | `/me` | Autenticado | Header: `Authorization: Bearer <token>` | Obtiene información del usuario actual. |

### Users (`/api/v1/users`)
| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/me/profile` | CLIENTE | Perfil completo |
| `PUT` | `/me/profile` | CLIENTE | Actualizar perfil |
| `GET` | `/me/fiscal-data` | CLIENTE | Datos fiscales |
| `POST` | `/me/fiscal-data` | CLIENTE | Agregar dato fiscal |
| `PUT` | `/me/fiscal-data/{id}` | CLIENTE | Actualizar |
| `DELETE` | `/me/fiscal-data/{id}` | CLIENTE | Eliminar |
| `GET` | `/` | ADMIN | Listar usuarios |
| `PUT` | `/{id}/status` | ADMIN | Activar/desactivar |

### Categorías (`/api/v1/categorias`) [NUEVO — M13]

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | Público | Lista paginada de categorías activas (`estado=True`). Query: `?search=&page=&size=`. |
| `GET` | `/admin` | ADMIN | Lista paginada de todas las categorías (sin filtro de estado). |
| `GET` | `/{id}` | Público | Detalle de una categoría por ID. |
| `POST` | `/` | ADMIN | Crear categoría. Body JSON: `{ "nombre": "...", "descripcion": "...", "estado": true }`. Auto-slug con python-slugify. 409 si nombre duplicado. |
| `PUT` | `/{id}` | ADMIN | Actualizar categoría. Body JSON: `{ "nombre"?: "...", "descripcion"?: "...", "estado"?: bool }`. Regenera slug si cambia nombre. |
| `DELETE` | `/{id}` | ADMIN | Soft delete (`estado=False`). 422 si tiene productos o cupones asociados. |

### Products (`/api/v1/products`)
| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | Público | Catálogo paginado con filtros |
| `GET` | `/admin` | ADMIN | Catálogo sin filtros automáticos |
| `GET` | `/{id}` | Público | Detalle de producto |
| `POST` | `/` | ADMIN | Crear producto |
| `PUT` | `/{id}` | ADMIN | Actualizar producto |
| `DELETE` | `/{id}` | ADMIN | Desactivar producto |

### Packages (`/api/v1/packages`)
| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | Público | Lista paginada. Filtra dinámicamente según stock (solo devuelve `disponible: true`) |
| `GET` | `/{id}` | Público | Detalle del paquete (retorna `{ ..., "disponible": true/false }` evaluado dinámicamente) |
| `POST` | `/` | ADMIN | Crear paquete (validando mínimo 2 productos distintos) |
| `PUT` | `/{id}` | ADMIN | Actualizar paquete |
| `DELETE` | `/{id}` | ADMIN | Soft delete del paquete |

### Inventory (`/api/v1/inventory`)
| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/lots` | ADMIN | Listar lotes con filtros |
| `POST` | `/lots` | ADMIN | Ingresar lote |
| `GET` | `/kardex/{producto_id}` | ADMIN | Kardex paginado |
| `POST` | `/adjustments` | ADMIN | Ajuste manual de stock |
| `GET` | `/stock-reconciliation` | ADMIN | Conciliación cache vs Kardex |

### Ventas (`/api/v1/ventas`)
| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/` | ADMIN | Todas las ventas |
| `GET` | `/mine` | CLIENTE | Mis ventas |
| `GET` | `/{id}` | Autenticado* | Detalle de venta |
| `POST` | `/checkout` | CLIENTE | Crear venta + pago |
| `PUT` | `/{id}/status` | ADMIN | Cambiar estado |
| `POST` | `/{id}/cancel` | ADMIN | Anular venta |
| `GET` | `/{id}/document` | Autenticado | Descargar PDF |

### CriptoTrufas (`/api/v1/cripto-trufa`)
| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/dashboard` | CLIENTE | Saldo + cupones activos + últimos 5 movimientos |
| `GET` | `/balance` | CLIENTE | Saldo actual |
| `GET` | `/history` | CLIENTE | Historial de movimientos |
| `GET` | `/coupons/available` | CLIENTE | Catálogo de cupones canjeables (cacheado 5 min) |
| `POST` | `/coupons/redeem` | CLIENTE | Canjear cupón (Header opcional `Idempotency-Key`) |
| `GET` | `/coupons/mine` | CLIENTE | Mis cupones |
| `GET` | `/public-config` | CLIENTE | Configuración activa (solo lectura) |
| `POST` | `/play-ruleta` | CLIENTE | Ruleta Dulce (costo 50 pts) |
| `POST` | `/adjust` | ADMIN | Ajuste manual de puntos (auditado) |
| `GET` | `/config` | ADMIN | Configuración activa |
| `PUT` | `/config` | ADMIN | Actualizar configuración global |
| `GET` | `/admin/clientes` | ADMIN | Clientes con saldo |
| `GET` | `/admin/history/{id_cliente}` | ADMIN | Historial de un cliente |
| `GET` | `/admin/coupons` | ADMIN | Listar cupones maestros |
| `POST` | `/admin/coupons` | ADMIN | Crear cupón maestro |
| `PUT` | `/admin/coupons/{id}` | ADMIN | Actualizar cupón maestro |
| `DELETE` | `/admin/coupons/{id}` | ADMIN | Desactivar cupón maestro (borrado lógico) |

### Dashboard (`/api/v1/dashboard`)
| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| `GET` | `/kpis` | ADMIN | KPIs generales |
| `GET` | `/sales-chart` | ADMIN | Datos para gráfico de ventas |
| `GET` | `/top-products` | ADMIN | Productos más vendidos |
| `GET` | `/low-stock` | ADMIN | Productos bajo stock mínimo |

---

## 4. Códigos de Error Estándar

| HTTP | error_code | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input inválido |
| 401 | `UNAUTHORIZED` | Sin token |
| 401 | `INVALID_TOKEN` | Token expirado/inválido |
| 401 | `INVALID_CREDENTIALS` | Email/password incorrectos |
| 403 | `FORBIDDEN` | Sin permisos |
| 403 | `INSUFFICIENT_ROLE` | Rol insuficiente |
| 404 | `NOT_FOUND` | Recurso no existe |
| 409 | `CONFLICT` | Estado incompatible |
| 409 | `DUPLICATE_RESOURCE` | Ya existe (email, documento) |
| 422 | `BUSINESS_RULE_ERROR` | Regla de negocio violada |
| 422 | `INSUFFICIENT_STOCK` | Stock insuficiente |
| 422 | `INSUFFICIENT_CRIPTOTRUFAS` | CriptoTrufas insuficientes |
| 422 | `COUPON_DISABLED` | Cupón maestro inactivo o no existe |
| 500 | `INTERNAL_ERROR` | Error no esperado |
| 503 | `EXTERNAL_SERVICE_ERROR` | Pasarela de pago caída |

---

## 5. Query Params Estándar (Paginación y Filtros)

```
GET /api/v1/products?page=1&page_size=20&categoria=3&estado=true&q=torta
GET /api/v1/ventas?page=1&page_size=20&estado=PENDIENTE&from=2025-01-01&to=2025-12-31
GET /api/v1/inventory/lots?page=1&page_size=20&estado_lote=VIGENTE&id_producto=5
```

---

## 6. Headers Requeridos

```
Authorization: Bearer <access_token>    # En todos los endpoints protegidos
Content-Type: application/json          # En todos los POST/PUT/PATCH
X-Request-ID: <uuid>                    # Opcional, se genera automáticamente
```
