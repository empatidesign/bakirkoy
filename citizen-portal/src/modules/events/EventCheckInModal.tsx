import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2Icon, LogInIcon, LogOutIcon, MapPinIcon } from 'lucide-react'
import { Modal, Button } from '@/design-system'
import { QrScanner } from '@/components/specialized/QrScanner'
import type { CitizenEventDetail, CitizenEventSession } from '@/types/event.types'
import eventService from '@/services/event.service'
import { getCurrentPosition } from '@/lib/geolocation'

interface Props {
  open: boolean
  onClose: () => void
  detail: CitizenEventDetail
  activeSession: CitizenEventSession | null
}

type Step = 'pick' | 'scanning' | 'done'
type Kind = 'check_in' | 'check_out'

function scheduleCheckoutReminder(session: CitizenEventSession) {
  if (!('Notification' in window)) return
  const [h, m] = session.endTime.split(':').map(Number)
  const [y, mo, d] = session.date.split('-').map(Number)
  const sessionEnd = new Date(y, mo - 1, d, h, m, 0)
  const delay = sessionEnd.getTime() - 15 * 60 * 1000 - Date.now()
  if (delay <= 0) return
  Notification.requestPermission().then((perm) => {
    if (perm !== 'granted') return
    setTimeout(() => {
      new Notification('QR Çıkış Hatırlatması', {
        body: `Seansın bitmesine 15 dakika kaldı. Çıkış QR'ını okutmayı unutmayın!`,
      })
    }, delay)
  })
}

export const EventCheckInModal = ({ open, onClose, detail, activeSession }: Props) => {
  const [step, setStep] = useState<Step>('pick')
  const [kind, setKind] = useState<Kind>('check_in')
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)

  const isBothModes = detail.entryMethod === 'checkin-checkout'
  const sessionId = activeSession?.id ?? null

  const reset = () => { setStep('pick'); setKind('check_in'); setLoading(false); setLocating(false) }

  const handleClose = () => { reset(); onClose() }

  const startScan = (k: Kind) => { setKind(k); setStep('scanning') }

  const tryGetLocation = async (): Promise<{ latitude?: number; longitude?: number }> => {
    setLocating(true)
    try {
      const res = await getCurrentPosition()
      return res.ok ? { latitude: res.position.latitude, longitude: res.position.longitude } : {}
    } finally {
      setLocating(false)
    }
  }

  const handleManual = async (k: Kind) => {
    setLoading(true)
    try {
      const loc = await tryGetLocation()
      await eventService.checkIn(detail.id, { sessionId, kind: k, qrCode: null, ...loc })
      toast.success(k === 'check_in' ? 'Girişiniz kaydedildi.' : 'Çıkışınız kaydedildi.')
      if (k === 'check_in' && isBothModes && activeSession) scheduleCheckoutReminder(activeSession)
      setStep('done')
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleQrScan = async (code: string) => {
    try {
      const loc = await tryGetLocation()
      await eventService.checkIn(detail.id, { sessionId, kind, qrCode: code, ...loc })
      toast.success(kind === 'check_in' ? 'Girişiniz kaydedildi.' : 'Çıkışınız kaydedildi.')
      if (kind === 'check_in' && isBothModes && activeSession) scheduleCheckoutReminder(activeSession)
      setStep('done')
    } catch {
      setStep('pick')
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Etkinlik Girişi" width={400} bodyClassName="p-5">
      {step === 'done' ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2Icon className="h-12 w-12 text-success" />
          <p className="type-section text-foreground-strong">
            {kind === 'check_in' ? 'Girişiniz kaydedildi!' : 'Çıkışınız kaydedildi!'}
          </p>
          {kind === 'check_in' && isBothModes && activeSession && (
            <p className="type-caption text-foreground-muted">
              Seans bitimine 15 dk kala çıkış QR hatırlatması alacaksınız.
            </p>
          )}
          <Button variant="outline" className="mt-2 w-full" onClick={handleClose}>Kapat</Button>
        </div>
      ) : step === 'scanning' ? (
        <div className="space-y-3">
          <p className="type-body text-center text-foreground-muted">
            {kind === 'check_in' ? 'Giriş QR kodunu okutun' : 'Çıkış QR kodunu okutun'}
          </p>
          <QrScanner onScan={handleQrScan} />
          <Button variant="ghost" className="w-full" onClick={() => setStep('pick')}>Geri</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {locating && (
            <div className="flex items-center gap-2 rounded-field bg-primary-soft px-3 py-2 text-sm text-primary">
              <MapPinIcon className="h-4 w-4 animate-pulse" /> Konumunuz kontrol ediliyor…
            </div>
          )}
          {detail.qrEnabled && (
            <div className="space-y-2">
              <p className="type-label">QR Okut</p>
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1"
                  iconLeft={<LogInIcon className="h-4 w-4" />}
                  onClick={() => startScan('check_in')}
                >
                  Giriş QR
                </Button>
                {isBothModes && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    iconLeft={<LogOutIcon className="h-4 w-4" />}
                    onClick={() => startScan('check_out')}
                  >
                    Çıkış QR
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="type-label">Manuel Giriş</p>
            <div className="flex gap-2">
              <Button
                variant={detail.qrEnabled ? 'outline' : 'primary'}
                className="flex-1"
                iconLeft={<LogInIcon className="h-4 w-4" />}
                isLoading={loading && kind === 'check_in'}
                disabled={loading}
                onClick={() => handleManual('check_in')}
              >
                Giriş
              </Button>
              {isBothModes && (
                <Button
                  variant="outline"
                  className="flex-1"
                  iconLeft={<LogOutIcon className="h-4 w-4" />}
                  isLoading={loading && kind === 'check_out'}
                  disabled={loading}
                  onClick={() => handleManual('check_out')}
                >
                  Çıkış
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
