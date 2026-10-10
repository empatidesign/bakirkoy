export type FacilityStatus = 'Active' | 'Passive'
export type LocationType = 'Indoor' | 'Outdoor'
export type OutdoorCategory = 'KentOrmani' | 'Park' | 'Meydan' | 'Sahil' | 'AcikSaha' | 'Diger'
export type ParkingType = 'Free' | 'Paid' | 'Limited'
export type ServiceModule = 'sports' | 'library' | 'education' | 'culture' | 'events' | 'health' | 'social' | 'info'

export interface FacilityImage {
  id: string
  url: string
  name?: string
  size?: number
  isPrimary?: boolean
}

export interface ServiceOffering {
  id: string
  name: string
  module: ServiceModule
  catalogId?: string
  description?: string
  active: boolean
}

export interface FacilityServiceCatalogItem {
  id: string
  name: string
  module: ServiceModule
  description?: string
  icon?: string
}

export interface ServiceFacility {
  id: string
  name: string
  type: string
  status: FacilityStatus
  locationType: LocationType
  outdoorCategory?: OutdoorCategory
  areaSizeM2?: number
  description?: string
  about?: string

  city: string
  district: string
  address: string
  latitude?: number
  longitude?: number

  managerId?: string
  managerRoleKey?: string
  managerRoleName?: string
  manager: string
  managerPhone: string
  managerEmail: string
  emergencyPhone?: string
  website?: string
  facebook?: string
  instagram?: string
  twitter?: string

  weekdayOpen: string
  weekdayClose: string
  weekendOpen: string
  weekendClose: string

  facilities: string[]
  accessibilityFeatures: string[]
  parkingCapacity: number
  parkingType: ParkingType
  capacity?: number

  serviceIds: string[]
  offeredServices: ServiceOffering[]
  serviceCount: number

  images: FacilityImage[]
  primaryImageUrl?: string

  createdAt: string
}

export interface ServiceFacilitySummary {
  total: number
  indoor: number
  outdoor: number
  active: number
  services: number
}

export interface FacilityMapPoint {
  id: string
  name: string
  type: string
  status: FacilityStatus
  locationType: LocationType
  district: string
  city: string
  latitude?: number
  longitude?: number
  serviceCount: number
  primaryImageUrl?: string
}

export interface MasterQrInfo {
  token: string | null
  windowSeconds: number
  enabled: boolean
}

export interface MasterCardRotateResult {
  plainCode: string
}

// Kullanıcı isteği (2026-10-04): modül bazlı toplu atama — bir hizmet tesisinin (örn. "Özdemir
// Bayraktar") hangi program modüllerinde (Spor, Havuz, Kaşif Çocuk vb.) kullanıldığını gösterir.
export interface ServiceFacilityModuleUsage {
  module: string
  assigned: boolean
  facilityId?: string
  facilityName?: string
  facilityIsActive?: boolean
}

export interface AssignServiceFacilityModulesResult {
  assigned: number
  alreadyAssigned: number
  failed: string[]
}

export interface ServiceFacilityRequest {
  name: string
  type: string
  locationType: LocationType
  outdoorCategory?: OutdoorCategory
  areaSizeM2?: number
  description?: string
  about?: string

  city: string
  district: string
  address: string
  latitude?: number
  longitude?: number

  managerId?: string
  manager: string
  managerPhone: string
  managerEmail: string
  emergencyPhone?: string
  website?: string
  facebook?: string
  instagram?: string
  twitter?: string

  weekdayOpen: string
  weekdayClose: string
  weekendOpen: string
  weekendClose: string

  facilities: string[]
  accessibilityFeatures: string[]
  parkingCapacity: number
  parkingType?: ParkingType
  capacity?: number

  offeredServices: ServiceOffering[]
  images: FacilityImage[]

  grantAccess?: boolean
  roleTemplateKey?: string
  tckn?: string
}

type Tone = 'success' | 'neutral' | 'danger' | 'warning' | 'info' | 'primary'

export const FACILITY_STATUS_LABELS: Record<FacilityStatus, string> = {
  Active: 'Aktif',
  Passive: 'Pasif',
}

export const FACILITY_STATUS_TONE: Record<FacilityStatus, Tone> = {
  Active: 'success',
  Passive: 'neutral',
}

export const FACILITY_STATUS_OPTIONS: { value: FacilityStatus; label: string }[] = [
  { value: 'Active', label: 'Aktif' },
  { value: 'Passive', label: 'Pasif' },
]

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  Indoor: 'Kapalı Alan',
  Outdoor: 'Açık Alan',
}

export const LOCATION_TYPE_TONE: Record<LocationType, Tone> = {
  Indoor: 'info',
  Outdoor: 'success',
}

export const LOCATION_TYPE_OPTIONS: { value: LocationType; label: string }[] = [
  { value: 'Indoor', label: 'Kapalı Alan' },
  { value: 'Outdoor', label: 'Açık Alan' },
]

export const OUTDOOR_CATEGORY_LABELS: Record<OutdoorCategory, string> = {
  KentOrmani: 'Kent Ormanı',
  Park: 'Park',
  Meydan: 'Meydan',
  Sahil: 'Sahil',
  AcikSaha: 'Açık Saha',
  Diger: 'Diğer',
}

export const OUTDOOR_CATEGORY_OPTIONS: { value: OutdoorCategory; label: string }[] = [
  { value: 'KentOrmani', label: 'Kent Ormanı' },
  { value: 'Park', label: 'Park' },
  { value: 'Meydan', label: 'Meydan' },
  { value: 'Sahil', label: 'Sahil' },
  { value: 'AcikSaha', label: 'Açık Saha' },
  { value: 'Diger', label: 'Diğer' },
]

export const PARKING_TYPE_LABELS: Record<ParkingType, string> = {
  Free: 'Ücretsiz',
  Paid: 'Ücretli',
  Limited: 'Kısıtlı',
}

export const PARKING_TYPE_OPTIONS: { value: ParkingType; label: string }[] = [
  { value: 'Free', label: 'Ücretsiz' },
  { value: 'Paid', label: 'Ücretli' },
  { value: 'Limited', label: 'Kısıtlı' },
]

export const SERVICE_MODULE_LABELS: Record<ServiceModule, string> = {
  sports: 'Spor',
  library: 'Kütüphane',
  education: 'Eğitim',
  culture: 'Kültür & Sanat',
  events: 'Etkinlik',
  health: 'Sağlık',
  social: 'Sosyal',
  info: 'Bilgi',
}

export const SERVICE_MODULE_COLOR: Record<ServiceModule, string> = {
  sports: '#3b82f6',
  library: '#10b981',
  education: '#8b5cf6',
  culture: '#ec4899',
  events: '#6366f1',
  health: '#f43f5e',
  social: '#f59e0b',
  info: '#06b6d4',
}

export const FACILITY_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'Spor Tesisi', label: 'Spor Tesisi' },
  { value: 'Kültür Merkezi', label: 'Kültür Merkezi' },
  { value: 'Eğitim Merkezi', label: 'Eğitim Merkezi' },
  { value: 'Sosyal Tesis', label: 'Sosyal Tesis' },
  { value: 'Kütüphane', label: 'Kütüphane' },
  { value: 'Sağlık Tesisi', label: 'Sağlık Tesisi' },
  { value: 'Park / Yeşil Alan', label: 'Park / Yeşil Alan' },
  { value: 'Diğer', label: 'Diğer' },
]

export const FACILITY_FEATURE_OPTIONS: string[] = [
  'Klima', 'WiFi', 'Otopark', 'Kafeterya', 'Vestiyer', 'WC', 'Güvenlik',
  'Ses Sistemi', 'Işık Sistemi', 'Sahne', 'Projeksiyon', 'Asansör',
  'Engelli Erişimi', 'Yangın Güvenlik', 'İlk Yardım', 'Temizlik',
]

export const ACCESSIBILITY_OPTIONS: string[] = [
  'Rampa', 'Asansör', 'Engelli WC', 'Engelli Otoparkı',
  'İşitme Cihazı', 'Braille Alfabesi', 'Sesli Anons', 'Geniş Kapılar',
]
