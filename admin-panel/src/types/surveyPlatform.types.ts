import type { ListParams } from '@/types/common'
import type { SurveyAnswerDistribution, SurveyQuestionConfig, SurveyQuestionType } from '@/types/survey.types'

// ---------------------------------------------------------------------------
// SultanŞehir Anket, Saha Araştırma ve Vatandaş Geri Bildirim Platformu
// Kaynak: docs/SultanSehir_Anket_Platformu_MD_Paketi
// ---------------------------------------------------------------------------

// --- Anket türü / kimlik modu (doküman 01 §2, §4) ---

export type SurveyType =
  | 'standard'
  | 'dynamic'
  | 'neighborhood'
  | 'topic'
  | 'satisfaction'
  | 'pulse'
  | 'post_event'
  | 'internal'

export const SURVEY_TYPE_LABELS: Record<SurveyType, string> = {
  standard: 'Standart Anket',
  dynamic: 'Dinamik Anket',
  neighborhood: 'Mahalle Bazlı Anket',
  topic: 'Konu Bazlı Anket',
  satisfaction: 'Memnuniyet Anketi',
  pulse: 'Hızlı Nabız Anketi',
  post_event: 'Etkinlik Sonrası Anket',
  internal: 'Kurum İçi Anket',
}

export const SURVEY_TYPE_OPTIONS = (Object.keys(SURVEY_TYPE_LABELS) as SurveyType[])
  .map((v) => ({ value: v, label: SURVEY_TYPE_LABELS[v] }))

export type SurveyIdentityMode = 'identified' | 'semi_anonymous' | 'anonymous'

export const SURVEY_IDENTITY_MODE_LABELS: Record<SurveyIdentityMode, string> = {
  identified: 'Kimlikli (kişi bilgileri tutulur)',
  semi_anonymous: 'Yarı Anonim (mahalle, yaş, cinsiyet)',
  anonymous: 'Tam Anonim (kişisel veri alınmaz)',
}

export const SURVEY_IDENTITY_MODE_OPTIONS = (Object.keys(SURVEY_IDENTITY_MODE_LABELS) as SurveyIdentityMode[])
  .map((v) => ({ value: v, label: SURVEY_IDENTITY_MODE_LABELS[v] }))

// Doküman 01 §2.4 / 04 §5 — konu bazlı analiz etiketleri
export const SURVEY_TOPIC_OPTIONS = [
  'Temizlik', 'Ulaşım', 'Park ve Bahçeler', 'Güvenlik', 'Sosyal Yardım',
  'Spor', 'Eğitim', 'Kültür', 'Veterinerlik', 'Çevre', 'Kentsel Dönüşüm',
  'Gençlik', 'Engelli Hizmetleri', 'Mahalle', 'Etkinlik', 'Genel',
].map((t) => ({ value: t, label: t }))

// Doküman 04 §6 — yaş grupları
export const SURVEY_AGE_GROUPS = ['0-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const
export type SurveyAgeGroup = (typeof SURVEY_AGE_GROUPS)[number]

export const SURVEY_CHANNEL_LABELS: Record<string, string> = {
  app: 'Mobil Uygulama',
  field: 'Saha (Tablet)',
  web: 'Web',
  call_center: 'Çağrı Merkezi',
}

// --- Saha görevleri (doküman 03/08) ---

export type SurveyFieldTaskStatus = 'assigned' | 'in_progress' | 'completed' | 'cancelled'

export const SURVEY_FIELD_TASK_STATUS_LABELS: Record<SurveyFieldTaskStatus, string> = {
  assigned: 'Atandı',
  in_progress: 'Devam Ediyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
}

export const SURVEY_FIELD_TASK_STATUS_TONE: Record<SurveyFieldTaskStatus, 'info' | 'warning' | 'success' | 'neutral'> = {
  assigned: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'neutral',
}

export const SURVEY_FIELD_TASK_STATUS_OPTIONS =
  (Object.keys(SURVEY_FIELD_TASK_STATUS_LABELS) as SurveyFieldTaskStatus[])
    .map((v) => ({ value: v, label: SURVEY_FIELD_TASK_STATUS_LABELS[v] }))

export interface SurveyFieldTask {
  id: string
  surveyId: string
  surveyTitle: string
  interviewerId: string
  interviewerType: SurveyInterviewerType
  interviewerName: string
  neighborhood: string
  startDate: string
  endDate: string
  targetCount: number
  dailyTarget: number
  status: SurveyFieldTaskStatus
  note?: string | null
  lastSyncAt?: string | null
  completedCount: number
  todayCount: number
  progressPercent: number
  createdAt: string
}

export interface SurveyFieldTaskForm {
  surveyId: string
  interviewerId: string
  interviewerType: SurveyInterviewerType
  interviewerLabel: string
  neighborhood: string
  startDate: string
  endDate: string
  targetCount: number
  dailyTarget: number
  note: string
  status: SurveyFieldTaskStatus
}

export interface SurveyFieldTaskListParams extends ListParams {
  surveyId?: string
  interviewerId?: string
  neighborhood?: string
  status?: string
}

// Kullanıcı isteği (2026-09-01): Saha Görevleri tablosunda satır seçip toplu işlem.
export type SurveyFieldTaskBulkAction =
  | 'activate' | 'deactivate' | 'assign-neighborhood' | 'assign-survey' | 'delete'

export interface SurveyFieldTaskBulkRequest {
  ids: string[]
  action: SurveyFieldTaskBulkAction
  neighborhood?: string | null
  surveyId?: string | null
}

export interface SurveyFieldTaskBulkResult {
  affected: number
  skipped: number
}

// Kullanıcı isteği (2026-09-01): saha görevlisi olarak yönetici hesabı ya da site üyesi
// (vatandaş/Participant) seçilebilsin — TC/telefon/isim ile birleşik arama.
export type SurveyInterviewerType = 'admin' | 'participant'

export interface SurveyInterviewerCandidate {
  id: string
  type: SurveyInterviewerType
  fullName: string
  phone?: string | null
  tcknMasked?: string | null
  department?: string | null
  neighborhood?: string | null
}

export interface SurveyFieldTaskInterviewerRef {
  id: string
  type: SurveyInterviewerType
  label: string
}

export interface BatchCreateSurveyFieldTaskForm {
  surveyId: string
  interviewers: SurveyFieldTaskInterviewerRef[]
  /// Boş = Tüm Mahalleler
  neighborhoods: string[]
  allNeighborhoods: boolean
  startDate: string
  endDate: string
  targetCount: number
  dailyTarget: number
  note: string
}

// --- Anketör performansı (doküman 01 §7) ---

export interface SurveyInterviewerStats {
  interviewerId: string
  name: string
  department?: string | null
  taskCount: number
  activeTaskCount: number
  totalTarget: number
  completedCount: number
  todayCount: number
  progressPercent: number
  averageDurationSeconds: number
  flaggedCount: number
  neighborhoods: string[]
  lastResponseAt?: string | null
}

// --- Kota (doküman 01 §6) ---

export type SurveyQuotaDimension = 'neighborhood' | 'age_group' | 'gender'

export const SURVEY_QUOTA_DIMENSION_LABELS: Record<SurveyQuotaDimension, string> = {
  neighborhood: 'Mahalle',
  age_group: 'Yaş Aralığı',
  gender: 'Cinsiyet',
}

export const SURVEY_QUOTA_DIMENSION_OPTIONS =
  (Object.keys(SURVEY_QUOTA_DIMENSION_LABELS) as SurveyQuotaDimension[])
    .map((v) => ({ value: v, label: SURVEY_QUOTA_DIMENSION_LABELS[v] }))

export interface SurveyQuota {
  id: string
  surveyId: string
  dimension: SurveyQuotaDimension
  value: string
  targetCount: number
  currentCount: number
  progressPercent: number
}

export interface SurveyQuotaForm {
  dimension: SurveyQuotaDimension
  value: string
  targetCount: number
}

// --- Soru bankası (doküman 02 §7) ---

export interface SurveyQuestionBankItem {
  id: string
  question: string
  description?: string | null
  type: SurveyQuestionType
  options: string[]
  topic: string
  unit?: string | null
  config: SurveyQuestionConfig
  usageCount: number
  lastUsedAt?: string | null
  isActive: boolean
  createdAt: string
}

export interface SurveyQuestionBankForm {
  question: string
  description: string
  type: SurveyQuestionType
  options: string[]
  topic: string
  unit: string
  config: SurveyQuestionConfig
  isActive: boolean
}

export interface SurveyQuestionBankListParams extends ListParams {
  topic?: string
  type?: string
  isActive?: string
}

// --- Şablonlar (doküman 02 §6) ---

export interface SurveyTemplateQuestion {
  type: SurveyQuestionType
  question: string
  description?: string | null
  required: boolean
  options: string[]
  config?: SurveyQuestionConfig | null
}

export interface SurveyTemplate {
  key: string
  title: string
  description: string
  category: string
  topic: string
  surveyType: SurveyType
  estimatedDuration: number
  questions: SurveyTemplateQuestion[]
}

// --- Analitik (doküman 04) ---

export interface SurveyNeighborhoodStats {
  neighborhood: string
  responseCount: number
  satisfactionScore: number
  openSubmissionCount: number
  totalSubmissionCount: number
  resolvedSubmissionCount: number
  resolutionRate: number
  topIssues: SurveyAnswerDistribution[]
  ageGroups: SurveyAnswerDistribution[]
  genders: SurveyAnswerDistribution[]
  trendChangePercent: number
}

export interface SurveyTopicStats {
  topic: string
  responseCount: number
  satisfactionScore: number
  submissionCount: number
  resolvedCount: number
  resolutionRate: number
  trendChangePercent: number
}

export interface SurveyFieldOperations {
  activeSurveys: number
  todayResponses: number
  totalResponses: number
  activeInterviewers: number
  openTasks: number
  flaggedResponses: number
  quotaFulfillmentPercent: number
  neighborhoodCoveragePercent: number
  responsesByChannel: SurveyAnswerDistribution[]
  responsesByNeighborhood: SurveyAnswerDistribution[]
  topInterviewers: SurveyInterviewerStats[]
}

export interface SurveyCriticalAgendaItem {
  title: string
  neighborhood: string
  topic: string
  changePercent: number
  severity: 'critical' | 'high' | 'normal'
}

export interface SurveyExecutiveTopic {
  topic: string
  score: number
  count: number
  changePercent: number
}

export interface SurveyExecutiveDashboard {
  satisfactionIndex: number
  pulseScore: number
  totalOpenIssues: number
  criticalNeighborhood?: string | null
  pendingSubmissions: number
  averageResolutionHours: number
  submissionClosureRate: number
  criticalAgenda: SurveyCriticalAgendaItem[]
  neighborhoods: SurveyNeighborhoodStats[]
  topComplaints: SurveyExecutiveTopic[]
  topSatisfactions: SurveyExecutiveTopic[]
  satisfactionTrend: { period: string; satisfaction: number }[]
  agePriorities: SurveyAnswerDistribution[]
  // Kullanıcı isteği (2026-09-02, docs/ankettema/06.png "RAPORLAR" ekranı): tek ekranda
  // toplam katılımcı, genel anket sayıları, memnuniyet dağılımı, zaman içinde katılım.
  totalSurveys: number
  activeSurveys: number
  totalResponses: number
  totalParticipants: number
  averageCompletionRate: number
  averageDurationMinutes: number
  satisfactionDistribution: SurveyAnswerDistribution[]
  genderDistribution: SurveyAnswerDistribution[]
  participationOverTime: { date: string; responses: number }[]
}

export interface SurveyAnalyticsFilters {
  from?: string
  to?: string
  surveyId?: string
  neighborhood?: string
  topic?: string
  ageGroup?: string
  gender?: string
  channel?: string
  interviewerId?: string
}

// ---------------------------------------------------------------------------
// Kullanıcı isteği (2026-09-01): saha görevlisi canlı GPS takibi + anketör performans
// aritmetiği. Backend karşılığı: /api/v1/surveys/field-live, /field-live/{id}/trail,
// /interviewer-performance.
// ---------------------------------------------------------------------------

export type FieldPresenceStatus = 'online' | 'idle' | 'offline'

export const FIELD_PRESENCE_LABELS: Record<FieldPresenceStatus, string> = {
  online: 'Sahada (canlı)',
  idle: 'Beklemede',
  offline: 'Çevrimdışı',
}

export const FIELD_PRESENCE_TONE: Record<FieldPresenceStatus, 'success' | 'warning' | 'neutral'> = {
  online: 'success',
  idle: 'warning',
  offline: 'neutral',
}

export interface SurveyFieldLiveAgent {
  interviewerId: string
  name: string
  phone: string | null
  activeTaskId: string | null
  activeSurveyTitle: string | null
  neighborhood: string
  latitude: number | null
  longitude: number | null
  accuracyMeters: number | null
  lastSeenAt: string | null
  presenceStatus: FieldPresenceStatus
  todayDistanceMeters: number
  todayVisitedPointCount: number
  todayResponseCount: number
  totalResponseCount: number
  targetCount: number
  progressPercent: number
}

export interface SurveyFieldTrailPoint {
  latitude: number
  longitude: number
  recordedAt: string
  accuracyMeters: number | null
  distanceFromPreviousMeters: number
}

export interface SurveyFieldStop {
  latitude: number
  longitude: number
  arrivedAt: string
  leftAt: string
  minutesSpent: number
  responseCount: number
}

export interface SurveyFieldResponsePoint {
  responseId: string
  latitude: number
  longitude: number
  submittedAt: string
  neighborhood: string | null
  durationSeconds: number | null
  score5: number | null
  isFlagged: boolean
}

export interface SurveyFieldTrail {
  interviewerId: string
  name: string
  date: string
  totalDistanceMeters: number
  activeMinutes: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  points: SurveyFieldTrailPoint[]
  stops: SurveyFieldStop[]
  responsePoints: SurveyFieldResponsePoint[]
}

export interface SurveyInterviewerPerformance {
  interviewerId: string
  name: string
  department: string | null
  taskCount: number
  totalTarget: number
  completedCount: number
  todayCount: number
  progressPercent: number
  averageScore5: number
  scoredResponseCount: number
  positiveRate: number
  neutralRate: number
  negativeRate: number
  biasIndex: number
  averageDurationSeconds: number
  medianDurationSeconds: number
  fastResponseRate: number
  straightLiningRate: number
  gpsCoverageRate: number
  distinctLocationCount: number
  distanceWalkedMeters: number
  flaggedCount: number
  reliabilityScore: number
  performanceScore: number
  neighborhoods: string[]
  topPositiveTopics: SurveyAnswerDistribution[]
  topNegativeTopics: SurveyAnswerDistribution[]
  explanations: string[]
  lastResponseAt: string | null
}

export interface SurveyPerformanceBenchmark {
  interviewerCount: number
  totalResponses: number
  averageScore5: number
  positiveRate: number
  negativeRate: number
  medianDurationSeconds: number
  averageResponsesPerInterviewer: number
  positiveRateStdDev: number
}

export interface SurveyInterviewerPerformanceResult {
  benchmark: SurveyPerformanceBenchmark
  interviewers: SurveyInterviewerPerformance[]
}

// Kullanıcı isteği (2026-09-01): anketörlere toplu mesaj / duyuru / SMS.
export interface SurveyInterviewerMessagePayload {
  title: string
  body: string
  /** Doğrudan seçilen anketörler. */
  interviewerIds?: string[]
  /** Verilirse bu ankete atanmış tüm anketörler hedeflenir. */
  surveyId?: string
  notify: boolean
  sms: boolean
  /** true ise anketör "Okudum" demeden popup kapanmaz. */
  requiresAck: boolean
}

export interface SurveyInterviewerMessageResult {
  recipients: number
  notificationsCreated: number
  smsSent: number
  smsFailed: number
  smsMockMode: boolean
}

// Kullanıcı isteği (2026-09-02): gönderilen bildirimin hangi anketör tarafından, ne zaman
// okunduğu ve "Okudum" onayının verilip verilmediği adminde görünmeli.
export interface SurveyNotificationReceipt {
  notificationId: string
  interviewerId: string
  interviewerName: string
  title: string
  body: string
  type: string
  sentAt: string
  isRead: boolean
  readAt: string | null
  requiresAck: boolean
  acknowledgedAt: string | null
}

export interface SurveyNotificationSummary {
  title: string
  type: string
  sentAt: string
  requiresAck: boolean
  recipients: number
  readCount: number
  acknowledgedCount: number
  receipts: SurveyNotificationReceipt[]
}
