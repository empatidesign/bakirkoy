import { useEffect, useState } from 'react'
import { BarChart3Icon, FileTextIcon, School2Icon, UsersIcon, CheckCircle2Icon } from 'lucide-react'
import { Card, StatCard, Combobox, FilterBar, FilterField, Select, Skeleton, Badge } from '@/design-system'
import { CategoryBarChart, GroupedBarChart } from '@/design-system/charts'
import sedaService from '@/services/seda.service'
import type { SedaYearlyReport } from '@/types/seda.types'
import { SEDA_APPLICATION_STATUS_OPTIONS } from '@/types/seda.types'
import type { SelectOption } from '@/types/common'

const fmt = (n: number) => n.toLocaleString('tr-TR')

const ChartSkeleton = () => <Skeleton className="h-64 w-full rounded-lg" />

// Kullanıcı isteği (2026-10-05): "şuana kadar seda ya başvurulan öğrencilerin datalarını buraya
// yükle şuana kadar yıllara göre ka kişi başvru muş burdan da genel olarak detaylı bir rapor
// sistemi de oluştur bundan sorna da başvurular bunun üzerine olacak" — eski sistemden (2018-2026,
// 60.623 gerçek başvuru) içe aktarılan veri + bugünden sonraki yeni başvurular aynı rapor
// sorgusuna (CreatedAt.Year) düşer, böylece bu sekme hem geçmişi hem geleceği gösterir.
export const SedaYearlyReportTab = () => {
  const [report, setReport] = useState<SedaYearlyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [schoolFilter, setSchoolFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [schoolOptions, setSchoolOptions] = useState<SelectOption[]>([])

  useEffect(() => {
    sedaService.getSchoolOptions().then((o) => setSchoolOptions(o ?? [])).catch(() => setSchoolOptions([]))
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: Record<string, unknown> = {}
    if (schoolFilter) params.schoolName = schoolFilter
    if (statusFilter) params.status = statusFilter
    sedaService.getYearlyReport(params)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [schoolFilter, statusFilter])

  const byYearChartData = (report?.byYear ?? []).map((y) => ({
    year: String(y.year),
    Onaylandı: y.approved,
    Beklemede: y.pending,
    Reddedildi: y.rejected,
  }))

  const totalThisYear = report?.byYear.find((y) => y.year === new Date().getFullYear())?.total ?? 0
  const lastYearEntry = report?.byYear.find((y) => y.year === new Date().getFullYear() - 1)
  const yoyDelta = lastYearEntry && lastYearEntry.total > 0
    ? Math.round(((totalThisYear - lastYearEntry.total) / lastYearEntry.total) * 1000) / 10
    : null

  return (
    <div className="space-y-4">
      <FilterBar
        hasActiveFilters={!!schoolFilter || !!statusFilter}
        onClear={() => { setSchoolFilter(''); setStatusFilter('') }}
      >
        <FilterField label="Okul">
          <Combobox
            value={schoolFilter}
            displayValue={schoolFilter}
            options={schoolOptions}
            onChange={setSchoolFilter}
            clearable
            placeholder="Tüm Okullar"
            emptyText="Okul bulunamadı"
          />
        </FilterField>
        <FilterField label="Onay Durumu">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tüm Durumlar</option>
            {SEDA_APPLICATION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
      </FilterBar>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam Başvuru (2018'den bugüne)" value={report?.totalApplications ?? 0} icon={FileTextIcon} accent="blue" loading={loading} />
        <StatCard label="Bu Yıl Yapılan Başvuru" value={totalThisYear} icon={CheckCircle2Icon} accent="green" loading={loading}
          hint={yoyDelta !== null ? `${yoyDelta >= 0 ? '+' : ''}${yoyDelta}% (önceki yıla göre)` : undefined} />
        <StatCard label="Farklı Okul Sayısı" value={report?.totalDistinctSchools ?? 0} icon={School2Icon} accent="violet" loading={loading} />
        <StatCard label="Farklı Başvuran Kişi (TC)" value={report?.totalDistinctApplicants ?? 0} icon={UsersIcon} accent="orange" loading={loading} />
      </div>

      <Card padded>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-1">
            <BarChart3Icon className="h-4 w-4 text-foreground-muted" />
          </span>
          <div>
            <p className="type-section uppercase">Yıllara Göre Başvuru Sayısı</p>
            <p className="type-section-sub">2018&apos;den bugüne, onay durumuna göre kırılım</p>
          </div>
        </div>
        {loading ? <ChartSkeleton /> : report && report.byYear.length > 0 ? (
          <GroupedBarChart
            data={byYearChartData}
            xKey="year"
            stacked
            series={[
              { key: 'Onaylandı', label: 'Onaylandı', color: 'hsl(var(--accent-green))' },
              { key: 'Beklemede', label: 'Beklemede', color: 'hsl(var(--accent-orange))' },
              { key: 'Reddedildi', label: 'Reddedildi', color: 'hsl(var(--accent-pink))' },
            ]}
            height={320}
          />
        ) : (
          <p className="type-muted p-6 text-center">Henüz veri bulunmuyor.</p>
        )}

        {!loading && report && report.byYear.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left type-caption uppercase">
                  <th className="py-2 pr-4">Yıl</th>
                  <th className="py-2 pr-4 text-right">Toplam</th>
                  <th className="py-2 pr-4 text-right">Onaylandı</th>
                  <th className="py-2 pr-4 text-right">Beklemede</th>
                  <th className="py-2 pr-4 text-right">Reddedildi</th>
                </tr>
              </thead>
              <tbody>
                {report.byYear.slice().reverse().map((y) => (
                  <tr key={y.year} className="border-b border-border/50">
                    <td className="py-2 pr-4 font-medium tabular-nums">{y.year}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmt(y.total)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-success">{fmt(y.approved)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-warning">{fmt(y.pending)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums text-danger">{fmt(y.rejected)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="py-2 pr-4">Toplam</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmt(report.totalApplications)}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmt(report.byYear.reduce((s, y) => s + y.approved, 0))}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmt(report.byYear.reduce((s, y) => s + y.pending, 0))}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{fmt(report.byYear.reduce((s, y) => s + y.rejected, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded>
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-1">
              <School2Icon className="h-4 w-4 text-foreground-muted" />
            </span>
            <div>
              <p className="type-section uppercase">En Çok Başvuru Alan Okullar</p>
              <p className="type-section-sub">İlk 15 okul</p>
            </div>
          </div>
          {loading ? <ChartSkeleton /> : report && report.topSchools.length > 0 ? (
            <CategoryBarChart
              data={report.topSchools.map((s) => ({ label: s.name, value: s.count }))}
              layout="vertical"
              height={420}
              multicolor
            />
          ) : <p className="type-muted p-6 text-center">Veri bulunmuyor.</p>}
        </Card>

        <div className="space-y-4">
          <Card padded>
            <div className="mb-4 flex items-center gap-3">
              <p className="type-section uppercase">Gelecek Yıl Sınıfına Göre</p>
            </div>
            {loading ? <ChartSkeleton /> : report && report.byGrade.length > 0 ? (
              <div className="space-y-2">
                {report.byGrade.map((g) => (
                  <div key={g.name} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <Badge tone="neutral">{g.name}</Badge>
                    <span className="type-body-strong tabular-nums">{fmt(g.count)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="type-muted p-4 text-center">Veri bulunmuyor.</p>}
          </Card>

          <Card padded>
            <div className="mb-4 flex items-center gap-3">
              <p className="type-section uppercase">Eğitim Türüne Göre</p>
            </div>
            {loading ? <ChartSkeleton /> : report && report.byEducationType.length > 0 ? (
              <div className="space-y-2">
                {report.byEducationType.map((g) => (
                  <div key={g.name} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                    <Badge tone="neutral">{g.name}</Badge>
                    <span className="type-body-strong tabular-nums">{fmt(g.count)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="type-muted p-4 text-center">Veri bulunmuyor.</p>}
          </Card>
        </div>
      </div>
    </div>
  )
}
