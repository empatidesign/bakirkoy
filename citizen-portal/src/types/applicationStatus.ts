export type ApplicationStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export type StepState = 'done' | 'active' | 'upcoming' | 'error'

export interface StatusMeta {
  label: string
  tone: ApplicationStatusTone
}

const STATUS_META: Record<string, StatusMeta> = {
  pending: { label: 'Beklemede', tone: 'warning' },
  reviewing: { label: 'İnceleniyor', tone: 'info' },
  approved: { label: 'Onaylandı', tone: 'success' },
  rejected: { label: 'Reddedildi', tone: 'danger' },
  waitlist: { label: 'Yedek Liste', tone: 'warning' },
  cancelled: { label: 'İptal Edildi', tone: 'neutral' },
  held: { label: 'Aktif Rezervasyon', tone: 'info' },
  consumed: { label: 'Kullanıldı', tone: 'success' },
  expired: { label: 'Süresi Doldu', tone: 'neutral' },
}

const FALLBACK: StatusMeta = { label: 'Bilinmiyor', tone: 'neutral' }

export const statusMeta = (status: string): StatusMeta => STATUS_META[status] ?? FALLBACK
export const statusLabel = (status: string): string => statusMeta(status).label
export const statusTone = (status: string): ApplicationStatusTone => statusMeta(status).tone

export interface StepItem {
  key: string
  label: string
  state: StepState
}

const STEP_KEYS = ['received', 'review', 'result'] as const

export interface StepConfig {
  received: StepState
  review: StepState
  result: StepState
  resultLabel: string
  resultTone: ApplicationStatusTone
}

export function applicationSteps(status: string): StepItem[] {
  const cfg = stepConfig(status)
  return [
    { key: 'received', label: 'Başvuru Alındı', state: cfg.received },
    { key: 'review', label: 'Değerlendirme', state: cfg.review },
    { key: 'result', label: cfg.resultLabel, state: cfg.result },
  ]
}

function stepConfig(status: string): StepConfig {
  switch (status) {
    case 'approved':
    case 'consumed':
      return { received: 'done', review: 'done', result: 'done', resultLabel: 'Onaylandı', resultTone: 'success' }
    case 'rejected':
      return { received: 'done', review: 'done', result: 'error', resultLabel: 'Reddedildi', resultTone: 'danger' }
    case 'waitlist':
      return { received: 'done', review: 'done', result: 'active', resultLabel: 'Yedek Liste', resultTone: 'warning' }
    case 'cancelled':
    case 'expired':
      return { received: 'done', review: 'done', result: 'error', resultLabel: statusLabel(status), resultTone: 'neutral' }
    case 'reviewing':
      return { received: 'done', review: 'active', result: 'upcoming', resultLabel: 'Sonuç', resultTone: 'neutral' }
    case 'pending':
    case 'held':
    default:
      return { received: 'done', review: 'active', result: 'upcoming', resultLabel: 'Sonuç', resultTone: 'neutral' }
  }
}

export { STEP_KEYS }
