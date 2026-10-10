import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCwIcon, DoorOpenIcon } from 'lucide-react'
import { Modal } from '@/design-system'
import { QrCode } from '@/design-system/QrCode/QrCode'
import libraryService from '@/services/library.service'
import type { LibraryDoorQr } from '@/types/library.types'

// citizen-portal/src/modules/qr/IdentityQrModal.tsx ile aynı desende — personelin kendi
// kapı QR'ını (kütüphane-görevlisi-kapı-erişimi işi, kullanıcı onayıyla kuruldu) rotating
// olarak gösterir. door-access yetkisi rolde yoksa QR yine üretilir ama kapıda okutulduğunda
// "Kapı açma yetkiniz yok" ile reddedilir (bkz. LibraryWebhookService.HandleStaffDoorAsync) —
// bu ekranda ayrıca bir yetki uyarısı gösterilmiyor çünkü tek doğruluk kaynağı roldeki
// canlı yetki kontrolü, burada tekrarlamak yanıltıcı olabilir (rol her an değişebilir).
interface Props {
  open: boolean
  onClose: () => void
}

export const StaffDoorQrModal = ({ open, onClose }: Props) => {
  const [qr, setQr] = useState<LibraryDoorQr | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
  }

  const startCountdown = (seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setSecondsLeft(seconds)
    countdownRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }

  const fetchQr = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await libraryService.staff.getMyDoorQr()
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
    <Modal open={open} onClose={onClose} title="Kapı QR Kodum" width={360} bodyClassName="p-5">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 type-caption text-foreground-muted">
          <DoorOpenIcon className="h-3.5 w-3.5 text-primary" />
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
              <button type="button" className="type-caption text-primary underline" onClick={fetchQr}>
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
          Bu kodu kapı okuyucusuna gösterin. Kapı açma yetkiniz rolünüze bağlıdır; yetkiniz
          yoksa okutma reddedilir.
        </p>
      </div>
    </Modal>
  )
}
