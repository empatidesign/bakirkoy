import { useEffect, useState } from 'react'
import { UsersIcon, EyeIcon, MessageSquareIcon } from 'lucide-react'
import { DataTable, IconButton, Progress, EmptyState, Button } from '@/design-system'
import type { DataTableColumn, SortState } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import quizService from '@/services/quiz.service'
import type { Quiz, QuizParticipation } from '@/types/quiz.types'
import { formatDuration } from './quizConstants'
import { formatDate, maskTC } from '@/lib/utils'
import { QuizResultDetailModal } from './QuizResultDetailModal'
import { QuizSendMessageModal } from './QuizSendMessageModal'

interface Props {
  quiz: Quiz
}

const rateTone = (rate: number): 'success' | 'warning' | 'danger' => {
  if (rate >= 80) return 'success'
  if (rate >= 50) return 'warning'
  return 'danger'
}

export const QuizParticipantsTable = ({ quiz }: Props) => {
  const { can } = useAuth()
  const [rows, setRows] = useState<QuizParticipation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState | null>({ key: 'score', dir: 'desc' })
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [templateIds, setTemplateIds] = useState<string[] | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true)
      quizService
        .getParticipants(quiz.id, {
          page,
          limit,
          search: search || undefined,
          sort: sort?.key,
          order: sort?.dir,
        })
        .then((res) => {
          setRows(res.items)
          setTotal(res.total)
        })
        .catch(() => {
          setRows([])
          setTotal(0)
        })
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [quiz.id, page, limit, search, sort])

  const columns: DataTableColumn<QuizParticipation>[] = [
    {
      key: 'participant', header: 'Ad Soyad', sortable: true, sortKey: 'participantName',
      cell: (r) => (
        <div className="leading-tight">
          <span className="type-body-strong">{r.participantName}</span>
          <span className="block tabular-nums type-caption">{maskTC(r.tckn)}</span>
        </div>
      ),
    },
    { key: 'correct', header: 'Doğru', align: 'center', sortable: true, sortKey: 'correctAnswers', cell: (r) => <span className="tabular-nums text-[hsl(var(--success))]">{r.correctAnswers}</span> },
    { key: 'wrong', header: 'Yanlış', align: 'center', cell: (r) => <span className="tabular-nums text-[hsl(var(--danger))]">{r.wrongAnswers}</span> },
    {
      key: 'rate', header: 'Başarı', width: '160px',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Progress value={r.successRate} tone={rateTone(r.successRate)} className="w-20" />
          <span className="tabular-nums type-caption">%{Math.round(r.successRate)}</span>
        </div>
      ),
    },
    { key: 'score', header: 'Puan', align: 'center', sortable: true, sortKey: 'score', cell: (r) => <span className="tabular-nums type-body-strong">{r.score}</span> },
    { key: 'time', header: 'Süre', align: 'center', cell: (r) => <span className="tabular-nums type-muted">{formatDuration(r.timeSpent)}</span> },
    { key: 'completed', header: 'Tamamlanma', sortable: true, sortKey: 'completedAt', cell: (r) => <span className="whitespace-nowrap type-muted">{r.completedAt ? formatDate(r.completedAt) : '—'}</span> },
  ]

  return (
    <>
      <DataTable<QuizParticipation>
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        searchable
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Ad soyad veya TC ara..."
        page={page}
        total={total}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(l) => { setLimit(l); setPage(1) }}
        sort={sort}
        onSortChange={setSort}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        selectionActions={
          <>
            {can('quiz.edit') && (
              <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateIds(rows.filter((r) => selected.has(r.id)).map((r) => r.id))}>SMS / Bildirim Gönder</Button>
            )}
          </>
        }
        rowActions={(r) => (
          <IconButton tone="primary" title="Sonuç Detayı" onClick={() => setDetailId(r.id)}>
            <EyeIcon className="h-4 w-4" />
          </IconButton>
        )}
        empty={<EmptyState icon={UsersIcon} title="Katılım yok" description="Bu yarışmaya henüz katılım olmamış." />}
      />

      <QuizResultDetailModal quizId={quiz.id} participationId={detailId} open={detailId !== null} onClose={() => setDetailId(null)} />

      <QuizSendMessageModal open={!!templateIds} ids={templateIds ?? []} targetKind="participation" onClose={() => setTemplateIds(null)} />
    </>
  )
}
