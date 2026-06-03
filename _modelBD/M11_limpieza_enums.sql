-- ==========================================================
-- MIGRACIÓN M11: Limpieza de ENUMs obsoletos (Roles y Pagos)
-- APLICAR EN: NeonDB (producción) y DB de tests
-- PROPÓSITO: Remueve los roles CAJERO y ALMACEN, y limpia los
--            tipos tipo_rol_enum y tipo_pago_enum.
-- ==========================================================

-- 1. Limpieza de Roles obsoletos
DELETE FROM roles WHERE nombre::text IN ('CAJERO', 'ALMACEN');

-- Cambiar temporalmente a TEXT para poder eliminar el ENUM viejo
ALTER TABLE roles ALTER COLUMN nombre TYPE text;

DROP TYPE IF EXISTS tipo_rol_enum CASCADE;

CREATE TYPE tipo_rol_enum AS ENUM (
  'ADMIN',
  'CLIENTE'
);

-- Re-asociar el nuevo tipo ENUM a la columna de roles
ALTER TABLE roles ALTER COLUMN nombre TYPE tipo_rol_enum USING nombre::tipo_rol_enum;

-- 2. Limpieza de Métodos de Pago obsoletos
-- Cambiar temporalmente a TEXT para permitir la actualización de valor y eliminación del ENUM
ALTER TABLE metodos_pago ALTER COLUMN tipo_pago TYPE text;

-- Ahora actualizamos registros existentes a 'TARJETA'
UPDATE metodos_pago SET tipo_pago = 'TARJETA';

DROP TYPE IF EXISTS tipo_pago_enum CASCADE;

CREATE TYPE tipo_pago_enum AS ENUM (
  'TARJETA'
);

-- Re-asociar el nuevo tipo ENUM a metodos_pago
ALTER TABLE metodos_pago ALTER COLUMN tipo_pago TYPE tipo_pago_enum USING tipo_pago::tipo_pago_enum;
