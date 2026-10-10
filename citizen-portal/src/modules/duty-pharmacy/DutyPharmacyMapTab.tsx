import { useEffect, useRef } from 'react'
import { svgMarkup } from '@/components/Icon2D'
import type { CitizenDutyPharmacy } from '@/types/duty-pharmacy.types'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { dotPinIcon } from '@/lib/mapPins'
import { useUserLocation } from '@/lib/geolocation'
import { distanceLabel } from '@/lib/distance'
import { formatPhone } from '@/lib/utils'
import { escapeHtml as esc } from '@/lib/escapeHtml'

type Props = {
  pharmacies: CitizenDutyPharmacy[]
}

const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

const callHref = (phone: string) => `tel:0${phone}`

const BAKIRKOY_CENTER: google.maps.LatLngLiteral = { lat: 40.9833, lng: 28.8667 }
const SULTANGAZI_G = BAKIRKOY_CENTER

function popupHtml(p: CitizenDutyPharmacy, userPosition: { latitude: number; longitude: number } | null): string {
  const dist = p.latitude != null && p.longitude != null
    ? distanceLabel(userPosition, { latitude: p.latitude, longitude: p.longitude })
    : null
  return `<div class="space-y-1.5">`
    + `<strong class="type-body-strong">${esc(p.name)}</strong>`
    + (p.address ? `<div class="type-caption">${esc(p.address)}</div>` : '')
    + (dist ? `<div class="type-caption">${svgMarkup('pin')} ${esc(dist)} uzaklıkta</div>` : '')
    + `<div class="flex items-center gap-3 pt-1">`
    + (p.phone ? `<a href="${callHref(p.phone)}" class="type-link-sm">${svgMarkup('phone')} ${esc(formatPhone(p.phone))}</a>` : '')
    + (p.latitude != null && p.longitude != null
      ? `<a href="${directionsUrl(p.latitude, p.longitude)}" target="_blank" rel="noopener noreferrer" class="type-link-sm">${svgMarkup('compass')} Yol Tarifi</a>`
      : '')
    + `</div></div>`
}

export const DutyPharmacyMapTab = ({ pharmacies }: Props) => {
  const { status: gmapsStatus } = useGoogleMaps()
  const { position: userPosition, requestSilently } = useUserLocation()

  const containerRef = useRef<HTMLDivElement>(null)
  const gMapRef = useRef<google.maps.Map | null>(null)
  const gMarkersRef = useRef<google.maps.Marker[]>([])
  const gInfoRef = useRef<google.maps.InfoWindow | null>(null)

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

    gMarkersRef.current.forEach((m) => m.setMap(null))
    gMarkersRef.current = []
    gInfoRef.current?.close()

    const bounds = new google.maps.LatLngBounds()
    pharmacies
      .filter((p) => p.latitude != null && p.longitude != null)
      .forEach((p) => {
        const position = { lat: p.latitude!, lng: p.longitude! }
        const marker = new google.maps.Marker({
          position,
          map,
          title: p.name,
          icon: dotPinIcon({ colorVar: '--success' }),
        })
        marker.addListener('click', () => {
          gInfoRef.current?.close()
          const info = new google.maps.InfoWindow({ content: popupHtml(p, userPosition), maxWidth: 260 })
          gInfoRef.current = info
          info.open({ map, anchor: marker })
        })
        gMarkersRef.current.push(marker)
        bounds.extend(position)
      })

    if (!bounds.isEmpty()) map.fitBounds(bounds, 40)
  }, [pharmacies, gmapsStatus, userPosition])

  if (gmapsStatus === 'disabled') {
    return (
      <div className="flex h-[calc(100vh-12rem)] w-full items-center justify-center">
        <p className="text-[13px] font-medium text-foreground-muted">Harita şu anda kullanılamıyor.</p>
      </div>
    )
  }

  return <div ref={containerRef} className="h-[calc(100vh-12rem)] w-full" />
}
