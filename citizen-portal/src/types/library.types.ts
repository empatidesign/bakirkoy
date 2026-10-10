export type CitizenLibraryReservationStatus = 'held' | 'consumed' | 'cancelled' | 'expired'

export interface CitizenLibrary {
  id: string
  name: string
  imageUrl?: string | null
  district?: string | null
  city?: string | null
  address?: string | null
  capacity: number
  floorCount: number
  amenities: string[]
  managerPhone?: string | null
  seatingMode: string
  accessType?: string
  deviceKind?: string | null
  reservationEnabled: boolean
  queueEnabled: boolean
  inside: number
  onBreak: number
  free: number
  waiting: number
  latitude?: number | null
  longitude?: number | null
  areaType: string
  occupancyRate: number
  entryControlMode?: string
}

export interface CitizenLibraryAreaOption {
  value: string
  label: string
  count: number
}

export interface CitizenLibraryFilters {
  areaTypes: CitizenLibraryAreaOption[]
  totalCount: number
  availableCount: number
}

export interface CitizenLibraryRule {
  id: string
  category: string
  title: string
  description: string
  icon: string
  severity: string
}

export interface CitizenLibraryDetail extends CitizenLibrary {
  description?: string | null
  isMultiFloor: boolean
  emergencyPhone?: string | null
  reservationHoldWindowMinutes?: number | null
  maxReservationMinutes?: number | null
  breakDurationMinutes?: number | null
  longBreakDurationMinutes?: number | null
  maxDailyBreaks?: number | null
  maxDailyLongBreaks?: number | null
  shortBreakCooldownMinutes?: number | null
  breakReturnGraceMinutes?: number | null
  rules: CitizenLibraryRule[]
  staticQrEnabled?: boolean
  staticQrMode?: 'attendance' | 'entry' | 'entry_exit' | 'split'
  parkingCapacity?: number | null
  parkingType?: string | null
  nearestEmergencyAreaName?: string | null
  nearestEmergencyAreaDistanceKm?: number | null
  entryControlMode?: string
}

export type CitizenLibraryMovementKind = 'entry' | 'exit' | 'break_start' | 'break_end'

export interface CitizenLibraryMovement {
  id: string
  kind: CitizenLibraryMovementKind
  libraryName: string
  floorName?: string | null
  seatLabel?: string | null
  at: string
  breakType?: string | null
}

export interface CitizenLibrarySeat {
  seat: string
  status: string
}

export interface CitizenLibrarySeatNode {
  key: string
  number: number
  label: string
  status: string
}

export interface CitizenLibrarySeatTable {
  id: string
  name: string
  seatCount: number
  seats: CitizenLibrarySeatNode[]
}

export interface CitizenLibrarySeatSection {
  id: string
  name: string
  type: string
  color: string
  capacity: number
  tables: CitizenLibrarySeatTable[]
}

export interface CitizenLibraryFloor {
  id: string
  name: string
  capacity: number
  krokiUrl?: string | null
  seats: CitizenLibrarySeatNode[]
  sections?: CitizenLibrarySeatSection[] | null
}

export interface CitizenLibrarySeatPlan {
  seatingMode: string
  floors: CitizenLibraryFloor[]
}

export interface CitizenLibraryReservation {
  id: string
  libraryId: string
  libraryName: string
  district?: string | null
  seat?: string | null
  floorName?: string | null
  sectionName?: string | null
  seatLabel?: string | null
  status: CitizenLibraryReservationStatus
  reservedAt: string
  slotStart?: string | null
  slotEnd?: string | null
  holdUntil: string
}

export const LIBRARY_RESERVATION_LABELS: Record<CitizenLibraryReservationStatus, string> = {
  held: 'Aktif Rezervasyon',
  consumed: 'Kullanıldı',
  cancelled: 'İptal edildi',
  expired: 'Süresi doldu',
}

export const LIBRARY_RESERVATION_TONE: Record<CitizenLibraryReservationStatus, 'info' | 'success' | 'neutral'> = {
  held: 'info',
  consumed: 'success',
  cancelled: 'neutral',
  expired: 'neutral',
}

export const LIBRARY_SEAT_TAKEN = new Set(['occupied', 'held', 'blocked'])

export interface CitizenFloorCount {
  id: string
  name: string
  capacity: number
  inside: number
}

export interface CitizenStatusPerson {
  participantId?: string | null
  name: string
  isMe: boolean
  seat?: string | null
  seatLabel?: string | null
  breakRemainingMinutes?: number | null
}

export interface CitizenStatusQueue {
  participantId?: string | null
  name: string
  isMe: boolean
  position: number
  status: string
  callRemainingMinutes?: number | null
}

export interface CitizenMyLibraryState {
  state:
    | 'none'
    | 'held'
    | 'queued'
    | 'called'
    | 'inside'
    | 'on_break_short'
    | 'on_break_long'
    | 'break_expired'
    | 'exit_pending'
  queuePosition?: number | null
  queueStatus?: string | null
  callRemainingMinutes?: number | null
  seat?: string | null
  holdRemainingMinutes?: number | null
}

export interface CitizenLibraryStatus {
  libraryId: string
  name: string
  seatingMode: string
  reservationEnabled: boolean
  reservationAllowed?: boolean
  queueEnabled: boolean
  capacity: number
  inside: number
  onBreak: number
  free: number
  waiting: number
  floors: CitizenFloorCount[]
  insideList: CitizenStatusPerson[]
  onBreakList: CitizenStatusPerson[]
  queueList: CitizenStatusQueue[]
  my: CitizenMyLibraryState
  breakSystemEnabled: boolean
}

export interface CitizenQueueJoinResult {
  id: string
  position: number
  queueNumber: string
}

export interface CitizenMyQueue {
  id: string
  libraryId: string
  libraryName: string
  position: number
  status: string
  callRemainingMinutes?: number | null
  queueNumber: string
}

export type CitizenSessionStatus =
  | 'inside'
  | 'on_break_short'
  | 'on_break_long'
  | 'break_expired'
  | 'exit_pending'
  | 'completed'
  | 'no_show'
  | 'staff_closed'
  | 'device_error'

export const isSessionOnBreak = (status?: string | null): boolean =>
  status === 'on_break_short' || status === 'on_break_long'

export const isSessionActive = (status?: string | null): boolean =>
  status === 'inside' ||
  status === 'on_break_short' ||
  status === 'on_break_long' ||
  status === 'break_expired' ||
  status === 'exit_pending'

export interface CitizenSession {
  id: string
  libraryId: string
  libraryName: string
  district?: string | null
  floorName?: string | null
  sectionName?: string | null
  seatLabel?: string | null
  status: CitizenSessionStatus
  entryTime: string
  durationMinutes: number
  estimatedExitAt?: string | null
  remainingMinutes?: number | null
  maxStudyMinutes?: number | null
  breakEndsAt?: string | null
  breakRemainingMinutes?: number | null
  breakType?: string | null
  shortBreaksUsed?: number
  longBreaksUsed?: number
  remainingShortBreaks?: number | null
  remainingLongBreaks?: number | null
  breakDurationMinutes?: number
  longBreakDurationMinutes?: number
  breakSystemEnabled?: boolean
}

export interface CitizenLibraryMyStats {
  totalVisits: number
  totalExits: number
  totalMinutes: number
  monthMinutes: number
  weekMinutes: number
  todayMinutes: number
  shortBreaks: number
  longBreaks: number
  noShowExits: number
  avgSessionMinutes: number
}

export interface PendingExitResult {
  pendingExitAt: string
  expiresInSeconds: number
  message: string
}

export interface CitizenLibraryHourlyLoad {
  hour: number
  count: number
}

export interface CitizenLibraryStats {
  capacity: number
  activeNow: number
  occupancyRate: number
  peakHour?: number | null
  todayEntries: number
  todayExits: number
  avgStayMinutes: number
  hourlyLoad: CitizenLibraryHourlyLoad[]
}

export const seatLabel = (key: string | null | undefined): string => (key ? (key.split(':').pop() ?? key) : '')

export const fmtDuration = (minutes?: number | null): string => {
  const total = Math.max(0, minutes ?? 0)
  if (total === 0) return ''
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h > 0 && m > 0) return `${h} saat ${m} dakika`
  if (h > 0) return `${h} saat`
  return `${m} dakika`
}
