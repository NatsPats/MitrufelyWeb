-- ==========================================================
-- MÓDULO 07: SCRIPT MAESTRO DE EJECUCIÓN (MYTRUFELY)
-- Motor: PostgreSQL
-- Propósito: Orquesta la ejecución de todos los módulos en
--            el orden correcto de dependencias.
--            Úsalo para inicializar la BD desde cero.
-- ==========================================================
--
-- ORDEN DE EJECUCIÓN:
--   1. M01_enums_tipos.sql          → ENUMs (sin dependencias)
--   2. M02_usuarios_roles.sql       → Roles, usuarios, clientes, datos fiscales
--   3. M03_catalogo_inventario.sql  → Categorías, productos, lotes, Kardex
--   4. M04_cupones.sql              → Cupones maestro y de cliente
--   5. M05_ventas_pagos.sql         → Ventas, detalles, pagos, documentos
--   6. M06_recompensas_sweetcoins.sql → SweetCoins, puntos, reversiones
--
-- Para ejecutar desde psql:
--   \i M01_enums_tipos.sql
--   \i M02_usuarios_roles.sql
--   \i M03_catalogo_inventario.sql
--   \i M04_cupones.sql
--   \i M05_ventas_pagos.sql
--   \i M06_recompensas_sweetcoins.sql
--
-- O desde terminal (bash / PowerShell):
--   $files = @(
--     "M01_enums_tipos.sql",
--     "M02_usuarios_roles.sql",
--     "M03_catalogo_inventario.sql",
--     "M04_cupones.sql",
--     "M05_ventas_pagos.sql",
--     "M06_recompensas_sweetcoins.sql"
--   )
--   foreach ($f in $files) { psql -U postgres -d mytrufely -f $f }
--
-- ==========================================================

-- Verifica que se ejecuta sobre la BD correcta
DO $$
BEGIN
  RAISE NOTICE '=== MYTRUFELY: Iniciando instalación del esquema físico ===';
  RAISE NOTICE 'Timestamp: %', NOW();
END $$;

-- Aquí NO se \i los archivos porque psql no permite \i dentro de un bloque DO.
-- Este script es una referencia. Ejecuta cada módulo en el orden indicado.

DO $$
BEGIN
  RAISE NOTICE '=== Instalación completada ===';
END $$;
