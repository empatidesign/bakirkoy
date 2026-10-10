export interface AdminUser {
  id: string
  fullName: string
  email: string
  phone?: string
  department?: string
  roleId?: string
  roleKey?: string
  roleName?: string
  roleColor?: string
  isActive: boolean
  isFirstLogin: boolean
  lastLoginAt?: string
  createdAt: string
  isLocked: boolean
  lockedUntil?: string
  failedLoginCount: number
  // Kullanıcı isteği: rol facility-template bir modüle (ör. "sports") bağlıysa bu alanda
  // dolu gelir; facilityScopeIds o yöneticiye şu anda atanmış tesis kimlikleridir (boş dizi =
  // rolü var ama henüz hiç tesis atanmamış; undefined/null = rol tesis moduluyle ilgisiz).
  facilityScopeModule?: string | null
  facilityScopeIds?: string[] | null
  // --- SultanŞehir Anket Platformu — anket-özel yetki alanları ---
  isSurveyUser?: boolean
  surveyAllNeighborhoods?: boolean
  surveyOwnSurveysOnly?: boolean
  surveyCanViewParticipants?: boolean
  surveyCanViewPastSurveys?: boolean
  surveyCreateOnly?: boolean
  surveyNeighborhoods?: string[]
}

export interface AdminListParams {
  page: number
  limit: number
  search?: string
  role?: string
  roleId?: string
  isActive?: boolean | ''
}

export type AdminDeliveryChannel = 'Email' | 'Sms'

export interface CreateAdminRequest {
  fullName: string
  email: string
  phone?: string
  department?: string
  role: string
  deliveryChannel: AdminDeliveryChannel
  facilityScopeIds?: string[]
  // Kullanıcı talimatı (2026-08-04): "şifreyi manuel oluşturulabilir" — doluysa
  // backend rastgele şifre üretmez/göndermez, doğrudan bu şifreyi kullanır.
  manualPassword?: string
  // --- SultanŞehir Anket Platformu — anket-özel yetki alanları ---
  isSurveyUser?: boolean
  surveyAllNeighborhoods?: boolean
  surveyOwnSurveysOnly?: boolean
  surveyCanViewParticipants?: boolean
  surveyCanViewPastSurveys?: boolean
  surveyCreateOnly?: boolean
  surveyNeighborhoods?: string[]
}

export interface UpdateAdminRequest {
  fullName: string
  phone?: string
  department?: string
  role: string
  email?: string
  // null/undefined = mevcut tesis yetki alanına dokunma; [] = tüm tesisleri kaldır.
  facilityScopeIds?: string[] | null
  // --- SultanŞehir Anket Platformu — anket-özel yetki alanları ---
  isSurveyUser?: boolean
  surveyAllNeighborhoods?: boolean
  surveyOwnSurveysOnly?: boolean
  surveyCanViewParticipants?: boolean
  surveyCanViewPastSurveys?: boolean
  surveyCreateOnly?: boolean
  surveyNeighborhoods?: string[]
}
