# 📋 Estrategia de Despliegue en la Nube — MitrufelyWeb

Este documento describe la estrategia de despliegue en la nube del sistema **MitrufelyWeb**. La solución se publica bajo un modelo cloud-native desacoplado, distribuyendo cada componente (frontend, backend, workers y base de datos) en servicios especializados que se comunican entre sí mediante la red pública de Internet, respetando el principio de separación de responsabilidades de la arquitectura.

---

## 1. 🌐 Topología de Despliegue Distribuida

El sistema se despliega sobre servicios independientes, cada uno en un proveedor de cloud especializado en su función:

| Componente | Tecnología | Plataforma de Despliegue | Función |
|---|---|---|---|
| **Frontend (SPA)** | React 19 + Vite (build estático) | **Vercel** | Servidor de archivos estáticos con CDN global. |
| **Backend (API REST)** | FastAPI + Uvicorn | **Render (Web Service)** | Servidor de aplicación ASGI con escalado horizontal. |
| **Workers asíncronos** | Celery (Worker + Beat) | **Render (Background Worker)** | Procesamiento en segundo plano (PDF, Excel, analítica, expiración). |
| **Caché / Cola** | Redis | **Render (Redis)** | Broker de Celery + almacenamiento de carritos y blocklist de JWT. |
| **Base de Datos** | PostgreSQL | **NeonDB (Serverless)** | Persistencia ACID transaccional con triggers y vistas. |
| **Imágenes** | — | **Cloudinary** | CDN de medios (fotos de productos). |

### Comunicación entre servicios:
*   El **frontend** consume la API del backend mediante su URL pública (`VITE_API_BASE_URL`).
*   El **backend** se conecta a NeonDB, Redis y Cloudinary mediante variables de entorno inyectadas en tiempo de ejecución.

Esta topología permite que cada componente escale, se actualice y se monitoree de forma independiente.

---

## 2. ⚡ Despliegue del Frontend en Vercel (Edge Network)

El frontend es una *Single Page Application* (SPA) construida con Vite. El proceso de despliegue consiste en generar un bundle de archivos estáticos optimizados y publicarlos en la red de borde (CDN) global de Vercel.

*   **Build de producción:** El comando `npm run build` ejecuta la compilación de TypeScript (`tsc -b`) y luego el empaquetado de Vite, generando artefactos estáticos en `dist/` (con *tree-shaking*, *code-splitting* y minificación).
*   **Publicación continua:** Vercel se integra directamente con el repositorio de GitHub. Cada push a la rama `master` desencadena automáticamente un nuevo build y despliegue (Continuous Deployment), sirviendo la última versión en una URL pública bajo el dominio `*.vercel.app`.
*   **Edge Network:** Los archivos se replican en múltiples *Points of Presence* (PoP) del mundo, de modo que el usuario recibe el contenido desde el nodo geográficamente más cercano, minimizando la latencia de carga inicial.
*   **Variables de entorno:** La URL del backend se inyecta en el bundle en tiempo de construcción mediante la variable `VITE_API_BASE_URL`, apuntando a la API desplegada en Render.

---

## 3. 🐳 Despliegue del Backend en Render (Contenedores Docker)

El backend se despliega como un *Web Service* en Render utilizando una imagen Docker multi-stage (`Dockerfile`), lo que garantiza que el entorno de producción sea idéntico al de desarrollo y evite el clásico problema de "en mi máquina funciona".

### i. Estrategia de Imagen Multi-Stage
El `Dockerfile` emplea tres etapas para optimizar el tamaño y la seguridad de la imagen final:
1.  **Builder:** Instala las dependencias de `requirements.txt` en un prefijo aislado, sin arrastrar el compilador ni cachés al producto final.
2.  **Development:** Incluye las herramientas de desarrollo (`requirements-dev.txt`) y se usa en local vía `docker-compose` con *hot-reload* (`--reload`).
3.  **Production:** Imagen mínima basada en `python:3.11-slim` que solo copia las dependencias y el código, ejecutándose bajo un usuario no privilegiado (`appuser`) con un `HEALTHCHECK` propio, siguiendo las buenas prácticas de seguridad de contenedores.

### ii. Orquestación en Producción (`render.yaml`)
El despliegue se declara de forma declarativa e infraestructura-como-código mediante el archivo `render.yaml`:
*   **Web Service (FastAPI):** Se ejecuta con `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2`, donde `$PORT` lo inyecta Render dinámicamente. Dispone de un Health Check en `/api/v1/health` que Render consulta periódicamente para determinar la disponibilidad del servicio.
*   **Background Worker (Celery):** Ejecuta el worker y el beat scheduler en procesos independientes. Se encarga de las tareas pesadas (generación de reportes PDF/Excel, agregación de analítica, notificaciones y expiración automática de ventas pendientes), desacoplando estos procesos del hilo principal de la API.
*   **Redis (broker/caché):** Servicio gestionado por Render, con política `allkeys-lru`, accesible únicamente desde la red interna de Render (`ipAllowList: []`), usado tanto como broker de Celery como para el almacenamiento del carrito persistente y la blocklist de tokens JWT.
*   **Despliegue continuo:** Render se vincula con GitHub y reconstruye la imagen automáticamente ante cada commit en `master` (`autoDeploy: true`).

---

## 4. 🔑 Gestión de Configuración y Secretos

Ningún secreto vive en el repositorio. Toda la configuración sensible se administra mediante variables de entorno inyectadas en tiempo de ejecución desde el panel de cada proveedor:

| Variable | Propósito |
|---|---|
| `DATABASE_URL` | Cadena de conexión a PostgreSQL (NeonDB) — marcada como secret. |
| `SECRET_KEY` | Clave de firma de los JWT — autogenerada por Render. |
| `REDIS_URL` | Conexión al Redis interno — provista automáticamente por el servicio. |
| `APP_ENV / DEBUG` | Modo de ejecución (`production` / `false`). |
| `VITE_API_BASE_URL` | URL pública del backend, inyectada en el bundle del frontend. |
| `CLOUDINARY_*` | Credenciales del CDN de imágenes. |

En el backend, estas variables se leen de forma centralizada y tipada mediante *Pydantic Settings* (con el patrón Singleton vía `@lru_cache`), validando su presencia y formato al arrancar la aplicación y fallando de forma temprana (*fail-fast*) si alguna es inválida.

---

## 5. 🚚 Microservicio de Entregas (Delivery Service)

El sistema incluye un microservicio independiente (`_deliveryService`) encargado de simular el proceso de preparación y tránsito de los pedidos:
*   Se ejecuta como un servicio FastAPI aislado (puerto `8001`), exponiendo `POST /deliveries` para iniciar una entrega y `GET /deliveries/{id}` para consultar su estado.
*   Tras simular la preparación y el tránsito (con retardos configurables), notifica al backend mediante un webhook firmado (`x-delivery-token`) hacia `/api/v1/ventas/{id}/delivery-completed`, aplicando reintentos con *backoff exponencial* ante fallos transitorios de red.
*   Este desacoplamiento permite que la lógica de entregas evolucione (o se sustituya por una pasarela de envíos real) sin afectar al backend principal.

---

## 6. 🚀 Estrategia CI/CD y Pipeline de Liberación

El proyecto adopta un flujo **GitOps** de despliegue continuo, donde el estado deseado del sistema vive en el propio repositorio:

1.  **Commit en master:** Tras la revisión vía Pull Request, el código fusionado desencadena los webhooks de ambos proveedores.
2.  **Build paralelo:** Vercel compila el frontend estático; Render construye la imagen Docker del backend.
3.  **Health Check:** Render solo enruta tráfico al nuevo despliegue cuando el endpoint `/api/v1/health` responde correctamente, garantizando *zero-downtime*.
4.  **Rollback:** Ambas plataformas conservan el historial de despliegues, permitiendo revertir a una versión anterior ante una regresión.

---

## 7. 📊 Consideraciones de los Planes Free y Escalabilidad

El despliegue se realiza sobre los planes gratuitos de Vercel y Render, lo que impone ciertas restricciones que la arquitectura mitiga deliberadamente:
*   **Render Free (Web Service):** El servicio puede entrar en estado *idle* (suspensión) tras periodos de inactividad. La arquitectura asíncrona y los workers de Celery permiten que la primera petición tras reactivarse se sirva correctamente tras un breve arranque.
*   **NeonDB (Serverless):** La base de datos también escala a cero en inactividad; el pool de conexiones de SQLAlchemy (`asyncpg`) maneja reconexiones transparentes.
*   **Vercel Hobby:** Límite de ancho de banda adecuado para un alcance académico/demo, con CDN que reduce la carga sobre el origen.
*   **Escalado horizontal futuro:** Al estar cada componente desacoplado (frontend estático, API stateless, workers independientes, Redis y base de datos gestionados), el sistema puede crecer vertical u horizontalmente sin refactorizar el código, simplemente ajustando el plan de cada servicio.
