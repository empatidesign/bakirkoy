import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2Icon, XCircleIcon, Loader2Icon, DoorOpenIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import facilityService from '@/services/facility.service'
import libraryService from '@/services/library.service'
import eventService from '@/services/event.service'
import { pendingQr } from '@/services/pendingQr'
import { getCurrentPosition } from '@/lib/geolocation'
import { extractStaticQrCode, isLibraryStaticQr, isEventStaticQr } from '@/lib/staticQrCode'
import { LocationHelp, errorCodeOf } from '@/components/specialized/LocationHelp'

type ScanState = { status: 'loading' } | { status: 'success'; message: string; sub?: string } | { status: 'error'; message: string; code?: string }

export const QrGirisPage = () => {
  const { code: rawCode } = useParams<{ code: string }>()
  const code = rawCode ? extractStaticQrCode(rawCode) : undefined
  const navigate = useNavigate()
  const { state } = useAuth()
  const [result, setResult] = useState<ScanState>({ status: 'loading' })
  const ranRef = useRef(false)

  useEffect(() => {
    if (!code) {
      navigate('/', { replace: true })
      return
    }

    if (state.status === 'idle') return

    if (state.status !== 'authenticated') {
      pendingQr.set(code)
      navigate('/login', { replace: true })
      return
    }

    if (ranRef.current) return
    ranRef.current = true

    pendingQr.take()

    const run = async () => {
      try {
        const geo = await getCurrentPosition()
        const latitude = geo.ok ? geo.position.latitude : null
        const longitude = geo.ok ? geo.position.longitude : null
        if (isLibraryStaticQr(code)) {
          const res = await libraryService.staticScan(code, latitude, longitude)
          setResult({
            status: 'success',
            message: res.message,
            sub: res.seat ? `Koltuk: ${res.seat}` : undefined,
          })
        } else if (isEventStaticQr(code)) {
          const res = await eventService.staticScan(code)
          if (res.allowed) {
            setResult({ status: 'success', message: res.message, sub: res.eventName ?? undefined })
          } else {
            setResult({ status: 'error', message: res.message, code: res.errorCode ?? undefined })
          }
        } else {
          const res = await facilityService.staticScan(code)
          if (res.allowed) {
            setResult({ status: 'success', message: res.message, sub: res.groupName ?? undefined })
          } else {
            setResult({ status: 'error', message: res.message, code: res.errorCode ?? undefined })
          }
        }
      } catch (err) {
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? (err instanceof Error ? err.message : 'QR kodu işlenemedi. Lütfen tekrar deneyin.')
        setResult({ status: 'error', message, code: errorCodeOf(err) })
      }
    }

    void run()
  }, [code, state.status, navigate])

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-surface-1 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 text-center shadow-xl border border-border">
        {result.status === 'loading' && (
          <>
            <Loader2Icon className="mx-auto h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-base font-semibold text-foreground-strong">İşleminiz kontrol ediliyor...</p>
          </>
        )}
        {result.status === 'success' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2Icon className="h-9 w-9 text-success" />
            </div>
            <p className="mt-4 text-lg font-bold text-foreground-strong">{result.message}</p>
            {result.sub && <p className="mt-1 text-sm text-foreground-muted">{result.sub}</p>}
            <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-foreground-subtle">
              <DoorOpenIcon className="h-3.5 w-3.5" />
              <span>İşleminiz kaydedildi</span>
            </div>
          </>
        )}
        {result.status === 'error' && (
          <>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10">
              <XCircleIcon className="h-9 w-9 text-danger" />
            </div>
            <p className="mt-4 text-base font-semibold text-foreground-strong">{result.message}</p>
            <div className="mt-4"><LocationHelp code={result.code} onReady={() => window.location.reload()} /></div>
          </>
        )}
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          className="mt-6 w-full rounded-2xl bg-primary py-3 text-sm font-bold text-white"
        >
          Ana Sayfaya Dön
        </button>
      </div>
    </div>
  )
}

export default QrGirisPage
