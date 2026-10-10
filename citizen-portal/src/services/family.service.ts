import { api } from './api'
import type { CitizenChild, CitizenFamilyNviPreview, CitizenFamilyConfirmResult } from '@/types/family.types'
import type { CitizenTokenPair } from '@/types/auth.types'

const familyService = {
  async getChildren(): Promise<CitizenChild[]> {
    const res = await api.get<{ data: CitizenChild[] }>('/auth/citizen/children')
    return res.data.data
  },

  async switchToChild(childId: string): Promise<CitizenTokenPair> {
    const res = await api.post<{ data: CitizenTokenPair }>(`/auth/citizen/children/${childId}/switch`, {})
    return res.data.data
  },

  async previewFromNvi(): Promise<CitizenFamilyNviPreview> {
    const res = await api.post<{ data: CitizenFamilyNviPreview }>('/auth/citizen/family-members/fetch-from-nvi', {})
    return res.data.data
  },

  async confirmFromNvi(selectedTckns: string[]): Promise<CitizenFamilyConfirmResult> {
    const res = await api.post<{ data: CitizenFamilyConfirmResult }>(
      '/auth/citizen/family-members/confirm-from-nvi',
      { selectedTckns },
    )
    return res.data.data
  },
}

export default familyService

