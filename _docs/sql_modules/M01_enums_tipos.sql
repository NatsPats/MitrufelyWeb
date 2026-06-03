-- ==========================================================
-- MÓDULO 01: TIPOS ENUM (MYTRUFELY)
-- Motor: PostgreSQL
-- Propósito: Definir todos los tipos enumerados que se usan
--            a lo largo del esquema para garantizar consistencia
--            semántica y validación a nivel de motor.
-- Depende de: (ninguno — debe ejecutarse primero)
-- ==========================================================

-- Roles de usuario dentro del sistema
CREATE TYPE tipo_rol_enum AS ENUM (
  'ADMIN',
  'CLIENTE'
);

-- Tipo de documento fiscal del cliente
CREATE TYPE tipo_documento_fiscal_enum AS ENUM (
  'DNI',
  'RUC'
);

-- Estado de vida de un lote de producto
CREATE TYPE estado_lote_enum AS ENUM (
  'VIGENTE',
  'AGOTADO',
  'VENCIDO'
);

-- Tipo de movimiento en el Kardex de stock
CREATE TYPE tipo_movimiento_stock_enum AS ENUM (
  'INGRESO_COMPRA',
  'VENTA',
  'AJUSTE_POSITIVO',
  'AJUSTE_NEGATIVO',
  'MERMA',
  'VENCIMIENTO',
  'DEVOLUCION'
);

-- Estado del cupón de un cliente específico
CREATE TYPE estado_cupon_enum AS ENUM (
  'DISPONIBLE',
  'USADO',
  'EXPIRADO'
);

-- Forma en que el cliente obtuvo un cupón
CREATE TYPE origen_cupon_enum AS ENUM (
  'COMPRA_PUNTOS',
  'REGALO_ADMIN',
  'PREMIO_JUEGO',
  'REGISTRO_NUEVO'
);

-- Canal de origen de una venta
CREATE TYPE origen_venta_enum AS ENUM (
  'WEB'
);

-- Estado del ciclo de vida de una venta
CREATE TYPE estado_venta_enum AS ENUM (
  'PENDIENTE',
  'PAGADO',
  'ENTREGADO',
  'ANULADO'
);

-- Estado del pago asociado a una venta
CREATE TYPE estado_pago_enum AS ENUM (
  'PENDIENTE',
  'PAGADO'
);

-- Método/tipo de pago registrado
CREATE TYPE tipo_pago_enum AS ENUM (
  'TARJETA'
);

-- Estado de procesamiento de una transacción de pago
CREATE TYPE estado_transaccion_enum AS ENUM (
  'PENDIENTE',
  'APROBADO',
  'RECHAZADO',
  'ANULADO'
);

-- Tipo de documento fiscal emitido para una venta
CREATE TYPE tipo_documento_venta_enum AS ENUM (
  'BOLETA',
  'FACTURA',
  'REPORTE'
);

-- Tipo de movimiento en el saldo de puntos CriptoTrufas
CREATE TYPE tipo_movimiento_puntos_enum AS ENUM (
  'ACUMULACION_VENTA',
  'COMPRA_CUPON',
  'PAGO_JUEGO',
  'PREMIO_JUEGO',
  'EXPIRACION',
  'AJUSTE_ADMIN'
);
