import type { SelectOption } from '@/types/common'

export type HallSeatingMode = 'seated' | 'standing'

export type SeatStatus = 'available' | 'reserved' | 'protocol' | 'closed'

export type SeatingTemplateId =
  | 'theater'
  | 'cinema'
  | 'amphitheater'
  | 'conference'
  | 'classroom'
  | 'ushape'
  | 'banquet'
  | 'custom'

export interface SeatingFloor {
  id: string
  name: string
  rows: number
  defaultSegments: number[]
  rowOverrides: Record<number, number[]>
  crossAisles: number[]
  rowLabelStart: string
  skipIO: boolean
}

export interface SeatingLayout {
  template: SeatingTemplateId
  floors: SeatingFloor[]
}

export type SeatStateMap = Record<string, SeatStatus>

export type HallFeatureColor = 'blue' | 'green' | 'orange' | 'violet' | 'cyan' | 'red'

export const HALL_FEATURE_COLORS: HallFeatureColor[] = ['blue', 'green', 'orange', 'violet', 'cyan', 'red']

export interface HallFeatureGroup {
  id: string
  name: string
  color: HallFeatureColor
}

export interface HallFeature {
  id: string
  name: string
  group: string
}

export interface HallFeatureCatalog {
  groups: HallFeatureGroup[]
  features: HallFeature[]
}

export interface HallFeatureTemplate {
  id: string
  name: string
  description?: string
  featureIds: string[]
}

export interface Hall {
  id: string
  name: string
  facilityId: string
  facilityName?: string
  type: string
  buildingFloor?: number
  seatingMode: HallSeatingMode
  capacity: number
  availableCapacity: number
  floorCount: number
  layout?: SeatingLayout
  featureIds: string[]
  description?: string
  about?: string
  isActive: boolean
  createdAt: string
}

export interface HallSummary {
  total: number
  active: number
  passive: number
  totalCapacity: number
}

export interface HallForm {
  facilityId: string
  name: string
  type: string
  buildingFloor: string
  seatingMode: HallSeatingMode
  capacity: string
  description: string
  about: string
  featureIds: string[]
  layout: SeatingLayout
}

export interface CreateHallRequest {
  facilityId: string
  name: string
  type: string
  buildingFloor?: number
  seatingMode: HallSeatingMode
  capacity: number
  layout?: SeatingLayout
  featureIds: string[]
  description?: string
  about?: string
}

export type UpdateHallRequest = CreateHallRequest

export interface FacilityOption {
  value: string
  label: string
  locationType: string
}

export interface FeatureGroupRequest {
  name: string
  color: HallFeatureColor
}

export interface FeatureRequest {
  name: string
  group: string
}

export interface FeatureTemplateRequest {
  name: string
  description?: string
  featureIds: string[]
}

export const HALL_TYPE_OPTIONS: SelectOption[] = [
  { value: 'conference', label: 'Konferans Salonu' },
  { value: 'theater', label: 'Tiyatro Salonu' },
  { value: 'cinema', label: 'Sinema Salonu' },
  { value: 'amphitheater', label: 'Amfi Tiyatro' },
  { value: 'seminar', label: 'Seminer Odası' },
  { value: 'meeting', label: 'Toplantı Odası' },
  { value: 'multipurpose', label: 'Çok Amaçlı Salon' },
  { value: 'outdoor', label: 'Açık Hava Salonu' },
]

export const HALL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  HALL_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

export const SEATING_MODE_LABELS: Record<HallSeatingMode, string> = {
  seated: 'Koltuklu',
  standing: 'Ayakta',
}

export const SEAT_STATUS_LABELS: Record<SeatStatus, string> = {
  available: 'Boş',
  reserved: 'Rezerve',
  protocol: 'Protokol',
  closed: 'Kapalı',
}

export const DEFAULT_HALL_FEATURE_CATALOG: HallFeatureCatalog = {
  groups: [
    { id: 'av', name: 'Ses-Görüntü', color: 'blue' },
    { id: 'comfort', name: 'Konfor', color: 'green' },
    { id: 'stage', name: 'Sahne & Işık', color: 'orange' },
    { id: 'access', name: 'Erişilebilirlik', color: 'violet' },
    { id: 'tech', name: 'Teknik', color: 'cyan' },
    { id: 'services', name: 'Servisler', color: 'red' },
  ],
  features: [
    { id: 'sound-system', name: 'Ses Sistemi', group: 'av' },
    { id: 'wireless-mic', name: 'Kablosuz Mikrofon', group: 'av' },
    { id: 'projection', name: 'Projeksiyon', group: 'av' },
    { id: 'led-wall', name: 'Dev Ekran (LED Wall)', group: 'av' },
    { id: 'video-record', name: 'Video Kayıt', group: 'av' },
    { id: 'live-stream', name: 'Canlı Yayın Altyapısı', group: 'av' },
    { id: 'simultaneous', name: 'Simultane Çeviri', group: 'av' },
    { id: 'ac', name: 'Klima', group: 'comfort' },
    { id: 'heating', name: 'Isıtma', group: 'comfort' },
    { id: 'ventilation', name: 'Havalandırma', group: 'comfort' },
    { id: 'reclining', name: 'Yaslanan Koltuk', group: 'comfort' },
    { id: 'cup-holder', name: 'Bardak Tutucu', group: 'comfort' },
    { id: 'cloakroom', name: 'Vestiyer', group: 'comfort' },
    { id: 'stage', name: 'Sahne', group: 'stage' },
    { id: 'podium', name: 'Kürsü / Podyum', group: 'stage' },
    { id: 'stage-lighting', name: 'Sahne Aydınlatma', group: 'stage' },
    { id: 'spotlight', name: 'Spot Işık', group: 'stage' },
    { id: 'stage-curtain', name: 'Sahne Perdesi', group: 'stage' },
    { id: 'dressing-room', name: 'Soyunma Odası', group: 'stage' },
    { id: 'backstage', name: 'Sahne Arkası', group: 'stage' },
    { id: 'wheelchair', name: 'Tekerlekli Sandalye Erişimi', group: 'access' },
    { id: 'ramp', name: 'Rampa', group: 'access' },
    { id: 'elevator', name: 'Asansör', group: 'access' },
    { id: 'hearing-loop', name: 'İşitme Döngüsü', group: 'access' },
    { id: 'braille', name: 'Braille Yönlendirme', group: 'access' },
    { id: 'accessible-wc', name: 'Engelli WC', group: 'access' },
    { id: 'wifi', name: 'Wi-Fi', group: 'tech' },
    { id: 'power-outlet', name: 'Priz (Her Sırada)', group: 'tech' },
    { id: 'usb-charge', name: 'USB Şarj', group: 'tech' },
    { id: 'smart-board', name: 'Akıllı Tahta', group: 'tech' },
    { id: 'computer-podium', name: 'Bilgisayarlı Kürsü', group: 'tech' },
    { id: 'qr-entry', name: 'QR Girişi', group: 'tech' },
    { id: 'catering', name: 'Catering', group: 'services' },
    { id: 'refreshment', name: 'İkram Köşesi', group: 'services' },
    { id: 'security', name: 'Güvenlik', group: 'services' },
    { id: 'parking', name: 'Otopark', group: 'services' },
    { id: 'smoking-area', name: 'Sigara İçme Alanı', group: 'services' },
    { id: 'kids-area', name: 'Çocuk Alanı', group: 'services' },
  ],
}

export const DEFAULT_HALL_FEATURE_TEMPLATES: HallFeatureTemplate[] = [
  {
    id: 'tpl-conference',
    name: 'Standart Konferans Salonu',
    description: 'Klasik konferans/seminer kurulumu',
    featureIds: ['sound-system', 'wireless-mic', 'projection', 'led-wall', 'ac', 'podium', 'stage-lighting', 'wifi', 'power-outlet', 'wheelchair', 'accessible-wc'],
  },
  {
    id: 'tpl-cinema',
    name: 'Sinema Salonu (Tam)',
    description: 'Film gösterimi için tam donanımlı',
    featureIds: ['sound-system', 'projection', 'led-wall', 'ac', 'ventilation', 'reclining', 'stage-curtain', 'wheelchair', 'accessible-wc', 'wifi'],
  },
  {
    id: 'tpl-theater',
    name: 'Tiyatro Salonu',
    description: 'Sahne sanatları için',
    featureIds: ['sound-system', 'wireless-mic', 'stage', 'podium', 'stage-lighting', 'spotlight', 'stage-curtain', 'dressing-room', 'backstage', 'ac', 'reclining', 'wheelchair', 'accessible-wc'],
  },
]
