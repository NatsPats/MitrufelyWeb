"""
Mifrufely Web — Database Seed Script
Seeds the base data required for the application to function:
  - roles (ADMIN, CLIENTE, CAJERO, ALMACEN)
  - configuracion_recompensas (default active config)

Run from the _backEnd directory:
    python scripts/seed_db.py

Or inside Docker:
    docker compose exec api python scripts/seed_db.py
"""

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

# Ensure all models are registered before any query
import app.infrastructure.database.models  # noqa: F401
from app.infrastructure.database.session import database_engine


async def seed_roles(session: AsyncSession) -> None:
    """Insert the 4 base roles if they don't exist yet."""
    result = await session.execute(text("SELECT COUNT(*) FROM roles"))
    count = result.scalar()

    if count and count > 0:
        print(f"✓ roles: already has {count} row(s), skipping.")
        return

    await session.execute(text("""
        INSERT INTO roles (nombre) VALUES
            ('ADMIN'),
            ('CLIENTE'),
            ('CAJERO'),
            ('ALMACEN')
        ON CONFLICT (nombre) DO NOTHING
    """))
    await session.commit()
    print("✓ roles: seeded 4 base roles (ADMIN, CLIENTE, CAJERO, ALMACEN).")


async def seed_configuracion_recompensas(session: AsyncSession) -> None:
    """Insert a default rewards configuration if none exists."""
    result = await session.execute(text("SELECT COUNT(*) FROM configuracion_recompensas WHERE estado = true"))
    count = result.scalar()

    if count and count > 0:
        print(f"✓ configuracion_recompensas: already has {count} active config(s), skipping.")
        return

    await session.execute(text("""
        INSERT INTO configuracion_recompensas (tasa_conversion, limite_puntos_billetera, dias_expiracion, estado)
        VALUES (0.1000, 10000, 365, true)
    """))
    await session.commit()
    print("[OK] configuracion_recompensas: seeded default config (10% rate, 10000 limit, 365 days).")


async def main() -> None:
    print("[SEED] Mifrufely -- Running database seed...\n")

    session_factory = async_sessionmaker(
        bind=database_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async with session_factory() as session:
        await seed_roles(session)
        await seed_configuracion_recompensas(session)

    await database_engine.dispose()
    print("\n[SEED] Done! Seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
