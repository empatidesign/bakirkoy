import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MessageSquareIcon,
  UserIcon,
  UserRoundXIcon,
  ClockIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { Field, Select, Badge, EmptyState, SkeletonRows, Modal, Pagination } from '@/design-system'
import surveyService from '@/services/survey.service'
import { formatDateTime } from '@/lib/utils'
import type { Survey, SurveyResponseListItem } from '@/types/survey.types'

const LIMIT = 20

const ResponderCell = ({ r }: { r: SurveyResponseListItem }) => {
  if (r.isAnonymous) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground-muted))]">
          <UserRoundXIcon className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <span className="type-body-strong">{r.anonymousLabel ?? 'Anonim'}</span>
          <span className="block type-caption">Kimlik gizli — anket anonim</span>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
        <UserIcon className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <span className="type-body-strong">{r.responderName ?? 'Bilinmiyor'}</span>
        {r.responderTcLast4 && <span className="block type-caption">TC: ***{r.responderTcLast4}</span>}
      </div>
    </div>
  )
}

const ResponseDetailModal = ({ response, onClose }: { response: SurveyResponseListItem; onClose: () => void }) => (
  <Modal open onClose={onClose} title="Yanıt Detayı" subtitle={formatDateTime(response.submittedAt)} width={640}>
    <div className="space-y-4 p-6">
      <div className="rounded-card border border-[hsl(var(--border))] bg-[hsl(var(--surface-0))] p-3">
        <ResponderCell r={response} />
      </div>
      <div className="space-y-3">
        {response.answers.length === 0 ? (
          <p className="type-muted">Bu yanıtta cevaplanmış soru bulunamadı.</p>
        ) : (
          response.answers.map((a, i) => (
            <div key={a.questionId + i} className="rounded-card border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <p className="type-body-strong">{a.questionText}</p>
                <Badge tone="neutral">{a.questionType}</Badge>
              </div>
              <p className="rounded-field border border-[hsl(var(--border))] bg-[hsl(var(--surface-0))] px-2.5 py-1.5 type-body">
                {a.answerDisplay}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  </Modal>
)

export const SurveyResponsesTab = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const surveyId = searchParams.get('surveyId') ?? ''
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [responses, setResponses] = useState<SurveyResponseListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<SurveyResponseListItem | null>(null)

  useEffect(() => {
    surveyService.getList({ page: 1, limit: 100 }).then((r) => setSurveys(r.items)).catch(() => setSurveys([]))
  }, [])

  useEffect(() => { setPage(1) }, [surveyId])

  useEffect(() => {
    if (!surveyId) { setResponses([]); setTotal(0); return }
    setLoading(true)
    surveyService.getResponses(surveyId, { page, limit: LIMIT })
      .then((r) => { setResponses(r.items); setTotal(r.total) })
      .catch(() => { setResponses([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [surveyId, page])

  const selectSurvey = (id: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      if (id) n.set('surveyId', id)
      else n.delete('surveyId')
      return n
    })

  const selectedSurvey = surveys.find((s) => s.id === surveyId)
  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-4">
      <div className="max-w-md">
        <Field label="Anket">
          <Select value={surveyId} onChange={(e) => selectSurvey(e.target.value)} placeholder="Yanıtlarını görmek için anket seçin">
            <option value="">Anket seçin</option>
            {surveys.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          </Select>
        </Field>
      </div>

      {!surveyId ? (
        <EmptyState icon={MessageSquareIcon} title="Anket seçin" description="Bireysel yanıtlarını görmek istediğiniz anketi yukarıdan seçin." />
      ) : loading ? (
        <SkeletonRows rows={6} />
      ) : responses.length === 0 ? (
        <EmptyState icon={MessageSquareIcon} title="Yanıt yok" description="Bu ankete henüz kimse yanıt vermemiş." />
      ) : (
        <div className="overflow-hidden rounded-card border border-[hsl(var(--border))] bg-[hsl(var(--surface-0))]">
          {selectedSurvey?.isAnonymous && (
            <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-4 py-2 type-caption">
              🔒 Bu anket anonim olarak tasarlandı — yanıt verenlerin gerçek kimliği (isim/TC) hiçbir şekilde gösterilmez.
            </div>
          )}
          <ul className="divide-y divide-[hsl(var(--border))]">
            {responses.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setSelected(r)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[hsl(var(--surface-1))]"
                >
                  <ResponderCell r={r} />
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 type-caption">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {formatDateTime(r.submittedAt)}
                    </span>
                    <Badge tone="primary">{r.answeredQuestionCount}/{r.totalQuestionCount} soru</Badge>
                    <ChevronRightIcon className="h-4 w-4 text-[hsl(var(--foreground-muted))]" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={setPage} />
          )}
        </div>
      )}

      {selected && <ResponseDetailModal response={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
