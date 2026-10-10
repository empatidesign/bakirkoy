import { api } from './api'
import type { CitizenEmergencyArea } from '@/types/emergency-area.types'

const emergencyAreaService = {
  async list(): Promise<CitizenEmergencyArea[]> {
    const res = await api.get<{ data: CitizenEmergencyArea[] }>('/me/emergency-areas')
    return res.data.data
  },

  async detail(id: string): Promise<CitizenEmergencyArea> {
    const res = await api.get<{ data: CitizenEmergencyArea }>(`/me/emergency-areas/${id}`)
    return res.data.data
  },
}

export default emergencyAreaService
