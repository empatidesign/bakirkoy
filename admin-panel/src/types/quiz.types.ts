type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary'

import type { ListParams } from '@/types/common'
import type { FullResidencyMode } from '@/lib/residency'

export type QuizStatus = 'upcoming' | 'ongoing' | 'completed'

export const QUIZ_STATUS_LABELS: Record<QuizStatus, string> = {
  upcoming: 'Yakında',
  ongoing: 'Devam Ediyor',
  completed: 'Tamamlandı',
}

export const QUIZ_STATUS_TONE: Record<QuizStatus, BadgeTone> = {
  upcoming: 'info',
  ongoing: 'success',
  completed: 'neutral',
}

export const QUIZ_STATUS_OPTIONS = (Object.keys(QUIZ_STATUS_LABELS) as QuizStatus[])
  .map((v) => ({ value: v, label: QUIZ_STATUS_LABELS[v] }))

export type QuizDifficulty = 'kolay' | 'orta' | 'zor'

export const QUIZ_DIFFICULTY_LABELS: Record<QuizDifficulty, string> = {
  kolay: 'Kolay',
  orta: 'Orta',
  zor: 'Zor',
}

export const QUIZ_DIFFICULTY_TONE: Record<QuizDifficulty, BadgeTone> = {
  kolay: 'success',
  orta: 'warning',
  zor: 'danger',
}

export const QUIZ_DIFFICULTY_POINTS: Record<QuizDifficulty, number> = {
  kolay: 10,
  orta: 15,
  zor: 20,
}

export const QUIZ_DIFFICULTY_OPTIONS = (Object.keys(QUIZ_DIFFICULTY_LABELS) as QuizDifficulty[])
  .map((v) => ({ value: v, label: QUIZ_DIFFICULTY_LABELS[v] }))

export interface Quiz {
  id: string
  title: string
  description: string
  startDate: string
  endDate: string
  status: QuizStatus
  categoryId: string
  categoryName: string
  categoryColor?: string
  ageGroupId?: string
  ageGroupName?: string
  questionCount: number
  perQuestionTimeLimit: number
  durationMinutes: number
  participantCount: number
  isActive: boolean
  createdAt?: string
  updatedAt?: string
  archivedAt?: string
  archivedBy?: string
  residencyMode: FullResidencyMode
}

export interface QuizForm {
  title: string
  description: string
  startDate: string
  endDate: string
  status: QuizStatus
  categoryId: string
  ageGroupId: string
  questionCount: number
  perQuestionTimeLimit: number
  durationMinutes: number
  residencyMode: FullResidencyMode
}

export interface QuizQuestion {
  id: string
  quizId: string
  order: number
  question: string
  options: string[]
  correctAnswer: number
  categoryId: string
  categoryName?: string
  ageGroupId?: string
  ageGroupName?: string
  difficulty: QuizDifficulty
  points: number
  timeLimit: number
}

export interface QuizQuestionForm {
  question: string
  options: string[]
  correctAnswer: number
  categoryId: string
  ageGroupId: string
  difficulty: QuizDifficulty
  points: number
  timeLimit: number
}

export interface QuizParticipation {
  id: string
  quizId: string
  participantName: string
  tckn: string
  score: number
  totalQuestions: number
  correctAnswers: number
  wrongAnswers: number
  successRate: number
  timeSpent: number
  completedAt: string
}

export interface QuizAnswerDetail {
  order: number
  question: string
  options: string[]
  selectedAnswer: number
  correctAnswer: number
  isCorrect: boolean
  timeSpent: number
  points: number
  isPassed: boolean
}

export interface QuizParticipationDetail extends QuizParticipation {
  rank: number
  totalParticipants: number
  answers: QuizAnswerDetail[]
}

export interface QuizRanking {
  rank: number
  participantName: string
  tckn: string
  score: number
  correctAnswers: number
  totalQuestions: number
  timeSpent: number
  completedAt: string
}

export interface QuizLeaderboard {
  quizId: string
  totalParticipants: number
  questionCount: number
  rankings: QuizRanking[]
}

export interface QuizOptionStat {
  option: string
  count: number
  isCorrect: boolean
}

export interface QuizQuestionStat {
  order: number
  question: string
  options: string[]
  correctAnswer: number
  totalAnswered: number
  correctCount: number
  wrongCount: number
  skippedCount: number
  optionBreakdown: QuizOptionStat[]
}

export interface QuizStats {
  quizId: string
  totalParticipants: number
  questions: QuizQuestionStat[]
}

export interface QuizSummary {
  total: number
  upcoming: number
  ongoing: number
  completed: number
  active: number
  passive: number
  totalParticipants: number
  averageScore: number
}

export interface QuizListParams extends ListParams {
  status?: string
  categoryId?: string
  isActive?: string
  archived?: string
}
