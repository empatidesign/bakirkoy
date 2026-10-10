export type CitizenApplicationStatus = 'pending' | 'approved' | 'rejected' | 'reviewing' | 'waitlist'

export type EventImageRatio = '16:9' | '4:3' | '1:1' | '9:16'

export const pickEventImage = (
  images: Partial<Record<EventImageRatio, string>> | null | undefined,
  preferred: EventImageRatio[],
  fallback?: string | null,
): string | undefined => {
  for (const ratio of preferred) {
    const url = images?.[ratio]
    if (url) return url
  }
  return fallback ?? undefined
}

export interface CitizenEvent {
  id: string
  code: string
  name: string
  categoryName: string
  categoryColor: string
  venueName: string
  facilityName?: string | null
  latitude?: number | null
  longitude?: number | null
  startDate: string
  endDate: string
  isSingleDay: boolean
  gender: string
  minAge: number
  maxAge: number
  capacity: number
  registeredCount: number
  reserveCapacity: number
  waitlistCount: number
  hasSessions: boolean
  registrationMode: string
  imageUrl?: string | null
  images?: Partial<Record<EventImageRatio, string>> | null
  photos?: string[]
  descriptionPreview: string
  eligible: boolean
  eligibleForSelf: boolean
  eligibleForChildren: boolean
  alreadyApplied: boolean
  sessionId?: string | null
  sessionStartTime?: string | null
  sessionEndTime?: string | null
  applicationOpen?: boolean
}

export interface CitizenEventSession {
  id: string
  date: string
  startTime: string
  endTime: string
  hallName?: string | null
  capacity: number
  registeredCount: number
  reserveCapacity: number
  waitlistCount: number
  applicationClosed?: boolean
}

export interface CitizenEventApplicant {
  participantId: string
  fullName: string
  isSelf: boolean
  age: number
  gender: string
  eligible: boolean
  ineligibleReason?: string | null
  alreadyApplied: boolean
  limitReached: boolean
  appliedSessionIds: string[]
}

export interface CitizenEventDetail extends CitizenEvent {
  descriptionHtml: string
  sessions: CitizenEventSession[]
  applicants: CitizenEventApplicant[]
  requiresSeat: boolean
  reservationType: string
  photos?: string[]
  attendanceEnabled: boolean
  qrEnabled: boolean
  entryMethod: string
  cancellationDeadlineHours?: number
  applicationStartDate?: string | null
  applicationEndDate?: string | null
  applicationClosed?: boolean
}

export interface EventCheckInActivity {
  id: string
  kind: string
  at: string
  eventId: string
  eventName: string
  sessionLabel?: string | null
  participantName: string
  tckn: string
  method: string
  status: string
  walkIn: boolean
}

export interface CitizenApplication {
  id: string
  code: string
  eventId: string
  eventName: string
  categoryName: string
  categoryColor: string
  sessionId?: string | null
  sessionLabel?: string | null
  eventDate: string
  venueName: string
  facilityName?: string | null
  latitude?: number | null
  longitude?: number | null
  status: CitizenApplicationStatus
  personId: string
  personName: string
  isSelf: boolean
  appliedAt: string
  seatNumber?: string | null
  reservationType?: string | null
  eventDeleted?: boolean
  cancellationDeadlineHours?: number
  rejectionReason?: string | null
}

export const APPLICATION_STATUS_LABELS: Record<CitizenApplicationStatus, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  reviewing: 'İnceleniyor',
  waitlist: 'Yedek Liste',
}

export const APPLICATION_STATUS_TONE: Record<CitizenApplicationStatus, 'warning' | 'success' | 'danger' | 'info'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  reviewing: 'info',
  waitlist: 'warning',
}

