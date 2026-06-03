# Fase 1: Autenticación, Registro y Seguridad (Completado)

Esta fase establece el núcleo de identidad, seguridad y roles en el ecosistema **MitrufelyWeb**, permitiendo accesos seguros mediante flujos tradicionales (email/contraseña con verificación) y flujos sociales modernos (Google Sign-In).

---

## 📂 Entidades y Base de Datos (PostgreSQL - M02)

Se modificó el esquema de la base de datos física para admitir autenticaciones externas y mejorar la seguridad:

```sql
-- M02 Usuarios y Roles (NeonDB)
ALTER TABLE usuarios ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE usuarios ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local';
ALTER TABLE usuarios ADD COLUMN google_sub VARCHAR(255) UNIQUE;
```

### Modelos SQLAlchemy ORM (`app/infrastructure/database/models/usuarios.py`)
- `Usuario`: Mapeado con campos nullable `password_hash` y `google_sub` para compatibilidad de OAuth, y `auth_provider` (`local` o `google`).
- `Rol`: Conexión de 1-a-Muchos con `Usuario` basada en el enum `TipoRolEnum` ('ADMIN', 'CLIENTE').
- `Cliente`: Perfil extendido 1-a-1 de `Usuario` para el rol de cliente, creado de manera atómica y transaccional durante el registro.

---

## 🔒 Parches de Seguridad de Producción (Backend)

Durante esta fase, se auditaron y corrigieron 5 debilidades de seguridad críticas:

1. **Validación de Audiencia de Google Mandatoria**: Falla fast si `GOOGLE_CLIENT_ID` no está configurado en el servidor o si el token proviene de otra aplicación de terceros (confusión de tokens).
2. **Refresh Token Rotation (RTR)**: Cada token de refresco lleva un `jti` único (UUID). Al usarse para renovar sesión, el `jti` se guarda en Redis con el TTL restante. Si se intenta reusar → se bloquea como replay attack.
3. **Rate Limiting por IP**: El endpoint `/auth/login` está protegido con un contador en Redis de máximo 5 intentos en 60 segundos por IP, mitigando ataques de fuerza bruta y denegación de servicio (DoS) por `bcrypt`.
4. **Reducción de TTL de Verificación**: Los tokens para activación de cuenta vía email tienen un TTL de **2 horas** (reducido de 24h) para reducir ventanas de intercepción.
5. **Lista de Bloqueo en Logout (Redis)**: Al hacer `/auth/logout`, el token de acceso se almacena en la caché de Redis (`token_blocklist:{token}`) con su TTL restante para invalidarlo inmediatamente en producción.

---

## 🖥️ Flujos y Pantallas en el Frontend

La experiencia de usuario está diseñada con estética premium, colores HSL armoniosos (naranjas pastel y borgoña repostería), micro-animaciones en Framer Motion y notificaciones reactivas (Sonner).

1. **Página de Iniciar Sesión (`LoginPage.tsx`)**: Formulario interactivo con validaciones React Hook Form + Zod, soporte de errores dinámicos por Rate Limiting (HTTP 429) y botón de inicio de sesión con Google.
2. **Página de Registro (`RegisterPage.tsx`)**: Flujo intuitivo que crea la cuenta e informa al usuario sobre el envío del correo de verificación con una vigencia de 2 horas.
3. **Página de Verificación de Cuenta (`VerifyPage.tsx`)**: Pantalla que interactúa asíncronamente con el backend de FastAPI usando `useVerifyAccount` (React Query) al hacer clic en el correo, cargando de forma fluida y confirmando con un premio de 1000 CriptoTrufas de bienvenida.
4. **Callback de Autenticación de Google (`AuthCallbackPage.tsx`)**: 
   - **Garantía Strict Mode:** Implementa un control con `useRef(false)` (`hasCalled`) para evitar que la doble invocación de efectos de desarrollo provoque llamadas concurrentes e inserciones duplicadas (condición de carrera) en NeonDB.
   - Extrae el nombre real del usuario de Gmail directamente del JWT en la raíz del payload (`decoded.nombres` y `decoded.apellidos`) para personalizar la barra de navegación pública.

---

## 🔬 Calidad de Código y Validación

Toda la implementación en el Frontend cumple los estándares de producción más estrictos:
- **Linting de Estilos (`npm run lint`)**: **0 advertencias, 0 errores (ESLint limpio)**.
- **Compilación de Producción (`npm run build`)**: **Bundle construido con éxito (Vite + Rolldown)**.
- **Tipado estricto**: No se utilizan casts genéricos de tipo `any`.
