-- ==========================================================
-- MÓDULO 05: VENTAS Y PAGOS (MYTRUFELY)
-- Motor: PostgreSQL
-- Propósito: Ciclo de vida completo de una venta: cabecera,
--            líneas de detalle, asignación FEFO de lotes,
--            métodos de pago, documentos fiscales e historial
--            de estados. Incluye los triggers de integridad.
-- Depende de: M01, M02, M03, M04
-- ==========================================================

-- ── TABLAS ─────────────────────────────────────────────────

CREATE TABLE ventas (
  id_venta              serial          PRIMARY KEY,
  id_cliente            int             NOT NULL,
  id_cupon_cliente      int UNIQUE,                -- FK a cupones_cliente (M04)
  origen_venta          origen_venta_enum NOT NULL,
  estado                estado_venta_enum NOT NULL DEFAULT 'PENDIENTE',
  estado_pago           estado_pago_enum  NOT NULL DEFAULT 'PENDIENTE',
  subtotal_productos    numeric(10,2)   NOT NULL DEFAULT 0 CHECK (subtotal_productos >= 0),
  costo_envio           numeric(10,2)   NOT NULL DEFAULT 0 CHECK (costo_envio >= 0),
  monto_descuento_cupon numeric(10,2)   NOT NULL DEFAULT 0 CHECK (monto_descuento_cupon >= 0),
  total                 numeric(10,2)   NOT NULL CHECK (total >= 0),
  puntos_ganados        int             NOT NULL DEFAULT 0 CHECK (puntos_ganados >= 0),
  fecha_venta           timestamp       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE historial_estados_venta (
  id_historial serial          PRIMARY KEY,
  id_venta     int             NOT NULL,
  estado       estado_venta_enum NOT NULL,
  fecha_cambio timestamp       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario   int                            -- quién realizó el cambio
);

CREATE TABLE detalles_venta (
  id_detalle     serial        PRIMARY KEY,
  id_venta       int           NOT NULL,
  id_producto    int           NOT NULL,
  cantidad       int           NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal       numeric(10,2) NOT NULL CHECK (subtotal >= 0)
);

-- Asociación entre una línea de venta y los lotes físicos consumidos (FEFO)
CREATE TABLE detalle_venta_lotes (
  id_detalle_lote serial PRIMARY KEY,
  id_detalle      int    NOT NULL,
  id_lote         int    NOT NULL,
  cantidad        int    NOT NULL CHECK (cantidad > 0)
);

CREATE TABLE metodos_pago (
  id_pago             serial                 PRIMARY KEY,
  id_venta            int                    NOT NULL,
  tipo_pago           tipo_pago_enum         NOT NULL,
  monto               numeric(10,2)          NOT NULL CHECK (monto > 0),
  codigo_transaccion  varchar(100),
  proveedor           varchar(50),
  estado_transaccion  estado_transaccion_enum NOT NULL DEFAULT 'PENDIENTE',
  fecha_pago          timestamp              NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documentos (
  id_documento       serial                    PRIMARY KEY,
  id_venta           int                       NOT NULL,
  tipo_documento     tipo_documento_venta_enum NOT NULL,
  numero_serie       varchar(10),
  numero_correlativo varchar(20),
  url_archivo        varchar(255),
  fecha_generacion   timestamp                 NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── ÍNDICES ────────────────────────────────────────────────

CREATE INDEX ON ventas              (id_cliente);
CREATE INDEX ON ventas              (id_cupon_cliente);
CREATE INDEX ON ventas              (estado);
CREATE INDEX ON ventas              (estado_pago);
CREATE INDEX ON detalles_venta      (id_venta);
CREATE INDEX ON detalles_venta      (id_producto);
CREATE INDEX ON detalle_venta_lotes (id_detalle);
CREATE INDEX ON detalle_venta_lotes (id_lote);

-- ── RESTRICCIÓN ÚNICA ──────────────────────────────────────

CREATE UNIQUE INDEX uq_documento_serie_correlativo
  ON documentos (tipo_documento, numero_serie, numero_correlativo);

-- ── TRIGGER: HISTORIAL DE ESTADOS DE VENTA ───────────────

CREATE OR REPLACE FUNCTION fn_tg_ventas_historial()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO historial_estados_venta (id_venta, estado, id_usuario)
    VALUES (NEW.id_venta, NEW.estado, NULL);
  ELSIF TG_OP = 'UPDATE' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    INSERT INTO historial_estados_venta (id_venta, estado, id_usuario)
    VALUES (NEW.id_venta, NEW.estado, NULL);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_ventas_historial
AFTER INSERT OR UPDATE OF estado ON ventas
FOR EACH ROW
EXECUTE FUNCTION fn_tg_ventas_historial();

-- ── TRIGGER: ASIGNACIÓN FEFO DE LOTES AL INSERTAR DETALLE ─

CREATE OR REPLACE FUNCTION fn_tg_detalles_venta_asignar_lotes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado_venta   estado_venta_enum;
  v_stock_actual   int;
  v_total_disponible int;
  v_restante       int := NEW.cantidad;
  v_tomar          int;
  v_nuevo_disponible int;
  r_lote           RECORD;
BEGIN
  SELECT estado INTO v_estado_venta FROM ventas
  WHERE id_venta = NEW.id_venta FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta % no existe', NEW.id_venta;
  END IF;
  IF v_estado_venta = 'ANULADO' THEN
    RAISE EXCEPTION 'No se puede agregar detalles a una venta anulada';
  END IF;

  SELECT stock_actual INTO v_stock_actual FROM productos
  WHERE id_producto = NEW.id_producto FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto % no existe', NEW.id_producto;
  END IF;

  SELECT COALESCE(SUM(cantidad_disponible), 0) INTO v_total_disponible
  FROM lotes
  WHERE id_producto = NEW.id_producto
    AND estado_lote = 'VIGENTE'
    AND cantidad_disponible > 0
    AND (fecha_vencimiento IS NULL OR fecha_vencimiento > CURRENT_TIMESTAMP);

  IF v_total_disponible < NEW.cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente para el producto %. Disponible: %, solicitado: %',
      NEW.id_producto, v_total_disponible, NEW.cantidad;
  END IF;

  FOR r_lote IN
    SELECT id_lote, cantidad_disponible
    FROM lotes
    WHERE id_producto = NEW.id_producto
      AND estado_lote = 'VIGENTE'
      AND cantidad_disponible > 0
      AND (fecha_vencimiento IS NULL OR fecha_vencimiento > CURRENT_TIMESTAMP)
    ORDER BY fecha_vencimiento NULLS LAST, fecha_ingreso, id_lote
    FOR UPDATE
  LOOP
    EXIT WHEN v_restante <= 0;

    v_tomar            := LEAST(v_restante, r_lote.cantidad_disponible);
    v_nuevo_disponible := r_lote.cantidad_disponible - v_tomar;
    v_stock_actual     := v_stock_actual - v_tomar;

    IF v_stock_actual < 0 THEN
      RAISE EXCEPTION 'El stock global del producto % no puede quedar negativo', NEW.id_producto;
    END IF;

    UPDATE lotes
    SET cantidad_disponible = v_nuevo_disponible,
        estado_lote = CASE WHEN v_nuevo_disponible = 0 THEN 'AGOTADO' ELSE 'VIGENTE' END
    WHERE id_lote = r_lote.id_lote;

    INSERT INTO detalle_venta_lotes (id_detalle, id_lote, cantidad)
    VALUES (NEW.id_detalle, r_lote.id_lote, v_tomar);

    INSERT INTO movimientos_stock (
      id_producto, id_lote, id_venta, id_usuario,
      tipo_movimiento, cantidad, stock_resultante, costo_unitario, observacion
    )
    VALUES (
      NEW.id_producto, r_lote.id_lote, NEW.id_venta, NULL,
      'VENTA', v_tomar, v_stock_actual, NEW.precio_unitario,
      'Salida automática por detalle de venta'
    );

    UPDATE productos SET stock_actual = v_stock_actual
    WHERE id_producto = NEW.id_producto;

    v_restante := v_restante - v_tomar;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_detalles_venta_asignar_lotes
AFTER INSERT ON detalles_venta
FOR EACH ROW
EXECUTE FUNCTION fn_tg_detalles_venta_asignar_lotes();

-- ── TRIGGER: BLOQUEO DE EDICIÓN / ELIMINACIÓN DE DETALLES ─

CREATE OR REPLACE FUNCTION fn_tg_bloquear_edicion_detalle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'No se permite actualizar o eliminar este registro. Anule la venta si necesita revertir movimientos.';
END;
$$;

CREATE TRIGGER tg_detalles_venta_bloquear_update
BEFORE UPDATE ON detalles_venta FOR EACH ROW
EXECUTE FUNCTION fn_tg_bloquear_edicion_detalle();

CREATE TRIGGER tg_detalles_venta_bloquear_delete
BEFORE DELETE ON detalles_venta FOR EACH ROW
EXECUTE FUNCTION fn_tg_bloquear_edicion_detalle();

CREATE TRIGGER tg_detalle_venta_lotes_bloquear_update
BEFORE UPDATE ON detalle_venta_lotes FOR EACH ROW
EXECUTE FUNCTION fn_tg_bloquear_edicion_detalle();

CREATE TRIGGER tg_detalle_venta_lotes_bloquear_delete
BEFORE DELETE ON detalle_venta_lotes FOR EACH ROW
EXECUTE FUNCTION fn_tg_bloquear_edicion_detalle();

-- ── LLAVES FORÁNEAS ────────────────────────────────────────

ALTER TABLE ventas
  ADD FOREIGN KEY (id_cliente)
  REFERENCES clientes (id_cliente) ON DELETE RESTRICT;

ALTER TABLE ventas
  ADD FOREIGN KEY (id_cupon_cliente)
  REFERENCES cupones_cliente (id_cupon_cliente) ON DELETE RESTRICT;

ALTER TABLE historial_estados_venta
  ADD FOREIGN KEY (id_venta)   REFERENCES ventas   (id_venta)   ON DELETE CASCADE;

ALTER TABLE historial_estados_venta
  ADD FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

ALTER TABLE detalles_venta
  ADD FOREIGN KEY (id_venta)   REFERENCES ventas   (id_venta)   ON DELETE CASCADE;

ALTER TABLE detalles_venta
  ADD FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE RESTRICT;

ALTER TABLE detalle_venta_lotes
  ADD FOREIGN KEY (id_detalle) REFERENCES detalles_venta (id_detalle) ON DELETE CASCADE;

ALTER TABLE detalle_venta_lotes
  ADD FOREIGN KEY (id_lote)    REFERENCES lotes          (id_lote)    ON DELETE RESTRICT;

ALTER TABLE metodos_pago
  ADD FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE documentos
  ADD FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

-- FK de movimientos_stock a ventas (declarada aquí, tabla en M03)
ALTER TABLE movimientos_stock
  ADD FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE RESTRICT;

-- ── COMENTARIOS ────────────────────────────────────────────

COMMENT ON COLUMN ventas.id_cliente IS 'Venta asociada al cliente';
COMMENT ON COLUMN detalles_venta.id_producto IS 'Producto comercial vendido';
COMMENT ON COLUMN detalle_venta_lotes.id_lote IS 'Lote físico desde el que se consumió la venta';
