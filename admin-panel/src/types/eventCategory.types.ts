export interface EventCategory {
  id: string
  name: string
  description?: string
  color: string
  defaultPoints: number
  eventCount: number
  isActive: boolean
}

export interface EventCategoryForm {
  name: string
  description: string
  color: string
  defaultPoints: number
}

export interface EventCategoryBulkResultItem {
  index: number
  name: string
  success: boolean
  id: string | null
  error: string | null
}

export interface EventCategoryOption {
  value: string
  label: string
  defaultPoints: number
}
