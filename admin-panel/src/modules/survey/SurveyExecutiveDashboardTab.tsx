import { useEffect, useMemo, useState } from 'react'
import {
  CrownIcon,
  AlertTriangleIcon,
  MapPinnedIcon,
  ClockIcon,
  CheckCircle2Icon,
  TrendingUpIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  ActivityIcon,
  FileTextIcon,
  UsersIcon,
  MessageSquareIcon,
  PercentIcon,
  PieChartIcon,
  DownloadIcon,
  PrinterIcon,
  MaximizeIcon,
  MinimizeIcon,
} from 'lucide-react'
import {
  Badge,
  EmptyState,
  FormSection,
  Progress,
  SkeletonRows,
  StatCard,
  Tabs,
  Button,
} from '@/design-system'
import { AreaTrendChart, DonutChart, CategoryBarChart } from '@/design-system/charts'
import { cn } from '@/lib/utils'
import surveyPlatformService from '@/services/surveyPlatform.service'
import { BakirkoyNeighborhoodMap } from '@/components/specialized/BakirkoyNeighborhoodMap'
import type { SurveyExecutiveDashboard, SurveyNeighborhoodStats } from '@/types/surveyPlatform.types'

// Kullanıcı isteği (2026-09-02, docs/ankettema/06.png "RAPORLAR" ekranı): "anket bölümünü
// tüm alanları performanslı bir şekilde başkan[a] ... çok daha iyi bir raporlama, toplam
// katılımcılar, genel anket[ler], grafiksel gösterimleri ve buradan iyi bir rapor
// alabilmesi, tek ekranda herşeyi görebilmeli, sorunun ne olduğu, memnuniyet oranları."
//
// Başkanlık Paneli artık 06.png'deki "RAPORLAR" ekranındaki gibi tek sayfada:
// GENEL BAKIŞ / KONU ANALİZİ / MAHALLE ANALİZİ / YAŞ ANALİZİ / CİNSİYET ANALİZİ
// alt sekmeleriyle tüm göstergeleri toplar. Yazdırma ile PDF'e aktarılabilir
// (tarayıcının "Farklı Kaydet > PDF" hedefi; ek kütüphane gerektirmez).

const SEVERITY_TONE: Record<string, 'danger' | 'warning' | 'info'> = {
  critical: 'danger',
  high: 'warning',
  normal: 'info',
}

type SubTab = 'genel' | 'konu' | 'mahalle' | 'yas' | 'cinsiyet'

// Harita ölçütleri. Hepsi 0-100 yüzdeye indirgenir ki tek renk skalası kullanılabilsin.
type ExecMapMetric = 'satisfaction' | 'openIssues' | 'resolution'

const EXEC_MAP_METRIC_LABELS: Record<ExecMapMetric, string> = {
  satisfaction: 'Memnuniyet',
  openIssues: 'Açık Talep',
  resolution: 'Çözüm Oranı',
}

/**
 * Veri yoksa null döner: veri yokluğu memnuniyetsizlik değildir ve haritada
 * gri "veri yok" olarak gösterilmelidir (Mahalle Analizi sekmesindeki ölçüm
 * bulgusuyla aynı kural).
 */
const execMetricPercent = (n: SurveyNeighborhoodStats, metric: ExecMapMetric): number | null => {
  if (metric === 'satisfaction') {
    return n.satisfactionScore > 0 ? Math.round((n.satisfactionScore / 5) * 100) : null
  }
  if (metric === 'resolution') {
    return n.totalSubmissionCount > 0 ? Math.round(n.resolutionRate) : null
  }
  // Açık talepte ÇOK olmak kötüdür; renk skalası "yüksek = iyi" olduğu için ters çevrilir.
  if (n.totalSubmissionCount === 0) return null
  const openShare = n.openSubmissionCount / n.totalSubmissionCount
  return Math.round((1 - openShare) * 100)
}

const EXEC_HEAT = [
  { min: 80, hex: '#16a34a' },
  { min: 60, hex: '#84cc16' },
  { min: 40, hex: '#facc15' },
  { min: 20, hex: '#fb923c' },
  { min: 0, hex: '#ef4444' },
]

const execColorFor = (percent: number | null): string =>
  percent === null ? '#cbd5e1' : (EXEC_HEAT.find((b) => percent >= b.min) ?? EXEC_HEAT[EXEC_HEAT.length - 1]).hex

const SATISFACTION_COLORS: Record<string, string> = {
  'Çok Memnun': '#16a34a',
  'Memnun': '#84cc16',
  'Kararsız': '#facc15',
  'Memnun Değil': '#fb923c',
  'Hiç Memnun Değil': '#ef4444',
}

// F19 (denetim 2026-09-16): useMemo içindeki dependency array bu sabiti içermiyordu
// (react-hooks/exhaustive-deps uyarısı). Component body içinde `const` ile tanımlansaydı
// dependency olarak eklemek her render'da yeni bir array referansı üretip memo'yu
// anlamsız kılardı — doğru çözüm module-level sabit (diğerleri gibi, örn. SATISFACTION_COLORS).
const SATISFACTION_ORDER = ['Çok Memnun', 'Memnun', 'Kararsız', 'Memnun Değil', 'Hiç Memnun Değil']

export const SurveyExecutiveDashboardTab = () => {
  const [data, setData] = useState<SurveyExecutiveDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [subTab, setSubTab] = useState<SubTab>('genel')
  // Kullanıcı isteği (2026-09-02): mahalleler harita üstünde renkli gösterilsin;
  // başkan hangi ölçüte bakmak istediğini seçebilsin.
  const [mapMetric, setMapMetric] = useState<ExecMapMetric>('satisfaction')
  // Kullanıcı isteği (2026-09-02): "burada tam ekran olarak" — başkan raporu
  // toplantıda projeksiyonda gösterebilsin. Menü/kenar çubuğu gizlenir, rapor
  // ekranın tamamını kaplar; ESC ile çıkılır.
  const [presenting, setPresenting] = useState(false)

  useEffect(() => {
    if (!presenting) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPresenting(false) }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [presenting])

  useEffect(() => {
    setLoading(true)
    surveyPlatformService
      .getExecutiveDashboard({})
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  const satisfactionData = useMemo(() => {
    if (!data) return []
    return SATISFACTION_ORDER
      .map((label) => data.satisfactionDistribution.find((d) => d.label === label))
      .filter((d): d is NonNullable<typeof d> => !!d)
      .map((d) => ({ label: `${d.label} (%${d.percentage})`, value: d.count }))
  }, [data])

  if (loading) return <SkeletonRows rows={8} />
  if (!data) return <EmptyState icon={ActivityIcon} title="Veri yok" description="Başkanlık paneli verileri yüklenemedi." />

  const SUB_TABS: { key: SubTab; label: string; icon: typeof PieChartIcon }[] = [
    { key: 'genel', label: 'Genel Bakış', icon: PieChartIcon },
    { key: 'konu', label: 'Konu Analizi', icon: MessageSquareIcon },
    { key: 'mahalle', label: 'Mahalle Analizi', icon: MapPinnedIcon },
    { key: 'yas', label: 'Yaş Analizi', icon: UsersIcon },
    { key: 'cinsiyet', label: 'Cinsiyet Analizi', icon: UsersIcon },
  ]

  return (
    <div
      className={cn(
        'space-y-4 survey-report-print',
        presenting && 'fixed inset-0 z-[120] overflow-y-auto bg-surface-0 p-4 sm:p-6',
      )}
      data-testid={presenting ? 'executive-report-fullscreen' : 'executive-report'}
    >
      {/* Rapor başlığı + dışa aktarma (06.png "RAPORLAR" üst şeridi) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-surface-1 p-4 print:hidden">
        <div className="flex items-center gap-2">
          <CrownIcon className="h-5 w-5 text-[hsl(var(--primary))]" />
          <div>
            <p className="type-section">Başkanlık Anket Raporu</p>
            <p className="type-caption text-foreground-muted">Tüm anketlerin tek ekran özeti — {new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={presenting ? 'primary' : 'outline'}
            iconLeft={presenting ? <MinimizeIcon className="h-4 w-4" /> : <MaximizeIcon className="h-4 w-4" />}
            onClick={() => setPresenting((v) => !v)}
            data-testid="executive-fullscreen-toggle"
          >
            {presenting ? 'Tam Ekrandan Çık' : 'Tam Ekran'}
          </Button>
          <Button size="sm" variant="outline" iconLeft={<PrinterIcon className="h-4 w-4" />} onClick={() => window.print()}>Yazdır</Button>
          <Button size="sm" variant="outline" iconLeft={<DownloadIcon className="h-4 w-4" />} onClick={() => window.print()}>PDF Olarak Kaydet</Button>
        </div>
      </div>

      {/* Genel özet KPI'ları — her sekmede sabit görünür (06.png "GENEL BAKIŞ" şeridi) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam Anket" value={data.totalSurveys} icon={FileTextIcon} accent="blue" hint={`${data.activeSurveys} aktif`} />
        <StatCard label="Toplam Katılımcı" value={data.totalParticipants} icon={UsersIcon} accent="violet" hint={`${data.totalResponses.toLocaleString('tr-TR')} yanıt`} />
        <StatCard label="Tamamlanma Oranı" value={`%${Math.round(data.averageCompletionRate)}`} icon={PercentIcon} accent="green" hint={`Ort. ${data.averageDurationMinutes} dk`} />
        <StatCard label="İlçe Memnuniyet Endeksi" value={data.satisfactionIndex.toFixed(1)} icon={CrownIcon} accent="primary" hint="5 üzerinden" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Açık Sorun Sayısı" value={data.totalOpenIssues} icon={AlertTriangleIcon} accent="orange" />
        <StatCard label="Ortalama Çözüm Süresi" value={`${data.averageResolutionHours.toFixed(1)} sa`} icon={ClockIcon} accent="orange" />
        <StatCard label="Talep Kapanma Oranı" value={`%${Math.round(data.submissionClosureRate)}`} icon={CheckCircle2Icon} accent="green" />
        <StatCard label="Kritik Mahalle" value={data.criticalNeighborhood ?? '—'} icon={MapPinnedIcon} accent="danger" />
      </div>

      <Tabs
        value={subTab}
        onValueChange={(v) => setSubTab(v as SubTab)}
        tabs={SUB_TABS}
        variant="pill"
        className="print:hidden"
      />

      {subTab === 'genel' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <FormSection variant="card" icon={TrendingUpIcon} title="Zaman İçinde Anket Katılımı">
              {data.participationOverTime.length === 0 ? (
                <p className="type-muted">Veri yok.</p>
              ) : (
                <AreaTrendChart
                  data={data.participationOverTime.map((p) => ({ tarih: p.date, yanit: p.responses }))}
                  xKey="tarih"
                  series={[{ key: 'yanit', label: 'Yanıt' }]}
                  height={240}
                />
              )}
            </FormSection>

            <FormSection variant="card" icon={PieChartIcon} title="Memnuniyet Dağılımı">
              {satisfactionData.length === 0 ? (
                <p className="type-muted">Veri yok.</p>
              ) : (
                <DonutChart height={240} data={satisfactionData} centerLabel="Toplam Yanıt" centerValue={data.totalResponses} />
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {SATISFACTION_ORDER.map((label) => (
                  <span key={label} className="inline-flex items-center gap-1.5 type-caption">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: SATISFACTION_COLORS[label] }} />
                    {label}
                  </span>
                ))}
              </div>
            </FormSection>
          </div>

          <FormSection variant="card" icon={AlertTriangleIcon} title="Kritik Gündem" subtitle="Son 30 günde belirgin artan mahalle + konu kombinasyonları">
            {data.criticalAgenda.length === 0 ? (
              <p className="type-muted">Şu anda kritik yükselen bir sorun tespit edilmedi.</p>
            ) : (
              <div className="space-y-2">
                {data.criticalAgenda.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-field border border-border bg-surface-1 px-3 py-2.5">
                    <p className="type-body">{item.title}</p>
                    <Badge tone={SEVERITY_TONE[item.severity] ?? 'info'}>%{item.changePercent.toFixed(0)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </FormSection>

          <FormSection variant="card" icon={TrendingUpIcon} title="Son 6 Ay Memnuniyet Trendi">
            {data.satisfactionTrend.length === 0 ? (
              <p className="type-muted">Veri yok.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {data.satisfactionTrend.map((t) => (
                  <StatCard key={t.period} size="compact" label={t.period} value={t.satisfaction.toFixed(1)} icon={TrendingUpIcon} accent="violet" />
                ))}
              </div>
            )}
          </FormSection>
        </div>
      )}

      {subTab === 'konu' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <FormSection variant="card" icon={ThumbsDownIcon} title="En Çok Şikâyet Edilen 10 Konu">
              {data.topComplaints.length === 0 ? (
                <p className="type-muted">Veri yok.</p>
              ) : (
                <CategoryBarChart layout="vertical" height={Math.max(200, data.topComplaints.length * 32)} data={data.topComplaints.map((t) => ({ label: t.topic, value: t.count }))} />
              )}
            </FormSection>

            <FormSection variant="card" icon={ThumbsUpIcon} title="En Çok Memnun Olunan 10 Hizmet">
              {data.topSatisfactions.length === 0 ? (
                <p className="type-muted">Veri yok.</p>
              ) : (
                <CategoryBarChart layout="vertical" height={Math.max(200, data.topSatisfactions.length * 32)} data={data.topSatisfactions.map((t) => ({ label: t.topic, value: t.score }))} />
              )}
            </FormSection>
          </div>
        </div>
      )}

      {subTab === 'mahalle' && (
        <div className="space-y-4">
          {/* Kullanıcı isteği (2026-09-02): "Sultangazi mahallelerini harita üstünde
              renkli göstergelerle konuları gösterim." Gerçek mahalle sınırları
              (GeoJSON poligon) üzerinde renk = seçilen ölçüt. Başkan memnuniyet,
              açık talep ve çözüm oranı arasında geçiş yapabilir. */}
          <FormSection
            variant="card"
            icon={MapPinnedIcon}
            title="Bakırköy Mahalle Haritası"
            subtitle="Mahallenin üzerine gelerek değerleri görün."
            action={
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(EXEC_MAP_METRIC_LABELS) as ExecMapMetric[]).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant={mapMetric === m ? 'primary' : 'outline'}
                    onClick={() => setMapMetric(m)}
                    data-testid={`map-metric-${m}`}
                  >
                    {EXEC_MAP_METRIC_LABELS[m]}
                  </Button>
                ))}
              </div>
            }
          >
            {data.neighborhoods.length === 0 ? (
              <p className="type-muted">Harita için mahalle verisi yok.</p>
            ) : (
              <>
                <BakirkoyNeighborhoodMap
                  data={data.neighborhoods.map((n) => ({
                    neighborhood: n.neighborhood,
                    percent: execMetricPercent(n, mapMetric),
                    responseCount: n.responseCount,
                    openSubmissionCount: n.openSubmissionCount,
                    topIssues: n.topIssues,
                  }))}
                  colorFor={execColorFor}
                  height={440}
                />
                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-3">
                  <span className="type-caption font-medium text-foreground-muted">{EXEC_MAP_METRIC_LABELS[mapMetric]}</span>
                  <span className="h-2.5 w-32 rounded-full" style={{ background: 'linear-gradient(90deg,#ef4444,#facc15,#16a34a)' }} />
                  <span className="type-caption text-foreground-subtle">düşük → yüksek</span>
                  <span className="inline-flex items-center gap-1.5 type-caption text-foreground-subtle">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: '#cbd5e1' }} /> veri yok
                  </span>
                </div>
              </>
            )}
          </FormSection>

          <FormSection variant="card" icon={MapPinnedIcon} title="Mahalle Bazında Sorun Yoğunluğu">
            {data.neighborhoods.length === 0 ? (
              <p className="type-muted">Veri yok.</p>
            ) : (
              <div className="space-y-2.5">
                {data.neighborhoods.slice(0, 15).map((n) => (
                  <div key={n.neighborhood} className="space-y-1">
                    <div className="flex items-center justify-between type-caption">
                      <span>{n.neighborhood}</span>
                      <span className="tabular-nums">{n.openSubmissionCount} açık kayıt · %{Math.round((n.satisfactionScore / 5) * 100)} memnuniyet</span>
                    </div>
                    <Progress value={Math.min(100, n.openSubmissionCount * 5)} tone={n.openSubmissionCount > 10 ? 'danger' : n.openSubmissionCount > 3 ? 'warning' : 'success'} />
                  </div>
                ))}
              </div>
            )}
          </FormSection>
          <p className="type-caption text-foreground-muted">
            Mahalle bazlı kota, demografi ve trend karşılaştırması için <b>Mahalle Analizi</b> sekmesine bakın.
          </p>
        </div>
      )}

      {subTab === 'yas' && (
        <FormSection variant="card" icon={UsersIcon} title="Yaş Gruplarına Göre Öncelikler">
          {data.agePriorities.length === 0 ? (
            <p className="type-muted">Veri yok.</p>
          ) : (
            <CategoryBarChart data={data.agePriorities.map((a) => ({ label: a.label, value: a.count }))} />
          )}
        </FormSection>
      )}

      {subTab === 'cinsiyet' && (
        <FormSection variant="card" icon={UsersIcon} title="Cinsiyet Dağılımı">
          {data.genderDistribution.length === 0 ? (
            <p className="type-muted">Veri yok.</p>
          ) : (
            <DonutChart
              height={260}
              data={data.genderDistribution.map((g) => ({ label: `${g.label} (%${g.percentage})`, value: g.count }))}
              centerLabel="Toplam"
              centerValue={data.genderDistribution.reduce((s, g) => s + g.count, 0)}
            />
          )}
        </FormSection>
      )}
    </div>
  )
}
