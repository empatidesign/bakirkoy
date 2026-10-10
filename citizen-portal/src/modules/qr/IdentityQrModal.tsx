import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCwIcon, ShieldCheckIcon } from 'lucide-react'
import { Modal } from '@/design-system'
import { QrCode } from '@/design-system/QrCode/QrCode'
import identityService from '@/services/identity.service'
import type { CitizenIdentityQrDto } from '@/types/identity.types'
import { secondsUntil, deadlineFromNow } from '@/lib/countdown'

interface Props {
  open: boolean
  onClose: () => void
}

export const IdentityQrModal = ({ open, onClose }: Props) => {
  const [qr, setQr] = useState<CitizenIdentityQrDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /** QR'ın geçerlilik bitiş anı; sayaç bundan türetilir (bkz. docs/hata.md #6.1). */
  const deadlineRef = useRef<number>(0)

  const clearTimers = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  // Hata raporu (docs/hata.md #6.1) ile aynı kök neden: "her tick'te 1 azalt" yaklaşımı,
  // tick gecikmelerini biriktirdiği için sayaç gerçek zamanın gerisinde kalıyordu. Kalan süre
  // artık bitiş anına göre yeniden hesaplanır.
  const startCountdown = (seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    deadlineRef.current = deadlineFromNow(seconds)
    setSecondsLeft(seconds)
    countdownRef.current = setInterval(() => {
      const remaining = secondsUntil(deadlineRef.current)
      setSecondsLeft(remaining)
      if (remaining === 0 && countdownRef.current) clearInterval(countdownRef.current)
    }, 250)
  }

  const fetchQr = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await identityService.identityQr()
      setQr(data)

      const expiresAt = new Date(data.expiresAt).getTime()
      const remaining = Math.max(1, Math.round((expiresAt - Date.now()) / 1000))
      startCountdown(remaining)

      refreshTimerRef.current = setTimeout(() => fetchQr(), remaining * 1000)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      clearTimers()
      setQr(null)
      setError(false)
      return
    }
    fetchQr()
    return clearTimers
  }, [open, fetchQr])

  useEffect(() => {
    if (!open) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const expiresMs = qr ? new Date(qr.expiresAt).getTime() : 0
      if (!qr || expiresMs <= Date.now()) void fetchQr()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [open, qr, fetchQr])

  const progressPct = qr ? (secondsLeft / qr.rotationSeconds) * 100 : 100

  return (
    <Modal open={open} onClose={onClose} title="Kimlik QR Kodum" width={360} bodyClassName="p-5">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 type-caption text-foreground-muted">
          <ShieldCheckIcon className="h-3.5 w-3.5 text-success" />
          {qr?.rotationSeconds ?? 60} saniyede bir otomatik yenilenir
        </div>

        <div className="rounded-card border border-border bg-surface-0 p-4">
          {loading && !qr ? (
            <div className="grid h-[216px] w-[216px] place-items-center">
              <RefreshCwIcon className="h-6 w-6 animate-spin text-foreground-subtle" />
            </div>
          ) : error ? (
            <div className="flex h-[216px] w-[216px] flex-col items-center justify-center gap-2">
              <p className="type-caption text-danger text-center">QR kodu yüklenemedi.</p>
              <button
                type="button"
                className="type-caption text-primary underline"
                onClick={fetchQr}
              >
                Tekrar dene
              </button>
            </div>
          ) : qr ? (
            <QrCode value={qr.token} size={216} />
          ) : null}
        </div>

        {qr && (
          <div className="w-full space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="type-caption text-foreground-muted">Yenilenme</span>
              <span className="type-caption font-mono text-foreground-strong">{secondsLeft}s</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        <p className="type-caption text-center text-foreground-muted">
          Bu kodu yetkili okuyucuya gösterin. Kod size özeldir, başkasıyla paylaşmayın.
        </p>
      </div>
    </Modal>
  )
}
