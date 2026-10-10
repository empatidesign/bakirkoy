export type ActivityKind = 'check_in' | 'check_out'
export type ActivityMethod = 'QR' | 'Manuel' | 'Turnike' | 'Kiosk' | 'Bypass' | '-'

export interface ActivityEntry {
  id: string
  kind: ActivityKind
  at: string
  eventId: string
  eventName: string
  sessionLabel?: string
  participantName: string
  tckn: string
  method: ActivityMethod
  status: string
  walkIn: boolean
}

export interface ActivitySummary {
  checkIn: number
  checkOut: number
  kiosk: number
  walkIn: number
}

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  check_in: 'Giriş',
  check_out: 'Çıkış',
}

export const ACTION_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tümü' },
  { value: 'check_in', label: 'Giriş' },
  { value: 'check_out', label: 'Çıkış' },
]

export const METHOD_TONE: Record<ActivityMethod, Tone> = {
  QR: 'info',
  Manuel: 'neutral',
  Turnike: 'primary',
  Kiosk: 'info',
  Bypass: 'warning',
  '-': 'neutral',
}

export const METHOD_LABELS: Record<ActivityMethod, string> = {
  QR: 'QR',
  Manuel: 'Manuel',
  Turnike: 'Turnike',
  Kiosk: 'Kiosk',
  Bypass: 'Manuel Geçiş',
  '-': '-',
}
