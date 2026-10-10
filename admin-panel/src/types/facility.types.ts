import type { FacilityKind } from '@/templates/FacilityTemplate/moduleConfig'

export type ApplicationStatus = 'pending' | 'approved' | 'waitlist' | 'rejected' | 'expired'
export type GroupType = 'kurs' | 'akademi'
export type FacilityGender = 'male' | 'female' | 'mixed'
export type AttendanceMode = 'full' | 'tracking_only' | 'off'

export interface FacilityRecord {
  id: string
  name: string
  kind: FacilityKind
  district?: string
  city?: string
  address?: string
  latitude?: number
  longitude?: number
  capacity: number
  occupancyRate?: number
  registeredCount?: number
  totalGroupCapacity?: number
  waitlistCount?: number
  serviceFacilityId?: string
  serviceFacilityName?: string
  managerId?: string
  managerName?: string
  managerRoleKey?: string
  managerRoleName?: string
  managerPhone?: string
  managerEmail?: string
  emergencyPhone?: string
  groupCount?: number
  branches?: string[]
  genders?: FacilityGender[]
  todaySessionCount?: number
  sessionDays?: number[]
  updatedAt?: string | null
  isActive: boolean
  createdAt: string
  deletedAt?: string | null
  deletedBy?: string | null
}

export interface BranchRecord {
  id: string
  name: string
  description?: string
  category?: string
  periodMonths?: number
  absenceLimit?: number
  consecutiveAbsenceLimit?: number
  groupCount?: number
  sessionCount?: number
  applicationCount?: number
  isActive: boolean
  createdAt: string
  deletedAt?: string | null
  deletedBy?: string | null
}

export interface DaySchedule {
  day: string
  start: string
  end: string
}

export interface GroupRecord {
  id: string
  facilityId: string
  facilityName?: string | null
  branchId: string
  branchName: string
  parentGroupId?: string | null
  parentGroupName?: string | null
  serviceFacilityId?: string | null
  serviceFacilityName?: string | null
  instructorId?: string | null
  instructorName?: string | null
  name: string
  type: GroupType
  gender: FacilityGender
  capacity: number
  reserveCapacity: number
  registeredCount: number
  waitlistCount: number
  pendingCount?: number
  ageMin: number
  ageMax: number
  days: string[]
  schedules: DaySchedule[]
  attendanceMode: AttendanceMode
  lateTrackingEnabled?: boolean
  description?: string
  periodStart?: string | null
  periodEnd?: string | null
  periodMonths?: number | null
  periodType?: string | null
  periodCount?: number | null
  periodUnit?: string | null
  periodDays?: number | null
  applicationStartDate?: string | null
  applicationEndDate?: string | null
  academyWhitelistEnabled?: boolean
  absenceLimit?: number
  consecutiveAbsenceLimit?: number
  entryGraceMinutes?: number
  isPaid?: boolean
  feeType?: string
  feeAmount?: number | null
  siblingDiscount?: boolean
  staffDiscount?: boolean
  attendanceLimitOverride?: boolean
  attendanceLimitType?: string
  attendanceLimitCount?: number | null
  documentsRequired?: boolean
  requiredDocumentIds?: string[]
  documentFormats?: Record<string, string[]>
  residenceRequired?: boolean
  residencyMode?: 'anyone' | 'sultangazi_only' | 'outside_only' | 'foreign_only' | 'tc_only' | 'sultangazi_tc' | 'sultangazi_foreign'
  requirements?: string
  applicationConditions?: string
  aboutHtml?: string
  autoApprove?: boolean
  isActive: boolean
  createdAt: string
  deletedAt?: string | null
  deletedBy?: string | null
  scheduleSync?: {
    removedEmptySessions: number
    protectedApplicationSessions: number
    protectedAttendanceSessions: number
  } | null
  sessionCount?: number
  subGroupCount?: number
  subGroupCapacity?: number
  subGroupRegistered?: number
  subGroupWaitlist?: number
  prerequisiteGroupId?: string | null
  customQuestions?: GroupCustomQuestion[]
}

export interface SessionRecord {
  id: string
  facilityId: string
  groupId: string
  groupName: string
  branchName?: string
  ageMin?: number
  ageMax?: number
  lateTrackingEnabled?: boolean
  date: string
  day: string
  startTime: string
  endTime: string
  attendanceTakenAt?: string | null
  attendanceTaken?: boolean
  attendanceMode?: AttendanceMode
  isCancelled?: boolean
  cancelReason?: string | null
}

export interface CalendarDay {
  date: string
  sessionCount: number
}

export interface BulkSessionsScope {
  facilityId?: string | null
  groupIds?: string[] | null
  startDate: string
  endDate?: string | null
}

export interface BulkSessionsResult {
  affectedSessions: number
  notifiedUsers: number
}

export interface FacilityApplicationDocument {
  type?: string
  label?: string
  fileName?: string
  objectName?: string
  url?: string
}

export interface FacilityApplication {
  id: string
  facilityId: string
  fullName: string
  tckn: string
  phone: string
  email?: string
  birthDate?: string
  guardianPhone?: string
  branchId: string
  branchName: string
  groupId?: string
  groupName?: string
  appliedAt: string
  status: ApplicationStatus
  absenceCount: number
  documents?: FacilityApplicationDocument[]
  hasMissingDocuments?: boolean
}

export interface FacilitySummary {
  activeFacilities: number
  totalFacilities: number
  activeGroups: number
  courseCount: number
  academyCount: number
  mainParticipants: number
  waitlistParticipants: number
}

export interface InstructorOption {
  id: string
  fullName: string
  specialty?: string
}

export interface InstructorRecord {
  id: string
  fullName: string
  tckn?: string
  phone?: string
  email?: string
  specialty?: string
  groupCount?: number
  isActive: boolean
  createdAt: string
}

export type InstructorDeliveryChannel = 'Email' | 'Sms'

export interface InstructorForm {
  fullName: string
  tckn: string
  phone: string
  email: string
  specialty: string
  isActive: boolean
}

export interface AttendanceResult {
  success: boolean
  participantName?: string
  groupName?: string
  sessionTime?: string
  checkInAt?: string
  message?: string
}

export type DocumentCategory = 'identity' | 'health' | 'residence' | 'education' | 'permission' | 'other'
export type DocumentVerification = 'manual' | 'mernis' | 'system'

export type AttendanceLimitType = 'unlimited' | 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface ParticipationClass {
  id: string
  label: string
  minAge: number
  maxAge: number
  color: string
  requiresResidence: boolean
  requiresHealthReport: boolean
  requiresParentalConsent: boolean
  feeExempt: boolean
  feeDiscountPercent: number
  attendanceLimitOverride: boolean
  attendanceLimitType: AttendanceLimitType
  attendanceLimitCount: number
  notes: string
  isActive: boolean
}

export type NotificationEvent =
  | 'application_approved'
  | 'application_rejected'
  | 'application_pending'
  | 'application_waitlisted'
  | 'application_documents_required'
  | 'attendance_absent'
  | 'absence_warning'
  | 'absence_limit_reached'
  | 'session_reminder'
  | 'waitlist_promoted'
  | 'registration_cancelled'
  | 'postponed'
  | 'emergency'
  | 'manual'

export interface NotificationTemplate {
  event: NotificationEvent
  smsEnabled: boolean
  smsBody: string
  // Kullanıcı isteği (2026-10-06): e-posta alanları hiçbir zaman backend'de okunmuyordu
  // (SMTP altyapısı yok), "Uygulama Bildirimi" (push/in-app, gerçek FCM altyapısı var) ile
  // değiştirildi — Travel/SEDA modülleriyle aynı smsEnabled/smsBody + notifyEnabled/notifyBody deseni.
  notifyEnabled: boolean
  notifyBody: string
}

export interface GroupSettingsOverride {
  attendanceLimitEnabled: boolean
  attendanceLimitType: AttendanceLimitType
  attendanceLimitCount: number
  attendanceLimitResetDay: number
  absenceLimitOverride: boolean
  absenceLimitValue: number
  autoApproveOverride: boolean
  autoApproveValue: boolean
  documentsOverride: boolean
  feeOverride: boolean
  feeAmount: number
}

export interface RequiredDocument {
  id: string
  label: string
  category: DocumentCategory
  verification: DocumentVerification
  description?: string
  note?: string
  required: boolean
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'none'

export interface AttendanceRosterItem {
  registrationId: string
  participantId?: string | null
  fullName: string
  tckn: string
  kind: string
  absenceUsed: number
  consecutiveAbsenceUsed: number
  status: AttendanceStatus
  checkedInViaQr: boolean
  absenceLimit: number
  consecutiveAbsenceLimit: number
}

export interface AttendanceMark {
  registrationId: string
  status: AttendanceStatus
}

export interface AttendanceHistoryItem {
  attendanceId: string
  sessionId: string
  sessionDate: string
  startTime: string
  endTime: string
  status: AttendanceStatus
  method: string
  checkedInViaQr: boolean
  markedAt: string
  markedBy?: string | null
}

export interface SaveAttendanceResult {
  marked: number
  removed: number
}

export interface RegistrationRecord {
  id: string
  groupId: string
  groupName?: string
  fullName: string
  tckn: string
  phone: string
  kind: string
  waitlistOrder: number
  periodEnd?: string | null
  absenceUsed: number
  consecutiveAbsenceUsed: number
  status: string
  createdAt: string
}

/** TC ile aktarımda hedef liste: auto = asıl dolarsa yedeğe, main = yalnız asıl, reserve = doğrudan yedek. */
export type RegistrationTarget = 'auto' | 'main' | 'reserve'

export interface BulkPreRegisterRowResult {
  tckn: string
  status: 'registered' | 'waitlisted' | 'already_registered' | 'not_found' | 'invalid' | 'failed'
  reason?: string | null
  registrationId?: string | null
  fullName?: string | null
}

export interface BulkPreRegisterResult {
  requested: number
  registered: number
  waitlisted: number
  alreadyRegistered: number
  notFound: number
  failed: number
  rows: BulkPreRegisterRowResult[]
}

export interface GeneralSettings {
  qrTurnstileEnabled: boolean
  autoCheckoutMinutes: number
  waitlistEnabled: boolean
  waitlistAutoPromote: boolean
  waitlistConfirmHours: number
  requiredDocuments: RequiredDocument[]
  attendanceLimitType: AttendanceLimitType
  attendanceLimitCount: number
  attendanceLimitResetDay: number
  notificationTemplates: NotificationTemplate[]
  participationClasses: ParticipationClass[]
  sessionReminderEnabled: boolean
  sessionReminderHoursBefore: number
  /** Kullanıcı isteği (2026-08-29): seans hatırlatması SMS'e ek olarak e-posta ile de gönderilebilsin. */
  sessionReminderEmailEnabled?: boolean
  /** Kullanıcı isteği (2026-10-05): Yoklama alındığında SMS gönderimi (varsayılan pasif). */
  attendanceSmsEnabled?: boolean
  /** Kullanıcı isteği (2026-10-05): Modül genelinde yoklama sisteminin açık/kapalı durumu. */
  attendanceEnabled?: boolean
  /** Kullanıcı isteği (2026-10-05, Kadın ve Aile Merkezi): aynı programa (ör. "Aşçılık") başka
   * bir tesiste aktif başvuru/kayıt varken tekrar başvuruyu engelle. Farklı program (ör.
   * "Pastacılık") her zaman serbest kalır — kısıt yalnızca AYNI programın FARKLI tesisine uygulanır. */
  crossFacilitySameBranchBlocked?: boolean
  /** Kullanıcı isteği (2026-10-05): aynı kurs grubundan (kategori, ör. "Mutfak") birden fazla kursa
   * başvuruyu engelle (ör. Pastacılık alan kişi Aşçılık/Yemek alamaz). */
  crossFacilitySameCategoryBlocked?: boolean
  /** Kullanıcı isteği (2026-10-05): modül genelinde (tüm program/tesis toplamı) bir takvim yılında
   * kişinin yapabileceği maksimum toplam başvuru sayısı. 0 = sınırsız. */
  crossFacilityYearlyMaxApplications?: number
  /** Kullanıcı isteği (2026-10-05): Genel devamsızlık hakları ayarı. Gruplar için varsayılan toplam devamsızlık hakkı (örn: 5). */
  defaultAbsenceLimit?: number
  /** Kullanıcı isteği (2026-10-05): Genel devamsızlık hakları ayarı. Gruplar için varsayılan üst üste devamsızlık hakkı (örn: 3). */
  defaultConsecutiveAbsenceLimit?: number
}

export interface ScopedSettings {
  yearlyEnabled: boolean
  yearlyStartDate: string
  yearlyEndDate: string
  yearlyMaxApplications: number
  yearlyMinAge: number
  yearlyMaxAge: number
  crossFacilityOverride?: boolean
  crossFacilitySameBranchBlocked?: boolean
  crossFacilitySameCategoryBlocked?: boolean
  crossFacilityYearlyMaxApplications?: number
}

export interface FacilityScopeSettings {
  useGeneral: boolean
  settings: ScopedSettings
}

export interface ReportTopGroup {
  name: string
  branch: string
  participants: number
  occupancy: number
}

export interface ReportInstructor {
  name: string
  groupCount: number
  participants: number
  attendanceRate: number
}

export interface ReportSummary {
  totalParticipants: number
  activeGroups: number
  attendanceRate: number
  topGroups: ReportTopGroup[]
  instructorPerformance: ReportInstructor[]
}

export type DeviceDirection = 'entry' | 'exit' | 'both'
export type DeviceScope = 'facility_general' | 'area' | 'event'
export type DeviceWorkMode = 'online' | 'offline'

export interface FacilityDevice {
  id: string
  module: string
  serviceFacilityId?: string
  facilityId?: string
  scope: DeviceScope
  hallId?: string
  groupId?: string
  groupName?: string
  name: string
  direction: DeviceDirection
  deviceId?: string
  ipAddress?: string
  port: number
  username?: string
  hasPassword: boolean
  relayNo: number
  relayMs: number
  workMode: DeviceWorkMode
  httpPath?: string
  triggerLockOnSuccess: boolean
  deviceCode: string
  apiKey?: string
  description?: string
  isActive: boolean
}

export interface FacilityDeviceForm {
  name: string
  direction: DeviceDirection
  scope?: DeviceScope
  serviceFacilityId?: string
  facilityId?: string
  hallId?: string
  groupId?: string
  deviceId: string
  ipAddress: string
  port: number
  username: string
  password: string
  relayNo: number
  relayMs: number
  workMode: DeviceWorkMode
  httpPath: string
  triggerLockOnSuccess: boolean
  description: string
}

export interface FacilityDeviceTestResult {
  ok: boolean
  message: string
}

export interface FacilityDeviceOpenResult {
  opened: boolean
  queued: boolean
  message: string
}

export type FacilityStaticQrMode = 'attendance' | 'entry' | 'entry_exit' | 'split'

export interface FacilityStaticQr {
  enabled: boolean
  mode: FacilityStaticQrMode
  code?: string | null
  entryCode?: string | null
  exitCode?: string | null
  minExitSeconds: number
  reentryCooldownSeconds: number
}

// Kullanıcı isteği (2026-10-01): bir grup/seans (program) başka tesis(ler)de de aynı
// gün/saatte yürütülebiliyor — admin kaynak kaydı hedef tesis(ler)e kopyalayabilir.
export interface CopyGroupItemResult {
  facilityId: string
  facilityName: string
  success: boolean
  groupId?: string | null
  error?: string | null
}

export interface CopyGroupResult {
  results: CopyGroupItemResult[]
}

export interface CopyGroupOptions {
  name?: string
  includeSubGroups?: boolean
  includeContent?: boolean
}


export interface FacilityForm {
  name: string
  kind: FacilityKind
  serviceFacilityId: string
  capacity: string
  managerId: string
  manager: string
  managerRoleKey: string
  managerRoleName: string
  managerPhone: string
  managerEmail: string
  emergencyPhone: string
  grantAccess: boolean
  tckn: string
  isActive: boolean
}

export interface BranchForm {
  name: string
  description: string
  category?: string
  periodMonths: string
  absenceLimit?: string
  consecutiveAbsenceLimit?: string
  isActive: boolean
}

export type FeeType = 'monthly' | 'term' | 'yearly' | 'once'

export interface GroupForm {
  facilityId: string
  name: string
  branchId: string
  parentGroupId: string
  instructorId: string
  type: GroupType
  gender: FacilityGender
  capacity: string
  reserveCapacity: string
  ageMin: string
  ageMax: string
  days: string[]
  schedules: DaySchedule[]
  attendanceMode: AttendanceMode
  lateTrackingEnabled: boolean
  description: string
  isPaid: boolean
  feeType: FeeType
  feeAmount: string
  siblingDiscount: boolean
  staffDiscount: boolean
  documentsRequired: boolean
  requiredDocumentIds: string[]
  documentFormats: Record<string, string[]>
  residenceRequired: boolean
  residencyMode: 'anyone' | 'sultangazi_only' | 'outside_only' | 'foreign_only' | 'tc_only' | 'sultangazi_tc' | 'sultangazi_foreign'
  requirements: string
  applicationConditions: string
  aboutHtml: string
  autoApprove: boolean
  periodStart: string
  periodEnd: string
  periodMonths: string
  periodType: 'date_range' | 'recurring'
  periodCount: string
  periodUnit: 'month' | 'day'
  periodDays: string
  applicationStartDate: string
  applicationEndDate: string
  academyWhitelistEnabled: boolean
  absenceLimit: string
  consecutiveAbsenceLimit: string
  entryGraceMinutes: string
  isActive: boolean
  attendanceLimitOverride: boolean
  attendanceLimitType: AttendanceLimitType
  attendanceLimitCount: string
  // Kullanıcı isteği (2026-10-04): önkoşul kurs (örn. "Arapça Seviye 2" yalnızca "Arapça
  // Seviye 1"i tamamlamış kişilere açık) + grup bazında özel evet/hayır soruları (örn.
  // Havuz'da "Yüzme biliyor musunuz?") — ConditionsJson'da taşınır.
  prerequisiteGroupId: string
  customQuestions: GroupCustomQuestion[]
}

export interface GroupCustomQuestion {
  id: string
  question: string
  required: boolean
}
