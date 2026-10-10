
const pad = (n: number) => String(n).padStart(2, '0')

// Kod denetimi 2026-08-08 (kullanıcı isteği: mesai sistemi derin denetim) — üç ayrı sayfada
// (MesaiTab, MesaiOverviewPage, MesaiReportsPage) initiationType gösterimi ayrı ayrı, birbiriyle
// TUTARSIZ yazılmıştı: MesaiOverviewPage/MesaiReportsPage "self" olmayan HER ŞEYİ (ip-auto,
// door-qr dahil) "(Yönetici)" olarak etiketliyordu — bu yanlış, çünkü IP eşleşmesiyle otomatik
// başlatılan ya da kapı QR'ıyla başlatılan bir mesai yönetici tarafından başlatılmamıştır.
// Tek doğru kaynak burası.
export const initiationLabel = (initiationType: string, initiatedByName?: string | null): string => {
  switch (initiationType) {
    case 'self': return 'Kendisi'
    case 'ip-auto': return 'Otomatik · Ağ'
    case 'door-qr': return 'Kapı QR'
    default: return initiatedByName || 'Yönetici'
  }
}


export const occupancyTone = (rate: number): 'danger' | 'warning' | 'success' =>
  rate >= 90 ? 'danger' : rate >= 70 ? 'warning' : 'success'

export const occupancyLabel = (rate: number) => (rate >= 90 ? 'Çok Dolu' : rate >= 70 ? 'Dolu' : 'Müsait')

export const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const fmtTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'

export const fmtDuration = (minutes?: number) => {
  if (minutes == null || minutes <= 0) return '0dk'
  const totalHours = Math.floor(minutes / 60)
  const m = minutes % 60
  if (totalHours >= 24) {
    const d = Math.floor(totalHours / 24)
    const h = totalHours % 24
    const parts = [`${d} gün`]
    if (h > 0) parts.push(`${h}sa`)
    if (m > 0) parts.push(`${m}dk`)
    return parts.join(' ')
  }
  return totalHours > 0 ? `${totalHours}sa ${m}dk` : `${m}dk`
}

export const fmtRemaining = (minutes: number) => (minutes <= 0 ? 'Süre aşıldı' : `${minutes} dakika`)

export const secondsUntil = (iso: string | undefined, now: number) =>
  iso ? Math.round((new Date(iso).getTime() - now) / 1000) : 0

export const fmtCountdown = (totalSeconds: number) => {
  const s = Math.max(0, totalSeconds)
  return `${Math.floor(s / 60)}:${pad(s % 60)}`
}

export const fmtRelative = (iso: string, now: number) => {
  const diffMin = Math.round((now - new Date(iso).getTime()) / 60000)
  if (diffMin <= 0) return 'şimdi'
  if (diffMin < 60) return `${diffMin} dk önce`
  const h = Math.floor(diffMin / 60)
  return `${h} saat önce`
}

const isoDateOnly = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export interface DailyBreakdownEntry { date: string; totalMinutes: number; shiftCount: number }

export const sumDailyBreakdown = (
  daily: DailyBreakdownEntry[],
  fromDate: Date,
  toDate: Date,
): { totalMinutes: number; shiftCount: number } => {
  const from = isoDateOnly(fromDate)
  const to = isoDateOnly(toDate)
  return daily.reduce(
    (acc, d) => (d.date >= from && d.date <= to
      ? { totalMinutes: acc.totalMinutes + d.totalMinutes, shiftCount: acc.shiftCount + d.shiftCount }
      : acc),
    { totalMinutes: 0, shiftCount: 0 },
  )
}

export const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
export const daysAgo = (n: number) => { const d = startOfToday(); d.setDate(d.getDate() - n); return d }
export const startOfMonth = () => { const d = startOfToday(); d.setDate(1); return d }
