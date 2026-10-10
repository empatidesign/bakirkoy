import { api } from './api'
import type { PagedResult } from '@/types/common'

export interface FacilityBranch {
  id: string
  module: string
  name: string
  code: string
  description?: string
  isActive: boolean
  createdAt: string
}

export interface FacilityBranchForm {
  name: string
  code: string
  description?: string
}

export interface FacilityBranchOption {
  value: string
  label: string
}

const facilityBranchService = {
  async getList(module: string, params?: Record<string, unknown>): Promise<PagedResult<FacilityBranch>> {
    const res = await api.get<{ data: PagedResult<FacilityBranch> }>(`/${module}/branches`, { params })
    return res.data.data
  },

  async getOptions(module: string): Promise<FacilityBranchOption[]> {
    const res = await api.get<{ data: FacilityBranchOption[] }>(`/${module}/branches/options`)
    return res.data.data
  },

  async create(module: string, data: FacilityBranchForm): Promise<FacilityBranch> {
    const res = await api.post<{ data: FacilityBranch }>(`/${module}/branches`, data)
    return res.data.data
  },

  async update(module: string, id: string, data: FacilityBranchForm): Promise<FacilityBranch> {
    const res = await api.put<{ data: FacilityBranch }>(`/${module}/branches/${id}`, data)
    return res.data.data
  },

  async delete(module: string, id: string): Promise<void> {
    await api.delete(`/${module}/branches/${id}`)
  },
}

export default facilityBranchService
