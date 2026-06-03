-- ==========================================================
-- MIGRACIÓN M10: Vista de Conciliación Triple de Inventario
-- APLICAR EN: NeonDB (producción) y DB de tests
-- PROPÓSITO: Crea la vista vw_inventory_reconciliation para
--            auditar diferencias de stock entre el cache,
--            el Kardex y las existencias reales por lotes.
-- ==========================================================

CREATE OR REPLACE VIEW vw_inventory_reconciliation AS
SELECT
  p.id_producto,
  p.nombre,
  p.stock_actual,
  COALESCE((
    SELECT SUM(
      CASE
        WHEN ms.tipo_movimiento IN ('INGRESO_COMPRA', 'AJUSTE_POSITIVO', 'DEVOLUCION') THEN ms.cantidad
        WHEN ms.tipo_movimiento IN ('VENTA', 'AJUSTE_NEGATIVO', 'MERMA', 'VENCIMIENTO') THEN -ms.cantidad
        ELSE 0
      END
    ) FROM movimientos_stock ms WHERE ms.id_producto = p.id_producto
  ), 0) AS stock_calculado_kardex,
  COALESCE((
    SELECT SUM(l.cantidad_disponible)
    FROM lotes l
    WHERE l.id_producto = p.id_producto 
      AND l.estado_lote = 'VIGENTE'
  ), 0) AS stock_calculado_lotes
FROM productos p;
