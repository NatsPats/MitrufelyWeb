import asyncio
import os
import sys
import asyncpg
from pathlib import Path

def load_env():
    env_path = Path(__file__).resolve().parent.parent / '.env'
    if env_path.exists():
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' in line:
                    key, val = line.split('=', 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    os.environ[key] = val

async def main():
    load_env()
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL no encontrada en el entorno.")
        sys.exit(1)
        
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        
    try:
        conn = await asyncpg.connect(db_url)
        print("Conectado a NeonDB.")
        
        # Consultar registros de la tabla roles
        roles_rows = await conn.fetch("SELECT * FROM roles;")
        print("\n[BD] Registros en la tabla 'roles':")
        for r in roles_rows:
            print(f"  id_rol: {r['id_rol']} | nombre: {r['nombre']}")
            
        # Consultar cuántos usuarios tienen asignados cada rol
        usuarios_por_rol = await conn.fetch("""
            SELECT r.nombre, COUNT(u.id_usuario) as total
            FROM roles r
            LEFT JOIN usuarios u ON u.id_rol = r.id_rol
            GROUP BY r.nombre;
        """)
        print("\n[BD] Usuarios por rol asignado:")
        for ur in usuarios_por_rol:
            print(f"  Rol: {ur['nombre']} | Cantidad de usuarios: {ur['total']}")
            
        await conn.close()
    except Exception as e:
        print(f"Error consultando: {e}")

if __name__ == "__main__":
    asyncio.run(main())
