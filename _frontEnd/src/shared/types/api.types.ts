/** Respuesta estándar de la API Mitrufely */
export interface ApiResponse<T> {
  data: T
  message: string
  success: boolean
}

/** Respuesta paginada estándar */
export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    perPage: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  message: string
  success: boolean
}

/** Error estándar de la API */
export interface ApiError {
  message: string
  statusCode: number
  errors?: Record<string, string[]>
}

/** Parámetros comunes de paginación y filtrado */
export interface PaginationParams {
  page?: number
  perPage?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}
