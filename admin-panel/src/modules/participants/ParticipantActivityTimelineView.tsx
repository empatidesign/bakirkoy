import { useEffect, useState } from 'react'
import {
  ActivityIcon, ClockIcon, Loader2Icon, CalendarDaysIcon, DumbbellIcon, WavesIcon,
  TentIcon, MicroscopeIcon, HeartHandshakeIcon, PlaneIcon, GraduationCapIcon,
  BookOpenIcon, MegaphoneIcon, BrainIcon, ClipboardListIcon, GiftIcon, Building2Icon,
  CircleDotIcon, UsersRoundIcon,
} from 'lucide-react'
import { Badge, EmptyState, Select } from '@/design-system'
import reportsService from '@/services/reports.service'
import { REPORTS_MODULE_LABELS } from '@/types/reports.types'
import type { ParticipantActivityDetail } from '@/types/reports.types'
import type { Participant } from '@/types/participant.types'

const formatDateTime = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const MODULE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  events: CalendarDaysIcon,
  sports: DumbbellIcon,
  kasif: TentIcon,
  pool: WavesIcon,
  'youth-camp': TentIcon,
  'scout-camp': TentIcon,
  'science-center': MicroscopeIcon,
  'accessible-life': HeartHandshakeIcon,
  'women-family': UsersRoundIcon,
  travels: PlaneIcon,
  seda: GraduationCapIcon,
  library: BookOpenIcon,
  muhtarlik: MegaphoneIcon,
  quiz: BrainIcon,
  survey: ClipboardListIcon,
  wheel: GiftIcon,
  companies: Building2Icon,
}

const MODULE_COLORS: Record<string, string> = {
  events: '#2563eb',
  sports: '#059669',
  kasif: '#d97706',
  pool: '#0891b2',
  'youth-camp': '#65a30d',
  'scout-camp': '#16a34a',
  'science-center': '#7c3aed',
  'accessible-life': '#db2777',
  'women-family': '#e11d48',
  travels: '#0284c7',
  seda: '#ca8a04',
  library: '#4f46e5',
  muhtarlik: '#dc2626',
  quiz: '#9333ea',
  survey: '#0d9488',
  wheel: '#f97316',
  companies: '#64748b',
}

const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tüm Zamanlar' },
  { value: 'year', label: 'Bu Yıl' },
  { value: 'month', label: 'Bu Ay' },
  { value: 'week', label: 'Bu Hafta' },
]

export const ParticipantActivityTimelineView = ({ participant }: { participant: Participant }) => {
  const [range, setRange] = useState('all')
  const [detail, setDetail] = useState<ParticipantActivityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setNotFound(false)
    const params = range === 'all'
      ? { preset: 'custom' as const, from: '1900-01-01', to: new Date().toISOString().slice(0, 10) }
      : { preset: range as 'week' | 'month' | 'year' }
    reportsService.getParticipantActivityDetail({ participantId: participant.id }, params)
      .then((d) => { if (active) setDetail(d) })
      .catch(() => { if (active) { setDetail(null); setNotFound(true) } })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [participant.id, range])

  const breakdown = Object.entries(detail?.moduleBreakdown ?? {}).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef3f8]">
            <ActivityIcon className="h-4 w-4 text-[#0f4c81]" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground-strong">Zaman Çizelgesi — Tüm Modüller</h4>
            <p className="type-caption">Etkinlik, spor, kaşif, havuz, kamp, bilim merkezi, engelsiz yaşam, gezi, SEDA, kütüphane, muhtarlık, quiz, anket, çark, firma/kampanya</p>
          </div>
        </div>
        <div className="w-44">
          <Select value={range} onChange={(e) => setRange(e.target.value)}>
            {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-foreground-muted">
          <Loader2Icon className="h-5 w-5 animate-spin" />
        </div>
      ) : notFound || !detail || detail.entries.length === 0 ? (
        <EmptyState icon={ActivityIcon} title="Aktivite kaydı yok" description="Seçili dönemde bu katılımcı için hiçbir modülde kayıt bulunamadı." />
      ) : (
        <>
          <div className="rounded-lg border border-border bg-surface-1 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="type-caption font-semibold uppercase tracking-wide text-foreground-subtle">Modül Dağılımı ({breakdown.length} farklı modül)</p>
              <span className="type-body-strong">{detail.totalCount} toplam kayıt</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {breakdown.map(([m, c]) => {
                const Icon = MODULE_ICONS[m] ?? CircleDotIcon
                const color = MODULE_COLORS[m] ?? '#64748b'
                return (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
                    style={{ color, backgroundColor: `${color}18` }}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {REPORTS_MODULE_LABELS[m] ?? m}
                    <span className="rounded-pill bg-white/70 px-1.5 text-[10px]">{c}</span>
                  </span>
                )
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-border bg-[#eef3f8]/60 px-4 py-3">
              <ClockIcon className="h-4 w-4 text-[#0f4c81]" />
              <p className="text-sm font-semibold text-foreground-strong">Kronolojik Geçmiş ({detail.entries.length})</p>
            </div>
            <div className="max-h-[480px] divide-y divide-border/60 overflow-y-auto">
              {detail.entries.map((e, i) => {
                const Icon = MODULE_ICONS[e.module] ?? CircleDotIcon
                const color = MODULE_COLORS[e.module] ?? '#64748b'
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18`, color }}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="type-body-strong truncate">{e.itemName ?? e.moduleLabel}</p>
                      <p className="type-caption">{e.moduleLabel} · {formatDateTime(e.activityDate)}</p>
                    </div>
                    <Badge tone="neutral">{e.status}</Badge>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
