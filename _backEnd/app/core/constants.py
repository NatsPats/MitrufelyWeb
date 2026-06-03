"""
Mifrufely Web — RBAC Constants (ampliado Fase 3)
Role-Based Access Control: roles, permisos y mapeo rol → permisos
"""

from enum import StrEnum


class UserRole(StrEnum):
    ADMIN   = "ADMIN"
    CLIENT  = "CLIENTE"


class Permission(StrEnum):
    # ── Inventory ─────────────────────
    INVENTORY_READ   = "inventory:read"
    INVENTORY_WRITE  = "inventory:write"
    INVENTORY_DELETE = "inventory:delete"

    # ── Orders ────────────────────────
    ORDER_READ_OWN = "order:read:own"
    ORDER_READ_ALL = "order:read:all"
    ORDER_CREATE   = "order:create"
    ORDER_UPDATE   = "order:update"

    # ── Products ──────────────────────
    PRODUCT_READ   = "product:read"
    PRODUCT_WRITE  = "product:write"
    PRODUCT_DELETE = "product:delete"

    # ── Users ─────────────────────────
    USER_READ_OWN = "user:read:own"
    USER_READ_ALL = "user:read:all"
    USER_UPDATE   = "user:update"

    # ── Reports ───────────────────────
    REPORT_GENERATE = "report:generate"
    DASHBOARD_READ  = "dashboard:read"

    # ── SweetCoins ────────────────────
    SWEETCOINS_READ   = "sweetcoins:read"
    SWEETCOINS_ADJUST = "sweetcoins:adjust"


# Role → Permission mapping
ROLE_PERMISSIONS: dict[UserRole, set[Permission]] = {
    # ── ADMIN: todos los permisos ──────────────────────────────────────────
    UserRole.ADMIN: set(Permission),

    # ── CLIENT: operaciones propias ───────────────────────────────────────
    UserRole.CLIENT: {
        Permission.PRODUCT_READ,
        Permission.ORDER_READ_OWN,
        Permission.ORDER_CREATE,
        Permission.USER_READ_OWN,
        Permission.SWEETCOINS_READ,
    },
}
