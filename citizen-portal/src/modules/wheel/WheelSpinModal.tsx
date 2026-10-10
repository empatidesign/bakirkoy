import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XIcon, CircleDotIcon, Loader2Icon, ZapIcon } from 'lucide-react'
import { WheelSpinner, type WheelSpinnerHandle } from '@/components/specialized/WheelSpinner'
import { useOverlayDismiss } from '@/lib/useOverlayDismiss'
import type { CitizenWheel, WheelSlice, WheelSpinResult } from '@/types/wheel.types'
import wheelService from '@/services/wheel.service'
import { WheelSpinResultModal } from './WheelSpinResultModal'

const WHEEL_ACCENT = '#4f46e5'

type Props = {
  wheel: CitizenWheel | null
  remaining: number | null
  onClose: () => void
  onSpun: (result: WheelSpinResult) => void
}

const matchSliceIndex = (slices: WheelSlice[], result: WheelSpinResult): number => {
  const exact = slices.findIndex((s) =>
    s.label === result.sliceLabel && s.type === result.sliceType && s.value === result.sliceValue)
  if (exact >= 0) return exact
  const byLabel = slices.findIndex((s) => s.label === result.sliceLabel)
  return byLabel >= 0 ? byLabel : 0
}

export const WheelSpinModal = ({ wheel, remaining, onClose, onSpun }: Props) => {
  const spinnerRef = useRef<WheelSpinnerHandle>(null)
  const [spinning, setSpinning] = useState(false)
  const [pendingResult, setPendingResult] = useState<WheelSpinResult | null>(null)
  const [shownResult, setShownResult] = useState<WheelSpinResult | null>(null)

  useOverlayDismiss(!!wheel, onClose)

  if (!wheel) return null

  const hasLimit = wheel.dailySpinLimit > 0
  const exhausted = hasLimit && remaining !== null && remaining <= 0

  const handleSpin = () => {
    if (spinning || wheel.slices.length === 0 || exhausted) return
    setSpinning(true)
    wheelService.spin(wheel.id)
      .then((result) => {
        setPendingResult(result)
        onSpun(result)
        spinnerRef.current?.spinTo(matchSliceIndex(wheel.slices, result))
      })
      .catch(() => setSpinning(false))
  }

  const handleSpinEnd = () => {
    setSpinning(false)
    if (pendingResult) {
      setShownResult(pendingResult)
      setPendingResult(null)
    }
  }

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <style>{`@keyframes wheel-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
          <div
            className="absolute inset-0 backdrop-blur-md"
            style={{ background: 'rgba(15,23,42,0.58)' }}
            onClick={onClose}
          />

          <div
            className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-lg"
            style={{
              maxWidth: 360,
              boxShadow: '0 30px 70px -18px rgba(15,23,42,0.55)',
              border: '1px solid rgba(148,163,184,0.3)',
            }}
          >
            <div
              className="relative flex-shrink-0 px-5 pb-5 pt-4"
              style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 55%, #4f46e5 100%)' }}
            >
              <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-30 blur-2xl" style={{ background: 'radial-gradient(circle,#c7d2fe,transparent 70%)' }} />

              <button
                type="button"
                onClick={onClose}
                aria-label="Kapat"
                className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/90 backdrop-blur-sm transition-colors hover:bg-white/25"
              >
                <XIcon className="h-4 w-4" />
              </button>

              <div className="relative pr-10">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-sm">
                  <CircleDotIcon className="h-2.5 w-2.5" /> Şans Çarkı
                </span>
                <h3 className="mt-2 text-[17px] font-extrabold leading-tight text-white">{wheel.title}</h3>
                {wheel.description && (
                  <p className="mt-0.5 text-[12px] font-medium text-white/80">{wheel.description}</p>
                )}
              </div>
            </div>

            <div
              className="flex flex-1 flex-col items-center overflow-y-auto overscroll-contain px-6 pb-2 pt-6"
              style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)' }}
            >
              <div style={{ animation: spinning ? undefined : 'wheel-float 4s ease-in-out infinite' }}>
                <WheelSpinner
                  ref={spinnerRef}
                  slices={wheel.slices.map((s) => ({ label: s.label, color: s.color }))}
                  size={264}
                  accentColor={WHEEL_ACCENT}
                  onSpinEnd={handleSpinEnd}
                />
              </div>
            </div>

            <div
              className="flex-shrink-0 px-6 pb-5 pt-3"
              style={{ background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)' }}
            >
              {hasLimit && remaining !== null && (
                <div
                  className="mx-auto mb-3 flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold"
                  style={exhausted
                    ? { background: 'rgba(239,68,68,0.1)', color: '#dc2626' }
                    : { background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)', color: '#059669' }}
                >
                  <ZapIcon className="h-3.5 w-3.5" />
                  {exhausted ? 'Bugünkü hakkın doldu' : `${remaining} çevirme hakkın kaldı`}
                </div>
              )}

              {exhausted ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                  <p className="text-[14px] font-bold text-foreground-strong">Bugünlük hakkın doldu 🎉</p>
                  <p className="mt-0.5 text-[12px] text-foreground-muted">Yarın tekrar çevirebilirsin.</p>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={spinning || wheel.slices.length === 0}
                  onClick={handleSpin}
                  className="flex w-full items-center justify-center gap-2 rounded-lg py-3.5 text-[15px] font-extrabold text-white transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
                  style={{
                    background: 'linear-gradient(135deg, #334155 0%, #4f46e5 100%)',
                    boxShadow: '0 10px 24px -8px rgba(51,65,85,0.45)',
                  }}
                >
                  {spinning ? (
                    <>
                      <Loader2Icon className="h-4 w-4 animate-spin" /> Çevriliyor…
                    </>
                  ) : (
                    <>
                      <CircleDotIcon className="h-4 w-4" /> Çarkı Çevir
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      <WheelSpinResultModal result={shownResult} onClose={() => setShownResult(null)} />
    </>
  )
}
