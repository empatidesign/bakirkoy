import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RadioIcon, FootprintsIcon, MapPinIcon, ClipboardCheckIcon, RefreshCwIcon, RouteIcon, ClockIcon,
} from 'lucide-react'
import {
  Badge, Button, DataTable, DatePicker, EmptyState, FilterBar, FilterField,
  SkeletonRows, StatCard, Select, type DataTableColumn,
} from '@/design-system'
import surveyPlatformService from '@/services/surveyPlatform.service'
import surveyService from '@/services/survey.service'
import { SurveyFieldLiveMap } from '@/components/specialized/SurveyFieldLiveMap'
import {
  FIELD_PRESENCE_LABELS,
  FIELD_PRESENCE_TONE,
} from '@/types/surveyPlatform.types'
import type { SurveyFieldLiveAgent, SurveyFieldTrail } from '@/types/surveyPlatform.types'
import type { SelectOption } from '@/types/common'

// Kullanıcı isteği (2026-09-01): "canlı haritada saha görevlileri canlı takip edilecek, GPS
// açık olacak, ne kadar yürüdüğünü nereleri gezdiğini de takip edeceğiz."
// Sol tarafta canlı harita, sağ/alt tarafta anketör tablosu; bir anketör seçildiğinde o güne
// ait yürüyüş rotası, duraklamaları ve anket doldurduğu noktalar haritaya çizilir.

const REFRESH_MS = 20_000

const todayIso = () => new Date().toISOString().split('T')[0]
const km = (m: number) => `${(m / 1000).toFixed(2)} km`
const clock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'

export const SurveyFieldLiveTab = () => {
  const [agents, setAgents] = useState<SurveyFieldLiveAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [trail, setTrail] = useState<SurveyFieldTrail | null>(null)
  const [trailLoading, setTrailLoading] = useState(false)
  const [date, setDate] = useState(todayIso())
  const [surveyFilter, setSurveyFilter] = useState('')
  const [surveyOptions, setSurveyOptions] = useState<SelectOption[]>([])

  useEffect(() => {
    surveyService
      .getList({ page: 1, limit: 100, sort: 'createdAt', order: 'desc' })
      .then((res) => setSurveyOptions(res.items.map((s) => ({ value: s.id, label: s.title }))))
      .catch(() => setSurveyOptions([]))
  }, [])

  const loadAgents = useCallback(async () => {
    try {
      setAgents(await surveyPlatformService.getLiveAgents(surveyFilter ? { surveyId: surveyFilter } : {}))
    } catch {
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [surveyFilter])

  useEffect(() => {
    setLoading(true)
    void loadAgents()
    const timer = window.setInterval(() => { void loadAgents() }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [loadAgents])

  const loadTrail = useCallback(async (id: string, day: string) => {
    setTrailLoading(true)
    try {
      setTrail(await surveyPlatformService.getAgentTrail(id, day))
    } catch {
      setTrail(null)
    } finally {
      setTrailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedId) { setTrail(null); return }
    void loadTrail(selectedId, date)
  }, [selectedId, date, loadTrail])

  const totals = useMemo(() => ({
    online: agents.filter((a) => a.presenceStatus === 'online').length,
    distance: agents.reduce((s, a) => s + a.todayDistanceMeters, 0),
    points: agents.reduce((s, a) => s + a.todayVisitedPointCount, 0),
    responses: agents.reduce((s, a) => s + a.todayResponseCount, 0),
  }), [agents])

  const columns: DataTableColumn<SurveyFieldLiveAgent>[] = [
    {
      key: 'name', header: 'Saha Görevlisi',
      cell: (a) => (
        <div className="leading-tight">
          <span className="type-body-strong">{a.name}</span>
          <span className="block type-caption text-foreground-subtle">
            {a.activeSurveyTitle ?? 'Görev yok'} · {a.neighborhood}
          </span>
        </div>
      ),
    },
    {
      key: 'presence', header: 'Durum', align: 'center',
      cell: (a) => (
        <div className="flex flex-col items-center gap-0.5">
          <Badge tone={FIELD_PRESENCE_TONE[a.presenceStatus]}>{FIELD_PRESENCE_LABELS[a.presenceStatus]}</Badge>
          <span className="type-caption text-foreground-subtle">{clock(a.lastSeenAt)}</span>
        </div>
      ),
    },
    {
      key: 'distance', header: 'Bugün Yürüyüş', align: 'center',
      cell: (a) => <span className="tabular-nums">{km(a.todayDistanceMeters)}</span>,
    },
    {
      key: 'points', header: 'Gezilen Nokta', align: 'center',
      cell: (a) => <span className="tabular-nums">{a.todayVisitedPointCount}</span>,
    },
    {
      key: 'today', header: 'Bugün Anket', align: 'center',
      cell: (a) => <span className="tabular-nums type-body-strong">{a.todayResponseCount}</span>,
    },
    {
      key: 'total', header: 'Toplam / Hedef', align: 'center',
      cell: (a) => (
        <span className="tabular-nums">
          {a.totalResponseCount}{a.targetCount > 0 ? ` / ${a.targetCount}` : ''}
        </span>
      ),
    },
    {
      key: 'action', header: '', align: 'right',
      cell: (a) => (
        <Button
          size="sm"
          variant={selectedId === a.interviewerId ? 'primary' : 'outline'}
          onClick={() => setSelectedId(selectedId === a.interviewerId ? null : a.interviewerId)}
        >
          <RouteIcon className="mr-1.5 h-3.5 w-3.5" />
          {selectedId === a.interviewerId ? 'İzi gizle' : 'Gün izi'}
        </Button>
      ),
    },
  ]

  return (
    <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sahada (canlı)" value={totals.online} icon={RadioIcon} accent="green" />
        <StatCard label="Bugün Yürünen" value={km(totals.distance)} icon={FootprintsIcon} accent="blue" />
        <StatCard label="Gezilen Nokta" value={totals.points} icon={MapPinIcon} accent="violet" />
        <StatCard label="Bugün Toplanan Anket" value={totals.responses} icon={ClipboardCheckIcon} accent="orange" />
      </div>

      <FilterBar hasActiveFilters={!!surveyFilter || date !== todayIso()} onClear={() => { setSurveyFilter(''); setDate(todayIso()) }} columns={3}>
        <FilterField label="Anket">
          <Select value={surveyFilter} onChange={(e) => setSurveyFilter(e.target.value)}>
            <option value="">Tüm Anketler</option>
            {surveyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
        <FilterField label="İz Tarihi">
          <DatePicker value={date} onChange={(v) => setDate(v || todayIso())} />
        </FilterField>
        <FilterField label=" ">
          <Button className="w-full sm:w-auto" variant="outline" onClick={() => { void loadAgents(); if (selectedId) void loadTrail(selectedId, date) }}>
            <RefreshCwIcon className="mr-1.5 h-4 w-4" /> Yenile
          </Button>
        </FilterField>
      </FilterBar>

      <div className="min-w-0 max-w-full overflow-hidden rounded-card border border-border shadow-card">
        <SurveyFieldLiveMap
          agents={agents}
          trail={trail}
          selectedId={selectedId}
          onSelect={setSelectedId}
          className="h-[300px] sm:h-[360px] lg:h-[440px]"
        />
      </div>

      {selectedId && (
        <div className="min-w-0 overflow-hidden rounded-card border border-border bg-surface-1 p-4">
          {trailLoading ? (
            <SkeletonRows rows={2} />
          ) : trail ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-body-strong">{trail.name}</span>
                <span className="type-caption text-foreground-muted">
                  {new Date(trail.date).toLocaleDateString('tr-TR')} · {clock(trail.firstSeenAt)} – {clock(trail.lastSeenAt)}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 type-caption">
                <span><FootprintsIcon className="mr-1 inline h-3.5 w-3.5" />Yürünen yol: <b>{km(trail.totalDistanceMeters)}</b></span>
                <span><ClockIcon className="mr-1 inline h-3.5 w-3.5" />Sahada geçen süre: <b>{Math.floor(trail.activeMinutes / 60)} sa {trail.activeMinutes % 60} dk</b></span>
                <span><MapPinIcon className="mr-1 inline h-3.5 w-3.5" />Duraklama: <b>{trail.stops.length}</b></span>
                <span><ClipboardCheckIcon className="mr-1 inline h-3.5 w-3.5" />Konumlu anket: <b>{trail.responsePoints.length}</b></span>
              </div>
              {trail.points.length === 0 && (
                <p className="type-caption text-warning">
                  Bu tarihte konum kaydı yok. Görevli saha ekranını açmamış ya da cihazda konum izni kapalı olabilir.
                </p>
              )}
              {trail.stops.length > 0 && (
                <div className="pt-1">
                  <p className="type-caption text-foreground-muted">
                    Duraklamalar (10 dk ve üzeri):{' '}
                    {trail.stops
                      .map((s) => `${clock(s.arrivedAt)}–${clock(s.leftAt)} (${s.minutesSpent} dk, ${s.responseCount} anket)`)
                      .join(' · ')}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="type-caption text-foreground-muted">Gün izi yüklenemedi.</p>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={5} />
      ) : agents.length === 0 ? (
        <EmptyState
          icon={RadioIcon}
          title="Sahada görevli yok"
          description="Aktif saha görevi atanmış bir anketör bulunmuyor. Saha Görevleri sekmesinden görev atayın."
        />
      ) : (
        <div className="min-w-0 max-w-full overflow-hidden">
          <DataTable columns={columns} rows={agents} rowKey={(a) => a.interviewerId} />
        </div>
      )}
    </div>
  )
}
