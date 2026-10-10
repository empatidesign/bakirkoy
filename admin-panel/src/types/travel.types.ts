import type { EventImageSet } from './event.types'
import type { BusSeatState } from '@/components/specialized/seating/busSeatModel'
import type { FullResidencyMode } from '@/lib/residency'

export type TravelGender = 'male' | 'female' | 'mixed'
export type ParticipationPeriod = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type ApplicationStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'waitlist'
export type DocumentStatus = 'pending' | 'complete' | 'missing'
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'waived'
export type RefundPolicy = 'full' | 'partial' | 'none'

export interface TravelCategory {
  id: string
  name: string
  description: string
  color: string
  travelCount: number
  totalCapacity: number
  totalRegistered: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface TravelCategoryFormData {
  name: string
  description: string
  color: string
  isActive: boolean
}

export interface TravelRestrictions {
  residencyMode: FullResidencyMode
  sultangaziResidentOnly: boolean
  allowOutsideSultangazi: boolean
  requiresGuardianConsent: boolean
  maxCompanions: number
  documentRequired: boolean
  /** Kullanıcı isteği (2026-08-07, senaryo 4): otobüslü gezilerde çocuk katılımı ayrı bir ayardır. */
  allowChildren: boolean
  maxChildren: number
  childMinAge: number
  childMaxAge: number
  childGenderMode: 'mixed' | 'male' | 'female'
}

export interface TravelAudienceFee {
  key: string
  label: string
  enabled: boolean
  price: number
}

export interface TravelPricingConfig {
  isPaid: boolean
  currency: string
  audiences: TravelAudienceFee[]
  depositEnabled: boolean
  depositAmount: number
  refundPolicy: RefundPolicy
}

export interface TravelPointsConfig {
  enabled: boolean
  basePoints: number
}

export interface TravelCrewMember {
  id: string
  name: string
  phone: string
  tckn?: string
}

export interface TravelResponsible {
  id: string
  name: string
  role: string
  roleKey: string
  phone: string
  email: string
  emergencyPhone: string
  grantAccess?: boolean
  tckn?: string
}

export interface TravelCrew {
  driver: TravelCrewMember
  guide: TravelCrewMember
  responsible: TravelResponsible
}

export interface Travel {
  id: string
  code: string
  routeId: string
  name: string
  categoryId: string
  categoryName: string
  categoryColor: string
  destination: string
  departurePoint?: string
  latitude?: number
  longitude?: number
  description: string
  conditions: string
  internalNote: string
  startDate: string
  endDate: string
  registrationStartDate: string
  registrationEndDate: string
  gender: TravelGender
  minAge: number
  maxAge: number
  capacity: number
  registeredCount: number
  reserveCount: number
  reserveCapacity: number
  participationPeriod: ParticipationPeriod
  participationLimit: number
  /** true ise bu sefer, genel katılım sıklığı sınırından (dönem başına en fazla N gezi) muaftır. */
  exemptFromParticipationLimit: boolean
  cancellationDeadlineHours: number
  restrictions: TravelRestrictions
  images: EventImageSet
  pricing: TravelPricingConfig
  points: TravelPointsConfig
  crew: TravelCrew
  busCount: number
  isActive: boolean
  /** Kullanıcı isteği (2026-09-30): Facility modüllerindeki SessionRecord.attendanceTaken ile
   *  aynı amaçla — liste ekranında "Yoklama Al" / "Yoklamayı Görüntüle" aksiyonunu ayırt eder. */
  attendanceTaken?: boolean
  createdAt?: string
  updatedAt?: string
  deletedAt?: string
  deletedBy?: string
}

/**
 * "Gezi" — lokasyon/rota (ör. Çanakkale) ve ona ait tüm içerik bilgisi.
 * Bir Route altında birden çok Sefer (Travel) açılabilir; içerik alanları
 * yalnızca Route üzerinden düzenlenir, Sefer bunları miras alır (override edilemez).
 */
export interface TravelRoute {
  id: string
  name: string
  categoryId: string
  categoryName: string
  categoryColor: string
  destination: string
  departurePoint?: string
  latitude?: number
  longitude?: number
  description: string
  conditions: string
  internalNote: string
  gender: TravelGender
  minAge: number
  maxAge: number
  restrictions: TravelRestrictions
  images: EventImageSet
  pricing: TravelPricingConfig
  points: TravelPointsConfig
  isActive: boolean
  sultangaziResidentOnly: boolean
  travelCount: number
  activeTravelCount: number
  createdAt?: string
  updatedAt?: string
}

export interface TravelRouteFormData {
  name: string
  categoryId: string
  destination: string
  departurePoint?: string
  latitude?: number
  longitude?: number
  description: string
  conditions: string
  internalNote: string
  gender: TravelGender
  minAge: number
  maxAge: number
  restrictions: TravelRestrictions
  images: EventImageSet
  pricing: TravelPricingConfig
  points: TravelPointsConfig
  isActive: boolean
  sultangaziResidentOnly: boolean
}

/**
 * "Sefer" — bir Route'un belirli tarihli somut kalkışı. İçerik alanları yoktur;
 * tümü Route'tan miras alınır. Yalnızca tarih, kapasite, ekip ve otobüs ataması
 * sefer bazında tanımlanır.
 */
export interface TravelFormData {
  routeId: string
  startDate: string
  endDate: string
  registrationStartDate: string
  registrationEndDate: string
  capacity: number
  reserveCapacity: number
  participationPeriod: ParticipationPeriod
  participationLimit: number
  exemptFromParticipationLimit: boolean
  cancellationDeadlineHours: number
  crew: TravelCrew
  busIds: string[]
  isActive: boolean
}

/**
 * Sefer kopyalama isteği. Route'a bağlı tüm içerik kaynak seferden aynen
 * miras alınır; yalnızca tarihler ve isteğe bağlı otobüs ataması değişir.
 */
export interface TravelCopyRequest {
  startDate: string
  endDate: string
  registrationStartDate: string
  registrationEndDate: string
  cloneBuses: boolean
}

// Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme/kopyalama" — tek seferden birden fazla
// hedef tarih aralığı için bağımsız sefer kopyası tek işlemde oluşturulur.
export interface TravelBulkCopyResultItem {
  index: number
  success: boolean
  travelId: string | null
  code: string | null
  error: string | null
}

export interface TravelBulkCopyResult {
  results: TravelBulkCopyResultItem[]
}

export interface TravelSummary {
  total: number
  active: number
  passive: number
  totalRegistered: number
  totalCapacity: number
  /** routeId verilmemişse (Geziler ana sayfası) toplam Gezi (rota) sayısı; bir gruba özel bakılırken 1'dir. */
  totalRoutes: number
  averageRating: number
  totalReviews: number
  heldToDate: number
  upcoming: number
}

export type TravelVehicleType = 'bus' | 'capacity'

export interface TravelBus {
  id: string
  travelName?: string
  name: string
  plateNumber: string
  templateId: string
  capacity: number
  seatStates: Record<string, BusSeatState>
  occupiedCount: number
  isActive: boolean
  vehicleType: TravelVehicleType
  sourceBusId?: string | null
}

export interface TravelBusFormData {
  name: string
  plateNumber: string
  templateId: string
  seatStates: Record<string, BusSeatState>
  vehicleType: TravelVehicleType
  capacity: number
}

export interface TravelBusUsageEntry {
  travelId: string
  travelName: string
  travelCode: string
  startDate: string
  endDate: string
  isClone: boolean
}

export interface TravelBusUsageHistory {
  busId: string
  busName: string
  sourceBusId?: string | null
  sourceBusName?: string | null
  usedInTravels: TravelBusUsageEntry[]
}

export interface TravelBusSummary {
  totalBuses: number
  totalCapacity: number
  totalOccupied: number
  activeTravels: number
}

export interface TravelSeatOccupant {
  seatNumber: string
  gender: string
  name?: string | null
}

export interface TravelBusSeating {
  busId: string
  name: string
  plateNumber: string
  templateId: string
  capacity: number
  seatStates: Record<string, BusSeatState>
  lockedSeatIds: string[]
  occupants: TravelSeatOccupant[]
  vehicleType: TravelVehicleType
  occupiedCount: number
}

export interface TravelApplication {
  id: string
  travelId: string
  travelName: string
  participantId: string
  participantName: string
  tckn: string
  phone: string
  email: string
  gender: TravelGender
  birthDate?: string
  neighborhood?: string | null
  address?: string | null
  applicationDate: string
  travelStartDate?: string | null
  travelEndDate?: string | null
  status: ApplicationStatus
  documentStatus: DocumentStatus
  paymentStatus: PaymentStatus
  busId?: string
  busName?: string
  seatNumber?: string
  notes: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  isGuest: boolean
  guestFullName?: string | null
  guestTckn?: string | null
  guestPhone?: string | null
  guestEmail?: string | null
  guestBirthDate?: string | null
  guestGender?: string | null
  applicantName?: string | null
  applicantTckn?: string | null
  rejectionReason?: string | null
}

export interface TravelApplicationFormData {
  travelId: string
  participantId: string
  status: ApplicationStatus
  documentStatus: DocumentStatus
  paymentStatus: PaymentStatus
  busId: string
  seatNumber: string
  notes: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  /** Kullanıcı isteği (2026-08-07): admin, gezinin ikamet/cinsiyet/yaş kısıtlarına uymayan bir
   * katılımcıyı da bilinçli olarak ("serbest ekleme") ekleyebilmeli. Yalnızca bu 3 kısıt atlanır;
   * kontenjan/koltuk/tekrar-başvuru/tarih-çakışması kontrolleri her zaman uygulanır. */
  overrideEligibility?: boolean
}

export interface TravelApplicationSummary {
  total: number
  approved: number
  reviewing: number
  rejected: number
  waitlist: number
}

export interface TravelRestrictionRule {
  id: string
  type: string
  description: string
  active: boolean
}

export interface TravelRuleItem {
  id: string
  title: string
  content: string
  active: boolean
}

export interface TravelSettings {
  general: {
    maxParticipants: number
    minAge: number
    maxAge: number
    advanceBookingDays: number
    cancellationDeadlineDays: number
    requireApproval: boolean
    reserveListEnabled: boolean
    /** true ise, kayıtlı olduğu bir geziye katılmayan (no-show) üye bir sonraki gezi başvurusunda engellenir. */
    noShowBlocksNextTravel: boolean
    /** Kalkıştan kaç saat önce hatırlatma bildirimi gönderilsin. */
    attendanceReminderHoursBeforeDeparture: number
    /** Üye olmayan toplu T.C. kayıtlarına üyelik daveti otomatik gönderilsin. */
    autoInviteSmsEnabled: boolean
    /** Davet SMS'inin kaç dakika sonra gönderileceği. */
    inviteSmsDelayMinutes: number
    /** Kullanıcı isteği (2026-08-29): kalkış hatırlatması SMS'e ek olarak e-posta ile de gönderilsin. */
    attendanceReminderEmailEnabled?: boolean
  }
  participation: {
    defaultPeriod: ParticipationPeriod
    defaultLimitCount: number
    applyToVehicleFreeTravels: boolean
  }
  restrictions: TravelRestrictionRule[]
  rules: TravelRuleItem[]
  notificationTemplates: TravelNotificationTemplate[]
}

/**
 * Kullanıcı isteği (2026-08-07): Gezi modülündeki tüm mesajlaşma (başvuru alındı, onay,
 * ret, yedek liste, iptal, yaklaşan gezi hatırlatması, manuel gönderim) tek bir şablon
 * sistemi altında birleştirildi. Facility/Event modüllerindeki aynı desen — her olay için
 * SMS ve uygulama-içi bildirim kanalı ayrı ayrı aç/kapa edilebilir, metinlerde
 * {{placeholder}} değişkenleri kullanılabilir.
 */
export type TravelNotificationEvent =
  | 'application_received'
  | 'approved'
  | 'rejected'
  | 'waitlist'
  | 'promoted'
  | 'promoted_approved'
  | 'cancelled'
  | 'postponed'
  | 'emergency'
  | 'departure_reminder'
  | 'manual'

export interface TravelNotificationTemplate {
  event: TravelNotificationEvent
  smsEnabled: boolean
  smsBody: string
  notifyEnabled: boolean
  notifyBody: string
}

/** {{sefer}} {{tarih}} {{saat}} {{guzergah}} {{kalkis_noktasi}} {{ad}} {{soyad}} {{sira}} */
export const TRAVEL_NOTIFICATION_PLACEHOLDERS = [
  '{{ad}}', '{{soyad}}', '{{sefer}}', '{{tarih}}', '{{saat}}', '{{guzergah}}', '{{kalkis_noktasi}}', '{{sira}}',
]

export interface TravelAuditEntry {
  id: string
  action: string
  changedAt: string
  changedBy: string
  oldValue?: unknown
  newValue?: unknown
}

/** Kullanıcı isteği (2026-08-07): geziye toplu TC kimlik numarası ile yolcu ekleme. */
export interface TravelBulkTcknEntry {
  tckn: string
  phone?: string
  /** Koltuklu bir araç seçiliyse, bu yolcunun oturacağı koltuk (opsiyonel — boşsa kontenjan bazlı eklenir). */
  seatNumber?: string
  /** Kişi sistemde kayıtlı değilse, sonuç ekranında görünmesi için ad-soyad (opsiyonel — kayıtlı üyeler için sistemden gelir, bu alan yalnızca gösterim amaçlıdır). */
  fullName?: string
}

export type TravelBulkTcknOutcome = 'added' | 'invite_sent' | 'invite_skipped' | 'no_contact' | 'duplicate' | 'invalid' | 'failed'

export interface TravelParticipationHistoryItem {
  travelName: string
  startDate: string
  endDate: string
  status: string
}

export interface TravelBulkTcknResultItem {
  tckn: string
  outcome: TravelBulkTcknOutcome
  participantName?: string | null
  reason?: string | null
  history?: TravelParticipationHistoryItem[] | null
}

export interface TravelBulkTcknResult {
  total: number
  added: number
  invitesSent: number
  skipped: number
  items: TravelBulkTcknResultItem[]
}

/**
 * Kullanıcı isteği (2026-08-07): manuel/toplu mesaj gönderme ekranı — bir sefere ait
 * yolculara (opsiyonel durum filtresiyle) seçilen şablonu (her yolcuya kişiselleştirilmiş)
 * ya da tamamen özel bir metni gönderir. customText verilmişse şablon yerine bu metin
 * kullanılır (yine {{placeholder}} interpolasyonu uygulanır).
 */
export interface TravelManualMessageRequest {
  travelId: string
  templateEvent: TravelNotificationEvent
  customText?: string | null
  sms: boolean
  notify: boolean
  statusFilter?: ApplicationStatus[]
  // Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20 iki kez): SMS göndermek için
  // doğrulama kodu (OTP) zorunlu. PIN yöntemi kaldırıldı.
  smsOtp?: string
}

export interface TravelManualMessageResult {
  recipients: number
  smsSent: number
  notificationsCreated: number
  smsMockMode?: boolean
}

// Kullanıcı isteği (2026-09-30): Facility modüllerindeki (Spor Salonu vb.) "Yoklama Al"
// ekranıyla (Tümü Geldi/Tümü Gelmedi + segmented control liste) aynı desende, Gezi
// modülüne de yoklama roster'ı — backend (TravelAttendanceService) zaten hazırdı,
// admin-panel tarafında hiç UI yoktu (bkz. DevNotesPage.tsx "travels-extra").
export type TravelAttendanceStatus = 'present' | 'late' | 'absent' | 'none'

export interface TravelAttendanceRosterItem {
  passengerId: string
  applicationId: string
  participantId?: string | null
  fullName: string
  tckn: string
  busName?: string | null
  seatNumber?: string | null
  status: TravelAttendanceStatus
}

export interface TravelAttendanceRoster {
  travelId: string
  travelName: string
  startDate: string
  endDate: string
  started: boolean
  ended: boolean
  taken: boolean
  takenAt?: string | null
  reminderSentAt?: string | null
  overdue: boolean
  items: TravelAttendanceRosterItem[]
}

export interface TravelAttendanceMark {
  passengerId: string
  status: TravelAttendanceStatus
}

export interface TravelAttendanceSaveResult {
  marked: number
}
