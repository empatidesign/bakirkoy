import { useEffect, useState } from 'react'
import { ClipboardListIcon, Loader2Icon, CalendarIcon } from 'lucide-react'
import { Card, EmptyState, Badge } from '@/design-system'
import { formatDate } from '@/lib/utils'
import participantService from '@/services/participant.service'
import type { ParticipantSurveyResponse, ParticipantDetail } from '@/types/participant.types'

interface Props {
  participant: ParticipantDetail
}

export const ParticipantSurveysView = ({ participant }: Props) => {
  const [responses, setResponses] = useState<ParticipantSurveyResponse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    participantService.getSurveyHistory(participant.id)
      .then((r) => { if (active) setResponses(r) })
      .catch(() => { if (active) setResponses([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [participant.id])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-foreground-muted">
        <Loader2Icon className="h-5 w-5 animate-spin" />
      </div>
    )
  }

  if (responses.length === 0) {
    return (
      <Card padded className="py-6 shadow-sm">
        <EmptyState
          icon={ClipboardListIcon}
          title="Anket kaydı yok"
          description="Bu katılımcı henüz hiçbir ankete cevap vermemiş. (Anonim anketlere verilen cevaplar mahremiyet gereği hiçbir katılımcıyla ilişkilendirilmez ve burada görünmez.)"
        />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <ClipboardListIcon className="h-4 w-4 text-primary" />
        <p className="type-section">Katıldığı Anketler ({responses.length})</p>
      </div>

      {responses.map((r) => (
        <Card key={r.responseId} padded className="shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
            <div>
              <p className="type-body-strong">{r.surveyTitle}</p>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone="neutral">{r.surveyCategory}</Badge>
                <span className="flex items-center gap-1 type-caption">
                  <CalendarIcon className="h-3 w-3" />
                  {formatDate(r.submittedAt)}
                </span>
              </div>
            </div>
            <Badge tone={r.answeredQuestionCount >= r.totalQuestionCount ? 'success' : 'warning'}>
              {r.answeredQuestionCount}/{r.totalQuestionCount} soru cevaplandı
            </Badge>
          </div>

          <div className="space-y-2.5">
            {r.answers.map((a) => (
              <div key={a.questionId} className="rounded-lg border border-border/60 bg-surface-1 px-3 py-2.5">
                <p className="text-[12px] font-semibold text-foreground-muted">{a.questionText}</p>
                <p className="mt-1 text-sm font-medium text-foreground-strong">{a.answerDisplay}</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}
