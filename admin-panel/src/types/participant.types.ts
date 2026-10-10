export type ParticipantStatus = 'Active' | 'Passive' | 'Blocked' | 'Deleted'
export type Gender = 'Unknown' | 'Male' | 'Female'
export type ParticipantDeliveryChannel = 'Email' | 'Sms'

export interface Participant {
  id: string
  fullName: string
  tckn: string
  photoUrl?: string
  birthDate: string
  age: number
  gender: Gender
  district?: string
  city?: string
  neighborhood?: string
  districtCode?: string
  address?: string
  email?: string
  phone?: string
  isMinor: boolean
  guardianPhone?: string
  guardianEmail?: string
  childrenCount: number
  guardianCount?: number
  eventCount: number
  activityCount: number
  status: ParticipantStatus
  blockReason?: string
  isVerified: boolean
  isFirstLogin: boolean
  registeredAt: string
  lastEventName?: string
  createdAt: string
  // Kullanıcı isteği (2026-08-05): AdminUser'daki kilit durumu/kaldırma özelliğinin aynısı
  // katılımcılar için de eklendi.
  isLocked?: boolean
  lockedUntil?: string
  failedLoginCount?: number
}

export interface ParticipantSummary {
  total: number
  active: number
  passive: number
  blocked: number
  deleted: number
}

export interface CreateParticipantRequest {
  tckn: string
  birthDate: string
  email?: string
  phone?: string
  guardianPhone?: string
  guardianEmail?: string
  deliveryChannel: ParticipantDeliveryChannel
}

export interface UpdateParticipantRequest {
  phone?: string
  email?: string
  guardianPhone?: string
  guardianEmail?: string
}

export interface NviChild {
  tckn: string
  fullName: string
  birthDate: string
  gender: Gender
  address?: string
}

export interface NviLookupResult {
  tckn: string
  fullName: string
  birthDate: string
  gender: Gender
  address?: string
  isMinor: boolean
  children: NviChild[]
}

export interface ParticipantLookupResult {
  exists: boolean
  participant?: ParticipantDetail
}

export interface ParticipantStats {
  totalEvents: number
  completedEvents: number
  ongoingEvents: number
  attendanceRate: number
  surveyParticipation: number
}

export interface ParticipantMonthlySummary {
  events: number
  hours: number
  points: number
  attendanceRate: number
}

export interface GuardianLink {
  id: string
  fullName: string
  photoUrl?: string
  phone?: string
  relation?: string
}

export interface ParticipantDetail extends Participant {
  stats: ParticipantStats
  monthly: ParticipantMonthlySummary
  recentEvents: ParticipantEvent[]
  children: Participant[]
  guardians: GuardianLink[]
  adminNotes?: string
  sedaEducations?: { academicYear: string; createdAt: string }[]
}

export type AttendanceStatus = 'Attended' | 'Missed' | 'Excused'
export type ApprovalStatus = 'Approved' | 'Pending' | 'Rejected'

export interface ParticipantEvent {
  id: string
  personId: string
  personName: string
  eventName: string
  date: string
  time?: string
  venue: string
  category: string
  attendance: AttendanceStatus
  approval: ApprovalStatus
}

export interface ParticipantEventCounts {
  all: number
  attended: number
  missed: number
  excused: number
}

export interface ParticipantEventResult {
  items: ParticipantEvent[]
  total: number
  page: number
  limit: number
  totalPages: number
  counts: ParticipantEventCounts
}

type StatusTone = 'success' | 'neutral' | 'danger' | 'warning'

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  Active: 'Aktif',
  Passive: 'Pasif',
  Blocked: 'Engellendi',
  Deleted: 'Silindi',
}

export const PARTICIPANT_STATUS_TONE: Record<ParticipantStatus, StatusTone> = {
  Active: 'success',
  Passive: 'neutral',
  Blocked: 'danger',
  Deleted: 'warning',
}

export const PARTICIPANT_STATUS_OPTIONS: { value: ParticipantStatus; label: string }[] = [
  { value: 'Active', label: 'Aktif' },
  { value: 'Passive', label: 'Pasif' },
  { value: 'Blocked', label: 'Engellendi' },
  { value: 'Deleted', label: 'Silindi' },
]

export const GENDER_LABELS: Record<Gender, string> = {
  Unknown: 'Belirtilmemiş',
  Male: 'Erkek',
  Female: 'Kadın',
}

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'Male', label: 'Erkek' },
  { value: 'Female', label: 'Kadın' },
  { value: 'Unknown', label: 'Belirtilmemiş' },
]

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  Attended: 'Katıldı',
  Missed: 'Katılmadı',
  Excused: 'Mazeret',
}

export const ATTENDANCE_TONE: Record<AttendanceStatus, 'success' | 'danger' | 'warning'> = {
  Attended: 'success',
  Missed: 'danger',
  Excused: 'warning',
}

export const APPROVAL_LABELS: Record<ApprovalStatus, string> = {
  Approved: 'Onaylandı',
  Pending: 'Beklemede',
  Rejected: 'Reddedildi',
}

export const APPROVAL_TONE: Record<ApprovalStatus, 'success' | 'warning' | 'danger'> = {
  Approved: 'success',
  Pending: 'warning',
  Rejected: 'danger',
}

export interface ParticipantDemographicsParams {
  status?: string
  verified?: boolean
  startDate?: string
  endDate?: string
}

export interface NeighborhoodStat {
  name: string
  total: number
  male: number
  female: number
  minors: number
  adults: number
  percentOfTotal: number
  ageBands: AgeBandStat[]
  youth: number
  youthMale: number
  youthFemale: number
  youthPercent: number
}

export interface AgeBandStat {
  band: string
  total: number
  male: number
  female: number
  percentOfTotal: number
}

export interface GenderStat {
  male: number
  female: number
  malePercent: number
  femalePercent: number
}

export interface ParticipantDemographicsOverview {
  total: number
  active: number
  passive: number
  blocked: number
  verified: number
  unverified: number
  minors: number
  adults: number
  withChildren: number
  averageAge: number
  gender: GenderStat
  neighborhoods: NeighborhoodStat[]
  ageBands: AgeBandStat[]
  ageBandsByGender: AgeBandStat[]
}

export interface NeighborhoodParticipantRow {
  id: string
  fullName: string
  tckn: string
  age: number
  gender: Gender
  phone?: string | null
  status: ParticipantStatus
  registeredAt: string
}

export interface NeighborhoodDetail {
  neighborhood: string
  total: number
  items: NeighborhoodParticipantRow[]
  page: number
  limit: number
  totalPages: number
}

// Kullanıcı isteği (2026-08-05): katılımcı detayında "katıldığı anketler, verdiği cevaplar"
// gerçek veriye bağlansın. Anonim anketlerdeki yanıtlar burada asla görünmez (backend kimliği
// hiç kaydetmiyor) — bu bilinçli bir mahremiyet kararıdır, eksik veri değildir.
export interface ParticipantSurveyAnswer {
  questionId: string
  questionText: string
  questionType: string
  rawAnswer?: string | null
  answerDisplay: string
}

export interface ParticipantSurveyResponse {
  responseId: string
  surveyId: string
  surveyTitle: string
  surveyCategory: string
  submittedAt: string
  answeredQuestionCount: number
  totalQuestionCount: number
  answers: ParticipantSurveyAnswer[]
}

// Kullanıcı isteği (2026-08-05): katılımcı detayında bu kişiye gönderilmiş bildirim/mesaj
// geçmişi (etkinlik/tesis/gezi/kütüphane/hediye vb. durum bildirimleri) görüntülensin.
export interface ParticipantNotification {
  id: string
  title: string
  body: string
  type: string
  isRead: boolean
  createdAt: string
  referenceType?: string | null
  referenceId?: string | null
  facilityName?: string | null
  sessionInfo?: string | null
  statusInfo?: string | null
}
