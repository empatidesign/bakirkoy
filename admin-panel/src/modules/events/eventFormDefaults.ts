import type {
  Event, EventFormData, EventImageSet, EventImageRatio, EventImageRatios, EventAudienceFee, EventSiblingDiscount,
} from '@/types/event.types'
import type { EventSettings, ImageSpec } from '@/types/eventSettings.types'
import { residencyModeFromFlags } from '@/lib/residency'

export const WEEK_DAYS: { key: string; label: string; short: string }[] = [
  { key: 'monday', label: 'Pazartesi', short: 'Pzt' },
  { key: 'tuesday', label: 'Salı', short: 'Sal' },
  { key: 'wednesday', label: 'Çarşamba', short: 'Çar' },
  { key: 'thursday', label: 'Perşembe', short: 'Per' },
  { key: 'friday', label: 'Cuma', short: 'Cum' },
  { key: 'saturday', label: 'Cumartesi', short: 'Cmt' },
  { key: 'sunday', label: 'Pazar', short: 'Paz' },
]

export const RATIO_SPECS: Record<EventImageRatio, { width: number; height: number; maxSizeKb: number }> = {
  '16:9': { width: 1920, height: 1080, maxSizeKb: 800 },
  '4:3': { width: 1200, height: 900, maxSizeKb: 400 },
  '1:1': { width: 900, height: 900, maxSizeKb: 300 },
  '9:16': { width: 1080, height: 1920, maxSizeKb: 600 },
}

export const RATIO_LABELS: Record<EventImageRatio, string> = {
  '16:9': '16:9 — Geniş (web kapak)',
  '4:3': '4:3 — Yatay (kart)',
  '1:1': '1:1 — Kare (liste/küçük)',
  '9:16': '9:16 — Dikey (mobil/story)',
}

export const EVENT_IMAGE_RATIOS: EventImageRatio[] = ['16:9', '4:3', '9:16']

export const LEGACY_EVENT_IMAGE_RATIOS: EventImageRatio[] = ['1:1']

const emptyRatios = (): EventImageRatios => ({
  '16:9': { ...RATIO_SPECS['16:9'] },
  '4:3': { ...RATIO_SPECS['4:3'] },
  '1:1': { ...RATIO_SPECS['1:1'] },
  '9:16': { ...RATIO_SPECS['9:16'] },
})

export const IMAGE_SPECS = {
  webCover: { width: 1920, height: 720, maxSizeKb: 800 },
  webCard: { width: 600, height: 400, maxSizeKb: 200 },
  webThumb: { width: 240, height: 240, maxSizeKb: 80 },
  mobileCover: { width: 1080, height: 1350, maxSizeKb: 600 },
  mobileCard: { width: 750, height: 750, maxSizeKb: 250 },
  mobileThumb: { width: 320, height: 320, maxSizeKb: 100 },
}

export const emptyImageSet = (): EventImageSet => ({
  web: {
    cover: { ...IMAGE_SPECS.webCover },
    card: { ...IMAGE_SPECS.webCard },
    thumb: { ...IMAGE_SPECS.webThumb },
  },
  mobile: {
    cover: { ...IMAGE_SPECS.mobileCover },
    card: { ...IMAGE_SPECS.mobileCard },
    thumb: { ...IMAGE_SPECS.mobileThumb },
  },
  ratios: emptyRatios(),
  photos: [],
})

export const normalizeImages = (img: EventImageSet): EventImageSet => {
  const empty = emptyImageSet()
  const web = img?.web ?? empty.web
  const mobile = img?.mobile ?? empty.mobile
  const ratios = img?.ratios ?? empty.ratios
  return {
    web: { cover: web.cover ?? empty.web.cover, card: web.card ?? empty.web.card, thumb: web.thumb ?? empty.web.thumb },
    mobile: { cover: mobile.cover ?? empty.mobile.cover, card: mobile.card ?? empty.mobile.card, thumb: mobile.thumb ?? empty.mobile.thumb },
    ratios: {
      '16:9': ratios['16:9'] ?? empty.ratios['16:9'],
      '4:3': ratios['4:3'] ?? empty.ratios['4:3'],
      '1:1': ratios['1:1'] ?? empty.ratios['1:1'],
      '9:16': ratios['9:16'] ?? empty.ratios['9:16'],
    },
    photos: Array.isArray(img?.photos) ? img.photos : [],
  }
}

export const DEFAULT_AUDIENCES: EventAudienceFee[] = [
  { key: 'adult', label: 'Yetişkin', enabled: true, price: 0 },
  { key: 'student', label: 'Öğrenci', enabled: true, price: 0 },
  { key: 'child', label: 'Çocuk', enabled: false, price: 0 },
  { key: 'senior', label: '65+ Yaş', enabled: false, price: 0 },
]

export const DEFAULT_SIBLING_DISCOUNTS: EventSiblingDiscount[] = [
  { order: 2, label: '2. Kardeş', percent: 10 },
  { order: 3, label: '3. ve sonrası', percent: 20 },
]

const imageSetFromSettings = (img: EventSettings['images']): EventImageSet => {
  const spec = (s: ImageSpec) => ({ width: s.width, height: s.height, maxSizeKb: s.maxSizeKb })
  return {
    web: { cover: spec(img.web.cover), card: spec(img.web.card), thumb: spec(img.web.thumb) },
    mobile: { cover: spec(img.mobile.cover), card: spec(img.mobile.card), thumb: spec(img.mobile.thumb) },
    ratios: emptyRatios(),
    photos: [],
  }
}

export const emptyEventForm = (settings?: EventSettings): EventFormData => ({
  name: '',
  categoryId: '',
  venueType: 'indoor',
  facilityId: '',
  hallId: '',
  location: { name: '', latitude: undefined, longitude: undefined },
  startDate: '',
  endDate: '',
  isSingleDay: true,
  startTime: '',
  endTime: '',
  applicationStartDate: '',
  applicationEndDate: '',
  gender: 'mixed',
  capacity: 0,
  reserveCapacity: 0,
  minAge: settings?.general.minAge ?? 0,
  maxAge: settings?.general.maxAge ?? 0,
  participationPeriod: settings?.participation.defaultLimitPeriod ?? 'none',
  participationLimit: settings?.participation.defaultLimitCount ?? 0,
  description: '',
  internalNote: '',
  images: settings ? imageSetFromSettings(settings.images) : emptyImageSet(),
  access: {
    hasSessions: false,
    hasSeating: false,
    reservationType: 'none',
    registrationMode: settings?.general.requireApproval === false ? 'none' : 'required',
    attendanceEnabled: true,
    entryMethod: settings?.attendance.recordCheckOut ? 'checkin-checkout' : 'checkin',
    qrEnabled: settings?.attendance.qrCheckIn ?? true,
    kioskEnabled: settings?.qr.kioskEnabled ?? false,
    turnstileEnabled: false,
    publicLinkEnabled: false,
    publicLinkRequiresPin: false,
    staffIds: [],
    notificationTemplates: [],
    cancellationDeadlineHours: settings?.general.cancellationDeadlineHours ?? 72,
    geofenceEnabled: false,
    geofenceRadiusMeters: 150,
  },
  pricing: {
    isPaid: false,
    currency: 'TRY',
    audiences: DEFAULT_AUDIENCES.map((a) => ({ ...a })),
    siblingDiscountEnabled: false,
    siblingDiscounts: DEFAULT_SIBLING_DISCOUNTS.map((s) => ({ ...s })),
    municipalityEmployeeDiscountEnabled: false,
    municipalityEmployeePercent: 0,
    disabledDiscountEnabled: false,
    disabledPercent: 0,
    veteranDiscountEnabled: false,
    veteranPercent: 0,
    combineDiscounts: false,
    maxDiscountPercent: 50,
  },
  points: {
    enabled: false,
    basePoints: 0,
    walkInEarnsPoints: false,
  },
  isActive: true,
  residencyMode: 'anyone',
  sultangaziResidentOnly: false,
  responsible: {},
})

export const eventToForm = (e: Event): EventFormData => ({
  name: e.name,
  categoryId: e.categoryId,
  venueType: e.venueType,
  facilityId: e.facilityId ?? '',
  hallId: e.hallId ?? '',
  location: e.location ?? { name: '', latitude: undefined, longitude: undefined },
  startDate: e.startDate,
  endDate: e.endDate,
  isSingleDay: e.startDate === e.endDate,
  startTime: e.startTime ?? '',
  endTime: e.endTime ?? '',
  applicationStartDate: e.applicationStartDate ?? '',
  applicationEndDate: e.applicationEndDate ?? '',
  gender: e.gender,
  capacity: e.capacity,
  reserveCapacity: e.reserveCapacity,
  minAge: e.minAge,
  maxAge: e.maxAge,
  participationPeriod: e.participationPeriod,
  // Aynı düzeltme (bkz. travelFormDefaults.ts): eski/tutarsız veri (period 'none' değilken
  // limit 0) formu sadece başka bir alan için açan admini alakasız bir hatayla engellemesin.
  participationLimit: e.participationPeriod !== 'none' && e.participationLimit < 1 ? 1 : e.participationLimit,
  description: e.description,
  internalNote: e.internalNote,
  images: normalizeImages(e.images),
  access: e.access,
  pricing: e.pricing,
  points: e.points,
  isActive: e.isActive,
  residencyMode: e.residencyMode ?? residencyModeFromFlags(e.sultangaziResidentOnly),
  sultangaziResidentOnly: e.sultangaziResidentOnly,
  responsible: e.responsible ?? {},
})

export const GENDER_OPTIONS = [
  { value: 'mixed', label: 'Karma' },
  { value: 'male', label: 'Erkek' },
  { value: 'female', label: 'Kadın' },
]

export const PARTICIPATION_PERIOD_OPTIONS = [
  { value: 'none', label: 'Sınırsız' },
  { value: 'daily', label: 'Günde' },
  { value: 'weekly', label: 'Haftada' },
  { value: 'monthly', label: 'Ayda' },
  { value: 'yearly', label: 'Yılda' },
]
