type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

export type SedaApplicationStatus = 'pending' | 'approved' | 'rejected'

export type SedaNotificationEvent = 'application_received' | 'approved' | 'rejected' | 'cancelled' | 'postponed' | 'emergency' | 'manual'

export interface SedaNotificationTemplate {
  event: SedaNotificationEvent
  smsEnabled: boolean
  smsBody: string
  notifyEnabled: boolean
  notifyBody: string
}

export interface SedaManualMessageRequest {
  templateEvent: SedaNotificationEvent
  customText?: string | null
  sms: boolean
  notify: boolean
  statusFilter?: SedaApplicationStatus[] | null
  schoolName?: string | null
  // Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20 iki kez): SMS göndermek için
  // doğrulama kodu (OTP) zorunlu. PIN yöntemi kaldırıldı.
  smsOtp?: string
}

export interface SedaManualMessageResult {
  recipients: number
  smsSent: number
  notificationsCreated: number
  smsMockMode: boolean
}

export const SEDA_APPLICATION_STATUS_LABELS: Record<SedaApplicationStatus, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
}

export const SEDA_APPLICATION_STATUS_TONE: Record<SedaApplicationStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

export const SEDA_APPLICATION_STATUS_OPTIONS = (Object.keys(SEDA_APPLICATION_STATUS_LABELS) as SedaApplicationStatus[])
  .map((v) => ({ value: v, label: SEDA_APPLICATION_STATUS_LABELS[v] }))

export interface SedaApplication {
  id: string
  code: string
  studentName: string
  studentSurname: string
  tckn: string
  birthDate?: string
  schoolName: string
  nextYearGrade: string
  educationType: string
  examCenterName: string
  studentPhone: string
  parentPhone: string
  address: string
  status: SedaApplicationStatus
  notes?: string
  rejectionReason?: string
  appliedAt: string
  appliedBy?: string
  reviewedAt?: string
  reviewedBy?: string
}

export interface SedaApplicationForm {
  studentName: string
  studentSurname: string
  tckn: string
  birthDate: string
  schoolName: string
  nextYearGrade: string
  educationType: string
  examCenterName: string
  studentPhone: string
  parentPhone: string
  address: string
  status: SedaApplicationStatus
  notes: string
}

export interface SedaApplicationSummary {
  total: number
  approved: number
  pending: number
  rejected: number
}

export interface SedaSchool {
  id: string
  name: string
  isActive: boolean
  applicationCount: number
  createdAt?: string
}

export interface SedaSchoolForm {
  name: string
}

export type SedaDefinitionType = 'subject' | 'education-type' | 'grade' | 'exam-center'

export interface SedaDefinitionMeta {
  title: string
  resource: string
  description: string
}

export const SEDA_DEFINITION_META: Record<SedaDefinitionType, SedaDefinitionMeta> = {
  subject: {
    title: 'Eğitim Alanları',
    resource: 'Eğitim Alanı',
    description: 'Matematik, Fen Bilimleri, Türkçe gibi çalışma alanları',
  },
  'education-type': {
    title: 'Eğitim Türleri',
    resource: 'Eğitim Türü',
    description: 'Başvuruda seçilebilecek eğitim türleri (Deneme Kulübü, Örgün Öğretim)',
  },
  grade: {
    title: 'Sınıflar',
    resource: 'Sınıf',
    description: 'Önümüzdeki yıl sınıf kademeleri',
  },
  'exam-center': {
    title: 'Sınav Yerleri',
    resource: 'Sınav Yeri',
    description: 'Sınavların yapılacağı merkezler',
  },
}

export const SEDA_DEFINITION_ORDER: SedaDefinitionType[] = ['subject', 'education-type', 'grade', 'exam-center']

export interface SedaDefinition {
  id: string
  type: SedaDefinitionType
  name: string
  isActive: boolean
  createdAt?: string
}

export interface SedaDefinitionForm {
  name: string
}

export interface SedaPeriod {
  id: string
  name: string
  startDate: string
  endDate: string
  maxApplications: number
  currentApplications: number
  description?: string
  isActive: boolean
}

export interface SedaPeriodForm {
  name: string
  startDate: string
  endDate: string
  maxApplications: number
  description: string
}

export interface SedaSettings {
  applicationsOpen: boolean
  requireApproval: boolean
  autoCloseWhenFull: boolean
  activePeriod: SedaPeriod | null
  notificationTemplates?: SedaNotificationTemplate[] | null
}

export interface SedaEducationRecord {
  id: string
  tckn: string
  fullName: string
  academicYear: string
  participantId: string | null
  participantName: string | null
  periodId: string | null
  periodName: string | null
  score: number | null
  resultNote: string | null
  // Kullanıcı isteği (2026-08-12): "yüklenen excelde sıralama mı hak kazandı kazanmadı mı yaptığı
  // netler mi neler olduğu verilen excel dökümanına göre alınıp yapılacak" — sık kullanılan alanlar
  // tip'li, tanımadığımız her sütun detailsJson'da ham başlık→değer olarak saklanır.
  rank: number | null
  phone: string | null
  isWinner: boolean
  detailsJson: string
  createdAt: string
}

export interface SedaEducationImportResult {
  totalRows: number
  added: number
  updated: number
  matchedParticipants: number
  unmatchedCount: number
  invalidRows: { row: number; reason: string }[]
}

// Kullanıcı isteği (2026-10-05): eski sultanga_seda sisteminden (2018-2026) içe aktarılan
// başvurular + bugünden sonraki yeni başvurular için "yıllara göre kaç kişi başvurmuş"
// detaylı rapor sistemi.
export interface SedaYearlyCount {
  year: number
  total: number
  approved: number
  pending: number
  rejected: number
}

export interface SedaYearlyBreakdownItem {
  name: string
  count: number
}

export interface SedaYearlyReport {
  byYear: SedaYearlyCount[]
  topSchools: SedaYearlyBreakdownItem[]
  byGrade: SedaYearlyBreakdownItem[]
  byEducationType: SedaYearlyBreakdownItem[]
  totalApplications: number
  totalDistinctSchools: number
  totalDistinctApplicants: number
}
