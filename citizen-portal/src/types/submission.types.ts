export type SubmissionStatus = 'new' | 'in_review' | 'forwarded' | 'resolved' | 'rejected'

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  new: 'Yeni',
  in_review: 'İncelemede',
  forwarded: "İlgili Birime İletildi",
  resolved: 'Çözüldü',
  rejected: 'Reddedildi',
}

export const SUBMISSION_STATUS_TONE: Record<string, 'warning' | 'info' | 'success' | 'danger' | 'neutral'> = {
  new: 'neutral',
  in_review: 'warning',
  forwarded: 'info',
  resolved: 'success',
  rejected: 'danger',
}

export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  request: 'Talep',
  suggestion: 'İstek / Öneri',
  complaint: 'Şikayet',
  emergency: 'Acil',
}

/** Kullanıcı isteği (2026-08-28): adres ikametgah mı farklı bir yer mi. */
export const ADDRESS_TYPE_LABELS: Record<string, string> = {
  residence: 'İkametgah adresi',
  other: 'Farklı adres',
}

/** Kullanıcı isteği (2026-08-28): mahalle mi Sultangazi geneli mi. */
export const SCOPE_LABELS: Record<string, string> = {
  neighborhood: 'Mahallem',
  district: 'Bakırköy geneli',
}

/** Başvuru sürecindeki tek bir adım (kaç saat sonra gerçekleştiği bilgisiyle). */
export interface SubmissionTimelineItem {
  eventType: string
  eventLabel: string
  status: string
  title: string
  note: string | null
  actorType: string
  occurredAt: string
  hoursSincePrevious: number | null
}

export interface CitizenSubmission {
  id: string
  trackingNo: string | null
  title: string
  description: string
  categoryId: string
  categoryLabel: string
  submissionType: string
  /** Sunucudan gelen Türkçe tür metni (bkz. docs/hata.md #4.1). */
  submissionTypeLabel: string
  priority: string
  /** Sunucudan gelen Türkçe öncelik metni (bkz. docs/hata.md #4.2). */
  priorityLabel: string
  latitude: number | null
  longitude: number | null
  neighborhood: string
  address: string
  addressType: string
  scope: string
  status: string
  statusLabel: string
  submittedAt: string
  forwardedAt: string | null
  resolvedAt: string | null
  mediaUrls: string[]
  routedUnit: string | null
  ulakbelTrackingNo: string | null
  resolutionNote: string | null
  elapsedHours: number | null
  /** Sunucunun belirlediği düzenleme izni (bkz. docs/hata.md #4.4). */
  canEdit: boolean
  timeline: SubmissionTimelineItem[]
}

/** Hata raporu (docs/hata.md #4.4): başvuru düzenleme isteği. */
export interface UpdateSubmissionRequest {
  title: string
  description: string
  submissionType: string
  priority: string
}

export interface CreateSubmissionRequest {
  title: string
  description: string
  categoryId: string
  submissionType: string
  priority: string
  neighborhood: string
  address: string
  latitude: number | null
  longitude: number | null
  notifyMuhtar: boolean
  complaintReason: string | null
  mediaUrls: string[]
  addressType: string
  scope: string
}
