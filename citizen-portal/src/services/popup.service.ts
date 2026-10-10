import { api } from './api'
import type { CitizenPopup } from '@/types/popup.types'

const BASE = '/me/popups'

const popupService = {
  async getNext(trigger: 'first_login' | 'every_login' | 'module_enter', moduleKey?: string): Promise<CitizenPopup | null> {
    const res = await api.get<{ data: CitizenPopup | null }>(`${BASE}/next`, { params: { trigger, moduleKey } })
    return res.data.data
  },

  async acknowledge(id: string, dismissForever = false): Promise<void> {
    await api.post(`${BASE}/${id}/acknowledge`, { dismissForever })
  },
}

export default popupService
