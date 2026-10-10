import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { CitizenSurveyDetail } from '@/types/survey.types'

vi.mock('@/services/survey.service', () => ({
  default: { detail: vi.fn(), submit: vi.fn() },
}))

import surveyService from '@/services/survey.service'
import { SurveyFormModal } from './SurveyFormModal'

const baseDetail = (over: Partial<CitizenSurveyDetail>): CitizenSurveyDetail => ({
  id: 's1', title: 'Memnuniyet', description: '', category: 'general', status: 'active',
  isAnonymous: false, estimatedDuration: 2, startDate: null, endDate: null,
  alreadyResponded: false, allowMultipleResponses: false, isRequired: false,
  questions: [], sourceContext: null, ...over,
})

describe('SurveyFormModal — tekrar yanıtlama engeli (satır 108)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('yanıtlanmış + çoklu-yanıt kapalı ise salt-okunur uyarı gösterir', async () => {
    vi.mocked(surveyService.detail).mockResolvedValue(baseDetail({ alreadyResponded: true, allowMultipleResponses: false }))
    render(<SurveyFormModal surveyId="s1" onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getByText('Bu anketi zaten yanıtladınız')).toBeInTheDocument())
  })

  it('çoklu-yanıt açık ise yanıtlanmış olsa da formu açar (salt-okunur değil)', async () => {
    vi.mocked(surveyService.detail).mockResolvedValue(baseDetail({ alreadyResponded: true, allowMultipleResponses: true }))
    render(<SurveyFormModal surveyId="s1" onClose={vi.fn()} />)
    await waitFor(() => expect(surveyService.detail).toHaveBeenCalled())
    expect(screen.queryByText('Bu anketi zaten yanıtladınız')).not.toBeInTheDocument()
  })
})
