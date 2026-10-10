export interface SourceContext {
  type: string
  name: string
  sourceStartDate: string
  sourceEndDate: string
  facilityName: string | null
  hallName: string | null
  destination: string | null
}

export interface CitizenSurvey {
  id: string
  title: string
  description: string
  category: string
  status: string
  isActive: boolean
  isAnonymous: boolean
  estimatedDuration: number
  questionCount: number
  startDate: string | null
  endDate: string | null
  alreadyResponded: boolean
  sourceType?: string | null
  sourceId?: string | null
  isRequired: boolean
  sourceContext?: SourceContext | null
}

export interface CitizenSurveyQuestion {
  id: string
  order: number
  type: string
  question: string
  description: string | null
  required: boolean
  options: string[]
  scaleMin: number | null
  scaleMax: number | null
  minLabel: string | null
  maxLabel: string | null
  ratingCount: number | null
}

export interface CitizenSurveyDetail {
  id: string
  title: string
  description: string
  category: string
  status: string
  isAnonymous: boolean
  estimatedDuration: number
  startDate: string | null
  endDate: string | null
  alreadyResponded: boolean
  allowMultipleResponses: boolean
  isRequired: boolean
  questions: CitizenSurveyQuestion[]
  sourceContext?: SourceContext | null
}

export interface SurveyAnswerDto {
  questionId: string
  answer: string
}

export interface SurveySubmitResult {
  responseId: string
  submittedAt: string
}

export interface PendingSurveyItem {
  id: string
  title: string
  isRequired: boolean
  sourceType: string | null
  sourceName: string | null
}

// Kullanıcı isteği (2026-08-12): pacing algoritması özeti — birden fazla zorunlu anket birikse
// bile art arda rahatsız etmemek için, backend aynı anda EN FAZLA BİR zorunlu anketin
// bloklayıcı modal olarak gösterilmesine izin verir (nextEligibleRequiredSurveyId). Diğerleri
// PendingSurveyGate tarafından şimdilik beklemeye alınır, bir sonraki uygun zamanda sorulur.
export interface PendingSurveySummary {
  pendingCount: number
  requiredPendingCount: number
  hasRequiredPending: boolean
  items: PendingSurveyItem[]
  nextEligibleRequiredSurveyId: string | null
}
