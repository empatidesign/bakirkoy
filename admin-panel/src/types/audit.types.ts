export interface AuditLogItem {
  id: string
  createdAt: string
  userId?: string | null
  userName?: string | null
  userRole?: string | null
  action: string
  level: string
  result: string
  entityType: string
  entityId?: string | null
  module?: string | null
  description?: string | null
  ipAddress?: string | null
}

export interface AuditLogDetail extends AuditLogItem {
  oldValues?: string | null
  newValues?: string | null
  changesJson?: string | null
  userAgent?: string | null
  sessionId?: string | null
  durationMs?: number | null
  errorMessage?: string | null
  additionalDataJson?: string | null
}

export interface AuditLogFilterOptions {
  modules: string[]
  actions: string[]
  entityTypes: string[]
}

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'primary' | 'neutral'

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  Create: 'Oluşturma',
  Update: 'Güncelleme',
  Delete: 'Silme',
  SoftDelete: 'Çöpe Taşıma',
  Restore: 'Geri Yükleme',
  Login: 'Giriş',
  Logout: 'Çıkış',
  PasswordChange: 'Şifre Değişimi',
  PasswordReset: 'Şifre Sıfırlama',
  StatusChange: 'Durum Değişimi',
  Approve: 'Onaylama',
  Reject: 'Reddetme',
  Cancel: 'İptal',
  Export: 'Dışa Aktarma',
  Import: 'İçe Aktarma',
  BulkOperation: 'Toplu İşlem',
  QrScan: 'QR Okutma',
  Attendance: 'Yoklama',
  CheckIn: 'Giriş (Check-in)',
  CheckOut: 'Çıkış (Check-out)',
  SystemConfig: 'Sistem Ayarı',
  PermissionChange: 'Yetki Değişimi',
  View: 'Görüntüleme',
}

export const AUDIT_ACTION_TONE: Record<string, Tone> = {
  Create: 'success',
  Update: 'info',
  Delete: 'danger',
  SoftDelete: 'warning',
  Restore: 'info',
  Login: 'primary',
  Logout: 'neutral',
  PasswordChange: 'warning',
  PasswordReset: 'warning',
  StatusChange: 'info',
  Approve: 'success',
  Reject: 'danger',
  Cancel: 'warning',
  Export: 'neutral',
  Import: 'neutral',
  BulkOperation: 'primary',
  QrScan: 'primary',
  Attendance: 'info',
  CheckIn: 'success',
  CheckOut: 'neutral',
  SystemConfig: 'warning',
  PermissionChange: 'warning',
  View: 'neutral',
}

export const AUDIT_RESULT_LABEL: Record<string, string> = {
  Success: 'Başarılı',
  Failure: 'Başarısız',
  Partial: 'Kısmi',
}

export const AUDIT_RESULT_TONE: Record<string, Tone> = {
  Success: 'success',
  Failure: 'danger',
  Partial: 'warning',
}

export const auditActionLabel = (a: string) => AUDIT_ACTION_LABEL[a] ?? a
export const auditActionTone = (a: string): Tone => AUDIT_ACTION_TONE[a] ?? 'neutral'
export const auditResultLabel = (r: string) => AUDIT_RESULT_LABEL[r] ?? r
export const auditResultTone = (r: string): Tone => AUDIT_RESULT_TONE[r] ?? 'neutral'
