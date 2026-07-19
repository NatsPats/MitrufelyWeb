"""
Mifrufely Web — Main API Router
Aggregates all module routers under /api/v1
"""

from fastapi import APIRouter
from fastapi.responses import ORJSONResponse

from app.modules.auth.router import router as auth_router
from app.modules.cart.router import router as cart_router
from app.modules.categories.router import router as categories_router
from app.modules.config.router import router as config_router, public_router as public_config_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.inventory.router import router as inventory_router
from app.modules.issues.router import router as issues_router
from app.modules.notifications.router import router as notifications_router
from app.modules.orders.router import router as orders_router
from app.modules.products.router import router as packages_router
from app.modules.products.router_productos import router as productos_router
from app.modules.reviews.router import router as reviews_router
from app.routers.storage import router as storage_router

from app.modules.sweetcoins.router import router as sweetcoins_router
from app.modules.reports.router import router as reports_router
from app.modules.users.router import router as users_router
from app.modules.consultas.router import router as consultas_router

api_router = APIRouter()

# ── Health Check ──────────────────────────────────────────────────────────────


@api_router.get(
    "/health",
    tags=["Health"],
    summary="Health check",
    response_class=ORJSONResponse,
)
async def health_check() -> dict:
    return {"status": "ok", "service": "mifrufely-backend"}


# ── Module Registration ───────────────────────────────────────────────────────

api_router.include_router(auth_router)
api_router.include_router(categories_router)
api_router.include_router(productos_router)
api_router.include_router(packages_router)
api_router.include_router(orders_router)
api_router.include_router(storage_router)
api_router.include_router(inventory_router)
api_router.include_router(cart_router)
# M14: Nuevos módulos
api_router.include_router(config_router)
api_router.include_router(public_config_router)
api_router.include_router(dashboard_router)
api_router.include_router(reviews_router)
api_router.include_router(issues_router)
api_router.include_router(notifications_router)
api_router.include_router(sweetcoins_router)
api_router.include_router(reports_router)
api_router.include_router(users_router)
api_router.include_router(consultas_router)
