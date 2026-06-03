import asyncio
import os
import sys
import asyncpg
from pathlib import Path

# Cargar .env manualmente si no están las variables
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
        print("DATABASE_URL no encontrada en el entorno o en el archivo .env", file=sys.stderr)
        sys.exit(1)
    
    # asyncpg requiere postgresql:// o postgres://, no postgresql+asyncpg://
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    
    print(f"Conectándose a la base de datos...")
    
    # Ruta del SQL de la migración M09
    script_dir = Path(__file__).resolve().parent
    sql_path = script_dir.parent.parent / "_modelBD" / "M09_trigger_ajustes_stock.sql"
    
    if not sql_path.exists():
        print(f"No se encontró el archivo SQL en: {sql_path}", file=sys.stderr)
        sys.exit(1)
        
    with open(sql_path, "r", encoding="utf-8") as f:
        sql_content = f.read()
        
    try:
        conn = await asyncpg.connect(db_url)
        print("Conexión establecida exitosamente.")
        
        # Ejecutar el SQL de la migración
        print("Aplicando migración M09 (Trigger de ajustes manuales)...")
        await conn.execute(sql_content)
        print("Migración aplicada exitosamente en NeonDB.")
        
        await conn.close()
    except Exception as e:
        print(f"Error aplicando migración: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
