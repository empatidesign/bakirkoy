import { api } from './api'
import type { NotificationPreference, UpsertNotificationPreferenceRequest } from '@/types/notificationPreference.types'

interface ApiResp<T> { data: T }

const notificationPreferenceService = {
  async getPreferences(): Promise<NotificationPreference[]> {
    const res = await api.get<ApiResp<NotificationPreference[]>>('/me/notification-preferences')
    return res.data.data
  },

  async upsert(req: UpsertNotificationPreferenceRequest): Promise<NotificationPreference> {
    const res = await api.put<ApiResp<NotificationPreference>>('/me/notification-preferences', req)
    return res.data.data
  },

  async optOutAll(): Promise<void> {
    await api.post('/me/notification-preferences/opt-out-all')
  },

  async setQuietHoursForAll(
    current: NotificationPreference[],
    quietHoursStart: string | null,
    quietHoursEnd: string | null,
  ): Promise<NotificationPreference[]> {
    const results = await Promise.all(
      current.map((pref) =>
        notificationPreferenceService.upsert({
          category: pref.category,
          pushEnabled: pref.pushEnabled,
          smsEnabled: pref.smsEnabled,
          emailEnabled: pref.emailEnabled,
          inAppEnabled: pref.inAppEnabled,
          quietHoursStart,
          quietHoursEnd,
        }),
      ),
    )
    return results
  },
}

export default notificationPreferenceService
