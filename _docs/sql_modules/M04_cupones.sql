-- ==========================================================
-- MÓDULO 04: CUPONES (MYTRUFELY)
-- Motor: PostgreSQL
-- Propósito: Definición del catálogo maestro de cupones de
--            descuento y los cupones individuales asignados
--            a cada cliente con su ciclo de vida completo.
-- Depende de: M01_enums_tipos.sql, M02_usuarios_roles.sql,
--             M03_catalogo_inventario.sql (categorias)
-- ==========================================================

-- ── TABLAS ─────────────────────────────────────────────────

-- Plantillas de cupones de descuento configuradas por el admin
CREATE TABLE cupones_maestro (
  id_cupon            serial        PRIMARY KEY,
  id_categoria        int,           -- categoría de producto al que aplica
  nombre              varchar(100)  NOT NULL,
  descripcion         text,
  porcentaje_descuento numeric(5,2) NOT NULL
    CHECK (porcentaje_descuento > 0 AND porcentaje_descuento <= 100),
  costo_puntos        int,           -- coste en SweetCoins para adquirirlo
  dias_vigencia       int           NOT NULL CHECK (dias_vigencia > 0),
  estado              boolean       NOT NULL DEFAULT true
);

-- Cupones emitidos y asignados a un cliente específico
CREATE TABLE cupones_cliente (
  id_cupon_cliente  serial          PRIMARY KEY,
  id_cliente        int             NOT NULL,
  id_cupon          int             NOT NULL,
  codigo_unico      varchar(20) UNIQUE NOT NULL,
  estado            estado_cupon_enum  NOT NULL DEFAULT 'DISPONIBLE',
  origen            origen_cupon_enum  NOT NULL,
  fecha_adquisicion timestamp          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_uso         timestamp,
  fecha_expiracion  timestamp          NOT NULL
);

-- ── ÍNDICES ────────────────────────────────────────────────

CREATE INDEX ON cupones_maestro (id_categoria);
CREATE INDEX ON cupones_cliente (id_cliente);
CREATE INDEX ON cupones_cliente (id_cupon);
CREATE INDEX ON cupones_cliente (estado);
CREATE INDEX ON cupones_cliente (fecha_expiracion);

-- ── TRIGGER: NORMALIZACIÓN DE ESTADO ─────────────────────
-- Mantiene coherencia entre fecha_uso, fecha_expiracion y estado

CREATE OR REPLACE FUNCTION fn_tg_cupones_cliente_normalizar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fecha_uso IS NOT NULL THEN
    NEW.estado := 'USADO';
  ELSIF NEW.fecha_expiracion <= CURRENT_TIMESTAMP AND NEW.estado <> 'USADO' THEN
    NEW.estado := 'EXPIRADO';
  ELSIF NEW.estado = 'USADO' AND NEW.fecha_uso IS NULL THEN
    NEW.fecha_uso := CURRENT_TIMESTAMP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_cupones_cliente_normalizar
BEFORE INSERT OR UPDATE ON cupones_cliente
FOR EACH ROW
EXECUTE FUNCTION fn_tg_cupones_cliente_normalizar();

-- ── PROCEDIMIENTO: EXPIRACIÓN MASIVA DE CUPONES ───────────
-- Llamar periódicamente (ej. cron diario)

CREATE OR REPLACE FUNCTION sp_expirar_cupones_vencidos()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_total int := 0;
BEGIN
  UPDATE cupones_cliente
  SET estado = 'EXPIRADO'
  WHERE estado = 'DISPONIBLE'
    AND fecha_expiracion <= CURRENT_TIMESTAMP;

  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

-- ── LLAVES FORÁNEAS ────────────────────────────────────────

ALTER TABLE cupones_maestro
  ADD FOREIGN KEY (id_categoria)
  REFERENCES categorias (id_categoria) ON DELETE RESTRICT;

ALTER TABLE cupones_cliente
  ADD FOREIGN KEY (id_cliente)
  REFERENCES clientes (id_cliente) ON DELETE CASCADE;

ALTER TABLE cupones_cliente
  ADD FOREIGN KEY (id_cupon)
  REFERENCES cupones_maestro (id_cupon) ON DELETE RESTRICT;
