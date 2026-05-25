-- ==========================================================
-- MÓDULO 02: USUARIOS, ROLES Y DATOS FISCALES (MYTRUFELY)
-- Motor: PostgreSQL
-- Propósito: Gestión de identidad, autenticación y perfiles
--            de usuario (clientes, admins, cajeros, almacén).
-- Depende de: M01_enums_tipos.sql
-- ==========================================================

-- ── TABLAS ─────────────────────────────────────────────────

CREATE TABLE roles (
  id_rol serial PRIMARY KEY,
  nombre tipo_rol_enum UNIQUE NOT NULL
);

CREATE TABLE usuarios (
  id_usuario    serial PRIMARY KEY,
  id_rol        int          NOT NULL,
  nombres       varchar(100) NOT NULL,
  apellidos     varchar(100) NOT NULL,
  email         varchar(150) UNIQUE NOT NULL,
  password_hash varchar(255) NOT NULL,
  telefono      varchar(20),
  estado        boolean      NOT NULL DEFAULT true
);

CREATE TABLE clientes (
  id_cliente serial PRIMARY KEY,
  id_usuario int          NOT NULL UNIQUE,
  direccion  varchar(255),
  referencia varchar(255)
);

CREATE TABLE datos_fiscales (
  id_dato_fiscal     serial PRIMARY KEY,
  id_usuario         int                          NOT NULL,
  tipo_documento     tipo_documento_fiscal_enum   NOT NULL,
  numero_documento   varchar(20) UNIQUE           NOT NULL,
  razon_social       varchar(150),
  direccion_fiscal   varchar(255),
  es_predeterminado  boolean                      NOT NULL DEFAULT false
);

-- ── ÍNDICES ────────────────────────────────────────────────

CREATE INDEX ON usuarios       (id_rol);
CREATE INDEX ON datos_fiscales (id_usuario);
CREATE INDEX ON datos_fiscales (numero_documento);

-- ── RESTRICCIÓN ÚNICA PARCIAL ──────────────────────────────
-- Solo puede haber un dato fiscal predeterminado por usuario

CREATE UNIQUE INDEX uq_datos_fiscales_predeterminado
  ON datos_fiscales (id_usuario)
  WHERE es_predeterminado = true;

-- ── LLAVES FORÁNEAS ────────────────────────────────────────

ALTER TABLE usuarios
  ADD FOREIGN KEY (id_rol)
  REFERENCES roles (id_rol)
  ON DELETE RESTRICT;

ALTER TABLE clientes
  ADD FOREIGN KEY (id_usuario)
  REFERENCES usuarios (id_usuario)
  ON DELETE CASCADE;

ALTER TABLE datos_fiscales
  ADD FOREIGN KEY (id_usuario)
  REFERENCES usuarios (id_usuario)
  ON DELETE CASCADE;

-- ── LOGS DE SISTEMA ────────────────────────────────────────
-- La tabla logs_sistema se incluye aquí porque su único FK
-- apunta a usuarios; no pertenece a ningún dominio funcional.

CREATE TABLE logs_sistema (
  id_log    serial       PRIMARY KEY,
  id_usuario int,
  accion    varchar(255) NOT NULL,
  fecha     timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE logs_sistema
  ADD FOREIGN KEY (id_usuario)
  REFERENCES usuarios (id_usuario)
  ON DELETE SET NULL;
