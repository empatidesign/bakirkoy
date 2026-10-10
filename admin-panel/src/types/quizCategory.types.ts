export interface QuizCategory {
  id: string
  name: string
  description?: string
  color: string
  quizCount: number
  isActive: boolean
}

export interface QuizCategoryForm {
  name: string
  description: string
  color: string
}
