export type ReportsPreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'

export interface ReportsOverviewParams {
  preset?: ReportsPreset
  from?: string
  to?: string
  module?: string
}

export interface ReportsRange {
  preset: string
  from: string
  to: string
  prevFrom: string
  prevTo: string
}

export interface ReportsKpi {
  key: string
  label: string
  current: number
  previous: number
  deltaPct: number
}

export interface ReportsModuleStat {
  module: string
  label: string
  totalApplications: number
  approved: number
  pending: number
  waitlisted: number
  rejected: number
  uniquePeople: number
  previousTotal: number
  deltaPct: number
}

export interface ReportsTrendPoint {
  date: string
  values: Record<string, number>
  total: number
}

export interface ReportsTopItem {
  module: string
  moduleLabel: string
  name: string
  subLabel?: string | null
  applications: number
  approved: number
  capacity: number
  fillRate: number
  avgRating: number
  reviewCount: number
}

export interface ReportsTopParticipant {
  participantId?: string | null
  fullName: string
  tckn?: string | null
  totalParticipations: number
  moduleBreakdown: Record<string, number>
  lastActivityAt: string
  lastActivityName?: string | null
  lastActivityModuleLabel?: string | null
}

export interface ReportsGenderSlice {
  male: number
  female: number
  unknown: number
}

export interface ReportsAgeBucket {
  bucket: string
  count: number
}

export interface ReportsNationality {
  turkish: number
  foreign: number
  unknown: number
}

export interface ReportsStatusBreakdown {
  status: string
  label: string
  count: number
}

export interface ReportsAttendanceStat {
  module: string
  label: string
  totalSessions: number
  present: number
  absent: number
  late: number
  attendanceRate: number
}

export interface ReportsRating {
  average: number
  distribution: number[]
  totalReviews: number
}

export interface ReportsOverview {
  range: ReportsRange
  kpis: ReportsKpi[]
  modules: ReportsModuleStat[]
  trend: ReportsTrendPoint[]
  topDemand: ReportsTopItem[]
  topRated: ReportsTopItem[]
  topParticipants: ReportsTopParticipant[]
  gender: ReportsGenderSlice
  ageBuckets: ReportsAgeBucket[]
  nationality: ReportsNationality
  statusBreakdown: ReportsStatusBreakdown[]
  attendance: ReportsAttendanceStat[]
  rating: ReportsRating
}

export interface ReportsParticipantActivity {
  module: string
  moduleLabel: string
  itemName: string
  date: string
  status: string
  statusLabel: string
}

export interface ReportsParticipantActivitySummary {
  module: string
  moduleLabel: string
  itemName: string
  count: number
  lastAt: string
  firstAt: string
}

export interface ReportsParticipantDetail {
  participantId?: string | null
  fullName: string
  tckn?: string | null
  phone?: string | null
  totalParticipations: number
  moduleBreakdown: Record<string, number>
  activities: ReportsParticipantActivity[]
  activitySummary: ReportsParticipantActivitySummary[]
}

export const REPORTS_MODULE_LABELS: Record<string, string> = {
  events: 'Etkinlik',
  sports: 'Spor Salonu',
  kasif: 'Kaşif Çocuk',
  pool: 'Havuz',
  'youth-camp': 'Gençlik Kampı',
  'scout-camp': 'İzcilik Kampı',
  'science-center': 'Bilim Merkezi',
  'accessible-life': 'Engelsiz Yaşam',
  'women-family': 'Kadın ve Aile',
  travels: 'Gezi',
  seda: 'SEDA Eğitim',
  library: 'Kütüphane',
  muhtarlik: 'Muhtarlık',
  quiz: 'Bilgi Yarışması',
  survey: 'Anket',
  wheel: 'Hediye Çarkı',
  companies: 'Firma / Kampanya',
}

export type ParticipantActivityPreset = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom'

export interface ParticipantActivityReportParams {
  preset?: ParticipantActivityPreset
  from?: string
  to?: string
  module?: string
  search?: string
  page?: number
  limit?: number
  sort?: 'total' | 'last' | 'first'
  order?: 'asc' | 'desc'
}

export interface ParticipantActivityRow {
  participantId?: string | null
  fullName: string
  tckn?: string | null
  phone?: string | null
  totalCount: number
  moduleBreakdown: Record<string, number>
  firstActivityAt: string
  lastActivityAt: string
  lastActivityItemName?: string | null
  lastActivityModule?: string | null
}

export interface ParticipantActivityReport {
  preset: string
  from: string
  to: string
  page: number
  limit: number
  total: number
  totalPages: number
  items: ParticipantActivityRow[]
}

export interface ParticipantActivityDetailEntry {
  module: string
  moduleLabel: string
  itemName?: string | null
  activityDate: string
  status: string
}

export interface ParticipantActivityDetail {
  participantId?: string | null
  fullName: string
  tckn?: string | null
  phone?: string | null
  totalCount: number
  moduleBreakdown: Record<string, number>
  entries: ParticipantActivityDetailEntry[]
}
