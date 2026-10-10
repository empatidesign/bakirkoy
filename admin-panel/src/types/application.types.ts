import type { Gender } from './participant.types'
import type { SeatingLayout } from './hall.types'

export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'reviewing' | 'waitlist'
export type DocumentStatus = 'none' | 'missing' | 'reviewing' | 'complete'
export type PaymentStatus = 'unpaid' | 'paid' | 'partial' | 'refund' | 'exempt'

export interface Application {
  id: string
  code: string
  eventId: string
  eventName: string
  eventCategoryName: string
  eventCategoryColor: string
  sessionId?: string
  sessionLabel?: string
  eventDate: string
  day: string
  participantId: string
  participantName: string
  tckn: string
  gender: Gender
  age: number
  phone?: string
  email?: string
  status: ApplicationStatus
  documentStatus: DocumentStatus
  paymentStatus: PaymentStatus
  seatNumber?: string
  appliedAt: string
  appliedBy?: string
  rejectionReason?: string | null
}

export interface ApplicationForm {
  participantId: string
  eventId: string
  sessionId: string
  status: ApplicationStatus
  documentStatus: DocumentStatus
  paymentStatus: PaymentStatus
  seatNumber?: string
}

export type SeatMapState = 'closed' | 'protocol' | 'occupied'

export interface SeatMap {
  hallId?: string
  hallName?: string
  layout?: SeatingLayout
  states: Record<string, SeatMapState>
  reservationType: string
}

export interface ApplicationSummary {
  total: number
  approved: number
  pending: number
  rejected: number
  reviewing: number
  waitlist: number
}

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Beklemede',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  reviewing: 'İnceleniyor',
  waitlist: 'Yedek Liste',
}
export const APPLICATION_STATUS_TONE: Record<ApplicationStatus, Tone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  reviewing: 'info',
  waitlist: 'warning',
}
export const APPLICATION_STATUS_OPTIONS = (Object.keys(APPLICATION_STATUS_LABELS) as ApplicationStatus[])
  .map((v) => ({ value: v, label: APPLICATION_STATUS_LABELS[v] }))

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  none: 'Gerekmiyor',
  missing: 'Eksik',
  reviewing: 'İnceleniyor',
  complete: 'Tamamlandı',
}
export const DOCUMENT_STATUS_TONE: Record<DocumentStatus, Tone> = {
  none: 'neutral',
  missing: 'danger',
  reviewing: 'info',
  complete: 'success',
}
export const DOCUMENT_STATUS_OPTIONS = (Object.keys(DOCUMENT_STATUS_LABELS) as DocumentStatus[])
  .map((v) => ({ value: v, label: DOCUMENT_STATUS_LABELS[v] }))

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Ödenmedi',
  paid: 'Ödendi',
  partial: 'Kısmi',
  refund: 'İade',
  exempt: 'Muaf',
}
export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  unpaid: 'warning',
  paid: 'success',
  partial: 'info',
  refund: 'neutral',
  exempt: 'neutral',
}
export const PAYMENT_STATUS_OPTIONS = (Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[])
  .map((v) => ({ value: v, label: PAYMENT_STATUS_LABELS[v] }))
