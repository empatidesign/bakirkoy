import { api } from './api'
import type { CitizenDutyPharmacy } from '@/types/duty-pharmacy.types'

const dutyPharmacyService = {
  async list(): Promise<CitizenDutyPharmacy[]> {
    const res = await api.get<{ data: CitizenDutyPharmacy[] }>('/me/duty-pharmacies')
    return res.data.data
  },
}

export default dutyPharmacyService
