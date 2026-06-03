-- ==========================================================
-- MÓDULO 08: TRIGGERS DE AJUSTES MANUALES DE INVENTARIO (FASE 3)
-- Motor: PostgreSQL / NeonDB
-- Propósito: Trigger BEFORE INSERT para ajustes manuales de stock
--            (AJUSTE_POSITIVO, AJUSTE_NEGATIVO, MERMA) y vista de
--            conciliación triple de inventario.
-- Depende de: M03_catalogo_inventario.sql (lotes, productos, movimientos_stock)
-- ==========================================================

-- ── TRIGGER: AJUSTES MANUALES DE STOCK ────────────────────────────────────────
-- Se ejecuta BEFORE INSERT en movimientos_stock para los tipos de ajuste manual.
-- Responsabilidades:
--   1. Validar obligatoriedad de id_lote para ajustes.
--   2. Validar que el lote no esté VENCIDO (inmutable).
--   3. Actualizar cantidad_disponible y estado_lote del lote afectado.
--   4. Actualizar stock_actual del producto (con bloqueo FOR UPDATE).
--   5. Calcular y asignar stock_resultante antes de insertar el Kardex.
-- Nota: El orden de bloqueo estricto (lote → producto) evita deadlocks.

CREATE OR REPLACE FUNCTION fn_tg_movimientos_stock_ajustes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_estado_lote     estado_lote_enum;
  v_lote_disponible int;
  v_stock_actual    int;
  v_stock_result    int;
BEGIN
  -- Solo actuar sobre tipos de ajuste manual
  IF NEW.tipo_movimiento NOT IN ('AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO', 'MERMA') THEN
    RETURN NEW;
  END IF;

  -- 1. id_lote es estrictamente obligatorio para ajustes manuales
  IF NEW.id_lote IS NULL THEN
    RAISE EXCEPTION 'El campo id_lote es obligatorio para registrar un ajuste de inventario.';
  END IF;

  -- 2. Bloquear fila del lote (orden 1: lote) para evitar race conditions
  SELECT estado_lote, cantidad_disponible
  INTO   v_estado_lote, v_lote_disponible
  FROM   lotes
  WHERE  id_lote = NEW.id_lote
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El lote % no existe.', NEW.id_lote;
  END IF;

  -- 3. Los lotes VENCIDOS son inmutables
  IF v_estado_lote = 'VENCIDO' THEN
    RAISE EXCEPTION 'No se permiten ajustes sobre lotes vencidos (id_lote=%). El lote es inmutable.', NEW.id_lote;
  END IF;

  -- 4. Aplicar cambio sobre el lote según tipo de movimiento
  IF NEW.tipo_movimiento IN ('AJUSTE_NEGATIVO', 'MERMA') THEN
    IF v_lote_disponible < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente en lote %. Disponible: %, solicitado: %.',
        NEW.id_lote, v_lote_disponible, NEW.cantidad;
    END IF;

    UPDATE lotes
    SET
      cantidad_disponible = cantidad_disponible - NEW.cantidad,
      estado_lote = CASE
                      WHEN cantidad_disponible - NEW.cantidad = 0 THEN 'AGOTADO'::estado_lote_enum
                      ELSE 'VIGENTE'::estado_lote_enum
                    END
    WHERE id_lote = NEW.id_lote;

  ELSIF NEW.tipo_movimiento = 'AJUSTE_POSITIVO' THEN
    UPDATE lotes
    SET
      cantidad_disponible = cantidad_disponible + NEW.cantidad,
      estado_lote = 'VIGENTE'
    WHERE id_lote = NEW.id_lote;
  END IF;

  -- 5. Bloquear fila del producto (orden 2: producto) y recalcular stock
  SELECT stock_actual
  INTO   v_stock_actual
  FROM   productos
  WHERE  id_producto = NEW.id_producto
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto % no existe.', NEW.id_producto;
  END IF;

  IF NEW.tipo_movimiento IN ('AJUSTE_NEGATIVO', 'MERMA') THEN
    v_stock_result := GREATEST(v_stock_actual - NEW.cantidad, 0);
  ELSE
    v_stock_result := v_stock_actual + NEW.cantidad;
  END IF;

  UPDATE productos
  SET stock_actual = v_stock_result
  WHERE id_producto = NEW.id_producto;

  -- 6. Almacenar el stock resultante real en el propio registro del Kardex (BEFORE INSERT)
  NEW.stock_resultante := v_stock_result;

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_movimientos_stock_ajustes
BEFORE INSERT ON movimientos_stock
FOR EACH ROW
EXECUTE FUNCTION fn_tg_movimientos_stock_ajustes();

-- ── VISTA: CONCILIACIÓN TRIPLE DE INVENTARIO ──────────────────────────────────
-- Compara tres fuentes de verdad independientes:
--   1. stock_actual   → caché en la tabla productos
--   2. stock_calculado_kardex → suma de movimientos_stock (fuente contable)
--   3. stock_calculado_lotes  → suma de lotes VIGENTE con cantidad_disponible > 0
-- Un producto se considera descuadrado si cualquiera de los tres difiere.

CREATE OR REPLACE VIEW vw_inventory_reconciliation AS
SELECT
  p.id_producto,
  p.nombre,
  p.stock_actual,
  COALESCE(
    (
      SELECT SUM(
        CASE
          WHEN ms.tipo_movimiento IN ('INGRESO_COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCION')
            THEN ms.cantidad
          WHEN ms.tipo_movimiento IN ('VENTA', 'AJUSTE_NEGATIVO', 'MERMA', 'VENCIMIENTO')
            THEN -ms.cantidad
          ELSE 0
        END
      )
      FROM movimientos_stock ms
      WHERE ms.id_producto = p.id_producto
    ),
    0
  ) AS stock_calculado_kardex,
  COALESCE(
    (
      SELECT SUM(l.cantidad_disponible)
      FROM   lotes l
      WHERE  l.id_producto = p.id_producto
        AND  l.estado_lote = 'VIGENTE'
    ),
    0
  ) AS stock_calculado_lotes
FROM productos p;

-- ── COMENTARIOS ───────────────────────────────────────────────────────────────

COMMENT ON FUNCTION fn_tg_movimientos_stock_ajustes() IS
  'Trigger BEFORE INSERT en movimientos_stock: gestiona ajustes manuales (AJUSTE_POSITIVO, AJUSTE_NEGATIVO, MERMA). Actualiza lotes y productos atómicamente y calcula stock_resultante.';

COMMENT ON TRIGGER tg_movimientos_stock_ajustes ON movimientos_stock IS
  'Trigger que garantiza la integridad del stock al registrar ajustes manuales en el Kardex.';

COMMENT ON VIEW vw_inventory_reconciliation IS
  'Conciliación triple de inventario: stock_actual (cache), stock_calculado_kardex (contable) y stock_calculado_lotes (fisico). Un descuadre en cualquiera indica corrupción de datos.';
