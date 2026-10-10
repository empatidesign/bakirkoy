export interface CitizenQuiz {
  id: string
  title: string
  description: string
  categoryName: string
  categoryColor: string | null
  ageGroupName: string | null
  startDate: string
  endDate: string
  status: string
  questionCount: number
  durationMinutes: number
  participantCount: number
  isActive: boolean
  alreadyParticipated: boolean
}

export interface QuizQuestion {
  id: string
  order: number
  question: string
  options: string[]
  difficulty: string
  points: number
  timeLimit: number
}

export interface CitizenQuizDetail {
  id: string
  title: string
  description: string
  categoryName: string
  categoryColor: string | null
  startDate: string
  endDate: string
  status: string
  durationMinutes: number
  alreadyParticipated: boolean
  questions: QuizQuestion[]
  passRights: number
}

export interface QuizAnswer {
  questionIndex: number
  selectedAnswer: string
  timeSpent: number
  isPassed?: boolean
}

export interface CitizenQuizSubmitRequest {
  answers: QuizAnswer[]
  totalTimeSpent: number
}

export interface CitizenQuizSubmitResult {
  participationId: string
  score: number
  totalQuestions: number
  correctAnswers: number
  wrongAnswers: number
  passedCount: number
  successRate: number
  rank: number
  totalParticipants: number
  /**
   * Hata raporu (docs/hata.md #11, KRİTİK): başarı kararı istemcide "successRate >= 70"
   * varsayımıyla veriliyordu; gerçek geçme puanı yarışma bazında tanımlı olduğu için
   * %100 yapan kullanıcı bile "başarısız" görünebiliyordu. Karar artık sunucudan gelir.
   */
  isPassed: boolean
  /** Yarışmanın geçme puanı (0 = geçme şartı yok). */
  passingScore: number
}

export interface LeaderboardRanking {
  rank: number
  participantName: string
  score: number
  correctAnswers: number
  timeSpent: number
  completedAt: string
  isCurrentUser?: boolean
}

export interface CitizenQuizLeaderboard {
  quizId: string
  title: string
  totalParticipants: number
  questionCount: number
  rankings: LeaderboardRanking[]
}
