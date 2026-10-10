import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  TrophyIcon, SmilePlusIcon, FrownIcon, ShieldCheckIcon, InfoIcon, ChevronDownIcon, ChevronRightIcon,
} from 'lucide-react'
import {
  Badge, DataTable, EmptyState, FilterBar, FilterField, Progress, Select,
  SkeletonRows, StatCard, type DataTableColumn,
} from '@/design-system'
import surveyPlatformService from '@/services/surveyPlatform.service'
import surveyService from '@/services/survey.service'
import { formatDate } from '@/lib/utils'
import type {
  SurveyInterviewerPerformance,
  SurveyPerformanceBenchmark,
} from '@/types/surveyPlatform.types'
import type { SelectOption } from '@/types/common'

// Kullanıcı isteği (2026-09-01): "anket görevlilerinin kendi içinde performans takibi
// yapılacak; en çok anket yapan, aldıkları puan ortalamaları, en çok olumlu/olumsuz neler
// almış, neden biri olumlu diğeri olumsuz veya neden hep olumlu — anket sisteminin bir
// aritmetiği/fizibilitesi olsun."
//
// Skorların formülleri backend'de SurveyPerformanceMath içinde açıkça tanımlıdır; bu ekran
// hem sayıları hem de "neden" gerekçelerini yönetici diliyle gösterir.

const pct = (v: number) => `%${v.toFixed(1)}`

const scoreTone = (v: number): 'success' | 'warning' | 'danger' =>
  v >= 75 ? 'success' : v >= 50 ? 'warning' : 'danger'

export const SurveyInterviewerPerformanceTab = () => {
  const [rows, setRows] = useState<SurveyInterviewerPerformance[]>([])
  const [benchmark, setBenchmark] = useState<SurveyPerformanceBenchmark | null>(null)
  const [loading, setLoading] = useState(true)
  const [surveyFilter, setSurveyFilter] = useState('')
  const [surveyOptions, setSurveyOptions] = useState<SelectOption[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  // Kullanıcı isteği (2026-09-02): liste sayfalansın ve satırlar sıra numaralı olsun.
  // Uc tüm anketörleri tek seferde döndüğü için sayfalama istemci tarafında yapılır.
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
      .getInterviewerPerformance(surveyFilter ? { surveyId: surveyFilter } : {})
      .then((res) => { setRows(res.interviewers); setBenchmark(res.benchmark) })
      .catch(() => { setRows([]); setBenchmark(null) })
      .finally(() => setLoading(false))
  }, [surveyFilter])

  useEffect(() => { load() }, [load])

  // Kullanıcı isteği (2026-09-02): arama + sayfalama. Uç tüm anketörleri tek seferde
  // döndürdüğü için filtreleme ve sayfalama istemcide yapılır.
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

  // Filtre/arama sonrası sayfa aralık dışında kalırsa başa dön (boş ekran görünmesin).
  useEffect(() => { if (page > totalPages) setPage(1) }, [page, totalPages])

  const columns: DataTableColumn<SurveyInterviewerPerformance>[] = [
    {
      key: 'name', header: 'Anketör',
      cell: (r) => (
        // Satırın tamamı tıklanabilir (DataTable onRowClick); buradaki ok yalnızca
        // görsel göstergedir, ayrı bir tıklama hedefi değildir.
        <div className="flex items-start gap-1.5 text-left">
          {expanded === r.interviewerId
            ? <ChevronDownIcon className="mt-0.5 h-4 w-4 text-foreground-subtle" />
            : <ChevronRightIcon className="mt-0.5 h-4 w-4 text-foreground-subtle" />}
          <span className="leading-tight">
            <span className="type-body-strong">{r.name}</span>
            <span className="block type-caption text-foreground-subtle">
              {r.department ?? 'Saha Görevlisi'} · {r.neighborhoods.join(', ') || '—'}
            </span>
          </span>
        </div>
      ),
    },
    {
      key: 'completed', header: 'Anket', align: 'center',
      cell: (r) => (
        <div className="min-w-[120px] space-y-1">
          <div className="flex items-center justify-between type-caption">
            <span className="tabular-nums">{r.completedCount}{r.totalTarget > 0 ? ` / ${r.totalTarget}` : ''}</span>
            <span className="tabular-nums">{pct(r.progressPercent)}</span>
          </div>
          <Progress value={Math.min(100, r.progressPercent)} tone={r.progressPercent >= 100 ? 'success' : 'primary'} />
        </div>
      ),
    },
    {
      key: 'score', header: 'Ort. Puan', align: 'center',
      cell: (r) => (
        <div className="leading-tight">
          <span className="tabular-nums type-body-strong">{r.averageScore5.toFixed(2)}</span>
          <span className="block type-caption text-foreground-subtle">/ 5 · {r.scoredResponseCount} yanıt</span>
        </div>
      ),
    },
    {
      key: 'sentiment', header: 'Olumlu / Nötr / Olumsuz', align: 'center',
      cell: (r) => (
        <div className="min-w-[150px]">
          <div className="flex h-2 overflow-hidden rounded-pill bg-surface-2">
            <div style={{ width: `${r.positiveRate}%` }} className="bg-[hsl(var(--success))]" />
            <div style={{ width: `${r.neutralRate}%` }} className="bg-[hsl(var(--warning))]" />
            <div style={{ width: `${r.negativeRate}%` }} className="bg-[hsl(var(--danger))]" />
          </div>
          <span className="mt-1 block type-caption tabular-nums text-foreground-subtle">
            {pct(r.positiveRate)} · {pct(r.neutralRate)} · {pct(r.negativeRate)}
          </span>
        </div>
      ),
    },
    {
      key: 'bias', header: 'Sapma', align: 'center',
      cell: (r) => (
        <span
          className="tabular-nums"
          title="Anketörün olumlu yanıt oranı eksi saha ortalaması. Pozitif değer = ortalamadan fazla olumlu."
        >
          {r.biasIndex > 0 ? '+' : ''}{r.biasIndex.toFixed(1)}
        </span>
      ),
    },
    {
      key: 'reliability', header: 'Güvenilirlik', align: 'center',
      cell: (r) => <Badge tone={scoreTone(r.reliabilityScore)}>{r.reliabilityScore.toFixed(0)}</Badge>,
    },
    {
      key: 'performance', header: 'Performans', align: 'center',
      cell: (r) => <Badge tone={scoreTone(r.performanceScore)}>{r.performanceScore.toFixed(0)}</Badge>,
    },
    {
      key: 'last', header: 'Son Kayıt', align: 'center',
      cell: (r) => <span className="whitespace-nowrap type-muted">{r.lastResponseAt ? formatDate(r.lastResponseAt) : '—'}</span>,
    },
  ]

  const detail = rows.find((r) => r.interviewerId === expanded)
  // Kullanıcı isteği (2026-09-02): sıra no gösterilsin — açılan gerekçe panelinde de
  // anketörün listedeki genel sıra numarası (sayfalama dahil) yazılır.
  const detailIndex = expanded ? filtered.findIndex((r) => r.interviewerId === expanded) : -1
  const detailRowNumber = detailIndex >= 0 ? detailIndex + 1 : null

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Anketör" value={benchmark?.interviewerCount ?? 0} icon={TrophyIcon} accent="blue" />
        <StatCard label="Saha Ort. Puan" value={(benchmark?.averageScore5 ?? 0).toFixed(2)} icon={ShieldCheckIcon} accent="violet" />
        <StatCard label="Saha Olumlu Oranı" value={pct(benchmark?.positiveRate ?? 0)} icon={SmilePlusIcon} accent="green" />
        <StatCard label="Saha Olumsuz Oranı" value={pct(benchmark?.negativeRate ?? 0)} icon={FrownIcon} accent="orange" />
      </div>

      <FilterBar hasActiveFilters={!!surveyFilter} onClear={() => setSurveyFilter('')} columns={2}>
        <FilterField label="Anket">
          <Select value={surveyFilter} onChange={(e) => setSurveyFilter(e.target.value)}>
            <option value="">Tüm Anketler</option>
            {surveyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
      </FilterBar>

      {benchmark && benchmark.totalResponses > 0 && (
        <div className="flex items-start gap-2 rounded-card border border-border bg-surface-1 p-3">
          <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-info" />
          <p className="type-caption text-foreground-muted">
            <b>Aritmetik:</b> Her cevap 0-1 aralığına normalize edilir (puan/ölçek/evet-hayır soruları).
            0,60 ve üzeri <b>olumlu</b>, 0,40 altı <b>olumsuz</b> sayılır. “Sapma”, anketörün olumlu oranı
            eksi saha ortalamasıdır (saha ortalaması {pct(benchmark.positiveRate)}, standart sapma{' '}
            {benchmark.positiveRateStdDev.toFixed(1)} puan) — bu eşiği aşan anketörlerde yönlendirme
            şüphesi incelenir. <b>Güvenilirlik</b> 100'den başlar; hızlı doldurma, tüm sorulara aynı cevap
            (düz çizgi), eksik GPS ve şüpheli kayıt cezaları düşülür. <b>Performans</b> = %45 hedef +
            %25 güvenilirlik + %15 konum kapsaması + %15 saha ortalamasıyla tutarlılık.
            Saha medyan görüşme süresi {benchmark.medianDurationSeconds.toFixed(0)} sn; bunun %40'ından
            hızlı görüşmeler “şüpheli hızlı” işaretlenir.
          </p>
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={TrophyIcon} title="Performans verisi yok" description="Henüz saha görevi veya toplanmış anket bulunmuyor." />
      ) : (
        <>
          {/* Doğrulama bulgusu (2026-09-01, UI): açılan gerekçe paneli tablonun ALTINDA
              çiziliyordu; 50+ anketörlü gerçek listede satıra tıklayan yönetici paneli
              hiç göremiyordu. Panel tablonun üstüne alındı. */}
          {detail && (
            <div className="space-y-3 rounded-card border border-border bg-surface-1 p-4">
              <p className="type-body-strong">
                {detailRowNumber != null && (
                  <span className="mr-1.5 rounded-full bg-[hsl(var(--primary)/0.1)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[hsl(var(--primary))]">
                    #{detailRowNumber}
                  </span>
                )}
                {detail.name} — performans gerekçesi
              </p>

              <ol className="space-y-1">
                {detail.explanations.map((e, i) => (
                  <li key={e} className="flex items-start gap-2 type-caption">
                    <span className="mt-px tabular-nums font-semibold text-[hsl(var(--primary))]">{i + 1}.</span>
                    {e}
                  </li>
                ))}
              </ol>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 type-caption text-success">En çok olumlu geri bildirim alınan sorular</p>
                  {detail.topPositiveTopics.length === 0 ? (
                    <p className="type-caption text-foreground-subtle">—</p>
                  ) : (
                    <ol className="space-y-0.5">
                      {detail.topPositiveTopics.map((t, i) => (
                        <li key={t.label} className="flex items-baseline justify-between gap-3 type-caption">
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="tabular-nums text-foreground-subtle">{i + 1}.</span>
                            <span className="line-clamp-1">{t.label}</span>
                          </span>
                          <span className="tabular-nums text-foreground-subtle">{t.count} · {pct(t.percentage)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
                <div>
                  <p className="mb-1 type-caption text-danger">En çok olumsuz geri bildirim alınan sorular</p>
                  {detail.topNegativeTopics.length === 0 ? (
                    <p className="type-caption text-foreground-subtle">—</p>
                  ) : (
                    <ol className="space-y-0.5">
                      {detail.topNegativeTopics.map((t, i) => (
                        <li key={t.label} className="flex items-baseline justify-between gap-3 type-caption">
                          <span className="flex min-w-0 items-baseline gap-1.5">
                            <span className="tabular-nums text-foreground-subtle">{i + 1}.</span>
                            <span className="line-clamp-1">{t.label}</span>
                          </span>
                          <span className="tabular-nums text-foreground-subtle">{t.count} · {pct(t.percentage)}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>

              <div className="grid gap-x-6 gap-y-1 border-t border-border pt-2 type-caption sm:grid-cols-3">
                <span>Ort. süre: <b className="tabular-nums">{detail.averageDurationSeconds.toFixed(0)} sn</b> (medyan {detail.medianDurationSeconds.toFixed(0)} sn)</span>
                <span>Şüpheli hızlı: <b className="tabular-nums">{pct(detail.fastResponseRate)}</b></span>
                <span>Düz çizgi: <b className="tabular-nums">{pct(detail.straightLiningRate)}</b></span>
                <span>GPS kapsaması: <b className="tabular-nums">{pct(detail.gpsCoverageRate)}</b></span>
                <span>Ayrık konum: <b className="tabular-nums">{detail.distinctLocationCount}</b></span>
                <span>Yürünen yol: <b className="tabular-nums">{(detail.distanceWalkedMeters / 1000).toFixed(2)} km</b></span>
              </div>
            </div>
          )}
          <DataTable
            columns={columns}
            rows={pageRows}
            rowKey={(r) => r.interviewerId}
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
            activeRowKey={expanded}
            onRowClick={(r) => setExpanded(expanded === r.interviewerId ? null : r.interviewerId)}
          />

        </>
      )}
    </div>
  )
}
