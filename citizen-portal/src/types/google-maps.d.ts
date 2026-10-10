
declare namespace google.maps {
  class Map {
    constructor(el: HTMLElement, opts?: MapOptions)
    setCenter(latLng: LatLngLiteral): void
    setZoom(zoom: number): void
    setTilt(tilt: number): void
    setMapTypeId(mapTypeId: string): void
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
    tilt?: number
    heading?: number
    mapTypeId?: string
    mapTypeControl?: boolean
    streetViewControl?: boolean
    fullscreenControl?: boolean
    zoomControl?: boolean
    rotateControl?: boolean
    clickableIcons?: boolean
    gestureHandling?: 'cooperative' | 'greedy' | 'none' | 'auto'
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
    animation?: number
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
    open(opts: { map?: Map; anchor?: Marker }): void
    close(): void
    addListener(eventName: string, handler: () => void): void
  }

  interface InfoWindowOptions {
    content?: string | Node
    maxWidth?: number
    disableAutoPan?: boolean
  }

  const Animation: { DROP: number; BOUNCE: number }

  class Geocoder {
    geocode(request: GeocoderRequest): Promise<{ results: GeocoderResult[] }>
  }

  interface GeocoderRequest {
    address?: string
    location?: LatLngLiteral
  }

  interface GeocoderResult {
    formatted_address: string
    geometry: { location: LatLng }
  }

  namespace places {
    class Autocomplete {
      constructor(input: HTMLInputElement, opts?: AutocompleteOptions)
      addListener(eventName: string, handler: () => void): void
      getPlace(): PlaceResult
      bindTo(key: string, map: Map): void
    }

    interface AutocompleteOptions {
      types?: string[]
      componentRestrictions?: { country: string | string[] }
      fields?: string[]
    }

    interface PlaceResult {
      formatted_address?: string
      name?: string
      geometry?: {
        location?: LatLng
      }
    }
  }
}

interface Window {
  google?: { maps: typeof google.maps }
}
