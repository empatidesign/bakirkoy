import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  HeartPulseIcon,
  AmbulanceIcon,
  StethoscopeIcon,
  HomeIcon,
  SearchIcon,
  UserCheckIcon,
  UserPlusIcon,
  PlusIcon,
  ClockIcon,
  DownloadIcon,
  LogInIcon,
  CheckCircle2Icon,
  MessageSquareIcon,
  BanIcon,
  TruckIcon,
  RefreshCwIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Tabs, StatCard, Button, Input, Badge, BulkActions, IconButton, Select, Field, Modal, DataTable, type DataTableColumn } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { AmbulansAdminModule } from '../ambulans/AmbulansAdminModule'
import { ISTANBUL_HOSPITALS } from '../ambulans/hospitalsData'
import { INITIAL_OPERATIONS } from '../ambulans/mockData'
import type { OperationTask } from '../ambulans/types'
import { SmsComposeModal, type SmsRecipient } from './SmsComposeModal'
import { findRegisteredPatient, type RegisteredPatient } from './registeredPatients'

const POLY_SMS_TEMPLATES = [
  { key: 'remind', label: 'Randevu Hatırlatma', text: 'Sayın {AD}, Bakırköy Belediyesi Tıp Merkezi randevunuz bugün. Lütfen 15 dk önce kimliğinizle geliniz.' },
  { key: 'turn', label: 'Sıranız Geldi', text: 'Sayın {AD}, muayene sıranız geldi. Lütfen ilgili poliklinik odasına geliniz.' },
  { key: 'delay', label: 'Gecikme Bilgisi', text: 'Sayın {AD}, hekimimizin yoğunluğu nedeniyle randevunuzda yaklaşık 20 dk gecikme yaşanmaktadır. Anlayışınız için teşekkür ederiz.' },
]

const HOME_SMS_TEMPLATES = [
  { key: 'plan', label: 'Ziyaret Planlandı', text: 'Sayın {AD}, evde sağlık ziyaretiniz planlanmıştır. Ekibimiz belirtilen saat aralığında adresinizde olacaktır. Bakırköy Belediyesi' },
  { key: 'onway', label: 'Ekip Yolda', text: 'Sayın {AD}, evde sağlık ekibimiz yola çıkmıştır. Yaklaşık 20 dk içinde adresinizde olacaktır.' },
  { key: 'done', label: 'Ziyaret Tamamlandı', text: 'Sayın {AD}, bugünkü evde sağlık ziyaretiniz tamamlanmıştır. Geçmiş olsun dileklerimizle. Bakırköy Belediyesi' },
]


export type TriajLevel = 'kirmizi' | 'sari' | 'yesil'

export interface AmbulanceMission {
  id: string
  trackingNo: string
  patientName: string
  tckn: string
  age: number
  phone: string
  companionPhone: string
  triaj: TriajLevel
  mobilityStatus: 'sedye' | 'tekerlekli_sandalye' | 'ayakta'
  medicalNeeds: string[]
  pickupAddress: string
  pickupDistrict: string
  pickupFloorNotes: string
  destinationHospital: string
  destinationUnit: string
  appointmentTime: string
  isRoundTrip: boolean
  assignedAmbulancePlate?: string
  assignedCrew?: {
    driver: string
    paramedic: string
    att?: string
  }
  status: 'PENDING' | 'ASSIGNED' | 'EN_ROUTE' | 'PATIENT_PICKED' | 'HOSPITAL_ARRIVED' | 'COMPLETED' | 'CANCELLED'
  notes?: string
  createdAt: string
}

export interface PolyclinicAppointment {
  id: string
  protocolNo: string
  patientName: string
  tckn: string
  age: number
  phone: string
  department: string
  doctor: string
  roomNo: string
  date: string
  time: string
  complaintSummary: string
  status: 'WAITING' | 'IN_EXAM' | 'COMPLETED' | 'ABSENT' | 'CANCELLED'
  prescriptionNotes?: string
}

export interface HomeHealthVisit {
  id: string
  trackingNo: string
  patientName: string
  tckn: string
  age: number
  phone: string
  district: string
  address: string
  serviceType: 'Pansuman & Yara Bakımı' | 'Enjeksiyon / Serum' | 'Sonda Değişimi' | 'Kan Alma & Tahlil' | 'Fizyoterapi' | 'Yaşlı Özbakım'
  chronicDiseases: string[]
  assignedTeam: string
  visitDate: string
  visitTimeSlot: string
  status: 'PLANNED' | 'VISITING' | 'COMPLETED' | 'CANCELLED'
  nurseNotes?: string
}


const INITIAL_AMBULANCE_MISSIONS: AmbulanceMission[] = [
  {
    id: 'amb-1',
    trackingNo: 'AMB-2026-0041',
    patientName: 'Ali Kemal Yıldırım',
    tckn: '12456789012',
    age: 74,
    phone: '0532 444 11 22',
    companionPhone: '0533 111 22 33 (Oğlu)',
    triaj: 'sari',
    mobilityStatus: 'sedye',
    medicalNeeds: ['Oksijen Konsantratörü Gerekli', 'Vital Monitörizasyon'],
    pickupAddress: 'Zuhuratbaba Mah. Demirkapı Cad. No:18 D:4',
    pickupDistrict: 'Zuhuratbaba',
    pickupFloorNotes: '4. Kat - Geniş Asansör Mevcut',
    destinationHospital: 'Bakırköy Dr. Sadi Konuk E.A.H.',
    destinationUnit: 'Onkoloji ve Kemoterapi Ünitesi',
    appointmentTime: '10:00 (Bugün)',
    isRoundTrip: true,
    assignedAmbulancePlate: '34 BKR 101 (Tip A2)',
    assignedCrew: {
      driver: 'Murat Arslan',
      paramedic: 'Paramedik Gizem Taş',
      att: 'ATT Burak Şahin'
    },
    status: 'EN_ROUTE',
    notes: 'Kemoterapi 4. kür nakli. Sedye ile transfer zorunlu.',
    createdAt: '2026-10-07 08:30'
  },
  {
    id: 'amb-2',
    trackingNo: 'AMB-2026-0042',
    patientName: 'Melahat Şentürk',
    tckn: '23567890123',
    age: 82,
    phone: '0544 555 66 77',
    companionPhone: '0542 999 88 77 (Kızı)',
    triaj: 'kirmizi',
    mobilityStatus: 'sedye',
    medicalNeeds: ['Oksijen Desteği', 'Kalp Damar Geçmişi'],
    pickupAddress: 'Yeşilköy Mah. İstasyon Cad. No:45 D:1',
    pickupDistrict: 'Yeşilköy',
    pickupFloorNotes: 'Zemin Kat - Merdiven Yok',
    destinationHospital: 'Başakşehir Çam ve Sakura Şehir Hastanesi',
    destinationUnit: 'Kardiyoloji Polikliniği',
    appointmentTime: '11:30 (Bugün)',
    isRoundTrip: true,
    status: 'PENDING',
    notes: 'Kalp yetmezliği hastası, nakil için acil ambulans ataması bekleniyor.',
    createdAt: '2026-10-07 08:50'
  },
  {
    id: 'amb-3',
    trackingNo: 'AMB-2026-0043',
    patientName: 'Orhan Gürbüz',
    tckn: '34678901234',
    age: 68,
    phone: '0555 666 77 88',
    companionPhone: '0555 777 88 99 (Eşi)',
    triaj: 'yesil',
    mobilityStatus: 'tekerlekli_sandalye',
    medicalNeeds: ['Tekerlekli Sandalye Lifti'],
    pickupAddress: 'Kartaltepe Mah. Alpay İzer Sok. No:12 D:3',
    pickupDistrict: 'Kartaltepe',
    pickupFloorNotes: '3. Kat - Asansör Yok (Taşıma Brandası Gerekli)',
    destinationHospital: 'Cerrahpaşa Tıp Fakültesi Hastanesi',
    destinationUnit: 'Ortopedi Polikliniği Kontrolü',
    appointmentTime: '14:00 (Bugün)',
    isRoundTrip: false,
    assignedAmbulancePlate: '34 BKR 102 (Tip A1)',
    assignedCrew: {
      driver: 'Serkan Güven',
      paramedic: 'ATT Hasan Çelik'
    },
    status: 'ASSIGNED',
    notes: 'Kalça protezi sonrası rutin 3. ay kontrolü.',
    createdAt: '2026-10-07 09:10'
  },
  {
    id: 'amb-4',
    trackingNo: 'AMB-2026-0040',
    patientName: 'Ayşe Karaca',
    tckn: '45789012345',
    age: 79,
    phone: '0533 222 33 44',
    companionPhone: '0532 888 77 66',
    triaj: 'yesil',
    mobilityStatus: 'sedye',
    medicalNeeds: ['Rutin Nakil'],
    pickupAddress: 'Ataköy 7-8-9-10. Kısım Mah. Çobançeşme No:5',
    pickupDistrict: 'Ataköy',
    pickupFloorNotes: '8. Kat - Sedye Asansörü Var',
    destinationHospital: 'Bakırköy Ruh ve Sinir Hastalıkları E.A.H.',
    destinationUnit: 'Nöroloji Polikliniği',
    appointmentTime: '08:30 (Bugün)',
    isRoundTrip: true,
    assignedAmbulancePlate: '34 BKR 103 (Engelli Liftli)',
    assignedCrew: {
      driver: 'Kemal Varol',
      paramedic: 'Paramedik Selin Kurt'
    },
    status: 'COMPLETED',
    notes: 'Hastanın gidiş-dönüş nakli başarıyla tamamlandı, evine teslim edildi.',
    createdAt: '2026-10-07 07:15'
  }
]

const INITIAL_POLYCLINIC_APPOINTMENTS: PolyclinicAppointment[] = [
  {
    id: 'pol-1',
    protocolNo: 'POL-2026-8801',
    patientName: 'Mehmet Salih Yavuz',
    tckn: '56890123456',
    age: 52,
    phone: '0542 333 44 55',
    department: 'Dahiliye (İç Hastalıkları)',
    doctor: 'Uzm. Dr. Hande Demir',
    roomNo: 'Oda 104',
    date: '2026-10-07',
    time: '10:15',
    complaintSummary: 'Kronik tansiyon yüksekliği, baş ağrısı ve rutin tahlil isteği.',
    status: 'IN_EXAM'
  },
  {
    id: 'pol-2',
    protocolNo: 'POL-2026-8802',
    patientName: 'Zeynep Su Dursun',
    tckn: '67901234567',
    age: 8,
    phone: '0530 111 22 33',
    department: 'Çocuk Sağlığı ve Hastalıkları',
    doctor: 'Uzm. Dr. Levent Çelik',
    roomNo: 'Oda 108',
    date: '2026-10-07',
    time: '10:30',
    complaintSummary: 'Üst solunum yolu enfeksiyonu, ateş ve öksürük.',
    status: 'WAITING'
  },
  {
    id: 'pol-3',
    protocolNo: 'POL-2026-8803',
    patientName: 'Fatma Betül Çetin',
    tckn: '78012345678',
    age: 34,
    phone: '0535 777 88 99',
    department: 'Göz Hastalıkları',
    doctor: 'Op. Dr. Zeynep Arslan',
    roomNo: 'Oda 202',
    date: '2026-10-07',
    time: '10:45',
    complaintSummary: 'Gözde batma, görme bulanıklığı ve gözlük numarası kontrolü.',
    status: 'WAITING'
  },
  {
    id: 'pol-4',
    protocolNo: 'POL-2026-8804',
    patientName: 'Burak Serdar',
    tckn: '89123456789',
    age: 41,
    phone: '0543 999 00 11',
    department: 'Ağız ve Diş Sağlığı',
    doctor: 'Dt. Murat Yücel',
    roomNo: 'Diş Üniti 1',
    date: '2026-10-07',
    time: '09:30',
    complaintSummary: '24 nolu diş dolgu düşmesi ve hassasiyet.',
    status: 'COMPLETED',
    prescriptionNotes: 'Kompozit dolgu yenilendi, gargara ve analjezik reçete edildi.'
  }
]

const INITIAL_HOME_HEALTH_VISITS: HomeHealthVisit[] = [
  {
    id: 'hm-1',
    trackingNo: 'EVD-2026-1101',
    patientName: 'Emine Özdoğan (88 yaş)',
    tckn: '90234567890',
    age: 88,
    phone: '0532 888 12 34',
    district: 'Zuhuratbaba',
    address: 'Akasya Sok. No:8 D:2',
    serviceType: 'Pansuman & Yara Bakımı',
    chronicDiseases: ['Diyabet Tip-2', 'Yatağa Bağımlı Bası Yarası'],
    assignedTeam: 'Mobil Sağlık Ekibi 1 (Hemşire Sevda & ATT Ali)',
    visitDate: '2026-10-07',
    visitTimeSlot: '11:00 - 12:00',
    status: 'PLANNED',
    nurseNotes: 'Sakrum bölgesi evre 2 bası yarası pansumanı yapılacak.'
  },
  {
    id: 'hm-2',
    trackingNo: 'EVD-2026-1102',
    patientName: 'Hüseyin Aksoy (76 yaş)',
    tckn: '01345678901',
    age: 76,
    phone: '0544 333 22 11',
    district: 'Yeşilyurt',
    address: 'Sipahioğlu Cad. No:22 D:5',
    serviceType: 'Sonda Değişimi',
    chronicDiseases: ['Parkinson', 'Üriner Retansiyon'],
    assignedTeam: 'Mobil Sağlık Ekibi 2 (Hemşire Gamze & ATT Burak)',
    visitDate: '2026-10-07',
    visitTimeSlot: '13:00 - 14:00',
    status: 'PLANNED',
    nurseNotes: 'Foley sonda aylık rutin değişimi.'
  },
  {
    id: 'hm-3',
    trackingNo: 'EVD-2026-1103',
    patientName: 'Kadriye Yılmaz (80 yaş)',
    tckn: '12456709876',
    age: 80,
    phone: '0533 555 44 33',
    district: 'Osmaniye',
    address: 'Camii Sok. No:14 D:1',
    serviceType: 'Fizyoterapi',
    chronicDiseases: ['İnme (SVO)', 'Sol Hemipleji'],
    assignedTeam: 'Fizik Tedavi Ekibi (Fzt. Canan & ATT Mert)',
    visitDate: '2026-10-07',
    visitTimeSlot: '09:00 - 10:00',
    status: 'COMPLETED',
    nurseNotes: 'Pasif eklem hareketleri ve yürüme egzersizleri uygulandı. Hasta genel durumu stabil.'
  }
]

type ActiveTab = 'ambulance' | 'polyclinic' | 'homeHealth'

export const SaglikAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'ambulance') as ActiveTab

  const setActiveTab = (tab: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('tab', tab)
      return next
    })
  }

  const [ambulanceMissions, setAmbulanceMissions] = useState<AmbulanceMission[]>(INITIAL_AMBULANCE_MISSIONS)
  const [polyclinicList, setPolyclinicList] = useState<PolyclinicAppointment[]>(INITIAL_POLYCLINIC_APPOINTMENTS)
  const [homeHealthList, setHomeHealthList] = useState<HomeHealthVisit[]>(INITIAL_HOME_HEALTH_VISITS)
  const [operations, setOperations] = useState<OperationTask[]>(INITIAL_OPERATIONS)



  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false)
  const [newRequestType, setNewRequestType] = useState<'ambulance' | 'polyclinic' | 'homeHealth'>('ambulance')

  const [patientMode, setPatientMode] = useState<'EXISTING' | 'NEW'>('EXISTING')
  const [patientSearchQuery, setPatientSearchQuery] = useState('')
  const [foundPatient, setFoundPatient] = useState<RegisteredPatient | null>(null)
  const [patientSearchAttempted, setPatientSearchAttempted] = useState(false)

  const [newPatientName, setNewPatientName] = useState('')
  const [newTckn, setNewTckn] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPickupAddress, setNewPickupAddress] = useState('')
  const [newFloorNotes, setNewFloorNotes] = useState('')
  const [newCompanionInfo, setNewCompanionInfo] = useState('')
  const [newSpecialCaseNote, setNewSpecialCaseNote] = useState('')
  const [newHospital, setNewHospital] = useState('Bakırköy Dr. Sadi Konuk E.A.H.')
  const [newDepartment, setNewDepartment] = useState('Dahiliye (İç Hastalıkları)')
  const [newHomeServiceType, setNewHomeServiceType] = useState<HomeHealthVisit['serviceType']>('Pansuman & Yara Bakımı')

  const handlePatientSearch = () => {
    setPatientSearchAttempted(true)
    const match = findRegisteredPatient(patientSearchQuery)
    setFoundPatient(match)
    if (match) {
      setNewPatientName(match.fullName)
      setNewTckn(match.tckn)
      setNewPhone(match.phone)
      setNewPickupAddress(`${match.neighborhood} ${match.address}`)
      setNewFloorNotes(match.floorNotes)
      toast.success(`Kayıtlı hasta bulundu: ${match.fullName}`)
    } else {
      toast.error('Kayıtlı hasta bulunamadı. "Yeni / Özel Durum Hastası" olarak devam edebilirsiniz.')
    }
  }

  const switchPatientMode = (mode: 'EXISTING' | 'NEW') => {
    setPatientMode(mode)
    setFoundPatient(null)
    setPatientSearchAttempted(false)
    setPatientSearchQuery('')
    setNewPatientName('')
    setNewTckn('')
    setNewPhone('')
    setNewPickupAddress('')
    setNewFloorNotes('')
    setNewCompanionInfo('')
    setNewSpecialCaseNote('')
  }

  const handlePolyclinicStatusChange = (id: string, newStatus: PolyclinicAppointment['status']) => {
    setPolyclinicList(prev =>
      prev.map(p => (p.id === id ? { ...p, status: newStatus } : p))
    )
  }

  const handleHomeHealthStatusChange = (id: string, newStatus: HomeHealthVisit['status']) => {
    setHomeHealthList(prev =>
      prev.map(h => (h.id === id ? { ...h, status: newStatus } : h))
    )
  }

  const [selectedPol, setSelectedPol] = useState<Set<string>>(new Set())
  const [selectedHome, setSelectedHome] = useState<Set<string>>(new Set())
  const [smsTarget, setSmsTarget] = useState<{ type: 'polyclinic' | 'homeHealth'; ids: string[] } | null>(null)
  const [polSearch, setPolSearch] = useState('')
  const [homeSearch, setHomeSearch] = useState('')

  const bulkPolStatus = (status: PolyclinicAppointment['status']) => {
    setPolyclinicList(prev => prev.map(p => (selectedPol.has(p.id) ? { ...p, status } : p)))
    toast.success(`${selectedPol.size} randevu güncellendi.`)
    setSelectedPol(new Set())
  }
  const bulkPolCancel = () => {
    if (!window.confirm(`${selectedPol.size} randevu iptal edilsin mi?`)) return
    bulkPolStatus('CANCELLED')
  }
  const bulkHomeStatus = (status: HomeHealthVisit['status']) => {
    setHomeHealthList(prev => prev.map(h => (selectedHome.has(h.id) ? { ...h, status } : h)))
    toast.success(`${selectedHome.size} ziyaret güncellendi.`)
    setSelectedHome(new Set())
  }
  const bulkHomeCancel = () => {
    if (!window.confirm(`${selectedHome.size} ziyaret iptal edilsin mi?`)) return
    bulkHomeStatus('CANCELLED')
  }

  const openSms = (type: 'polyclinic' | 'homeHealth', ids: string[]) => {
    if (ids.length) setSmsTarget({ type, ids })
  }
  const smsRecipients: SmsRecipient[] = !smsTarget
    ? []
    : smsTarget.type === 'polyclinic'
      ? polyclinicList.filter(p => smsTarget.ids.includes(p.id)).map(p => ({ id: p.id, name: p.patientName, phone: p.phone }))
      : homeHealthList.filter(h => smsTarget.ids.includes(h.id)).map(h => ({ id: h.id, name: h.patientName.replace(/\s*\(.*\)$/, ''), phone: h.phone }))

  const handleCreateNewRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (patientMode === 'EXISTING' && !foundPatient) {
      toast.error('Lütfen önce kayıtlı hastayı T.C. kimlik no veya telefon ile arayıp bulun, ya da "Yeni / Özel Durum Hastası" seçeneğine geçin.')
      return
    }
    if (!newPatientName || !newTckn || !newPhone) {
      alert('Lütfen zorunlu hasta bilgilerini eksiksiz doldurunuz.')
      return
    }

    if (newRequestType === 'ambulance') {
      const trackingNo = `AMB-2026-${Math.floor(1000 + Math.random() * 9000)}`
      const newMission: AmbulanceMission = {
        id: `amb-${Date.now()}`,
        trackingNo,
        patientName: newPatientName,
        tckn: newTckn,
        age: foundPatient?.age ?? 70,
        phone: newPhone,
        companionPhone: newCompanionInfo || newPhone,
        triaj: 'sari',
        mobilityStatus: 'sedye',
        medicalNeeds: patientMode === 'NEW' ? ['Özel Durum Nakli'] : ['Hasta Nakil Ambulansı'],
        pickupAddress: newPickupAddress || 'Bakırköy Merkez',
        pickupDistrict: foundPatient?.district ?? 'Zuhuratbaba',
        pickupFloorNotes: newFloorNotes || 'Bilgi Alınacak',
        destinationHospital: newHospital,
        destinationUnit: 'Poliklinik / Muayene',
        appointmentTime: 'Gün İçi (Acil Sevk)',
        isRoundTrip: true,
        status: 'PENDING',
        notes: patientMode === 'NEW' ? newSpecialCaseNote : undefined,
        createdAt: 'Şimdi'
      }
      setAmbulanceMissions(prev => [newMission, ...prev])

      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const newOperation: OperationTask = {
        id: `op-${Date.now()}`,
        trackingNo,
        applicationId: `app-${Date.now()}`,
        patientName: newPatientName,
        patientTckn: newTckn,
        patientPhone: newPhone,
        pickupDistrict: foundPatient?.district ?? 'Zuhuratbaba',
        pickupAddress: newPickupAddress || 'Bakırköy Merkez',
        pickupFloorNotes: newFloorNotes || undefined,
        destinationHospital: newHospital,
        destinationDepartment: 'Poliklinik / Muayene',
        appointmentTime: 'Gün İçi (Acil Sevk)',
        scheduledPickupTime: 'Belirlenecek',
        scheduledDate: today,
        ambulancePlate: '',
        ambulanceId: '',
        crewId: '',
        step: 'YOLA_CIKMAYA_HAZIR',
        isRoundTrip: true,
        delayMinutes: 0,
        triaj: 'sari',
        mobility: 'SEDYE',
        needsOxygen: false,
        specialNotes: patientMode === 'NEW' ? newSpecialCaseNote : undefined
      }
      setOperations(prev => [newOperation, ...prev])
      alert(`Ambulans nakil görevi sisteme kaydedildi: ${newMission.trackingNo}`)
    } else if (newRequestType === 'polyclinic') {
      const newPol: PolyclinicAppointment = {
        id: `pol-${Date.now()}`,
        protocolNo: `POL-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        patientName: newPatientName,
        tckn: newTckn,
        age: foundPatient?.age ?? 45,
        phone: newPhone,
        department: newDepartment,
        doctor: 'Uzm. Dr. Nöbetçi Hekim',
        roomNo: 'Oda 102',
        date: 'Bugün',
        time: '14:30',
        complaintSummary: patientMode === 'NEW' && newSpecialCaseNote ? newSpecialCaseNote : 'Santral / Danışma üzerinden doğrudan kayıt.',
        status: 'WAITING'
      }
      setPolyclinicList(prev => [newPol, ...prev])
      alert(`Poliklinik randevusu açıldı. Protokol No: ${newPol.protocolNo}`)
    } else {
      const newHome: HomeHealthVisit = {
        id: `hm-${Date.now()}`,
        trackingNo: `EVD-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        patientName: newPatientName,
        tckn: newTckn,
        age: foundPatient?.age ?? 80,
        phone: newPhone,
        district: foundPatient?.district ?? 'Zuhuratbaba',
        address: newPickupAddress || 'Bakırköy',
        serviceType: newHomeServiceType,
        chronicDiseases: foundPatient?.chronicNotes ? [foundPatient.chronicNotes] : ['Evde Bakım İhtiyacı'],
        assignedTeam: 'Mobil Sağlık Ekibi 1',
        visitDate: '2026-10-08',
        visitTimeSlot: '11:00 - 12:00',
        status: 'PLANNED',
        nurseNotes: patientMode === 'NEW' ? newSpecialCaseNote : undefined
      }
      setHomeHealthList(prev => [newHome, ...prev])
      alert(`Evde sağlık ziyareti planlandı: ${newHome.trackingNo}`)
    }

    setIsNewRequestModalOpen(false)
    switchPatientMode('EXISTING')
  }

  const [polPage, setPolPage] = useState(1)
  const [polLimit, setPolLimit] = useState(10)
  const [homePage, setHomePage] = useState(1)
  const [homeLimit, setHomeLimit] = useState(10)

  const filteredPolyclinicList = polyclinicList.filter(p => {
    const q = polSearch.trim().toLocaleLowerCase('tr')
    if (!q) return true
    return p.patientName.toLocaleLowerCase('tr').includes(q)
      || p.protocolNo.toLocaleLowerCase('tr').includes(q)
      || p.department.toLocaleLowerCase('tr').includes(q)
      || p.tckn.includes(q)
  })
  const polTotalPages = Math.max(1, Math.ceil(filteredPolyclinicList.length / polLimit))
  const pagedPolyclinicList = filteredPolyclinicList.slice((polPage - 1) * polLimit, polPage * polLimit)

  const filteredHomeHealthList = homeHealthList.filter(h => {
    const q = homeSearch.trim().toLocaleLowerCase('tr')
    if (!q) return true
    return h.patientName.toLocaleLowerCase('tr').includes(q)
      || h.trackingNo.toLocaleLowerCase('tr').includes(q)
      || h.district.toLocaleLowerCase('tr').includes(q)
      || h.tckn.includes(q)
  })
  const homeTotalPages = Math.max(1, Math.ceil(filteredHomeHealthList.length / homeLimit))
  const pagedHomeHealthList = filteredHomeHealthList.slice((homePage - 1) * homeLimit, homePage * homeLimit)

  const polyclinicColumns: DataTableColumn<PolyclinicAppointment>[] = [
    { key: 'protocolNo', header: 'Protokol No', cell: p => <span className="font-mono font-semibold text-primary">{p.protocolNo}</span> },
    {
      key: 'patient', header: 'Hasta',
      cell: p => (
        <div>
          <div className="font-semibold text-foreground">{p.patientName}</div>
          <div className="text-xs text-foreground-muted">{p.age} yaş · {p.phone}</div>
        </div>
      ),
    },
    {
      key: 'department', header: 'Poliklinik & Hekim',
      cell: p => (
        <div>
          <div className="font-medium text-foreground">{p.department}</div>
          <div className="text-xs text-foreground-muted">{p.doctor}</div>
        </div>
      ),
    },
    { key: 'roomNo', header: 'Oda', cell: p => <span className="font-mono">{p.roomNo}</span> },
    {
      key: 'time', header: 'Saat', sortable: true,
      cell: p => (
        <div>
          <div className="font-mono font-semibold text-foreground">{p.time}</div>
          <div className="text-xs text-foreground-muted">{p.date}</div>
        </div>
      ),
    },
    { key: 'complaintSummary', header: 'Şikayet', cell: p => <span className="max-w-xs text-foreground-muted">{p.complaintSummary}</span> },
    {
      key: 'status', header: 'Durum',
      cell: p => (
        <>
          {p.status === 'WAITING' && <Badge tone="warning" dot>Bekliyor</Badge>}
          {p.status === 'IN_EXAM' && <Badge tone="primary" dot>Muayenede</Badge>}
          {p.status === 'COMPLETED' && <Badge tone="success" dot>Tamamlandı</Badge>}
          {p.status === 'CANCELLED' && <Badge tone="neutral" dot>İptal</Badge>}
        </>
      ),
    },
  ]

  const polyclinicRowActions = (pol: PolyclinicAppointment) => (
    <div className="flex items-center justify-end gap-1.5">
      {pol.status === 'WAITING' && (
        <Button size="sm" variant="primary" onClick={() => handlePolyclinicStatusChange(pol.id, 'IN_EXAM')}>İçeri Al</Button>
      )}
      {pol.status === 'IN_EXAM' && (
        <Button size="sm" variant="outline" onClick={() => handlePolyclinicStatusChange(pol.id, 'COMPLETED')}>Tamamla</Button>
      )}
      <IconButton title="SMS gönder" tone="primary" onClick={() => openSms('polyclinic', [pol.id])}>
        <MessageSquareIcon className="h-4 w-4" />
      </IconButton>
    </div>
  )

  const homeHealthColumns: DataTableColumn<HomeHealthVisit>[] = [
    { key: 'trackingNo', header: 'Ziyaret Kodu', cell: h => <span className="font-mono font-semibold text-success">{h.trackingNo}</span> },
    {
      key: 'patient', header: 'Hasta',
      cell: h => (
        <div>
          <div className="font-semibold text-foreground">{h.patientName}</div>
          <div className="text-xs text-foreground-muted">{h.phone}</div>
        </div>
      ),
    },
    {
      key: 'address', header: 'Adres',
      cell: h => (
        <div className="max-w-[200px]">
          <div className="font-medium text-foreground">{h.district}</div>
          <div className="truncate text-xs text-foreground-muted">{h.address}</div>
        </div>
      ),
    },
    { key: 'serviceType', header: 'Hizmet', cell: h => <Badge tone="success">{h.serviceType}</Badge> },
    {
      key: 'chronicDiseases', header: 'Kronik Durum',
      cell: h => (
        <div className="flex flex-wrap gap-1">
          {h.chronicDiseases.map((cd, i) => <Badge key={i} tone="neutral">{cd}</Badge>)}
        </div>
      ),
    },
    { key: 'assignedTeam', header: 'Mobil Ekip', cell: h => <span className="max-w-[180px]">{h.assignedTeam}</span> },
    {
      key: 'visitTimeSlot', header: 'Zaman', sortable: true,
      cell: h => (
        <div>
          <div className="font-mono font-semibold text-foreground">{h.visitTimeSlot}</div>
          <div className="text-xs text-foreground-muted">{h.visitDate}</div>
        </div>
      ),
    },
    {
      key: 'status', header: 'Durum',
      cell: h => (
        <>
          {h.status === 'PLANNED' && <Badge tone="info" dot>Planlandı</Badge>}
          {h.status === 'VISITING' && <Badge tone="primary" dot>Ekip Adreste</Badge>}
          {h.status === 'COMPLETED' && <Badge tone="success" dot>Ziyaret Edildi</Badge>}
          {h.status === 'CANCELLED' && <Badge tone="neutral" dot>İptal</Badge>}
        </>
      ),
    },
  ]

  const homeHealthRowActions = (item: HomeHealthVisit) => (
    <div className="flex items-center justify-end gap-1.5">
      {(item.status === 'PLANNED' || item.status === 'VISITING') && (
        <Button size="sm" variant="primary" onClick={() => handleHomeHealthStatusChange(item.id, 'COMPLETED')}>Onayla</Button>
      )}
      <IconButton title="SMS gönder" tone="primary" onClick={() => openSms('homeHealth', [item.id])}>
        <MessageSquareIcon className="h-4 w-4" />
      </IconButton>
    </div>
  )

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={HeartPulseIcon}
          title="Sağlık İşleri"
          subtitle="Hasta Nakil Ambulans Sevk, Tıp Merkezi Poliklinikleri ve Evde Sağlık Operasyonları"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => alert('PDF Sevk İcmali ve Günlük Ambulans Seyir Jurnali İndiriliyor...')}
              >
                <DownloadIcon className="w-4 h-4" /> Günlük Sevk Raporu (PDF)
              </Button>
              <Button variant="primary"
                onClick={() => setIsNewRequestModalOpen(true)}
              >
                <PlusIcon className="w-4 h-4" /> Manuel Hasta / Nakil Talebi Aç
              </Button>
            </div>
          }
        />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          tabs={[
            { key: 'ambulance', label: 'Hasta Nakil & Ambulans', icon: AmbulanceIcon, count: ambulanceMissions.length },
            { key: 'polyclinic', label: 'Tıp Merkezi & Poliklinikler', icon: StethoscopeIcon, count: polyclinicList.length },
            { key: 'homeHealth', label: 'Evde Sağlık & Yaşlı Bakım', icon: HomeIcon, count: homeHealthList.length },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          <div className="pilot-stat-grid">
            <StatCard
              size="compact"
              label="Ambulans Sevk Görevi"
              value={`${ambulanceMissions.length} Nakil`}
              icon={AmbulanceIcon}
              accent="danger"
              hint={`${ambulanceMissions.filter(m => m.status === 'EN_ROUTE' || m.status === 'ASSIGNED').length} araç sahada aktif`}
            />
            <StatCard
              size="compact"
              label="Tıp Merkezi Poliklinik"
              value={`${polyclinicList.length} Randevu`}
              icon={StethoscopeIcon}
              accent="blue"
              hint={`${polyclinicList.filter(p => p.status === 'WAITING' || p.status === 'IN_EXAM').length} hasta muayene bekliyor`}
            />
            <StatCard
              size="compact"
              label="Evde Sağlık & Yaşlı Bakım"
              value={`${homeHealthList.length} Hane`}
              icon={HeartPulseIcon}
              accent="green"
              hint="3 mobil hemşire ekibi sahada"
            />
            <StatCard
              size="compact"
              label="Acil / Bekleyen Sevk"
              value={`${ambulanceMissions.filter(m => m.status === 'PENDING').length} Talep`}
              icon={ClockIcon}
              accent="orange"
              hint="Ekip görevlendirmesi bekliyor"
            />
          </div>
      {activeTab === 'ambulance' && (
        <AmbulansAdminModule operations={operations} setOperations={setOperations} />
      )}

      {activeTab === 'polyclinic' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-0 px-4 py-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground-strong">
                <StethoscopeIcon className="h-4 w-4 text-primary" />
                Tıp Merkezi Günlük Poliklinik Takvimi
              </h2>
              <p className="text-xs text-foreground-muted">Portal ve danışmadan alınan hekim randevuları</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BulkActions
                count={selectedPol.size}
                onClear={() => setSelectedPol(new Set())}
                actions={[
                  { key: 'in', label: 'İçeri Al', icon: LogInIcon, onClick: () => bulkPolStatus('IN_EXAM') },
                  { key: 'done', label: 'Tamamla', icon: CheckCircle2Icon, tone: 'success', onClick: () => bulkPolStatus('COMPLETED') },
                  { key: 'sms', label: 'SMS Gönder', icon: MessageSquareIcon, onClick: () => openSms('polyclinic', Array.from(selectedPol)) },
                  { key: 'cancel', label: 'İptal', icon: BanIcon, tone: 'danger', onClick: () => bulkPolCancel() },
                ]}
              />
              <Button variant="outline" size="sm" onClick={() => toast.success('Poliklinik randevu slotları güncellendi.')}>
                <RefreshCwIcon className="h-4 w-4" /> Slotları Yenile
              </Button>
            </div>
          </div>

          <DataTable<PolyclinicAppointment>
            showRowNumbers
            columns={polyclinicColumns}
            rows={pagedPolyclinicList}
            rowKey={p => p.id}
            selectable
            selected={selectedPol}
            onSelectedChange={setSelectedPol}
            searchable
            searchValue={polSearch}
            onSearchChange={v => { setPolSearch(v); setPolPage(1) }}
            searchPlaceholder="Hasta, protokol no veya poliklinik ara..."
            page={polPage}
            limit={polLimit}
            total={filteredPolyclinicList.length}
            totalPages={polTotalPages}
            onPageChange={setPolPage}
            onLimitChange={n => { setPolLimit(n); setPolPage(1) }}
            rowActions={polyclinicRowActions}
          />
        </div>
      )}

      {activeTab === 'homeHealth' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-0 px-4 py-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground-strong">
                <HomeIcon className="h-4 w-4 text-success" />
                Evde Sağlık & Yaşlı Bakım Saha Yönetimi
              </h2>
              <p className="text-xs text-foreground-muted">Pansuman, enjeksiyon, sonda ve fizyoterapi ziyaretleri</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <BulkActions
                count={selectedHome.size}
                onClear={() => setSelectedHome(new Set())}
                actions={[
                  { key: 'approve', label: 'Onayla', icon: CheckCircle2Icon, tone: 'success', onClick: () => bulkHomeStatus('COMPLETED') },
                  { key: 'visit', label: 'Ekip Yola Çıktı', icon: TruckIcon, onClick: () => bulkHomeStatus('VISITING') },
                  { key: 'sms', label: 'SMS Gönder', icon: MessageSquareIcon, onClick: () => openSms('homeHealth', Array.from(selectedHome)) },
                  { key: 'cancel', label: 'İptal', icon: BanIcon, tone: 'danger', onClick: () => bulkHomeCancel() },
                ]}
              />
              <Button variant="outline" size="sm" onClick={() => toast.success('Mobil sağlık tablet rotaları güncellendi.')}>
                <RefreshCwIcon className="h-4 w-4" /> Rotaları Eşitle
              </Button>
            </div>
          </div>

          <DataTable<HomeHealthVisit>
            showRowNumbers
            columns={homeHealthColumns}
            rows={pagedHomeHealthList}
            rowKey={h => h.id}
            selectable
            selected={selectedHome}
            onSelectedChange={setSelectedHome}
            searchable
            searchValue={homeSearch}
            onSearchChange={v => { setHomeSearch(v); setHomePage(1) }}
            searchPlaceholder="Hasta, ziyaret kodu veya mahalle ara..."
            page={homePage}
            limit={homeLimit}
            total={filteredHomeHealthList.length}
            totalPages={homeTotalPages}
            onPageChange={setHomePage}
            onLimitChange={n => { setHomeLimit(n); setHomePage(1) }}
            rowActions={homeHealthRowActions}
          />
        </div>
      )}

      <SmsComposeModal
        open={!!smsTarget}
        onClose={() => setSmsTarget(null)}
        recipients={smsRecipients}
        templates={smsTarget?.type === 'polyclinic' ? POLY_SMS_TEMPLATES : HOME_SMS_TEMPLATES}
        onSent={() => {
          if (smsTarget?.type === 'polyclinic') setSelectedPol(new Set())
          else setSelectedHome(new Set())
        }}
      />

      <Modal
        open={isNewRequestModalOpen}
        onClose={() => { setIsNewRequestModalOpen(false); switchPatientMode('EXISTING') }}
        title="Yeni Sağlık / Ambulans Başvurusu"
        subtitle="Sağlık İşleri Santral & Danışma"
        width={600}
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => { setIsNewRequestModalOpen(false); switchPatientMode('EXISTING') }}>
              İptal
            </Button>
            <Button type="submit" form="saglik-new-request-form" variant="primary">
              Kaydı Sisteme Ekle
            </Button>
          </>
        }
      >
        <form id="saglik-new-request-form" onSubmit={handleCreateNewRequest} className="space-y-4 p-5">
          <Field label="Hizmet Türü">
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setNewRequestType('ambulance')}
                className={`p-2.5 rounded-field border text-center text-xs font-semibold transition-all ${
                  newRequestType === 'ambulance'
                    ? 'border-danger bg-danger-soft text-danger'
                    : 'border-border text-foreground-muted'
                }`}
              >
                🚑 Ambulans Nakil
              </button>
              <button
                type="button"
                onClick={() => setNewRequestType('polyclinic')}
                className={`p-2.5 rounded-field border text-center text-xs font-semibold transition-all ${
                  newRequestType === 'polyclinic'
                    ? 'border-info bg-info-soft text-info'
                    : 'border-border text-foreground-muted'
                }`}
              >
                🩺 Poliklinik Muayene
              </button>
              <button
                type="button"
                onClick={() => setNewRequestType('homeHealth')}
                className={`p-2.5 rounded-field border text-center text-xs font-semibold transition-all ${
                  newRequestType === 'homeHealth'
                    ? 'border-success bg-success-soft text-success'
                    : 'border-border text-foreground-muted'
                }`}
              >
                🏠 Evde Sağlık
              </button>
            </div>
          </Field>

          <Field label="Hasta Kaydı">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => switchPatientMode('EXISTING')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-field border text-center text-xs font-semibold transition-all ${
                  patientMode === 'EXISTING'
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border text-foreground-muted'
                }`}
              >
                <UserCheckIcon className="h-3.5 w-3.5" /> Kayıtlı Hastayı Bul
              </button>
              <button
                type="button"
                onClick={() => switchPatientMode('NEW')}
                className={`flex items-center justify-center gap-1.5 p-2.5 rounded-field border text-center text-xs font-semibold transition-all ${
                  patientMode === 'NEW'
                    ? 'border-warning bg-warning-soft text-warning'
                    : 'border-border text-foreground-muted'
                }`}
              >
                <UserPlusIcon className="h-3.5 w-3.5" /> Yeni / Özel Durum Hastası
              </button>
            </div>
          </Field>

          {patientMode === 'EXISTING' ? (
            <div className="space-y-3 rounded-field border border-border bg-surface-1 p-3">
              <Field label="T.C. Kimlik No, Telefon veya Ad Soyad ile Ara" hint="Daha önce kayıtlı hasta bulunursa tüm bilgileri otomatik doldurulur.">
                <div className="flex gap-2">
                  <Input
                    value={patientSearchQuery}
                    onChange={e => setPatientSearchQuery(e.target.value)}
                    placeholder="Örn: 12456789012 veya 0532 444 11 22"
                    iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePatientSearch() } }}
                  />
                  <Button type="button" variant="outline" onClick={handlePatientSearch}>
                    Ara
                  </Button>
                </div>
              </Field>

              {foundPatient && (
                <div className="rounded-field border border-success/30 bg-success-soft p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-success">
                    <UserCheckIcon className="h-3.5 w-3.5" /> Kayıtlı Hasta Bulundu
                  </div>
                  <div className="text-foreground"><strong>{foundPatient.fullName}</strong> ({foundPatient.age} yaş, {foundPatient.gender})</div>
                  <div className="text-foreground-muted">TC: {foundPatient.tckn} · Tel: {foundPatient.phone}</div>
                  <div className="text-foreground-muted">{foundPatient.neighborhood} {foundPatient.address} — {foundPatient.floorNotes}</div>
                  {foundPatient.chronicNotes && <div className="text-foreground-muted">Not: {foundPatient.chronicNotes}</div>}
                </div>
              )}

              {patientSearchAttempted && !foundPatient && (
                <div className="rounded-field border border-warning/30 bg-warning-soft p-3 text-xs text-warning">
                  Kayıtlı hasta bulunamadı. Devam etmek için "Yeni / Özel Durum Hastası" seçeneğine geçin.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3 rounded-field border border-border bg-surface-1 p-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Hasta Adı Soyadı" required>
                  <Input
                    required
                    value={newPatientName}
                    onChange={e => setNewPatientName(e.target.value)}
                    placeholder="Ad Soyad"
                  />
                </Field>
                <Field label="T.C. Kimlik No" required>
                  <Input
                    required
                    maxLength={11}
                    value={newTckn}
                    onChange={e => setNewTckn(e.target.value)}
                    placeholder="11 haneli TCKN"
                  />
                </Field>
              </div>

              <Field label="İletişim Telefonu" required>
                <Input
                  required
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder="05XX XXX XX XX"
                />
              </Field>

              <Field label="Adres (Mahalle, Cadde, Sokak, No)" required>
                <Input
                  required
                  value={newPickupAddress}
                  onChange={e => setNewPickupAddress(e.target.value)}
                  placeholder="Tam açık adres"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Kat / Asansör Bilgisi">
                  <Input
                    value={newFloorNotes}
                    onChange={e => setNewFloorNotes(e.target.value)}
                    placeholder="Örn: 3. Kat, Asansör Var"
                  />
                </Field>
                <Field label="Yakını / Refakatçi Bilgisi">
                  <Input
                    value={newCompanionInfo}
                    onChange={e => setNewCompanionInfo(e.target.value)}
                    placeholder="Ad Soyad (Yakınlık) - Telefon"
                  />
                </Field>
              </div>

              <Field label="Özel Durum / Genel Bilgi Notu" hint="Randevuya bağlı olmayan özel durumlarda bu alanı kullanın.">
                <Input
                  value={newSpecialCaseNote}
                  onChange={e => setNewSpecialCaseNote(e.target.value)}
                  placeholder="Örn: Kronik hastalık, özel ihtiyaç, nakil gerekçesi..."
                />
              </Field>
            </div>
          )}

          {newRequestType === 'ambulance' && (
            <>
              {patientMode === 'EXISTING' && (
                <Field label="Alınacak Adres (Bakırköy)">
                  <Input
                    value={newPickupAddress}
                    onChange={e => setNewPickupAddress(e.target.value)}
                    placeholder="Mahalle, cadde, sokak, no, kat ve asansör durumu"
                  />
                </Field>
              )}
              <Field label={`Sevk Edilecek Hastane (İstanbul Geneli - ${ISTANBUL_HOSPITALS.length} Merkez)`}>
                <Select
                  value={newHospital}
                  onChange={e => setNewHospital(e.target.value)} className="w-full"
                >
                  <optgroup label="Bakırköy İlçe Hastaneleri (Öncelikli)">
                    {ISTANBUL_HOSPITALS.filter(h => h.district === 'Bakırköy').map(h => (
                      <option key={h.id} value={h.name}>{h.name} (~{h.estimatedMinutesFromBakirkoy} dk)</option>
                    ))}
                  </optgroup>
                  <optgroup label="Şehir ve Eğitim Araştırma Hastaneleri (EAH)">
                    {ISTANBUL_HOSPITALS.filter(h => h.type === 'SEHIR' || h.type === 'EAH').filter(h => h.district !== 'Bakırköy').map(h => (
                      <option key={h.id} value={h.name}>{h.name} ({h.district} - ~{h.estimatedMinutesFromBakirkoy} dk)</option>
                    ))}
                  </optgroup>
                  <optgroup label="Üniversite Tıp Fakültesi Hastaneleri">
                    {ISTANBUL_HOSPITALS.filter(h => h.type === 'UNIVERSITE').map(h => (
                      <option key={h.id} value={h.name}>{h.name} ({h.district} - ~{h.estimatedMinutesFromBakirkoy} dk)</option>
                    ))}
                  </optgroup>
                  <optgroup label="Devlet ve Dal Hastaneleri (FTR / Göğüs / Ruh)">
                    {ISTANBUL_HOSPITALS.filter(h => h.type === 'DEVLET' || h.type === 'DAL').filter(h => h.district !== 'Bakırköy').map(h => (
                      <option key={h.id} value={h.name}>{h.name} ({h.district})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Özel Sağlık Grupları ve Hastaneler">
                    {ISTANBUL_HOSPITALS.filter(h => h.type === 'OZEL').filter(h => h.district !== 'Bakırköy').map(h => (
                      <option key={h.id} value={h.name}>{h.name} ({h.district})</option>
                    ))}
                  </optgroup>
                </Select>
              </Field>
            </>
          )}

          {newRequestType === 'polyclinic' && (
            <Field label="Muayene Olunacak Poliklinik">
              <Select
                value={newDepartment}
                onChange={e => setNewDepartment(e.target.value)} className="w-full"
              >
                <option value="Dahiliye (İç Hastalıkları)">Dahiliye (İç Hastalıkları)</option>
                <option value="Çocuk Sağlığı ve Hastalıkları">Çocuk Sağlığı ve Hastalıkları</option>
                <option value="Göz Hastalıkları">Göz Hastalıkları</option>
                <option value="Ağız ve Diş Sağlığı">Ağız ve Diş Sağlığı</option>
                <option value="Kadın Hastalıkları ve Doğum">Kadın Hastalıkları ve Doğum</option>
                <option value="Fizik Tedavi ve Rehabilitasyon">Fizik Tedavi ve Rehabilitasyon</option>
              </Select>
            </Field>
          )}

          {newRequestType === 'homeHealth' && (
            <>
              {patientMode === 'EXISTING' && (
                <Field label="Hasta Adresi (Bakırköy)">
                  <Input
                    value={newPickupAddress}
                    onChange={e => setNewPickupAddress(e.target.value)}
                    placeholder="Ev adresi"
                  />
                </Field>
              )}
              <Field label="İstenen Evde Sağlık Hizmeti">
                <Select
                  value={newHomeServiceType}
                  onChange={e => setNewHomeServiceType(e.target.value as HomeHealthVisit['serviceType'])} className="w-full"
                >
                  <option value="Pansuman & Yara Bakımı">Pansuman & Yara Bakımı</option>
                  <option value="Enjeksiyon / Serum">Enjeksiyon / Serum</option>
                  <option value="Sonda Değişimi">Sonda Değişimi</option>
                  <option value="Kan Alma & Tahlil">Kan Alma & Tahlil</option>
                  <option value="Fizyoterapi">Fizyoterapi</option>
                  <option value="Yaşlı Özbakım">Yaşlı Özbakım</option>
                </Select>
              </Field>
            </>
          )}
        </form>
      </Modal>
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
