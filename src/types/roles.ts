/** Roles RBAC del sistema Mitrufely */
export const Role = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  BAKER: 'baker',
  CASHIER: 'cashier',
  CUSTOMER: 'customer',
} as const

export type Role = (typeof Role)[keyof typeof Role]

/** Mapa de permisos por feature */
export const PERMISSIONS = {
  // Dashboard
  VIEW_ANALYTICS: [Role.ADMIN, Role.MANAGER] as Role[],

  // Inventario
  VIEW_INVENTORY: [Role.ADMIN, Role.MANAGER, Role.BAKER] as Role[],
  MANAGE_INVENTORY: [Role.ADMIN, Role.MANAGER] as Role[],

  // Pedidos
  VIEW_ORDERS: [Role.ADMIN, Role.MANAGER, Role.CASHIER] as Role[],
  MANAGE_ORDERS: [Role.ADMIN, Role.MANAGER, Role.CASHIER] as Role[],
  CREATE_ORDER: [Role.ADMIN, Role.MANAGER, Role.CASHIER, Role.CUSTOMER] as Role[],

  // Reportes
  VIEW_REPORTS: [Role.ADMIN, Role.MANAGER] as Role[],
  EXPORT_REPORTS: [Role.ADMIN, Role.MANAGER] as Role[],

  // SweetCoins
  VIEW_SWEETCOINS: [Role.ADMIN, Role.MANAGER, Role.CUSTOMER] as Role[],
  MANAGE_SWEETCOINS: [Role.ADMIN, Role.MANAGER] as Role[],

  // Usuarios
  MANAGE_USERS: [Role.ADMIN] as Role[],
} satisfies Record<string, Role[]>

export type Permission = keyof typeof PERMISSIONS
