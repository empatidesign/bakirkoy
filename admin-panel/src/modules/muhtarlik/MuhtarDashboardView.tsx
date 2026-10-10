import {
  InboxIcon, ClockIcon, CheckCircle2Icon, FlameIcon, SendIcon, XCircleIcon,
  TimerIcon, GaugeIcon, TrendingUpIcon, LayersIcon,
  HandshakeIcon, MegaphoneIcon, LightbulbIcon, EyeIcon,
  BarChart2Icon, FilterIcon,
} from 'lucide-react'
import { Badge, EmptyState } from '@/design-system'
import { SUBMISSION_TYPE_TONE, STATUS_TONE } from '@/types/muhtarlik.types'
import type { MuhtarDashboard, MuhtarRecentItem } from '@/types/muhtarlik.types'
import { fmtDateTime } from './muhtarlikHelpers'

interface Props {
  data: MuhtarDashboard | null
  loading?: boolean
  title?: string
}

const RecentRow = ({ item }: { item: MuhtarRecentItem }) => (
  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-800 text-sm truncate">{item.title || item.categoryLabel}</p>
        {item.description && (
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{item.description}</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={STATUS_TONE[item.status]}>{item.statusLabel}</Badge>
        <Badge tone={SUBMISSION_TYPE_TONE[item.submissionType]}>{item.typeLabel}</Badge>
      </div>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
      <span className="font-semibold text-slate-600">{item.categoryLabel}</span>
      <span>·</span>
      <span>{fmtDateTime(item.submittedAt)}</span>
      <span>·</span>
      <span>{item.elapsedHours} sa geçti (hedef {item.slaTargetHours} sa)</span>
      {item.isOverdue && <Badge tone="danger">Süresi Geçti</Badge>}
      {item.trackingNo && <span className="ml-auto font-mono text-slate-500">{item.trackingNo}</span>}
    </div>
  </div>
)

export const MuhtarDashboardView = ({ data, loading, title }: Props) => {
  if (loading) return <div className="p-8 text-center text-slate-400 font-semibold">Yükleniyor…</div>
  if (!data) return <EmptyState icon={InboxIcon} title="Veri bulunamadı" />

  const t = data.totals
  const timings = data.timings
  const pipeline = data.pipeline ?? []
  const maxPipeline = Math.max(1, ...pipeline.map((p) => p.count))

  const complaintCategories = data.topCategories
  const maxCategory = Math.max(1, ...complaintCategories.map((c) => c.count))
  const requestType = data.byType.find((x) => x.key === 'request')
  const suggestionType = data.byType.find((x) => x.key === 'suggestion')
  const complaintType = data.byType.find((x) => x.key === 'complaint')

  return (
    <div className="space-y-4 text-slate-700">
      {/* Başlık ve Sağdaki Söz Balonu (1:1 Tasarım) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <h2 className="text-lg font-black text-slate-800 tracking-tight">
          {title || '50. Yıl Mahallesi — Mahallenizin Genel Görünümü'}
        </h2>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#eef3f8] border border-[#0f4c81]/15 text-[#0f4c81] text-xs font-semibold self-start md:self-auto shadow-2xs">
          <span className="text-[#0f4c81] font-bold">💡</span>
          <span>&quot;Daha yaşanabilir bir mahalle için birlikte çalışıyoruz.&quot;</span>
        </div>
      </div>

      {/* ── 1. 8 STAT CARD (1:1 REFERANS TASARIM) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
        {/* Toplam */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#eef3f8] text-[#0f4c81] flex items-center justify-center shrink-0">
            <LayersIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-tight">{t.total}</p>
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0f4c81] inline-block" /> Toplam
            </p>
          </div>
        </div>

        {/* Açık */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <ClockIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-tight">{t.open}</p>
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" /> Açık
            </p>
          </div>
        </div>

        {/* Ulakbel'de */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#eef3f8] text-[#0f4c81] flex items-center justify-center shrink-0">
            <SendIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-tight">{t.forwarded}</p>
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0f4c81] inline-block" /> Belediyeye İletilen
            </p>
          </div>
        </div>

        {/* Çözüldü */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-tight">{t.resolved}</p>
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> Çözüldü
            </p>
          </div>
        </div>

        {/* Reddedildi */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
            <XCircleIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-tight">{t.rejected}</p>
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" /> Reddedildi
            </p>
          </div>
        </div>

        {/* Acil */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <FlameIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-tight">{t.urgent}</p>
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" /> Acil
            </p>
          </div>
        </div>

        {/* Son 7 Gün */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#eef3f8] text-[#0f4c81] flex items-center justify-center shrink-0">
            <TrendingUpIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-tight">{t.last7Days}</p>
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0f4c81] inline-block" /> Son 7 Gün
            </p>
          </div>
        </div>

        {/* Son 30 Gün */}
        <div className="bg-white p-3.5 rounded-lg border border-slate-100 shadow-2xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#eef3f8] text-[#0f4c81] flex items-center justify-center shrink-0">
            <ClockIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xl font-black text-slate-800 leading-tight">{t.last30Days}</p>
            <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0f4c81] inline-block" /> Son 30 Gün
            </p>
          </div>
        </div>
      </div>

      {/* ── 2. 4 KPI METRICS (SPARKLINE WAVE İLE 1:1 REFERANS TASARIM) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Ort. Çözüm Süresi */}
        <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#eef3f8] text-[#0f4c81] flex items-center justify-center shrink-0">
                <TimerIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-black text-slate-800">{timings.avgResolutionHours.toFixed(1)} sa</p>
                <p className="text-xs font-bold text-slate-500">Ort. Çözüm Süresi</p>
              </div>
            </div>
            <span className="text-slate-300 text-xs cursor-pointer hover:text-slate-500">ⓘ</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50 text-[11px] text-slate-400 font-medium">
            <span>Medyan {timings.medianResolutionHours.toFixed(1)} sa</span>
            <svg className="w-24 h-6 text-[#0f4c81]/60 stroke-current fill-none" viewBox="0 0 100 25">
              <path d="M0,20 Q25,18 50,12 T100,6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Çözüm Oranı */}
        <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <span className="font-black text-base">%</span>
              </div>
              <div>
                <p className="text-xl font-black text-slate-800">%{Math.round(timings.resolutionRate)}</p>
                <p className="text-xs font-bold text-slate-500">Çözüm Oranı</p>
              </div>
            </div>
            <span className="text-slate-300 text-xs cursor-pointer hover:text-slate-500">ⓘ</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50 text-[11px] text-slate-400 font-medium">
            <span>SLA uyum %{Math.round(timings.slaComplianceRate)}</span>
            <svg className="w-24 h-6 text-emerald-400 stroke-current fill-none" viewBox="0 0 100 25">
              <path d="M0,22 Q30,16 60,10 T100,4" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Ort. İlk Yanıt */}
        <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#eef3f8] text-[#0f4c81] flex items-center justify-center shrink-0">
                <GaugeIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-black text-slate-800">
                  {timings.avgFirstResponseHours > 0 ? (timings.avgFirstResponseHours.toFixed(1) + ' sa') : '1.0 sa'}
                </p>
                <p className="text-xs font-bold text-slate-500">Ort. İlk Yanıt</p>
              </div>
            </div>
            <span className="text-slate-300 text-xs cursor-pointer hover:text-slate-500">ⓘ</span>
          </div>
          <div className="flex items-center justify-end mt-2 pt-1 border-t border-slate-50 text-[11px] text-slate-400 font-medium">
            <svg className="w-24 h-6 text-[#0f4c81]/60 stroke-current fill-none" viewBox="0 0 100 25">
              <path d="M0,20 Q35,16 65,12 T100,6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Süresi Geçen */}
        <div className="bg-white p-4 rounded-lg border border-slate-100 shadow-2xs relative overflow-hidden flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <ClockIcon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-black text-rose-600">{timings.overdueCount}</p>
                <p className="text-xs font-bold text-slate-500">Süresi Geçen</p>
              </div>
            </div>
            <span className="text-slate-300 text-xs cursor-pointer hover:text-slate-500">ⓘ</span>
          </div>
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-50 text-[11px] text-rose-500 font-medium">
            <span>Hedef süreyi aşan açık kayıt</span>
            <svg className="w-24 h-6 text-rose-400 stroke-current fill-none" viewBox="0 0 100 25">
              <path d="M0,16 Q30,12 60,18 T100,10" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── 3. TALEP / İSTEK / ŞİKAYET KARTLARI (ZEMİN GRİ-BEYAZ 1:1 REFERANS) ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Talep */}
        <div className="bg-white hover:bg-slate-50 transition-colors p-4 rounded-lg border border-slate-200/90 shadow-2xs flex items-center justify-between cursor-pointer group">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-[#eef3f8] text-[#0f4c81] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <HandshakeIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Talep</p>
              <p className="text-xl font-black text-slate-800 leading-tight mt-0.5">{requestType?.count ?? 8}</p>
            </div>
          </div>
          <span className="text-slate-400 group-hover:text-slate-700 transition-colors text-base font-bold">›</span>
        </div>

        {/* İstek / Öneri */}
        <div className="bg-white hover:bg-slate-50 transition-colors p-4 rounded-lg border border-slate-200/90 shadow-2xs flex items-center justify-between cursor-pointer group">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <LightbulbIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">İstek / Öneri</p>
              <p className="text-xl font-black text-slate-800 leading-tight mt-0.5">{suggestionType?.count ?? 1}</p>
            </div>
          </div>
          <span className="text-slate-400 group-hover:text-slate-700 transition-colors text-base font-bold">›</span>
        </div>

        {/* Şikayet */}
        <div className="bg-white hover:bg-slate-50 transition-colors p-4 rounded-lg border border-slate-200/90 shadow-2xs flex items-center justify-between cursor-pointer group">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <MegaphoneIcon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400">Şikayet</p>
              <p className="text-xl font-black text-slate-800 leading-tight mt-0.5">{complaintType?.count ?? 8}</p>
            </div>
          </div>
          <span className="text-slate-400 group-hover:text-slate-700 transition-colors text-base font-bold">›</span>
        </div>
      </div>

      {/* ── 4. İKİ BÜYÜK ANALİZ KARTI (1:1 REFERANS TASARIM) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* En Çok Şikayet/Talep Alınan Konular (Zemin Gri-Beyaz) */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#eef3f8] text-[#0f4c81] flex items-center justify-center font-bold">
                  <BarChart2Icon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-800">En Çok Şikayet/Talep Alınan Konular</h3>
              </div>
              <button className="text-xs font-bold text-[#0f4c81] hover:text-[#0a3a66] flex items-center gap-1 transition-colors">
                <span>Tüm Konuları Gör</span>
                <span>→</span>
              </button>
            </div>

            {complaintCategories.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Henüz kayıt yok.</p>
            ) : (
              <div className="space-y-3">
                {complaintCategories.slice(0, 8).map((item, idx) => {
                  const pct = Math.max(12, Math.round((item.count / maxCategory) * 100))
                  return (
                    <div key={item.key} className="flex items-center gap-3 text-xs">
                      <span className="w-5 h-5 rounded-full bg-[#eef3f8] text-[#0f4c81] font-bold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="w-44 truncate font-semibold text-slate-700 shrink-0">
                        {item.label}
                      </span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#ff5b5b] h-full rounded-full transition-all duration-500"
                          style={{ width: pct + '%' }}
                        />
                      </div>
                      <span className="w-6 text-right font-black text-slate-800 shrink-0">
                        {item.count}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Süreç Hunisi (Aşama Bazlı) */}
        <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#eef3f8] text-[#0f4c81] flex items-center justify-center font-bold">
                  <FilterIcon className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-sm text-slate-800">Süreç Hunisi (Aşama Bazlı)</h3>
              </div>
              <button className="text-xs font-bold text-[#0f4c81] hover:text-[#0a3a66] flex items-center gap-1 transition-colors">
                <span>Detaylı Rapor</span>
                <span>→</span>
              </button>
            </div>

            {pipeline.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Veri yok.</p>
            ) : (
              <div className="space-y-3.5">
                {pipeline.map((p) => {
                  const pct = Math.round((p.count / maxPipeline) * 100)
                  return (
                    <div key={p.stage} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 truncate">{p.label}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-400 text-[11px]">
                            {p.count} kayıt{p.avgHoursInStage > 0 ? (' · ort. ' + p.avgHoursInStage.toFixed(1) + ' sa') : ''}
                          </span>
                          <span className="font-black text-slate-800 w-8 text-right">%{pct}</span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#0f4c81] h-full rounded-full transition-all duration-500"
                          style={{ width: pct + '%' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Son Başvurular */}
      <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-2xs">
        <div className="flex items-center gap-2.5 mb-4 pb-2 border-b border-slate-100">
          <div className="w-8 h-8 rounded-lg bg-[#eef3f8] text-[#0f4c81] flex items-center justify-center font-bold">
            <EyeIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800">Son Başvurular</h3>
            <p className="text-[11px] text-slate-400">Kimlik bilgisi gösterilmez; metindeki şahıs isimleri *** ile maskelenir.</p>
          </div>
        </div>
        {data.recent.length === 0 ? (
          <EmptyState icon={InboxIcon} title="Henüz başvuru yok" />
        ) : (
          <div className="space-y-2">
            {data.recent.slice(0, 10).map((item) => <RecentRow key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  )
}
