-- ==========================================================
-- MÓDULO 14: PEDIDOS EXTENDIDO (MIFRUFELY WEB)
-- Motor: PostgreSQL
-- Propósito: Extensión completa del ciclo de vida de pedidos.
--            Agrega nuevos estados, campos de trazabilidad,
--            historial de eventos, reembolsos, calificaciones,
--            incidencias, notificaciones y configuración del sistema.
-- Depende de: M01, M02, M03, M04, M05
-- Autor: Antigravity — MitrufelyWeb
-- Fecha: 2026-06-21
-- ==========================================================

-- ── SECCIÓN 1: NUEVOS VALORES EN ENUMS EXISTENTES ──────────

-- IMPORTANTE: En PostgreSQL, ALTER TYPE ... ADD VALUE no es transaccional.
-- Debe ejecutarse fuera de una transacción explícita, o como primer
-- statement de la sesión. Ejecutar estos ALTER TYPE uno a uno si hay error.

-- Nuevos estados del ciclo de vida de la venta
ALTER TYPE estado_venta_enum ADD VALUE IF NOT EXISTS 'PREPARANDO';
ALTER TYPE estado_venta_enum ADD VALUE IF NOT EXISTS 'EN_CAMINO';
ALTER TYPE estado_venta_enum ADD VALUE IF NOT EXISTS 'CANCELADO';
ALTER TYPE estado_venta_enum ADD VALUE IF NOT EXISTS 'DEVUELTO';
ALTER TYPE estado_venta_enum ADD VALUE IF NOT EXISTS 'REEMBOLSADO';

-- Nuevo estado de pago para reembolsado
ALTER TYPE estado_pago_enum ADD VALUE IF NOT EXISTS 'REEMBOLSADO';


-- ── SECCIÓN 2: NUEVOS TIPOS ENUM ───────────────────────────

-- Tipos de evento en el historial de un pedido
CREATE TYPE tipo_evento_venta_enum AS ENUM (
  'PEDIDO_CREADO',
  'PAGO_CONFIRMADO',
  'STOCK_COMPROMETIDO',
  'PREPARACION_INICIADA',
  'PEDIDO_DESPACHADO',
  'PEDIDO_ENTREGADO',
  'CANCELACION_SOLICITADA',
  'CANCELACION_APROBADA',
  'DEVOLUCION_SOLICITADA',
  'DEVOLUCION_APROBADA',
  'REEMBOLSO_PROCESADO',
  'STOCK_DEVUELTO',
  'INCIDENCIA_REGISTRADA',
  'CALIFICACION_RECIBIDA',
  'NOTIFICACION_ENVIADA',
  'ETA_CALCULADO'
);

-- Estados internos del microservicio de entregas
CREATE TYPE estado_entrega_enum AS ENUM (
  'ASIGNADO',
  'RECOGIDO',
  'EN_RUTA',
  'ENTREGADO'
);

-- Tipos de incidencia en un pedido
CREATE TYPE tipo_incidencia_enum AS ENUM (
  'PEDIDO_PERDIDO',
  'PEDIDO_DANADO',
  'PEDIDO_INCOMPLETO',
  'ERROR_ENTREGA'
);

-- Estado de seguimiento de una incidencia
CREATE TYPE estado_incidencia_enum AS ENUM (
  'ABIERTA',
  'EN_REVISION',
  'RESUELTA',
);

-- Tipos de resolución
CREATE TYPE tipo_resolucion_enum AS ENUM (
  'SOLO_INFO',
  'DEVOLUCION',
  'REEMBOLSO'
);

-- Tipos de notificación
CREATE TYPE tipo_notificacion_enum AS ENUM (
  'PEDIDO_CONFIRMADO',
  'PEDIDO_PAGADO',
  'PEDIDO_PREPARANDO',
  'PEDIDO_EN_CAMINO',
  'PEDIDO_ENTREGADO',
  'PEDIDO_CANCELADO',
  'PEDIDO_REEMBOLSADO',
  'INCIDENCIA_CREADA',
  'INCIDENCIA_RESUELTA'
);

-- Destinatario de la notificación
CREATE TYPE destinatario_notificacion_enum AS ENUM (
  'CLIENTE',
  'ADMIN',
  'AMBOS'
);


-- ── SECCIÓN 3: NUEVAS COLUMNAS EN TABLA ventas ─────────────

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS shipping_cost_applied  numeric(10,2) NOT NULL DEFAULT 0
    CHECK (shipping_cost_applied >= 0),
  ADD COLUMN IF NOT EXISTS free_shipping_applied  boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_final            numeric(10,2)
    CHECK (total_final >= 0),
  ADD COLUMN IF NOT EXISTS delivery_eta           timestamp,
  ADD COLUMN IF NOT EXISTS delivery_completed_at  timestamp,
  ADD COLUMN IF NOT EXISTS refund_amount          numeric(10,2)
    CHECK (refund_amount >= 0),
  ADD COLUMN IF NOT EXISTS refund_date            timestamp,
  ADD COLUMN IF NOT EXISTS cancelled_at           timestamp,
  ADD COLUMN IF NOT EXISTS cancellation_reason    text;

-- Poblar total_final con valor existente de total para registros anteriores
UPDATE ventas SET total_final = total WHERE total_final IS NULL;

-- Hacer total_final NOT NULL después de poblar
ALTER TABLE ventas ALTER COLUMN total_final SET NOT NULL;
ALTER TABLE ventas ALTER COLUMN total_final SET DEFAULT 0;


-- ── SECCIÓN 4: TABLA order_events (Historial de Eventos) ───

CREATE TABLE IF NOT EXISTS order_events (
  id_event          serial                   PRIMARY KEY,
  id_venta          int                      NOT NULL,
  event_type        tipo_evento_venta_enum   NOT NULL,
  description       text                     NOT NULL,
  detail_json       jsonb,                             -- Datos adicionales opcionales
  created_at        timestamp                NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by        int                               -- id_usuario responsable (nullable: sistema)
);

CREATE INDEX IF NOT EXISTS idx_order_events_venta     ON order_events (id_venta);
CREATE INDEX IF NOT EXISTS idx_order_events_type      ON order_events (event_type);
CREATE INDEX IF NOT EXISTS idx_order_events_created   ON order_events (created_at);

ALTER TABLE order_events
  ADD CONSTRAINT fk_order_events_venta
    FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE order_events
  ADD CONSTRAINT fk_order_events_usuario
    FOREIGN KEY (created_by) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

COMMENT ON TABLE order_events IS 'Historial cronológico de eventos de un pedido. Inmutable.';
COMMENT ON COLUMN order_events.created_by IS 'NULL = acción del sistema, int = id_usuario que ejecutó la acción.';


-- ── SECCIÓN 5: TABLA order_refunds (Reembolsos) ────────────

CREATE TABLE IF NOT EXISTS order_refunds (
  id_refund         serial       PRIMARY KEY,
  id_venta          int          NOT NULL UNIQUE,      -- Un reembolso por venta
  reason            text         NOT NULL,
  amount            numeric(10,2) NOT NULL CHECK (amount > 0),
  includes_shipping boolean      NOT NULL DEFAULT false,
  approved_by       int,                               -- id_usuario admin que aprobó
  requested_by      int,                               -- id_usuario que solicitó
  observations      text,
  created_at        timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at       timestamp
);

CREATE INDEX IF NOT EXISTS idx_order_refunds_venta ON order_refunds (id_venta);

ALTER TABLE order_refunds
  ADD CONSTRAINT fk_order_refunds_venta
    FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE order_refunds
  ADD CONSTRAINT fk_order_refunds_approved
    FOREIGN KEY (approved_by) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

ALTER TABLE order_refunds
  ADD CONSTRAINT fk_order_refunds_requested
    FOREIGN KEY (requested_by) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

COMMENT ON TABLE order_refunds IS 'Registro de reembolso simulado asociado a un pedido cancelado o devuelto.';


-- ── SECCIÓN 6: TABLA order_reviews (Calificaciones) ────────

CREATE TABLE IF NOT EXISTS order_reviews (
  id_review     serial       PRIMARY KEY,
  id_venta      int          NOT NULL UNIQUE,          -- Una calificación por venta
  id_cliente    int          NOT NULL,
  rating        smallint     NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text,
  created_at    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_reviews_venta    ON order_reviews (id_venta);
CREATE INDEX IF NOT EXISTS idx_order_reviews_cliente  ON order_reviews (id_cliente);
CREATE INDEX IF NOT EXISTS idx_order_reviews_rating   ON order_reviews (rating);

ALTER TABLE order_reviews
  ADD CONSTRAINT fk_order_reviews_venta
    FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE order_reviews
  ADD CONSTRAINT fk_order_reviews_cliente
    FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente) ON DELETE CASCADE;

COMMENT ON TABLE order_reviews IS 'Calificación de 1-5 estrellas dejada por el cliente tras recibir su pedido.';


-- ── SECCIÓN 7: TABLA order_issues (Incidencias) ────────────

CREATE TABLE IF NOT EXISTS order_issues (
  id_issue      serial                  PRIMARY KEY,
  id_venta      int                     NOT NULL,
  issue_type    tipo_incidencia_enum    NOT NULL,
  description   text                    NOT NULL,
  status        estado_incidencia_enum  NOT NULL DEFAULT 'ABIERTA',
  reported_by   int,                               -- id_usuario que reportó
  resolved_by   int,                               -- id_usuario admin que resolvió
  resolution    text,
  created_at    timestamp               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    timestamp               NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_issues_venta   ON order_issues (id_venta);
CREATE INDEX IF NOT EXISTS idx_order_issues_status  ON order_issues (status);
CREATE INDEX IF NOT EXISTS idx_order_issues_type    ON order_issues (issue_type);

ALTER TABLE order_issues
  ADD CONSTRAINT fk_order_issues_venta
    FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE order_issues
  ADD CONSTRAINT fk_order_issues_reported
    FOREIGN KEY (reported_by) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

ALTER TABLE order_issues
  ADD CONSTRAINT fk_order_issues_resolved
    FOREIGN KEY (resolved_by) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

COMMENT ON TABLE order_issues IS 'Incidencias abiertas sobre un pedido (perdido, dañado, incompleto, error de entrega).';


-- ── SECCIÓN 8: TABLA system_config (Configuración) ─────────

CREATE TABLE IF NOT EXISTS system_config (
  id_config   serial       PRIMARY KEY,
  config_key  varchar(100) NOT NULL UNIQUE,
  config_value text        NOT NULL,
  description text,
  updated_at  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by  int
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_config_key ON system_config (config_key);

ALTER TABLE system_config
  ADD CONSTRAINT fk_system_config_usuario
    FOREIGN KEY (updated_by) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

-- Valores iniciales de configuración
INSERT INTO system_config (config_key, config_value, description) VALUES
  ('shipping_cost',                '3.00',  'Costo de envío base en soles (S/)'),
  ('free_shipping_threshold',      '15.00', 'Monto mínimo del subtotal para envío gratuito (S/)'),
  ('delivery_base_time_minutes',   '30',    'Tiempo base de entrega en minutos'),
  ('preparation_base_time_minutes','15',    'Tiempo base de preparación en minutos'),
  ('eta_factor_per_product',       '2',     'Minutos adicionales de ETA por cada producto en el pedido')
ON CONFLICT (config_key) DO NOTHING;

COMMENT ON TABLE system_config IS 'Configuración persistente del sistema. Clave-valor administrable desde el panel.';


-- ── SECCIÓN 8.5: TABLA config_audit_log (Auditoría Config) ─

CREATE TABLE IF NOT EXISTS config_audit_log (
  id_log      serial       PRIMARY KEY,
  config_key  varchar(100) NOT NULL,
  old_value   text,
  new_value   text         NOT NULL,
  changed_at  timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by  int
);

CREATE INDEX IF NOT EXISTS idx_config_audit_log_key ON config_audit_log (config_key);

ALTER TABLE config_audit_log
  ADD CONSTRAINT fk_config_audit_log_usuario
    FOREIGN KEY (changed_by) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

COMMENT ON TABLE config_audit_log IS 'Auditoría de cambios en la configuración del sistema.';


-- ── SECCIÓN 9: TABLA notifications (Notificaciones) ────────

CREATE TABLE IF NOT EXISTS notifications (
  id_notification  serial                          PRIMARY KEY,
  id_usuario       int                             NOT NULL,
  id_venta         int,
  type             tipo_notificacion_enum          NOT NULL,
  title            varchar(200)                    NOT NULL,
  message          text                            NOT NULL,
  is_read          boolean                         NOT NULL DEFAULT false,
  created_at       timestamp                       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at          timestamp
);

CREATE INDEX IF NOT EXISTS idx_notifications_usuario ON notifications (id_usuario);
CREATE INDEX IF NOT EXISTS idx_notifications_venta   ON notifications (id_venta);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON notifications (id_usuario, is_read)
  WHERE is_read = false;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE;

ALTER TABLE notifications
  ADD CONSTRAINT fk_notifications_venta
    FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE SET NULL;

COMMENT ON TABLE notifications IS 'Notificaciones en BD para clientes y administradores. Sistema de polling.';


-- ── SECCIÓN 10: TRIGGER updated_at para order_issues ───────

CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_order_issues_updated_at
BEFORE UPDATE ON order_issues
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

CREATE TRIGGER tg_system_config_updated_at
BEFORE UPDATE ON system_config
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();


-- ── SECCIÓN 11: ACTUALIZAR TRIGGER tg_ventas_anular ────────
-- El trigger existente solo manejaba 'ANULADO'. Debe incluir 'CANCELADO' y 'DEVUELTO'.
-- NOTA: La devolución de stock en cancelaciones/devoluciones se maneja
-- desde Python (VentaService) para mayor control y trazabilidad.
-- El trigger tg_ventas_anular se mantiene para compatibilidad con expiración automática.

-- ── COMENTARIOS FINALES ─────────────────────────────────────

COMMENT ON COLUMN ventas.shipping_cost_applied IS 'Costo de envío real cobrado al cliente en esta venta.';
COMMENT ON COLUMN ventas.free_shipping_applied IS 'TRUE si se aplicó envío gratuito por superar el umbral.';
COMMENT ON COLUMN ventas.total_final IS 'Total final = subtotal_productos + shipping_cost_applied - descuento_cupon.';
COMMENT ON COLUMN ventas.delivery_eta IS 'Timestamp estimado de entrega. Calculado al iniciar preparación.';
COMMENT ON COLUMN ventas.delivery_completed_at IS 'Timestamp real de entrega confirmada por el repartidor.';
COMMENT ON COLUMN ventas.refund_amount IS 'Monto total del reembolso procesado (puede ser parcial).';
COMMENT ON COLUMN ventas.refund_date IS 'Fecha en que se procesó el reembolso simulado.';
COMMENT ON COLUMN ventas.cancelled_at IS 'Timestamp de cancelación del pedido.';
COMMENT ON COLUMN ventas.cancellation_reason IS 'Motivo de cancelación ingresado por cliente o admin.';
