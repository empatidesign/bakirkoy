import { api } from './api'
import type { EventSettings, EventImageRatioCatalog } from '@/types/eventSettings.types'

const eventSettingsService = {
  async get(): Promise<EventSettings> {
    const res = await api.get<{ data: EventSettings }>('/event-settings')
    return res.data.data
  },

  async save(data: EventSettings): Promise<EventSettings> {
    const res = await api.put<{ data: EventSettings }>('/event-settings', data)
    return res.data.data
  },

  async getImageRatios(): Promise<EventImageRatioCatalog> {
    const res = await api.get<{ data: EventImageRatioCatalog }>('/event-settings/image-ratios')
    return res.data.data
  },
}

export default eventSettingsService
