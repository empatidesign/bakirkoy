import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { dotPinIcon } from '@/lib/mapPins'
import { escapeHtml } from '@/lib/escapeHtml'
import { FIELD_PRESENCE_LABELS } from '@/types/surveyPlatform.types'
import type { SurveyFieldLiveAgent, SurveyFieldTrail } from '@/types/surveyPlatform.types'

// Kullanıcı isteği (2026-09-01): "canlı haritada saha görevlileri canlı takip edilecek, GPS
// açık olacak, ne kadar yürüdüğünü nereleri gezdiğini de takip edeceğiz."
// Pin = anketörün son konumu; seçili anketör için gün izi polyline + duraklama halkaları +
// anket doldurduğu noktalar birlikte çizilir.

interface Props {
  agents: SurveyFieldLiveAgent[]
  trail: SurveyFieldTrail | null
  selectedId: string | null
  onSelect: (interviewerId: string) => void
  height?: number
  className?: string
}

const BAKIRKOY_CENTER: google.maps.LatLngLiteral = { lat: 40.9833, lng: 28.8667 }
const SULTANGAZI = BAKIRKOY_CENTER

const PRESENCE_COLOR_VAR: Record<string, string> = {
  online: '--success',
  idle: '--warning',
  offline: '--foreground-muted',
}

const km = (meters: number) => `${(meters / 1000).toFixed(2)} km`

function agentPopupHtml(a: SurveyFieldLiveAgent): string {
  const seen = a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'
  return `
    <div class="w-[250px] space-y-2">
      <div class="space-y-0.5">
        <p class="text-[15px] font-semibold leading-snug text-foreground-strong">${escapeHtml(a.name)}</p>
        <p class="type-caption text-foreground-muted">${escapeHtml(a.activeSurveyTitle ?? 'Görev yok')} · ${escapeHtml(a.neighborhood)}</p>
      </div>
      <div class="grid grid-cols-2 gap-1.5 type-caption">
        <span>Durum: <b>${escapeHtml(FIELD_PRESENCE_LABELS[a.presenceStatus] ?? a.presenceStatus)}</b></span>
        <span>Son sinyal: <b>${escapeHtml(seen)}</b></span>
        <span>Bugün yürüyüş: <b>${escapeHtml(km(a.todayDistanceMeters))}</b></span>
        <span>Gezilen nokta: <b>${a.todayVisitedPointCount}</b></span>
        <span>Bugün anket: <b>${a.todayResponseCount}</b></span>
        <span>Hedef: <b>${a.totalResponseCount}${a.targetCount > 0 ? ` / ${a.targetCount}` : ''}</b></span>
      </div>
    </div>`
}

export const SurveyFieldLiveMap = ({ agents, trail, selectedId, onSelect, height, className }: Props) => {
  const { status } = useGoogleMaps()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const overlaysRef = useRef<(google.maps.Polyline | google.maps.Circle | google.maps.Marker)[]>([])
  const infoRef = useRef<google.maps.InfoWindow | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (status !== 'ready' || !containerRef.current || mapRef.current) return
    mapRef.current = new google.maps.Map(containerRef.current, {
      center: SULTANGAZI,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
  }, [status])

  // Anketör pin'leri
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return
    const map = mapRef.current

    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []
    infoRef.current?.close()

    const bounds = new google.maps.LatLngBounds()
    agents.forEach((a) => {
      if (a.latitude == null || a.longitude == null) return
      const position = { lat: a.latitude, lng: a.longitude }
      const marker = new google.maps.Marker({
        position,
        map,
        title: a.name,
        zIndex: a.interviewerId === selectedId ? 999 : 1,
        icon: dotPinIcon({
          colorVar: PRESENCE_COLOR_VAR[a.presenceStatus] ?? '--foreground-muted',
          ring: a.interviewerId === selectedId,
          ringColorVar: '--primary',
        }),
      })
      marker.addListener('click', () => {
        infoRef.current?.close()
        const el = document.createElement('div')
        el.innerHTML = agentPopupHtml(a)
        const info = new google.maps.InfoWindow({ content: el, maxWidth: 280 })
        infoRef.current = info
        info.open({ map, anchor: marker })
        onSelectRef.current(a.interviewerId)
      })
      markersRef.current.push(marker)
      bounds.extend(position)
    })

    if (!bounds.isEmpty() && !trail) map.fitBounds(bounds, 60)
  }, [agents, selectedId, status, trail])

  // Seçili anketörün gün izi: rota + duraklamalar + anket noktaları
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return
    const map = mapRef.current

    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []
    if (!trail) return

    const path = trail.points.map((p) => ({ lat: p.latitude, lng: p.longitude }))
    if (path.length > 1) {
      const line = new google.maps.Polyline({
        path,
        map,
        strokeColor: '#4338ca',
        strokeOpacity: 0.85,
        strokeWeight: 4,
      })
      overlaysRef.current.push(line)
    }

    trail.stops.forEach((s) => {
      // Duraklama halkası: yarıçap süreyle büyür (10 dk = 30 m, tavan 120 m).
      const circle = new google.maps.Circle({
        map,
        center: { lat: s.latitude, lng: s.longitude },
        radius: Math.min(120, 20 + s.minutesSpent),
        strokeColor: '#f59e0b',
        strokeOpacity: 0.9,
        strokeWeight: 2,
        fillColor: '#f59e0b',
        fillOpacity: 0.18,
      })
      overlaysRef.current.push(circle)
    })

    trail.responsePoints.forEach((r) => {
      const marker = new google.maps.Marker({
        map,
        position: { lat: r.latitude, lng: r.longitude },
        icon: dotPinIcon({ colorVar: r.isFlagged ? '--danger' : '--info' }),
        title: `Anket · ${new Date(r.submittedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`,
        zIndex: 500,
      })
      overlaysRef.current.push(marker)
    })

    const bounds = new google.maps.LatLngBounds()
    path.forEach((p) => bounds.extend(p))
    trail.responsePoints.forEach((r) => bounds.extend({ lat: r.latitude, lng: r.longitude }))
    if (!bounds.isEmpty()) map.fitBounds(bounds, 60)
  }, [trail, status])

  if (status === 'disabled') {
    return (
      <div
        className={cn(height ? 'w-full' : 'h-full w-full', 'flex items-center justify-center', className)}
        style={height ? { height } : undefined}
      >
        <p className="type-caption text-foreground-muted">
          Harita şu anda kullanılamıyor. Ayarlar → Entegrasyonlar bölümünden Google Haritalar anahtarını tanımlayın.
        </p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={cn(height ? 'w-full' : 'h-full w-full', 'min-w-0 max-w-full overflow-hidden', className)}
      style={height ? { height } : undefined}
    />
  )
}
