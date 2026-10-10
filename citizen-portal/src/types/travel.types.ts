export type CitizenTravelStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'waitlist'

export interface CitizenTravel {
  id: string
  code: string
  name: string
  categoryName: string
  categoryColor: string
  destination: string
  latitude?: number | null
  longitude?: number | null
  departureDate: string
  returnDate: string
  isSingleDay: boolean
  gender: string
  minAge: number
  maxAge: number
  capacity: number
  registeredCount: number
  reserveCapacity: number
  waitlistCount: number
  requiresSeat: boolean
  imageUrl?: string | null
  photos?: string[]
  descriptionPreview: string
  eligible: boolean
  alreadyApplied: boolean
  guideName?: string | null
  driverName?: string | null
  registrationStartDate: string
  registrationEndDate: string
  applicationOpen: boolean
}

export interface CitizenTravelApplicant {
  participantId: string
  fullName: string
  isSelf: boolean
  age: number
  gender: string
  eligible: boolean
  ineligibleReason?: string | null
  alreadyApplied: boolean
  requiresGuardian: boolean
}

export interface CitizenTravelSeat {
  label: string
  status: string
  occupantGender?: string | null
  occupantName?: string | null
}

export interface CitizenTravelSeatOccupant {
  seatNumber: string
  gender: string
  companionName?: string | null
  isOwnAccount?: boolean
  isSameFamily?: boolean
}

export interface CitizenTravelBus {
  busId: string
  name: string
  plateNumber: string
  templateId: string
  capacity: number
  seatStates: Record<string, { status?: string } | string | null>
  lockedSeatIds: string[]
  occupants: CitizenTravelSeatOccupant[]
  seats: CitizenTravelSeat[]
  vehicleType: 'bus' | 'capacity'
  occupiedCount: number
}

export interface CitizenTravelDetail extends CitizenTravel {
  descriptionHtml: string
  conditionsHtml: string
  applicants: CitizenTravelApplicant[]
  buses: CitizenTravelBus[]
  photos?: string[]
  cancellationDeadlineHours?: number
  /** Tek rezervasyonda seçilebilecek toplam kişi sayısı üst sınırı (kendisi dahil). */
  maxGroupSize?: number
  /** Kullanıcı isteği (2026-08-07, senaryo 4): otobüslü gezilerde çocuk katılımı ayarları. */
  allowChildren?: boolean
  maxChildren?: number
  childMinAge?: number
  childMaxAge?: number
  childGenderMode?: 'mixed' | 'male' | 'female'
}

export interface CitizenTravelApplication {
  id: string
  code: string
  travelId: string
  travelName: string
  categoryName: string
  categoryColor: string
  destination: string
  latitude?: number | null
  longitude?: number | null
  departureDate: string
  returnDate: string
  venueName: string
  status: CitizenTravelStatus
  personId: string
  personName: string
  isSelf: boolean
  busId?: string | null
  busName?: string | null
  plateNumber?: string | null
  seatNumber?: string | null
  appliedAt: string
  cancellationDeadlineHours: number
  guideName?: string | null
  travelDeleted?: boolean
  hasCompanion?: boolean
  companionCount?: number
  rejectionReason?: string | null
}

export const TRAVEL_STATUS_LABELS: Record<CitizenTravelStatus, string> = {
  pending: 'Beklemede',
  reviewing: 'İnceleniyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  waitlist: 'Yedek',
}

export const TRAVEL_STATUS_TONE: Record<CitizenTravelStatus, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  pending: 'warning',
  reviewing: 'info',
  approved: 'success',
  rejected: 'danger',
  waitlist: 'neutral',
}

export const TRAVEL_SEAT_TAKEN = new Set(['occupied', 'locked', 'blocked', 'reserved', 'driver', 'guide'])

export interface CitizenTravelGuest {
  tckn: string
  birthDate: string
  phone: string
  email: string
}

export interface CitizenReservationPassenger {
  participantId?: string | null
  seatNumber?: string | null
  guest?: CitizenTravelGuest | null
}

export interface CitizenReservationRequest {
  busId?: string | null
  passengers: CitizenReservationPassenger[]
  hasCompanion?: boolean
  companionCount?: number
  /** Kullanıcı isteği (2026-08-04): koltuklu (otobüslü) gezide refakatçi artık isimsiz bir sayı
   * değil — yan koltuğa oturan kişinin ad-soyadı (ve varsa cinsiyeti, koltuk cinsiyet kısıtı için)
   * zorunludur. Kontenjanlı gezilerde opsiyoneldir. */
  companionName?: string | null
  companionGender?: 'male' | 'female' | null
}

export const emptyTravelGuest = (): CitizenTravelGuest => ({
  tckn: '',
  birthDate: '',
  phone: '',
  email: '',
})
