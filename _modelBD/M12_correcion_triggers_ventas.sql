-- ==========================================================
-- MIGRACIÓN M12: Corrección de Casting de ENUM en Triggers de Ventas
-- APLICAR EN: NeonDB (producción) y DB de tests
-- PROPÓSITO: Corrige el trigger de asignación de lotes en venta
--            y el trigger de anulación para aplicar casting
--            explícito ::estado_lote_enum a la expresión CASE,
--            evitando DatatypeMismatchError (UndefinedTableError / error de tipo).
-- ==========================================================

-- 1. Actualización de fn_tg_detalles_venta_asignar_lotes
CREATE OR REPLACE FUNCTION fn_tg_detalles_venta_asignar_lotes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado_venta estado_venta_enum;
  v_stock_actual int;
  v_total_disponible int;
  v_restante int := NEW.cantidad;
  v_tomar int;
  v_nuevo_disponible int;
  r_lote RECORD;
BEGIN
  SELECT estado
  INTO v_estado_venta
  FROM ventas
  WHERE id_venta = NEW.id_venta
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La venta % no existe', NEW.id_venta;
  END IF;

  IF v_estado_venta = 'ANULADO' THEN
    RAISE EXCEPTION 'No se puede agregar detalles a una venta anulada';
  END IF;

  SELECT stock_actual
  INTO v_stock_actual
  FROM productos
  WHERE id_producto = NEW.id_producto
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto % no existe', NEW.id_producto;
  END IF;

  SELECT COALESCE(SUM(cantidad_disponible), 0)
  INTO v_total_disponible
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

    v_tomar := LEAST(v_restante, r_lote.cantidad_disponible);
    v_nuevo_disponible := r_lote.cantidad_disponible - v_tomar;
    v_stock_actual := v_stock_actual - v_tomar;

    IF v_stock_actual < 0 THEN
      RAISE EXCEPTION 'El stock global del producto % no puede quedar negativo', NEW.id_producto;
    END IF;

    UPDATE lotes
    SET cantidad_disponible = v_nuevo_disponible,
        estado_lote = CASE
          WHEN v_nuevo_disponible = 0 THEN 'AGOTADO'::estado_lote_enum
          ELSE 'VIGENTE'::estado_lote_enum
        END
    WHERE id_lote = r_lote.id_lote;

    INSERT INTO detalle_venta_lotes (
      id_detalle,
      id_lote,
      cantidad
    )
    VALUES (
      NEW.id_detalle,
      r_lote.id_lote,
      v_tomar
    );

    INSERT INTO movimientos_stock (
      id_producto,
      id_lote,
      id_venta,
      id_usuario,
      tipo_movimiento,
      cantidad,
      stock_resultante,
      costo_unitario,
      observacion
    )
    VALUES (
      NEW.id_producto,
      r_lote.id_lote,
      NEW.id_venta,
      NULL,
      'VENTA',
      v_tomar,
      v_stock_actual,
      NEW.precio_unitario,
      'Salida automática por detalle de venta'
    );

    UPDATE productos
    SET stock_actual = v_stock_actual
    WHERE id_producto = NEW.id_producto;

    v_restante := v_restante - v_tomar;
  END LOOP;

  RETURN NEW;
END;
$$;

-- 2. Actualización de fn_tg_ventas_anular
CREATE OR REPLACE FUNCTION fn_tg_ventas_anular()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  r_detalle RECORD;
  r_lote_detalle RECORD;
  v_stock_actual int;
  v_stock_resultante int;
  v_monto_puntos int;
  v_cfg_id int;
  v_saldo_actual int;
BEGIN
  IF NEW.estado <> 'ANULADO' OR OLD.estado = 'ANULADO' THEN
    RETURN NEW;
  END IF;

  FOR r_detalle IN
    SELECT id_detalle, id_producto, cantidad, precio_unitario
    FROM detalles_venta
    WHERE id_venta = NEW.id_venta
  LOOP
    FOR r_lote_detalle IN
      SELECT id_lote, cantidad
      FROM detalle_venta_lotes
      WHERE id_detalle = r_detalle.id_detalle
    LOOP
      SELECT stock_actual
      INTO v_stock_actual
      FROM productos
      WHERE id_producto = r_detalle.id_producto
      FOR UPDATE;

      v_stock_resultante := v_stock_actual + r_lote_detalle.cantidad;

      UPDATE productos
      SET stock_actual = v_stock_resultante
      WHERE id_producto = r_detalle.id_producto;

      UPDATE lotes
      SET cantidad_disponible = cantidad_disponible + r_lote_detalle.cantidad,
          estado_lote = CASE
            WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento <= CURRENT_TIMESTAMP THEN 'VENCIDO'::estado_lote_enum
            WHEN (cantidad_disponible + r_lote_detalle.cantidad) = 0 THEN 'AGOTADO'::estado_lote_enum
            ELSE 'VIGENTE'::estado_lote_enum
          END
      WHERE id_lote = r_lote_detalle.id_lote;

      INSERT INTO movimientos_stock (
        id_producto,
        id_lote,
        id_venta,
        id_usuario,
        tipo_movimiento,
        cantidad,
        stock_resultante,
        costo_unitario,
        observacion
      )
      VALUES (
        r_detalle.id_producto,
        r_lote_detalle.id_lote,
        NEW.id_venta,
        NULL,
        'DEVOLUCION',
        r_lote_detalle.cantidad,
        v_stock_resultante,
        r_detalle.precio_unitario,
        'Reversión automática por anulación de venta'
      );
    END LOOP;
  END LOOP;

  IF NEW.id_cupon_cliente IS NOT NULL THEN
    UPDATE cupones_cliente
    SET estado = CASE
        WHEN fecha_expiracion <= CURRENT_TIMESTAMP THEN 'EXPIRADO'::estado_cupon_enum
        ELSE 'DISPONIBLE'::estado_cupon_enum
      END,
      fecha_uso = NULL
    WHERE id_cupon_cliente = NEW.id_cupon_cliente;
  END IF;

  SELECT mp.cantidad, mp.id_config
  INTO v_monto_puntos, v_cfg_id
  FROM movimientos_puntos mp
  WHERE mp.id_venta = NEW.id_venta
    AND mp.tipo_movimiento = 'ACUMULACION_VENTA'
  ORDER BY mp.id_movimiento_punto DESC
  LIMIT 1;

  IF FOUND AND v_monto_puntos <> 0 THEN
    v_saldo_actual := fn_saldo_puntos_cliente(NEW.id_cliente);

    INSERT INTO movimientos_puntos (
      id_cliente,
      id_venta,
      id_cupon_cliente,
      id_config,
      tipo_movimiento,
      cantidad,
      saldo_puntos_resultante,
      fecha_expiracion,
      justificacion
    )
    VALUES (
      NEW.id_cliente,
      NEW.id_venta,
      NEW.id_cupon_cliente,
      v_cfg_id,
      'AJUSTE_ADMIN',
      -v_monto_puntos,
      v_saldo_actual - v_monto_puntos,
      NULL,
      'Reversión de puntos por anulación de venta'
    );

    UPDATE ventas
    SET puntos_ganados = 0
    WHERE id_venta = NEW.id_venta;
  END IF;

  RETURN NEW;
END;
$$;
