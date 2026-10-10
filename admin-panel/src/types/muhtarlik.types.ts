import type { ListParams } from '@/types/common'

type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'


export type SubmissionType = 'request' | 'suggestion' | 'complaint'
export type SubmissionPriority = 'low' | 'normal' | 'high' | 'urgent'
export type SubmissionStatus = 'new' | 'in_review' | 'forwarded' | 'resolved' | 'rejected'
export type SubmissionChannel = 'mobile_app' | 'web' | 'kiosk' | 'call_center' | 'counter' | 'muhtar_panel'
export type SubmissionDateRange = 'all' | 'today' | 'week' | 'month'
export type SubmissionSort = 'newest' | 'oldest' | 'priority' | 'neighborhood'


export interface CitizenSubmission {
  id: string
  trackingNo?: string
  citizenName: string
  citizenPhone: string
  citizenTc: string
  citizenBirthDate?: string
  neighborhood: string
  address: string
  latitude?: number
  longitude?: number
  categoryId: string
  submissionType: SubmissionType
  priority: SubmissionPriority
  notifyMuhtar: boolean
  complaintReason?: string
  title: string
  description: string
  photoCount: number
  status: SubmissionStatus
  submittedAt: string
  submittedVia: SubmissionChannel
  forwardedAt?: string
  resolvedAt?: string
  ulakbelUnit?: string
  ulakbelTrackingNo?: string
  ulakbelForwardState?: string | null
  muhtarName?: string
  muhtarPhone?: string
  isIdentityHidden?: boolean
  mediaUrls?: string[]
  muhtarAccountProvisioned?: boolean
}

export interface MuhtarAssignment {
  neighborhood: string
  accountProvisioned: boolean
  adminUserId: string | null
  fullName: string | null
  email: string | null
  phone: string | null
  isActive: boolean
}

export interface ProvisionMuhtarRequest {
  fullName: string
  phone: string | null
  email: string | null
}

export interface ProvisionMuhtarResult {
  adminUserId: string
  fullName: string
  email: string
  phone: string | null
  neighborhood: string
  accountCreated: boolean
  temporaryPassword: string | null
}

export interface SubmissionMapPoint {
  id: string
  title: string
  neighborhood: string
  latitude: number
  longitude: number
  submissionType: SubmissionType
  priority: SubmissionPriority
  status: SubmissionStatus
  notifyMuhtar: boolean
}

export interface SubmissionSummary {
  total: number
  new: number
  inReview: number
  forwarded: number
  resolved: number
  rejected: number
  urgent: number
  notifyMuhtar: number
}

export interface SubmissionDistributionItem {
  key: string
  label: string
  count: number
}

export interface NeighborhoodBreakdownItem {
  neighborhood: string
  total: number
  complaints: number
  requests: number
  suggestions: number
  urgent: number
  resolved: number
  topCategories: SubmissionDistributionItem[]
}

export interface MuhtarPerformanceItem {
  neighborhood: string
  total: number
  resolvedCount: number
  avgResolutionDays: number
  pendingCount: number
  resolutionRate: number
}

export interface SubmissionHeatmapPoint {
  dayOfWeek: number
  hour: number
  count: number
}

export interface SubmissionReportsSummary {
  avgResolutionDays: number
  resolvedCount: number
  ulakbelForwarded: number
  ulakbelEligible: number
  ulakbelRate: number
  resolutionRate: number
  pending: number
  byCategory: SubmissionDistributionItem[]
  byNeighborhood: SubmissionDistributionItem[]
  byType: SubmissionDistributionItem[]
  byPriority: SubmissionDistributionItem[]
  byStatus: SubmissionDistributionItem[]
  trend: { date: string; count: number }[]
  neighborhoodBreakdown: NeighborhoodBreakdownItem[]
  byChannel: SubmissionDistributionItem[]
  avgForwardHours: number
  trend30d: { date: string; count: number }[]
  muhtarPerformance: MuhtarPerformanceItem[]
  byComplaintReason: SubmissionDistributionItem[]
  heatmap: SubmissionHeatmapPoint[]
  byCategoryComplaint: SubmissionDistributionItem[]
  byCategoryRequest: SubmissionDistributionItem[]
}

export interface SubmissionFilters {
  search: string
  neighborhood: string
  submissionType: string
  categoryId: string
  priority: string
  status: string
  notifyMuhtar: 'all' | 'yes' | 'no'
  dateRange: SubmissionDateRange
  sort: SubmissionSort
}

export interface SubmissionListParams extends ListParams {
  neighborhood?: string
  submissionType?: string
  categoryId?: string
  priority?: string
  status?: string
  notifyMuhtar?: 'all' | 'yes' | 'no'
  dateRange?: SubmissionDateRange
}


export interface ComplaintCategory {
  id: string
  label: string
  ulakbelUnit: string
}

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  { id: 'road', label: 'Bozuk Yol / Asfalt', ulakbelUnit: 'Fen İşleri Müdürlüğü' },
  { id: 'sidewalk', label: 'Kaldırım', ulakbelUnit: 'Fen İşleri Müdürlüğü' },
  { id: 'park_garden', label: 'Park / Bahçe / Yeşil Alan', ulakbelUnit: 'Park ve Bahçeler Müdürlüğü' },
  { id: 'infrastructure', label: 'Alt Yapı (Su / Kanal)', ulakbelUnit: 'İSKİ / Fen İşleri' },
  { id: 'cleaning', label: 'Temizlik / Çöp', ulakbelUnit: 'Temizlik İşleri Müdürlüğü' },
  { id: 'lighting', label: 'Aydınlatma', ulakbelUnit: 'Fen İşleri Müdürlüğü' },
  { id: 'traffic', label: 'Trafik / Levha', ulakbelUnit: 'Ulaşım Hizmetleri Müdürlüğü' },
  { id: 'stray_animal', label: 'Sokak Hayvanları', ulakbelUnit: 'Veteriner İşleri Müdürlüğü' },
  { id: 'noise', label: 'Gürültü / Çevre Kirliliği', ulakbelUnit: 'Çevre Koruma Müdürlüğü' },
  { id: 'building', label: 'Ruhsatsız Yapı / Bina', ulakbelUnit: 'İmar ve Şehircilik Müdürlüğü' },
  { id: 'other', label: 'Diğer', ulakbelUnit: 'Genel Yazı İşleri Müdürlüğü' },
]

export const categoryLabel = (id: string): string =>
  COMPLAINT_CATEGORIES.find((c) => c.id === id)?.label ?? id

export const categoryUlakbelUnit = (id: string): string | undefined =>
  COMPLAINT_CATEGORIES.find((c) => c.id === id)?.ulakbelUnit

export const CATEGORY_OPTIONS = COMPLAINT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))


export const SUBMISSION_TYPE_LABELS: Record<SubmissionType, string> = {
  request: 'Talep',
  suggestion: 'İstek / Öneri',
  complaint: 'Şikayet',
}

export const SUBMISSION_TYPE_TONE: Record<SubmissionType, BadgeTone> = {
  request: 'info',
  suggestion: 'success',
  complaint: 'danger',
}

export const SUBMISSION_TYPE_OPTIONS: { value: SubmissionType; label: string }[] = [
  { value: 'request', label: 'Talep' },
  { value: 'suggestion', label: 'İstek / Öneri' },
  { value: 'complaint', label: 'Şikayet' },
]


export const PRIORITY_LABELS: Record<SubmissionPriority, string> = {
  low: 'Düşük',
  normal: 'Normal',
  high: 'Yüksek',
  urgent: 'Acil',
}

export const PRIORITY_TONE: Record<SubmissionPriority, BadgeTone> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
}

export const PRIORITY_OPTIONS: { value: SubmissionPriority; label: string }[] = [
  { value: 'low', label: 'Düşük' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Yüksek' },
  { value: 'urgent', label: 'Acil' },
]


export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  new: 'Yeni',
  in_review: 'İncelemede',
  forwarded: "Belediyeye İletildi",
  resolved: 'Çözüldü',
  rejected: 'Reddedildi',
}

export const STATUS_TONE: Record<SubmissionStatus, BadgeTone> = {
  new: 'info',
  in_review: 'warning',
  forwarded: 'primary',
  resolved: 'success',
  rejected: 'danger',
}

export const STATUS_OPTIONS: { value: SubmissionStatus; label: string }[] = [
  { value: 'new', label: 'Yeni' },
  { value: 'in_review', label: 'İncelemede' },
  { value: 'forwarded', label: "Belediyeye İletildi" },
  { value: 'resolved', label: 'Çözüldü' },
  { value: 'rejected', label: 'Reddedildi' },
]


export const COMPLAINT_REASON_LABELS: Record<string, string> = {
  public_safety: 'Kamu Güvenliği',
  health_hygiene: 'Sağlık / Hijyen',
  recurring: 'Tekrarlayan Sorun',
  service_quality: 'Hizmet Kalitesi',
  environmental: 'Çevresel Etki',
  noise: 'Gürültü',
  damage: 'Mülk / Eşya Hasarı',
  other: 'Diğer',
}

export const complaintReasonLabel = (id?: string): string | undefined =>
  id ? COMPLAINT_REASON_LABELS[id] ?? id : undefined


export const CHANNEL_LABELS: Record<SubmissionChannel, string> = {
  mobile_app: 'Mobil Uygulama',
  web: 'Web',
  kiosk: 'Kiosk',
  call_center: 'Çağrı Merkezi',
  counter: 'Vezne / Masa',
  muhtar_panel: 'Muhtar Paneli',
}

export const channelLabel = (id: string): string =>
  CHANNEL_LABELS[id as SubmissionChannel] ?? id


export interface CreateSubmissionByMuhtarRequest {
  title: string
  description: string
  categoryId: string
  submissionType: SubmissionType
  priority: SubmissionPriority
  address: string
  latitude?: number | null
  longitude?: number | null
  onBehalfOf?: boolean
  citizenTc?: string
  citizenBirthDate?: string
  citizenPhone?: string
  addressType?: 'residence' | 'other'
  mediaUrls?: string[]
}

export interface MuhtarNviLookupResult {
  tckn: string
  fullName: string
  birthDate: string
  gender: 'Unknown' | 'Male' | 'Female'
  address?: string
  isRegisteredCitizen: boolean
  registeredPhoneMasked?: string
}

export interface MuhtarSubmissionMediaUpload {
  url: string
  objectName: string
  sizeBytes: number
}


export interface MuhtarNeighborhoodStat {
  neighborhood: string
  total: number
  open: number
  resolved: number
  urgent: number
  avgResolutionHours: number
  resolutionRate: number
  topCategories: SubmissionDistributionItem[]
  requestCount: number
  suggestionCount: number
  complaintCount: number
}

export interface MuhtarRecentItem {
  id: string
  trackingNo?: string
  neighborhood: string
  categoryId: string
  categoryLabel: string
  submissionType: SubmissionType
  typeLabel: string
  priority: SubmissionPriority
  status: SubmissionStatus
  statusLabel: string
  scope: string
  addressType: string
  submittedAt: string
  forwardedAt?: string
  resolvedAt?: string
  elapsedHours: number
  slaTargetHours: number
  isOverdue: boolean
  routedUnit?: string
  contentVisible: boolean
  title?: string
  description?: string
  submittedVia: SubmissionChannel
}

export interface MuhtarDashboardTimings {
  avgFirstResponseHours: number
  avgForwardHours: number
  avgResolutionHours: number
  medianResolutionHours: number
  resolutionRate: number
  overdueCount: number
  onTimeResolvedCount: number
  slaComplianceRate: number
}

export interface MuhtarPipelineStage {
  stage: string
  label: string
  count: number
  avgHoursInStage: number
}

export interface MuhtarDashboard {
  neighborhoods: string[]
  totals: {
    total: number
    new: number
    inReview: number
    forwarded: number
    resolved: number
    rejected: number
    urgent: number
    open: number
    last7Days: number
    last30Days: number
    createdByMuhtar: number
  }
  timings: MuhtarDashboardTimings
  topCategories: SubmissionDistributionItem[]
  byType: SubmissionDistributionItem[]
  byStatus: SubmissionDistributionItem[]
  byPriority: SubmissionDistributionItem[]
  byScope: SubmissionDistributionItem[]
  byAddressType: SubmissionDistributionItem[]
  byRoutedUnit: SubmissionDistributionItem[]
  trend30d: { date: string; count: number }[]
  neighborhoodStats: MuhtarNeighborhoodStat[]
  pipeline: MuhtarPipelineStage[]
  recent: MuhtarRecentItem[]
  overdue: MuhtarRecentItem[]
}

