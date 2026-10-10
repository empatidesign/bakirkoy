import { useEffect, useState } from 'react'
import { ScanLineIcon, CheckCircle2Icon, XCircleIcon, Loader2Icon } from 'lucide-react'
import { Modal, Button } from '@/design-system'
import { QrScanner } from '@/components/specialized/QrScanner'
import libraryService from '@/services/library.service'
import { getCurrentPosition } from '@/lib/geolocation'
import { extractStaticQrCode } from '@/lib/staticQrCode'
import { LocationHelp, errorCodeOf } from '@/components/specialized/LocationHelp'

type ScanState =
  | { status: 'scanning' }
  | { status: 'loading' }
  | { status: 'success'; message: string; sub?: string | null }
  | { status: 'error'; message: string; code?: string }

interface Props {
  label?: string
  variant?: 'primary' | 'outline' | 'ghost'
  className?: string
  disabled?: boolean
  onSuccess?: () => void
}

export const LibraryStaticQrScanButton = ({ label = 'QR Okut', variant = 'outline', className, disabled, onSuccess }: Props) => {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<ScanState>({ status: 'scanning' })

  const close = () => { setOpen(false); setState({ status: 'scanning' }) }
  const openScanner = () => { setState({ status: 'scanning' }); setOpen(true) }

  useEffect(() => {
    if (state.status !== 'success') return
    const t = setTimeout(close, 1500)
    return () => clearTimeout(t)
  }, [state.status])

  const handleScan = async (text: string) => {
    setState({ status: 'loading' })
    try {
      const code = extractStaticQrCode(text)
      const geo = await getCurrentPosition()
      const res = await libraryService.staticScan(
        code,
        geo.ok ? geo.position.latitude : null,
        geo.ok ? geo.position.longitude : null,
      )
      setState({ status: 'success', message: res.message, sub: res.seat ? `Koltuk: ${res.seat}` : undefined })
      onSuccess?.()
    } catch (err) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'QR kodu işlenemedi. Lütfen tekrar deneyin.')
      setState({ status: 'error', message, code: errorCodeOf(err) })
    }
  }

  return (
    <>
      <Button variant={variant} size="lg" className={className ?? 'w-full gap-1'} disabled={disabled} onClick={openScanner}>
        <ScanLineIcon className="h-4 w-4" /> {label}
      </Button>

      <Modal open={open} onClose={close} title="QR Okut" width={400} bodyClassName="p-5">
        <div className="flex flex-col items-center gap-4">
          {state.status === 'scanning' && (
            <>
              <p className="type-caption text-center text-foreground-muted">
                Girişteki duvara asılı sabit QR kodunu kameranıza gösterin.
              </p>
              <QrScanner onScan={(text) => { void handleScan(text) }} />
            </>
          )}

          {state.status === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
              <p className="type-body-strong">İşleminiz kontrol ediliyor...</p>
            </div>
          )}

          {state.status === 'success' && (
            <div className="flex w-full flex-col items-center gap-3 py-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-success/10">
                <CheckCircle2Icon className="h-8 w-8 text-success" />
              </div>
              <p className="type-body-strong text-center">{state.message}</p>
              {state.sub && <p className="type-caption text-foreground-muted">{state.sub}</p>}
              <Button variant="primary" size="lg" className="w-full" onClick={close}>Tamam</Button>
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex w-full flex-col items-center gap-3 py-4">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-danger/10">
                <XCircleIcon className="h-8 w-8 text-danger" />
              </div>
              <p className="type-body-strong text-center">{state.message}</p>
              <LocationHelp code={state.code} onReady={() => setState({ status: 'scanning' })} />
              <div className="flex w-full gap-2">
                <Button variant="outline" size="lg" className="flex-1" onClick={() => setState({ status: 'scanning' })}>Tekrar Dene</Button>
                <Button variant="ghost" size="lg" className="flex-1" onClick={close}>Kapat</Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}

export default LibraryStaticQrScanButton
