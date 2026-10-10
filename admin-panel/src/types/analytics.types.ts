export type TrendGroupBy = 'day' | 'week' | 'month'

export interface AnalyticsOverviewParams {
  from?: string
  to?: string
  groupBy?: TrendGroupBy
}

export interface AnalyticsRange {
  from: string
  to: string
  groupBy: TrendGroupBy
}

export interface Kpi {
  key: string
  label: string
  current: number
  previous: number
  deltaPct: number
}

export interface TrendPoint {
  date: string
  values: Record<string, number>
}

export interface ModuleBreakdown {
  module: string
  label: string
  total: number
  previousTotal: number
}

export interface GenderSlice {
  male: number
  female: number
  unknown: number
}

export interface AgeBucket {
  bucket: string
  count: number
}

export interface Nationality {
  turkish: number
  foreign: number
  unknown: number
}

export interface Rating {
  average: number
  distribution: number[]
  totalReviews: number
}

export interface TopProgram {
  module: string
  label: string
  name: string
  applications: number
  capacity: number
  fillRate: number
  avgRating: number
  reviewCount: number
}

export interface AnalyticsOverview {
  range: AnalyticsRange
  kpis: Kpi[]
  trend: TrendPoint[]
  modules: ModuleBreakdown[]
  gender: GenderSlice
  ageBuckets: AgeBucket[]
  nationality: Nationality
  rating: Rating
  topDemand: TopProgram[]
  topRated: TopProgram[]
}

export const MODULE_LABELS: Record<string, string> = {
  events: 'Etkinlik',
  facilities: 'Tesis Programları',
  travels: 'Gezi',
  seda: 'SEDA Eğitim',
  library: 'Kütüphane',
  muhtarlik: 'Muhtarlık',
}

export interface RecentMember {
  id: string
  fullName: string
  phone: string | null
  district: string | null
  registeredAt: string
}

export interface RecentEvent {
  id: string
  name: string
  categoryLabel: string
  startDate: string
  applicationCount: number
  capacity: number
}

export interface RecentLogin {
  userId: string | null
  userName: string
  userType: 'admin' | 'citizen'
  action: 'login' | 'logout'
  occurredAt: string
  ipAddress: string | null
}

export interface RecentApplication {
  module: string
  moduleLabel: string
  id: string
  applicantName: string
  targetName: string | null
  status: string
  createdAt: string
}

export interface ModuleRecordSummary {
  module: string
  label: string
  totalRecords: number
  todayRecords: number
}

export interface LibraryGlobalSummary {
  totalLibraries: number
  activeLibraries: number
  totalCapacity: number
  currentOccupancy: number
  onBreakNow: number
  waitingNow: number
  occupancyRate: number
  visitsToday: number
  visitsThisMonth: number
  avgSessionMinutesThisMonth: number
}

export interface GlobalStats {
  totalParticipants: number
  newParticipantsToday: number
  newParticipantsThisWeek: number
  newParticipantsThisMonth: number
  totalEvents: number
  activeEvents: number
  eventsThisMonth: number
  library: LibraryGlobalSummary | null
}

export interface DashboardActivity {
  recentMembers: RecentMember[]
  recentEvents: RecentEvent[]
  recentLogins: RecentLogin[]
  recentApplications: RecentApplication[]
  moduleSummaries: ModuleRecordSummary[]
  globalStats: GlobalStats
}

/**
 * Online kullanıcı özeti (kullanıcı isteği 2026-09-07).
 * `total`: son 5 dakikada aktif olan benzersiz kullanıcı sayısı.
 * `peakToday`: bugünün en yüksek eşzamanlı değeri.
 * `trend`: 5 dakikada bir kaydedilen ölçümler (grafik için, eskiden yeniye).
 */
export interface OnlineUsers {
  total: number
  admin: number
  citizen: number
  company: number
  peakToday: number
  trend: OnlineTrendPoint[]
  // Kullanıcı isteği (2026-10-04): "mobil uygulamada kaç kişi online, kaçı iOS kaçı
  // Android" — vatandaş (mobil) kullanıcıların platform kırılımı.
  citizenIos: number
  citizenAndroid: number
  citizenWeb: number
}

export interface OnlineTrendPoint {
  capturedAt: string
  total: number
}
