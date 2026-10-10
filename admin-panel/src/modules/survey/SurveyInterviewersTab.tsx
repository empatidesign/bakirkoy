import { useCallback, useEffect, useMemo, useState } from 'react'
import { UsersIcon, TargetIcon, CheckCircle2Icon, TimerIcon, FlagIcon, MessageSquareIcon } from 'lucide-react'
import {
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  FilterField,
  Progress,
  Select,
  SkeletonRows,
  StatCard,
  type DataTableColumn,
} from '@/design-system'
import surveyPlatformService from '@/services/surveyPlatform.service'
import surveyService from '@/services/survey.service'
import { formatDate } from '@/lib/utils'
import type { SurveyInterviewerStats } from '@/types/surveyPlatform.types'
import type { SelectOption } from '@/types/common'
import { SurveyInterviewerMessageModal } from './SurveyInterviewerMessageModal'

export const SurveyInterviewersTab = () => {
  const [rows, setRows] = useState<SurveyInterviewerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [surveyOptions, setSurveyOptions] = useState<SelectOption[]>([])
  const [surveyFilter, setSurveyFilter] = useState('')
  // Kullanıcı isteği (2026-09-01): anketörlere toplu mesaj / duyuru / SMS.
  const [messageTarget, setMessageTarget] = useState<{ ids?: string[]; label: string } | null>(null)
  // Kullanıcı isteği (2026-09-02, Anketör Performansı ile aynı düzen): sıra no + sayfalama
  // + arama. Uç tüm anketörleri tek seferde döndüğü için sayfalama istemcide yapılır.
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [search, setSearch] = useState('')

  useEffect(() => {
    surveyService
      .getList({ page: 1, limit: 100, sort: 'createdAt', order: 'desc' })
      .then((res) => setSurveyOptions(res.items.map((s) => ({ value: s.id, label: s.title }))))
      .catch(() => setSurveyOptions([]))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    surveyPlatformService
      .getInterviewers(surveyFilter ? { surveyId: surveyFilter } : {})
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [surveyFilter])

  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    if (!q) return rows
    return rows.filter((r) =>
      r.name.toLocaleLowerCase('tr').includes(q)
      || (r.department ?? '').toLocaleLowerCase('tr').includes(q)
      || r.neighborhoods.some((n) => n.toLocaleLowerCase('tr').includes(q)))
  }, [rows, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit))
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * limit, page * limit),
    [filtered, page, limit],
  )
  useEffect(() => { if (page > totalPages) setPage(1) }, [page, totalPages])

  const totals = useMemo(() => ({
    interviewers: rows.length,
    completed: rows.reduce((s, r) => s + r.completedCount, 0),
    target: rows.reduce((s, r) => s + r.totalTarget, 0),
    flagged: rows.reduce((s, r) => s + r.flaggedCount, 0),
  }), [rows])

  const columns: DataTableColumn<SurveyInterviewerStats>[] = [
    {
      key: 'name', header: 'Anketör',
      cell: (r) => (
        <div className="leading-tight">
          <span className="type-body-strong">{r.name}</span>
          {r.department && <span className="block type-caption">{r.department}</span>}
        </div>
      ),
    },
    {
      key: 'neighborhoods', header: 'Mahalleler',
      cell: (r) => <span className="type-caption line-clamp-2">{r.neighborhoods.join(', ') || '—'}</span>,
    },
    { key: 'taskCount', header: 'Görev', align: 'center', cell: (r) => <span className="tabular-nums">{r.activeTaskCount} / {r.taskCount}</span> },
    {
      key: 'progress', header: 'Gerçekleşme',
      cell: (r) => (
        <div className="min-w-[140px] space-y-1">
          <div className="flex items-center justify-between type-caption">
            <span className="tabular-nums">{r.completedCount} / {r.totalTarget || '—'}</span>
            <span className="tabular-nums">%{Math.round(r.progressPercent)}</span>
          </div>
          <Progress value={Math.min(100, r.progressPercent)} tone={r.progressPercent >= 100 ? 'success' : 'primary'} />
        </div>
      ),
    },
    { key: 'todayCount', header: 'Bugün', align: 'center', cell: (r) => <span className="tabular-nums">{r.todayCount}</span> },
    { key: 'avgDuration', header: 'Ort. Süre', align: 'center', cell: (r) => <span className="tabular-nums type-muted">{r.averageDurationSeconds > 0 ? `${Math.round(r.averageDurationSeconds)} sn` : '—'}</span> },
    { key: 'flaggedCount', header: 'Şüpheli Kayıt', align: 'center', cell: (r) => r.flaggedCount > 0 ? <span className="tabular-nums text-[hsl(var(--danger))] font-medium">{r.flaggedCount}</span> : <span className="type-muted">—</span> },
    { key: 'lastResponseAt', header: 'Son Kayıt', align: 'center', cell: (r) => <span className="whitespace-nowrap type-muted">{r.lastResponseAt ? formatDate(r.lastResponseAt) : '—'}</span> },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Aktif Anketör" value={totals.interviewers} icon={UsersIcon} accent="blue" />
        <StatCard label="Tamamlanan Anket" value={totals.completed} icon={CheckCircle2Icon} accent="green" />
        <StatCard label="Toplam Hedef" value={totals.target} icon={TargetIcon} accent="violet" />
        <StatCard label="Şüpheli Kayıt" value={totals.flagged} icon={FlagIcon} accent="orange" />
      </div>

      <FilterBar hasActiveFilters={!!surveyFilter} onClear={() => setSurveyFilter('')} columns={2}>
        <FilterField label="Anket">
          <Select value={surveyFilter} onChange={(e) => setSurveyFilter(e.target.value)}>
            <option value="">Tüm Anketler</option>
            {surveyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
      </FilterBar>

      {loading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={TimerIcon} title="Saha kaydı yok" description="Henüz bir saha görevi veya kaydı bulunmuyor." />
      ) : (
        <>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => setMessageTarget({
              ids: filtered.map((r) => r.interviewerId),
              label: `${filtered.length} anketör (listedeki tümü)`,
            })}
          >
            <MessageSquareIcon className="mr-1.5 h-4 w-4" /> Toplu Mesaj / Duyuru
          </Button>
        </div>
        <DataTable
          columns={columns}
          rows={pageRows}
          rowKey={(r) => r.interviewerId}
          title="Anketörler"
          showRowNumbers
          searchable
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1) }}
          searchPlaceholder="Anketör, birim veya mahalle ara..."
          page={page}
          limit={limit}
          total={filtered.length}
          totalPages={totalPages}
          onPageChange={setPage}
          onLimitChange={(n) => { setLimit(n); setPage(1) }}
          rowActions={(r) => (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setMessageTarget({ ids: [r.interviewerId], label: r.name })}
            >
              <MessageSquareIcon className="mr-1.5 h-3.5 w-3.5" /> Mesaj
            </Button>
          )}
        />
        </>
      )}

      <SurveyInterviewerMessageModal
        open={messageTarget !== null}
        onClose={() => setMessageTarget(null)}
        interviewerIds={messageTarget?.ids}
        targetLabel={messageTarget?.label}
      />
    </div>
  )
}
