type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'
import type { FullResidencyMode } from '@/lib/residency'
import type { ParticipantDemographicsOverview } from './participant.types'

export type EntryControlMode = 'kiosk' | 'qr' | 'manual' | 'none'

export interface LibraryFloorForm {
  id: string
  name: string
  capacity: string
  active: boolean
  autoOpenWhenPreviousFull: boolean
  krokiUrl?: string | null
}

export interface LibraryTable {
  id: string
  name: string
  seatCount: number
}

export interface LibrarySection {
  id: string
  name: string
  type: string
  color: string
  capacity: number
  tables: LibraryTable[]
}

export interface SeatStructureFloor {
  id: string
  name: string
  capacity: number
  active: boolean
  autoOpenWhenPreviousFull: boolean
  krokiUrl?: string | null
  sections: LibrarySection[]
}

export const SECTION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'general', label: 'Genel Çalışma' },
  { value: 'silent', label: 'Sessiz Alan' },
  { value: 'team', label: 'Ekip Çalışması' },
  { value: 'research', label: 'Araştırma Salonu' },
  { value: 'reading', label: 'Okuma Salonu' },
]

export const SECTION_TYPE_LABELS: Record<string, string> = {
  general: 'Genel Çalışma',
  silent: 'Sessiz Alan',
  team: 'Ekip Çalışması',
  research: 'Araştırma Salonu',
  reading: 'Okuma Salonu',
}

export const SECTION_COLOR_PRESETS = ['#3699ff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export interface LibraryOption {
  value: string
  label: string
  district?: string | null
  city?: string | null
}

export interface Library {
  id: string
  name: string
  description?: string
  imageUrl?: string | null
  serviceFacilityId?: string
  serviceFacilityName?: string
  district?: string
  city?: string
  address?: string
  capacity: number
  currentOccupancy: number
  waitingCount: number
  onBreakCount: number
  floorCount: number
  queueEnabled: boolean
  reservationEnabled: boolean
  deviceControlEnabled?: boolean
  entryControlMode: EntryControlMode
  exitControlMode?: EntryControlMode
  managerId?: string
  managerName?: string
  managerRoleKey?: string
  managerRoleName?: string
  managerPhone?: string
  isActive: boolean
  createdAt: string
  isMultiFloor?: boolean
  floors?: LibraryReadFloor[]
  amenities?: string[]
  ipRestrictionEnabled?: boolean
  allowedIps?: string[]
  geofenceEnabled?: boolean
  geofenceLatitude?: number | null
  geofenceLongitude?: number | null
  geofenceRadiusMeters?: number
  autoCheckOutAfterMinutes?: number
  operationTemplate?: string | null
  seatingMode: SeatingMode
  breakSystemEnabled: boolean
  residencyMode: FullResidencyMode
}

export type SeatingMode = 'masali' | 'sirali'
export type LibrarySystemType = 'millet' | 'giris_cikis' | 'masa_secimli'

export const SYSTEM_TYPE_LABELS: Record<LibrarySystemType, string> = {
  millet: 'Kütüphane (Tam Sistem)',
  giris_cikis: 'Sadece Giriş-Çıkış Takip Sistemi',
  masa_secimli: 'Masa Seçimli Basit Sistem',
}


export type OperationTemplate =
  | 'FULL_BUSY_LIBRARY'
  | 'QR_ENTRY_EXIT_ONLY'
  | 'ENTRY_EXIT_AND_SEAT'
  | 'SEQUENTIAL_SEAT'

export const OPERATION_TEMPLATE_LABELS: Record<string, string> = {
  FULL_BUSY_LIBRARY: 'Tam Kapsamlı Yoğun Kütüphane',
  QR_ENTRY_EXIT_ONLY: 'QR Giriş-Çıkış Takip Sistemi',
  ENTRY_EXIT_AND_SEAT: 'Giriş-Çıkış ve Masa Kullanım Sistemi',
  SEQUENTIAL_SEAT: 'Sıralı Masa Kullanım Sistemi',
}

export interface LibraryReadFloor {
  id: string
  name: string
  capacity: number
  active: boolean
  autoOpenWhenPreviousFull: boolean
  krokiUrl?: string | null
  sections?: LibrarySection[] | null
}

export interface LibraryForm {
  name: string
  description: string
  imageUrl: string
  serviceFacilityId: string
  managerId: string
  manager: string
  managerRoleKey: string
  managerRoleName: string
  managerPhone: string
  managerEmail: string
  emergencyPhone: string
  systemType: LibrarySystemType
  isMultiFloor: boolean
  floors: LibraryFloorForm[]
  amenities: string[]
  queueEnabled: boolean
  reservationEnabled: boolean
  deviceControlEnabled: boolean
  entryControlMode: EntryControlMode
  exitControlMode: EntryControlMode
  autoCheckOutAfterMinutes: string
  useCustomBreakSettings: boolean
  breakDurationMinutes: string
  maxDailyBreaks: string
  longBreakDurationMinutes: string
  maxStudyHoursPerDay: string
  requireBreakAfterHours: string
  ipRestrictionEnabled: boolean
  allowedIps: string[]
  isActive: boolean
  grantAccess: boolean
  tckn: string
  geofenceEnabled: boolean
  geofenceLatitude: string
  geofenceLongitude: string
  geofenceRadiusMeters: string
  residencyMode: FullResidencyMode
}

export interface LibraryOverviewSummary {
  totalLibraries: number
  activeLibraries: number
  passiveLibraries: number
  totalCapacity: number
  totalOccupancy: number
  totalOnBreak: number
  totalWaiting: number
  occupancyRate: number
}

export interface LibraryDetailSummary {
  capacity: number
  currentOccupancy: number
  occupancyRate: number
  waitingCount: number
  onBreakCount: number
  violationsCount: number
}


export type OccupantStatus = 'inside' | 'on_break'
export type BreakType = 'short' | 'long'

export interface Occupant {
  id: string
  memberId: string
  memberName: string
  seat?: string
  entryTime: string
  durationMinutes: number
  shortBreaksRemaining: number
  longBreaksRemaining: number
  status: OccupantStatus
  breakType?: BreakType | null
  floorId?: string | null
}

// Kullanıcı isteği (2026-09-30): kütüphane ana ekranında "kim hangi kütüphanede" aranabilsin —
// tüm kütüphanelerdeki (o an içeride/molada/sırada olan) kişileri tek sorguda getiren
// /libraries/all/persons endpoint'inin frontend karşılığı.
export interface AllLibrariesPerson {
  id: string
  libraryId: string
  libraryName: string
  memberId: string
  memberName: string
  seat?: string
  sinceTime: string
  durationMinutes: number
  status: string
}


export type QueueMethod = 'qr' | 'manual'
export type QueueStatus = 'waiting' | 'called' | 'expired'

export interface QueueEntry {
  id: string
  queueNumber: string
  memberName: string
  tckn: string
  phone: string
  method: QueueMethod
  status: QueueStatus
  joinedAt: string
  calledAt?: string
  countdownExpiresAt?: string
}


export interface LibraryBreak {
  id: string
  memberId: string
  memberName: string
  sessionId: string
  type: BreakType
  startTime: string
  remainingMinutes: number
  seatHeld: boolean
  seat?: string
  floorId?: string | null
}


export type ExitType = 'manual' | 'auto'

export interface ExitedSession {
  id: string
  memberId: string
  memberName: string
  entryTime: string
  exitTime: string
  durationMinutes: number
  shortBreaksUsed: number
  longBreaksUsed: number
  exitType: ExitType
  seat?: string | null
  floorId?: string | null
}


export type SeatStatus = 'available' | 'occupied' | 'on_break' | 'reserved' | 'maintenance'

export type SeatBreakType = 'short' | 'long'

export interface Seat {
  key: string
  label: string
  number: number
  status: SeatStatus
  occupantName?: string
  entryTime?: string
  reservedFor?: string
  sessionId?: string
  breakType?: SeatBreakType
  reservationId?: string
}

export interface SeatTable {
  id: string
  name: string
  seatCount: number
  occupied: number
  seats: Seat[]
}

export interface SeatSection {
  id: string
  name: string
  type: string
  color: string
  capacity: number
  tables: SeatTable[]
}

export interface SeatFloor {
  id: string
  name: string
  capacity: number
  active: boolean
  krokiUrl?: string | null
  seats: Seat[]
  sections?: SeatSection[] | null
}

export interface LibrarySeatPlan {
  seatingMode: string
  floors: SeatFloor[]
  total: number
  occupied: number
  onBreak: number
  onBreakShort: number
  onBreakLong: number
  reserved: number
  maintenance: number
  available: number
}

export const SEAT_STATUS_LABELS: Record<SeatStatus, string> = {
  available: 'Boş',
  occupied: 'Dolu',
  on_break: 'Molada',
  reserved: 'Rezerve',
  maintenance: 'Bakım',
}


export type RuleCategory = 'general' | 'silent' | 'team' | 'food' | 'device'
export type RuleSeverity = 'info' | 'warning' | 'rule'

export interface LibraryRule {
  id: string
  category: RuleCategory
  title: string
  description: string
  icon: string
  severity: RuleSeverity
  isActive: boolean
}

export interface LibraryRuleForm {
  category: RuleCategory
  title: string
  description: string
  icon: string
  severity: RuleSeverity
}


export type LocationConsentStatus = 'unknown' | 'granted' | 'denied' | 'prompt'

export interface LibraryStaff {
  id: string
  adminUserId?: string | null
  fullName: string
  email?: string
  phone?: string
  roleName?: string | null
  workingLibraryIds: string[]
  isActive: boolean
  activeShiftId?: string | null
  activeLibraryId?: string | null
  activeLibraryName?: string | null
  activeShiftStartTime?: string | null
  locationConsentStatus?: LocationConsentStatus
  locationConsentUpdatedAt?: string | null
  canEditOwnShifts?: boolean
  participantId?: string | null
  hasDoorAccess?: boolean
  sourceType?: 'admin' | 'participant'
}

// Kullanıcı talimatı (2026-08-04, revizyon): personel ya bir yöneticiden (adminUserId)
// ya da mevcut bir katılımcıdan (participantId) atanabilir — tam olarak biri.
// ParticipantId kullanılır, TCKN metni DEĞİL: /participants listeleme ucu KVKK
// maskeleme ayarı açıkken TCKN'yi maskeli döndürür (ör. "610********"), bu yüzden
// arama sonucundan alınan TCKN metnine güvenilemez; ID her zaman maskesiz/tekildir.
// hasDoorAccess=true ise personel kendi normal QR'ıyla (yönetici ise ayrı personel
// QR'ı, katılımcı ise kendi vatandaş QR'ı) hangi kütüphanenin kapı cihazında
// olursa olsun giriş/çıkış yapabilir.
export interface LibraryStaffForm {
  adminUserId?: string | null
  participantId?: string | null
  workingLibraryIds: string[]
  canEditOwnShifts: boolean
  hasDoorAccess: boolean
}

export interface MyMesai {
  staff: LibraryStaff | null
  activeShift: LibraryShift | null
}

export type ShiftStatus = 'active' | 'ended'
export type ShiftInitiation = 'admin' | 'self' | 'ip-auto' | 'door-qr'

export const SHIFT_STATUS_LABELS: Record<ShiftStatus, string> = {
  active: 'Çalışıyor',
  ended: 'Bitti',
}

export interface LibraryShift {
  id: string
  staffId: string
  staffName: string
  libraryId: string
  libraryName: string
  startTime: string
  endTime?: string | null
  workedMinutes?: number | null
  status: ShiftStatus
  initiationType: ShiftInitiation
  initiatedByName?: string | null
  location?: string
  notes?: string
  autoClosedAtCutoff?: boolean
  wasEdited?: boolean
  originalStartTime?: string | null
  originalEndTime?: string | null
  lastEditedByName?: string | null
  lastEditedAt?: string | null
  editReason?: string | null
  /** Kullanıcı isteği (2026-08-08): WorkedMinutes config'teki eşik süreyi (varsayılan 14 saat) aşıyorsa true — anormal uzun mesai işaretidir. */
  isAnomalousDuration?: boolean
}

/** Personelin kendi aylık mesai özeti (GET /mesai/mine/summary). */
export interface MyMesaiMonthSummary {
  year: number
  month: number
  totalMinutes: number
  shiftCount: number
  workedDays: number
  autoClosedCount: number
  byLibrary: { libraryId: string; libraryName: string; totalMinutes: number; shiftCount: number }[]
  daily: { date: string; totalMinutes: number; shiftCount: number }[]
  shifts: LibraryShift[]
}

export interface StartShiftForm {
  staffId: string
  location: string
  notes: string
}

export interface EditShiftForm {
  startTime: string
  endTime: string
  reason: string
}

export interface MesaiSummary {
  activeShifts: number
  todayShifts: number
  eligibleStaff: number
}

export interface MesaiOverviewSummary {
  activeShifts: number
  todayShifts: number
  eligibleStaff: number
  librariesWithActiveShift: number
}

export interface DailyMesaiTotal {
  date: string
  totalMinutes: number
  shiftCount: number
}

export interface MesaiMonthlyStaffRow {
  staffId: string
  staffName: string
  roleName?: string | null
  totalMinutes: number
  shiftCount: number
  workedDays: number
  avgDailyMinutes: number
  longestDayMinutes: number
  autoClosedCount: number
  editedCount: number
  firstEntry?: string | null
  lastExit?: string | null
  dayMinutes: number[]
  byLibrary: { libraryId: string; libraryName: string; totalMinutes: number; shiftCount: number }[]
}

export interface MesaiMonthlyReport {
  year: number
  month: number
  daysInMonth: number
  totalMinutes: number
  shiftCount: number
  staffCount: number
  libraryCount: number
  autoClosedCount: number
  editedCount: number
  staff: MesaiMonthlyStaffRow[]
  libraries: { libraryId: string; libraryName: string; totalMinutes: number; shiftCount: number; staffCount: number; workedDays: number }[]
  daily: DailyMesaiTotal[]
}

export interface StaffMesaiPeriodTotals {
  staffId: string
  staffName: string
  totalMinutes: number
  shiftCount: number
  firstShiftStart?: string | null
  lastShiftEnd?: string | null
  dailyBreakdown: DailyMesaiTotal[]
  /** Kullanıcı isteği (2026-08-08): dönem içindeki haftalardan biri haftalık saat sınırını aştıysa true. */
  hasWeekOverLimit?: boolean
  maxWeeklyHours?: number
}

export interface TopMesaiStaff {
  staffId: string
  staffName: string
  roleName?: string | null
  totalMinutes: number
  shiftCount: number
  distinctLibraryCount: number
}

export interface MesaiReportSummary {
  totalShifts: number
  totalMinutes: number
  autoClosedCount: number
  editedCount: number
  distinctStaffCount: number
  /** Kullanıcı isteği (2026-08-08): 5 dakikadan kısa bitmiş mesai sayısı — genelde terminal devralma flapping'i işaretidir. */
  shortLivedCount: number
  ipTakeoverCount: number
}

export interface RuleSummary {
  total: number
  active: number
  passive: number
}


export interface LibrarySettings {
  pointsEnabled: boolean
  pointsPerVisit: number
  dailyVisitCap: number
  dailyPointCap: number
  weeklyPointCap: number
  qrRequired: boolean
  requiresEntryAndExit: boolean
  breakDurationMinutes: number
  maxDailyBreaks: number
  longBreakDurationMinutes: number
  shortBreakCooldownMinutes: number
  maxDailyLongBreaks: number
  maxSessionMinutes: number
  maxStudyHoursPerDay: number
  requireBreakAfterHours: number
  hourlyBreakEnabled: boolean
  hourlyBreakMinutesPerHour: number
  hourlyBreakMaxPerDay: number
  breakReturnGraceMinutes: number
  autoQueueCallEnabled: boolean
  queueCallWindowMinutes: number
  reservationHoldWindowMinutes: number
  dailyReservationLimitPerLibrary: number
  autoCheckOutAfterMinutes: number
  minCheckoutAfterMinutes: number
  walkInHoldMinutes: number
  minEntryBeforeBreakMinutes: number
  breakSystemEnabled: boolean
  /** Kullanıcı isteği (2026-08-08): teslim tarihi geçmiş emanet/kitabı olan üyenin girişi engellensin. */
  blockEntryOnOverdue: boolean
  /** Kullanıcı isteği (2026-08-29): üye uyarıları (rezervasyon/mola/çalışma süresi) SMS'e ek olarak e-posta ile de gönderilsin. */
  memberWarnEmailEnabled?: boolean
  notificationTemplates?: LibraryNotificationTemplate[]
}

export interface LibraryNotificationTemplate {
  event: string
  smsEnabled: boolean
  smsBody: string
  notifyEnabled: boolean
  notifyBody: string
}

export interface LibraryManualMessageRequest {
  sessionIds?: string[]
  templateEvent: string
  customText?: string | null
  sms: boolean
  notify: boolean
  // Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20 iki kez): SMS göndermek için
  // doğrulama kodu (OTP) zorunlu. PIN yöntemi kaldırıldı.
  smsOtp?: string
}

export interface LibraryManualMessageResult {
  recipients: number
  smsSent: number
  notificationsCreated: number
  smsMockMode: boolean
}


export const QUEUE_METHOD_LABELS: Record<QueueMethod, string> = { qr: 'QR', manual: 'Manuel' }
export const QUEUE_METHOD_TONE: Record<QueueMethod, BadgeTone> = { qr: 'info', manual: 'neutral' }

export const QUEUE_STATUS_LABELS: Record<QueueStatus, string> = {
  waiting: 'Bekliyor', called: 'Çağrıldı', expired: 'Süre Doldu',
}

export const BREAK_TYPE_LABELS: Record<BreakType, string> = { short: 'Kısa Mola', long: 'Uzun Mola' }
export const BREAK_TYPE_TONE: Record<BreakType, BadgeTone> = { short: 'warning', long: 'info' }

export const EXIT_TYPE_LABELS: Record<ExitType, string> = { manual: 'Normal Çıkış', auto: 'Otomatik Çıkış' }
export const EXIT_TYPE_TONE: Record<ExitType, BadgeTone> = { manual: 'success', auto: 'warning' }

export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  general: 'Genel', silent: 'Sessiz Alan', team: 'Ekip Çalışması', food: 'Yiyecek-İçecek', device: 'Cihaz Kullanımı',
}
export const RULE_CATEGORY_OPTIONS: { value: RuleCategory; label: string }[] = [
  { value: 'general', label: 'Genel' },
  { value: 'silent', label: 'Sessiz Alan' },
  { value: 'team', label: 'Ekip Çalışması' },
  { value: 'food', label: 'Yiyecek-İçecek' },
  { value: 'device', label: 'Cihaz Kullanımı' },
]
export const RULE_SEVERITY_LABELS: Record<RuleSeverity, string> = {
  info: 'Bilgi', warning: 'Uyarı', rule: 'Kural',
}
export const RULE_SEVERITY_TONE: Record<RuleSeverity, BadgeTone> = {
  info: 'info', warning: 'warning', rule: 'danger',
}
export const RULE_SEVERITY_OPTIONS: { value: RuleSeverity; label: string }[] = [
  { value: 'info', label: 'Bilgi' },
  { value: 'warning', label: 'Uyarı' },
  { value: 'rule', label: 'Kural' },
]

export const ENTRY_CONTROL_LABELS: Record<EntryControlMode, string> = {
  kiosk: 'Kiosk', qr: 'QR Okuyucu', manual: 'Manuel', none: 'Kontrol Yok',
}

export interface CheckInResult {
  entered: boolean
  queued: boolean
  seat: string | null
  queueNumber: string | null
  message: string
  overdueCount?: number
  overdueBooks?: { title: string; author?: string | null; dueDate: string; daysOverdue: number }[] | null
}

export interface EmanetStatus {
  enabled: boolean
  configured: boolean
  lastSuccessAt?: string | null
  lastErrorAt?: string | null
  lastError?: string | null
}

export interface OverdueBookEntry {
  memberName: string
  tckn: string
  libraryId: string
  libraryName: string
  bookTitle: string
  bookAuthor?: string
  dueDate: string
  daysOverdue: number
}

export interface LibraryAnalyticsParams {
  from?: string
  to?: string
  libraryId?: string
}

export interface LibraryAnalytics {
  activeNow: number
  onBreakNow: number
  waitingNow: number
  occupancyRateNow: number
  totalVisits: number
  avgDailyVisits: number
  avgSessionMinutes: number
  avgBreaksPerSession: number
  avgAge: number | null
  under18Count: number
  age18to25Count: number
  age26to35Count: number
  age36to50Count: number
  over50Count: number
  maleCount: number
  femaleCount: number
  topLibraries: TopLibrary[]
  topUsers: TopUser[]
  topUsersByHours: TopUserByHours[]
  totalBreaks: number
  breakRatePct: number
  hourlyLoad: HourlyLoad[]
  // Kullanıcı isteği (2026-10-05): eski (2019-2026) MySQL tabanlı Millet Kıraathanesi
  // sisteminden içe aktarılmış, dönem filtresinden bağımsız tüm-zamanlar kullanım geçmişi.
  legacyTopUsers: LegacyTopUser[]
  // Kullanıcı isteği (2026-10-05, devam): eski sistemi kullanmış TÜM kişilerin (yalnız
  // top-10 değil) cinsiyet/yaş/mahalle kırılımı — Katılımcılar demografi raporuyla aynı tip.
  legacyUserDemographics: ParticipantDemographicsOverview | null
}

export interface TopLibrary { libraryId: string; libraryName: string; visitCount: number; avgOccupancyPct: number }
export interface TopUser { memberName: string; maskedTckn: string; visitCount: number; avgSessionMinutes: number }
export interface TopUserByHours { memberName: string; maskedTckn: string; totalHours: number; visitCount: number }
export interface HourlyLoad { hour: number; visitCount: number }
export interface LegacyTopUser {
  memberName: string
  maskedTckn: string
  totalVisits: number
  totalHours: number
  firstVisitAt: string
  lastVisitAt: string
  primaryLocationName?: string | null
  matchedToParticipant: boolean
}

export type LibraryDeviceDirection = 'entry' | 'exit'
export type LibraryDeviceOperationMode = 'directional' | 'toggle'

export interface LibraryDeviceRecord {
  id: string
  libraryId: string
  name: string
  direction: LibraryDeviceDirection
  deviceId?: string
  ipAddress?: string
  port: number
  username?: string
  hasPassword: boolean
  relayNo: number
  relayMs: number
  workMode: 'online' | 'offline'
  httpPath?: string
  triggerLockOnSuccess: boolean
  deviceCode: string
  apiKey?: string
  isActive: boolean
  operationMode: LibraryDeviceOperationMode
  toggleCooldownMinutes: number
  lastSeenAt?: string | null
  isOnline?: boolean
}

export interface LibraryDeviceForm {
  name: string
  direction: LibraryDeviceDirection
  deviceId: string
  ipAddress: string
  port: number
  username: string
  password: string
  relayNo: number
  relayMs: number
  workMode: 'online' | 'offline'
  httpPath: string
  triggerLockOnSuccess: boolean
  operationMode: LibraryDeviceOperationMode
  toggleCooldownMinutes: number
}

export const AMENITY_OPTIONS: { value: string; label: string }[] = [
  { value: 'wifi', label: 'Ücretsiz Wi-Fi' },
  { value: 'ac', label: 'Klima' },
  { value: 'power', label: 'Priz / Şarj' },
  { value: 'cafe', label: 'Kafeterya' },
  { value: 'printer', label: 'Yazıcı / Tarayıcı' },
  { value: 'study', label: 'Sessiz Çalışma' },
  { value: 'accessible', label: 'Engelli Erişimi' },
  { value: 'silent', label: 'Sessiz Bölge' },
  { value: 'cctv', label: 'Güvenlik Kamerası' },
  { value: 'lighting', label: 'Doğal Aydınlatma' },
  { value: 'locker', label: 'Kişisel Dolap' },
]

export interface PlannedDeviceInput {
  direction: 'entry' | 'exit'
  operationMode: 'directional' | 'toggle'
  triggerLockOnSuccess: boolean
}

export interface HardwareVerificationRequest {
  requestedTemplateId: string
  seatingMode: string | null
  queueEnabled: boolean
  reservationEnabled: boolean
  breakSystemEnabled: boolean
  accessType: string | null
  plannedDevices: PlannedDeviceInput[]
}

export interface HardwareVerificationResult {
  requestedTemplateId: string
  isSatisfied: boolean
  missingRequirements: string[]
  fallbackTemplateId: string | null
}

export interface LibraryTemplateCapabilities {
  entry: boolean
  exit: boolean
  qrEntry: boolean
  entryDevice: boolean
  exitDevice: boolean
  magneticLock: boolean
  seatSelection: boolean
  reservation: boolean
  shortBreak: boolean
  longBreak: boolean
  queue: boolean
  waitingList: boolean
  points: boolean
  penalties: boolean
}

export interface LibraryTemplateDefinition {
  id: string
  displayName: string
  recommendedFor: string
  requiredHardware: string[]
  capabilities: LibraryTemplateCapabilities
  editableSettingsKeys: string[]
}

export type LibraryStaticQrMode = 'attendance' | 'entry' | 'entry_exit' | 'split'

export interface LibraryStaticQr {
  enabled: boolean
  mode: LibraryStaticQrMode
  code?: string | null
  entryCode?: string | null
  exitCode?: string | null
  minExitSeconds?: number
  reentryCooldownSeconds?: number
}

export interface LibraryDoorQr {
  token: string
  rotationSeconds: number
  expiresAt: string
  shortCode: string
}
