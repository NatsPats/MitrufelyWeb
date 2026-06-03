import asyncio
import os
import sys
import asyncpg
from pathlib import Path
import re

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
    
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)
        
    try:
        conn = await asyncpg.connect(db_url)
        print("Conexión establecida con NeonDB.")
        
        # 1. Obtener tablas existentes
        tables_query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """
        tables = [row['table_name'] for row in await conn.fetch(tables_query)]
        print(f"\n[BD] Tablas existentes ({len(tables)}):")
        print(", ".join(tables))
        
        # 2. Obtener vistas existentes
        views_query = """
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'VIEW'
            ORDER BY table_name;
        """
        views = [row['table_name'] for row in await conn.fetch(views_query)]
        print(f"\n[BD] Vistas existentes ({len(views)}):")
        print(", ".join(views))
        
        # 3. Obtener triggers existentes
        triggers_query = """
            SELECT event_object_table, trigger_name 
            FROM information_schema.triggers 
            WHERE trigger_schema = 'public'
            ORDER BY event_object_table, trigger_name;
        """
        triggers = await conn.fetch(triggers_query)
        print(f"\n[BD] Triggers existentes ({len(triggers)}):")
        for t in triggers:
            print(f"  - Tabla: {t['event_object_table']} | Trigger: {t['trigger_name']}")
            
        # 4. Obtener tipos ENUM existentes
        enums_query = """
            SELECT t.typname as enum_name, string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
            FROM pg_catalog.pg_type t 
            JOIN pg_catalog.pg_enum e ON t.oid = e.enumtypid  
            JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
            WHERE n.nspname = 'public'
            GROUP BY t.typname
            ORDER BY t.typname;
        """
        enums = await conn.fetch(enums_query)
        print(f"\n[BD] Tipos ENUM existentes ({len(enums)}):")
        for e in enums:
            print(f"  - {e['enum_name']}: [{e['enum_values']}]")
            
        # 5. Obtener funciones / stored procedures existentes
        funcs_query = """
            SELECT p.proname as func_name
            FROM pg_catalog.pg_proc p
            JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public'
            ORDER BY p.proname;
        """
        funcs = [row['func_name'] for row in await conn.fetch(funcs_query)]
        print(f"\n[BD] Funciones/SPs existentes ({len(funcs)}):")
        print(", ".join(funcs))
        
        await conn.close()
        
        # Ahora contrastar con Query1.sql
        print("\n--- ANALIZANDO ARCHIVO Query1.sql ---")
        query1_path = Path(__file__).resolve().parent.parent.parent / "_modelBD" / "Query1.sql"
        if not query1_path.exists():
            print(f"No se encontró Query1.sql en: {query1_path}")
            return
            
        with open(query1_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Extraer nombres de tablas declaradas
        declared_tables = re.findall(r"CREATE\s+TABLE\s+(\w+)", content, re.IGNORECASE)
        print(f"\n[SQL] Tablas declaradas en Query1.sql ({len(declared_tables)}):")
        print(", ".join(sorted(declared_tables)))
        
        # Extraer vistas declaradas
        declared_views = re.findall(r"CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(\w+)", content, re.IGNORECASE)
        print(f"\n[SQL] Vistas declaradas en Query1.sql ({len(declared_views)}):")
        print(", ".join(sorted(declared_views)))
        
        # Extraer triggers declarados
        declared_triggers = re.findall(r"CREATE\s+TRIGGER\s+(\w+)\s+(?:BEFORE|AFTER)\s+\w+\s+(?:OR\s+\w+\s+)*ON\s+(\w+)", content, re.IGNORECASE)
        print(f"\n[SQL] Triggers declarados en Query1.sql ({len(declared_triggers)}):")
        for trg, tbl in declared_triggers:
            print(f"  - Tabla: {tbl} | Trigger: {trg}")
            
        # Extraer funciones declaradas
        declared_funcs = re.findall(r"CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(\w+)", content, re.IGNORECASE)
        print(f"\n[SQL] Funciones declaradas en Query1.sql ({len(declared_funcs)}):")
        print(", ".join(sorted(set(declared_funcs))))
        
        # --- COMPARACIÓN ---
        print("\n--- INFORME DE DISCREPANCIAS ENCONTRADAS ---")
        
        # Comparar Tablas
        missing_tables = set(declared_tables) - set(tables)
        if missing_tables:
            print(f"[ERROR] TABLAS FALTANTES EN BD: {missing_tables}")
        else:
            print("[OK] Todas las tablas declaradas existen en la base de datos.")
            
        # Comparar Vistas
        missing_views = set(declared_views) - set(views)
        if missing_views:
            print(f"[ERROR] VISTAS FALTANTES EN BD: {missing_views}")
        else:
            print("[OK] Todas las vistas declaradas existen en la base de datos.")
            
        # Comparar Funciones
        missing_funcs = set(declared_funcs) - set(funcs)
        if missing_funcs:
            print(f"[ERROR] FUNCIONES FALTANTES EN BD: {missing_funcs}")
        else:
            print("[OK] Todas las funciones declaradas existen en la base de datos.")
            
        # Comparar Triggers
        # Mapear triggers de la BD por (trigger, tabla)
        bd_trig_map = {(t['trigger_name'].lower(), t['event_object_table'].lower()) for t in triggers}
        missing_triggers = []
        for trg, tbl in declared_triggers:
            if (trg.lower(), tbl.lower()) not in bd_trig_map:
                missing_triggers.append((trg, tbl))
                
        if missing_triggers:
            print("[ERROR] TRIGGERS FALTANTES EN BD:")
            for trg, tbl in missing_triggers:
                print(f"  - Tabla: {tbl} | Trigger: {trg}")
        else:
            print("[OK] Todos los triggers declarados existen en la base de datos.")
            
    except Exception as e:
        print(f"Error en la conexión o análisis: {e}", file=sys.stderr)

if __name__ == "__main__":
    asyncio.run(main())
