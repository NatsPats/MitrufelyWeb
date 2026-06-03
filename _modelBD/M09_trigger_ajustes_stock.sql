-- ==========================================================
-- MIGRACIÓN M09: Trigger para ajustes manuales de inventario
-- APLICAR EN: NeonDB (producción) y DB de tests
-- PROBLEMA: El trigger tg_movimientos_stock_ajustes no existía,
--           causando que los ajustes se insertaran con stock_resultante=0
--           y que lotes/productos NO se actualizaran.
-- ==========================================================

CREATE OR REPLACE FUNCTION fn_tg_movimientos_stock_ajustes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado_lote    estado_lote_enum;
  v_disp_lote      int;
  v_stock_actual   int;
  v_nuevo_disp     int;
  v_stock_result   int;
BEGIN
  -- 1. id_lote es obligatorio para ajustes manuales
  IF NEW.id_lote IS NULL THEN
    RAISE EXCEPTION 'id_lote es obligatorio para ajustes manuales';
  END IF;

  -- 2. Bloquear y leer el lote
  SELECT estado_lote, cantidad_disponible
  INTO   v_estado_lote, v_disp_lote
  FROM   lotes
  WHERE  id_lote = NEW.id_lote
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote % no existe', NEW.id_lote;
  END IF;

  -- 3. Lotes VENCIDOS son inmutables
  IF v_estado_lote = 'VENCIDO' THEN
    RAISE EXCEPTION 'El lote % está VENCIDO y es inmutable', NEW.id_lote;
  END IF;

  -- 4. Bloquear y leer el producto
  SELECT stock_actual
  INTO   v_stock_actual
  FROM   productos
  WHERE  id_producto = NEW.id_producto
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Producto % no existe', NEW.id_producto;
  END IF;

  -- 5. Calcular nuevo stock según el tipo de movimiento
  IF NEW.tipo_movimiento = 'AJUSTE_POSITIVO' THEN
    v_nuevo_disp   := v_disp_lote + NEW.cantidad;
    v_stock_result := v_stock_actual + NEW.cantidad;

  ELSIF NEW.tipo_movimiento IN ('AJUSTE_NEGATIVO', 'MERMA') THEN
    IF v_disp_lote < NEW.cantidad THEN
      RAISE EXCEPTION
        'Stock insuficiente en lote %. Disponible: %, solicitado: %',
        NEW.id_lote, v_disp_lote, NEW.cantidad;
    END IF;
    v_nuevo_disp   := v_disp_lote - NEW.cantidad;
    v_stock_result := GREATEST(v_stock_actual - NEW.cantidad, 0);

  ELSE
    RAISE EXCEPTION
      'Tipo de movimiento % no permitido en ajustes manuales. '
      'Use AJUSTE_POSITIVO, AJUSTE_NEGATIVO o MERMA.',
      NEW.tipo_movimiento;
  END IF;

  -- 6. Actualizar lote (y recalcular estado)
  UPDATE lotes
  SET    cantidad_disponible = v_nuevo_disp,
         estado_lote = CASE
           WHEN v_nuevo_disp = 0 THEN 'AGOTADO'::estado_lote_enum
           ELSE 'VIGENTE'::estado_lote_enum
         END
  WHERE  id_lote = NEW.id_lote;

  -- 7. Actualizar stock global del producto
  UPDATE productos
  SET    stock_actual = v_stock_result
  WHERE  id_producto = NEW.id_producto;

  -- 8. Asignar stock_resultante real (sobreescribe el 0 enviado por el backend)
  NEW.stock_resultante := v_stock_result;

  RETURN NEW;
END;
$$;

-- Sólo se dispara para los tres tipos de ajuste manual
DROP TRIGGER IF EXISTS tg_movimientos_stock_ajustes ON movimientos_stock;

CREATE TRIGGER tg_movimientos_stock_ajustes
BEFORE INSERT ON movimientos_stock
FOR EACH ROW
WHEN (NEW.tipo_movimiento IN ('AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'MERMA'))
EXECUTE FUNCTION fn_tg_movimientos_stock_ajustes();
