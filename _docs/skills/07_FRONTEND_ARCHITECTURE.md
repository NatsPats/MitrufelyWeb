# SKILL 07 — Arquitectura Frontend (React 19 + Vite + TypeScript)

> **CUÁNDO USAR:** Antes de crear componentes, páginas, hooks, stores o configurar rutas en el frontend.

---

## 1. Stack Tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework UI | React | 19 |
| Build Tool | Vite | latest |
| Tipado | TypeScript | strict |
| Estilos | Tailwind CSS | v4 |
| Componentes Primitivos | Radix UI | latest |
| Routing | React Router | v7 |
| Estado Global | Zustand | v5 |
| Estado del Servidor | TanStack React Query | v5 |
| HTTP Client | Axios | latest |
| Forms | React Hook Form + Zod | latest |
| Charts | Recharts | latest |
| Íconos | Lucide React | latest |

---

## 2. Estructura de Directorios

```
_frontEnd/src/
├── main.tsx                     # Entry point
├── app/
│   ├── App.tsx                  # Router root + QueryClient + Providers
│   ├── routes/                  # Configuración de rutas (React Router v7)
│   │   ├── index.tsx            # Route tree
│   │   ├── ProtectedRoute.tsx   # Guarda de autenticación
│   │   └── RoleGuard.tsx        # Guarda de rol
│   └── providers/
│       └── index.tsx            # QueryClientProvider + ToastProvider
├── pages/
│   ├── public/                  # Sin auth requerida
│   │   ├── HomePage.tsx
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   ├── client/                  # Rol: CLIENTE
│   │   ├── CatalogPage.tsx
│   │   ├── CartPage.tsx
│   │   ├── CheckoutPage.tsx
│   │   ├── OrdersPage.tsx
│   │   └── CriptoTrufasPage.tsx
│   └── admin/                   # Rol: ADMIN
│       ├── DashboardPage.tsx
│       ├── InventoryPage.tsx
│       ├── OrdersManagePage.tsx
│       └── ReportsPage.tsx
├── features/                    # Lógica por dominio (co-localizada)
│   ├── auth/
│   │   ├── hooks/               # useAuth, useLogin, useRegister
│   │   ├── api/                 # authApi.ts (Axios calls)
│   │   └── store/               # authStore.ts (Zustand)
│   ├── products/
│   │   ├── hooks/               # useProducts, useProductDetail
│   │   ├── api/                 # productsApi.ts
│   │   └── components/          # ProductCard, ProductGrid
│   ├── cart/
│   │   ├── store/               # cartStore.ts (Zustand)
│   │   └── components/          # CartDrawer, CartItem
│   ├── orders/
│   │   ├── hooks/               # useCheckout, useOrders
│   │   ├── api/                 # ordersApi.ts
│   │   └── components/
│   ├── inventory/
│   ├── CriptoTrufas/
│   └── dashboard/
├── shared/
│   ├── components/              # UI genérica reusable
│   │   ├── ui/                  # Button, Input, Badge, Modal...
│   │   ├── layout/              # AppShell, Navbar, Sidebar
│   │   └── feedback/            # LoadingSpinner, EmptyState, ErrorBoundary
│   ├── hooks/                   # useDebounce, usePagination, useMediaQuery
│   ├── lib/
│   │   ├── axios.ts             # Axios instance + interceptors
│   │   └── queryClient.ts       # QueryClient config
│   └── types/                   # Tipos globales TypeScript
│       ├── api.types.ts         # APIResponse<T>, PaginatedResponse<T>
│       └── enums.ts             # Mirrors de enums del backend
└── assets/
```

---

## 3. Gestión de Estado — Patrón Híbrido

### 3.1 Zustand — Estado del Cliente (Síncrono)

**Cuándo usar Zustand:**
- Carrito de compras (items, cantidades, totales)
- Sesión del usuario (datos del JWT decodificado)
- UI state global (sidebar, modales activos, tema)

```typescript
// features/cart/store/cartStore.ts
interface CartItem {
  id_producto: number;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  imagen_url: string | null;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id_producto: number) => void;
  updateQuantity: (id_producto: number, cantidad: number) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) => set((state) => {
        const exists = state.items.find(i => i.id_producto === item.id_producto);
        if (exists) {
          return { items: state.items.map(i =>
            i.id_producto === item.id_producto
              ? { ...i, cantidad: i.cantidad + item.cantidad }
              : i
          )};
        }
        return { items: [...state.items, item] };
      }),
      // ...
      total: () => get().items.reduce((acc, i) => acc + i.precio_unitario * i.cantidad, 0),
    }),
    { name: "mytrufely-cart" }
  )
);
```

### 3.2 TanStack React Query — Estado del Servidor (Asíncrono)

**Cuándo usar React Query:**
- Catálogo de productos (caché, refetch automático)
- Saldo de CriptoTrufas
- Lista de órdenes del cliente
- Inventario y Kardex (admin)
- Cualquier dato que viene del backend

```typescript
// features/products/hooks/useProducts.ts
export const useProducts = (params: ProductFilters) => {
  return useQuery({
    queryKey: ["products", params],
    queryFn: () => productsApi.getAll(params),
    staleTime: 5 * 60 * 1000, // 5 minutos para el catálogo
  });
};

// Invalidar cache tras una acción
const queryClient = useQueryClient();
const checkoutMutation = useMutation({
  mutationFn: ordersApi.checkout,
  onSuccess: (data) => {
    // Invalidar saldo, órdenes y stock tras compra exitosa
    queryClient.invalidateQueries({ queryKey: ["CriptoTrufas", "balance"] });
    queryClient.invalidateQueries({ queryKey: ["orders"] });
    queryClient.invalidateQueries({ queryKey: ["products"] }); // stock puede haber cambiado
    useCartStore.getState().clearCart();
  },
});
```

---

## 4. Axios — Instancia y Interceptores

```typescript
// shared/lib/axios.ts
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // "http://localhost:8000/api/v1"
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// REQUEST interceptor: inyectar Bearer token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// RESPONSE interceptor: refresh automático en 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const { data } = await axios.post("/api/v1/auth/refresh", { refresh_token: refreshToken });
          useAuthStore.getState().setAccessToken(data.data.access_token);
          // Re-ejecutar request original
          error.config!.headers.Authorization = `Bearer ${data.data.access_token}`;
          return api(error.config!);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
```

---

## 5. Routing — React Router v7

```typescript
// app/routes/index.tsx
export const router = createBrowserRouter([
  {
    path: "/",
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "login", element: <LoginPage /> },
      { path: "register", element: <RegisterPage /> },
    ],
  },
  {
    path: "/shop",
    element: <ProtectedRoute><ClientLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <CatalogPage /> },
      { path: "cart", element: <CartPage /> },
      { path: "checkout", element: <CheckoutPage /> },
      { path: "orders", element: <OrdersPage /> },
      { path: "sweet-coins", element: <CriptoTrufasPage /> },
    ],
  },
  {
    path: "/admin",
    element: <RoleGuard roles={["ADMIN"]}><AdminLayout /></RoleGuard>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "orders", element: <OrdersManagePage /> },
    ],
  },
]);
```

```typescript
// app/routes/ProtectedRoute.tsx
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// app/routes/RoleGuard.tsx
export function RoleGuard({ children, roles }: { children: ReactNode; roles: string[] }) {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

---

## 6. Formularios — React Hook Form + Zod

```typescript
// Ejemplo: formulario de datos fiscales
const datosFiscalesSchema = z.object({
  tipo_documento: z.enum(["DNI", "RUC"]),
  numero_documento: z.string()
    .refine((val, ctx) => {
      if (ctx.parent.tipo_documento === "DNI") return /^\d{8}$/.test(val);
      if (ctx.parent.tipo_documento === "RUC") return /^\d{11}$/.test(val);
      return false;
    }, "Número de documento inválido para el tipo seleccionado"),
  razon_social: z.string().optional(),
  es_predeterminado: z.boolean().default(false),
});

type DatosFiscalesForm = z.infer<typeof datosFiscalesSchema>;

const { register, handleSubmit, watch, formState: { errors } } =
  useForm<DatosFiscalesForm>({ resolver: zodResolver(datosFiscalesSchema) });
```

---

## 7. Tipos TypeScript Globales

```typescript
// shared/types/api.types.ts
export interface APIResponse<T> {
  success: boolean;
  data: T;
  message: string | null;
}

export interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
  };
  request_id: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// shared/types/enums.ts (mirrors de los ENUMs del backend)
export type EstadoVenta = "PENDIENTE" | "PAGADO" | "ENTREGADO" | "ANULADO";
export type EstadoLote = "VIGENTE" | "AGOTADO" | "VENCIDO";
export type TipoPago = "EFECTIVO" | "YAPE" | "TRANSFERENCIA";
export type TipoMovimientoStock =
  | "INGRESO_COMPRA" | "VENTA" | "AJUSTE_POSITIVO"
  | "AJUSTE_NEGATIVO" | "MERMA" | "VENCIMIENTO" | "DEVOLUCION";
```

---

## 8. Dashboards Analíticos — Recharts

```typescript
// Ejemplo: gráfico de ventas por día
<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={ventasDiarias}>
    <defs>
      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
    <XAxis dataKey="fecha" stroke="#9ca3af" />
    <YAxis stroke="#9ca3af" />
    <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "none" }} />
    <Area type="monotone" dataKey="total" stroke="#8b5cf6" fill="url(#colorTotal)" />
  </AreaChart>
</ResponsiveContainer>
```

---

## 9. Variables de Entorno Vite

```env
# _frontEnd/.env
VITE_API_URL=http://localhost:8000/api/v1
VITE_APP_NAME=Mytrufely
```

Acceso en código: `import.meta.env.VITE_API_URL`
