import { useEffect, useRef, useState, useCallback } from 'react'
import { RefreshCwIcon, ShieldCheckIcon, ArmchairIcon, LayersIcon, ClockIcon, RadioIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/design-system'
import { QrCode } from '@/design-system/QrCode/QrCode'
import identityService from '@/services/identity.service'
import libraryService from '@/services/library.service'
import { citizenRealtime } from '@/services/citizenRealtime'
import { isSessionActive } from '@/types/library.types'
import type { CitizenIdentityQrDto } from '@/types/identity.types'
import { secondsUntil, deadlineFromNow } from '@/lib/countdown'

export type LibraryAction = 'entry' | 'exit' | 'short_break' | 'long_break' | 'end_break'

const ACTION_TITLES: Record<LibraryAction, string> = {
  entry: 'QR ile Giriş Yap',
  exit: 'QR ile Çıkış Yap',
  short_break: 'Kısa Mola QR Kodu',
  long_break: 'Uzun Mola QR Kodu',
  end_break: 'Moladan Dönüş QR Kodu',
}

const ACTION_HINTS: Record<LibraryAction, string> = {
  entry: 'Kütüphaneye giriş yapmak için QR kodu okutun.',
  exit: 'Kütüphaneden çıkış yapmak için QR kodu okutun.',
  short_break: 'Kısa molaya çıkmak için QR kodu okutun. Süreniz durur, masanız tutulur.',
  long_break: 'Uzun molaya çıkmak için QR kodu okutun. Süreniz durur, masanız tutulur.',
  end_break: 'Moladan dönüp oturumunuza devam etmek için QR kodu okutun.',
}

interface Props {
  open: boolean
  onClose: () => void
  action: LibraryAction
  libraryId: string
  seatLabel?: string | null
  floorName?: string | null
  accessType?: string
  deviceKind?: string | null
  onSuccess?: () => void
  intentGuardRef?: React.MutableRefObject<string | null>
}

export const LibraryActionQrModal = ({ open, onClose, action, seatLabel, floorName, accessType, onSuccess, intentGuardRef }: Props) => {
  const [qr, setQr] = useState<CitizenIdentityQrDto | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(60)
  const [exitWindowSeconds, setExitWindowSeconds] = useState<number | null>(null)
  const [exitCountdown, setExitCountdown] = useState<number>(0)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const exitCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const intentRequestedRef = useRef(false)
  // Hata raporu (docs/hata.md #6.1): sayaç "her tick'te 1 azalt" mantığındaydı; tick'ler
  // render/animasyon yüküyle geciktiği için ~5 saniyede 1 saniye düşüyordu. Artık bitiş ANI
  // saklanıyor ve kalan süre "bitiş - şimdi" olarak yeniden hesaplanıyor; tick gecikse bile
  // gösterilen değer gerçek saatle senkron kalır.
  const qrDeadlineRef = useRef<number>(0)
  const exitDeadlineRef = useRef<number>(0)

  const isDevice = accessType === 'device'

  const clearTimers = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    if (exitCountdownRef.current) clearInterval(exitCountdownRef.current)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const startCountdown = (seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    qrDeadlineRef.current = deadlineFromNow(seconds)
    setSecondsLeft(seconds)
    countdownRef.current = setInterval(() => {
      const remaining = secondsUntil(qrDeadlineRef.current)
      setSecondsLeft(remaining)
      if (remaining === 0 && countdownRef.current) clearInterval(countdownRef.current)
    }, 250)
  }

  /** Çıkış/mola penceresi sayacı — aynı gerçek-zaman kuralı (bkz. docs/hata.md #6.1). */
  const startExitCountdown = (seconds: number) => {
    if (exitCountdownRef.current) clearInterval(exitCountdownRef.current)
    exitDeadlineRef.current = deadlineFromNow(seconds)
    setExitCountdown(seconds)
    exitCountdownRef.current = setInterval(() => {
      const remaining = secondsUntil(exitDeadlineRef.current)
      setExitCountdown(remaining)
      if (remaining === 0 && exitCountdownRef.current) clearInterval(exitCountdownRef.current)
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
      setExitWindowSeconds(null)
      setExitCountdown(0)
      intentRequestedRef.current = false
      return
    }
    const alreadySentByParent = intentGuardRef ? intentGuardRef.current === action : false
    if (!intentRequestedRef.current && !alreadySentByParent && (action === 'exit' || action === 'short_break' || action === 'long_break')) {
      intentRequestedRef.current = true
      if (intentGuardRef) intentGuardRef.current = action
      if (action === 'exit') {
        libraryService.pendingExit().then((result) => {
          const secs = result.expiresInSeconds
          setExitWindowSeconds(secs)
          startExitCountdown(secs)
        }).catch((err) => {
          const message = err?.response?.data?.message || 'Çıkış işlemi başlatılamadı. Lütfen tekrar deneyin.'
          if (intentGuardRef) intentGuardRef.current = null
          toast.error(message)
          onClose()
        })
      } else {
        libraryService.pendingBreak(action === 'long_break' ? 'long' : 'short').then((result) => {
          const secs = result.expiresInSeconds
          setExitWindowSeconds(secs)
          startExitCountdown(secs)
        }).catch((err) => {
          const message = err?.response?.data?.message || 'Mola başlatılamadı. Lütfen tekrar deneyin.'
          if (intentGuardRef) intentGuardRef.current = null
          toast.error(message)
          onClose()
        })
      }
    }
    fetchQr()
    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentGuardRef stabil bir ref; onClose parent'ta inline geçildiği için eklenirse her render'da gereksiz yeniden tetikleme olur
  }, [open, action, fetchQr])

  useEffect(() => {
    if (!open) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (qrDeadlineRef.current > Date.now()) return
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
      void fetchQr()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [open, fetchQr])

  useEffect(() => {
    if (!open || !isDevice) return

    const isTargetReached = (status: string | undefined | null): boolean => {
      switch (action) {
        case 'entry':
        case 'end_break':
          return status === 'inside'
        case 'short_break':
          return status === 'on_break_short'
        case 'long_break':
          return status === 'on_break_long'
        case 'exit':
          return !isSessionActive(status)
        default:
          return false
      }
    }

    const finish = () => {
      if (pollRef.current) clearInterval(pollRef.current)
      toast.success('İşlem tamamlandı.')
      onSuccess?.()
      onClose()
    }

    const off = citizenRealtime.onLibrarySession((e) => {
      if (isTargetReached(e.status ?? undefined)) finish()
    })

    const offDenied = citizenRealtime.onLibraryScanDenied((e) => {
      const wrongDevice = (action === 'exit' && e.action === 'entry') || (action === 'entry' && e.action === 'exit')
      const hint = action === 'exit' ? 'Çıkış için QR kodu ÇIKIŞ cihazına okutun.' : 'Giriş için QR kodu GİRİŞ cihazına okutun.'
      toast.error(wrongDevice ? `${e.message} ${hint}` : e.message)
    })

    const check = () => {
      libraryService.session().then((session) => {
        if (isTargetReached(session?.status)) finish()
      }).catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }

    pollRef.current = setInterval(check, 2000)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      off()
      offDenied()
      document.removeEventListener('visibilitychange', onVisible)
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [open, isDevice, action, onSuccess, onClose])

  const mmss = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
  const ringPct = qr ? Math.max(0, Math.min(100, (secondsLeft / qr.rotationSeconds) * 100)) : 100
  const RING = 2 * Math.PI * 26

  return (
    <Modal open={open} onClose={onClose} title={ACTION_TITLES[action]} width={400} bodyClassName="p-5">
      <div className="flex flex-col items-center gap-4">
        {(seatLabel || floorName) && (
          <div className="flex w-full items-center justify-between gap-3 rounded-card bg-primary-soft px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-field bg-primary/15 text-primary">
                <ArmchairIcon className="h-5 w-5" />
              </span>
              <div className="leading-tight">
                <p className="type-caption text-foreground-muted">Seçilen Masa</p>
                <p className="type-body-strong text-primary">{seatLabel ?? 'Koltuk'}</p>
              </div>
            </div>
            {floorName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-0 px-2.5 py-1 type-caption text-foreground-strong">
                <LayersIcon className="h-3.5 w-3.5" /> {floorName}
              </span>
            )}
          </div>
        )}

        <div className="relative rounded-card border border-border bg-surface-0 p-4">
          <span className="pointer-events-none absolute left-2.5 top-2.5 h-5 w-5 rounded-tl-lg border-l-2 border-t-2 border-primary" />
          <span className="pointer-events-none absolute right-2.5 top-2.5 h-5 w-5 rounded-tr-lg border-r-2 border-t-2 border-primary" />
          <span className="pointer-events-none absolute bottom-2.5 left-2.5 h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-primary" />
          <span className="pointer-events-none absolute bottom-2.5 right-2.5 h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-primary" />
          {loading && !qr ? (
            <div className="grid h-[240px] w-[240px] place-items-center">
              <RefreshCwIcon className="h-6 w-6 animate-spin text-foreground-subtle" />
            </div>
          ) : error ? (
            <div className="flex h-[240px] w-[240px] flex-col items-center justify-center gap-2">
              <p className="type-caption text-danger text-center">QR kodu yüklenemedi.</p>
              <button type="button" className="type-caption text-primary underline" onClick={fetchQr}>
                Tekrar dene
              </button>
            </div>
          ) : qr ? (
            <QrCode value={qr.token} size={240} />
          ) : null}
        </div>

        <p className="type-body-strong text-center text-foreground-strong">{ACTION_HINTS[action]}</p>
        <p className="type-caption text-center text-foreground-muted -mt-2">
          Kod sadece sizin için geçerlidir, başkasıyla paylaşmayın.
        </p>

        {(action === 'exit' || action === 'short_break' || action === 'long_break') && exitWindowSeconds !== null ? (
          <div className="flex w-full items-center gap-3 rounded-card bg-warning/10 px-4 py-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-surface-0 text-warning">
              <ClockIcon className="h-5 w-5" />
            </span>
            <div className="flex-1 leading-tight">
              <p className="type-body-strong text-foreground-strong">
                {action === 'exit' ? 'Çıkış' : 'Mola'} pencereniz {mmss(exitCountdown)} içinde geçerliliğini yitirecek.
              </p>
              <p className="type-caption text-foreground-muted">
                Bu süre içinde QR geçiş işlemini tamamlayın.
              </p>
            </div>
          </div>
        ) : qr ? (
          <div className="flex w-full items-center gap-3 rounded-card bg-primary-soft px-4 py-3">
            <div className="flex-1 leading-tight">
              <p className="type-body-strong text-primary">Seçiminiz {mmss(secondsLeft)} içinde geçerliliğini yitirecek.</p>
              <p className="type-caption text-foreground-muted">Süreniz bitmeden QR kodu okutarak giriş yapınız.</p>
            </div>
            <div className="relative grid h-14 w-14 flex-shrink-0 place-items-center">
              <svg className="absolute inset-0 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="26" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary/15" />
                <circle
                  cx="28" cy="28" r="26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
                  className="text-primary transition-all duration-1000"
                  strokeDasharray={RING}
                  strokeDashoffset={RING - (ringPct / 100) * RING}
                />
              </svg>
              <span className="type-caption font-mono font-semibold text-primary">{mmss(secondsLeft)}</span>
            </div>
          </div>
        ) : null}

        {isDevice ? (
          <div className="flex w-full items-start gap-3 rounded-card bg-primary-soft px-4 py-3">
            <RadioIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            <div className="leading-tight">
              <p className="type-body-strong text-primary">QR ile Geçiş</p>
              <p className="type-caption text-foreground-muted">
                Oluşturulan QR kod ile güvenli geçiş işleminizi tamamlayın.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex w-full items-start gap-3 rounded-card bg-surface-1 px-4 py-3">
            <ShieldCheckIcon className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" />
            <div className="leading-tight">
              <p className="type-body-strong">Güvenliğiniz için</p>
              <p className="type-caption text-foreground-muted">
                Bu QR kod size özeldir ve başka bir cihazda kullanılamaz.
              </p>
            </div>
          </div>
        )}

      </div>
    </Modal>
  )
}
