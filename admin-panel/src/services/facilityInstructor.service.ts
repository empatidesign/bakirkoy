import { api } from './api'
import type { PagedResult } from '@/types/common'

export interface FacilityInstructor {
  id: string
  module: string
  facilityId?: string
  branchId?: string
  fullName: string
  phone?: string
  email?: string
  specialization?: string
  isActive: boolean
  createdAt: string
}

export interface FacilityInstructorForm {
  facilityId?: string
  branchId?: string
  fullName: string
  phone?: string
  email?: string
  specialization?: string
}

export interface FacilityInstructorOption {
  value: string
  label: string
}

const facilityInstructorService = {
  async getList(module: string, params?: Record<string, unknown>): Promise<PagedResult<FacilityInstructor>> {
    const res = await api.get<{ data: PagedResult<FacilityInstructor> }>(`/${module}/instructors`, { params })
    return res.data.data
  },

  async getOptions(module: string): Promise<FacilityInstructorOption[]> {
    const res = await api.get<{ data: FacilityInstructorOption[] }>(`/${module}/instructors/options`)
    return res.data.data
  },

  async create(module: string, data: FacilityInstructorForm): Promise<FacilityInstructor> {
    const res = await api.post<{ data: FacilityInstructor }>(`/${module}/instructors`, data)
    return res.data.data
  },

  async update(module: string, id: string, data: FacilityInstructorForm): Promise<FacilityInstructor> {
    const res = await api.put<{ data: FacilityInstructor }>(`/${module}/instructors/${id}`, data)
    return res.data.data
  },

  async delete(module: string, id: string): Promise<void> {
    await api.delete(`/${module}/instructors/${id}`)
  },
}

export default facilityInstructorService
