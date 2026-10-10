import type { CitizenSurveyQuestion } from './survey.types'

// Kullanıcı isteği (2026-09-01): saha görevlisi (anketör) vatandaş için anket toplama ekranı.
// Backend karşılığı: /api/v1/me/surveys/field/* (MeSurveyEndpoints).

export interface FieldTask {
  id: string
  surveyId: string
  surveyTitle: string
  surveyCategory: string
  questionCount: number
  estimatedDuration: number
  neighborhood: string
  startDate: string
  endDate: string
  targetCount: number
  dailyTarget: number
  completedCount: number
  todayCount: number
  progressPercent: number
  status: string
  note: string | null
  requireLocation: boolean
  isWindowOpen: boolean
  /**
   * Kullanıcı isteği (2026-09-02): görev kapalıysa NEDEN kapalı olduğu backend'den gelir.
   * survey_inactive | task_cancelled | task_completed | out_of_window |
   * target_reached | daily_quota_reached | null (açık)
   */
  closedReason?: string | null
}

export interface FieldTaskDetail {
  task: FieldTask
  surveyDescription: string
  isAnonymous: boolean
  questions: CitizenSurveyQuestion[]
}

export interface FieldRespondentLookup {
  tckn: string
  isRegistered: boolean
  fullName: string | null
  neighborhood: string | null
  ageGroup: string | null
  gender: string | null
  alreadyResponded: boolean
}

export interface FieldSubmitResult {
  responseId: string
  submittedAt: string
  completedCount: number
  todayCount: number
}

export interface FieldResponseSummary {
  id: string
  tcknMasked: string
  neighborhood: string | null
  ageGroup: string | null
  gender: string | null
  durationSeconds: number | null
  submittedAt: string
}

export interface FieldSubmitPayload {
  tckn?: string | null
  isAnonymousRespondent?: boolean
  answers: { questionId: string; answer: string }[]
  neighborhood?: string | null
  ageGroup?: string | null
  gender?: string | null
  durationSeconds?: number | null
  latitude?: number | null
  longitude?: number | null
  localUuid?: string | null
}

// Kullanıcı isteği (2026-09-01): "nvi entegrasyonu da yap" — TC yerel kayıtta yoksa
// gerçek NVI sorgusuyla doğrulama (maskeli sonuç döner, KVKK).
export interface FieldNviLookupResult {
  verified: boolean
  errorMessage: string | null
  maskedFullName: string | null
  gender: string | null
  ageGroup: string | null
  neighborhood: string | null
}

// Kullanıcı isteği (2026-09-01): saha görevlisi görüştüğü vatandaş adına doğrudan
// talep/öneri/şikayet açabilsin.
// Kullanıcı isteği (2026-09-05): "TC kimlik doğum tarihi sorgulaması olacak, kişi talep
// bıraktığında anonim ise burdan o bilgileri isteyecek, başlangıçta vermişse o bilgilere
// göre doldurulacak" — anket başında (kimlik doğrulama adımında) TC + doğum tarihi zaten
// verilmişse bu form otomatik doldurulur; anonim katılımdan sonra talep açılıyorsa
// anketör isteğe bağlı olarak burada TC + doğum tarihini elle girebilir.
export interface FieldCitizenSubmissionPayload {
  fieldTaskId: string
  title: string
  description: string
  categoryId: string
  submissionType: 'request' | 'suggestion' | 'complaint'
  neighborhood: string
  citizenName?: string | null
  citizenPhone?: string | null
  citizenTc?: string | null
  citizenBirthDate?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface FieldCitizenSubmissionResult {
  id: string
  trackingNo: string | null
  submittedAt: string
}

// Kullanıcı isteği (2026-09-01): vatandaş anketi kendi telefonundan doldurmak isterse
// SMS ile link gönderme — sadece telefonla da gönderilebilir.
export interface FieldSurveySmsLinkPayload {
  phone: string
  tckn?: string | null
  fullName?: string | null
  birthDate?: string | null
}

export interface FieldSurveySmsLinkResult {
  sent: boolean
  errorMessage: string | null
}

// Kullanıcı isteği (2026-09-01): saha görevlisi GPS takibi.
export interface FieldLocationPingPayload {
  latitude: number
  longitude: number
  accuracyMeters?: number
  speedMps?: number
  recordedAt?: string
  fieldTaskId?: string
}

export interface FieldLocationPingResult {
  accepted: boolean
  todayDistanceMeters: number
  nextPingSeconds: number
}
