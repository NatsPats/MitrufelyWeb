# Plan de Fases de Desarrollo — MitrufelyWeb

Este plan de desarrollo traza el camino detallado y formal desde el estado actual (Fase 1 completada con éxito) hasta la finalización total del proyecto **MitrufelyWeb**, asegurando un acoplamiento modular limpio y una arquitectura de inyección de dependencias sólida.

---

## 🗺️ Mapa de Fases Estratégicas

```mermaid
graph TD
    F1[Fase 1: Autenticación & Seguridad] -->|Completado| F2[Fase 2: Catálogo & Categorías]
    F2 --> F3[Fase 3: Inventario & Control FEFO]
    F3 --> F4[Fase 4: Carrito & Checkout Transaccional]
    F4 --> F5[Fase 5: Recompensas CriptoTrufas]
    F5 --> F6[Fase 6: Dashboard, Reportes PDF/Excel]
    F6 --> F7[Fase 7: Pruebas, Optimización & Despliegue]
```

---

## 🍰 Detalle de Fases Planificadas

### 🔹 Fase 2: Catálogo de Productos y Categorías
* **Objetivo:** Implementar la visualización del catálogo de trufas artesanales con búsquedas, filtrados dinámicos por categorías y gestión administrativa (CRUD).
* **Backend (`FastAPI`):**
  * CRUD de categorías y productos con slugs autogenerados (`python-slugify`).
  * **Integración con Cloudinary:** Almacenamiento externo de imágenes. La API de FastAPI recibe la foto subida por el administrador, opcionalmente la optimiza con `Pillow` en memoria (redimensionado y compresión ligera) y la sube de forma asíncrona a Cloudinary, guardando únicamente el HTTPS secure URL en `productos.imagen_url`.
  * **Validaciones estrictas de Negocio (Esquemas Pydantic V2):**
    * *Categoría:* Nombre único, obligatorio, entre 2 y 100 caracteres.
    * *Producto:* Nombre único, obligatorio, entre 2 y 150 caracteres. Precio obligatorio, estrictamente positivo (`CHECK precio > 0`). FK `id_categoria` debe ser un ID existente en la tabla `categorias`.
  * Inyección de servicios usando el contenedor `dependency-injector` para desacoplar el acceso a la base de datos.
* **Frontend (`React + TypeScript`):**
  * Vitrina interactiva con barra de búsqueda rápida y filtrado por pestañas utilizando animaciones de transición fluidas (`framer-motion`).
  * Modal detallado de productos con selector de cantidades.
  * Panel de administración para el CRUD de productos con formularios validados dinámicamente con `react-hook-form` + `zod` mapeados exactamente contra los tipos de la BD.

### 🔹 Fase 3: Gestión de Lotes, Kardex e Inventario (Control FEFO)
* **Objetivo:** Asegurar el control estricto de existencias de las trufas artesanales (las cuales son altamente perecederas) mediante lotes numerados y despachos controlados por la regla FEFO.
* **Backend (`FastAPI`):**
  * Entidad de Lote (`fecha_ingreso`, `fecha_vencimiento`, `cantidad_inicial`, `cantidad_disponible`, `estado_lote`).
  * **Validaciones del Lote:** `cantidad_inicial` estrictamente mayor a 0 (`CHECK cantidad_inicial > 0`). Pydantic valida que `fecha_vencimiento` sea posterior a la fecha actual (`fecha_vencimiento > now`), emulando el trigger de base de datos `tg_lotes_validar_insert`.
  * Control de Kardex de movimientos de stock (Ingreso por compra, egreso por venta, mermas por vencimiento).
  * Lógica algorítmica de egreso estricto **FEFO** (First Expired, First Out) al realizar la venta.
  * Manejo de fechas y zonas horarias con `python-dateutil` y `pytz`.
* **Frontend (`React + TypeScript`):**
  * Pantalla de inventario y Kardex reservada exclusivamente para administradores.
  * **Alertas Visuales de Vencimiento Configurable:** El sistema evaluará los días restantes de vida de cada lote. Por defecto, si faltan **3 días** o menos para la fecha de vencimiento (`days_until_expiration <= threshold` usando `date-fns`), el lote se coloreará en ámbar/rojo pastel en el panel de control de inventario para alertar al operario.

### 🔹 Fase 4: Carrito de Compras y Flujo de Checkout Transaccional
* **Objetivo:** Permitir a los clientes armar su pedido, realizar el pago y descontar stock garantizando la integridad de datos bajo concurrencia.
* **Backend (`FastAPI`):**
  * Persistencia del carrito de compras en caché usando `redis` para máxima concurrencia y velocidad.
  * **Flujo Transaccional sin Reserva Temporal (Integridad de Concurrencia):**
    * *El Reto:* No hay bloqueo temporal del stock en el carrito. Múltiples clientes pueden iniciar el pago del último producto remanente simultáneamente.
    * *Mitigación de Condiciones de Carrera (Race Conditions):* Al ejecutar la venta, el backend abre una transacción de base de datos PostgreSQL e implementa **Bloqueo Pesimista (Pessimistic Locking)** mediante la sentencia `SELECT ... FOR UPDATE` sobre los registros de `lotes` y `productos` a descontar.
    * Esto obliga a que la segunda petición concurrente de pago se bloquee y espere a que la primera finalice. Al reanudarse la segunda, detectará que el stock disponible es `0` y responderá inmediatamente con `409 Conflict (Stock Insuficiente)` **antes** de procesar cobros externos, evitando la sobreventa de productos y rollbacks con pagos ya cobrados.
  * Generación y registro de venta, comprobante fiscal (Boleta o Factura) y detalle de lotes asignados por FEFO.
* **Frontend (`React + TypeScript`):**
  * Drawer de carrito flotante con actualizaciones asíncronas de cantidades.
  * Pasarela de Checkout paso a paso interactiva (pasos: Datos envío → Facturación / Tipo de comprobante → Resumen e Integración de Pago).
  * Uso de componentes primitivos de Radix UI (`@radix-ui/react-dialog` y `@radix-ui/react-tabs`) para garantizar una navegación de teclado accesible y diseño responsive.

### 🔹 Fase 5: Sistema de Fidelización CriptoTrufas y Cuponería
* **Objetivo:** Gamificar la pastelería mediante la moneda interna virtual del proyecto (CriptoTrufas), otorgando puntos por compras e incentivando canjes por cupones de descuento.
* **Backend (`FastAPI`):**
  * Lógica de acumulación de puntos (por ejemplo, 10% del monto total de la venta en CriptoTrufas).
  * Endpoints para canjear saldo de puntos por cupones (con expiración, montos mínimos de compra, estado disponible/usado).
  * Tarea programada en segundo plano con `celery` + `redis` para la expiración automática de puntos no usados tras 365 días.
* **Frontend (`React + TypeScript`):**
  * Visualización premium del balance de CriptoTrufas en la barra de navegación del cliente.
  * Vitrina de canje de cupones con animaciones dinámicas de felicitación (`framer-motion` + `canvas-confetti`).
  * Integración en el Checkout para seleccionar y aplicar cupones de descuento válidos con recálculo dinámico del total de compra.

### 🔹 Fase 6: Panel de Administración, Reportes y Documentos (PDF/Excel)
* **Objetivo:** Proveer herramientas visuales y descargables para que los administradores controlen el negocio y los clientes obtengan sus comprobantes formales, siguiendo los lineamientos de diseño e implementación del skill [`11_ANALYTICS_BI.md`](../skills/11_ANALYTICS_BI.md).
* **Backend (`FastAPI`):**
  * Generación asíncrona de reportes agregados y KPIs en segundo plano utilizando `celery` para evitar bloqueos del servidor.
  * **Generación de Comprobantes PDF con WeasyPrint:** Se utiliza exclusivamente `WeasyPrint` para la conversión de plantillas HTML/CSS premium a PDF, lo que proporciona control tipográfico y de diseño absoluto (soporte CSS completo). Se elimina `ReportLab` por redundancia.
  * Generación de archivos Excel de Kardex y ventas en el servidor usando `openpyxl` y `xlsxwriter`.
* **Frontend (`React + TypeScript`):**
  * Dashboard premium para administradores con KPIs interactivos y gráficos SVG responsivos usando la librería `recharts`, respetando la **Opción A** de colores de marca corporativos (Borgoña y Naranja) y estructurando los 7 dashboards especializados definidos en la documentación técnica.
  * Integración de descargas en el cliente de reportes PDF y Excel de forma asíncrona.
  * Uso de librerías en el cliente como `jspdf` y `exceljs` para descargas inmediatas sin carga en el servidor cuando sea viable.

### 🔹 Fase 7: Pruebas, Optimización y Despliegue
* **Objetivo:** Optimizar el rendimiento de la aplicación, asegurar su robustez con cobertura de pruebas automatizadas y realizar el despliegue a producción.
* **Backend (`FastAPI`):**
  * Pruebas unitarias e integración de base de datos asíncronas usando `pytest` + `pytest-asyncio` + `factory-boy`.
  * Caché de Redis de endpoints de catálogo con TTL inteligente.
  * Instrumentación de logs JSON estructurados (`structlog`) y exposición de métricas Prometheus (`prometheus-fastapi-instrumentator`).
* **Frontend (`React + TypeScript`):**
  * Optimización automática de re-renders mediante `babel-plugin-react-compiler` de React 19.
  * Gestión automatizada pre-commit mediante `husky` y `lint-staged` para linteado y formato estricto antes del commit.
* **Infraestructura:**
  * Configuración completa de orquestación de contenedores en Docker.
  * Despliegue automatizado de la API, worker de Celery y base de datos Neon en la nube con Render (`render.yaml`).

