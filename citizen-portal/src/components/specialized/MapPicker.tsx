import { useEffect, useRef, useState } from 'react'
import { MapPinIcon, SearchIcon, LocateFixedIcon, Layers2Icon, Rotate3dIcon, MinusIcon, PlusIcon, ChevronDownIcon } from 'lucide-react'
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
}

const DEFAULT_CENTER = { lat: 41.1075, lng: 28.8700 }

export const MapPicker = ({ value, onChange, readOnly, height = 320, className, onAddressPick }: MapPickerProps) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locateError, setLocateError] = useState<string | null>(null)
  const [tiltOn, setTiltOn] = useState(false)
  const [satellite, setSatellite] = useState(false)
  const [zoom, setZoom] = useState(hasCoordsInit(value) ? 16 : 13)

  const { status: gmapsStatus } = useGoogleMaps()
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markerRef = useRef<google.maps.Marker | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onAddressPickRef = useRef(onAddressPick)
  onAddressPickRef.current = onAddressPick

  const lat = value?.latitude
  const lng = value?.longitude
  const hasCoords = typeof lat === 'number' && typeof lng === 'number'
  const useGoogle = gmapsStatus === 'ready'

  useEffect(() => {
    if (!useGoogle || !mapDivRef.current || mapRef.current) return
    const center = hasCoords ? { lat: lat!, lng: lng! } : DEFAULT_CENTER
    const map = new google.maps.Map(mapDivRef.current, {
      center,
      zoom: hasCoords ? 16 : 13,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: false,
      rotateControl: false,
      gestureHandling: 'greedy',
    })
    mapRef.current = map

    const marker = new google.maps.Marker({
      position: center,
      map,
      draggable: !readOnly,
      animation: hasCoords ? undefined : google.maps.Animation.DROP,
    })
    markerRef.current = marker

    if (!readOnly) {
      map.addListener('click', (e) => {
        const p = e.latLng
        if (!p) return
        const next = { latitude: p.lat(), longitude: p.lng() }
        marker.setPosition({ lat: next.latitude, lng: next.longitude })
        onChangeRef.current?.(next)
      })
      marker.addListener('dragend', () => {
        const p = marker.getPosition()
        if (!p) return
        onChangeRef.current?.({ latitude: p.lat(), longitude: p.lng() })
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useGoogle, readOnly])

  useEffect(() => {
    if (!useGoogle || readOnly || !searchInputRef.current || autocompleteRef.current) return
    const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
      fields: ['geometry', 'formatted_address', 'name'],
      componentRestrictions: { country: 'tr' },
    })
    autocompleteRef.current = autocomplete
    if (mapRef.current) autocomplete.bindTo('bounds', mapRef.current)
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      const loc = place.geometry?.location
      if (!loc) return
      const next = { latitude: loc.lat(), longitude: loc.lng() }
      onChangeRef.current?.(next)
      const address = place.formatted_address ?? place.name
      if (address) onAddressPickRef.current?.(address)
      setQuery(address ?? '')
      markerRef.current?.setPosition({ lat: next.latitude, lng: next.longitude })
      mapRef.current?.setCenter({ lat: next.latitude, lng: next.longitude })
      mapRef.current?.setZoom(16)
      setZoom(16)
    })
  }, [useGoogle, readOnly])

  useEffect(() => {
    if (!useGoogle || !mapRef.current || !markerRef.current) return
    if (!hasCoords) return
    const pos = { lat: lat!, lng: lng! }
    markerRef.current.setPosition(pos)
    mapRef.current.setCenter(pos)
  }, [useGoogle, lat, lng, hasCoords])

  const zoomBy = (delta: number) => {
    const next = Math.max(3, Math.min(20, zoom + delta))
    setZoom(next)
    mapRef.current?.setZoom(next)
  }

  const toggleTilt = () => {
    const next = !tiltOn
    setTiltOn(next)
    mapRef.current?.setTilt(next ? 45 : 0)
  }

  const toggleSatellite = () => {
    const next = !satellite
    setSatellite(next)
    mapRef.current?.setMapTypeId(next ? 'satellite' : 'roadmap')
  }

  const runNominatimSearch = async () => {
    const q = query.trim()
    if (!q) return
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=tr&q=${encodeURIComponent(q)}`,
      )
      setResults(res.ok ? ((await res.json()) as NominatimResult[]) : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }

  const pickNominatim = (r: NominatimResult) => {
    onChange?.({ latitude: Number(r.lat), longitude: Number(r.lon) })
    onAddressPick?.(r.display_name)
    setResults([])
    setQuery(r.display_name)
  }

  const useMyLocation = async () => {
    setLocating(true)
    setLocateError(null)
    try {
      const res = await getCurrentPosition()
      if (!res.ok) {
        setLocateError(
          res.reason === 'denied' ? 'Konum izni verilmedi.'
            : res.reason === 'unsupported' ? 'Cihazınız konum servisini desteklemiyor.'
              : 'Konum alınamadı, lütfen tekrar deneyin.',
        )
        return
      }
      onChange?.({ latitude: res.position.latitude, longitude: res.position.longitude })
      setZoom(17)
    } finally {
      setLocating(false)
    }
  }

  const [showManual, setShowManual] = useState(false)
  const setCoord = (key: 'latitude' | 'longitude', raw: string) => {
    const parsed = raw.trim() === '' ? undefined : Number(raw)
    onChange?.({ latitude: lat, longitude: lng, [key]: parsed !== undefined && Number.isNaN(parsed) ? undefined : parsed })
  }

  const delta = 0.008
  const embedSrc = !useGoogle && hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng! - delta}%2C${lat! - delta}%2C${lng! + delta}%2C${lat! + delta}&layer=mapnik&marker=${lat}%2C${lng}`
    : null

  return (
    <div className={cn('space-y-2', className)}>
      {!readOnly && (
        <div className="space-y-1.5">
          <div className="relative">
            <div className="flex gap-2">
              <Input
                ref={searchInputRef}
                placeholder={useGoogle ? 'Google Haritalar\'da ara (adres, işletme, semt)...' : 'Adres veya yer ara...'}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !useGoogle) { e.preventDefault(); runNominatimSearch() } }}
                iconLeft={<SearchIcon className="h-4 w-4" />}
              />
              {!useGoogle && (
                <Button variant="outline" onClick={runNominatimSearch} isLoading={searching}>Ara</Button>
              )}
            </div>
            {!useGoogle && results.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-card border border-border bg-surface-0 shadow-pop">
                {results.map((r) => (
                  <button
                    key={r.place_id}
                    type="button"
                    onClick={() => pickNominatim(r)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-1"
                  >
                    <MapPinIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="type-caption text-foreground-default">{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Kullanıcı isteği (2026-08-28): "konum kullan butonu renkli olsun" — önceki
                ghost varyant şeffaf arka plana sahipti, sayfada fark edilmiyordu. */}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10"
              onClick={useMyLocation}
              isLoading={locating}
            >
              <LocateFixedIcon className="h-3.5 w-3.5" /> Konumumu kullan
            </Button>
            <span className="type-caption text-foreground-subtle">veya haritaya dokunarak işaretleyin</span>
          </div>
          {locateError && <p className="type-caption text-danger">{locateError}</p>}
        </div>
      )}

      <div className="relative overflow-hidden rounded-card border border-border bg-surface-1" style={{ height }}>
        {useGoogle ? (
          <div ref={mapDivRef} className="h-full w-full" />
        ) : embedSrc ? (
          <iframe title="Konum haritası" src={embedSrc} className="h-full w-full border-0" loading="lazy" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MapPinIcon className="h-8 w-8 text-foreground-subtle" />
            <p className="type-caption">{readOnly ? 'Konum belirtilmemiş.' : 'Adres arayın, konumumu kullanın veya haritaya dokunun.'}</p>
          </div>
        )}

        {useGoogle && (
          <div className="pointer-events-none absolute inset-0">
            <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-field border border-border bg-surface-0 shadow-pop">
              <button type="button" onClick={() => zoomBy(1)} className="flex h-9 w-9 items-center justify-center text-foreground-default transition-colors hover:bg-surface-1" title="Yakınlaştır">
                <PlusIcon className="h-4 w-4" />
              </button>
              <div className="h-px bg-border" />
              <button type="button" onClick={() => zoomBy(-1)} className="flex h-9 w-9 items-center justify-center text-foreground-default transition-colors hover:bg-surface-1" title="Uzaklaştır">
                <MinusIcon className="h-4 w-4" />
              </button>
            </div>
            {!readOnly && (
              <div className="pointer-events-auto absolute left-3 top-3 flex gap-1.5">
                <button
                  type="button"
                  onClick={toggleTilt}
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-field border px-2.5 text-[11px] font-semibold shadow-pop transition-colors',
                    tiltOn ? 'border-primary bg-primary text-white' : 'border-border bg-surface-0 text-foreground-default hover:bg-surface-1',
                  )}
                  title="3D eğim"
                >
                  <Rotate3dIcon className="h-3.5 w-3.5" /> 3D
                </button>
                <button
                  type="button"
                  onClick={toggleSatellite}
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-field border px-2.5 text-[11px] font-semibold shadow-pop transition-colors',
                    satellite ? 'border-primary bg-primary text-white' : 'border-border bg-surface-0 text-foreground-default hover:bg-surface-1',
                  )}
                  title="Uydu görünümü"
                >
                  <Layers2Icon className="h-3.5 w-3.5" /> Uydu
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {!readOnly && (
        <div>
          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="flex items-center gap-1 py-1 type-caption text-foreground-subtle transition-colors hover:text-foreground-default"
          >
            <ChevronDownIcon className={cn('h-3.5 w-3.5 transition-transform', showManual && 'rotate-180')} />
            Koordinatları elle gir
          </button>
          {showManual && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <span className="type-label">Enlem (lat)</span>
                <Input inputMode="decimal" placeholder="41.0750" value={lat ?? ''} onChange={(e) => setCoord('latitude', e.target.value)} />
              </div>
              <div className="space-y-1">
                <span className="type-label">Boylam (lng)</span>
                <Input inputMode="decimal" placeholder="28.8700" value={lng ?? ''} onChange={(e) => setCoord('longitude', e.target.value)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function hasCoordsInit(value?: MapCoords): boolean {
  return typeof value?.latitude === 'number' && typeof value?.longitude === 'number'
}
