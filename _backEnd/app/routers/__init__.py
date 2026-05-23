"""
Mifrufely Web — Main API Router
Aggregates all module routers under /api/v1
"""

from fastapi import APIRouter
from fastapi.responses import ORJSONResponse

from app.modules.auth.router import router as auth_router

# ── Module Routers ────────────────────────────────────────────────────────────
# Additional routers will be imported and included here as modules are built:
# from app.modules.products.router import router as products_router
# from app.modules.orders.router import router as orders_router
# from app.modules.inventory.router import router as inventory_router
# from app.modules.cart.router import router as cart_router
# from app.modules.sweetcoins.router import router as sweetcoins_router
# from app.modules.reports.router import router as reports_router
# from app.modules.dashboard.router import router as dashboard_router
# from app.modules.users.router import router as users_router

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
# api_router.include_router(products_router)
# api_router.include_router(orders_router)
# api_router.include_router(inventory_router)
# api_router.include_router(cart_router)
# api_router.include_router(sweetcoins_router)
# api_router.include_router(reports_router)
# api_router.include_router(dashboard_router)
# api_router.include_router(users_router)
