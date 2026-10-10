import { useEffect, useMemo, useState } from 'react'
import { CircleDotIcon, LockIcon, GiftIcon, ZapIcon } from 'lucide-react'
import { EmptyState, SkeletonRows } from '@/design-system'
import type { CitizenWheel, WheelSlice, WheelSpinResult } from '@/types/wheel.types'
import wheelService from '@/services/wheel.service'
import { WheelSpinModal } from './WheelSpinModal'

type RemainingMap = Record<string, number | null>

const MiniWheel = ({ slices, spinning }: { slices: WheelSlice[]; spinning: boolean }) => {
  const n = Math.max(slices.length, 1)
  const per = 360 / n
  const R = 46
  const C = 50

  const point = (radius: number, deg: number): [number, number] => {
    const t = (deg * Math.PI) / 180
    return [C + radius * Math.sin(t), C - radius * Math.cos(t)]
  }
  const path = (start: number, end: number): string => {
    const [x1, y1] = point(R, start)
    const [x2, y2] = point(R, end)
    const large = end - start > 180 ? 1 : 0
    return `M ${C} ${C} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
  }

  return (
    <div className="relative h-[68px] w-[68px] flex-shrink-0">
      <div
        className="absolute left-1/2 top-[-2px] z-10 -translate-x-1/2"
        style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '8px solid #fff' }}
      />
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        style={{
          filter: 'drop-shadow(0 3px 8px rgba(51,65,85,0.25))',
          animation: spinning ? 'mini-wheel-spin 3.2s linear infinite' : undefined,
          transformOrigin: 'center',
        }}
      >
        <circle cx={C} cy={C} r={R + 3} fill="#fff" />
        {slices.length <= 1 ? (
          <circle cx={C} cy={C} r={R} fill={slices[0]?.color ?? '#ec4899'} />
        ) : (
          slices.map((s, i) => (
            <path key={i} d={path(per * i, per * (i + 1))} fill={s.color} stroke="#fff" strokeWidth={0.8} />
          ))
        )}
        <circle cx={C} cy={C} r={9} fill="#fff" />
        <circle cx={C} cy={C} r={4} fill="#334155" />
      </svg>
    </div>
  )
}

type WheelCardProps = {
  wheel: CitizenWheel
  remaining: number | null
  onClick: () => void
}

const WheelCard = ({ wheel, remaining, onClick }: WheelCardProps) => {
  const hasLimit = wheel.dailySpinLimit > 0
  const exhausted = hasLimit && remaining !== null && remaining <= 0

  const prizeChips = useMemo(() => {
    const seen = new Set<string>()
    const chips: WheelSlice[] = []
    for (const s of wheel.slices) {
      const key = s.label
      if (!seen.has(key)) { seen.add(key); chips.push(s) }
      if (chips.length >= 3) break
    }
    return chips
  }, [wheel.slices])

  return (
    <button
      type="button"
      disabled={exhausted}
      onClick={onClick}
      className="group relative w-full overflow-hidden rounded-lg text-left transition-all duration-300 disabled:cursor-not-allowed active:scale-[0.985]"
      style={{
        background: exhausted
          ? 'rgba(255,255,255,0.55)'
          : 'linear-gradient(150deg, #ffffff 0%, #f8fafc 100%)',
        border: exhausted ? '1px solid rgba(51,65,85,0.10)' : '1px solid rgba(148,163,184,0.32)',
        boxShadow: exhausted
          ? '0 2px 10px rgba(0,0,0,0.04)'
          : '0 8px 24px -12px rgba(15,23,42,0.28), 0 2px 6px -2px rgba(0,0,0,0.06)',
        opacity: exhausted ? 0.75 : 1,
      }}
    >
      {!exhausted && (
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-90"
          style={{ background: 'radial-gradient(circle, rgba(148,163,184,0.3), transparent 70%)' }}
        />
      )}

      <div className="relative flex items-center gap-3.5 p-3.5">
        {exhausted ? (
          <div className="flex h-[68px] w-[68px] flex-shrink-0 items-center justify-center rounded-lg bg-surface-2">
            <LockIcon className="h-7 w-7 text-foreground-subtle" />
          </div>
        ) : (
          <MiniWheel slices={wheel.slices} spinning />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {!exhausted && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                style={{ background: 'linear-gradient(135deg,#334155,#475569)' }}
              >
                <CircleDotIcon className="h-2.5 w-2.5" /> Çark
              </span>
            )}
            {exhausted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">
                Bugün doldu
              </span>
            )}
          </div>

          <p className="mt-1 truncate text-[15px] font-extrabold text-foreground-strong">{wheel.title}</p>

          {wheel.description ? (
            <p className="mt-0.5 line-clamp-1 text-[12px] text-foreground-muted">{wheel.description}</p>
          ) : null}

          {!exhausted && prizeChips.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {prizeChips.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex max-w-[92px] items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: `${s.color}1f`, color: s.color }}
                >
                  <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="truncate">{s.label}</span>
                </span>
              ))}
              {wheel.slices.length > prizeChips.length && (
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-foreground-muted">
                  +{wheel.slices.length - prizeChips.length}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          {exhausted ? (
            <span className="text-[11px] font-semibold text-foreground-subtle">Yarın tekrar</span>
          ) : (
            <>
              {hasLimit && remaining !== null && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg,#059669,#10b981)' }}
                >
                  <ZapIcon className="h-3 w-3" /> {remaining} hak
                </span>
              )}
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-bold text-white shadow-sm transition-transform group-hover:scale-105"
                style={{ background: 'linear-gradient(135deg,#334155,#475569)', boxShadow: '0 4px 12px rgba(51,65,85,0.28)' }}
              >
                Çevir →
              </span>
            </>
          )}
        </div>
      </div>
    </button>
  )
}

export const WheelSpinTab = () => {
  const [wheels, setWheels] = useState<CitizenWheel[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [remainingMap, setRemainingMap] = useState<RemainingMap>({})
  const [activeWheel, setActiveWheel] = useState<CitizenWheel | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    wheelService.wheels({ page: 1, limit: 50 })
      .then((r) => {
        if (!active) return
        setWheels(r.items)
        const map: RemainingMap = {}
        for (const w of r.items) map[w.id] = w.remainingSpinsToday
        setRemainingMap(map)
      })
      .catch(() => { if (active) setWheels([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const handleSpun = (result: WheelSpinResult) => {
    if (!activeWheel) return
    if (result.remainingSpinsToday !== null) {
      setRemainingMap((prev) => ({ ...prev, [activeWheel.id]: result.remainingSpinsToday }))
    }
  }

  const availableCount = useMemo(() => {
    if (!wheels) return 0
    return wheels.filter((w) => {
      const rem = remainingMap[w.id] ?? w.remainingSpinsToday
      const hasLimit = w.dailySpinLimit > 0
      return !(hasLimit && rem !== null && rem <= 0)
    }).length
  }, [wheels, remainingMap])

  return (
    <div
      className="min-h-full"
      style={{ background: 'linear-gradient(165deg, #f8fafc 0%, #f1f5f9 55%, #eef2ff 100%)' }}
    >
      <style>{`@keyframes mini-wheel-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      <div className="px-4 pt-4">
        <div
          className="relative overflow-hidden rounded-lg px-5 py-4"
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #334155 55%, #4f46e5 100%)',
            boxShadow: '0 14px 34px -14px rgba(30,41,59,0.5)',
          }}
        >
          <div className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full opacity-30 blur-2xl" style={{ background: 'radial-gradient(circle,#c7d2fe,transparent 70%)' }} />
          <div className="relative flex items-center gap-3">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
              <GiftIcon className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-extrabold leading-tight text-white">Şansını dene, hediye kazan!</p>
              <p className="mt-0.5 text-[12px] font-medium text-white/80">
                {loading ? 'Çarklar yükleniyor…' : availableCount > 0 ? `${availableCount} çark seni bekliyor` : 'Şu an aktif çark yok'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {loading ? (
          <SkeletonRows rows={3} />
        ) : !wheels || wheels.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white/70 py-6">
            <EmptyState icon={CircleDotIcon} title="Aktif çark yok" description="Yeni çarklar eklendiğinde burada görünecek." />
          </div>
        ) : (
          wheels.map((w) => (
            <WheelCard
              key={w.id}
              wheel={w}
              remaining={remainingMap[w.id] ?? w.remainingSpinsToday}
              onClick={() => setActiveWheel(w)}
            />
          ))
        )}
      </div>

      <WheelSpinModal
        wheel={activeWheel}
        remaining={activeWheel ? (remainingMap[activeWheel.id] ?? activeWheel.remainingSpinsToday) : null}
        onClose={() => setActiveWheel(null)}
        onSpun={handleSpun}
      />
    </div>
  )
}
