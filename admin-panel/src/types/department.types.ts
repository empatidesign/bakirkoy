export interface Department {
  id: string
  name: string
  description?: string
  isActive: boolean
  assignedUserCount: number
  createdAt: string
}

export interface DepartmentOption {
  id: string
  name: string
}

export interface DepartmentListParams {
  page: number
  limit: number
  search?: string
  isActive?: boolean | ''
}

export interface CreateDepartmentRequest {
  name: string
  description?: string
}

export interface UpdateDepartmentRequest {
  name: string
  description?: string
}
