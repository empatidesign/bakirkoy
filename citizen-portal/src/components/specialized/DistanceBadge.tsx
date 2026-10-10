import { NavigationIcon, MapPinIcon, LocateFixedIcon, Loader2Icon } from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useUserLocation } from '@/lib/geolocation'
import { distanceLabel, directionsUrl, type LatLng } from '@/lib/distance'

interface DistanceBadgeProps {
  target: LatLng | null | undefined
  className?: string
  distanceOnly?: boolean
  stopPropagation?: boolean
  placeId?: string | null
}

export const DistanceBadge = ({ target, className, distanceOnly, stopPropagation = true, placeId }: DistanceBadgeProps) => {
  const { status, position, requestSilently, request } = useUserLocation()

  // eslint-disable-next-line react-hooks/exhaustive-deps -- requestSilently kasıtlı olarak yalnızca mount'ta bir kere çağrılır; hook her render'da yeni bir fonksiyon referansı döndürür (idempotent, gereksiz tekrar çağrıyı önlemek için boş bağımlılık dizisi kullanılıyor).
  useEffect(() => { requestSilently() }, [])

  if (target == null || typeof target.latitude !== 'number' || typeof target.longitude !== 'number') return null

  const label = distanceLabel(position, target)

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {label ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted">
          <MapPinIcon className="h-3 w-3" /> {label}
        </span>
      ) : status === 'idle' ? (
        <button
          type="button"
          onClick={(e) => { if (stopPropagation) e.stopPropagation(); request() }}
          className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted hover:text-primary transition-colors"
        >
          <LocateFixedIcon className="h-3 w-3" /> Mesafeyi gör
        </button>
      ) : status === 'loading' ? (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground-muted">
          <Loader2Icon className="h-3 w-3 animate-spin" /> Konum alınıyor…
        </span>
      ) : status === 'denied' ? (
        <button
          type="button"
          onClick={(e) => { if (stopPropagation) e.stopPropagation(); request() }}
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
          title="Tarayıcı ayarlarından konum izni vererek tekrar deneyebilirsiniz"
        >
          <MapPinIcon className="h-3 w-3" /> Konum izni reddedildi
        </button>
      ) : status === 'unavailable' ? (
        <button
          type="button"
          onClick={(e) => { if (stopPropagation) e.stopPropagation(); request() }}
          className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
        >
          <MapPinIcon className="h-3 w-3" /> Konum alınamadı, tekrar dene
        </button>
      ) : null}
      {!distanceOnly && (
        <a
          href={directionsUrl(target, placeId)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => { if (stopPropagation) e.stopPropagation() }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <NavigationIcon className="h-3 w-3" /> Yol Tarifi
        </a>
      )}
    </span>
  )
}
