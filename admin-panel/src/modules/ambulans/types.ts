export type TriajLevel = 'kirmizi' | 'sari' | 'yesil'

export type ApplicationStatus =
  | 'TASLAK'
  | 'BASVURU_ALINDI'
  | 'ON_INCELEMEDE'
  | 'EVRAK_KONTROLUNDE'
  | 'EKSIK_BELGE'
  | 'EK_BILGI_BEKLENIYOR'
  | 'YONETICI_DEGERLENDIRMESINDE'
  | 'ONAYLANDI'
  | 'REDDEDILDI'
  | 'RANDEVU_BEKLIYOR'
  | 'RANDEVU_OLUSTURULDU'
  | 'OPERASYON_PLANLANDI'
  | 'AMBULANS_ATANDI'
  | 'EKIP_ATANDI'
  | 'YOLA_CIKMAYA_HAZIR'
  | 'YOLA_CIKTI'
  | 'HASTAYA_ULASTI'
  | 'HASTA_ARACA_ALINDI'
  | 'HASTANEYE_GIDILIYOR'
  | 'HASTANEYE_ULASILDI'
  | 'HASTA_TESLIM_EDILDI'
  | 'DONUS_BEKLENIYOR'
  | 'EVE_DONUS_BASLADI'
  | 'HASTA_EVE_TESLIM_EDILDI'
  | 'OPERASYON_TAMAMLANDI'
  | 'IPTAL_EDILDI'
  | 'VATANDAS_IPTALI'
  | 'BELEDIYE_IPTALI'

export type OperationStep =
  | 'YOLA_CIKMAYA_HAZIR'
  | 'YOLA_CIKTI'
  | 'YAKLASIYOR_20DK'
  | 'HASTAYA_ULASTI'
  | 'HASTA_ARACA_ALINDI'
  | 'HASTANEYE_GIDILIYOR'
  | 'HASTANEYE_ULASILDI'
  | 'HASTA_TESLIM_EDILDI'
  | 'DONUS_BEKLENIYOR'
  | 'EVE_DONUS_BASLADI'
  | 'HASTA_EVE_TESLIM_EDILDI'
  | 'OPERASYON_TAMAMLANDI'

export type MobilityStatus = 'YATAGA_BAGIMLI' | 'SEDYE' | 'TEKERLEKLI_SANDALYE' | 'AYAKTA'

export interface PatientHealthProfile {
  diagnosis: string
  transferReason: string
  mobilityStatus: MobilityStatus
  needsOxygen: boolean
  oxygenFlowLpm?: number
  portableOxygenRequired?: boolean
  hasTracheostomy: boolean
  hasPeg: boolean
  hasCatheter: boolean
  hasIvSerum: boolean
  isContagious: boolean
  isConscious: boolean
  companionRequired: boolean
  patientWeightKg: number
  medicalStaffRequired: boolean
  specialEquipmentNotes?: string
}

export interface BuildingAccessInfo {
  floor: number
  hasElevator: boolean
  stairAccessible: boolean
  ambulanceStreetAccessible: boolean
  accessNotes?: string
}

export interface DocumentAttachment {
  id: string
  type: 'KIMLIK' | 'RANDEVU_BELGESI' | 'SAGLIK_RAPORU' | 'ENGELLI_RAPORU' | 'EPIKRIZ' | 'RECETE' | 'DIGER'
  name: string
  fileSize: string
  uploadedAt: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  rejectionReason?: string
}

export interface AmbulanceApplication {
  id: string
  applicationNo: string // Örn: AMB-2026-000142
  createdAt: string
  status: ApplicationStatus
  triaj: TriajLevel
  
  // Başvuru Sahibi
  applicant: {
    fullName: string
    tckn: string
    phone: string
    email: string
    relationship: 'KENDISI' | 'ANNE' | 'BABA' | 'ES' | 'COCUK' | 'KARDES' | 'TORUN' | 'AKRABA' | 'VASI' | 'BAKICI' | 'DIGER'
    relationshipOtherDetail?: string
  }
  
  // Hasta Bilgileri
  patient: {
    fullName: string
    tckn: string
    birthDate: string
    age: number
    gender: 'KADIN' | 'ERKEK'
    phone: string
    alternativePhone?: string
    mernisVerified: boolean
    activeDuplicateCheckPass: boolean
  }
  
  // Adres & Bina
  pickupAddress: {
    district: string
    neighborhood: string
    street: string
    buildingNo: string
    floorInfo: string
    fullAddress: string
    buildingAccess: BuildingAccessInfo
    coordinates?: { lat: number; lng: number }
  }
  
  // Sağlık Profili
  healthProfile: PatientHealthProfile
  
  // Nakil & Hastane
  destination: {
    hospitalName: string
    hospitalType: 'Sehir Hastanesi' | 'Egitim Arastirma' | 'Devlet Hastanesi' | 'Universite' | 'Fizik Tedavi' | 'Diyaliz' | 'Ozel'
    department: string
    doctorName?: string
    appointmentDate: string
    appointmentTime: string // "10:00"
    mustBeThereMinutesBefore: number // 30
    calculatedPickupTime: string // "08:35"
    estimatedTravelMinutes: number // 35
    estimatedLoadingMinutes: number // 15
    safetyBufferMinutes: number // 10
    isRoundTrip: boolean
    returnTime?: string
  }
  
  documents: DocumentAttachment[]
  reviewNotes?: string
  internalEvaluator?: string
  history: {
    status: ApplicationStatus
    timestamp: string
    actor: string
    note?: string
  }[]
}

export interface AmbulanceVehicle {
  id: string
  plate: string
  brandModel: string
  modelYear: number
  vehicleType: 'Hasta Nakil Ambulansı' | 'Acil Yardım Ambulansı'
  status: 'AVAILABLE' | 'ASSIGNED' | 'EN_ROUTE' | 'AT_PATIENT' | 'AT_HOSPITAL' | 'RETURNING' | 'MAINTENANCE' | 'OUT_OF_SERVICE'
  stretcherCapacity: number
  wheelchairCapacity: number
  hasCentralOxygen: boolean
  hasVentilator: boolean
  hasDefibrillator: boolean
  odometerKm: number
  nextMaintenanceKm: number
  inspectionDate: string
  gpsDeviceImei: string
  phone: string
  currentLocation: {
    lat: number
    lng: number
    speedKmH: number
    address: string
    lastPing: string
  }
  workloadScoreToday: number // Adil görev yükü puanı
}

export interface AmbulanceCrew {
  id: string
  ambulanceId: string
  shiftDate: string
  shiftHours: string
  driver: {
    id: string
    fullName: string
    phone: string
    licenseClass: string
    drivingHoursToday: number
    isResting: boolean
  }
  paramedic: {
    id: string
    fullName: string
    title: 'Paramedik' | 'ATT' | 'Hemşire'
    phone: string
  }
  assistant?: {
    id: string
    fullName: string
    phone: string
  }
}

export interface OperationTask {
  id: string
  trackingNo: string
  applicationId: string
  patientName: string
  patientTckn?: string
  patientPhone: string
  pickupDistrict: string
  pickupAddress: string
  pickupFloorNotes?: string
  destinationHospital: string
  destinationDepartment: string
  appointmentTime: string
  scheduledPickupTime: string
  /** Operasyonun ait olduğu gün (YYYY-MM-DD). Ajanda / takvim görünümü bu alana göre filtreler. */
  scheduledDate: string
  ambulancePlate: string
  ambulanceId: string
  crewId: string
  step: OperationStep
  isRoundTrip: boolean
  returnTime?: string
  delayMinutes: number
  delayAlert?: string
  triaj: TriajLevel
  mobility: MobilityStatus
  needsOxygen: boolean
  specialNotes?: string
  completedAt?: string
}

/** Çağrı merkezi / Hasta Sorgula ekranı için TC/telefon bazlı tekil hasta nakil kaydı özeti. */
export interface PatientLookupRecord {
  trackingNo: string
  patientName: string
  tckn: string
  phone: string
  scheduledDate: string
  scheduledPickupTime: string
  appointmentTime: string
  pickupDistrict: string
  pickupAddress: string
  pickupFloorNotes?: string
  destinationHospital: string
  destinationDepartment: string
  isRoundTrip: boolean
  returnTime?: string
  tripDirection: 'GIDIS_DONUS' | 'SADECE_GIDIS'
  ambulancePlate?: string
  driverName?: string
  driverPhone?: string
  attName?: string
  attPhone?: string
  step: OperationStep
}

export interface AmbulanceAuditLog {
  id: string
  timestamp: string
  actorName: string
  actorRole: string
  action: string
  targetTrackingNo: string
  details: string
  ipAddress: string
}
