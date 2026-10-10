export interface ApiResponse<T> {
  success: boolean
  statusCode: number
  message?: string
  errorCode?: string
  data?: T
  errors?: Record<string, string[]>
  timestamp: string
  correlationId?: string
}

export interface PagedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ListParams {
  page: number
  limit: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  [key: string]: unknown
}

export type SortOrder = 'asc' | 'desc'

export interface SelectOption {
  value: string
  label: string
}
