import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'
import { CameraOffIcon, RefreshCwIcon } from 'lucide-react'

interface QrScannerProps {
  onScan: (text: string) => void
}

const ELEMENT_ID = 'company-qr-scanner-region'

const describeCameraError = (err: unknown): string => {
  if (!window.isSecureContext) {
    return 'Bu sayfa güvenli bağlantı (https) üzerinden açılmadığı için tarayıcı kamera erişimini engelliyor. Adres çubuğunda "https://" ile başlayan adresi kullanın (http://IP:port veya http://alan-adi ile kamera hiçbir tarayıcıda açılmaz).'
  }
  const name = (err as { name?: string })?.name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Kamera izni reddedildi. Tarayıcının adres çubuğundaki kilit/kamera simgesinden bu site için kamera iznini "İzin Ver" yapıp sayfayı yenileyin.'
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Cihazda kullanılabilir bir kamera bulunamadı.'
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Kameraya erişilemiyor çünkü başka bir uygulama veya tarayıcı sekmesi tarafından kullanılıyor olabilir. Diğer kamera kullanan uygulamaları/sekmeleri kapatıp tekrar deneyin.'
  }
  if (name === 'OverconstrainedError') {
    return 'Cihazın arka kamerasına erişilemedi. Cihazınızda uygun bir kamera olmayabilir.'
  }
  return 'Kameraya erişilemedi. İzin verin ya da aşağıdan QR içeriğini yapıştırın / TC-telefon ile devam edin.'
}

export const QrScanner = ({ onScan }: QrScannerProps) => {
  const onScanRef = useRef(onScan)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const lifecycleRef = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => { onScanRef.current = onScan }, [onScan])

  useEffect(() => {
    let cancelled = false
    let scanner: Html5Qrcode | null = null
    let locked = false

    lifecycleRef.current = lifecycleRef.current
      .catch(() => undefined)
      .then(async () => {
        if (cancelled) return
        if (!navigator.mediaDevices?.getUserMedia) {
          if (!cancelled) setError(describeCameraError(null))
          return
        }
        try {
          scanner = new Html5Qrcode(ELEMENT_ID)
          await scanner.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (decoded) => {
              if (locked) return
              locked = true
              onScanRef.current(decoded)
            },
            () => undefined,
          )
        } catch (err) {
          if (!cancelled) {
            console.error('QrScanner: kamera başlatılamadı', err)
            setError(describeCameraError(err))
          }
        }
      })

    return () => {
      cancelled = true
      lifecycleRef.current = lifecycleRef.current
        .catch(() => undefined)
        .then(async () => {
          const s = scanner
          if (!s) return
          try {
            const state = s.getState()
            if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
              await s.stop().catch(() => undefined)
            }
            try { s.clear() } catch { /* ignore */ }
          } catch { /* ignore */ }
        })
    }
  }, [attempt])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border bg-surface-1 p-6 text-center">
        <CameraOffIcon className="h-8 w-8 text-foreground-subtle" />
        <p className="type-caption text-foreground-muted">{error}</p>
        <button
          type="button"
          onClick={() => { setError(null); setAttempt((a) => a + 1) }}
          className="mt-1 inline-flex items-center gap-1.5 rounded-field border border-border bg-surface-0 px-3 py-1.5 type-caption font-semibold text-foreground-strong transition hover:bg-surface-2"
        >
          <RefreshCwIcon className="h-3.5 w-3.5" /> Tekrar Dene
        </button>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-black">
      <div id={ELEMENT_ID} className="mx-auto w-full [&_video]:w-full" />
    </div>
  )
}
