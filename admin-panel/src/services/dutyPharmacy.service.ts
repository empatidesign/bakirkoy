import { api } from './api'
import type { DutyPharmacy, DutyPharmacySyncStatus } from '@/types/dutyPharmacy.types'

const BASE = '/duty-pharmacies'

const dutyPharmacyService = {
  async getList(): Promise<DutyPharmacy[]> {
    const res = await api.get<{ data: DutyPharmacy[] }>(BASE)
    return res.data.data
  },

  async getSyncStatus(): Promise<DutyPharmacySyncStatus> {
    const res = await api.get<{ data: DutyPharmacySyncStatus }>(`${BASE}/sync-status`)
    return res.data.data
  },

  async sync(): Promise<void> {
    await api.post(`${BASE}/sync`)
  },
}

export default dutyPharmacyService
