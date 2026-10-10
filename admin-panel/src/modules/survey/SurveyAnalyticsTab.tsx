import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BarChart3Icon,
  MessageSquareIcon,
  StarIcon,
  PercentIcon,
  ClockIcon,
  UsersIcon,
  PieChartIcon,
  MapPinnedIcon,
  ChevronDownIcon,
  AlertTriangleIcon,
  CheckCircle2Icon,
} from 'lucide-react'
import { Field, Select, StatCard, FormSection, Progress, Badge, EmptyState, SkeletonRows } from '@/design-system'
import surveyService from '@/services/survey.service'
import { SURVEY_QUESTION_TYPE_LABELS } from '@/types/survey.types'
import type { Survey, SurveyAnalytics, SurveyAnswerDistribution, SurveyQuestionAnalytics } from '@/types/survey.types'

const DistributionList = ({ items, tone }: { items: SurveyAnswerDistribution[]; tone: 'primary' | 'success' }) => (
  <div className="space-y-2">
    {items.map((d, i) => (
      <div key={i} className="space-y-1">
        <div className="flex items-center justify-between type-caption">
          <span className="truncate">{d.label}</span>
          <span className="tabular-nums">{d.count.toLocaleString('tr-TR')} · %{Math.round(d.percentage)}</span>
        </div>
        <Progress value={d.percentage} tone={tone} />
      </div>
    ))}
  </div>
)

export const SurveyAnalyticsTab = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const surveyId = searchParams.get('surveyId') ?? ''
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [analytics, setAnalytics] = useState<SurveyAnalytics | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    surveyService.getList({ page: 1, limit: 100 }).then((r) => setSurveys(r.items)).catch(() => setSurveys([]))
  }, [])

  useEffect(() => {
    if (!surveyId) { setAnalytics(null); return }
    setLoading(true)
    surveyService.getAnalytics(surveyId).then(setAnalytics).catch(() => setAnalytics(null)).finally(() => setLoading(false))
  }, [surveyId])

  const selectSurvey = (id: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (id) n.set('surveyId', id)
      else n.delete('surveyId')
      return n
    })

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <Field label="Anket">
          <Select value={surveyId} onChange={(e) => selectSurvey(e.target.value)} placeholder="Analiz için anket seçin">
            <option value="">Anket seçin</option>
            {surveys.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </Select>
        </Field>
      </div>

      {!surveyId ? (
        <EmptyState icon={BarChart3Icon} title="Anket seçin" description="Sonuçlarını görmek istediğiniz anketi yukarıdan seçin." />
      ) : loading ? (
        <SkeletonRows rows={6} />
      ) : !analytics ? (
        <EmptyState icon={BarChart3Icon} title="Sonuç yok" description="Bu anket için analiz verisi bulunamadı." />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Toplam Yanıt" value={analytics.totalResponses} icon={MessageSquareIcon} accent="blue" />
            <StatCard label="Ortalama Puan" value={analytics.averageRating.toFixed(1)} icon={StarIcon} accent="violet" />
            <StatCard label="Tamamlanma Oranı" value={`%${Math.round(analytics.completionRate)}`} icon={PercentIcon} accent="green" />
            <StatCard label="Ortalama Süre" value={`${analytics.averageDuration} dk`} icon={ClockIcon} accent="orange" />
          </div>

          {!analytics.isAnonymous && analytics.demographics && (
            <div className="grid gap-4 lg:grid-cols-2">
              <FormSection variant="card" icon={UsersIcon} title="Yaş Grupları">
                <DistributionList items={analytics.demographics.ageGroups} tone="primary" />
              </FormSection>
              <FormSection variant="card" icon={PieChartIcon} title="Cinsiyet Dağılımı">
                <DistributionList items={analytics.demographics.genders} tone="success" />
              </FormSection>
            </div>
          )}

          <FormSection variant="card" icon={BarChart3Icon} title={`Soru Analizleri (${analytics.questions.length})`}>
            {analytics.questions.length === 0 ? (
              <p className="type-muted">Bu ankette yanıtlanmış soru yok.</p>
            ) : (
              <div className="space-y-4">
                <SurveyIssueSummary questions={analytics.questions} />
                {analytics.questions.map((q) => (
                  <QuestionAnalyticsCard key={q.questionId} q={q} />
                ))}
              </div>
            )}
          </FormSection>
        </div>
      )}
    </div>
  )
}

// Kullanıcı isteği (2026-09-03): "her anketin (soruna) tıkladığımızda ... her soru(da)
// katılımcıların raporları olacak detaylı bir şekilde hangi soruya hangi mahalle ne cevap
// vermiş." Her soru kartı, genel dağılımın altında "Mahalle bazlı detay" bölümü sunar;
// tıklanınca o soruya her mahallenin verdiği cevap dağılımı ayrı ayrı açılır.
const QuestionAnalyticsCard = ({ q }: { q: SurveyQuestionAnalytics }) => {
  const [open, setOpen] = useState(false)
  const hoods = q.neighborhoodBreakdown ?? []
  const a = q.assessment

  // Değerlendirme seviyesine göre renk (global memnuniyet kıstasları).
  const levelTone: Record<string, string> = {
    critical: 'text-rose-700 bg-rose-50 border-rose-200',
    weak: 'text-orange-700 bg-orange-50 border-orange-200',
    moderate: 'text-amber-700 bg-amber-50 border-amber-200',
    good: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    excellent: 'text-teal-700 bg-teal-50 border-teal-200',
  }
  const barColor: Record<string, string> = {
    critical: 'bg-rose-500',
    weak: 'bg-orange-500',
    moderate: 'bg-amber-500',
    good: 'bg-emerald-500',
    excellent: 'bg-teal-500',
  }
  // Bir memnuniyet skoruna (0-100) göre seviye anahtarı (mahalle barları için).
  const scoreLevel = (s: number) => (s < 40 ? 'critical' : s < 55 ? 'weak' : s < 70 ? 'moderate' : s < 85 ? 'good' : 'excellent')

  return (
    <div className="rounded-card border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Badge tone="primary">{q.order}</Badge>
          <div>
            <p className="type-body-strong">{q.question}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{SURVEY_QUESTION_TYPE_LABELS[q.type]}</Badge>
              {/* Kullanıcı isteği (2026-09-03): "sorulara verilen kaç kişi katıldı" */}
              <span className="type-caption tabular-nums">{q.totalAnswers.toLocaleString('tr-TR')} kişi katıldı</span>
              {q.averageScore != null && (
                <span className="type-caption">Ortalama: <span className="text-[hsl(var(--foreground-strong))] tabular-nums">{q.averageScore.toFixed(1)}</span></span>
              )}
            </div>
          </div>
        </div>
        {/* Kullanıcı isteği (2026-09-03): "her sorunun genel ortalamasını ve sorun tespiti"
            global anket değerlendirme kıstaslarına göre — memnuniyet skoru + seviye rozeti. */}
        {a && (
          <div className={`flex shrink-0 flex-col items-end gap-0.5 rounded-field border px-2.5 py-1 ${levelTone[a.level]}`}>
            <span className="text-lg font-bold tabular-nums leading-none">%{a.positivityScore.toFixed(0)}</span>
            <span className="text-[11px] font-semibold leading-none">{a.levelLabel}</span>
          </div>
        )}
      </div>

      {/* Sorun tespiti: değerlendirme özeti; sorun varsa uyarı vurgusuyla. */}
      {a && (
        <div className={`mb-2 flex items-start gap-2 rounded-field border px-2.5 py-1.5 ${a.issueDetected ? 'border-rose-200 bg-rose-50/60' : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-0))]'}`}>
          {a.issueDetected
            ? <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            : <CheckCircle2Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />}
          <span className="type-caption text-[hsl(var(--foreground-default))]">{a.summary}</span>
        </div>
      )}

      {q.distribution.length > 0 && <DistributionList items={q.distribution} tone="primary" />}
      {q.textSamples && q.textSamples.length > 0 && (
        <div className="mt-2 space-y-1">
          {q.textSamples.map((t, i) => (
            <p key={i} className="rounded-field border border-[hsl(var(--border))] bg-[hsl(var(--surface-0))] px-2.5 py-1.5 type-caption">“{t}”</p>
          ))}
        </div>
      )}

      {/* Mahalle bazlı detay: yalnızca mahalle bilgisi olan yanıt varsa gösterilir. */}
      {hoods.length > 0 && (
        <div className="mt-3 border-t border-[hsl(var(--border))] pt-2">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-2 rounded-field px-1 py-1.5 text-left transition-colors hover:bg-[hsl(var(--surface-2))]"
          >
            <MapPinnedIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="type-body-strong text-sm">Mahalle bazlı detay ve grafik ({hoods.length} mahalle)</span>
            <ChevronDownIcon className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="mt-2 space-y-3">
              {/* Kullanıcı isteği (2026-09-03): "grafik olarak da her soru için detaylı
                  analizler kaç kişi ve oranları da versin" — skorlanabilen sorularda mahalleleri
                  memnuniyet skoruna göre karşılaştıran yatay bar grafiği (en düşük üstte, sorunlu
                  mahalle hemen görünsün). */}
              {a && hoods.some((h) => h.positivityScore != null) && (
                <div className="rounded-field border border-[hsl(var(--border))] bg-[hsl(var(--surface-0))] p-2.5">
                  <p className="type-caption mb-2 font-semibold text-[hsl(var(--foreground-strong))]">Mahalle memnuniyet karşılaştırması</p>
                  <div className="space-y-1.5">
                    {[...hoods]
                      .filter((h) => h.positivityScore != null)
                      .map((h) => ({ ...h, pct: Math.round(h.positivityScore as number) }))
                      .sort((x, y) => x.pct - y.pct)
                      .map((h) => {
                        const lvl = scoreLevel(h.pct)
                        return (
                          <div key={h.neighborhood} className="flex items-center gap-2">
                            <span className="w-28 shrink-0 truncate type-caption" title={h.neighborhood}>{h.neighborhood}</span>
                            <div className="relative h-4 flex-1 overflow-hidden rounded-full bg-[hsl(var(--surface-2))]">
                              <div className={`h-full rounded-full ${barColor[lvl]}`} style={{ width: `${Math.max(Math.min(h.pct, 100), 3)}%` }} />
                            </div>
                            <span className="w-20 shrink-0 text-right type-caption tabular-nums">%{h.pct} · {h.totalAnswers} kişi</span>
                          </div>
                        )
                      })}
                  </div>
                </div>
              )}

              {hoods.map((h) => (
                <div key={h.neighborhood} className="rounded-field border border-[hsl(var(--border))] bg-[hsl(var(--surface-0))] p-2.5">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="type-body-strong text-sm">{h.neighborhood}</span>
                    <span className="type-caption tabular-nums">{h.totalAnswers.toLocaleString('tr-TR')} kişi</span>
                    {h.averageScore != null && (
                      <span className="type-caption">Ort: <span className="text-[hsl(var(--foreground-strong))] tabular-nums">{h.averageScore.toFixed(1)}</span></span>
                    )}
                  </div>
                  {h.distribution.length > 0
                    ? <DistributionList items={h.distribution} tone="success" />
                    : <p className="type-caption text-[hsl(var(--foreground-subtle))]">Bu soru tipi için dağılım gösterilmiyor.</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Kullanıcı isteği (2026-09-03): "her sorunun ... sorun tespiti olsun, bunu da global anket
// değerlendirme kıstaslarına göre olsun." Bu özet kartı, tüm sorular içinde global memnuniyet
// eşiklerine göre KAÇ sorunun kritik/zayıf (sorunlu) olduğunu ve en düşük skorlu soruyu
// yöneticiye tek bakışta gösterir; böylece anketin genel "sorun haritası" en üstte görünür.
const SurveyIssueSummary = ({ questions }: { questions: SurveyQuestionAnalytics[] }) => {
  const scored = questions.filter((q) => q.assessment != null) as (SurveyQuestionAnalytics & { assessment: NonNullable<SurveyQuestionAnalytics['assessment']> })[]
  if (scored.length === 0) return null

  const issues = scored.filter((q) => q.assessment.issueDetected)
  const worst = [...scored].sort((a, b) => a.assessment.positivityScore - b.assessment.positivityScore)[0]
  const avg = Math.round(scored.reduce((s, q) => s + q.assessment.positivityScore, 0) / scored.length)

  const tone = issues.length > 0 ? 'border-rose-200 bg-rose-50/60' : 'border-emerald-200 bg-emerald-50/60'

  return (
    <div className={`rounded-card border p-3 ${tone}`}>
      <div className="mb-1.5 flex items-center gap-2">
        {issues.length > 0
          ? <AlertTriangleIcon className="h-5 w-5 text-rose-600" />
          : <CheckCircle2Icon className="h-5 w-5 text-emerald-600" />}
        <span className="type-body-strong">Sorun Tespiti (global anket değerlendirme kıstasları)</span>
      </div>
      <p className="type-caption text-[hsl(var(--foreground-default))]">
        Değerlendirilebilen <b>{scored.length}</b> soruda ortalama memnuniyet <b>%{avg}</b>.
        {issues.length > 0
          ? <> <b className="text-rose-700">{issues.length}</b> soru sorunlu (kritik/zayıf).
              En düşük: <b>{worst.order}. soru</b> — %{worst.assessment.positivityScore.toFixed(0)} ({worst.assessment.levelLabel}).</>
          : <> Hiçbir soru kritik/zayıf düzeyde değil; genel tablo olumlu.</>}
      </p>
    </div>
  )
}
