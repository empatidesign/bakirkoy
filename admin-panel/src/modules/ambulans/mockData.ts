import { AmbulanceApplication, AmbulanceVehicle, AmbulanceCrew, OperationTask, AmbulanceAuditLog } from './types'

export const INITIAL_VEHICLES: AmbulanceVehicle[] = [
  {
    id: 'veh-1',
    plate: '34 BKR 112',
    brandModel: 'Mercedes-Benz Sprinter 316 CDI',
    modelYear: 2024,
    vehicleType: 'Hasta Nakil Ambulansı',
    status: 'EN_ROUTE',
    stretcherCapacity: 1,
    wheelchairCapacity: 1,
    hasCentralOxygen: true,
    hasVentilator: true,
    hasDefibrillator: true,
    odometerKm: 34820,
    nextMaintenanceKm: 40000,
    inspectionDate: '2027-04-15',
    gpsDeviceImei: '864209048123901',
    phone: '0530 911 34 01',
    currentLocation: {
      lat: 40.9782,
      lng: 28.8715,
      speedKmH: 48,
      address: 'Ataköy 7-8-9-10. Kısım, Çobançeşme Koşuyolu Cad.',
      lastPing: '30 saniye önce'
    },
    workloadScoreToday: 68.5
  },
  {
    id: 'veh-2',
    plate: '34 BKR 113',
    brandModel: 'Ford Transit 350L Hasta Nakil',
    modelYear: 2023,
    vehicleType: 'Hasta Nakil Ambulansı',
    status: 'AT_HOSPITAL',
    stretcherCapacity: 1,
    wheelchairCapacity: 2,
    hasCentralOxygen: true,
    hasVentilator: false,
    hasDefibrillator: true,
    odometerKm: 58210,
    nextMaintenanceKm: 60000,
    inspectionDate: '2026-11-20',
    gpsDeviceImei: '864209048123902',
    phone: '0530 911 34 02',
    currentLocation: {
      lat: 40.9912,
      lng: 28.8541,
      speedKmH: 0,
      address: 'Bakırköy Dr. Sadi Konuk EAH Acil Girişi',
      lastPing: '10 saniye önce'
    },
    workloadScoreToday: 74.0
  },
  {
    id: 'veh-3',
    plate: '34 BKR 114',
    brandModel: 'Volkswagen Crafter 2.0 TDI',
    modelYear: 2024,
    vehicleType: 'Hasta Nakil Ambulansı',
    status: 'AVAILABLE',
    stretcherCapacity: 1,
    wheelchairCapacity: 1,
    hasCentralOxygen: true,
    hasVentilator: true,
    hasDefibrillator: true,
    odometerKm: 21400,
    nextMaintenanceKm: 30000,
    inspectionDate: '2027-02-10',
    gpsDeviceImei: '864209048123903',
    phone: '0530 911 34 03',
    currentLocation: {
      lat: 40.9721,
      lng: 28.8744,
      speedKmH: 0,
      address: 'Bakırköy Belediyesi Sağlık İşleri Garajı (Zuhuratbaba)',
      lastPing: '1 dakika önce'
    },
    workloadScoreToday: 32.0
  },
  {
    id: 'veh-4',
    plate: '34 BKR 115',
    brandModel: 'Renault Master L3H2',
    modelYear: 2022,
    vehicleType: 'Hasta Nakil Ambulansı',
    status: 'MAINTENANCE',
    stretcherCapacity: 1,
    wheelchairCapacity: 0,
    hasCentralOxygen: true,
    hasVentilator: false,
    hasDefibrillator: false,
    odometerKm: 89500,
    nextMaintenanceKm: 90000,
    inspectionDate: '2026-10-30',
    gpsDeviceImei: '864209048123904',
    phone: '0530 911 34 04',
    currentLocation: {
      lat: 40.9855,
      lng: 28.8690,
      speedKmH: 0,
      address: 'Belediye Fen İşleri Kademe / Servis Bakım Alanı',
      lastPing: '15 dakika önce'
    },
    workloadScoreToday: 0
  }
]

export const INITIAL_CREWS: AmbulanceCrew[] = [
  {
    id: 'crew-1',
    ambulanceId: 'veh-1',
    shiftDate: '2026-10-07',
    shiftHours: '07:30 - 16:30',
    driver: {
      id: 'emp-d1',
      fullName: 'Mustafa Çelik',
      phone: '0542 333 44 55',
      licenseClass: 'B / D / SRC-2',
      drivingHoursToday: 4.5,
      isResting: false
    },
    paramedic: {
      id: 'emp-p1',
      fullName: 'Büşra Yılmaz',
      title: 'Paramedik',
      phone: '0533 222 11 00'
    },
    assistant: {
      id: 'emp-a1',
      fullName: 'Emre Karaca',
      phone: '0537 999 88 77'
    }
  },
  {
    id: 'crew-2',
    ambulanceId: 'veh-2',
    shiftDate: '2026-10-07',
    shiftHours: '08:00 - 17:00',
    driver: {
      id: 'emp-d2',
      fullName: 'Hasan Aktaş',
      phone: '0544 555 66 77',
      licenseClass: 'B / SRC-2',
      drivingHoursToday: 5.2,
      isResting: false
    },
    paramedic: {
      id: 'emp-p2',
      fullName: 'Zeynep Şahin',
      title: 'ATT',
      phone: '0534 888 77 66'
    }
  },
  {
    id: 'crew-3',
    ambulanceId: 'veh-3',
    shiftDate: '2026-10-07',
    shiftHours: '08:30 - 17:30',
    driver: {
      id: 'emp-d3',
      fullName: 'Serdar Güven',
      phone: '0532 123 45 67',
      licenseClass: 'B / D / SRC-2',
      drivingHoursToday: 2.1,
      isResting: true
    },
    paramedic: {
      id: 'emp-p3',
      fullName: 'Gülşah Aydın',
      title: 'Paramedik',
      phone: '0531 456 78 90'
    }
  }
]

export const INITIAL_APPLICATIONS: AmbulanceApplication[] = [
  {
    id: 'app-1',
    applicationNo: 'AMB-2026-000125',
    createdAt: '2026-10-06 14:20',
    status: 'YOLA_CIKTI',
    triaj: 'kirmizi',
    applicant: {
      fullName: 'Ahmet Kemal Yıldırım',
      tckn: '23456789012',
      phone: '0533 111 22 33',
      email: 'ahmet.yildirim@email.com',
      relationship: 'COCUK'
    },
    patient: {
      fullName: 'Ali Kemal Yıldırım',
      tckn: '12456789012',
      birthDate: '1952-04-12',
      age: 74,
      gender: 'ERKEK',
      phone: '0532 444 11 22',
      alternativePhone: '0533 111 22 33',
      mernisVerified: true,
      activeDuplicateCheckPass: true
    },
    pickupAddress: {
      district: 'Bakırköy',
      neighborhood: 'Zuhuratbaba Mah.',
      street: 'İncirli Cad.',
      buildingNo: '48 / Daire 6',
      floorInfo: '3. Kat (Asansör Var)',
      fullAddress: 'Zuhuratbaba Mah. İncirli Cad. No:48 D:6 Bakırköy / İstanbul',
      buildingAccess: {
        floor: 3,
        hasElevator: true,
        stairAccessible: true,
        ambulanceStreetAccessible: true,
        accessNotes: 'Bina girişi geniş, sedye asansöre tam sığıyor.'
      },
      coordinates: { lat: 40.9820, lng: 28.8710 }
    },
    healthProfile: {
      diagnosis: 'Kronik Kalp Yetmezliği (NYHA IV), KOAH Alevlenme',
      transferReason: 'Kardiyoloji & Göğüs Hastalıkları Kontrolü ve Eko',
      mobilityStatus: 'SEDYE',
      needsOxygen: true,
      oxygenFlowLpm: 3.5,
      portableOxygenRequired: true,
      hasTracheostomy: false,
      hasPeg: false,
      hasCatheter: true,
      hasIvSerum: false,
      isContagious: false,
      isConscious: true,
      companionRequired: true,
      patientWeightKg: 82,
      medicalStaffRequired: true,
      specialEquipmentNotes: 'Taşınabilir O2 tüpü ve monitörizasyon gereklidir.'
    },
    destination: {
      hospitalName: 'Bakırköy Dr. Sadi Konuk EAH',
      hospitalType: 'Egitim Arastirma',
      department: 'Kardiyoloji Polikliniği 3',
      doctorName: 'Prof. Dr. Tarık Erkan',
      appointmentDate: '2026-10-07',
      appointmentTime: '10:00',
      mustBeThereMinutesBefore: 30,
      calculatedPickupTime: '08:35',
      estimatedTravelMinutes: 30,
      estimatedLoadingMinutes: 15,
      safetyBufferMinutes: 10,
      isRoundTrip: true,
      returnTime: '12:30'
    },
    documents: [
      { id: 'doc-1', type: 'KIMLIK', name: 'Hasta_Nufus_Cuzdani.pdf', fileSize: '1.2 MB', uploadedAt: '2026-10-06 14:22', status: 'APPROVED' },
      { id: 'doc-2', type: 'RANDEVU_BELGESI', name: 'MHRS_Randevu_Barkodu.pdf', fileSize: '840 KB', uploadedAt: '2026-10-06 14:23', status: 'APPROVED' },
      { id: 'doc-3', type: 'EPIKRIZ', name: 'Kardiyoloji_Epikriz_Raporu.pdf', fileSize: '2.4 MB', uploadedAt: '2026-10-06 14:25', status: 'APPROVED' }
    ],
    internalEvaluator: 'Uzm. Dr. Sinan Aksoy (Sağlık İşleri)',
    reviewNotes: 'Hasta durumu stabilize fakat sedye ve sürekli O2 desteği elzem. AMB-01 tahsis edildi.',
    history: [
      { status: 'BASVURU_ALINDI', timestamp: '2026-10-06 14:20', actor: 'Vatandaş Portalı' },
      { status: 'ON_INCELEMEDE', timestamp: '2026-10-06 14:40', actor: 'Çağrı Merkezi' },
      { status: 'ONAYLANDI', timestamp: '2026-10-06 15:10', actor: 'Uzm. Dr. Sinan Aksoy' },
      { status: 'OPERASYON_PLANLANDI', timestamp: '2026-10-06 18:00', actor: 'Otomatik Planlama Motoru' },
      { status: 'YOLA_CIKTI', timestamp: '2026-10-07 08:30', actor: 'Şoför Mustafa Çelik (Mobil Ekip)' }
    ]
  },
  {
    id: 'app-2',
    applicationNo: 'AMB-2026-000126',
    createdAt: '2026-10-06 16:10',
    status: 'HASTANEYE_GIDILIYOR',
    triaj: 'sari',
    applicant: {
      fullName: 'Fatma Gökçe Kaya',
      tckn: '34567890123',
      phone: '0555 444 33 22',
      email: 'fatma.kaya@email.com',
      relationship: 'KENDISI'
    },
    patient: {
      fullName: 'Fatma Gökçe Kaya',
      tckn: '34567890123',
      birthDate: '1961-09-03',
      age: 65,
      gender: 'KADIN',
      phone: '0555 444 33 22',
      mernisVerified: true,
      activeDuplicateCheckPass: true
    },
    pickupAddress: {
      district: 'Bakırköy',
      neighborhood: 'Kartaltepe Mah.',
      street: 'Liman Cad.',
      buildingNo: '12 / Kat 1',
      floorInfo: '1. Kat (Asansör Yok, Geniş Merdiven)',
      fullAddress: 'Kartaltepe Mah. Liman Cad. No:12 D:3 Bakırköy / İstanbul',
      buildingAccess: {
        floor: 1,
        hasElevator: false,
        stairAccessible: true,
        ambulanceStreetAccessible: true,
        accessNotes: '1. kat, 14 basamaklı geniş merdiven sandalye taşımaya elverişli.'
      },
      coordinates: { lat: 40.9788, lng: 28.8680 }
    },
    healthProfile: {
      diagnosis: 'Sağ Femur Boyun Kırığı Sonrası Protez, Yürüme Güçlüğü',
      transferReason: 'Fizik Tedavi & Ortopedi Kontrolü',
      mobilityStatus: 'TEKERLEKLI_SANDALYE',
      needsOxygen: false,
      hasTracheostomy: false,
      hasPeg: false,
      hasCatheter: false,
      hasIvSerum: false,
      isContagious: false,
      isConscious: true,
      companionRequired: true,
      patientWeightKg: 68,
      medicalStaffRequired: false
    },
    destination: {
      hospitalName: 'İstanbul Fizik Tedavi ve Rehabilitasyon EAH',
      hospitalType: 'Fizik Tedavi',
      department: 'FTR Polikliniği 2',
      doctorName: 'Uzm. Dr. Belma Sert',
      appointmentDate: '2026-10-07',
      appointmentTime: '11:15',
      mustBeThereMinutesBefore: 20,
      calculatedPickupTime: '10:05',
      estimatedTravelMinutes: 25,
      estimatedLoadingMinutes: 15,
      safetyBufferMinutes: 10,
      isRoundTrip: true,
      returnTime: '13:00'
    },
    documents: [
      { id: 'doc-4', type: 'RANDEVU_BELGESI', name: 'FTR_Randevu.pdf', fileSize: '650 KB', uploadedAt: '2026-10-06 16:12', status: 'APPROVED' },
      { id: 'doc-5', type: 'ENGELLI_RAPORU', name: 'Ortopedi_Sureli_Rapor.jpg', fileSize: '1.8 MB', uploadedAt: '2026-10-06 16:15', status: 'APPROVED' }
    ],
    internalEvaluator: 'Dr. Zeki Demir',
    reviewNotes: 'Tekerlekli sandalye rampalı araç tahsis edildi.',
    history: [
      { status: 'BASVURU_ALINDI', timestamp: '2026-10-06 16:10', actor: 'Vatandaş Portalı' },
      { status: 'ONAYLANDI', timestamp: '2026-10-06 17:05', actor: 'Dr. Zeki Demir' },
      { status: 'HASTANEYE_GIDILIYOR', timestamp: '2026-10-07 10:20', actor: 'Şoför Hasan Aktaş' }
    ]
  },
  {
    id: 'app-3',
    applicationNo: 'AMB-2026-000127',
    createdAt: '2026-10-07 08:15',
    status: 'EKSIK_BELGE',
    triaj: 'sari',
    applicant: {
      fullName: 'Mehmet Salih Tan',
      tckn: '45678901234',
      phone: '0538 777 66 55',
      email: 'salih.tan@email.com',
      relationship: 'BABA'
    },
    patient: {
      fullName: 'Canberk Tan',
      tckn: '56789012345',
      birthDate: '2012-05-18',
      age: 14,
      gender: 'ERKEK',
      phone: '0538 777 66 55',
      mernisVerified: true,
      activeDuplicateCheckPass: true
    },
    pickupAddress: {
      district: 'Bakırköy',
      neighborhood: 'Ataköy 2-5-6. Kısım',
      street: 'Rauf Orbay Cad.',
      buildingNo: 'A2 Blok D:18',
      floorInfo: '5. Kat (Çift Asansör)',
      fullAddress: 'Ataköy 2-5-6. Kısım Rauf Orbay Cad. A2 Blok D:18 Bakırköy',
      buildingAccess: {
        floor: 5,
        hasElevator: true,
        stairAccessible: true,
        ambulanceStreetAccessible: true
      }
    },
    healthProfile: {
      diagnosis: 'Serebral Palsi (SP), Skolyoz',
      transferReason: 'Çocuk Nöroloji ve Ortopedi Sağlık Kurulu Heyeti',
      mobilityStatus: 'TEKERLEKLI_SANDALYE',
      needsOxygen: false,
      hasTracheostomy: false,
      hasPeg: false,
      hasCatheter: false,
      hasIvSerum: false,
      isContagious: false,
      isConscious: true,
      companionRequired: true,
      patientWeightKg: 42,
      medicalStaffRequired: false
    },
    destination: {
      hospitalName: 'Başakşehir Çam ve Sakura Şehir Hastanesi',
      hospitalType: 'Sehir Hastanesi',
      department: 'Çocuk Sağlık Kurulu / Heyet',
      doctorName: 'Sağlık Kurulu Heyet Bşk.',
      appointmentDate: '2026-10-08',
      appointmentTime: '09:30',
      mustBeThereMinutesBefore: 45,
      calculatedPickupTime: '07:45',
      estimatedTravelMinutes: 40,
      estimatedLoadingMinutes: 15,
      safetyBufferMinutes: 10,
      isRoundTrip: true
    },
    documents: [
      { id: 'doc-6', type: 'KIMLIK', name: 'Cocuk_Kimlik.pdf', fileSize: '1.1 MB', uploadedAt: '2026-10-07 08:18', status: 'APPROVED' },
      { id: 'doc-7', type: 'RANDEVU_BELGESI', name: 'Heyet_Randevu_Barkodsuz.pdf', fileSize: '540 KB', uploadedAt: '2026-10-07 08:19', status: 'REJECTED', rejectionReason: 'Barkod veya mühürlü heyet randevu onay kağıdı okunamıyor. Lütfen e-Devlet veya hastane onay çıktısını yükleyiniz.' }
    ],
    reviewNotes: 'Sağlık kurulu randevu belgesi eksik/okunaksız. Vatandaşa SMS ve portaldan eksik evrak talebi iletildi.',
    history: [
      { status: 'BASVURU_ALINDI', timestamp: '2026-10-07 08:15', actor: 'Vatandaş Portalı' },
      { status: 'EKSIK_BELGE', timestamp: '2026-10-07 09:10', actor: 'Değerlendirme Masası' }
    ]
  },
  {
    id: 'app-4',
    applicationNo: 'AMB-2026-000128',
    createdAt: '2026-10-07 09:30',
    status: 'YONETICI_DEGERLENDIRMESINDE',
    triaj: 'kirmizi',
    applicant: {
      fullName: 'Şükran Demirci',
      tckn: '67890123456',
      phone: '0535 222 33 44',
      email: 'sukran.demirci@email.com',
      relationship: 'ES'
    },
    patient: {
      fullName: 'Hüseyin Demirci',
      tckn: '78901234567',
      birthDate: '1948-11-25',
      age: 78,
      gender: 'ERKEK',
      phone: '0535 222 33 44',
      mernisVerified: true,
      activeDuplicateCheckPass: true
    },
    pickupAddress: {
      district: 'Bakırköy',
      neighborhood: 'Yeşilköy Mah.',
      street: 'İstasyon Cad.',
      buildingNo: '24 / D:2',
      floorInfo: 'Giriş Kat',
      fullAddress: 'Yeşilköy Mah. İstasyon Cad. No:24 D:2 Bakırköy / İstanbul',
      buildingAccess: {
        floor: 0,
        hasElevator: false,
        stairAccessible: true,
        ambulanceStreetAccessible: true
      }
    },
    healthProfile: {
      diagnosis: 'Son Dönem Böbrek Yetmezliği (SDBY), Haftada 3 Gün Diyaliz',
      transferReason: 'Rutin Hemodiyaliz Seansı',
      mobilityStatus: 'YATAGA_BAGIMLI',
      needsOxygen: true,
      oxygenFlowLpm: 2.0,
      portableOxygenRequired: true,
      hasTracheostomy: false,
      hasPeg: true,
      hasCatheter: true,
      hasIvSerum: false,
      isContagious: false,
      isConscious: true,
      companionRequired: true,
      patientWeightKg: 75,
      medicalStaffRequired: true
    },
    destination: {
      hospitalName: 'Cerrahpaşa Tıp Fakültesi Hastanesi',
      hospitalType: 'Universite',
      department: 'Nefroloji & Diyaliz Merkezi',
      doctorName: 'Doç. Dr. Ozan Şen',
      appointmentDate: '2026-10-07',
      appointmentTime: '13:30',
      mustBeThereMinutesBefore: 30,
      calculatedPickupTime: '12:10',
      estimatedTravelMinutes: 35,
      estimatedLoadingMinutes: 15,
      safetyBufferMinutes: 10,
      isRoundTrip: true,
      returnTime: '17:30'
    },
    documents: [
      { id: 'doc-8', type: 'KIMLIK', name: 'Kimlik.pdf', fileSize: '1.0 MB', uploadedAt: '2026-10-07 09:32', status: 'PENDING' },
      { id: 'doc-9', type: 'SAGLIK_RAPORU', name: 'Diyaliz_Raporu.pdf', fileSize: '3.1 MB', uploadedAt: '2026-10-07 09:33', status: 'PENDING' }
    ],
    history: [
      { status: 'BASVURU_ALINDI', timestamp: '2026-10-07 09:30', actor: 'Vatandaş Portalı' },
      { status: 'YONETICI_DEGERLENDIRMESINDE', timestamp: '2026-10-07 09:40', actor: 'Sistem' }
    ]
  }
]

export const TODAY_ISO = '2026-10-07'
export const TOMORROW_ISO = '2026-10-08'

export const INITIAL_OPERATIONS: OperationTask[] = [
  {
    id: 'op-1',
    trackingNo: 'AMB-2026-000125',
    applicationId: 'app-1',
    patientName: 'Ali Kemal Yıldırım (74 Yaş)',
    patientTckn: '12456789012',
    patientPhone: '0532 444 11 22',
    pickupDistrict: 'Zuhuratbaba Mah.',
    pickupAddress: 'İncirli Cad. No:48 D:6',
    pickupFloorNotes: '3. Kat (Asansör Var, Sedye Uyumlu)',
    destinationHospital: 'Bakırköy Dr. Sadi Konuk EAH',
    destinationDepartment: 'Kardiyoloji Polikliniği 3',
    appointmentTime: '10:00',
    scheduledPickupTime: '08:35',
    scheduledDate: TODAY_ISO,
    ambulancePlate: '34 BKR 112',
    ambulanceId: 'veh-1',
    crewId: 'crew-1',
    step: 'YOLA_CIKTI',
    isRoundTrip: true,
    returnTime: '12:30',
    delayMinutes: 0,
    triaj: 'kirmizi',
    mobility: 'SEDYE',
    needsOxygen: true,
    specialNotes: 'Hastaya 3.5 L/dk O2 desteği sağlanacak, sedye asansöre tam sığıyor.'
  },
  {
    id: 'op-2',
    trackingNo: 'AMB-2026-000126',
    applicationId: 'app-2',
    patientName: 'Fatma Gökçe Kaya (65 Yaş)',
    patientTckn: '34567890123',
    patientPhone: '0555 444 33 22',
    pickupDistrict: 'Kartaltepe Mah.',
    pickupAddress: 'Liman Cad. No:12 D:3',
    pickupFloorNotes: '1. Kat (Asansör Yok, Geniş Merdiven)',
    destinationHospital: 'İstanbul FTR EAH',
    destinationDepartment: 'FTR Polikliniği 2',
    appointmentTime: '11:15',
    scheduledPickupTime: '10:05',
    scheduledDate: TODAY_ISO,
    ambulancePlate: '34 BKR 113',
    ambulanceId: 'veh-2',
    crewId: 'crew-2',
    step: 'HASTANEYE_GIDILIYOR',
    isRoundTrip: true,
    returnTime: '13:00',
    delayMinutes: 5,
    delayAlert: 'Trafik yoğunluğu nedeniyle tahmini varış 10:55 (Randevuya yetişiyor)',
    triaj: 'sari',
    mobility: 'TEKERLEKLI_SANDALYE',
    needsOxygen: false,
    specialNotes: 'Tekerlekli sandalye rampası kullanılacak.'
  },
  {
    id: 'op-3',
    trackingNo: 'AMB-2026-000119',
    applicationId: 'app-old-1',
    patientName: 'Kemal Sunal Öz (81 Yaş)',
    patientTckn: '45678912305',
    patientPhone: '0533 999 88 11',
    pickupDistrict: 'Osmaniye Mah.',
    pickupAddress: 'Fildamı Sok. No:5 D:4',
    pickupFloorNotes: 'Zemin Kat',
    destinationHospital: 'Haseki EAH Sultangazi Ek Bina',
    destinationDepartment: 'Göz Kliniği',
    appointmentTime: '08:30',
    scheduledPickupTime: '07:30',
    scheduledDate: TODAY_ISO,
    ambulancePlate: '34 BKR 112',
    ambulanceId: 'veh-1',
    crewId: 'crew-1',
    step: 'OPERASYON_TAMAMLANDI',
    isRoundTrip: false,
    delayMinutes: 0,
    triaj: 'yesil',
    mobility: 'AYAKTA',
    needsOxygen: false,
    completedAt: '09:15'
  },
  {
    id: 'op-4',
    trackingNo: 'AMB-2026-000128',
    applicationId: 'app-4',
    patientName: 'Hüseyin Demirci (78 Yaş)',
    patientTckn: '78901234567',
    patientPhone: '0535 222 33 44',
    pickupDistrict: 'Yeşilköy Mah.',
    pickupAddress: 'İstasyon Cad. No:24 D:2',
    pickupFloorNotes: 'Giriş Kat, Asansör Yok',
    destinationHospital: 'Cerrahpaşa Tıp Fakültesi Hastanesi',
    destinationDepartment: 'Nefroloji & Diyaliz Merkezi',
    appointmentTime: '13:30',
    scheduledPickupTime: '12:10',
    scheduledDate: TODAY_ISO,
    ambulancePlate: '',
    ambulanceId: '',
    crewId: '',
    step: 'YOLA_CIKMAYA_HAZIR',
    isRoundTrip: true,
    returnTime: '17:30',
    delayMinutes: 0,
    triaj: 'kirmizi',
    mobility: 'YATAGA_BAGIMLI',
    needsOxygen: true,
    specialNotes: 'Diyaliz seansı nedeniyle ambulans ataması bekleniyor.'
  },
  {
    id: 'op-5',
    trackingNo: 'AMB-2026-000130',
    applicationId: 'app-5',
    patientName: 'Zehra Gündoğan (84 Yaş)',
    patientTckn: '65478912390',
    patientPhone: '0536 111 22 44',
    pickupDistrict: 'Kartaltepe Mah.',
    pickupAddress: 'Dizdariye Sok. No:9 D:2',
    pickupFloorNotes: '2. Kat (Asansör Var)',
    destinationHospital: 'Bakırköy Dr. Sadi Konuk EAH',
    destinationDepartment: 'Genel Cerrahi Polikliniği',
    appointmentTime: '15:00',
    scheduledPickupTime: '14:20',
    scheduledDate: TODAY_ISO,
    ambulancePlate: '',
    ambulanceId: '',
    crewId: '',
    step: 'YOLA_CIKMAYA_HAZIR',
    isRoundTrip: false,
    delayMinutes: 0,
    triaj: 'yesil',
    mobility: 'TEKERLEKLI_SANDALYE',
    needsOxygen: false
  },
  {
    id: 'op-6',
    trackingNo: 'AMB-2026-000131',
    applicationId: 'app-6',
    patientName: 'Canberk Tan (14 Yaş)',
    patientTckn: '56789012345',
    patientPhone: '0538 777 66 55',
    pickupDistrict: 'Ataköy 2-5-6. Kısım',
    pickupAddress: 'Rauf Orbay Cad. A2 Blok D:18',
    pickupFloorNotes: '5. Kat (Çift Asansör)',
    destinationHospital: 'Başakşehir Çam ve Sakura Şehir Hastanesi',
    destinationDepartment: 'Çocuk Sağlık Kurulu / Heyet',
    appointmentTime: '09:30',
    scheduledPickupTime: '07:45',
    scheduledDate: TOMORROW_ISO,
    ambulancePlate: '34 BKR 114',
    ambulanceId: 'veh-3',
    crewId: 'crew-3',
    step: 'YOLA_CIKMAYA_HAZIR',
    isRoundTrip: true,
    returnTime: '12:00',
    delayMinutes: 0,
    triaj: 'sari',
    mobility: 'TEKERLEKLI_SANDALYE',
    needsOxygen: false
  }
]

export const INITIAL_AUDIT_LOGS: AmbulanceAuditLog[] = [
  {
    id: 'aud-1',
    timestamp: '2026-10-07 09:42:15',
    actorName: 'Uzm. Dr. Sinan Aksoy',
    actorRole: 'Sağlık İşleri Müdürü',
    action: 'BAŞVURU_ONAYLANDI',
    targetTrackingNo: 'AMB-2026-000125',
    details: 'Ali Kemal Yıldırım başvurusu ve medikal epikrizi incelendi, sedyeli nakil onaylandı.',
    ipAddress: '192.168.10.45'
  },
  {
    id: 'aud-2',
    timestamp: '2026-10-07 09:10:02',
    actorName: 'Değerlendirme Masası (Hakan)',
    actorRole: 'Operatör',
    action: 'EKSIK_BELGE_TALEBI',
    targetTrackingNo: 'AMB-2026-000127',
    details: 'Sağlık kurulu randevu barkodunun okunamadığı gerekçesiyle vatandaşa bildirim gönderildi.',
    ipAddress: '192.168.10.62'
  },
  {
    id: 'aud-3',
    timestamp: '2026-10-07 08:30:11',
    actorName: 'Mustafa Çelik',
    actorRole: 'Ambulans Şoförü',
    action: 'DURUM_GUNCELLEME_YOLA_CIKTI',
    targetTrackingNo: 'AMB-2026-000125',
    details: '34 BKR 112 aracı hareket etti. GPS: 40.9782, 28.8715.',
    ipAddress: '10.24.112.5'
  },
  {
    id: 'aud-4',
    timestamp: '2026-10-06 23:00:00',
    actorName: 'Otomatik Dağıtım Motoru',
    actorRole: 'Sistem Algoritması',
    action: 'GUNLUK_AJANDA_OPTIMIZASYONU',
    targetTrackingNo: 'TÜM_FILO',
    details: '14 adet randevu 3 aktif araca adil görev yükü puanı kriteriyle otomatik paylaştırıldı.',
    ipAddress: '127.0.0.1'
  }
]
