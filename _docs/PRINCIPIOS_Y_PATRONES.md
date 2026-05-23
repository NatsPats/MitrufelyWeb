# 🏛️ ESPECIFICACIÓN DE ARQUITECTURA DE SOFTWARE Y PRINCIPIOS DE DISEÑO
## PROYECTO: MYTRUFELY — SISTEMA TRANSACCIONAL ENTERPRISE
**Curso:** Integración de Sistemas (Ciclo 6 — UTP)

---

## 📑 1. INTRODUCCIÓN Y VISIÓN GENERAL DEL ECOSISTEMA

El sistema **Mytrufely** es una plataforma transaccional de pastelería y confitería de nivel empresarial. Está diseñado bajo una arquitectura de sistemas desacoplada, orientada a eventos e impulsada por el rendimiento. 

El ecosistema se divide en dos componentes independientes que se comunican mediante contratos asíncronos REST en formato JSON:
1. **Backend (API REST):** Construido sobre **FastAPI**, utilizando un enfoque asíncrono de punta a punta (*async-first*), inyección de dependencias de primer nivel, patrones de persistencia mediante **SQLAlchemy 2.0**, cola de tareas distribuidas con **Celery**, caché de lectura en **Redis** y una base de datos física **PostgreSQL**.
2. **Frontend (SPA):** Desarrollado en **React 19** y **Vite** empleando tipado estricto con **TypeScript**, estilos atómicos con **Tailwind CSS v4** y un sistema híbrido de gestión de estado que diferencia el estado del servidor (**TanStack React Query**) del estado del cliente (**Zustand**).

---

## 🎛️ 2. STACK TECNOLÓGICO CONSOLIDADO

El stack tecnológico ha sido minuciosamente seleccionado para garantizar tiempos de respuesta en el percentil 99 ($P_{99}$) inferiores a 100ms, y una modularidad óptima:

| Capa / Ecosistema | Tecnología Empleada | Propósito Arquitectónico |
| :--- | :--- | :--- |
| **Backend Framework** | FastAPI v0.115 + ASGI (Uvicorn) | API REST no bloqueante asíncrona de alto desempeño. |
| **Runtime & Tipado** | Python 3.11+ + MyPy (Strict Mode) | Ejecución eficiente y validación estricta de tipos estáticos. |
| **Motor de Persistencia** | SQLAlchemy 2.0 Async + `asyncpg` driver | ORM relacional moderno con mapeo asíncrono nativo. |
| **Validación de Capas** | Pydantic v2 | Análisis, coacción y tipado estricto de payloads JSON. |
| **Base de Datos** | PostgreSQL (NeonDB) | Persistencia ACID transaccional robusta con triggers y vistas. |
| **Cola de Tareas & Async** | Celery + Redis 7 Broker | Procesamiento asíncrono de reportes, PDFs y analítica en background. |
| **Seguridad y Cifrado** | JWT (python-jose) + Bcrypt (passlib) | Autenticación basada en tokens y cifrado criptográfico unidireccional. |
| **Frontend Framework** | React 19 (Componentes Funcionales) | Renderizado declarativo y concurrente en el lado del cliente. |
| **Estructuración Frontend** | Vite + TypeScript Strict | Build-tool ultrarrápida y consistencia de tipado en componentes UI. |
| **Estilos y Maquetación** | Tailwind CSS v4 | Diseño atómico, fluido e interactivo sin sobrecarga en la hoja de estilos. |
| **Estado del Servidor** | TanStack React Query v5 | Sincronización y almacenamiento en caché inteligente de datos remotos. |
| **Estado del Cliente** | Zustand v5 + Immer Middleware | Estado síncrono ultra-desacoplado (Carrito de compras, sesión global). |

---

## 📂 3. ESTRUCTURA DE DIRECTORIOS Y CONVENCIONES

Mytrufely emplea una estructura orientada a **Rebanadas Verticales (Vertical Slices)** para los módulos de negocio y capas técnicas bien definidas para los servicios del sistema, asegurando que el proyecto sea altamente mantenible y fácil de escalar por múltiples desarrolladores en paralelo.

### 📥 3.1 Estructura del Backend (`_backEnd/app/`)
```
_backEnd/
├── app/
│   ├── main.py                     # Punto de entrada y Fábrica de la Aplicación
│   ├── core/                       # Núcleo del sistema (Singletons, Constantes y Excepciones)
│   │   ├── config.py               # Pydantic Settings (Patrón Singleton con caché)
│   │   ├── constants.py            # RBAC (Roles de usuario y definiciones de permisos)
│   │   ├── exceptions.py           # Jerarquía de Excepciones del Dominio
│   │   ├── logging.py              # Configuración de Structlog (Salida JSON estructurada)
│   │   └── security.py             # Utilidades criptográficas (Bcrypt + JWT)
│   ├── infrastructure/             # Lógica de infraestructura física de bajo nivel
│   │   ├── database/
│   │   │   ├── base.py             # SQLAlchemy DeclarativeBase
│   │   │   ├── session.py          # Factoría del motor asíncrono y sesión get_db()
│   │   │   └── repositories/       # Implementaciones concretas de base de datos
│   │   ├── cache/
│   │   │   └── redis_client.py     # Cliente asíncrono de Redis
│   │   └── workers/
│   │       ├── celery_app.py       # Configuración de Celery & Tareas periódicas (Beat)
│   │       └── tasks/              # Tareas distribuidas (reportes PDF, expiraciones, email)
│   ├── middleware/                 # Interceptores de red (Chain of Responsibility)
│   │   ├── exception_handler.py    # Interceptor global de errores de dominio a HTTP
│   │   └── request_id.py           # Inyección de X-Request-ID para trazabilidad en logs
│   ├── security/
│   │   └── dependencies.py         # Dependencias de FastAPI para RBAC y control de acceso
│   ├── domain/                     # Contratos puros de negocio (Libre de infraestructura)
│   │   ├── repositories/
│   │   │   └── base.py             # Contrato base genérico de Repositorio (AbstractRepository)
│   │   └── services/
│   │       └── base.py             # Contrato base genérico de Servicios
│   ├── modules/                    # Módulos de dominio vertical (Vertical Feature Slices)
│   │   ├── auth/                   # Gestión de Login, Registro y Renovación de Tokens
│   │   │   ├── router.py           # Endpoints HTTP
│   │   │   ├── schemas.py          # Modelos de validación Pydantic
│   │   │   ├── service.py          # Lógica pura de negocio
│   │   │   ├── repository.py       # Contrato abstracto del repositorio de Auth
│   │   │   └── dependencies.py     # Cableado DI (FastAPI Depends)
│   │   ├── products/               # Catálogo de pasteles, categorías
│   │   ├── orders/                 # Transacciones de venta y facturación
│   │   ├── inventory/              # Gestión de lotes FEFO y Kardex
│   │   ├── cart/                   # Carritos efímeros persistidos en Redis
│   │   ├── sweetcoins/             # Puntos acumulados de fidelidad
│   │   ├── reports/                # Generación de reportes dinámicos
│   │   └── users/                  # Perfiles y datos de facturación fiscal
│   └── routers/
│       └── __init__.py             # Agregador central de enrutamiento
```

### 📤 3.2 Estructura del Frontend (`_frontEnd/src/`)
```
_frontEnd/src/
├── main.tsx                        # Punto de montaje del DOM virtual de React
├── app/
│   ├── App.tsx                     # Orquestador raíz: Enrutador + QueryClient + Providers
│   ├── routes/                     # Definición y guardas del árbol de rutas (React Router 7)
│   │   ├── index.tsx               # Definición estricta de rutas públicas y privadas
│   │   ├── ProtectedRoute.tsx      # Guarda de autenticación de sesión activa
│   │   └── RoleGuard.tsx           # Guarda basada en roles (RBAC) para el panel de gestión
│   └── providers/
│       └── index.tsx               # Contenedores globales de React (Query, Toast, etc.)
├── pages/                          # Capa de presentación (Páginas completas)
│   ├── public/                     # Sin autenticación (Home, Login, Registro)
│   ├── client/                     # Entorno exclusivo de clientes (Catálogo, Checkout, SweetCoins)
│   └── admin/                      # Entorno administrativo (Dashboard, Inventario FEFO, Ventas)
├── features/                       # Lógica de dominio del lado del cliente (Co-localizada)
│   ├── auth/
│   │   ├── hooks/                  # Custom Hooks asíncronos (useLogin, useRegister)
│   │   ├── api/                    # Cliente HTTP especializado (llamadas Axios de autenticación)
│   │   └── store/                  # Estado síncrono del usuario autenticado (Zustand)
│   ├── products/                   # Productos, catálogo, filtros de búsqueda
│   ├── cart/                       # Carrito de compras reactivo (estado Zustand persistido)
│   ├── inventory/                  # Formularios Kardex, control de stock y vencimiento
│   └── sweetcoins/                 # Saldo de puntos y canje de cupones
├── shared/                         # Elementos compartidos globales e independientes de negocio
│   ├── components/
│   │   ├── ui/                     # Botones primitivos, inputs con validaciones, modales, etc.
│   │   ├── layout/                 # Marcos de interfaz comunes (AppShell, Navbar, Sidebar)
│   │   └── feedback/               # Pantallas de carga, errores visuales, etc.
│   ├── lib/
│   │   ├── axios.ts                # Configuración de Axios, inyección de tokens e interceptores
│   │   └── queryClient.ts          # Configuración del motor asíncrono React Query
│   └── types/                      # Interfaces TypeScript globales y tipos de red
```

---

## 🔀 4. FLUJO DE DEPENDENCIAS Y REGLAS DE ORO ARQUITECTÓNICAS

Para mantener un acoplamiento débil (*loose coupling*), se aplican estrictamente reglas de dependencia unidireccional:

```
[ Capa HTTP (Router / UI) ] ────────► [ Capa de Servicios (Negocio) ]
                                                │
                                                ▼
[ BD Relacional / SQLite ] ◄──────── [ Capa de Repositorios (Abstracción) ]
```

> [!IMPORTANT]
> **REGLAS CRÍTICAS DE IMPORTACIÓN (BACKEND):**
> * **Prohibido:** Los *Routers* no pueden importar repositorios bajo ninguna circunstancia. Toda petición de datos física debe ser canalizada a través de un *Service*.
> * **Prohibido:** Los *Services* no pueden importar de forma directa la sesión asíncrona de base de datos de SQLAlchemy (`AsyncSession`). Su único acceso a datos debe ser mediante las abstracciones definidas en los *Repositories*.
> * **Prohibido:** Los *Repositories* no contienen lógica de negocio ni cálculos transaccionales. Su función se limita exclusivamente a mapeos relacionales e I/O de base de datos.

---

## 🏛️ 5. EL PATRÓN ARQUITECTÓNICO MVC (MODELO-VISTA-CONTROLADOR)

Mytrufely emplea una arquitectura **MVC Desacoplada**. Dado que el Backend y el Frontend operan de forma separada, los componentes del patrón se mapean de la siguiente manera:

```mermaid
graph LR
    subgraph Frontend (Capa de Presentación y Vista)
        V[Vista / Componente React] <--> Z[Estado Cliente / Zustand]
    end
    
    subgraph Backend (Capa de Control y Datos)
        R[API Router / FastAPI] <--> C[Servicio / Controlador]
        C <--> Rep[Repositorio / Abstracción]
        Rep <--> M[Modelos SQLAlchemy & Pydantic]
    end

    V <-->|Petición JSON vía HTTP / HTTPS| R
    M <-->|SQL Asíncrono| DB[(PostgreSQL)]
```

### 🧱 Detalle del Patrón MVC en Mytrufely:

* **El Modelo (Model):**
  * **Persistencia:** Modelos de SQLAlchemy 2.0 ubicados en `app/infrastructure/database/base.py` que definen el esquema físico, claves primarias y relaciones estructuradas de PostgreSQL.
  * **Intercambio (Data Transfer Objects):** Esquemas de **Pydantic v2** (`app/modules/auth/schemas.py`) que actúan como "modelos de validación" impidiendo el ingreso de datos corruptos al dominio del controlador.
* **La Vista (View):**
  * **En el Backend:** La representación de salida son los *FastAPI Routers* que devuelven estructuras JSON estandarizadas bajo el formato `ORJSONResponse` de alta velocidad.
  * **En el Frontend:** Las interfaces gráficas en **React 19** que procesan ese JSON y crean el DOM dinámico para el usuario.
* **El Controlador (Controller):**
  * Implementado en la capa de **Services** (`app/modules/*/service.py`).
  * Recibe payloads validados en el enrutador, comprueba las reglas de negocio (ej. validez de stock, políticas fiscales, cálculo de SweetCoins), modifica el estado de los modelos y le encarga el almacenamiento físico al repositorio.

---

## 📐 6. IMPLEMENTACIÓN PRÁCTICA DE PRINCIPIOS SOLID

SOLID no es una teoría en Mytrufely; está reflejado directamente en su código. A continuación, se detallan ejemplos reales del proyecto:

### 1️⃣ S — Single Responsibility Principle (SRP)
* **Teoría:** *Un módulo o clase debe tener una sola y única razón para cambiar.*
* **Aplicación:** Cada carpeta dentro de `app/modules/` fragmenta las responsabilidades técnicas. Por ejemplo, en el módulo de autenticación:
  * El router ([auth/router.py](file:///c:/Users/lordm/Desktop/Proyectos%20y%20clases/UTP%20CICLO%206/Integrador%20de%20Sistemas/proyecto/MitrufelyWeb/_backEnd/app/modules/auth/router.py)) solo interactúa con los protocolos de red (HTTP) y deserialización.
  * El servicio ([auth/service.py](file:///c:/Users/lordm/Desktop/Proyectos%20y%20clases/UTP%20CICLO%206/Integrador%20de%20Sistemas/proyecto/MitrufelyWeb/_backEnd/app/modules/auth/service.py)) contiene únicamente lógica de negocio pura:

```python
# app/modules/auth/service.py (Solo reglas de negocio)
class AuthService:
    def __init__(self, repository: AbstractAuthRepository) -> None:
        self._repo = repository

    async def login(self, payload: LoginRequest) -> TokenResponse:
        # Se enfoca únicamente en el caso de uso 'Login'
        user = await self._repo.get_by_email(payload.email)
        if not user or not verify_password(payload.password, user.password_hash):
            raise InvalidCredentialsError() # Excepción de dominio aislada de HTTP

        return TokenResponse(
            access_token=create_access_token(subject=str(user.id), role=user.role),
            refresh_token=create_refresh_token(subject=str(user.id)),
            expires_in=3600
        )
```

---

### 2️⃣ O — Open/Closed Principle (OCP)
* **Teoría:** *Las entidades de software deben estar abiertas a la extensión, pero cerradas a la modificación.*
* **Aplicación:** El diseño de excepciones del dominio en `app/core/exceptions.py` y su interceptación en el middleware `app/middleware/exception_handler.py` representan un perfecto caso de OCP.
  * **Base Cerrada:** El middleware de excepciones está configurado para capturar la clase base `MifrufelyBaseError`:

```python
# app/middleware/exception_handler.py (Cerrado a modificaciones)
@app.exception_handler(MifrufelyBaseError)
async def domain_exception_handler(request: Request, exc: MifrufelyBaseError) -> ORJSONResponse:
    request_id = getattr(request.state, "request_id", None)
    return _error_response(
        status_code=exc.status_code,
        error_code=exc.error_code,
        message=exc.message,
        request_id=request_id
    )
```

  * **Extensión Abierta:** Si un nuevo módulo requiere un control de error específico (por ejemplo, saldo insuficiente deSweetCoins), solo debemos declarar la nueva clase heredando de la base. El middleware la gestionará automáticamente **sin modificar una sola línea de código** del enrutador central de excepciones:

```python
# app/core/exceptions.py (Abierto a extensiones)
class InsufficientSweetCoinsError(MifrufelyBaseError):
    status_code = HTTPStatus.UNPROCESSABLE_ENTITY
    error_code = "INSUFFICIENT_SWEETCOINS"
    message = "SweetCoins insuficientes para realizar esta transacción"
```

---

### 3️⃣ L — Liskov Substitution Principle (LSP)
* **Teoría:** *Los subtipos deben ser perfectamente sustituibles por sus tipos base sin alterar el correcto comportamiento del sistema.*
* **Aplicación:** 
  1. **Polimorfismo en Excepciones:** Dado que todas las excepciones específicas de Mytrufely (como `DuplicateResourceError` o `InvalidCredentialsError`) heredan de `MifrufelyBaseError`, se pueden lanzar indistintamente y el sistema receptor (FastAPI handler) las procesará polimórficamente sin fallos de conversión o ejecuciones erróneas.
  2. **Intercambiabilidad de Repositorios:** La clase de negocio `AuthService` requiere una interfaz `AbstractAuthRepository`. Podemos inyectar la implementación física SQL (`SQLAlchemyAuthRepository`) o un Mock de pruebas en memoria (`MockAuthRepository`) que simule la BD. El servicio funcionará sin enterarse del cambio físico de infraestructura, respetando de forma íntegra el comportamiento esperado.

---

### 4️⃣ I — Interface Segregation Principle (ISP)
* **Teoría:** *Los clientes no deben verse obligados a depender de métodos de interfaces que no utilizan.*
* **Aplicación:** No sobrecargamos una sola clase con todos los accesos a datos. El sistema separa la interfaz genérica en `app/domain/repositories/base.py` de las interfaces altamente especializadas por módulo.
  * La clase `AbstractRepository` define métodos CRUD estándar (`get_by_id`, `get_all`, `create`, `update`, `delete`).
  * La interfaz `AbstractAuthRepository` ([auth/repository.py](file:///c:/Users/lordm/Desktop/Proyectos%20y%20clases/UTP%20CICLO%206/Integrador%20de%20Sistemas/proyecto/MitrufelyWeb/_backEnd/app/modules/auth/repository.py)) hereda de ella e incorpora **estrictamente** los métodos que requiere su dominio especializado:

```python
# app/modules/auth/repository.py (ISP - Interfaz segregada y limpia)
class AbstractAuthRepository(AbstractRepository):
    @abstractmethod
    async def get_by_email(self, email: str):
        """Recupera el usuario a través de su email."""
        ...

    @abstractmethod
    async def email_exists(self, email: str) -> bool:
        """Verifica la existencia del email en el sistema."""
        ...
```

* Un servicio de autenticación solo interactúa con los contratos declarados en `AbstractAuthRepository`, manteniéndose ciego a firmas ajenas de compras, inventarios, etc.

---

### 5️⃣ D — Dependency Inversion Principle (DIP)
* **Teoría:** *Los módulos de alto nivel no deben depender de módulos de bajo nivel. Ambos deben depender de abstracciones.*
* **Aplicación:** `AuthService` (capa de lógica de alto nivel) **no tiene dependencias directas** con SQLAlchemy, PostgreSQL o `AsyncSession` (infraestructura de bajo nivel). En su lugar, depende de la abstracción `AbstractAuthRepository`:

```python
# El módulo de negocio de alto nivel depende de la abstracción (DIP)
class AuthService:
    def __init__(self, repository: AbstractAuthRepository) -> None:
        self._repo = repository # Acoplamiento débil hacia el contrato abstracto
```

* **El contenedor de Inversión de Control (FastAPI):** A través del archivo `dependencies.py` cableamos dinámicamente qué implementación concreta inyectar en tiempo de ejecución:

```python
# app/modules/auth/dependencies.py (FastAPI DI Container)
async def get_auth_service(
    repository: Annotated[AbstractAuthRepository, Depends(get_auth_repository)],
) -> AuthService:
    # Retorna la instancia de negocio inyectando la implementación concreta elegida
    return AuthService(repository=repository)
```

---

## 🛠️ 7. PATRONES DE DISEÑO ADICIONALES (GoF Y MODERNOS)

Aparte de SOLID y MVC, Mytrufely utiliza patrones de software de nivel corporativo para la resolución elegante de complejidades técnicas:

### 💼 A. Patrón Repositorio (Repository Pattern)
* **Propósito:** Abstraer el motor físico de base de datos mediante una interfaz genérica.
* **Ubicación:** `app/domain/repositories/base.py` y las especializaciones por módulo.
* **Uso en Mytrufely:** Evita el acoplamiento directo de consultas complejas de SQLAlchemy 2.0 dentro de los archivos de lógica de negocio (`service.py`). Si en el futuro migramos de PostgreSQL a MongoDB o Firebase, el cambio se limita a los archivos de infraestructura (`infrastructure/database/repositories/`), manteniendo el código de negocio totalmente inalterado.

### 🏭 B. Application Factory Pattern (Fábrica de Aplicaciones)
* **Propósito:** Encapsular y parametrizar el proceso de arranque e inicialización del sistema.
* **Ubicación:** `app/main.py`
* **Uso en Mytrufely:** La función `create_application()` retorna una instancia configurada de FastAPI lista para operar. Esto facilita levantar de forma independiente múltiples réplicas aisladas en entornos de desarrollo, producción o en contenedores paralelos de pruebas unitarias (`pytest`):

```python
def create_application() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        default_response_class=ORJSONResponse
    )
    # Registro secuencial de componentes en la fábrica:
    application.add_middleware(CORSMiddleware, ...)
    register_exception_handlers(application)
    application.include_router(api_router, prefix=settings.API_V1_PREFIX)
    
    return application
```

### 🛡️ C. Patrón Singleton
* **Propósito:** Garantizar una única instancia de una clase a nivel de memoria global del proceso y proporcionar un acceso unificado a ella.
* **Ubicación:** `app/core/config.py`
* **Uso en Mytrufely:** Evita la lectura reiterada de archivos `.env` en disco duro y el análisis sintáctico de variables de configuración durante cada petición HTTP, lo cual restaría rendimiento. Usando el decorador `@lru_cache` de Python, aseguramos una única instancia inicializada:

```python
@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Instancia en caché de configuración global — Singleton."""
    return Settings()

settings: Settings = get_settings()
```

### 🔗 D. Chain of Responsibility (Cadena de Responsabilidad)
* **Propósito:** Procesar una solicitud HTTP pasándola a través de una cadena estructurada de manejadores secuenciales.
* **Ubicación:** Middlewares registrados en `app/main.py`.
* **Uso en Mytrufely:** El flujo de una petición de red entrante se gestiona a través de la cadena de middlewares. Cada eslabón ejecuta su tarea (verificar CORS, comprimir JSON con GZip, inyectar el identificador de rastreo `request_id`, capturar errores) y decide si continuar al siguiente manejador usando `call_next(request)`:

$$\text{Petición de Cliente} \longrightarrow \text{CORSMiddleware} \longrightarrow \text{GZipMiddleware} \longrightarrow \text{RequestIDMiddleware} \longrightarrow \text{Router}$$

### 📡 E. Patrón Observer / Callback (Frontend Axios a Zustand)
* **Propósito:** Notificar la ocurrencia de eventos de infraestructura de red asíncrona directamente a la capa de almacenamiento de estado síncrona sin crear acoplamientos destructivos o referencias circulares.
* **Ubicación:** `_frontEnd/src/lib/axios.ts` y `_frontEnd/src/stores/auth.store.ts`
* **Uso en Mytrufely:** Si el interceptor de red de Axios detecta un error de red `401 Unauthorized` (Token expirado), requiere forzar el cierre de sesión en Zustand (`useAuthStore`). Para evitar que el archivo de Axios dependa directamente del archivo del Store (lo que produciría un bucle de importación circular en TypeScript), Axios expone un sistema de callbacks:

```typescript
// En shared/lib/axios.ts:
let logoutCallback: (() => void) | null = null;
export const registerLogoutCallback = (cb: () => void) => {
  logoutCallback = cb;
};

// ... Dentro del interceptor de respuesta ante 401 no renovado:
if (logoutCallback) logoutCallback();
```
```typescript
// En features/auth/store/authStore.ts:
// Zustand se registra en la inicialización (Observer)
registerLogoutCallback(() => {
  useAuthStore.getState().logout();
});
```

---

## 📨 8. CONTRATOS DE COMUNICACIÓN: RESPONSE ENVELOPE STANDARD

Para asegurar la coherencia del sistema y facilitar la integración con el frontend, todas las respuestas HTTP de Mytrufely se devuelven encapsuladas en un formato estándar conocido como **Response Envelope**.

### 🟢 8.1 Transacción Exitosa (200 OK / 201 Created)
Garantiza un formato unificado donde la información del dominio reside exclusivamente en `data`:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "expires_in": 3600
  },
  "message": "Operación completada con éxito"
}
```

### 🔴 8.2 Error Controlado de Negocio (4xx / 5xx)
Cualquier error devuelto por la jerarquía de excepciones SOLID genera una estructura tipada que incluye un identificador único de rastreo (`request_id`) para trazabilidad en logs:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Credenciales de acceso incorrectas o cuenta inactiva"
  },
  "request_id": "8c5b960b-8d19-4821-b0db-6e6b0a7dbf2d"
}
```

---

## 🎯 9. TIPS DE SUSTENTACIÓN MAESTRA ANTE EL JURADO

Cuando presentes este proyecto ante tu profesor o jurado evaluador, resalta la arquitectura con los siguientes argumentos técnicos:

1. **Arquitectura Orientada al Rendimiento (Async-First):** Explica que la app utiliza todo el poder asíncrono de Python 3.11+ y FastAPI. Al usar drivers no bloqueantes como `asyncpg` en conjunto con PostgreSQL, Mytrufely no bloquea hilos del procesador mientras espera respuestas de red de la base de datos, lo que le permite soportar más de **10 veces** la concurrencia de frameworks tradicionales como Django o Flask.
2. **Aplicación real de SOLID:** Detalla que no utilizaste un "código espagueti" donde todo se escribe en un archivo. Señala que el acoplamiento débil (DIP) y la segregación de interfaces (ISP) permiten cambiar por completo la base de datos física o agregar pasarelas de pago externas sin modificar la lógica principal de negocio.
3. **Manejo Centralizado y Trazabilidad:** Menciona que el sistema integra un Middleware global de excepciones y trazabilidad por `request_id` (Request Tracing). Si un error ocurre en producción, el identificador único correlaciona de manera exacta la pantalla del cliente con las trazas y logs de base de datos en los servidores.
4. **Patrón de Estado Híbrido en el Frontend:** Enfatiza que el Frontend no mezcla datos temporales del servidor con datos persistidos del cliente. TanStack React Query gestiona y cachea la información del backend de forma óptima, mientras Zustand coordina de manera síncrona el carrito y la sesión de usuario, lo cual se traduce en una UI ágil y fluida.
