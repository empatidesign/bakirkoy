import type { FullResidencyMode } from '@/lib/residency'

export type VenueType = 'indoor' | 'outdoor'
export type EventGender = 'male' | 'female' | 'mixed'
export type ParticipationPeriod = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type ReservationType = 'none' | 'row' | 'seat'
export type RegistrationMode = 'required' | 'optional' | 'none'
export type EntryMethod = 'checkin' | 'checkin-checkout'
export type QrType = 'rotating' | 'static'
export type EventStatus = 'active' | 'inactive'

export interface EventLocation {
  name: string
  latitude?: number
  longitude?: number
}

// Kullanıcı isteği (2026-09-20): Gezi (Travel) modülündeki TravelResponsible deseninin
// Etkinlik Takvimi karşılığı — "Etkinlik Sorumlusu" atandığında yalnızca o etkinlikle
// sınırlı (scoped) bir hesap açılabilir.
export interface EventResponsible {
  id?: string
  name?: string
  role?: string
  roleKey?: string
  phone?: string
  email?: string
  grantAccess?: boolean
  tckn?: string
}

export interface EventImageVariant {
  url?: string
  width: number
  height: number
  maxSizeKb: number
}

export interface EventImageGroup {
  cover: EventImageVariant
  card: EventImageVariant
  thumb: EventImageVariant
}

export interface GalleryPhoto {
  id: string
  url: string
  name?: string
  size?: number
  isPrimary?: boolean
}

export type EventImageRatio = '16:9' | '4:3' | '1:1' | '9:16'

export type EventImageRatios = Record<EventImageRatio, EventImageVariant>

export interface EventImageSet {
  web: EventImageGroup
  mobile: EventImageGroup
  ratios: EventImageRatios
  photos?: GalleryPhoto[]
}

export interface EventScheduleSlot {
  day: string
  startTime: string
  endTime: string
}

export interface EventSchedule {
  days: string[]
  slots: EventScheduleSlot[]
}

export interface EventAccessConfig {
  hasSessions: boolean
  hasSeating: boolean
  reservationType: ReservationType
  registrationMode: RegistrationMode
  attendanceEnabled: boolean
  entryMethod: EntryMethod
  qrEnabled: boolean
  kioskEnabled: boolean
  turnstileEnabled: boolean
  publicLinkEnabled: boolean
  publicLinkRequiresPin: boolean
  staffIds: string[]
  notificationTemplates?: { event: string; smsEnabled: boolean; smsBody: string }[]
  cancellationDeadlineHours?: number
  geofenceEnabled?: boolean
  geofenceRadiusMeters?: number
}

// Kullanıcı isteği (2026-10-06): "QR okutma kütüphane/tesislerde olduğu gibi cihazlı veya
// cihazsız çalışsın, aynı mantık her yerde geçerli olsun" — Facility'deki FacilityStaticQr/
// FacilityStaticQrMode ile birebir aynı şekil, Event'e uyarlandı. Önceden EventAccessConfig'teki
// qrType/qrRotationSeconds alanları hiçbir backend karşılığı olmadan kaydediliyordu (bkz.
// docs/etkinlik-erisim-yoklama-derin-inceleme-2026-07-29.md madde 10/11) — kaldırıldı, yerine
// gerçek çalışan sabit QR altyapısı geldi.
export type EventStaticQrMode = 'attendance' | 'entry' | 'entry_exit' | 'split'

export interface EventStaticQr {
  enabled: boolean
  mode: EventStaticQrMode
  code?: string | null
  entryCode?: string | null
  exitCode?: string | null
  minExitSeconds: number
  reentryCooldownSeconds: number
}

export interface EventAudienceFee {
  key: string
  label: string
  enabled: boolean
  price: number
}

export interface EventSiblingDiscount {
  order: number
  label: string
  percent: number
}

export interface EventPricingConfig {
  isPaid: boolean
  currency: string
  audiences: EventAudienceFee[]
  siblingDiscountEnabled: boolean
  siblingDiscounts: EventSiblingDiscount[]
  municipalityEmployeeDiscountEnabled: boolean
  municipalityEmployeePercent: number
  disabledDiscountEnabled: boolean
  disabledPercent: number
  veteranDiscountEnabled: boolean
  veteranPercent: number
  combineDiscounts: boolean
  maxDiscountPercent: number
}

export interface EventPointsConfig {
  enabled: boolean
  basePoints: number
  walkInEarnsPoints: boolean
}

export interface Event {
  id: string
  code: string
  name: string
  categoryId: string
  categoryName: string
  categoryColor: string
  venueType: VenueType
  facilityId?: string
  facilityName?: string
  hallId?: string
  hallName?: string
  location?: EventLocation
  startDate: string
  endDate: string
  startTime?: string
  endTime?: string
  applicationStartDate?: string | null
  applicationEndDate?: string | null
  gender: EventGender
  capacity: number
  reserveCapacity: number
  minAge: number
  maxAge: number
  participationPeriod: ParticipationPeriod
  participationLimit: number
  description: string
  internalNote: string
  images: EventImageSet
  access: EventAccessConfig
  pricing: EventPricingConfig
  points: EventPointsConfig
  isActive: boolean
  residencyMode: FullResidencyMode
  sultangaziResidentOnly: boolean
  registeredCount: number
  reserveCount: number
  sessionCount: number
  createdAt: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
  deletedAt?: string
  deletedBy?: string
  responsible?: EventResponsible
}

export interface EventFormData {
  name: string
  categoryId: string
  venueType: VenueType
  facilityId: string
  hallId: string
  location: EventLocation
  startDate: string
  endDate: string
  isSingleDay: boolean
  startTime: string
  endTime: string
  applicationStartDate: string
  applicationEndDate: string
  gender: EventGender
  capacity: number
  reserveCapacity: number
  minAge: number
  maxAge: number
  participationPeriod: ParticipationPeriod
  participationLimit: number
  description: string
  internalNote: string
  images: EventImageSet
  access: EventAccessConfig
  pricing: EventPricingConfig
  points: EventPointsConfig
  isActive: boolean
  residencyMode: FullResidencyMode
  sultangaziResidentOnly: boolean
  responsible: EventResponsible
}

export interface EventSummary {
  total: number
  active: number
  passive: number
  totalRegistered: number
  totalCapacity: number
}

// Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme/kopyalama" — Travel/FacilityGroup
// modüllerindeki çoklu kopyalama deseninin Etkinlik karşılığı. Her hedef kendi tarih (ve
// isteğe bağlı başvuru tarihi) aralığını taşır; diğer tüm alanlar kaynaktan aynen miras alınır.
export interface EventBulkCopyTarget {
  startDate: string
  endDate: string
  applicationStartDate?: string | null
  applicationEndDate?: string | null
}

export interface EventBulkCopyResultItem {
  index: number
  success: boolean
  eventId: string | null
  code: string | null
  error: string | null
}

export interface EventBulkCopyResult {
  results: EventBulkCopyResultItem[]
}

export type EventAuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'restored'
  | 'permanent-deleted'
  | 'copied'
  | 'attendance-config-changed'

export interface EventAuditEntry {
  id: string
  action: EventAuditAction
  at: string
  actorName: string
  note?: string
}
