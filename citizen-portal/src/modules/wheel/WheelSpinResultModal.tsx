import { createPortal } from 'react-dom'
import { GiftIcon, StarIcon, XIcon, PartyPopperIcon, FrownIcon } from 'lucide-react'
import { useOverlayDismiss } from '@/lib/useOverlayDismiss'
import type { WheelSpinResult } from '@/types/wheel.types'

type Props = {
  result: WheelSpinResult | null
  onClose: () => void
}

export const WheelSpinResultModal = ({ result, onClose }: Props) => {
  useOverlayDismiss(!!result, onClose)
  if (!result) return null

  const isGift = result.sliceType === 'gift'
  const wonPoints = result.pointsWon != null && result.pointsWon > 0
  const isWin = isGift || wonPoints
  const won = isGift || result.giftId != null || wonPoints

  const theme = won
    ? { grad: 'linear-gradient(135deg, #334155 0%, #4f46e5 65%, #6366f1 100%)', glow: 'rgba(79,70,229,0.4)' }
    : { grad: 'linear-gradient(135deg, #475569 0%, #64748b 100%)', glow: 'rgba(100,116,139,0.4)' }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <style>{`
        @keyframes result-pop{0%{transform:scale(0.9);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes badge-bounce{0%{transform:scale(0)}60%{transform:scale(1.12)}100%{transform:scale(1)}}
      `}</style>
      <div
        className="absolute inset-0 backdrop-blur-md"
        style={{ background: 'rgba(15,23,42,0.62)' }}
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full overflow-hidden rounded-lg bg-card"
        style={{ maxWidth: 340, boxShadow: `0 30px 70px -18px ${theme.glow}`, animation: 'result-pop 0.28s cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div className="relative px-6 pb-8 pt-7 text-center" style={{ background: theme.grad }}>
          <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full opacity-30 blur-2xl" style={{ background: 'radial-gradient(circle,#c7d2fe,transparent 70%)' }} />

          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white/90 backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <XIcon className="h-4 w-4" />
          </button>

          <div
            className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm"
            style={{ animation: 'badge-bounce 0.5s cubic-bezier(0.16,1,0.3,1) 0.1s both' }}
          >
            {isGift ? (
              <GiftIcon className="h-10 w-10 text-white" />
            ) : isWin ? (
              <StarIcon className="h-10 w-10 fill-white text-white" />
            ) : (
              <FrownIcon className="h-10 w-10 text-white" />
            )}
          </div>

          <p className="relative mt-4 flex items-center justify-center gap-1.5 text-[13px] font-bold uppercase tracking-wide text-white/85">
            {won ? <><PartyPopperIcon className="h-4 w-4" /> Tebrikler!</> : 'Bu sefer olmadı'}
          </p>
        </div>

        <div className="px-6 pb-6 pt-5 text-center">
          <p className="text-[20px] font-extrabold text-foreground-strong">{result.sliceLabel}</p>

          {wonPoints && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-4 py-1.5">
              <StarIcon className="h-4 w-4 fill-warning text-warning" />
              <span className="text-[14px] font-bold text-foreground-strong">{result.pointsWon} puan kazandın</span>
            </div>
          )}

          {result.giftId && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[13px] font-bold text-white" style={{ background: 'linear-gradient(135deg,#334155,#4f46e5)' }}>
              <GiftIcon className="h-4 w-4" /> Hediye kazandın!
            </div>
          )}

          {result.remainingSpinsToday != null && (
            <p className="mt-4 text-[12px] text-foreground-muted">
              Bugün kalan hakkın: <span className="font-bold text-foreground-strong">{result.remainingSpinsToday}</span>
            </p>
          )}

          <button
            type="button"
            onClick={onClose}
            className="mt-5 w-full rounded-lg py-3 text-[14px] font-bold text-white transition-all hover:scale-[1.015] active:scale-[0.98]"
            style={{ background: theme.grad, boxShadow: `0 10px 24px -6px ${theme.glow}` }}
          >
            {won ? 'Harika!' : 'Tamam'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
