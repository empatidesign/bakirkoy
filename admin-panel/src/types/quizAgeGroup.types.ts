export interface QuizAgeGroup {
  id: string
  name: string
  minAge: number
  maxAge: number
  sortOrder: number
  quizCount: number
  isActive: boolean
}

export interface QuizAgeGroupForm {
  name: string
  minAge: number
  maxAge: number
  sortOrder: number
}
