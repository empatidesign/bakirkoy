export type ModuleNotificationEvent = 'manual' | string

export interface ModuleNotificationTemplate {
  event: string
  smsEnabled: boolean
  smsBody: string
  notifyEnabled: boolean
  notifyBody: string
}

export interface ModuleNotificationSettings {
  notificationTemplates?: ModuleNotificationTemplate[] | null
}

export interface ModuleManualMessageRequest {
  targetKind: string
  ids: string[]
  templateEvent: string
  customText?: string | null
  sms: boolean
  notify: boolean
  // Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20 iki kez): SMS göndermek için
  // doğrulama kodu (OTP) zorunlu. PIN yöntemi kaldırıldı.
  smsOtp?: string
}

export interface ModuleManualMessageResult {
  recipients: number
  smsSent: number
  notificationsCreated: number
  smsMockMode: boolean
}

export interface ModuleTemplateMeta {
  label: string
  desc: string
  vars: string[]
}
