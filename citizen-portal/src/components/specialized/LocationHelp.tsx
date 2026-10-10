import { useState } from 'react'
import { MapPinIcon } from 'lucide-react'
import { Button } from '@/design-system'
import { getCurrentPosition } from '@/lib/geolocation'
import { isNativePlatform, platformName } from '@/lib/platform'

const LOCATION_CODES = new Set(['LOCATION_REQUIRED', 'OUTSIDE_GEOFENCE'])

export const errorCodeOf = (err: unknown): string | undefined =>
  (err as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode

export const isLocationError = (code?: string) => !!code && LOCATION_CODES.has(code)

const settingsSteps = () => {
  if (!isNativePlatform()) return 'Tarayıcının adres çubuğundaki kilit simgesine dokunun → Konum → İzin ver. Telefonunuzun konum servisinin de açık olduğundan emin olun.'
  return platformName() === 'ios'
    ? 'Ayarlar → Gizlilik ve Güvenlik → Konum Servisleri → açık; ardından listeden Bakırköy Belediyesi → "Uygulamayı Kullanırken".'
    : 'Ayarlar → Konum → açık; ardından Ayarlar → Uygulamalar → Bakırköy Belediyesi → İzinler → Konum → "Yalnızca uygulama kullanılırken izin ver".'
}

interface Props {
  code?: string
  onReady?: () => void
}

export const LocationHelp = ({ code, onReady }: Props) => {
  const [state, setState] = useState<'idle' | 'checking' | 'denied'>('idle')
  if (!isLocationError(code)) return null

  const check = async () => {
    setState('checking')
    const res = await getCurrentPosition()
    if (res.ok) { setState('idle'); onReady?.() }
    else setState('denied')
  }

  if (code === 'OUTSIDE_GEOFENCE') {
    return (
      <p className="type-caption text-center text-foreground-muted">
        Konumunuz kıraathane alanının dışında görünüyor. Binaya girdikten sonra tekrar deneyin.
      </p>
    )
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-xl bg-surface-1 p-3">
      <Button variant="primary" size="lg" className="w-full gap-1" isLoading={state === 'checking'} onClick={() => void check()}>
        <MapPinIcon className="h-4 w-4" /> Konumu Aç
      </Button>
      {state === 'denied' && (
        <p className="type-caption text-foreground-muted">Konum izni kapalı. {settingsSteps()}</p>
      )}
    </div>
  )
}

export default LocationHelp
