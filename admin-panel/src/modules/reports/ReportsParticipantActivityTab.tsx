import { useState, useEffect, useCallback } from 'react'
import { Users2Icon, SearchIcon, ClockIcon, BarChart3Icon } from 'lucide-react'
import {
  DataTable, FilterBar, FilterField, Input, Select, EmptyState, Badge, Modal, Skeleton,
  type DataTableColumn, type SortState,
} from '@/design-system'
import { DateRangeSelect, type DateRangeValue } from '@/design-system/DateRangeSelect'
import reportsService from '@/services/reports.service'
import { maskTC } from '@/lib/utils'
import { REPORTS_MODULE_LABELS } from '@/types/reports.types'
import type { ParticipantActivityReport, ParticipantActivityRow, ParticipantActivityDetail } from '@/types/reports.types'

const formatDateTime = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const formatDate = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const DetailModal = ({
  row, range, onClose,
}: { row: ParticipantActivityRow | null; range: DateRangeValue; onClose: () => void }) => {
  const [detail, setDetail] = useState<ParticipantActivityDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!row) { setDetail(null); return }
    setLoading(true)
    reportsService.getParticipantActivityDetail(
      { participantId: row.participantId ?? undefined, tckn: row.tckn ?? undefined },
      { preset: range.preset, from: range.preset === 'custom' ? range.from : undefined, to: range.preset === 'custom' ? range.to : undefined },
    )
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [row, range])

  return (
    <Modal open={!!row} onClose={onClose} width={720} className="max-w-[95vw]" bodyClassName="p-0">
      {row && (
        <div className="flex flex-col">
          <div className="relative overflow-hidden ds-hero">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
            <div className="relative flex items-center gap-4 px-6 py-5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-lg font-bold text-white shadow-lg"
                style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)' }}>
                {row.fullName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-white">{row.fullName}</p>
                {row.tckn && <p className="mt-0.5 text-[12px] text-white/70 tabular-nums">{row.tckn}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                    <BarChart3Icon className="h-3 w-3" /> {detail?.totalCount ?? row.totalCount} toplam kullanım
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4 p-5">
            {loading ? (
              <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>
            ) : (
              <>
                <div>
                  <p className="mb-2 type-caption font-semibold uppercase tracking-wide text-foreground-subtle">Modül Dağılımı</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(detail?.moduleBreakdown ?? row.moduleBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([m, c]) => (
                        <Badge key={m} tone="neutral">{REPORTS_MODULE_LABELS[m] ?? m} · {c}</Badge>
                      ))}
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
                  <div className="flex items-center gap-2 border-b border-border bg-[#eef3f8]/60 px-4 py-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#eef3f8]">
                      <ClockIcon className="h-3.5 w-3.5 text-[#0f4c81]" />
                    </div>
                    <p className="text-sm font-semibold text-foreground-strong">Kullanım Geçmişi ({detail?.entries.length ?? 0})</p>
                  </div>
                  {!detail || detail.entries.length === 0 ? (
                    <div className="p-4">
                      <EmptyState icon={Users2Icon} title="Kayıt yok" description="Seçili dönemde başka kullanım kaydı bulunamadı." />
                    </div>
                  ) : (
                    <div className="max-h-[360px] divide-y divide-border/60 overflow-y-auto">
                      {detail.entries.map((e, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="type-body-strong truncate">{e.itemName ?? e.moduleLabel}</p>
                            <p className="type-caption">{e.moduleLabel} · {formatDateTime(e.activityDate)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export const ReportsParticipantActivityTab = () => {
  const [range, setRange] = useState<DateRangeValue>({ preset: 'year' })
  const [module, setModule] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [sort, setSort] = useState<SortState | null>({ key: 'total', dir: 'desc' })
  const [data, setData] = useState<ParticipantActivityReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ParticipantActivityRow | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await reportsService.getParticipantActivity({
        preset: range.preset,
        from: range.preset === 'custom' ? range.from : undefined,
        to: range.preset === 'custom' ? range.to : undefined,
        module: module || undefined,
        search: search || undefined,
        page, limit,
        sort: (sort?.key as 'total' | 'last' | 'first') ?? 'total',
        order: sort?.dir ?? 'desc',
      })
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [range, module, search, page, limit, sort])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const columns: DataTableColumn<ParticipantActivityRow>[] = [
    {
      key: 'fullName', header: 'Ad Soyad',
      cell: (r) => (
        <button type="button" className="text-left hover:text-primary" title="Kullanım detayını gör" onClick={() => setSelected(r)}>
          <span className="type-body-strong block">{r.fullName}</span>
          {r.tckn && <span className="type-caption tabular-nums">{maskTC(r.tckn)}</span>}
        </button>
      ),
    },
    {
      key: 'modules', header: 'Modül Dağılımı',
      cell: (r) => (
        <div className="flex flex-wrap gap-1">
          {Object.entries(r.moduleBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([m, c]) => (
            <Badge key={m} tone="neutral">{REPORTS_MODULE_LABELS[m] ?? m} · {c}</Badge>
          ))}
          {Object.keys(r.moduleBreakdown).length > 4 && <Badge tone="neutral">+{Object.keys(r.moduleBreakdown).length - 4}</Badge>}
        </div>
      ),
    },
    {
      key: 'total', header: 'Toplam Kullanım', align: 'center', sortable: true, sortKey: 'total',
      cell: (r) => <span className="type-body-strong tabular-nums">{r.totalCount.toLocaleString('tr-TR')}</span>,
    },
    {
      key: 'first', header: 'İlk Aktivite', hideable: true, sortable: true, sortKey: 'first',
      cell: (r) => <span className="type-muted whitespace-nowrap">{formatDate(r.firstActivityAt)}</span>,
    },
    {
      key: 'last', header: 'Son Aktivite', hideable: true, sortable: true, sortKey: 'last',
      cell: (r) => (
        <div className="min-w-0">
          {r.lastActivityItemName && (
            <p className="type-body-strong truncate max-w-[220px]" title={r.lastActivityItemName}>
              {r.lastActivityItemName}
              {r.lastActivityModule && <span className="ml-1.5 type-caption text-foreground-muted">({REPORTS_MODULE_LABELS[r.lastActivityModule] ?? r.lastActivityModule})</span>}
            </p>
          )}
          <p className="type-muted whitespace-nowrap">{formatDateTime(r.lastActivityAt)}</p>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar
          columns={3}
          hasActiveFilters={!!searchInput || !!module}
          onClear={() => { setSearchInput(''); setSearch(''); setModule(''); setPage(1) }}
        >
          <FilterField label="Ara">
            <Input
              placeholder="Ad, soyad veya TCKN ara..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
            />
          </FilterField>
          <FilterField label="Modül">
            <Select value={module} onChange={(e) => { setModule(e.target.value); setPage(1) }}>
              <option value="">Tüm Modüller</option>
              {Object.entries(REPORTS_MODULE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>{label}</option>
              ))}
            </Select>
          </FilterField>
          <FilterField label="Dönem">
            <DateRangeSelect value={range} onChange={(v) => { setRange(v); setPage(1) }} />
          </FilterField>
        </FilterBar>
      </div>

      <DataTable<ParticipantActivityRow>
        title="Katılımcı Aktivite Raporu"
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(r) => r.participantId ?? r.tckn ?? r.fullName}
        loading={loading}
        showRowNumbers
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(n) => { setLimit(n); setPage(1) }}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1) }}
        empty={<EmptyState icon={Users2Icon} title="Kayıt yok" description="Seçili dönem ve filtrelere uygun katılımcı aktivitesi bulunamadı." />}
      />

      <DetailModal row={selected} range={range} onClose={() => setSelected(null)} />
    </div>
  )
}
