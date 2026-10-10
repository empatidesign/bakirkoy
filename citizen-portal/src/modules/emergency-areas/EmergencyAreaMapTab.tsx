import { useEffect, useRef, useState } from 'react'
import { svgMarkup } from '@/components/Icon2D'
import type { CitizenEmergencyArea } from '@/types/emergency-area.types'
import { EmergencyAreaDetailModal } from './EmergencyAreaDetailModal'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { dotPinIcon } from '@/lib/mapPins'
import { useUserLocation } from '@/lib/geolocation'
import { distanceLabel } from '@/lib/distance'
import { escapeHtml as esc } from '@/lib/escapeHtml'
import { SkeletonRows, Button } from '@/design-system'
import { resolveEmergencyMapView } from './emergencyMapView'

type Props = {
  areas: CitizenEmergencyArea[]
  loading?: boolean
  error?: boolean
  onRetry?: () => void
}

const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

const BAKIRKOY_CENTER: google.maps.LatLngLiteral = { lat: 40.9833, lng: 28.8667 }
const SULTANGAZI_G = BAKIRKOY_CENTER

function popupHtml(a: CitizenEmergencyArea, userPosition: { latitude: number; longitude: number } | null): string {
  const dist = a.latitude != null && a.longitude != null
    ? distanceLabel(userPosition, { latitude: a.latitude, longitude: a.longitude })
    : null
  return `<div class="space-y-1.5">`
    + `<strong class="type-body-strong">${esc(a.name)}</strong>`
    + (a.address ? `<div class="type-caption">${esc(a.address)}</div>` : '')
    + `<div class="type-caption">${a.capacity.toLocaleString('tr-TR')} kişi · ${a.areaSizeM2} m²</div>`
    + (dist ? `<div class="type-caption">${svgMarkup('pin')} ${esc(dist)} uzaklıkta</div>` : '')
    + `<div class="flex items-center gap-3 pt-1">`
    + `<a href="${directionsUrl(a.latitude!, a.longitude!)}" target="_blank" rel="noopener noreferrer" class="type-link-sm">${svgMarkup('compass')} Yol Tarifi</a>`
    + `<button type="button" data-id="${esc(a.id)}" class="type-link-sm">Detaylar</button>`
    + `</div></div>`
}

export const EmergencyAreaMapTab = ({ areas, loading = false, error = false, onRetry }: Props) => {
  const { status: gmapsStatus } = useGoogleMaps()
  const { position: userPosition, requestSilently } = useUserLocation()

  const containerRef = useRef<HTMLDivElement>(null)
  const gMapRef = useRef<google.maps.Map | null>(null)
  const gMarkersRef = useRef<google.maps.Marker[]>([])
  const gInfoRef = useRef<google.maps.InfoWindow | null>(null)
  const areaByIdRef = useRef<Map<string, CitizenEmergencyArea>>(new Map())
  const [selected, setSelected] = useState<CitizenEmergencyArea | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca mount'ta bir kere, izin diyaloğu tetiklemeden mevcut izni sessizce kontrol eder.
  useEffect(() => { requestSilently() }, [])

  useEffect(() => {
    if (gmapsStatus !== 'ready' || !containerRef.current || gMapRef.current) return
    const map = new google.maps.Map(containerRef.current, {
      center: SULTANGAZI_G,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    gMapRef.current = map
  }, [gmapsStatus])

  useEffect(() => {
    if (gmapsStatus !== 'ready' || !gMapRef.current) return
    const map = gMapRef.current
    areaByIdRef.current = new Map(areas.map((a) => [a.id, a]))

    gMarkersRef.current.forEach((m) => m.setMap(null))
    gMarkersRef.current = []
    gInfoRef.current?.close()

    const bounds = new google.maps.LatLngBounds()
    areas
      .filter((a) => a.latitude != null && a.longitude != null)
      .forEach((a) => {
        const position = { lat: a.latitude!, lng: a.longitude! }
        const marker = new google.maps.Marker({
          position,
          map,
          title: a.name,
          icon: dotPinIcon({ colorVar: '--danger' }),
        })
        marker.addListener('click', () => {
          gInfoRef.current?.close()
          const el = document.createElement('div')
          el.innerHTML = popupHtml(a, userPosition)
          el.querySelector<HTMLButtonElement>('button[data-id]')?.addEventListener('click', () => {
            setSelected(areaByIdRef.current.get(a.id) ?? null)
            gInfoRef.current?.close()
          })
          const info = new google.maps.InfoWindow({ content: el, maxWidth: 260 })
          gInfoRef.current = info
          info.open({ map, anchor: marker })
        })
        gMarkersRef.current.push(marker)
        bounds.extend(position)
      })

    if (!bounds.isEmpty()) map.fitBounds(bounds, 40)
  }, [areas, gmapsStatus, userPosition])

  const view = resolveEmergencyMapView({ loading, dataError: error, gmapsStatus, areaCount: areas.length })

  return (
    <div className="relative h-[calc(100vh-12rem)] w-full">
      {view === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
          <SkeletonRows rows={3} />
        </div>
      )}
      {view === 'maps-disabled' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card px-6 text-center">
          <p className="text-[13px] font-medium text-foreground-muted">Harita şu anda kullanılamıyor.</p>
        </div>
      )}
      {view === 'maps-error' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card px-6 text-center">
          <p className="text-[13px] font-medium text-foreground-muted">Harita yüklenemedi. Lütfen internet bağlantınızı kontrol edip daha sonra tekrar deneyin.</p>
        </div>
      )}
      {view === 'data-error' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-card px-6 text-center">
          <p className="text-[13px] font-medium text-foreground-muted">Acil toplanma alanları yüklenemedi.</p>
          {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Tekrar Dene</Button>}
        </div>
      )}
      {view === 'empty' && (
        <div className="absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-full border border-border bg-card px-4 py-2 text-[12px] font-medium text-foreground-muted shadow-sm">
          Gösterilecek acil toplanma alanı yok
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
      <EmergencyAreaDetailModal area={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
