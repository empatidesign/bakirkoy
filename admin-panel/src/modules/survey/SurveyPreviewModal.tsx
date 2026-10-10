import { useEffect, useState } from 'react'
import { Modal, SkeletonRows } from '@/design-system'
import surveyService from '@/services/survey.service'
import { SurveyPreview } from '@/components/specialized/SurveyPreview'
import type { Survey, SurveyQuestionForm } from '@/types/survey.types'
import { questionToForm } from './surveyConstants'

interface Props {
  survey: Survey
  open: boolean
  onClose: () => void
}

export const SurveyPreviewModal = ({ survey, open, onClose }: Props) => {
  const [questions, setQuestions] = useState<SurveyQuestionForm[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    surveyService
      .getQuestions(survey.id)
      .then((qs) => setQuestions(qs.map(questionToForm)))
      .catch(() => setQuestions([]))
      .finally(() => setLoading(false))
  }, [open, survey.id])

  return (
    <Modal open={open} onClose={onClose} title="Mobil Önizleme" subtitle={survey.title} width={430}>
      {loading ? (
        <SkeletonRows rows={6} />
      ) : (
        <SurveyPreview
          title={survey.title}
          category={survey.category}
          estimatedDuration={survey.estimatedDuration}
          questions={questions}
        />
      )}
    </Modal>
  )
}
