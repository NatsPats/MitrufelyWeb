# 🎂 Mitrufely Web — Plataforma Transaccional y de Gestión para Pastelería

<p align="center">
  <img src="_docs/assets/banner.jpeg" alt="Mitrufely Web Banner" width="100%">
</p>

[![React](https://img.shields.io/badge/FrontEnd-React%2019%20%2B%20TS-61DAFB?logo=react&style=flat-square)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/BackEnd-FastAPI%20%28Python%29-009688?logo=fastapi&style=flat-square)](https://fastapi.tiangolo.com/)
[![Docker](https://img.shields.io/badge/DevOps-Docker%20%26%20Compose-2496ED?logo=docker&style=flat-square)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**Mitrufely Web** es una solución informática transaccional de nivel empresarial (_Enterprise-scale_) diseñada para la digitalización de la cadena de suministro, fidelización de clientes y ventas online de la marca. El proyecto adopta una **Arquitectura Limpia (Clean Architecture)** altamente desacoplada y principios de diseño robustos y seguros, garantizando escalabilidad, estabilidad y alta disponibilidad en entornos de producción.

---

## 📸 Vista Previa (Preview)

### 🖥️ Interfaz de Escritorio (Desktop)

#### 🏠 Inicio y Portada Principal

<p align="center">
  <img src="_docs/assets/Desktop/inicio.png" alt="Inicio Desktop" width="100%">
</p>

#### 🛍️ Catálogo de Trufas y Filtros Dinámicos

<p align="center">
  <img src="_docs/assets/Desktop/catalogo.png" alt="Catálogo Desktop" width="100%">
</p>

#### 🎁 Packs de Regalo Especiales

<p align="center">
  <img src="_docs/assets/Desktop/packs.png" alt="Packs Desktop" width="100%">
</p>

#### 🪙 Club de Fidelización (Puntos CriptoTrufas)

<p align="center">
  <img src="_docs/assets/Desktop/CriptoTrufas.png" alt="CriptoTrufas Desktop" width="100%">
</p>

#### 📊 Panel Administrativo (Gestión y Control)

<p align="center">
  <img src="_docs/assets/Desktop/admin.png" alt="Admin Dashboard Desktop" width="100%">
</p>

---

### 📱 Interfaz Móvil (Mobile)

<p align="center">
  <img src="_docs/assets/Mobile/inicio.png" alt="Inicio Mobile" width="31%" style="margin: 0 1%;">
  <img src="_docs/assets/Mobile/catalogo.png" alt="Catálogo Mobile" width="31%" style="margin: 0 1%;">
  <img src="_docs/assets/Mobile/packs.png" alt="Packs Mobile" width="31%" style="margin: 0 1%;">
</p>
<p align="center">
  <img src="_docs/assets/Mobile/CriptoTrufas.png" alt="CriptoTrufas Mobile" width="31%" style="margin: 0 1%;">
  <img src="_docs/assets/Mobile/image.png" alt="Detalle Adicional Mobile" width="31%" style="margin: 0 1%;">
</p>

---

## 📦 Arquitectura de Software y Librerías Implementadas

El proyecto utiliza un conjunto seleccionado de librerías y componentes robustos para garantizar la mantenibilidad, rendimiento y estabilidad de nivel empresarial:

| Librería / Componente                | Propósito / Implementación en Mitrufely Web | Justificación de Ingeniería                                                                                                          |
| :----------------------------------- | :------------------------------------------ | :----------------------------------------------------------------------------------------------------------------------------------- |
| **Routers, Services y Repositories** | Capas de abstracción modular                | Separación clara de responsabilidades. La lógica de negocio está aislada de la infraestructura de base de datos y de la capa HTTP.   |
| **Pydantic V2 & Tenacity**           | Validación y políticas de reintento         | Validación robusta de tipos de datos a nivel de runtime y políticas de reintento transaccional automáticas ante fallos transitorios. |
| **OpenPyXL & XlsxWriter**            | Exportación de datos a Excel                | Generación y formateo en memoria de reportes tabulares complejos y exportaciones de inventario a archivos de hoja de cálculo Excel.  |
| **Cryptography & Pillow**            | Seguridad y procesamiento de imágenes       | Utilidades de encriptación de datos sensibles y procesamiento asíncrono y redimensionado óptimo de imágenes para pastelería.         |
| **Structlog & Python-JSON-Logger**   | Logs estructurados                          | Registro de logs estructurados en formato JSON listos para su ingesta en sistemas APM, con trazabilidad inyectando `request_id`.     |
| **Pip, Uvicorn & Pydantic-Settings** | Entorno y gestión de configuración          | Gestión estricta de dependencias y de la configuración a través de variables de entorno con validación estática de tipos.            |

---

## 🛠️ Stack Tecnológico

### Frontend (SPA)

- **Core:** React 19 (TypeScript) + Vite
- **Estilos:** Tailwind CSS + Framer Motion (para micro-animaciones premium)
- **Client State:** Zustand (gestión ligera del estado de autenticación y carrito)
- **Server State & Cache:** TanStack Query V5 (React Query)
- **Comunicación:** Axios (con interceptores para refresh token automático y control de errores)

### Backend (REST API)

- **Framework:** FastAPI (Python 3.11+)
- **Base de Datos ORM:** SQLAlchemy 2.0 (Capa asíncrona mediante `asyncpg` y pools optimizados)
- **Motor de Base de Datos:** PostgreSQL (Neon Serverless DB en producción)
- **Cola de Tareas y Planificador:** Celery + Celery Beat (ejecución periódica de tareas de mantenimiento)
- **Broker de Mensajería & Cache:** Redis / Valkey

### DevOps y Despliegue

- **Contenedores:** Docker & Docker Compose (ambientes idénticos para desarrollo y pruebas)
- **Servidor Web Frontend:** Nginx (dentro del contenedor, configurado con gzip estático y SPA routing)
- **Plataformas Cloud:** **Vercel** (Frontend con SPA routing fallback) y **Render** (Backend FastAPI + Valkey KeyValue)

---

## 🔒 Auditoría y Mitigación de Seguridad (OWASP ZAP)

El sistema fue sometido a auditorías de seguridad dinámicas (DAST) utilizando **OWASP ZAP**, implementándose las siguientes protecciones en base al reporte de observaciones:

1.  **Format String & Input Validation (CWE-20 / CWE-134):** Validación y parseo estricto del formato JWT proveniente de proveedores externos (Google) para evitar desbordamientos y denegaciones de servicio no controladas (HTTP 500).
2.  **CORS Hardening (CWE-942):** Configuración restrictiva de CORS en FastAPI rechazando comodines (`*`) cuando se permiten credenciales de sesión. La variable `ALLOWED_ORIGINS` lee explícitamente los dominios autorizados de producción.
3.  **Rate Limiting (CWE-770):** Implementación de límites de peticiones en los endpoints sensibles (autenticación y recuperación de contraseñas) mediante `slowapi` con persistencia en Redis.
4.  **Security Headers (CWE-693):** Nginx y FastAPI inyectan cabeceras esenciales en cada petición (`Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` y `Referrer-Policy`).
5.  **Information Leakage (CWE-532):** Sanitización de logs utilizando filtros de contexto en `structlog` para impedir el registro accidental de tokens de acceso, passwords o información de identificación personal (PII) en los logs del servidor.

---

## 🧪 Pruebas de Software (QA)

El backend cuenta con una suite de pruebas automatizadas construida sobre `pytest` y `pytest-asyncio`. Se abarcan:

- **Pruebas Unitarias:** Validación aislada de las reglas de negocio, conversión de SweetCoins y generación de reportes.
- **Pruebas de Integración:** Llamadas HTTP simuladas a los endpoints utilizando base de datos en memoria para verificar flujos transaccionales completos.

Para ejecutar los tests locales:

```bash
cd _backEnd
pytest
```

---

## ⚙️ Plan de Monitoreo y Mantenimiento

- **Monitoreo de Salud:** Endpoint dedicado `/api/v1/health` que realiza verificaciones activas sobre la conexión a la base de datos PostgreSQL y al cliente Redis/Valkey.
- **Mantenimiento Programado (Celery Beat):**
  - `expire-pending-ventas`: Libera el stock reservado de compras no concretadas cada 5 minutos.
  - `expire-lots-daily`: Marca lotes de insumos vencidos en el inventario diariamente.
  - `expire-coupons-daily`: Caduca automáticamente cupones de fidelización no utilizados.

---

## 🚀 Guía de Ejecución Local (Docker)

El proyecto está completamente Dockerizado y listo para correr localmente con un único comando:

### Requisitos Previos

- Docker y Docker Desktop instalados en el sistema.

### Pasos para iniciar:

1.  Clona el repositorio.
2.  Crea un archivo `.env` en la carpeta `_backEnd/` tomando como referencia `_backEnd/.env.example`.
3.  Crea un archivo `.env` en la carpeta `_frontEnd/` tomando como referencia `_frontEnd/.env.example`.
4.  Ejecuta desde la raíz del proyecto:
    ```bash
    docker compose up --build
    ```
5.  Accede a los servicios locales:
    - **Frontend:** `http://localhost:5173`
    - **Backend API:** `http://localhost:8000`
    - **FastAPI Swagger Docs:** `http://localhost:8000/api/docs`

---

## ☁️ Guía de Despliegue en la Nube

Para realizar el despliegue del ecosistema Mitrufely en producción:

### 1. Backend en Render (Blueprint)

El repositorio incluye un archivo `render.yaml` en la raíz. Al conectarlo con Render, se creará el servicio API y la base KeyValue (Valkey) gratis de manera automática:

1.  Crea un **Blueprint** en Render apuntando a este repositorio.
2.  Rellena las variables secretas requeridas en la interfaz de Render (`DATABASE_URL`, `SMTP_*`, `CLOUDINARY_*`, `GOOGLE_CLIENT_ID`).
3.  Copia la URL provista por Render (ej. `https://mifrufely-backend.onrender.com`).

### 2. Frontend en Vercel

1.  Crea un nuevo proyecto en Vercel e importa el repositorio.
2.  Configura el **Root Directory** del proyecto en la carpeta **`_frontEnd`**.
3.  Configura las variables de entorno:
    - `VITE_API_BASE_URL` apuntando a `https://mifrufely-backend.onrender.com/api/v1`.
    - `VITE_GOOGLE_CLIENT_ID` con tu credencial de Google OAuth.
4.  Realiza el despliegue. Vercel utilizará el archivo `vercel.json` para gestionar el routing de la SPA de forma nativa.
5.  Actualiza las variables `FRONTEND_URL` y `ALLOWED_ORIGINS` en el dashboard de Render con tu URL de Vercel para autorizar el intercambio CORS de producción.

---

## 🪪 Consulta de DNI/RUC (json.pe)

Los clientes pueden autocompletar sus datos de identidad (DNI) o fiscales (RUC) desde su perfil y desde el checkout mediante la API de [json.pe](https://json.pe/).

**Flujo:**
1. El cliente presiona "🔍 Consultar" junto al número de documento.
2. El backend consulta `https://api.json.pe` con el token `JSONPE_API_TOKEN` (en `.env`).
3. Los datos se cachean en Redis por 24 horas para evitar consumos de créditos en consultas repetidas del mismo documento.
4. El formulario se rellena. El cliente revisa y presiona "Guardar" para persistir (no se sobrescribe la base de datos automáticamente).

**Variables de entorno (`_backEnd/.env`):**

| Variable | Descripción | Default |
|---|---|---|
| `JSONPE_API_TOKEN` | Token Bearer de api.json.pe. Vacío = modo degradado (servicio deshabilitado). | `""` |
| `JSONPE_BASE_URL` | URL base del API. | `https://api.json.pe` |
| `JSONPE_CACHE_TTL_SECONDS` | TTL del cache Redis (segundos). | `86400` |
| `JSONPE_TIMEOUT_SECONDS` | Timeout HTTP (segundos). | `10` |
