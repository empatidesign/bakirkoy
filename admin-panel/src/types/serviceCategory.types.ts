export interface ServiceCategory {
  id: string
  name: string
  description?: string
  color: string
  companyCount: number
  isActive: boolean
}

export interface ServiceCategoryForm {
  name: string
  description: string
  color: string
}

export interface ServiceCategoryRef {
  id: string
  name: string
  color: string
}

export const SERVICE_CATEGORY_PALETTE = [
  '#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#ca8a04',
]
