import { api } from './api'
import type { TravelSettings } from '@/types/travel.types'

const travelSettingsService = {
  async get(): Promise<TravelSettings> {
    const res = await api.get<{ data: TravelSettings }>('/travel-settings')
    return res.data.data
  },

  async save(data: TravelSettings): Promise<TravelSettings> {
    const res = await api.put<{ data: TravelSettings }>('/travel-settings', data)
    return res.data.data
  },
}

export default travelSettingsService
