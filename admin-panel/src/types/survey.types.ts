type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

import type { ListParams } from '@/types/common'

export type SurveyStatus = 'draft' | 'active' | 'completed' | 'archived'

export const SURVEY_STATUS_LABELS: Record<SurveyStatus, string> = {
  draft: 'Taslak',
  active: 'Aktif',
  completed: 'Tamamlandı',
  archived: 'Arşiv',
}

export const SURVEY_STATUS_TONE: Record<SurveyStatus, BadgeTone> = {
  draft: 'warning',
  active: 'success',
  completed: 'info',
  archived: 'neutral',
}

export const SURVEY_STATUS_OPTIONS = (Object.keys(SURVEY_STATUS_LABELS) as SurveyStatus[])
  .map((v) => ({ value: v, label: SURVEY_STATUS_LABELS[v] }))

export type SurveyQuestionType =
  | 'rating'
  | 'emoji_rating'
  | 'like_dislike'
  | 'satisfaction'
  | 'agreement'
  | 'multiple_choice'
  | 'checkbox'
  | 'yes_no'
  | 'scale'
  | 'text'

export const SURVEY_QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  rating: 'Yıldız Değerlendirme',
  emoji_rating: 'Emoji Puanlama',
  like_dislike: 'Beğeni / Beğenmeme',
  satisfaction: 'Memnuniyet',
  agreement: 'Katılım Derecesi',
  multiple_choice: 'Çoktan Seçmeli',
  checkbox: 'Çoklu Seçim',
  yes_no: 'Evet / Hayır',
  scale: 'Ölçek',
  text: 'Metin Yanıtı',
}

export const SURVEY_QUESTION_TYPE_HINTS: Record<SurveyQuestionType, string> = {
  rating: '1-5 yıldız ile puanlama',
  emoji_rating: 'Emoji ile 1-5 puanlama',
  like_dislike: 'Beğen / beğenme',
  satisfaction: 'Memnuniyet ölçeği (çok memnun değilim … çok memnunum)',
  agreement: 'Likert: kesinlikle katılmıyorum … kesinlikle katılıyorum',
  multiple_choice: 'Tek seçim — verilen seçeneklerden biri',
  checkbox: 'Çoklu seçim — birden fazla seçenek',
  yes_no: 'Evet / Hayır',
  scale: 'Sayısal ölçek (1-10 gibi)',
  text: 'Serbest metin yanıtı',
}

export const SURVEY_QUESTION_TYPES_WITH_OPTIONS: SurveyQuestionType[] = ['multiple_choice', 'checkbox']

export const SURVEY_QUESTION_TYPE_OPTIONS = (Object.keys(SURVEY_QUESTION_TYPE_LABELS) as SurveyQuestionType[])
  .map((v) => ({ value: v, label: SURVEY_QUESTION_TYPE_LABELS[v] }))

export type SurveyTargetAudience =
  | 'all'
  | 'event_participants'
  | 'event_attendees'
  | 'travel_participants'
  | 'facility_participants'
  | 'facility_attendees'
  | 'sports_participants'
  | 'library_users'
  | 'youth'

export const SURVEY_TARGET_AUDIENCE_LABELS: Record<SurveyTargetAudience, string> = {
  all: 'Tüm Vatandaşlar',
  event_participants: 'Etkinlik Katılımcıları (Onaylı Başvuru)',
  event_attendees: 'Etkinliğe Giriş Yapmış Katılımcılar',
  travel_participants: 'Gezi Katılımcıları',
  facility_participants: 'Tesis Katılımcıları (Onaylı Başvuru)',
  facility_attendees: 'Tesise Devam Etmiş Katılımcılar (Yoklamalı)',
  sports_participants: 'Spor Katılımcıları',
  library_users: 'Kütüphane Kullanıcıları',
  youth: 'Gençler',
}

export const SURVEY_TARGET_AUDIENCE_OPTIONS = (Object.keys(SURVEY_TARGET_AUDIENCE_LABELS) as SurveyTargetAudience[])
  .map((v) => ({ value: v, label: SURVEY_TARGET_AUDIENCE_LABELS[v] }))

export const SURVEY_CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'Etkinlik', label: 'Etkinlik' },
  { value: 'Gezi', label: 'Gezi' },
  { value: 'Spor', label: 'Spor' },
  { value: 'Eğitim', label: 'Eğitim' },
  { value: 'Kütüphane', label: 'Kütüphane' },
  { value: 'Belediye Hizmetleri', label: 'Belediye Hizmetleri' },
  { value: 'Gençlik', label: 'Gençlik' },
  { value: 'Genel', label: 'Genel' },
]

export interface SurveyQuestionConfig {
  scaleMin?: number
  scaleMax?: number
  minLabel?: string
  maxLabel?: string
  ratingCount?: number
}

export interface SurveyQuestion {
  id: string
  surveyId?: string
  order: number
  type: SurveyQuestionType
  question: string
  description?: string
  required: boolean
  options: string[]
  config?: SurveyQuestionConfig
}

export interface SurveyQuestionForm {
  type: SurveyQuestionType
  question: string
  description: string
  required: boolean
  options: string[]
  config: SurveyQuestionConfig
}

export interface Survey {
  id: string
  title: string
  description: string
  category: string
  targetAudience: SurveyTargetAudience
  startDate: string
  endDate: string
  estimatedDuration: number
  status: SurveyStatus
  isActive: boolean
  isAnonymous: boolean
  allowMultipleResponses: boolean
  showResults: boolean
  autoSendAfterEvent: boolean
  sendReminderSMS: boolean
  isRequired: boolean
  sourceType?: string | null
  sourceId?: string | null
  // --- SultanŞehir Anket Platformu alanları ---
  surveyType: string
  identityMode: string
  topic?: string | null
  targetNeighborhoods: string[]
  targetResponseCount: number
  fieldEnabled: boolean
  requireLocation: boolean
  questionCount: number
  totalResponses: number
  averageRating?: number
  createdAt?: string
  updatedAt?: string
}

export interface SurveyForm {
  title: string
  description: string
  category: string
  targetAudience: SurveyTargetAudience
  startDate: string
  endDate: string
  estimatedDuration: number
  isActive: boolean
  isAnonymous: boolean
  allowMultipleResponses: boolean
  showResults: boolean
  autoSendAfterEvent: boolean
  sendReminderSMS: boolean
  isRequired: boolean
  sourceType: string | null
  sourceId: string | null
  questions: SurveyQuestionForm[]
  // --- SultanŞehir Anket Platformu alanları ---
  surveyType: string
  identityMode: string
  topic: string
  targetNeighborhoods: string[]
  targetResponseCount: number
  fieldEnabled: boolean
  requireLocation: boolean
}

export interface SurveyMonthlyResponse {
  month: string
  responses: number
}

export interface SurveyCategoryCount {
  category: string
  count: number
}

export interface SurveySatisfactionTrend {
  period: string
  satisfaction: number
}

export interface SurveyRecentActivity {
  id: string
  title: string
  totalResponses: number
  createdAt: string
}

export interface SurveySummary {
  total: number
  active: number
  passive: number
  draft: number
  completed: number
  totalResponses: number
  averageRating: number
  averageCompletionRate: number
  monthlyResponses: SurveyMonthlyResponse[]
  categoryDistribution: SurveyCategoryCount[]
  satisfactionTrends: SurveySatisfactionTrend[]
  recent: SurveyRecentActivity[]
}

export interface SurveyAnswerDistribution {
  label: string
  count: number
  percentage: number
}

// Kullanıcı isteği (2026-09-03): "hangi soruya hangi mahalle ne cevap vermiş" — her sorunun
// mahalle bazlı kırılımı. Backend SurveyQuestionNeighborhoodBreakdownDto ile birebir.
export interface SurveyQuestionNeighborhoodBreakdown {
  neighborhood: string
  totalAnswers: number
  averageScore?: number
  distribution: SurveyAnswerDistribution[]
  positivityScore?: number
}

// Kullanıcı isteği (2026-09-03): her sorunun genel ortalaması + global anket değerlendirme
// kıstaslarına göre sorun tespiti. Backend SurveyQuestionAssessmentDto ile birebir.
export interface SurveyQuestionAssessment {
  positivityScore: number
  level: 'critical' | 'weak' | 'moderate' | 'good' | 'excellent'
  levelLabel: string
  issueDetected: boolean
  summary: string
}

export interface SurveyQuestionAnalytics {
  questionId: string
  order: number
  question: string
  type: SurveyQuestionType
  totalAnswers: number
  averageScore?: number
  distribution: SurveyAnswerDistribution[]
  textSamples?: string[]
  neighborhoodBreakdown: SurveyQuestionNeighborhoodBreakdown[]
  assessment?: SurveyQuestionAssessment | null
}

export interface SurveyDemographics {
  ageGroups: SurveyAnswerDistribution[]
  genders: SurveyAnswerDistribution[]
}

export interface SurveyAnalytics {
  surveyId: string
  surveyTitle: string
  totalResponses: number
  completionRate: number
  averageRating: number
  averageDuration: number
  isAnonymous: boolean
  questions: SurveyQuestionAnalytics[]
  demographics?: SurveyDemographics
}

export interface SurveyListParams extends ListParams {
  status?: string
  category?: string
  isActive?: string
  surveyType?: string
  topic?: string
  neighborhood?: string
  fieldEnabled?: string
}

export interface SurveyResponseAnswer {
  questionId: string
  questionText: string
  questionType: SurveyQuestionType
  rawAnswer?: string | null
  answerDisplay: string
}

export interface SurveyResponseListItem {
  id: string
  surveyId: string
  isAnonymous: boolean
  responderName?: string | null
  responderTcLast4?: string | null
  anonymousLabel?: string | null
  submittedAt: string
  answeredQuestionCount: number
  totalQuestionCount: number
  answers: SurveyResponseAnswer[]
}



// Kullanıcı isteği (2026-09-01): silme öncesi etki özeti — kaç yanıt/soru/saha görevi
// yok olacağı yöneticiye gösterilir, onay metni backend'den gelir (tek kaynak).
export interface SurveyDeleteImpact {
  surveyId: string
  title: string
  responseCount: number
  questionCount: number
  fieldTaskCount: number
  canDelete: boolean
  confirmationPhrase: string
}

// Kullanıcı isteği (2026-09-20): Anketler > Genel Ayarlar — vatandaş başına günlük
// opsiyonel anket yanıtı limiti ve iki yanıt arası bekleme süresi. Zorunlu anketler muaftır.
export interface SurveyGlobalSettings {
  maxOptionalResponsesPerDay: number
  minMinutesBetweenOptionalResponses: number
  updatedAt?: string | null
}

export interface UpdateSurveyGlobalSettingsForm {
  maxOptionalResponsesPerDay: number
  minMinutesBetweenOptionalResponses: number
}
