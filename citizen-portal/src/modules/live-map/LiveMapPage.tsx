import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon2D, svgMarkup, type Icon2DKind } from '@/components/Icon2D'
import { useNavigate } from 'react-router-dom'
import { MapPinIcon, LocateFixedIcon, Loader2Icon } from 'lucide-react'
import { ModuleHeader, SkeletonRows } from '@/design-system'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { useUserLocation } from '@/lib/geolocation'
import { distanceLabel, directionsUrl } from '@/lib/distance'
import liveMapService, { type LiveMapPoint, type LiveMapPointType } from '@/services/liveMap.service'
import { escapeHtml as esc } from '@/lib/escapeHtml'

const BAKIRKOY_CENTER: google.maps.LatLngLiteral = { lat: 40.9833, lng: 28.8667 }
const SULTANGAZI_G = BAKIRKOY_CENTER

const TYPE_META: Record<LiveMapPointType, { label: string; color: string; icon: Icon2DKind }> = {
  EmergencyArea: { label: 'Acil Toplanma', color: '#dc2626', icon: 'sos' },
  Facility: { label: 'Tesisler', color: '#059669', icon: 'landmark' },
  Event: { label: 'Etkinlikler', color: '#7c3aed', icon: 'party' },
  Library: { label: 'Kütüphaneler', color: '#2563eb', icon: 'book' },
}

function hexDotIcon(hex: string, size = 26): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<circle cx="${size / 2}" cy="${size / 2}" r="8" fill="${hex}" stroke="#ffffff" stroke-width="2"/>`
    + `</svg>`
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(size, size),
    anchor: new google.maps.Point(size / 2, size / 2),
  }
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function popupHtml(p: LiveMapPoint, userPosition: { latitude: number; longitude: number } | null): string {
  const meta = TYPE_META[p.type]
  const dist = distanceLabel(userPosition, { latitude: p.latitude, longitude: p.longitude })
  const when = formatWhen(p.when)
  return `<div class="space-y-1.5">`
    + `<span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:${meta.color}18;color:${meta.color}">${svgMarkup(meta.icon, 11, meta.color)} ${esc(meta.label)}</span>`
    + `<div style="font-weight:700;font-size:13px;margin-top:4px">${esc(p.title)}</div>`
    + (p.subtitle ? `<div style="font-size:11px;color:#6b7280">${esc(p.subtitle)}</div>` : '')
    + (when ? `<div style="font-size:11px;color:#6b7280">${svgMarkup('clock', 11, '#6b7280')} ${esc(when)}</div>` : '')
    + (dist ? `<div style="font-size:11px;color:#374151">${svgMarkup('pin', 11, '#374151')} ${esc(dist)} uzaklıkta</div>` : '')
    + (p.hasParking ? `<div style="font-size:11px;color:#2563eb;font-weight:600">${svgMarkup('parking', 11, '#2563eb')} Otopark${p.parkingCapacity ? ` · ${p.parkingCapacity} araçlık` : ''}</div>` : '')
    + `<div style="display:flex;align-items:center;gap:12px;padding-top:4px">`
    + `<a href="${directionsUrl({ latitude: p.latitude, longitude: p.longitude })}" target="_blank" rel="noopener noreferrer" style="font-size:11px;font-weight:600;color:${meta.color}">${svgMarkup('compass', 11, meta.color)} Yol Tarifi</a>`
    + (p.detailRoute ? `<button type="button" data-goto="${esc(p.detailRoute)}" style="font-size:11px;font-weight:600;color:#4338CA;background:none;border:none;padding:0;cursor:pointer">Detaya Git</button>` : '')
    + `</div></div>`
}

export const LiveMapPage = () => {
  const navigate = useNavigate()
  const { status: gmapsStatus } = useGoogleMaps()
  const { status: locStatus, position: userPosition, request: requestLocation, requestSilently } = useUserLocation()

  const [points, setPoints] = useState<LiveMapPoint[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTypes, setActiveTypes] = useState<Set<LiveMapPointType>>(
    new Set(['EmergencyArea', 'Facility', 'Event', 'Library']),
  )

  const containerRef = useRef<HTMLDivElement>(null)
  const gMapRef = useRef<google.maps.Map | null>(null)
  const gMarkersRef = useRef<google.maps.Marker[]>([])
  const gUserMarkerRef = useRef<google.maps.Marker | null>(null)
  const gInfoRef = useRef<google.maps.InfoWindow | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps -- yalnızca mount'ta bir kere, izin diyaloğu tetiklemeden mevcut izni sessizce kontrol eder.
  useEffect(() => { requestSilently() }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    liveMapService.get()
      .then((r) => { if (active) setPoints(r.points) })
      .catch(() => { if (active) setPoints([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const visiblePoints = useMemo(
    () => (points ?? []).filter((p) => activeTypes.has(p.type)),
    [points, activeTypes],
  )

  const counts = useMemo(() => {
    const c: Record<LiveMapPointType, number> = { EmergencyArea: 0, Facility: 0, Event: 0, Library: 0 }
    for (const p of points ?? []) c[p.type]++
    return c
  }, [points])

  const toggleType = (t: LiveMapPointType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const gotoDetail = (route: string) => navigate(route)

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
    visiblePoints.forEach((p) => {
      const meta = TYPE_META[p.type]
      const position = { lat: p.latitude, lng: p.longitude }
      const marker = new google.maps.Marker({
        position,
        map,
        title: p.title,
        icon: hexDotIcon(meta.color),
      })
      marker.addListener('click', () => {
        gInfoRef.current?.close()
        const el = document.createElement('div')
        el.innerHTML = popupHtml(p, userPosition)
        el.querySelector<HTMLButtonElement>('button[data-goto]')?.addEventListener('click', () => {
          const route = p.detailRoute
          gInfoRef.current?.close()
          if (route) gotoDetail(route)
        })
        const info = new google.maps.InfoWindow({ content: el, maxWidth: 260 })
        gInfoRef.current = info
        info.open({ map, anchor: marker })
      })
      gMarkersRef.current.push(marker)
      bounds.extend(position)
    })

    if (userPosition) {
      gUserMarkerRef.current?.setMap(null)
      gUserMarkerRef.current = new google.maps.Marker({
        position: { lat: userPosition.latitude, lng: userPosition.longitude },
        map,
        title: 'Konumunuz',
        icon: hexDotIcon('#2563eb', 22),
        zIndex: 999,
      })
    }

    if (!bounds.isEmpty()) map.fitBounds(bounds, 40)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visiblePoints, gmapsStatus, userPosition])

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={MapPinIcon}
        title="Canlı Harita"
        subtitle="Acil toplanma alanları, tesisler, etkinlikler ve kütüphaneler tek haritada"
        gradient="linear-gradient(135deg, #0f172a, #1e293b)"
      />

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-card">
        {(Object.keys(TYPE_META) as LiveMapPointType[]).map((t) => {
          const meta = TYPE_META[t]
          const active = activeTypes.has(t)
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all"
              style={active
                ? { background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}50` }
                : { background: 'transparent', color: '#9ca3af', border: '1px solid #e5e7eb' }}
            >
              <Icon2D kind={meta.icon} className="h-3.5 w-3.5" style={active ? { color: meta.color } : undefined} />
              {meta.label}
              <span className="text-[10px] opacity-70">{counts[t]}</span>
            </button>
          )
        })}

        <div className="ml-auto">
          {locStatus === 'ready' ? (
            <span className="flex items-center gap-1 text-[12px] font-medium text-primary">
              <LocateFixedIcon className="h-3.5 w-3.5" /> Konumunuz gösteriliyor
            </span>
          ) : locStatus === 'loading' ? (
            <span className="flex items-center gap-1 text-[12px] font-medium text-foreground-muted">
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" /> Konum alınıyor…
            </span>
          ) : (
            <button
              type="button"
              onClick={() => requestLocation()}
              className="flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline"
            >
              <LocateFixedIcon className="h-3.5 w-3.5" /> Konumumu göster
            </button>
          )}
        </div>
      </div>

      <div className="relative flex-1">
        {(loading || gmapsStatus === 'loading' || gmapsStatus === 'idle') && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/80">
            <SkeletonRows rows={3} />
          </div>
        )}
        {gmapsStatus === 'disabled' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card">
            <p className="text-[13px] font-medium text-foreground-muted">Harita şu anda kullanılamıyor.</p>
          </div>
        )}
        {gmapsStatus === 'error' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card px-6 text-center">
            <p className="text-[13px] font-medium text-foreground-muted">Harita yüklenemedi. Lütfen internet bağlantınızı kontrol edip daha sonra tekrar deneyin.</p>
          </div>
        )}
        {!loading && gmapsStatus === 'ready' && visiblePoints.length === 0 && (
          <div className="absolute inset-x-0 top-4 z-10 mx-auto w-fit rounded-full bg-card px-4 py-2 text-[12px] font-medium text-foreground-muted shadow-sm border border-border">
            Seçili filtrelerde gösterilecek nokta yok
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </div>
  )
}
