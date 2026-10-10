import { api } from './api'
import type { PagedResult } from '@/types/common'

export interface FacilityRegistration {
  id: string
  module: string
  groupId: string
  groupName: string
  participantId: string
  participantName: string
  status: 'Active' | 'Waitlist' | 'Cancelled' | 'Completed'
  statusLabel: string
  registeredAt: string
  startDate?: string
  endDate?: string
  notes?: string
}

export interface FacilityRegistrationForm {
  groupId: string
  participantId: string
  notes?: string
}

const facilityRegistrationService = {
  async getList(module: string, params?: Record<string, unknown>): Promise<PagedResult<FacilityRegistration>> {
    const res = await api.get<{ data: PagedResult<FacilityRegistration> }>(`/${module}/registrations`, { params })
    return res.data.data
  },

  async create(module: string, data: FacilityRegistrationForm): Promise<FacilityRegistration> {
    const res = await api.post<{ data: FacilityRegistration }>(`/${module}/registrations`, data)
    return res.data.data
  },

  async update(module: string, id: string, data: Partial<FacilityRegistrationForm>): Promise<FacilityRegistration> {
    const res = await api.put<{ data: FacilityRegistration }>(`/${module}/registrations/${id}`, data)
    return res.data.data
  },

  async updateStatus(module: string, id: string, status: string, notes?: string): Promise<FacilityRegistration> {
    const res = await api.patch<{ data: FacilityRegistration }>(`/${module}/registrations/${id}/status`, { status, notes })
    return res.data.data
  },

  async delete(module: string, id: string): Promise<void> {
    await api.delete(`/${module}/registrations/${id}`)
  },
}

export default facilityRegistrationService
