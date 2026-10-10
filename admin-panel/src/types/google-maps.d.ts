
declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts?: MapOptions)
    setCenter(latLng: LatLngLiteral): void
    setZoom(zoom: number): void
    getZoom(): number | undefined
    fitBounds(bounds: LatLngBounds, padding?: number | Padding): void
    addListener(eventName: string, handler: (e: MapMouseEvent) => void): void
  }

  interface Padding {
    top: number
    right: number
    bottom: number
    left: number
  }

  interface MapOptions {
    center?: LatLngLiteral
    zoom?: number
    mapTypeControl?: boolean
    streetViewControl?: boolean
    fullscreenControl?: boolean
    zoomControl?: boolean
    clickableIcons?: boolean
  }

  interface LatLngLiteral {
    lat: number
    lng: number
  }

  interface MapMouseEvent {
    latLng: LatLng | null
  }

  class LatLng {
    lat(): number
    lng(): number
  }

  class LatLngBounds {
    constructor()
    extend(latLng: LatLngLiteral): LatLngBounds
    isEmpty(): boolean
  }

  class Marker {
    constructor(opts?: MarkerOptions)
    setPosition(latLng: LatLngLiteral): void
    setMap(map: Map | null): void
    addListener(eventName: string, handler: () => void): void
    getPosition(): LatLng | null
  }

  interface MarkerOptions {
    position?: LatLngLiteral
    map?: Map
    draggable?: boolean
    title?: string
    icon?: Icon | string
    zIndex?: number
  }

  interface Icon {
    url: string
    scaledSize?: Size
    anchor?: Point
  }

  class Size {
    constructor(width: number, height: number)
  }

  class Point {
    constructor(x: number, y: number)
  }

  class InfoWindow {
    constructor(opts?: InfoWindowOptions)
    open(opts: { map?: Map; anchor?: Marker } | Map): void
    close(): void
    addListener(eventName: string, handler: () => void): void
    // Mahalle haritası (kullanıcı isteği 2026-09-02): tek InfoWindow örneği
    // yeniden kullanılıp içeriği ve konumu güncelleniyor.
    setContent(content: string | Node): void
    setPosition(position: LatLngLiteral): void
  }

  interface InfoWindowOptions {
    content?: string | Node
    maxWidth?: number
    disableAutoPan?: boolean
  }

  // Kullanıcı isteği (2026-09-01): saha görevlisi gün izi — rota çizgisi ve duraklama halkaları.
  class Polyline {
    constructor(opts?: PolylineOptions)
    setMap(map: Map | null): void
  }

  interface PolylineOptions {
    path?: LatLngLiteral[]
    map?: Map
    strokeColor?: string
    strokeOpacity?: number
    strokeWeight?: number
    geodesic?: boolean
    zIndex?: number
  }

  class Circle {
    constructor(opts?: CircleOptions)
    setMap(map: Map | null): void
    setCenter(center: LatLngLiteral): void
    setRadius(radius: number): void
    addListener(eventName: string, handler: () => void): void
  }

  interface CircleOptions {
    center?: LatLngLiteral
    radius?: number
    map?: Map
    strokeColor?: string
    strokeOpacity?: number
    strokeWeight?: number
    fillColor?: string
    fillOpacity?: number
    zIndex?: number
    clickable?: boolean
  }

  class Geocoder {
    geocode(request: GeocoderRequest): Promise<{ results: GeocoderResult[] }>
  }

  interface GeocoderRequest {
    address?: string
    location?: LatLngLiteral
    region?: string
    componentRestrictions?: { country?: string | string[] }
  }

  interface GeocoderResult {
    formatted_address: string
    geometry: { location: LatLng }
  }
}

interface Window {
  google?: { maps: typeof google.maps }
}
