export const NOTIFICATION_CATEGORIES = ['event', 'travel', 'facility', 'campaign', 'library', 'general'] as const

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  event: 'Etkinlikler',
  travel: 'Geziler',
  facility: 'Hizmet Tesisleri',
  campaign: 'Kampanyalar',
  library: 'Kütüphane',
  general: 'Genel Duyurular',
}

export interface NotificationPreference {
  id: string | null
  category: NotificationCategory
  pushEnabled: boolean
  smsEnabled: boolean
  emailEnabled: boolean
  inAppEnabled: boolean
  quietHoursStart: string | null
  quietHoursEnd: string | null
}

export interface UpsertNotificationPreferenceRequest {
  category: NotificationCategory
  pushEnabled: boolean
  smsEnabled: boolean
  emailEnabled: boolean
  inAppEnabled: boolean
  quietHoursStart?: string | null
  quietHoursEnd?: string | null
}
