import { useEffect, useState } from 'react'
import {
  FileTextIcon,
  CheckCircle2Icon,
  MessageSquareIcon,
  StarIcon,
  TrendingUpIcon,
  PieChartIcon,
  SmilePlusIcon,
  ActivityIcon,
} from 'lucide-react'
import { StatCard, FormSection, Progress, EmptyState, SkeletonRows } from '@/design-system'
import surveyService from '@/services/survey.service'
import { formatDate } from '@/lib/utils'
import type { SurveySummary } from '@/types/survey.types'

export const SurveyDashboardTab = () => {
  const [summary, setSummary] = useState<SurveySummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    surveyService.getSummary({}).then(setSummary).catch(() => setSummary(null)).finally(() => setLoading(false))
  }, [])

  if (loading) return <SkeletonRows rows={6} />
  if (!summary) {
    return <EmptyState icon={ActivityIcon} title="Özet verisi yok" description="Anket özet verileri yüklenemedi." />
  }

  const maxMonthly = Math.max(1, ...summary.monthlyResponses.map((m) => m.responses))
  const totalCat = Math.max(1, summary.categoryDistribution.reduce((s, c) => s + c.count, 0))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam Anket" value={summary.total} icon={FileTextIcon} accent="blue" />
        <StatCard label="Aktif Anket" value={summary.active} icon={CheckCircle2Icon} accent="green" />
        <StatCard label="Toplam Yanıt" value={summary.totalResponses} icon={MessageSquareIcon} accent="orange" />
        <StatCard label="Ortalama Puan" value={summary.averageRating.toFixed(1)} icon={StarIcon} accent="violet" hint={`Tamamlanma %${Math.round(summary.averageCompletionRate)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormSection variant="card" icon={TrendingUpIcon} title="Aylık Yanıt Trendi">
          {summary.monthlyResponses.length === 0 ? (
            <p className="type-muted">Veri yok.</p>
          ) : (
            <div className="space-y-2.5">
              {summary.monthlyResponses.map((m) => (
                <div key={m.month} className="space-y-1">
                  <div className="flex items-center justify-between type-caption">
                    <span>{m.month}</span>
                    <span className="tabular-nums">{m.responses}</span>
                  </div>
                  <Progress value={(m.responses / maxMonthly) * 100} tone="primary" />
                </div>
              ))}
            </div>
          )}
        </FormSection>

        <FormSection variant="card" icon={PieChartIcon} title="Kategori Dağılımı">
          {summary.categoryDistribution.length === 0 ? (
            <p className="type-muted">Veri yok.</p>
          ) : (
            <div className="space-y-2.5">
              {summary.categoryDistribution.map((c) => (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between type-caption">
                    <span>{c.category}</span>
                    <span className="tabular-nums">{c.count.toLocaleString('tr-TR')}</span>
                  </div>
                  <Progress value={(c.count / totalCat) * 100} tone="success" />
                </div>
              ))}
            </div>
          )}
        </FormSection>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormSection variant="card" icon={SmilePlusIcon} title="Memnuniyet Trendi (5 üzerinden)">
          {summary.satisfactionTrends.length === 0 ? (
            <p className="type-muted">Veri yok.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {summary.satisfactionTrends.map((s) => (
                <StatCard key={s.period} size="compact" label={s.period} value={s.satisfaction.toFixed(1)} icon={StarIcon} accent="violet" />
              ))}
            </div>
          )}
        </FormSection>

        <FormSection variant="card" icon={ActivityIcon} title="Son Aktiviteler">
          {summary.recent.length === 0 ? (
            <p className="type-muted">Henüz aktivite yok.</p>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {summary.recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="type-body-strong truncate">{r.title}</p>
                    <p className="type-caption">{formatDate(r.createdAt)}</p>
                  </div>
                  <span className="shrink-0 type-body-strong tabular-nums">{r.totalResponses.toLocaleString('tr-TR')} yanıt</span>
                </div>
              ))}
            </div>
          )}
        </FormSection>
      </div>
    </div>
  )
}
