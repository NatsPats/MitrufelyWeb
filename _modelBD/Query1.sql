-- ==========================================================
-- SCRIPT FÍSICO DE BASE DE DATOS: MYTRUFELY
-- MOTOR: PostgreSQL
-- VERSIÓN FINAL COMPLETA
-- Recompensas + Cupones + Kardex + Lotes múltiples + Triggers
-- CON ENUMS
-- ==========================================================

-- ==========================================================
-- 0. TIPOS ENUM
-- ==========================================================

CREATE TYPE tipo_rol_enum AS ENUM (
  'ADMIN',
  'CLIENTE',
  'CAJERO',
  'ALMACEN'
);

CREATE TYPE tipo_documento_fiscal_enum AS ENUM (
  'DNI',
  'RUC'
);

CREATE TYPE estado_lote_enum AS ENUM (
  'VIGENTE',
  'AGOTADO',
  'VENCIDO'
);

CREATE TYPE tipo_movimiento_stock_enum AS ENUM (
  'INGRESO_COMPRA',
  'VENTA',
  'AJUSTE_POSITIVO',
  'AJUSTE_NEGATIVO',
  'MERMA',
  'VENCIMIENTO',
  'DEVOLUCION'
);

CREATE TYPE estado_cupon_enum AS ENUM (
  'DISPONIBLE',
  'USADO',
  'EXPIRADO'
);

CREATE TYPE origen_cupon_enum AS ENUM (
  'COMPRA_PUNTOS',
  'REGALO_ADMIN',
  'PREMIO_JUEGO',
  'REGISTRO_NUEVO'
);

CREATE TYPE origen_venta_enum AS ENUM (
  'WEB'
);

CREATE TYPE estado_venta_enum AS ENUM (
  'PENDIENTE',
  'PAGADO',
  'ENTREGADO',
  'ANULADO'
);

CREATE TYPE estado_pago_enum AS ENUM (
  'PENDIENTE',
  'PAGADO'
);

CREATE TYPE tipo_pago_enum AS ENUM (
  'EFECTIVO',
  'YAPE',
  'TRANSFERENCIA'
);

CREATE TYPE estado_transaccion_enum AS ENUM (
  'PENDIENTE',
  'APROBADO',
  'RECHAZADO',
  'ANULADO'
);

CREATE TYPE tipo_documento_venta_enum AS ENUM (
  'BOLETA',
  'FACTURA',
  'REPORTE'
);

CREATE TYPE tipo_movimiento_puntos_enum AS ENUM (
  'ACUMULACION_VENTA',
  'COMPRA_CUPON',
  'PAGO_JUEGO',
  'PREMIO_JUEGO',
  'EXPIRACION',
  'AJUSTE_ADMIN'
);

-- ==========================================================
-- 1. TABLAS BASE
-- ==========================================================

CREATE TABLE roles (
  id_rol serial PRIMARY KEY,
  nombre tipo_rol_enum UNIQUE NOT NULL
);

CREATE TABLE usuarios (
  id_usuario serial PRIMARY KEY,
  id_rol int NOT NULL,
  nombres varchar(100) NOT NULL,
  apellidos varchar(100) NOT NULL,
  email varchar(150) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  telefono varchar(20),
  estado boolean NOT NULL DEFAULT true
);

CREATE TABLE clientes (
  id_cliente serial PRIMARY KEY,
  id_usuario int NOT NULL UNIQUE,
  direccion varchar(255),
  referencia varchar(255)
);

CREATE TABLE datos_fiscales (
  id_dato_fiscal serial PRIMARY KEY,
  id_usuario int NOT NULL,
  tipo_documento tipo_documento_fiscal_enum NOT NULL,
  numero_documento varchar(20) UNIQUE NOT NULL,
  razon_social varchar(150),
  direccion_fiscal varchar(255),
  es_predeterminado boolean NOT NULL DEFAULT false
);

-- ==========================================================
-- 2. CATÁLOGO E INVENTARIO
-- ==========================================================

CREATE TABLE categorias (
  id_categoria serial PRIMARY KEY,
  nombre varchar(100) NOT NULL,
  descripcion text
);

CREATE TABLE productos (
  id_producto serial PRIMARY KEY,
  id_categoria int,
  nombre varchar(150) NOT NULL,
  descripcion text,
  precio numeric(10,2) NOT NULL CHECK (precio >= 0),
  stock_actual int NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo int NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  imagen_url varchar(255),
  estado boolean NOT NULL DEFAULT true
);

CREATE TABLE lotes (
  id_lote serial PRIMARY KEY,
  id_producto int NOT NULL,
  fecha_ingreso timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_vencimiento timestamp,
  cantidad_inicial int NOT NULL CHECK (cantidad_inicial > 0),
  cantidad_disponible int NOT NULL DEFAULT 0 CHECK (cantidad_disponible >= 0),
  estado_lote estado_lote_enum NOT NULL DEFAULT 'VIGENTE'
);

CREATE TABLE movimientos_stock (
  id_movimiento_stock serial PRIMARY KEY,
  id_producto int NOT NULL,
  id_lote int,
  id_venta int,
  id_usuario int,
  tipo_movimiento tipo_movimiento_stock_enum NOT NULL,
  cantidad int NOT NULL CHECK (cantidad > 0),
  stock_resultante int NOT NULL CHECK (stock_resultante >= 0),
  costo_unitario numeric(10,2),
  fecha_movimiento timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observacion text
);

-- ==========================================================
-- 3. CUPONES
-- ==========================================================

CREATE TABLE cupones_maestro (
  id_cupon serial PRIMARY KEY,
  id_categoria int,
  nombre varchar(100) NOT NULL,
  descripcion text,
  porcentaje_descuento numeric(5,2) NOT NULL
    CHECK (porcentaje_descuento > 0 AND porcentaje_descuento <= 100),
  costo_puntos int,
  dias_vigencia int NOT NULL CHECK (dias_vigencia > 0),
  estado boolean NOT NULL DEFAULT true
);

CREATE TABLE cupones_cliente (
  id_cupon_cliente serial PRIMARY KEY,
  id_cliente int NOT NULL,
  id_cupon int NOT NULL,
  codigo_unico varchar(20) UNIQUE NOT NULL,
  estado estado_cupon_enum NOT NULL DEFAULT 'DISPONIBLE',
  origen origen_cupon_enum NOT NULL,
  fecha_adquisicion timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_uso timestamp,
  fecha_expiracion timestamp NOT NULL
);

-- ==========================================================
-- 4. VENTAS
-- ==========================================================

CREATE TABLE ventas (
  id_venta serial PRIMARY KEY,
  id_cliente int NOT NULL,
  id_cupon_cliente int UNIQUE,
  origen_venta origen_venta_enum NOT NULL,
  estado estado_venta_enum NOT NULL DEFAULT 'PENDIENTE',
  estado_pago estado_pago_enum NOT NULL DEFAULT 'PENDIENTE',
  subtotal_productos numeric(10,2) NOT NULL DEFAULT 0 CHECK (subtotal_productos >= 0),
  costo_envio numeric(10,2) NOT NULL DEFAULT 0 CHECK (costo_envio >= 0),
  monto_descuento_cupon numeric(10,2) NOT NULL DEFAULT 0 CHECK (monto_descuento_cupon >= 0),
  total numeric(10,2) NOT NULL CHECK (total >= 0),
  puntos_ganados int NOT NULL DEFAULT 0 CHECK (puntos_ganados >= 0),
  fecha_venta timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE historial_estados_venta (
  id_historial serial PRIMARY KEY,
  id_venta int NOT NULL,
  estado estado_venta_enum NOT NULL,
  fecha_cambio timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario int
);

CREATE TABLE detalles_venta (
  id_detalle serial PRIMARY KEY,
  id_venta int NOT NULL,
  id_producto int NOT NULL,
  cantidad int NOT NULL CHECK (cantidad > 0),
  precio_unitario numeric(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal numeric(10,2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE detalle_venta_lotes (
  id_detalle_lote serial PRIMARY KEY,
  id_detalle int NOT NULL,
  id_lote int NOT NULL,
  cantidad int NOT NULL CHECK (cantidad > 0)
);

CREATE TABLE metodos_pago (
  id_pago serial PRIMARY KEY,
  id_venta int NOT NULL,
  tipo_pago tipo_pago_enum NOT NULL,
  monto numeric(10,2) NOT NULL CHECK (monto > 0),
  codigo_transaccion varchar(100),
  proveedor varchar(50),
  estado_transaccion estado_transaccion_enum NOT NULL DEFAULT 'PENDIENTE',
  fecha_pago timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE documentos (
  id_documento serial PRIMARY KEY,
  id_venta int NOT NULL,
  tipo_documento tipo_documento_venta_enum NOT NULL,
  numero_serie varchar(10),
  numero_correlativo varchar(20),
  url_archivo varchar(255),
  fecha_generacion timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE logs_sistema (
  id_log serial PRIMARY KEY,
  id_usuario int,
  accion varchar(255) NOT NULL,
  fecha timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================================
-- 5. RECOMPENSAS
-- ==========================================================

CREATE TABLE configuracion_recompensas (
  id_config serial PRIMARY KEY,
  tasa_conversion numeric(5,4) NOT NULL CHECK (tasa_conversion > 0),
  limite_puntos_billetera int NOT NULL CHECK (limite_puntos_billetera > 0),
  dias_expiracion int NOT NULL CHECK (dias_expiracion > 0),
  estado boolean NOT NULL DEFAULT true
);

CREATE TABLE movimientos_puntos (
  id_movimiento_punto serial PRIMARY KEY,
  id_cliente int NOT NULL,
  id_venta int,
  id_cupon_cliente int,
  id_config int NOT NULL,
  tipo_movimiento tipo_movimiento_puntos_enum NOT NULL,
  cantidad int NOT NULL CHECK (cantidad <> 0),
  saldo_puntos_resultante int NOT NULL,
  fecha_movimiento timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_expiracion timestamp,
  justificacion text
);

-- ==========================================================
-- 6. ÍNDICES
-- ==========================================================

CREATE INDEX ON usuarios (id_rol);

CREATE INDEX ON datos_fiscales (id_usuario);
CREATE INDEX ON datos_fiscales (numero_documento);

CREATE INDEX ON productos (id_categoria);
CREATE INDEX ON productos (estado);

CREATE INDEX ON lotes (id_producto);
CREATE INDEX ON lotes (fecha_vencimiento);
CREATE INDEX ON lotes (estado_lote);

CREATE INDEX ON movimientos_stock (id_producto);
CREATE INDEX ON movimientos_stock (id_lote);
CREATE INDEX ON movimientos_stock (id_venta);
CREATE INDEX ON movimientos_stock (tipo_movimiento);

CREATE INDEX ON cupones_maestro (id_categoria);

CREATE INDEX ON cupones_cliente (id_cliente);
CREATE INDEX ON cupones_cliente (id_cupon);
CREATE INDEX ON cupones_cliente (estado);
CREATE INDEX ON cupones_cliente (fecha_expiracion);

CREATE INDEX ON ventas (id_cliente);
CREATE INDEX ON ventas (id_cupon_cliente);
CREATE INDEX ON ventas (estado);
CREATE INDEX ON ventas (estado_pago);

CREATE INDEX ON detalles_venta (id_venta);
CREATE INDEX ON detalles_venta (id_producto);

CREATE INDEX ON detalle_venta_lotes (id_detalle);
CREATE INDEX ON detalle_venta_lotes (id_lote);

CREATE INDEX ON movimientos_puntos (id_cliente);
CREATE INDEX ON movimientos_puntos (id_venta);
CREATE INDEX ON movimientos_puntos (id_cupon_cliente);

-- ==========================================================
-- 7. RESTRICCIONES ÚNICAS
-- ==========================================================

CREATE UNIQUE INDEX uq_datos_fiscales_predeterminado
ON datos_fiscales (id_usuario)
WHERE es_predeterminado = true;

CREATE UNIQUE INDEX uq_documento_serie_correlativo
ON documentos (tipo_documento, numero_serie, numero_correlativo);

-- ==========================================================
-- 8. VISTAS
-- ==========================================================

CREATE OR REPLACE VIEW vw_saldo_puntos_cliente AS
SELECT
  c.id_cliente,
  COALESCE(SUM(mp.cantidad), 0) AS puntos_actuales
FROM clientes c
LEFT JOIN movimientos_puntos mp
  ON mp.id_cliente = c.id_cliente
GROUP BY c.id_cliente;

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
LEFT JOIN movimientos_stock ms
  ON ms.id_producto = p.id_producto
GROUP BY p.id_producto, p.nombre, p.stock_actual;

-- ==========================================================
-- 9. FUNCIONES AUXILIARES
-- ==========================================================

CREATE OR REPLACE FUNCTION fn_saldo_puntos_cliente(p_id_cliente int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  v_saldo int;
BEGIN
  SELECT COALESCE(SUM(cantidad), 0)
  INTO v_saldo
  FROM movimientos_puntos
  WHERE id_cliente = p_id_cliente;

  RETURN v_saldo;
END;
$$;

CREATE OR REPLACE FUNCTION fn_config_recompensas_activa()
RETURNS configuracion_recompensas
LANGUAGE plpgsql
AS $$
DECLARE
  v_cfg configuracion_recompensas%ROWTYPE;
BEGIN
  SELECT *
  INTO v_cfg
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

-- ==========================================================
-- 10. CUPONES: NORMALIZACIÓN Y EXPIRACIÓN
-- ==========================================================

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

-- ==========================================================
-- 11. LOTES: VALIDACIÓN, INGRESO Y EXPIRACIÓN
-- ==========================================================

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

CREATE OR REPLACE FUNCTION fn_tg_lotes_post_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_stock_actual int;
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
    NEW.id_lote,
    NULL,
    NULL,
    'INGRESO_COMPRA',
    NEW.cantidad_inicial,
    v_stock_resultante,
    NULL,
    'Ingreso automático del lote al inventario'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_lotes_post_insert
AFTER INSERT ON lotes
FOR EACH ROW
EXECUTE FUNCTION fn_tg_lotes_post_insert();

CREATE OR REPLACE FUNCTION sp_expirar_lotes_vencidos()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  r_lote RECORD;
  v_stock_actual int;
  v_stock_resultante int;
  v_total int := 0;
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
    SELECT stock_actual
    INTO v_stock_actual
    FROM productos
    WHERE id_producto = r_lote.id_producto
    FOR UPDATE;

    v_stock_resultante := GREATEST(v_stock_actual - r_lote.cantidad_disponible, 0);

    UPDATE productos
    SET stock_actual = v_stock_resultante
    WHERE id_producto = r_lote.id_producto;

    UPDATE lotes
    SET cantidad_disponible = 0,
        estado_lote = 'VENCIDO'
    WHERE id_lote = r_lote.id_lote;

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
      r_lote.id_producto,
      r_lote.id_lote,
      NULL,
      NULL,
      'VENCIMIENTO',
      r_lote.cantidad_disponible,
      v_stock_resultante,
      NULL,
      'Vencimiento automático del lote'
    );

    v_total := v_total + 1;
  END LOOP;

  RETURN v_total;
END;
$$;

-- ==========================================================
-- 12. VENTA: ASIGNACIÓN AUTOMÁTICA DE LOTES FEFO
-- ==========================================================

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
          WHEN v_nuevo_disponible = 0 THEN 'AGOTADO'
          ELSE 'VIGENTE'
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

CREATE TRIGGER tg_detalles_venta_asignar_lotes
AFTER INSERT ON detalles_venta
FOR EACH ROW
EXECUTE FUNCTION fn_tg_detalles_venta_asignar_lotes();

-- ==========================================================
-- 13. VENTA: HISTORIAL DE ESTADOS
-- ==========================================================

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

-- ==========================================================
-- 14. VENTA: PUNTOS Y CUPÓN AL CONFIRMAR PAGO
-- ==========================================================

CREATE OR REPLACE FUNCTION fn_tg_ventas_otorgar_puntos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_cfg configuracion_recompensas%ROWTYPE;
  v_puntos int;
BEGIN
  IF NEW.estado_pago <> 'PAGADO' OR NEW.estado = 'ANULADO' THEN
    RETURN NEW;
  END IF;

  IF OLD.estado_pago = 'PAGADO' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM movimientos_puntos
    WHERE id_venta = NEW.id_venta
      AND tipo_movimiento = 'ACUMULACION_VENTA'
  ) THEN
    RETURN NEW;
  END IF;

  v_cfg := fn_config_recompensas_activa();

  v_puntos := FLOOR(NEW.total * v_cfg.tasa_conversion)::int;
  IF v_puntos < 0 THEN
    v_puntos := 0;
  END IF;

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
    v_cfg.id_config,
    'ACUMULACION_VENTA',
    v_puntos,
    0,
    CURRENT_TIMESTAMP + (v_cfg.dias_expiracion || ' days')::interval,
    'Puntos generados por venta pagada'
  );

  UPDATE ventas
  SET puntos_ganados = v_puntos
  WHERE id_venta = NEW.id_venta;

  IF NEW.id_cupon_cliente IS NOT NULL THEN
    UPDATE cupones_cliente
    SET estado = 'USADO',
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

-- ==========================================================
-- 15. VENTA: ANULACIÓN Y REVERSIÓN DE STOCK / CUPÓN / PUNTOS
-- ==========================================================

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
            WHEN fecha_vencimiento IS NOT NULL AND fecha_vencimiento <= CURRENT_TIMESTAMP THEN 'VENCIDO'
            WHEN (cantidad_disponible + r_lote_detalle.cantidad) = 0 THEN 'AGOTADO'
            ELSE 'VIGENTE'
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
        WHEN fecha_expiracion <= CURRENT_TIMESTAMP THEN 'EXPIRADO'
        ELSE 'DISPONIBLE'
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

CREATE TRIGGER tg_ventas_anular
AFTER UPDATE OF estado ON ventas
FOR EACH ROW
EXECUTE FUNCTION fn_tg_ventas_anular();

-- ==========================================================
-- 16. VALIDACIÓN DE MOVIMIENTOS DE PUNTOS
-- ==========================================================

CREATE OR REPLACE FUNCTION fn_tg_movimientos_puntos_validar()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_saldo_actual int;
  v_saldo_nuevo int;
BEGIN
  v_saldo_actual := fn_saldo_puntos_cliente(NEW.id_cliente);
  v_saldo_nuevo := v_saldo_actual + NEW.cantidad;

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

-- ==========================================================
-- 17. BLOQUEO DE EDICIÓN EN DETALLES
-- ==========================================================

CREATE OR REPLACE FUNCTION fn_tg_bloquear_edicion_detalle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'No se permite actualizar o eliminar este registro. Anule la venta si necesita revertir movimientos.';
END;
$$;

CREATE TRIGGER tg_detalles_venta_bloquear_update
BEFORE UPDATE ON detalles_venta
FOR EACH ROW
EXECUTE FUNCTION fn_tg_bloquear_edicion_detalle();

CREATE TRIGGER tg_detalles_venta_bloquear_delete
BEFORE DELETE ON detalles_venta
FOR EACH ROW
EXECUTE FUNCTION fn_tg_bloquear_edicion_detalle();

CREATE TRIGGER tg_detalle_venta_lotes_bloquear_update
BEFORE UPDATE ON detalle_venta_lotes
FOR EACH ROW
EXECUTE FUNCTION fn_tg_bloquear_edicion_detalle();

CREATE TRIGGER tg_detalle_venta_lotes_bloquear_delete
BEFORE DELETE ON detalle_venta_lotes
FOR EACH ROW
EXECUTE FUNCTION fn_tg_bloquear_edicion_detalle();

-- ==========================================================
-- 18. LLAVES FORÁNEAS
-- ==========================================================

ALTER TABLE usuarios
  ADD FOREIGN KEY (id_rol) REFERENCES roles (id_rol) ON DELETE RESTRICT;

ALTER TABLE clientes
  ADD FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE;

ALTER TABLE datos_fiscales
  ADD FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE CASCADE;

ALTER TABLE productos
  ADD FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria) ON DELETE RESTRICT;

ALTER TABLE lotes
  ADD FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE RESTRICT;

ALTER TABLE movimientos_stock
  ADD FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE RESTRICT;

ALTER TABLE movimientos_stock
  ADD FOREIGN KEY (id_lote) REFERENCES lotes (id_lote) ON DELETE RESTRICT;

ALTER TABLE movimientos_stock
  ADD FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE RESTRICT;

ALTER TABLE movimientos_stock
  ADD FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

ALTER TABLE cupones_maestro
  ADD FOREIGN KEY (id_categoria) REFERENCES categorias (id_categoria) ON DELETE RESTRICT;

ALTER TABLE cupones_cliente
  ADD FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente) ON DELETE CASCADE;

ALTER TABLE cupones_cliente
  ADD FOREIGN KEY (id_cupon) REFERENCES cupones_maestro (id_cupon) ON DELETE RESTRICT;

ALTER TABLE ventas
  ADD FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente) ON DELETE RESTRICT;

ALTER TABLE ventas
  ADD FOREIGN KEY (id_cupon_cliente) REFERENCES cupones_cliente (id_cupon_cliente) ON DELETE RESTRICT;

ALTER TABLE historial_estados_venta
  ADD FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE historial_estados_venta
  ADD FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

ALTER TABLE detalles_venta
  ADD FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE detalles_venta
  ADD FOREIGN KEY (id_producto) REFERENCES productos (id_producto) ON DELETE RESTRICT;

ALTER TABLE detalle_venta_lotes
  ADD FOREIGN KEY (id_detalle) REFERENCES detalles_venta (id_detalle) ON DELETE CASCADE;

ALTER TABLE detalle_venta_lotes
  ADD FOREIGN KEY (id_lote) REFERENCES lotes (id_lote) ON DELETE RESTRICT;

ALTER TABLE metodos_pago
  ADD FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE documentos
  ADD FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE logs_sistema
  ADD FOREIGN KEY (id_usuario) REFERENCES usuarios (id_usuario) ON DELETE SET NULL;

ALTER TABLE movimientos_puntos
  ADD FOREIGN KEY (id_cliente) REFERENCES clientes (id_cliente) ON DELETE CASCADE;

ALTER TABLE movimientos_puntos
  ADD FOREIGN KEY (id_venta) REFERENCES ventas (id_venta) ON DELETE CASCADE;

ALTER TABLE movimientos_puntos
  ADD FOREIGN KEY (id_cupon_cliente) REFERENCES cupones_cliente (id_cupon_cliente) ON DELETE CASCADE;

ALTER TABLE movimientos_puntos
  ADD FOREIGN KEY (id_config) REFERENCES configuracion_recompensas (id_config) ON DELETE RESTRICT;

-- ==========================================================
-- 19. COMENTARIOS
-- ==========================================================

COMMENT ON COLUMN productos.stock_actual IS 'Cache operativa; el kardex real está en movimientos_stock';
COMMENT ON COLUMN lotes.cantidad_disponible IS 'Stock útil del lote, se reduce por ventas y vencimiento';
COMMENT ON COLUMN lotes.estado_lote IS 'Estado del lote: VIGENTE, AGOTADO o VENCIDO';
COMMENT ON COLUMN movimientos_puntos.cantidad IS 'Puede ser positivo o negativo según el movimiento';
COMMENT ON COLUMN movimientos_puntos.saldo_puntos_resultante IS 'Saldo total del cliente luego del movimiento';
COMMENT ON COLUMN movimientos_stock.stock_resultante IS 'Stock del producto luego del movimiento';
COMMENT ON COLUMN ventas.id_cliente IS 'Venta asociada al cliente';
COMMENT ON COLUMN detalles_venta.id_producto IS 'Producto comercial vendido';
COMMENT ON COLUMN detalle_venta_lotes.id_lote IS 'Lote físico desde el que se consumió la venta';