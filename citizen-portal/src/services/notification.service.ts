import { api } from './api'
import type { PagedResult } from '@/types/common'
import type { CitizenNotification } from '@/types/notification.types'

const notificationService = {
  async list(params: Record<string, unknown>): Promise<PagedResult<CitizenNotification>> {
    const res = await api.get<{ data: PagedResult<CitizenNotification> }>('/me/notifications', { params })
    return res.data.data
  },

  async unreadCount(scope = 'family'): Promise<number> {
    const res = await api.get<{ data: { unreadCount: number } }>('/me/notifications/unread-count', { params: { scope } })
    return res.data.data.unreadCount
  },

  async markRead(id: string): Promise<void> {
    await api.patch(`/me/notifications/${id}/read`)
  },

  async markAllRead(scope = 'family'): Promise<void> {
    await api.patch('/me/notifications/read-all', null, { params: { scope } })
  },

  // Kullanıcı isteği (2026-09-01): zorunlu onaylı duyuru — "okudum" demeden kapanmaz.
  async pendingAcknowledgements(): Promise<CitizenNotification[]> {
    const res = await api.get<{ data: CitizenNotification[] }>('/me/notifications/pending-acknowledgements')
    return res.data.data
  },

  async acknowledge(id: string): Promise<void> {
    await api.post(`/me/notifications/${id}/acknowledge`)
  },
}

export default notificationService
