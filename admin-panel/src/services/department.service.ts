import { api } from './api'
import type { PagedResult } from '@/types/common'
import type {
  Department,
  DepartmentOption,
  CreateDepartmentRequest,
  UpdateDepartmentRequest,
} from '@/types/department.types'

const departmentService = {
  async getList(params: Record<string, unknown>): Promise<PagedResult<Department>> {
    const res = await api.get<{ data: PagedResult<Department> }>('/departments', { params })
    return res.data.data
  },

  async getOptions(): Promise<DepartmentOption[]> {
    const res = await api.get<{ data: DepartmentOption[] }>('/departments/options')
    return res.data.data
  },

  async create(data: CreateDepartmentRequest): Promise<Department> {
    const res = await api.post<{ data: Department }>('/departments', data)
    return res.data.data
  },

  async update(id: string, data: UpdateDepartmentRequest): Promise<Department> {
    const res = await api.put<{ data: Department }>(`/departments/${id}`, data)
    return res.data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/departments/${id}`)
  },

  async toggleStatus(id: string): Promise<Department> {
    const res = await api.patch<{ data: Department }>(`/departments/${id}/toggle-status`)
    return res.data.data
  },
}

export default departmentService
