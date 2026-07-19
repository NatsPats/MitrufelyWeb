# Diseño: Integración API json.pe para consulta de DNI/RUC

**Fecha:** 2026-07-19
**Estado:** Aprobado (pendiente de revisión final del usuario)
**Stack:** FastAPI (backend) + React/Vite (frontend) + PostgreSQL + Redis

## 1. Resumen

Integrar la API de [json.pe](https://docs.json.pe/) para que los clientes puedan consultar sus datos de identidad (DNI) o fiscales (RUC) y autocompletar formularios, en lugar de escribirlos manualmente. El token de la API vive **solo en el backend**; el frontend nunca lo conoce.

### Reglas de oro

1. La consulta a la API **solo se dispara** cuando el usuario presiona el botón "Consultar" y no tiene datos fiscales guardados (o decide actualizarlos).
2. El endpoint de consulta **nunca persiste** en BD — solo devuelve datos para rellenar el formulario. La persistencia ocurre al hacer "Guardar", reutilizando los endpoints existentes.
3. Toda respuesta exitosa de json.pe se cachea en Redis (24h) para evitar consumir créditos del plan en consultas repetidas del mismo documento.
4. El token `JSONPE_API_TOKEN` se lee de variables de entorno; nunca viaja al navegador.

## 2. Contexto

### 2.1 Endpoints de json.pe utilizados

| Endpoint | Body | Devuelve |
|---|---|---|
| `POST https://api.json.pe/api/dni` | `{dni: "8 dígitos"}` | `{success, message, data: {nombres, apellido_paterno, apellido_materno, nombre_completo, direccion, direccion_completa, ...}}` |
| `POST https://api.json.pe/api/ruc` | `{ruc: "11 dígitos"}` | `{success, message, data: {ruc, nombre_o_razon_social, direccion, direccion_completa, distrito, provincia, departamento, estado, condicion, ...}}` |

Autenticación: header `Authorization: Bearer <token>`.

### 2.2 Estado actual del proyecto

- Backend FastAPI modular con arquitectura en capas: Router → Service → Repository.
- Modelo `DatosFiscales` ya existe: `tipo_documento` (DNI/RUC), `numero_documento`, `razon_social`, `direccion_fiscal`, `es_predeterminado`.
- Modelo `Cliente` ya existe: `direccion`, `referencia`, `telefono`.
- Modelo `Usuario` ya existe: `nombres`, `apellidos`, `email`, `telefono`.
- Endpoints existentes a reutilizar:
  - `GET /api/v1/auth/me/datos-fiscales`
  - `POST /api/v1/auth/me/datos-fiscales` (upsert)
  - `PUT /api/v1/auth/me` (actualiza usuario + cliente)
- Frontend React + TanStack Query + Zod + react-hook-form.
- `PaymentModal.tsx` ya tiene 4 pasos (Resumen, Fiscales, Envío, Pago) con gestión de datos fiscales y envío.
- `ProfileInfoPage.tsx` NO gestiona datos fiscales actualmente.

## 3. Arquitectura

### 3.1 Diagrama de alto nivel

```
┌──────────────────────────────────────────────────────────────┐
│ FRONTEND (React)                                              │
│  - ProfileInfoPage: nueva sección "Datos Fiscales"            │
│  - PaymentModal: Step 1 mejora con botón "Consultar"          │
│  - useConsultarDocumento → POST /consultas/documento          │
└─────────────────────────┬─────────────────────────────────────┘
                          │ (Auth: Bearer JWT)
                          ▼
┌──────────────────────────────────────────────────────────────┐
│ BACKEND (FastAPI)                                             │
│                                                               │
│  modules/consultas/router.py                                  │
│     POST /api/v1/consultas/documento                          │
│           │                                                   │
│           ▼                                                   │
│  modules/consultas/service.py                                 │
│     1. Valida formato (8 dígitos DNI / 11 RUC)                │
│     2. Chequea DatosFiscales en BD para user_id               │
│     3. Cache Redis: jsonpe:{tipo}:{numero}                    │
│     4. Si miss → JsonPeClient.consultar_{tipo}                │
│     5. Normaliza → DocumentoLookupResult                      │
│     6. Set Redis (TTL 24h)                                    │
│     7. NO persiste en BD                                      │
│           │                                                   │
│           ▼                                                   │
│  shared/external/jsonpe/client.py                             │
│     - httpx.AsyncClient, Bearer JSONPE_API_TOKEN              │
│     - consultar_dni, consultar_ruc, dni_tiene_ruc             │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Reglas arquitectónicas

- `shared/external/jsonpe/` es un **cliente puro**: solo HTTP, sin dependencias con SQLAlchemy/Redis. Testeable aislado.
- `modules/consultas/` orquesta: validación + BD + cache + cliente externo + normalización.
- Respuesta al frontend es **agnóstica del tipo** de documento (mismo schema para DNI y RUC, campos opcionales).
- Endpoint protegido por `AuthUser` (JWT requerido) y con rate limiting por usuario.

## 4. Backend — Estructura detallada

### 4.1 Archivos nuevos

```
_backEnd/app/
├── shared/
│   └── external/
│       ├── __init__.py
│       └── jsonpe/
│           ├── __init__.py
│           ├── client.py            # JsonPeClient (httpx)
│           ├── schemas.py           # JsonPeDniData, JsonPeRucData, JsonPeEnvelope
│           ├── exceptions.py        # JsonPeError, JsonPeUnavailable, JsonPeNotFound
│           └── dependencies.py      # get_jsonpe_client (DI)
└── modules/
    └── consultas/
        ├── __init__.py
        ├── router.py                # POST /consultas/documento
        ├── schemas.py               # DocumentoLookupRequest, DocumentoLookupResult
        ├── service.py               # ConsultasService
        └── dependencies.py          # get_consultas_service (DI)
```

### 4.2 Archivos existentes a editar

| Archivo | Cambio |
|---|---|
| `app/core/config.py` | Añadir `JSONPE_API_TOKEN`, `JSONPE_BASE_URL`, `JSONPE_CACHE_TTL_SECONDS`, `JSONPE_TIMEOUT_SECONDS` |
| `app/routers/__init__.py` | Registrar el router de `consultas` |
| `_backEnd/ARCHITECTURE.md` | Documentar el nuevo módulo y la carpeta `shared/external/` |
| `_backEnd/.env` | Añadir sección JSON.PE (ya realizado) |
| `_backEnd/.env.example` | Documentar las nuevas variables (ya realizado) |

### 4.3 Configuración (Pydantic Settings)

```python
# app/core/config.py (añadir)
JSONPE_API_TOKEN: SecretStr = Field(SecretStr(""), description="Token de api.json.pe")
JSONPE_BASE_URL: str = "https://api.json.pe"
JSONPE_CACHE_TTL_SECONDS: int = Field(86400, description="TTL cache Redis para consultas DNI/RUC")
JSONPE_TIMEOUT_SECONDS: int = Field(10, description="Timeout HTTP hacia json.pe")
```

### 4.4 Cliente `JsonPeClient`

```python
# app/shared/external/jsonpe/client.py
class JsonPeClient:
    def __init__(self, base_url: str, token: SecretStr, timeout: float): ...

    async def consultar_dni(self, dni: str) -> JsonPeDniData: ...
    async def consultar_ruc(self, ruc: str) -> JsonPeRucData: ...
    async def dni_tiene_ruc(self, dni: str) -> JsonPeDniRucData: ...
```

- Usa `httpx.AsyncClient` reutilizable.
- Lanza `JsonPeNotFound` (HTTP 404 de json.pe), `JsonPeUnavailable` (timeout / 5xx), `JsonPeError` (otros errores).
- Si `token` está vacío → `JsonPeUnavailable("Token no configurado")` sin llegar a hacer la llamada HTTP.

### 4.5 Schemas crudos de json.pe (`shared/external/jsonpe/schemas.py`)

```python
class JsonPeEnvelope(BaseModel, Generic[T]):
    success: bool
    message: str
    data: T | None = None

class JsonPeDniData(BaseModel):
    numero: str
    nombres: str | None
    apellido_paterno: str | None
    apellido_materno: str | None
    nombre_completo: str | None
    direccion: str | None
    direccion_completa: str | None

class JsonPeRucData(BaseModel):
    ruc: str
    nombre_o_razon_social: str | None
    direccion: str | None
    direccion_completa: str | None
    distrito: str | None
    provincia: str | None
    departamento: str | None
```

### 4.6 Schemas de contrato con frontend (`modules/consultas/schemas.py`)

```python
class DocumentoLookupRequest(BaseModel):
    tipo_documento: Literal["DNI", "RUC"]
    numero_documento: str  # 8 (DNI) o 11 (RUC) dígitos numéricos

class DocumentoLookupResult(BaseModel):
    tipo_documento: str
    numero_documento: str
    nombres: str | None = None              # DNI
    apellidos: str | None = None            # DNI (paterno + materno)
    razon_social: str | None = None         # RUC empresa
    direccion_fiscal: str | None = None     # RUC (normalmente)
    origen: Literal["api", "cache"]
    ya_tiene_datos: bool                    # True si el usuario ya tenía datos en BD
```

### 4.7 `ConsultasService`

```python
class ConsultasService:
    def __init__(self, session, redis, jsonpe_client, user_id): ...

    async def consultar_documento(
        self, tipo: str, numero: str
    ) -> DocumentoLookupResult:
        # 1. Validar formato (8/11 dígitos)
        # 2. ya_tiene_datos = SELECT DatosFiscales WHERE id_usuario = user_id AND es_predeterminado
        # 3. cache_key = f"jsonpe:{tipo.lower()}:{numero}"
        # 4. cached = await redis.get(cache_key)
        # 5. Si cached → origen="cache", devolver
        # 6. data = await jsonpe_client.consultar_{tipo}(numero)
        # 7. Normalizar data → DocumentoLookupResult
        # 8. await redis.setex(cache_key, ttl, result.json())
        # 9. Devolver (NO persistir en BD)
```

**Heurística de RUC persona natural vs empresa:**
- Si el RUC empieza con `10` → persona natural: splitear `nombre_o_razon_social` a `nombres`+`apellidos`, dejar `razon_social=None`.
- Si empieza con `15`, `20`, etc. → empresa: va todo a `razon_social`, dejar `nombres`/`apellidos` en None.

### 4.8 Router

```python
@router.post("/documento", response_model=APIResponse[DocumentoLookupResult])
@_limiter.limit("10/minute", key_func=lambda req: req.state.user_id)
async def lookup_documento(
    payload: DocumentoLookupRequest,
    current_user: AuthUser,
    service: ConsultasServiceDep,
):
    """Consulta DNI/RUC contra json.pe (con cache Redis).
    No persiste — solo devuelve datos para rellenar el formulario."""
    result = await service.consultar_documento(
        payload.tipo_documento, payload.numero_documento
    )
    return APIResponse.success(result)
```

### 4.9 Manejo de errores

| Caso | HTTP | Mensaje al frontend |
|---|---|---|
| Token no configurado | 503 | "Servicio de consulta no disponible. Ingresa los datos manualmente." |
| Timeout o json.pe caído | 504 | "El servicio de consulta tardó demasiado. Inténtalo de nuevo o ingresa los datos manualmente." |
| DNI/RUC no existe (404 de json.pe) | 404 | "El documento no fue encontrado en RENIEC/SUNAT. Verifica el número." |
| Formato inválido (no 8/11 dígitos) | 422 | Validación automática Pydantic |
| Rate limit (10/min por usuario) | 429 | "Has alcanzado el límite de consultas. Inténtalo más tarde." |
| Otro error 4xx de json.pe | 502 | "Error al consultar el servicio externo." |

### 4.10 Seguridad

- `AuthUser` (JWT) requerido en el endpoint.
- Rate limiting slowapi: **10 consultas por minuto por usuario**. Implementación: un Limiter local en el router con `key_func` personalizada que extrae `current_user.user_id` del request state (inyectado vía dependency), evitando colisionar con el rate-limit global por IP.
- Logging estructurado de cada consulta (info: tipo+numero+origen; warning: errores json.pe).
- No se loggea el token ni datos sensibles más allá del documento (que ya es el input del usuario).

## 5. Frontend — Estructura detallada

### 5.1 Archivos nuevos

```
_frontEnd/src/features/consultas/
├── api/
│   └── consultasApi.ts             # POST /api/v1/consultas/documento
├── hooks/
│   └── useConsultarDocumento.ts    # useMutation TanStack
└── types.ts                        # DocumentoLookupResult, DocumentoLookupRequest

_frontEnd/src/features/profile/components/
└── DatosFiscalesSection.tsx        # Sección para ProfileInfoPage
```

### 5.2 Archivos existentes a editar

| Archivo | Cambio |
|---|---|
| `features/profile/pages/ProfileInfoPage.tsx` | Importar y montar `<DatosFiscalesSection />` debajo del form de info personal |
| `features/cart/components/PaymentModal.tsx` | En Step 1 añadir botón "🔍 Consultar" + rellenar inputs; en Step 2 añadir botón "Usar esta dirección para envío" cuando aplique |

### 5.3 API client (`consultasApi.ts`)

```typescript
export const consultasApi = {
  lookupDocumento: async (
    tipo: 'DNI' | 'RUC',
    numero: string
  ): Promise<DocumentoLookupResult> => {
    const { data } = await api.post('/consultas/documento', {
      tipo_documento: tipo,
      numero_documento: numero,
    })
    return data.data // APIResponse<T> envelope
  },
}
```

### 5.4 Hook `useConsultarDocumento`

```typescript
export function useConsultarDocumento() {
  return useMutation({
    mutationFn: ({ tipo, numero }) => consultasApi.lookupDocumento(tipo, numero),
    onError: (err) => {
      const msg = err.response?.data?.error?.message
        || 'No se pudo consultar el documento. Ingrésalo manualmente.'
      toast.error(msg)
    },
  })
}
```

### 5.5 Componente `DatosFiscalesSection`

```
┌─────────────────────────────────────────────────────┐
│ DATOS FISCALES                            [Editar]  │
├─────────────────────────────────────────────────────┤
│ (Vista lectura - si ya tiene datos guardados)       │
│ Tipo: DNI          Número: 12345678                 │
│ Nombres: María García                               │
│ [Editar]                                            │
├─────────────────────────────────────────────────────┤
│ (Vista edición)                                     │
│ Tipo de documento:  [DNI ▼]                         │
│ Número:             [__________]  [🔍 Consultar]    │
│ Nombres:            [autocompleta tras consulta]    │
│ Apellidos:          [autocompleta tras consulta]    │
│ Razón social:       [autocompleta si RUC]           │
│ Dirección fiscal:   [autocompleta si RUC]           │
│                                                     │
│           [Cancelar]   [Guardar cambios]            │
└─────────────────────────────────────────────────────┘
```

**Lógica:**
1. Al montar, llama a `useDatosFiscales()` y `useProfileData()`.
2. Si `fiscalData` existe → vista de lectura con botón "Editar".
3. Al editar, el form carga los datos actuales como defaults.
4. Botón "Consultar" dispara `useConsultarDocumento({tipo, numero})`. Solo se habilita cuando el número tiene longitud válida (8 o 11).
5. Tras respuesta exitosa, rellena los inputs con los datos normalizados (no avanza ni persiste).
6. Botón "Guardar cambios" ejecuta `useUpsertDatosFiscales` y, si corresponde, `useUpdateProfile` (nombres/apellidos cuando DNI, dirección fiscal cuando RUC también se guarda en `direccion_fiscal`).

### 5.6 Modificación en `PaymentModal.tsx` — Step 1

Añadir al lado del input "Número de Documento" el botón **"🔍 Consultar"**:

```
STEP 1: DATOS FISCALES
Tipo de documento:  [DNI ▼]
Número:             [__________]  [🔍 Consultar]
Nombres*:            [________________________]
Apellidos*:          [________________________]
Razón social*:       [________________________]   ← solo con RUC
Dirección fiscal*:   [________________________]
```

- La consulta NO avanza al siguiente paso. El usuario revisa y luego "Guardar y continuar".
- Botón "Consultar" solo se habilita con longitud válida (8/11).

### 5.7 Modificación en `PaymentModal.tsx` — Step 2

Cuando en Step 1 se consultó un **RUC** que trajo `direccion_completa`, en Step 2 aparece un banner con botón **"Usar esta dirección para envío"**:

```
STEP 2: Envío
┌──────────────────────────────────────────────────┐
│ 💡 Detectamos la dirección fiscal de tu RUC:     │
│     "PJ. JORGE BASADRE 158, LIMA - SANTA ANITA"  │
│     [Usar esta dirección para envío]             │
├──────────────────────────────────────────────────┤
│ Dirección:     [_____________________________]   │
│ Referencia:    [_____________________________]   │
│ Teléfono:      [_____________________________]   │
└──────────────────────────────────────────────────┘
```

- El botón copia la dirección fiscal al input "Dirección" pero no autoavanza.
- El usuario puede editar antes de "Guardar y continuar".

### 5.8 Mapeo de campos API → form

| Campo API json.pe | Campo en el form | Notas |
|---|---|---|
| `data.nombres` | Nombres | Solo DNI |
| `data.apellido_paterno + " " + apellido_materno` | Apellidos | Solo DNI |
| `data.nombre_o_razon_social` | Razón social (empresa) **o** Nombres+Apellidos (persona) | RUC. Heurística prefijo `10` = persona |
| `data.direccion_completa` | Dirección fiscal | Solo RUC |
| `data.direccion` (RUC) | Sugerencia para dirección de envío | Botón explícito "Usar esta dirección" |

## 6. Flujos de extremo a extremo

### 6.1 Diagrama de secuencia — Consulta de DNI en checkout

```
Usuario        Frontend              Backend                Redis             json.pe
  │              │                      │                    │                   │
  │─ click ─────▶│                      │                    │                   │
  │  "Consultar" │                      │                    │                   │
  │              │─ POST /consultas/documento ─▶│            │                   │
  │              │  {DNI, 12345678}     │                    │                   │
  │              │                      │─ GET usuario.datos_fiscales (BD)        │
  │              │                      │  ← null (no tiene) │                   │
  │              │                      │─ GET jsonpe:dni:12345678 ─▶            │
  │              │                      │  ← miss            │                   │
  │              │                      │─ POST /api/dni (Bearer) ──────────────▶│
  │              │                      │  ◀──── {nombres, apellidos} ───────────│
  │              │                      │─ SET jsonpe:dni:12345678 (TTL 24h) ─▶  │
  │              │                      ◀── DocumentoLookupResult                │
  │              │                      │  {nombres, apellidos, origen:"api",    │
  │              │                      │   ya_tiene_datos: false}               │
  │              │◀─────────────────────│                    │                   │
  │ rellena form │                      │                    │                   │
  │◀─────────────│                      │                    │                   │
  │              │                      │                    │                   │
  │─ "Guardar" ─▶│                      │                    │                   │
  │              │─ POST /auth/me/datos-fiscales (upsert) ─▶  │                   │
  │              │  {tipo:DNI, numero, ...}                  │                   │
  │              │                      │  INSERT/UPDATE en BD                   │
  │              │◀─────────────────────│                    │                   │
```

### 6.2 Flujo de "datos ya existentes" (sin consulta API)

1. ProfileInfoPage monta `<DatosFiscalesSection />`.
2. `useDatosFiscales()` devuelve el dato guardado en BD.
3. Renderiza vista de lectura con sus datos actuales (sin llamar a la API).
4. Botón "Editar" → entra en modo edición.
5. En modo edición el form se rellena con datos actuales; botón "Consultar" disponible pero NO automático.
6. El usuario puede: (a) editar manualmente y guardar; (b) hacer "Consultar" para refrescar y luego guardar.
7. El endpoint `/consultas/documento` SIEMPRE:
   - Chequea BD primero (para informar `ya_tiene_datos`).
   - Va a cache/API solo cuando el usuario explícitamente llama al endpoint.
   - NUNCA sobreescribe la BD sin el "Guardar" del usuario.

### 6.3 Estados visuales del botón "Consultar"

| Estado | Botón | Input número |
|---|---|---|
| Deshabilitado | `[🔍 Consultar]` | < 8 (DNI) o < 11 (RUC) dígitos |
| Listo | `[🔍 Consultar]` | longitud válida |
| Cargando | `[⏳ Consultando...]` | bloqueado, spinner |
| Éxito | `[✓ Consultado]` | campos rellenos, toast verde |
| Error | `[🔍 Consultar]` | campos vacíos, toast rojo con msg |

## 7. Testing

### 7.1 Backend (pytest)

| Tipo | Archivo | Qué cubre |
|---|---|---|
| Unit | `test_jsonpe_client.py` | Mocks de httpx: DNI ok, RUC ok, 404, timeout, sin token |
| Unit | `test_consultas_service.py` | Cache hit/miss, BD con datos, normalización, heurística persona/empresa |
| Integration | `test_consultas_router.py` | Endpoint con Redis real + httpx mockeado, rate limit, AuthUser |

### 7.2 Frontend

- `useConsultarDocumento.test.ts` — estados success/error del mutation.
- `DatosFiscalesSection.test.tsx` — renderiza vista lectura/edición según `fiscalData`.

### 7.3 Casos edge

| Caso | Comportamiento esperado |
|---|---|
| DNI con dirección vacía (común en RENIEC) | `direccion_fiscal` queda null, usuario la llena manualmente |
| RUC con estado "BAJA" o "SUSPENSIÓN" | Igual se devuelve (no filtramos por estado) |
| Documento con datos distintos a los que ya tenía | El form se rellena con lo nuevo; el usuario decide si guardar |
| Cache hit 24h después | Cache miss → consulta fresca |
| API caída | Toast claro + formulario en modo manual |
| Usuario anónimo intenta llamar `/consultas/documento` | 401 (AuthUser Required) |
| Rate limit (10/min) | 429 con mensaje "Has alcanzado el límite..." |

## 8. Fuera de alcance (YAGNI)

- ❌ Endpoint de búsqueda por razón social (json.pe lo ofrece pero no se necesita).
- ❌ Webhook o actualización automática de datos existentes.
- ❌ Cache adicional en el frontend (TanStack staleTime normal es suficiente).
- ❌ Endpoint `/dni-ruc` (sugerir RUC al poner DNI) — fuera de alcance por ahora.
- ❌ Filtrado de RUCs por estado/condición del contribuyente.

## 9. Documentación

- Actualizar `_backEnd/ARCHITECTURE.md` con el nuevo módulo `consultas` y la carpeta `shared/external/`.
- Añadir sección "Consulta de DNI/RUC" al README principal explicando el flujo y las variables `.env`.

## 10. Resumen de decisiones (todas aprobadas)

1. ✅ Token solo en backend (`JSONPE_API_TOKEN` en `.env`).
2. ✅ Botón "Consultar" explícito (no automático al completar longitud).
3. ✅ Cache Redis 24h + chequeo BD antes de consultar.
4. ✅ Rellena: nombres/apellidos (DNI), razón social + dirección fiscal (RUC).
5. ✅ Copiar dirección del RUC a dirección de envío con botón explícito en checkout.
6. ✅ Sección "Datos Fiscales" dentro de ProfileInfoPage (no pestaña aparte).
7. ✅ Consultar → rellena form → "Guardar" persiste (no auto-guarda).
8. ✅ Arquitectura: `shared/external/jsonpe/` + módulo `consultas` + endpoint `POST /consultas/documento`.

## 11. Endpoints

### Nuevos

- `POST /api/v1/consultas/documento` — consulta json.pe con cache Redis, NO persiste.

### Reutilizados sin cambios

- `GET /api/v1/auth/me/datos-fiscales`
- `POST /api/v1/auth/me/datos-fiscales` (upsert)
- `PUT /api/v1/auth/me`

## 12. Estimación

- **Archivos nuevos:** ~10
- **Archivos editados:** ~5
- **Líneas estimadas:** ~600
- **Endpoints nuevos:** 1
