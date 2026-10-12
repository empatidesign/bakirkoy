import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { LocateFixedIcon, MapPinIcon, SearchIcon } from 'lucide-react'
import { Button, Input } from '@/design-system'
import { cn } from '@/lib/utils'
import { useGoogleMaps } from '@/hooks/useGoogleMaps'
import { getCurrentPosition } from '@/lib/geolocation'

export interface MapCoords {
  latitude?: number
  longitude?: number
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface MapPickerProps {
  value?: MapCoords
  onChange?: (coords: MapCoords) => void
  readOnly?: boolean
  height?: number
  className?: string
  onAddressPick?: (address: string) => void
  radiusMeters?: number
}

const parseCoord = (raw: string): number | undefined => {
  const t = raw.trim().replace(',', '.')
  if (t === '') return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}

const DEFAULT_CENTER = { lat: 40.9833, lng: 28.8667 }

const normalizeQuery = (raw: string): string =>
  raw
    .replace(/\b(mahallesi|mah\.?|mh\.?)(?=\s|,|$)/gi, 'Mahallesi')
    .replace(/(\d+)\s*\.?\s*(sokağı|sokak|sok\.?|sk\.?)(?=\s|,|$)/gi, '$1. Sokak')
    .replace(/\b(sokağı|sokak|sok\.?|sk\.?)(?=\s|,|$)/gi, 'Sokak')
    .replace(/(\d+)\s*\.?\s*(caddesi|cad\.?|cd\.?)(?=\s|,|$)/gi, '$1. Caddesi')
    .replace(/\b(caddesi|cad\.?|cd\.?)(?=\s|,|$)/gi, 'Caddesi')
    .replace(/\b(bulvarı|bulv\.?|blv\.?)(?=\s|,|$)/gi, 'Bulvarı')
    .replace(/\s+/g, ' ')
    .trim()

const searchNominatim = async (q: string): Promise<NominatimResult[]> => {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=tr&countrycodes=tr&q=${encodeURIComponent(q)}`,
  )
  return res.ok ? ((await res.json()) as NominatimResult[]) : []
}

const searchGoogle = async (q: string): Promise<NominatimResult[]> => {
  const { results } = await new google.maps.Geocoder().geocode({ address: q, componentRestrictions: { country: 'TR' } })
  return results.slice(0, 5).map((r, i) => ({
    place_id: i,
    display_name: r.formatted_address,
    lat: String(r.geometry.location.lat()),
    lon: String(r.geometry.location.lng()),
  }))
}

const reverseGoogle = async (lat: number, lng: number): Promise<string | undefined> => {
  try {
    const { results } = await new google.maps.Geocoder().geocode({ location: { lat, lng } })
    return results[0]?.formatted_address
  } catch {
    return undefined
  }
}

export const MapPicker = ({ value, onChange, readOnly, height = 260, className, onAddressPick, radiusMeters }: MapPickerProps) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [noResult, setNoResult] = useState(false)
  const [locating, setLocating] = useState(false)
  const [latText, setLatText] = useState('')
  const [lngText, setLngText] = useState('')

  const { status: gmapsStatus } = useGoogleMaps()
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const circleRef = useRef<google.maps.Circle | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onAddressPickRef = useRef(onAddressPick)
  onAddressPickRef.current = onAddressPick

  const lat = value?.latitude
  const lng = value?.longitude
  const hasCoords = typeof lat === 'number' && typeof lng === 'number'
  const useGoogle = gmapsStatus === 'ready'

  useEffect(() => {
    setLatText((t) => (parseCoord(t) === lat ? t : lat?.toString() ?? ''))
  }, [lat])
  useEffect(() => {
    setLngText((t) => (parseCoord(t) === lng ? t : lng?.toString() ?? ''))
  }, [lng])

  useEffect(() => {
    if (!useGoogle || !mapDivRef.current || mapRef.current) return
    const center = hasCoords ? { lat: lat!, lng: lng! } : DEFAULT_CENTER
    const map = new google.maps.Map(mapDivRef.current, {
      center,
      zoom: hasCoords ? 16 : 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    mapRef.current = map

    const marker = new google.maps.Marker({
      position: center,
      map,
      draggable: !readOnly,
    })
    markerRef.current = marker

    if (!readOnly) {
      const commit = (p: google.maps.LatLng) => {
        const next = { latitude: Number(p.lat().toFixed(6)), longitude: Number(p.lng().toFixed(6)) }
        marker.setPosition({ lat: next.latitude, lng: next.longitude })
        onChangeRef.current?.(next)
        if (onAddressPickRef.current) {
          void reverseGoogle(next.latitude, next.longitude).then((addr) => { if (addr) onAddressPickRef.current?.(addr) })
        }
      }
      map.addListener('click', (e) => { if (e.latLng) commit(e.latLng) })
      marker.addListener('dragend', () => {
        const p = marker.getPosition()
        if (p) commit(p)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGoogle, readOnly])

  useEffect(() => {
    if (!useGoogle || !mapRef.current || !markerRef.current) return
    if (!hasCoords) return
    const pos = { lat: lat!, lng: lng! }
    markerRef.current.setPosition(pos)
    mapRef.current.setCenter(pos)
    mapRef.current.setZoom(16)
  }, [useGoogle, lat, lng, hasCoords])

  useEffect(() => {
    if (!useGoogle || !mapRef.current) return
    if (!hasCoords || !radiusMeters) {
      circleRef.current?.setMap(null)
      circleRef.current = null
      return
    }
    circleRef.current ??= new google.maps.Circle({
      map: mapRef.current,
      clickable: false,
      strokeColor: '#2563eb',
      strokeOpacity: 0.8,
      strokeWeight: 2,
      fillColor: '#2563eb',
      fillOpacity: 0.12,
    })
    circleRef.current.setCenter({ lat: lat!, lng: lng! })
    circleRef.current.setRadius(radiusMeters)
  }, [useGoogle, lat, lng, hasCoords, radiusMeters])

  const runSearch = async () => {
    const q = query.trim()
    if (!q) return
    onAddressPick?.(q)
    setSearching(true)
    setNoResult(false)
    try {
      const normalized = normalizeQuery(q)
      let found: NominatimResult[] = []
      if (useGoogle) found = await searchGoogle(normalized).catch(() => [])
      if (found.length === 0) found = await searchNominatim(normalized)
      if (found.length === 0 && !/bakirkoy|bakırköy/i.test(normalized)) found = await searchNominatim(`${normalized}, Bakırköy, İstanbul`)
      setResults(found)
      setNoResult(found.length === 0)
    } catch {
      setResults([])
      setNoResult(true)
    } finally {
      setSearching(false)
    }
  }

  const pick = (r: NominatimResult) => {
    onChange?.({ latitude: Number(r.lat), longitude: Number(r.lon) })
    onAddressPick?.(r.display_name)
    setResults([])
    setQuery(r.display_name)
  }

  const useMyLocation = async () => {
    setLocating(true)
    try {
      const res = await getCurrentPosition()
      if (res.ok) {
        onChange?.({ latitude: Number(res.position.latitude.toFixed(6)), longitude: Number(res.position.longitude.toFixed(6)) })
        toast.success(`Mevcut konum alındı (±${Math.round(res.position.accuracy)} m).`)
        return
      }
      toast.error({
        denied: 'Konum izni reddedildi. Tarayıcı ayarlarından bu site için konum iznini açın.',
        unsupported: 'Bu tarayıcı konum almayı desteklemiyor.',
        timeout: 'Konum alınamadı, zaman aşımı. Tekrar deneyin.',
        unavailable: 'Konum şu anda belirlenemiyor. Tekrar deneyin.',
      }[res.reason])
    } finally {
      setLocating(false)
    }
  }

  const setCoord = (key: 'latitude' | 'longitude', raw: string) => {
    if (key === 'latitude') setLatText(raw)
    else setLngText(raw)
    const parsed = parseCoord(raw)
    const limit = key === 'latitude' ? 90 : 180
    onChange?.({ latitude: lat, longitude: lng, [key]: parsed !== undefined && Math.abs(parsed) <= limit ? parsed : undefined })
  }

  const delta = 0.008
  const center = hasCoords ? { lat: lat!, lng: lng! } : DEFAULT_CENTER
  const span = hasCoords ? delta : delta * 4
  const embedSrc = !useGoogle && (hasCoords || !readOnly)
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${center.lng - span}%2C${center.lat - span}%2C${center.lng + span}%2C${center.lat + span}&layer=mapnik${hasCoords ? `&marker=${lat}%2C${lng}` : ''}`
    : null

  return (
    <div className={cn('space-y-3', className)}>
      {!readOnly && (
        <div className="relative">
          <div className="flex gap-2">
            <Input
              placeholder="Adres veya yer ara (ör. Bakırköy Belediyesi)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch() } }}
              iconLeft={<SearchIcon className="h-4 w-4" />}
            />
            <Button type="button" variant="outline" onClick={runSearch} isLoading={searching}>Ara</Button>
            <Button type="button" variant="outline" onClick={useMyLocation} isLoading={locating} title="Bulunduğum konumu kullan">
              <LocateFixedIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Konumum</span>
            </Button>
          </div>
          {noResult && <p className="type-caption mt-1 text-warning">Sonuç bulunamadı. Mahalle ve sokak adını açık yazmayı deneyin (ör. Kartaltepe Mahallesi Yavuklular Sokak) ya da koordinatları elle girin.</p>}
          {results.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-card border border-border bg-surface-0 shadow-pop">
              {results.map((r) => (
                <button
                  key={r.place_id}
                  type="button"
                  onClick={() => pick(r)}
                  className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-1"
                >
                  <MapPinIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="type-caption text-foreground-default">{r.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-border bg-surface-1" style={{ height }}>
        {useGoogle ? (
          <div ref={mapDivRef} className="h-full w-full" />
        ) : embedSrc ? (
          <iframe title="Konum haritası" src={embedSrc} className="h-full w-full border-0" loading="lazy" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MapPinIcon className="h-8 w-8 text-foreground-subtle" />
            <p className="type-caption">{readOnly ? 'Konum belirtilmemiş.' : 'Adres arayın veya koordinatları girin.'}</p>
          </div>
        )}
      </div>
      {!readOnly && gmapsStatus === 'disabled' && (
        <p className="type-caption">Google Haritalar için Entegrasyon Ayarları'ndan API anahtarı tanımlanmalı. Şimdilik adres arama, Konumum veya aşağıdaki koordinat alanlarını kullanın.</p>
      )}
      {!readOnly && gmapsStatus === 'error' && (
        <p className="type-caption text-warning">Google Haritalar anahtarı Google Cloud tarafında yetkilendirilmemiş (faturalandırma kapalı veya API kısıtlaması). Faturalandırmayı açın; Maps JavaScript, Geocoding ve Places API'lerini etkinleştirin; anahtarın HTTP yönlendiren listesine bu siteyi ekleyin. Bu sırada arama, Konumum ve koordinat alanları çalışır.</p>
      )}

      {!readOnly && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <span className="type-label">Enlem (lat)</span>
            <Input
              inputMode="decimal"
              placeholder="40.9800"
              value={latText}
              onChange={(e) => setCoord('latitude', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <span className="type-label">Boylam (lng)</span>
            <Input
              inputMode="decimal"
              placeholder="28.8700"
              value={lngText}
              onChange={(e) => setCoord('longitude', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
