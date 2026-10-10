import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { dotPinIcon } from '@/lib/mapPins'
import type { FacilityMapPoint } from '@/types/serviceFacility.types'
import { LOCATION_TYPE_LABELS } from '@/types/serviceFacility.types'
import { escapeHtml } from '@/lib/escapeHtml'

interface FacilityMapProps {
  points: FacilityMapPoint[]
  onOpenDetail: (id: string) => void
  height?: number
  className?: string
}

const BAKIRKOY_CENTER: google.maps.LatLngLiteral = { lat: 40.9833, lng: 28.8667 }
const SULTANGAZI_G = BAKIRKOY_CENTER

const pinSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>`
const arrowSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`

function popupHtml(p: FacilityMapPoint): string {
  const locTone = p.locationType === 'Outdoor' ? 'bg-success-soft text-success' : 'bg-info-soft text-info'
  const location = escapeHtml([p.district, p.city].filter(Boolean).join(' · ') || '—')
  return `
    <div class="ds-facility-popup w-[252px] space-y-2.5">
      <div class="space-y-1 pr-5">
        <p class="text-[15px] font-semibold leading-snug text-foreground-strong">${escapeHtml(p.name)}</p>
        <p class="flex items-center gap-1 type-caption text-foreground-muted"><span class="text-foreground-subtle">${pinSvg}</span>${location}</p>
      </div>
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="inline-flex items-center rounded-pill ${locTone} px-2 py-0.5 text-[11px] font-medium">${escapeHtml(LOCATION_TYPE_LABELS[p.locationType])}</span>
        ${p.type ? `<span class="inline-flex items-center rounded-pill bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-foreground-muted">${escapeHtml(p.type)}</span>` : ''}
        <span class="inline-flex items-center rounded-pill bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">${p.serviceCount} hizmet</span>
      </div>
      <button type="button" data-id="${escapeHtml(p.id)}" class="group flex w-full items-center justify-center gap-1.5 rounded-field bg-primary px-3 py-2 text-xs font-semibold text-[hsl(var(--primary-foreground))] shadow-sm transition-opacity hover:opacity-90">
        <span>Detayları Gör</span>${arrowSvg}
      </button>
    </div>`
}

export const FacilityMap = ({ points, onOpenDetail, height, className }: FacilityMapProps) => {
  const { status: gmapsStatus } = useGoogleMaps()

  const containerRef = useRef<HTMLDivElement>(null)
  const gMapRef = useRef<google.maps.Map | null>(null)
  const gMarkersRef = useRef<google.maps.Marker[]>([])
  const gInfoRef = useRef<google.maps.InfoWindow | null>(null)
  const onOpenRef = useRef(onOpenDetail)
  onOpenRef.current = onOpenDetail

  useEffect(() => {
    if (gmapsStatus !== 'ready' || !containerRef.current || gMapRef.current) return
    const map = new google.maps.Map(containerRef.current, {
      center: SULTANGAZI_G,
      zoom: 12,
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
    points.forEach((p) => {
      if (typeof p.latitude !== 'number' || typeof p.longitude !== 'number') return
      const active = p.status === 'Active'
      const position = { lat: p.latitude, lng: p.longitude }
      const marker = new google.maps.Marker({
        position,
        map,
        title: p.name,
        icon: dotPinIcon({ colorVar: active ? '--primary' : '--foreground-muted' }),
      })
      marker.addListener('click', () => {
        gInfoRef.current?.close()
        const el = document.createElement('div')
        el.innerHTML = popupHtml(p)
        el.querySelector<HTMLButtonElement>('button[data-id]')?.addEventListener('click', () => {
          onOpenRef.current(p.id)
          gInfoRef.current?.close()
        })
        const info = new google.maps.InfoWindow({ content: el, maxWidth: 280 })
        gInfoRef.current = info
        info.open({ map, anchor: marker })
      })
      gMarkersRef.current.push(marker)
      bounds.extend(position)
    })

    if (!bounds.isEmpty()) map.fitBounds(bounds, 50)
  }, [points, gmapsStatus])

  if (gmapsStatus === 'disabled') {
    return (
      <div
        className={cn(height ? 'w-full' : 'h-full w-full', 'flex items-center justify-center', className)}
        style={height ? { height } : undefined}
      >
        <p className="type-caption text-foreground-muted">Harita şu anda kullanılamıyor.</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(height ? 'w-full' : 'h-full w-full', className)}
      style={height ? { height } : undefined}
    />
  )
}
