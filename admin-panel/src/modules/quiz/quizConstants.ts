import type { Quiz, QuizForm, QuizQuestion, QuizQuestionForm } from '@/types/quiz.types'
import { QUIZ_DIFFICULTY_POINTS } from '@/types/quiz.types'

export const todayIso = () => {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

export const QUIZ_OPTION_COUNT = 4

export const emptyQuizForm = (): QuizForm => ({
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  status: 'upcoming',
  categoryId: '',
  ageGroupId: '',
  questionCount: 10,
  perQuestionTimeLimit: 30,
  durationMinutes: 10,
  residencyMode: 'anyone',
})

export const quizToForm = (r: Quiz): QuizForm => ({
  title: r.title,
  description: r.description,
  startDate: r.startDate ? r.startDate.split('T')[0] : '',
  endDate: r.endDate ? r.endDate.split('T')[0] : '',
  status: r.status,
  categoryId: r.categoryId,
  ageGroupId: r.ageGroupId ?? '',
  questionCount: r.questionCount,
  perQuestionTimeLimit: r.perQuestionTimeLimit,
  durationMinutes: r.durationMinutes,
  residencyMode: r.residencyMode ?? 'anyone',
})

export const emptyQuestionForm = (categoryId = ''): QuizQuestionForm => ({
  question: '',
  options: Array.from({ length: QUIZ_OPTION_COUNT }, () => ''),
  correctAnswer: 0,
  categoryId,
  ageGroupId: '',
  difficulty: 'kolay',
  points: QUIZ_DIFFICULTY_POINTS.kolay,
  timeLimit: 30,
})

export const questionToForm = (q: QuizQuestion): QuizQuestionForm => ({
  question: q.question,
  options: [...q.options],
  correctAnswer: q.correctAnswer,
  categoryId: q.categoryId,
  ageGroupId: q.ageGroupId ?? '',
  difficulty: q.difficulty,
  points: q.points,
  timeLimit: q.timeLimit,
})

export const formatDuration = (totalSeconds: number) => {
  const safe = Math.max(0, Math.floor(totalSeconds || 0))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
