-- ==========================================================
-- MÓDULO 03: CATÁLOGO DE PRODUCTOS E INVENTARIO (MYTRUFELY)
-- Motor: PostgreSQL
-- Propósito: Gestión de categorías, productos, lotes físicos
--            y el Kardex de movimientos de stock (FEFO).
-- Depende de: M01_enums_tipos.sql, M02_usuarios_roles.sql
-- ==========================================================

-- ── TABLAS ─────────────────────────────────────────────────

CREATE TABLE categorias (
  id_categoria serial PRIMARY KEY,
  nombre       varchar(100) NOT NULL,
  descripcion  text
);

CREATE TABLE productos (
  id_producto  serial       PRIMARY KEY,
  id_categoria int,
  nombre       varchar(150) NOT NULL,
  descripcion  text,
  precio       numeric(10,2) NOT NULL CHECK (precio >= 0),
  stock_actual int          NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo int          NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  imagen_url   varchar(255),
  estado       boolean      NOT NULL DEFAULT true
);

CREATE TABLE lotes (
  id_lote             serial      PRIMARY KEY,
  id_producto         int         NOT NULL,
  fecha_ingreso       timestamp   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_vencimiento   timestamp,
  cantidad_inicial    int         NOT NULL CHECK (cantidad_inicial > 0),
  cantidad_disponible int         NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  estado_lote         estado_lote_enum NOT NULL DEFAULT 'VIGENTE'
);

-- Kardex: historial completo de movimientos de stock por producto/lote
CREATE TABLE movimientos_stock (
  id_movimiento_stock serial                    PRIMARY KEY,
  id_producto         int                       NOT NULL,
  id_lote             int,
  id_venta            int,                      -- FK a ventas (módulo M04)
  id_usuario          int,                      -- FK a usuarios (módulo M02)
  tipo_movimiento     tipo_movimiento_stock_enum NOT NULL,
  cantidad            int                       NOT NULL CHECK (cantidad > 0),
  stock_resultante    int                       NOT NULL CHECK (stock_resultante >= 0),
  costo_unitario      numeric(10,2),
  fecha_movimiento    timestamp                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observacion         text
);

-- ── ÍNDICES ────────────────────────────────────────────────

CREATE INDEX ON productos        (id_categoria);
CREATE INDEX ON productos        (estado);
CREATE INDEX ON lotes            (id_producto);
CREATE INDEX ON lotes            (fecha_vencimiento);
CREATE INDEX ON lotes            (estado_lote);
CREATE INDEX ON movimientos_stock (id_producto);
CREATE INDEX ON movimientos_stock (id_lote);
CREATE INDEX ON movimientos_stock (id_venta);
CREATE INDEX ON movimientos_stock (tipo_movimiento);

-- ── VISTAS ─────────────────────────────────────────────────

-- Stock calculado por Kardex vs stock en cache del producto
CREATE OR REPLACE VIEW vw_stock_producto AS
SELECT
  p.id_producto,
  p.nombre,
  p.stock_actual,
  COALESCE(SUM(
    CASE
      WHEN ms.tipo_movimiento IN ('INGRESO_COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCION')
        THEN ms.cantidad
      WHEN ms.tipo_movimiento IN ('VENTA', 'AJUSTE_NEGATIVO', 'MERMA', 'VENCIMIENTO')
        THEN -ms.cantidad
      ELSE 0
    END
  ), 0) AS stock_calculado_kardex
FROM productos p
LEFT JOIN movimientos_stock ms ON ms.id_producto = p.id_producto
GROUP BY p.id_producto, p.nombre, p.stock_actual;

-- ── TRIGGERS: LOTES ────────────────────────────────────────

-- BEFORE INSERT: Valida que el lote no esté vencido y normaliza campos
CREATE OR REPLACE FUNCTION fn_tg_lotes_validar_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fecha_vencimiento IS NOT NULL
     AND NEW.fecha_vencimiento <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'No se puede registrar un lote ya vencido';
  END IF;

  NEW.cantidad_disponible := NEW.cantidad_inicial;
  NEW.estado_lote := 'VIGENTE';

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_lotes_validar_insert
BEFORE INSERT ON lotes
FOR EACH ROW
EXECUTE FUNCTION fn_tg_lotes_validar_insert();

-- AFTER INSERT: Actualiza stock del producto y registra INGRESO_COMPRA en Kardex
CREATE OR REPLACE FUNCTION fn_tg_lotes_post_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_actual    int;
  v_stock_resultante int;
BEGIN
  SELECT stock_actual
  INTO v_stock_actual
  FROM productos
  WHERE id_producto = NEW.id_producto
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no existe', NEW.id_producto;
  END IF;

  v_stock_resultante := v_stock_actual + NEW.cantidad_inicial;

  UPDATE productos
  SET stock_actual = v_stock_resultante
  WHERE id_producto = NEW.id_producto;

  INSERT INTO movimientos_stock (
    id_producto, id_lote, id_venta, id_usuario,
    tipo_movimiento, cantidad, stock_resultante, costo_unitario, observacion
  )
  VALUES (
    NEW.id_producto, NEW.id_lote, NULL, NULL,
    'INGRESO_COMPRA', NEW.cantidad_inicial, v_stock_resultante,
    NULL, 'Ingreso automático del lote al inventario'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_lotes_post_insert
AFTER INSERT ON lotes
FOR EACH ROW
EXECUTE FUNCTION fn_tg_lotes_post_insert();

-- ── PROCEDIMIENTO: EXPIRACIÓN MASIVA DE LOTES ──────────────
-- Llamar periódicamente (ej. cron diario)

CREATE OR REPLACE FUNCTION sp_expirar_lotes_vencidos()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  r_lote             RECORD;
  v_stock_actual     int;
  v_stock_resultante int;
  v_total            int := 0;
BEGIN
  FOR r_lote IN
    SELECT id_lote, id_producto, cantidad_disponible
    FROM lotes
    WHERE estado_lote = 'VIGENTE'
      AND cantidad_disponible > 0
      AND fecha_vencimiento IS NOT NULL
      AND fecha_vencimiento <= CURRENT_TIMESTAMP
    FOR UPDATE
  LOOP
    SELECT stock_actual INTO v_stock_actual
    FROM productos WHERE id_producto = r_lote.id_producto FOR UPDATE;

    v_stock_resultante := GREATEST(v_stock_actual - r_lote.cantidad_disponible, 0);

    UPDATE productos
    SET stock_actual = v_stock_resultante
    WHERE id_producto = r_lote.id_producto;

    UPDATE lotes
    SET cantidad_disponible = 0, estado_lote = 'VENCIDO'
    WHERE id_lote = r_lote.id_lote;

    INSERT INTO movimientos_stock (
      id_producto, id_lote, id_venta, id_usuario,
      tipo_movimiento, cantidad, stock_resultante, costo_unitario, observacion
    )
    VALUES (
      r_lote.id_producto, r_lote.id_lote, NULL, NULL,
      'VENCIMIENTO', r_lote.cantidad_disponible, v_stock_resultante,
      NULL, 'Vencimiento automático del lote'
    );

    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

-- ── LLAVES FORÁNEAS ────────────────────────────────────────

ALTER TABLE productos
  ADD FOREIGN KEY (id_categoria)
  REFERENCES categorias (id_categoria) ON DELETE RESTRICT;

ALTER TABLE lotes
  ADD FOREIGN KEY (id_producto)
  REFERENCES productos (id_producto) ON DELETE RESTRICT;

ALTER TABLE movimientos_stock
  ADD FOREIGN KEY (id_producto)
  REFERENCES productos (id_producto) ON DELETE RESTRICT;

ALTER TABLE movimientos_stock
  ADD FOREIGN KEY (id_lote)
  REFERENCES lotes (id_lote) ON DELETE RESTRICT;

-- FK a ventas y usuarios se aplican en M04/M02 respectivamente
ALTER TABLE movimientos_stock
  ADD FOREIGN KEY (id_usuario)
  REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

-- ── COMENTARIOS ────────────────────────────────────────────

COMMENT ON COLUMN productos.stock_actual IS
  'Cache operativa; el kardex real está en movimientos_stock';
COMMENT ON COLUMN lotes.cantidad_disponible IS
  'Stock útil del lote, se reduce por ventas y vencimiento';
COMMENT ON COLUMN lotes.estado_lote IS
  'Estado del lote: VIGENTE, AGOTADO o VENCIDO';
COMMENT ON COLUMN movimientos_stock.stock_resultante IS
  'Stock del producto luego del movimiento';
