import type {
  FacilityImage,
  LocationType,
  OutdoorCategory,
  ParkingType,
  ServiceFacility,
  ServiceFacilityRequest,
  ServiceOffering,
} from '@/types/serviceFacility.types'
import { isResponsiblePersonValid } from '@/components/specialized/ResponsiblePersonField'

export interface FacilityForm {
  name: string
  type: string
  locationType: LocationType
  outdoorCategory: OutdoorCategory | ''
  areaSizeM2: string
  description: string
  about: string

  city: string
  district: string
  address: string
  latitude?: number
  longitude?: number

  managerId: string
  managerRoleKey: string
  managerRoleName: string
  manager: string
  managerPhone: string
  managerEmail: string
  grantAccess: boolean
  tckn: string
  emergencyPhone: string
  website: string
  facebook: string
  instagram: string
  twitter: string

  weekdayOpen: string
  weekdayClose: string
  weekendOpen: string
  weekendClose: string

  facilities: string[]
  accessibilityFeatures: string[]
  hasParking: boolean
  parkingCapacity: string
  parkingType: ParkingType
  capacity: string

  offeredServices: ServiceOffering[]
  images: FacilityImage[]
  modules: string[]
}

export const emptyFacilityForm: FacilityForm = {
  name: '',
  type: '',
  locationType: 'Indoor',
  outdoorCategory: '',
  areaSizeM2: '',
  description: '',
  about: '',
  city: 'İstanbul',
  district: 'Bakırköy',
  address: '',
  latitude: undefined,
  longitude: undefined,
  managerId: '',
  managerRoleKey: '',
  managerRoleName: '',
  manager: '',
  managerPhone: '',
  managerEmail: '',
  grantAccess: false,
  tckn: '',
  emergencyPhone: '',
  website: '',
  facebook: '',
  instagram: '',
  twitter: '',
  weekdayOpen: '09:00',
  weekdayClose: '18:00',
  weekendOpen: '10:00',
  weekendClose: '17:00',
  facilities: [],
  accessibilityFeatures: [],
  hasParking: false,
  parkingCapacity: '',
  parkingType: 'Free',
  capacity: '',
  offeredServices: [],
  images: [],
  modules: [],
}

export const toFacilityForm = (r: ServiceFacility): FacilityForm => ({
  name: r.name,
  type: r.type,
  locationType: r.locationType,
  outdoorCategory: r.outdoorCategory ?? '',
  areaSizeM2: r.areaSizeM2 != null ? String(r.areaSizeM2) : '',
  description: r.description ?? '',
  about: r.about ?? '',
  city: r.city,
  district: r.district,
  address: r.address,
  latitude: r.latitude,
  longitude: r.longitude,
  managerId: r.managerId ?? '',
  managerRoleKey: r.managerRoleKey ?? '',
  managerRoleName: r.managerRoleName ?? '',
  manager: r.manager,
  managerPhone: r.managerPhone,
  managerEmail: r.managerEmail,
  grantAccess: false,
  tckn: '',
  emergencyPhone: r.emergencyPhone ?? '',
  website: r.website ?? '',
  facebook: r.facebook ?? '',
  instagram: r.instagram ?? '',
  twitter: r.twitter ?? '',
  weekdayOpen: r.weekdayOpen,
  weekdayClose: r.weekdayClose,
  weekendOpen: r.weekendOpen,
  weekendClose: r.weekendClose,
  facilities: r.facilities ?? [],
  accessibilityFeatures: r.accessibilityFeatures ?? [],
  // Otopark "var/yok" seçimi ayrı bir alan olarak tutulmuyor; kapasite > 0 ise otopark var sayılır.
  hasParking: (r.parkingCapacity ?? 0) > 0,
  parkingCapacity: r.parkingCapacity ? String(r.parkingCapacity) : '',
  parkingType: r.parkingType,
  capacity: r.capacity != null ? String(r.capacity) : '',
  offeredServices: r.offeredServices ?? [],
  images: r.images ?? [],
  modules: [],
})

export const toFacilityRequest = (f: FacilityForm): ServiceFacilityRequest => ({
  name: f.name.trim(),
  type: f.type,
  locationType: f.locationType,
  outdoorCategory: f.locationType === 'Outdoor' ? (f.outdoorCategory || undefined) : undefined,
  areaSizeM2: f.locationType === 'Outdoor' && f.areaSizeM2 ? Number(f.areaSizeM2) : undefined,
  description: f.description.trim() || undefined,
  about: f.about.trim() || undefined,
  city: f.city.trim(),
  district: f.district.trim(),
  address: f.address.trim(),
  latitude: f.latitude,
  longitude: f.longitude,
  managerId: f.managerId || undefined,
  manager: f.manager.trim(),
  managerPhone: f.managerPhone || '',
  managerEmail: f.managerEmail.trim(),
  emergencyPhone: f.emergencyPhone || undefined,
  website: f.website.trim() || undefined,
  facebook: f.facebook.trim() || undefined,
  instagram: f.instagram.trim() || undefined,
  twitter: f.twitter.trim() || undefined,
  weekdayOpen: f.weekdayOpen,
  weekdayClose: f.weekdayClose,
  weekendOpen: f.weekendOpen,
  weekendClose: f.weekendClose,
  facilities: f.facilities,
  accessibilityFeatures: f.accessibilityFeatures,
  parkingCapacity: f.hasParking && f.parkingCapacity ? Number(f.parkingCapacity) : 0,
  parkingType: f.hasParking ? f.parkingType : undefined,
  capacity: f.capacity ? Number(f.capacity) : undefined,
  offeredServices: f.offeredServices,
  images: f.images,
  grantAccess: f.grantAccess,
  roleTemplateKey: f.grantAccess ? 'tesis-sorumlusu' : undefined,
  tckn: f.tckn || undefined,
})

export const getFacilityFormErrors = (f: FacilityForm): string[] => [
  !f.name.trim() && 'Tesis adı zorunludur.',
  // Backend ServiceFacility.Description varchar(500) (bkz. api
  // ServiceFacilityRequestValidator) — zengin metin editörü HTML ürettiği için
  // biçimlendirme etiketleri de bu sınıra dahildir; aşılırsa backend'den önceden
  // 400 dönmek yerine burada erkenden yakalanır.
  f.description.length > 500 && `Tesis açıklaması 500 karakteri aşıyor (${f.description.length}/500).`,
  (f.latitude == null || f.longitude == null || !Number.isFinite(f.latitude) || !Number.isFinite(f.longitude) || Math.abs(f.latitude) > 90 || Math.abs(f.longitude) > 180) && 'Geçerli tesis koordinatlarını giriniz.',
  // Kullanıcı isteği (2026-09-07): tesis bilgilerinde ad dışında hiçbir alan zorunlu
  // değil — tür, şehir, adres ve otopark türü boş bırakılabilir.
  // Kullanıcı isteği (2026-08-02): yönetici ataması artık zorunlu değil (silinip
  // boş bırakılarak güncelleme yapılabilir); T.C. Kimlik No da "Yeni Yetkili Ekle"
  // akışında zorunlu değil (requireTckn=false).
  !isResponsiblePersonValid(f, false) && 'Sisteme erişim verilecek kişinin adı, telefonu ve e-postası eksik veya hatalı.',
].filter(Boolean) as string[]
