import type { LucideIcon } from 'lucide-react'
import {
  DumbbellIcon, PaletteIcon, WavesIcon, TentTreeIcon,
  CompassIcon, FlaskConicalIcon, AccessibilityIcon, HeartHandshakeIcon,
} from 'lucide-react'

export type FacilityModuleId =
  | 'sports' | 'kasif_cocuk' | 'pool' | 'youth_camp'
  | 'scout_camp' | 'science_center' | 'accessible' | 'women_family'

export type FacilityKind = 'indoor' | 'outdoor' | 'mixed'
export type GenderDefault = 'male' | 'female' | 'mixed'
export type StatAccent = 'blue' | 'green' | 'orange' | 'violet' | 'pink' | 'primary'

export interface FacilityTerminology {
  facilitySingular: string
  facilityPlural: string
  facilityManagementTitle: string
  branchSingular: string
  branchPlural: string
  groupSingular: string
  groupPlural: string
  instructorSingular: string
  instructorPlural: string
  participantSingular: string
  participantPlural: string
}

export interface BranchTemplate {
  id: string
  name: string
  category?: string
  minAge?: number
  maxAge?: number
}

export interface FacilityModuleConfig {
  id: FacilityModuleId
  routeId: string
  basePath: string
  icon: LucideIcon
  accent: StatAccent
  headerGradient: string
  pageTitle: string
  pageSubtitle: string
  terminology: FacilityTerminology
  defaultFacilityKind: FacilityKind
  defaultGender: GenderDefault
  defaultAgeRange: { min: number; max: number }
  supportsSections: boolean
  sectionSingular?: string
  sectionPlural?: string
  branchTemplates: BranchTemplate[]
  hideViewToggle?: boolean
}

export const FACILITY_MODULES: Record<FacilityModuleId, FacilityModuleConfig> = {
  sports: {
    id: 'sports',
    routeId: 'sports',
    basePath: '/sports',
    icon: DumbbellIcon,
    accent: 'blue',
    headerGradient: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 40%, #f97316 100%)',
    pageTitle: 'Spor Salonu Yönetimi',
    pageSubtitle: 'Spor salonlarını, branşları, antrenörleri ve grupları yönetin',
    terminology: {
      facilitySingular: 'Spor Salonu',
      facilityPlural: 'Spor Salonları',
      facilityManagementTitle: 'Spor Salonu Yönetimi',
      branchSingular: 'Branş',
      branchPlural: 'Branşlar',
      groupSingular: 'Grup',
      groupPlural: 'Gruplar',
      instructorSingular: 'Antrenör',
      instructorPlural: 'Antrenörler',
      participantSingular: 'Sporcu',
      participantPlural: 'Sporcular',
    },
    defaultFacilityKind: 'indoor',
    defaultGender: 'mixed',
    defaultAgeRange: { min: 8, max: 65 },
    supportsSections: false,
    branchTemplates: [
      { id: 'futbol', name: 'Futbol', category: 'Takım Sporları', minAge: 8, maxAge: 65 },
      { id: 'basketbol', name: 'Basketbol', category: 'Takım Sporları', minAge: 8, maxAge: 65 },
      { id: 'voleybol', name: 'Voleybol', category: 'Takım Sporları', minAge: 8, maxAge: 65 },
      { id: 'yuzme', name: 'Yüzme', category: 'Bireysel', minAge: 5, maxAge: 80 },
      { id: 'fitness', name: 'Fitness', category: 'Kondisyon', minAge: 16, maxAge: 80 },
    ],
  },

  kasif_cocuk: {
    id: 'kasif_cocuk',
    routeId: 'kasif',
    basePath: '/kasif',
    icon: PaletteIcon,
    accent: 'green',
    headerGradient: 'linear-gradient(135deg, #78350f 0%, #d97706 40%, #fbbf24 100%)',
    pageTitle: 'Kaşif Çocuk Yönetimi',
    pageSubtitle: 'Çocuk atölye merkezlerini, dersleri ve grupları yönetin',
    terminology: {
      facilitySingular: 'Atölye Merkezi',
      facilityPlural: 'Atölye Merkezleri',
      facilityManagementTitle: 'Kaşif Çocuk Merkezleri Yönetimi',
      branchSingular: 'Ders',
      branchPlural: 'Dersler',
      groupSingular: 'Atölye Grubu',
      groupPlural: 'Atölye Grupları',
      instructorSingular: 'Atölye Öğretmeni',
      instructorPlural: 'Atölye Öğretmenleri',
      participantSingular: 'Kaşif',
      participantPlural: 'Kaşifler',
    },
    defaultFacilityKind: 'indoor',
    defaultGender: 'mixed',
    defaultAgeRange: { min: 6, max: 12 },
    supportsSections: false,
    branchTemplates: [
      { id: 'robot', name: 'Robot Atölyesi', category: 'Teknoloji', minAge: 8, maxAge: 14 },
      { id: 'kod', name: 'Kod Atölyesi', category: 'Teknoloji', minAge: 7, maxAge: 13 },
      { id: 'resim', name: 'Resim ve Sanat Atölyesi', category: 'Sanat', minAge: 5, maxAge: 12 },
      { id: 'bilim', name: 'Bilim Atölyesi', category: 'Bilim', minAge: 7, maxAge: 13 },
      { id: 'drama', name: 'Drama Atölyesi', category: 'Sanat', minAge: 6, maxAge: 12 },
    ],
  },

  pool: {
    id: 'pool',
    routeId: 'pool',
    basePath: '/pool',
    icon: WavesIcon,
    accent: 'blue',
    headerGradient: 'linear-gradient(135deg, #164e63 0%, #0891b2 40%, #06b6d4 100%)',
    pageTitle: 'Havuz Yönetimi',
    pageSubtitle: 'Havuz tesislerini, seans türlerini, eğitmenleri ve grupları yönetin',
    terminology: {
      facilitySingular: 'Havuz Tesisi',
      facilityPlural: 'Havuz Tesisleri',
      facilityManagementTitle: 'Havuz Tesisi Yönetimi',
      branchSingular: 'Seans Türü',
      branchPlural: 'Seans Türleri',
      groupSingular: 'Grup',
      groupPlural: 'Gruplar',
      instructorSingular: 'Yüzme Eğitmeni',
      instructorPlural: 'Yüzme Eğitmenleri',
      participantSingular: 'Yüzücü',
      participantPlural: 'Yüzücüler',
    },
    defaultFacilityKind: 'mixed',
    defaultGender: 'mixed',
    defaultAgeRange: { min: 8, max: 80 },
    supportsSections: true,
    sectionSingular: 'Havuz',
    sectionPlural: 'Havuzlar',
    branchTemplates: [
      { id: 'baslangic', name: 'Yüzme - Başlangıç', category: 'Beceri', minAge: 5, maxAge: 80 },
      { id: 'orta', name: 'Yüzme - Orta Seviye', category: 'Beceri', minAge: 7, maxAge: 80 },
      { id: 'aqua', name: 'Aqua Fitness', category: 'Kondisyon', minAge: 16, maxAge: 80 },
      { id: 'bebek', name: 'Bebek Yüzme', category: 'Çocuk', minAge: 1, maxAge: 4 },
    ],
  },

  youth_camp: {
    id: 'youth_camp',
    routeId: 'youth-camp',
    basePath: '/youth-camp',
    icon: TentTreeIcon,
    accent: 'orange',
    headerGradient: 'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 40%, #3b82f6 100%)',
    pageTitle: 'Gençlik Kampı Yönetimi',
    pageSubtitle: 'Kamp alanlarını, aktivite türlerini, liderleri ve grupları yönetin',
    terminology: {
      facilitySingular: 'Kamp Alanı',
      facilityPlural: 'Kamp Alanları',
      facilityManagementTitle: 'Gençlik Kampı Alan Yönetimi',
      branchSingular: 'Aktivite Türü',
      branchPlural: 'Aktivite Türleri',
      groupSingular: 'Kamp Grubu',
      groupPlural: 'Kamp Grupları',
      instructorSingular: 'Kamp Lideri',
      instructorPlural: 'Kamp Liderleri',
      participantSingular: 'Kampçı',
      participantPlural: 'Kampçılar',
    },
    defaultFacilityKind: 'outdoor',
    defaultGender: 'mixed',
    defaultAgeRange: { min: 13, max: 25 },
    supportsSections: true,
    sectionSingular: 'Bölge',
    sectionPlural: 'Bölgeler',
    branchTemplates: [
      { id: 'doga', name: 'Doğa Sporları', category: 'Spor', minAge: 14, maxAge: 25 },
      { id: 'liderlik', name: 'Liderlik & Kişisel Gelişim', category: 'Eğitim', minAge: 15, maxAge: 25 },
      { id: 'oryantiring', name: 'Oryantiring', category: 'Spor', minAge: 14, maxAge: 25 },
      { id: 'kamp-atesi', name: 'Kamp Ateşi Etkinlikleri', category: 'Sosyal', minAge: 13, maxAge: 25 },
    ],
  },

  scout_camp: {
    id: 'scout_camp',
    routeId: 'scout-camp',
    basePath: '/scout-camp',
    icon: CompassIcon,
    accent: 'orange',
    headerGradient: 'linear-gradient(135deg, #451a03 0%, #92400e 40%, #b45309 100%)',
    pageTitle: 'İzcilik Kampı Yönetimi',
    pageSubtitle: 'İzcilik kamp alanlarını, eğitim modüllerini ve izci liderlerini yönetin',
    terminology: {
      facilitySingular: 'Kamp Alanı',
      facilityPlural: 'Kamp Alanları',
      facilityManagementTitle: 'İzcilik Kampı Yönetimi',
      branchSingular: 'Modül Türü',
      branchPlural: 'Modül Türleri',
      groupSingular: 'İzci Grubu',
      groupPlural: 'İzci Grupları',
      instructorSingular: 'İzci Lideri',
      instructorPlural: 'İzci Liderleri',
      participantSingular: 'İzci',
      participantPlural: 'İzciler',
    },
    defaultFacilityKind: 'outdoor',
    defaultGender: 'mixed',
    defaultAgeRange: { min: 8, max: 18 },
    supportsSections: true,
    sectionSingular: 'Kamp Bölgesi',
    sectionPlural: 'Kamp Bölgeleri',
    branchTemplates: [
      { id: 'temel', name: 'Temel İzcilik Bilgisi', category: 'Eğitim', minAge: 8, maxAge: 12 },
      { id: 'kamp-kurma', name: 'Kamp Kurma & Çadır', category: 'Beceri', minAge: 10, maxAge: 18 },
      { id: 'ilk-yardim', name: 'İlk Yardım', category: 'Eğitim', minAge: 10, maxAge: 18 },
      { id: 'harita-pusula', name: 'Harita ve Pusula', category: 'Beceri', minAge: 10, maxAge: 18 },
    ],
  },

  science_center: {
    id: 'science_center',
    routeId: 'science-center',
    basePath: '/science-center',
    icon: FlaskConicalIcon,
    accent: 'violet',
    headerGradient: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 40%, #6366f1 100%)',
    pageTitle: 'Bilim Merkezi Yönetimi',
    pageSubtitle: 'Bilim merkezlerini, bilim atölyelerini, eğitmenleri ve grupları yönetin',
    terminology: {
      facilitySingular: 'Bilim Merkezi',
      facilityPlural: 'Bilim Merkezleri',
      facilityManagementTitle: 'Bilim Merkezi Yönetimi',
      branchSingular: 'Bilim Dalı',
      branchPlural: 'Bilim Dalları',
      groupSingular: 'Atölye Grubu',
      groupPlural: 'Atölye Grupları',
      instructorSingular: 'Bilim Eğitmeni',
      instructorPlural: 'Bilim Eğitmenleri',
      participantSingular: 'Bilim Tutkunu',
      participantPlural: 'Bilim Tutkunları',
    },
    defaultFacilityKind: 'indoor',
    defaultGender: 'mixed',
    defaultAgeRange: { min: 7, max: 18 },
    supportsSections: true,
    sectionSingular: 'Laboratuvar',
    sectionPlural: 'Laboratuvarlar',
    branchTemplates: [
      { id: 'robotik', name: 'Robotik & Kodlama', category: 'Teknoloji', minAge: 8, maxAge: 18 },
      { id: 'kimya', name: 'Kimya Atölyesi', category: 'Bilim', minAge: 10, maxAge: 18 },
      { id: 'astronomi', name: 'Astronomi & Uzay', category: 'Bilim', minAge: 8, maxAge: 18 },
      { id: '3d', name: '3D Yazıcı & Tasarım', category: 'Teknoloji', minAge: 10, maxAge: 18 },
    ],
  },

  accessible: {
    id: 'accessible',
    routeId: 'accessible-life',
    basePath: '/accessible-life',
    icon: AccessibilityIcon,
    accent: 'violet',
    headerGradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 40%, #38bdf8 100%)',
    pageTitle: 'Engelsiz Yaşam Yönetimi',
    pageSubtitle: 'Engelsiz yaşam tesislerini, terapi programlarını ve uzmanları yönetin',
    terminology: {
      facilitySingular: 'Engelsiz Tesisi',
      facilityPlural: 'Engelsiz Tesisleri',
      facilityManagementTitle: 'Engelsiz Tesisi Yönetimi',
      branchSingular: 'Terapi Dalı',
      branchPlural: 'Terapi Dalları',
      groupSingular: 'Grup',
      groupPlural: 'Gruplar',
      instructorSingular: 'Uzman',
      instructorPlural: 'Uzmanlar',
      participantSingular: 'Katılımcı',
      participantPlural: 'Katılımcılar',
    },
    defaultFacilityKind: 'indoor',
    defaultGender: 'mixed',
    defaultAgeRange: { min: 3, max: 65 },
    supportsSections: false,
    branchTemplates: [
      { id: 'ergoterapi', name: 'Ergoterapi', category: 'Terapi', minAge: 3, maxAge: 65 },
      { id: 'konusma', name: 'Konuşma Terapisi', category: 'Terapi', minAge: 2, maxAge: 80 },
      { id: 'duyu', name: 'Duyu Bütünleme', category: 'Terapi', minAge: 3, maxAge: 12 },
      { id: 'ozel-egitim', name: 'Özel Eğitim', category: 'Eğitim', minAge: 6, maxAge: 18 },
    ],
  },

  women_family: {
    id: 'women_family',
    routeId: 'women-family',
    basePath: '/women-family',
    icon: HeartHandshakeIcon,
    accent: 'pink',
    headerGradient: 'linear-gradient(135deg, #831843 0%, #db2777 40%, #f472b6 100%)',
    pageTitle: 'Kadın ve Aile Yönetimi',
    pageSubtitle: 'Kadın ve aile merkezlerini, kursları, eğitmenleri ve grupları yönetin',
    terminology: {
      facilitySingular: 'Kadın ve Aile Merkezi',
      facilityPlural: 'Kadın ve Aile Merkezleri',
      facilityManagementTitle: 'Kadın ve Aile Merkezi Yönetimi',
      branchSingular: 'Program',
      branchPlural: 'Programlar',
      groupSingular: 'Grup',
      groupPlural: 'Gruplar',
      instructorSingular: 'Eğitmen',
      instructorPlural: 'Eğitmenler',
      participantSingular: 'Katılımcı',
      participantPlural: 'Katılımcılar',
    },
    defaultFacilityKind: 'indoor',
    defaultGender: 'mixed',
    defaultAgeRange: { min: 18, max: 75 },
    supportsSections: false,
    hideViewToggle: true,
    branchTemplates: [
      { id: 'el-sanatlari', name: 'El Sanatları', category: 'Atölye', minAge: 15, maxAge: 80 },
      { id: 'meslek-edindirme', name: 'Meslek Edindirme Kursu', category: 'Meslek', minAge: 16, maxAge: 65 },
      { id: 'kisisel-gelisim', name: 'Kişisel Gelişim', category: 'Eğitim', minAge: 15, maxAge: 80 },
      { id: 'aile-danismanligi', name: 'Aile Danışmanlığı', category: 'Danışmanlık', minAge: 18, maxAge: 80 },
      { id: 'anne-cocuk', name: 'Anne-Çocuk Atölyesi', category: 'Aile', minAge: 4, maxAge: 12 },
    ],
  },
}

export const getFacilityModuleConfig = (id: FacilityModuleId): FacilityModuleConfig => FACILITY_MODULES[id]
