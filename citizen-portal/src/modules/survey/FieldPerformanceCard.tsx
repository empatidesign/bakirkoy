import { useEffect, useState } from 'react'
import { Award, TrendingUp, Timer, MapPin, Star, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import fieldSurveyService from '@/services/fieldSurvey.service'
import type { FieldTask, FieldResponseSummary } from '@/types/fieldSurvey.types'

// Kullanıcı isteği (2026-09-02): "anketörler sayfasında da alınan anketler, sayıları,
// performans" görünsün. Bu kart, anketörün KENDİ performansını görev verilerinden ve
// topladığı son kayıtlardan hesaplar (ayrı bir API ucu gerektirmez):
//   - toplam/bugün toplanan anket ve hedefe ulaşma oranı
//   - ortalama görüşme süresi (kendi kayıtlarından)
//   - çalıştığı mahalle sayısı ve en verimli mahalle
//   - günlük tempo (son 7 günün ortalaması yerine bugünün hedefe oranı)
//
// Not: Yönetici tarafındaki "Anketör Performansı" ekranı sapma/güvenilirlik gibi denetim
// skorlarını gösterir; burada anketörün kendisini motive edecek sade göstergeler vardır.

interface Props {
  tasks: FieldTask[]
  /** Kullanıcı isteği (2026-09-02): "hepsi tıklanabilir olsun, gerekli alanlara gitsin". */
  onClick?: () => void
}

interface Personal {
  totalDone: number
  todayDone: number
  totalTarget: number
  progressPercent: number
  avgDurationSec: number
  neighborhoodCount: number
  bestNeighborhood: string | null
  sampleSize: number
}

const fmtDuration = (sec: number) => {
  if (sec <= 0) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m > 0 ? `${m} dk ${s} sn` : `${s} sn`
}

export const FieldPerformanceCard = ({ tasks, onClick }: Props) => {
  const [personal, setPersonal] = useState<Personal | null>(null)

  useEffect(() => {
    let cancelled = false

    const compute = async () => {
      const totalDone = tasks.reduce((s, t) => s + t.completedCount, 0)
      const todayDone = tasks.reduce((s, t) => s + t.todayCount, 0)
      const totalTarget = tasks.reduce((s, t) => s + t.targetCount, 0)

      // Mahalle başına toplanan anket: en verimli bölgeyi bulmak için.
      const perNeighborhood = new Map<string, number>()
      for (const t of tasks) {
        const key = t.neighborhood || 'Belirtilmemiş'
        perNeighborhood.set(key, (perNeighborhood.get(key) ?? 0) + t.completedCount)
      }
      const best = [...perNeighborhood.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])[0]

      // Ortalama görüşme süresi: en çok kayıt toplanan 3 görevin son yanıtlarından örneklenir
      // (tüm görevleri çekmek tablette gereksiz ağır olurdu).
      const busiest = [...tasks].filter((t) => t.completedCount > 0)
        .sort((a, b) => b.completedCount - a.completedCount).slice(0, 3)
      let durations: number[] = []
      for (const t of busiest) {
        try {
          const rows: FieldResponseSummary[] = await fieldSurveyService.responses(t.id, 20)
          durations = durations.concat(
            rows.map((r) => r.durationSeconds ?? 0).filter((d) => d > 0),
          )
        } catch {
          // Tek bir görev okunamazsa ortalama diğerlerinden hesaplanır.
        }
      }
      const avg = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0

      if (cancelled) return
      setPersonal({
        totalDone,
        todayDone,
        totalTarget,
        progressPercent: totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0,
        avgDurationSec: avg,
        neighborhoodCount: perNeighborhood.size,
        bestNeighborhood: best ? best[0] : null,
        sampleSize: durations.length,
      })
    }

    void compute()
    return () => { cancelled = true }
  }, [tasks])

  if (!personal) return null

  const p = personal
  // Basit bir "saha karnesi": hedefe ulaşma ve günlük tempo üzerinden.
  const grade = p.progressPercent >= 80 ? { label: 'Mükemmel', tone: 'from-emerald-500 to-teal-600' }
    : p.progressPercent >= 50 ? { label: 'İyi gidiyor', tone: 'from-blue-500 to-indigo-600' }
    : p.progressPercent >= 25 ? { label: 'Devam et', tone: 'from-amber-500 to-orange-600' }
    : { label: 'Başlangıç', tone: 'from-slate-500 to-slate-600' }

  const items = [
    { icon: Star, label: 'Toplam Anket', value: String(p.totalDone), sub: p.totalTarget > 0 ? `Hedef: ${p.totalTarget}` : 'Hedef tanımsız' },
    { icon: TrendingUp, label: 'Bugün', value: String(p.todayDone), sub: 'Bugünkü kayıtlarınız' },
    { icon: Timer, label: 'Ort. Görüşme', value: fmtDuration(p.avgDurationSec), sub: p.sampleSize > 0 ? `${p.sampleSize} kayıt örneklendi` : 'Henüz veri yok' },
    { icon: MapPin, label: 'Çalışılan Mahalle', value: String(p.neighborhoodCount), sub: p.bestNeighborhood ? `En verimli: ${p.bestNeighborhood}` : 'Kayıt bekleniyor' },
  ]

  return (
    <section
      {...(onClick ? {
        role: 'button' as const,
        tabIndex: 0,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onClick() },
      } : {})}
      className={cn(
        'overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm text-left w-full',
        onClick && 'cursor-pointer transition-shadow hover:shadow-md',
      )}
    >
      <div className={cn('flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r px-4 py-3 text-white', grade.tone)}>
        <div className="flex items-center gap-2.5">
          <Award className="h-5 w-5" />
          <div className="leading-tight">
            <h3 className="text-sm font-black tracking-tight">Performansım</h3>
            <p className="text-[11px] font-semibold text-white/80">Saha çalışmanızın özeti</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-2xl font-black">%{p.progressPercent}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/80">Hedefe ulaşma</div>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-black">{grade.label}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-slate-100 lg:grid-cols-4">
        {items.map(({ icon: Icon, label, value, sub }) => (
          <div key={label} className="bg-white px-4 py-3">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-slate-400">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <div className="mt-1 truncate text-lg font-black text-slate-900">{value}</div>
            <div className="truncate text-[10px] font-semibold text-slate-400">{sub}</div>
          </div>
        ))}
      </div>

      {p.totalTarget > 0 && (
        <div className="px-4 pb-3.5">
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-500', grade.tone)}
              style={{ width: `${Math.max(2, Math.min(100, p.progressPercent))}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-slate-400">
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {p.totalDone} / {p.totalTarget} anket
            </span>
            <span>Kalan: {Math.max(0, p.totalTarget - p.totalDone)}</span>
          </div>
        </div>
      )}
    </section>
  )
}
