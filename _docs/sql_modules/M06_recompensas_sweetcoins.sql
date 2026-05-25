-- ==========================================================
-- MÓDULO 06: RECOMPENSAS — SWEETCOINS (MYTRUFELY)
-- Motor: PostgreSQL
-- Propósito: Sistema de fidelización por puntos (SweetCoins).
--            Incluye configuración de tasa de conversión,
--            historial de movimientos de puntos y triggers de
--            validación, acumulación (al pagar) y reversión
--            (al anular una venta).
-- Depende de: M01, M02, M03, M04, M05
-- ==========================================================

-- ── TABLAS ─────────────────────────────────────────────────

-- Parámetros globales del programa de recompensas (solo uno activo a la vez)
CREATE TABLE configuracion_recompensas (
  id_config              serial        PRIMARY KEY,
  tasa_conversion        numeric(5,4)  NOT NULL CHECK (tasa_conversion > 0),
  limite_puntos_billetera int           NOT NULL CHECK (limite_puntos_billetera > 0),
  dias_expiracion        int           NOT NULL CHECK (dias_expiracion > 0),
  estado                 boolean       NOT NULL DEFAULT true
);

-- Ledger de puntos por cliente: cada fila es un movimiento atómico
CREATE TABLE movimientos_puntos (
  id_movimiento_punto    serial                     PRIMARY KEY,
  id_cliente             int                        NOT NULL,
  id_venta               int,
  id_cupon_cliente       int,
  id_config              int                        NOT NULL,
  tipo_movimiento        tipo_movimiento_puntos_enum NOT NULL,
  cantidad               int                        NOT NULL CHECK (cantidad <> 0),
  saldo_puntos_resultante int                       NOT NULL,
  fecha_movimiento       timestamp                  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion       timestamp,
  justificacion          text
);

-- ── ÍNDICES ────────────────────────────────────────────────

CREATE INDEX ON movimientos_puntos (id_cliente);
CREATE INDEX ON movimientos_puntos (id_venta);
CREATE INDEX ON movimientos_puntos (id_cupon_cliente);

-- ── VISTAS ─────────────────────────────────────────────────

-- Saldo actual de puntos por cliente (suma de todos los movimientos)
CREATE OR REPLACE VIEW vw_saldo_puntos_cliente AS
SELECT
  c.id_cliente,
  COALESCE(SUM(mp.cantidad), 0) AS puntos_actuales
FROM clientes c
LEFT JOIN movimientos_puntos mp ON mp.id_cliente = c.id_cliente
GROUP BY c.id_cliente;

-- ── FUNCIONES AUXILIARES ───────────────────────────────────

-- Retorna el saldo vigente de puntos de un cliente
CREATE OR REPLACE FUNCTION fn_saldo_puntos_cliente(p_id_cliente int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_saldo int;
BEGIN
  SELECT COALESCE(SUM(cantidad), 0) INTO v_saldo
  FROM movimientos_puntos
  WHERE id_cliente = p_id_cliente;

  RETURN v_saldo;
END;
$$;

-- Retorna la configuración de recompensas activa; lanza excepción si no existe
CREATE OR REPLACE FUNCTION fn_config_recompensas_activa()
RETURNS configuracion_recompensas
LANGUAGE plpgsql
AS $$
DECLARE
  v_cfg configuracion_recompensas%ROWTYPE;
BEGIN
  SELECT * INTO v_cfg
  FROM configuracion_recompensas
  WHERE estado = true
  ORDER BY id_config DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe una configuración de recompensas activa';
  END IF;

  RETURN v_cfg;
END;
$$;

-- ── TRIGGER: VALIDAR SALDO NO NEGATIVO ────────────────────

CREATE OR REPLACE FUNCTION fn_tg_movimientos_puntos_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_saldo_actual int;
  v_saldo_nuevo  int;
BEGIN
  v_saldo_actual := fn_saldo_puntos_cliente(NEW.id_cliente);
  v_saldo_nuevo  := v_saldo_actual + NEW.cantidad;

  IF v_saldo_nuevo < 0 THEN
    RAISE EXCEPTION 'El cliente % no puede quedar con saldo negativo', NEW.id_cliente;
  END IF;

  NEW.saldo_puntos_resultante := v_saldo_nuevo;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_movimientos_puntos_validar
BEFORE INSERT ON movimientos_puntos
FOR EACH ROW
EXECUTE FUNCTION fn_tg_movimientos_puntos_validar();

-- ── TRIGGER: OTORGAR PUNTOS AL CONFIRMAR PAGO ─────────────

CREATE OR REPLACE FUNCTION fn_tg_ventas_otorgar_puntos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cfg    configuracion_recompensas%ROWTYPE;
  v_puntos int;
BEGIN
  -- Solo actúa cuando se pasa a estado PAGADO y la venta no está anulada
  IF NEW.estado_pago <> 'PAGADO' OR NEW.estado = 'ANULADO' THEN
    RETURN NEW;
  END IF;
  IF OLD.estado_pago = 'PAGADO' THEN
    RETURN NEW; -- ya se otorgaron puntos
  END IF;

  -- Evitar duplicado
  IF EXISTS (
    SELECT 1 FROM movimientos_puntos
    WHERE id_venta = NEW.id_venta AND tipo_movimiento = 'ACUMULACION_VENTA'
  ) THEN
    RETURN NEW;
  END IF;

  v_cfg    := fn_config_recompensas_activa();
  v_puntos := GREATEST(FLOOR(NEW.total * v_cfg.tasa_conversion)::int, 0);

  INSERT INTO movimientos_puntos (
    id_cliente, id_venta, id_cupon_cliente, id_config,
    tipo_movimiento, cantidad, saldo_puntos_resultante,
    fecha_expiracion, justificacion
  )
  VALUES (
    NEW.id_cliente, NEW.id_venta, NEW.id_cupon_cliente, v_cfg.id_config,
    'ACUMULACION_VENTA', v_puntos, 0,
    CURRENT_TIMESTAMP + (v_cfg.dias_expiracion || ' days')::interval,
    'Puntos generados por venta pagada'
  );

  UPDATE ventas SET puntos_ganados = v_puntos WHERE id_venta = NEW.id_venta;

  -- Marcar cupón como USADO si se aplicó en la venta
  IF NEW.id_cupon_cliente IS NOT NULL THEN
    UPDATE cupones_cliente
    SET estado    = 'USADO',
        fecha_uso = COALESCE(fecha_uso, CURRENT_TIMESTAMP)
    WHERE id_cupon_cliente = NEW.id_cupon_cliente
      AND estado = 'DISPONIBLE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_ventas_otorgar_puntos
AFTER UPDATE OF estado_pago ON ventas
FOR EACH ROW
EXECUTE FUNCTION fn_tg_ventas_otorgar_puntos();

-- ── TRIGGER: REVERTIR PUNTOS Y CUPÓN AL ANULAR VENTA ──────

CREATE OR REPLACE FUNCTION fn_tg_ventas_anular()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r_detalle       RECORD;
  r_lote_detalle  RECORD;
  v_stock_actual  int;
  v_stock_resultante int;
  v_monto_puntos  int;
  v_cfg_id        int;
  v_saldo_actual  int;
BEGIN
  IF NEW.estado <> 'ANULADO' OR OLD.estado = 'ANULADO' THEN
    RETURN NEW;
  END IF;

  -- Revertir stock por cada lote consumido en cada línea de venta
  FOR r_detalle IN
    SELECT id_detalle, id_producto, cantidad, precio_unitario
    FROM detalles_venta WHERE id_venta = NEW.id_venta
  LOOP
    FOR r_lote_detalle IN
      SELECT id_lote, cantidad
      FROM detalle_venta_lotes WHERE id_detalle = r_detalle.id_detalle
    LOOP
      SELECT stock_actual INTO v_stock_actual FROM productos
      WHERE id_producto = r_detalle.id_producto FOR UPDATE;

      v_stock_resultante := v_stock_actual + r_lote_detalle.cantidad;

      UPDATE productos SET stock_actual = v_stock_resultante
      WHERE id_producto = r_detalle.id_producto;

      UPDATE lotes
      SET cantidad_disponible = cantidad_disponible + r_lote_detalle.cantidad,
          estado_lote = CASE
            WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento <= CURRENT_TIMESTAMP THEN 'VENCIDO'
            WHEN (cantidad_disponible + r_lote_detalle.cantidad) = 0 THEN 'AGOTADO'
            ELSE 'VIGENTE'
          END
      WHERE id_lote = r_lote_detalle.id_lote;

      INSERT INTO movimientos_stock (
        id_producto, id_lote, id_venta, id_usuario,
        tipo_movimiento, cantidad, stock_resultante, costo_unitario, observacion
      )
      VALUES (
        r_detalle.id_producto, r_lote_detalle.id_lote, NEW.id_venta, NULL,
        'DEVOLUCION', r_lote_detalle.cantidad, v_stock_resultante,
        r_detalle.precio_unitario, 'Reversión automática por anulación de venta'
      );
    END LOOP;
  END LOOP;

  -- Revertir estado del cupón
  IF NEW.id_cupon_cliente IS NOT NULL THEN
    UPDATE cupones_cliente
    SET estado    = CASE WHEN fecha_expiracion <= CURRENT_TIMESTAMP THEN 'EXPIRADO' ELSE 'DISPONIBLE' END,
        fecha_uso = NULL
    WHERE id_cupon_cliente = NEW.id_cupon_cliente;
  END IF;

  -- Revertir puntos otorgados
  SELECT mp.cantidad, mp.id_config INTO v_monto_puntos, v_cfg_id
  FROM movimientos_puntos mp
  WHERE mp.id_venta = NEW.id_venta AND mp.tipo_movimiento = 'ACUMULACION_VENTA'
  ORDER BY mp.id_movimiento_punto DESC LIMIT 1;

  IF FOUND AND v_monto_puntos <> 0 THEN
    v_saldo_actual := fn_saldo_puntos_cliente(NEW.id_cliente);

    INSERT INTO movimientos_puntos (
      id_cliente, id_venta, id_cupon_cliente, id_config,
      tipo_movimiento, cantidad, saldo_puntos_resultante,
      fecha_expiracion, justificacion
    )
    VALUES (
      NEW.id_cliente, NEW.id_venta, NEW.id_cupon_cliente, v_cfg_id,
      'AJUSTE_ADMIN', -v_monto_puntos, v_saldo_actual - v_monto_puntos,
      NULL, 'Reversión de puntos por anulación de venta'
    );

    UPDATE ventas SET puntos_ganados = 0 WHERE id_venta = NEW.id_venta;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_ventas_anular
AFTER UPDATE OF estado ON ventas
FOR EACH ROW
EXECUTE FUNCTION fn_tg_ventas_anular();

-- ── LLAVES FORÁNEAS ────────────────────────────────────────

ALTER TABLE movimientos_puntos
  ADD FOREIGN KEY (id_cliente)
  REFERENCES clientes (id_cliente) ON DELETE CASCADE;

ALTER TABLE movimientos_puntos
  ADD FOREIGN KEY (id_venta)
  REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE movimientos_puntos
  ADD FOREIGN KEY (id_cupon_cliente)
  REFERENCES cupones_cliente (id_cupon_cliente) ON DELETE CASCADE;

ALTER TABLE movimientos_puntos
  ADD FOREIGN KEY (id_config)
  REFERENCES configuracion_recompensas (id_config) ON DELETE RESTRICT;

-- ── COMENTARIOS ────────────────────────────────────────────

COMMENT ON COLUMN movimientos_puntos.cantidad IS
  'Puede ser positivo o negativo según el movimiento';
COMMENT ON COLUMN movimientos_puntos.saldo_puntos_resultante IS
  'Saldo total del cliente luego del movimiento';
