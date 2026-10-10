import { useCallback, useEffect, useState } from 'react'
import {
  MegaphoneIcon, BellRingIcon, FlameIcon, EyeIcon, ImageIcon, MessageSquareIcon,
} from 'lucide-react'
import { Badge, EmptyState, IconButton, DataTable, Button } from '@/design-system'
import type { DataTableColumn } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import muhtarlikService from '@/services/muhtarlik.service'
import { filtersToParams, timeAgo } from './muhtarlikHelpers'
import {
  SUBMISSION_TYPE_LABELS, SUBMISSION_TYPE_TONE,
  PRIORITY_LABELS, PRIORITY_TONE,
  STATUS_LABELS, STATUS_TONE,
  categoryLabel, complaintReasonLabel,
} from '@/types/muhtarlik.types'
import type { CitizenSubmission, SubmissionFilters, SubmissionSort } from '@/types/muhtarlik.types'
import { MuhtarlikSendMessageModal } from './MuhtarlikSendMessageModal'

const SORT_PARAMS: Record<SubmissionSort, { sort: string; order: 'asc' | 'desc' }> = {
  newest: { sort: 'submittedAt', order: 'desc' },
  oldest: { sort: 'submittedAt', order: 'asc' },
  priority: { sort: 'priority', order: 'desc' },
  neighborhood: { sort: 'neighborhood', order: 'asc' },
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const DEFAULT_PAGE_SIZE = 25

interface SubmissionListTabProps {
  filters: SubmissionFilters
  refreshSignal: number
  onSelect: (submission: CitizenSubmission) => void
  onToggleNotify: (submission: CitizenSubmission) => void
}

export const SubmissionListTab = ({ filters, refreshSignal, onSelect, onToggleNotify }: SubmissionListTabProps) => {
  const { can, getFacilityScope } = useAuth()
  const isMuhtarScoped = getFacilityScope('muhtarlik') !== null
  const now = Date.now()
  const [rows, setRows] = useState<CitizenSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [pageOffset, setPageOffset] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [templateIds, setTemplateIds] = useState<string[] | null>(null)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const { sort, order } = SORT_PARAMS[filters.sort]
      const res = await muhtarlikService.getList({ page, limit, sort, order, ...filtersToParams(filters) })
      setRows(res.items)
      setTotal(res.total)
      setTotalPages(res.totalPages)
      setPageOffset((page - 1) * limit)
    } catch {
      setRows([])
      setTotal(0)
      setTotalPages(1)
      setPageOffset(0)
    } finally {
      setLoading(false)
    }
  }, [page, limit, filters])

  useEffect(() => { fetchList() }, [fetchList, refreshSignal])
  useEffect(() => { setPage(1) }, [filters, limit])

  const columns: DataTableColumn<CitizenSubmission>[] = [
    {
      key: 'rowNo',
      header: '#',
      hideable: false,
      cell: (_, idx) => (
        <span className="tabular-nums text-[12px] font-semibold text-foreground-muted">
          {pageOffset + (idx ?? 0) + 1}
        </span>
      ),
    },
    {
      key: 'submittedAt',
      header: 'Tarih',
      hideable: false,
      cell: (c) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-semibold text-foreground-strong tabular-nums">
            {new Date(c.submittedAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span className="text-[11px] text-foreground-subtle">{timeAgo(c.submittedAt, now)}</span>
        </div>
      ),
    },
    {
      key: 'title',
      header: 'Konu',
      hideable: false,
      cell: (c) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {c.notifyMuhtar && <BellRingIcon className="h-3.5 w-3.5 shrink-0 text-primary" />}
            <p className="type-body-strong truncate max-w-[200px]">{c.title}</p>
          </div>
          <p className="mt-0.5 text-[12px] text-foreground-muted line-clamp-1 max-w-[200px]">{c.description}</p>
        </div>
      ),
    },
    {
      key: 'submissionType',
      header: 'İstek Türü',
      cell: (c) => {
        const reason = complaintReasonLabel(c.complaintReason)
        return (
          <div className="flex flex-col gap-1">
            <Badge tone={SUBMISSION_TYPE_TONE[c.submissionType]}>{SUBMISSION_TYPE_LABELS[c.submissionType]}</Badge>
            {reason && <span className="text-[11px] text-foreground-subtle truncate max-w-[120px]">{reason}</span>}
          </div>
        )
      },
    },
    {
      key: 'categoryId',
      header: 'Kategori',
      cell: (c) => (
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
          style={{ background: '#f1f5f9', color: '#475569' }}
        >
          {categoryLabel(c.categoryId)}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Öncelik',
      cell: (c) => (
        <Badge tone={PRIORITY_TONE[c.priority]}>
          {c.priority === 'urgent' && <FlameIcon className="mr-0.5 h-2.5 w-2.5" />}
          {PRIORITY_LABELS[c.priority]}
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      cell: (c) => <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABELS[c.status]}</Badge>,
    },
    {
      key: 'neighborhood',
      header: 'Mahalle',
      cell: (c) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[12px] font-medium text-foreground-strong">{c.neighborhood}</span>
          {c.muhtarName && (
            <span className="text-[11px] text-foreground-subtle">Mh: {c.muhtarName}</span>
          )}
        </div>
      ),
    },
    {
      key: 'citizenName',
      header: 'Vatandaş',
      cell: (c) => (
        <div className="flex flex-col gap-0.5">
          <span
            className={c.isIdentityHidden
              ? 'text-[12px] italic text-foreground-subtle'
              : 'text-[12px] font-semibold text-foreground-strong'}
          >
            {c.citizenName}
          </span>
          {c.photoCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[11px] text-foreground-subtle">
              <ImageIcon className="h-3 w-3" />{c.photoCount} foto
            </span>
          )}
          {c.ulakbelTrackingNo && (
            <span className="text-[10px] tabular-nums text-foreground-subtle">#{c.ulakbelTrackingNo}</span>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable<CitizenSubmission>
      title="Gelen Talepler"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      loading={loading}
      selectable
      selected={selected}
      onSelectedChange={setSelected}
      selectionActions={
        can('muhtarlik.edit') && (
          <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateIds(rows.filter((r) => selected.has(r.id)).map((r) => r.id))}>
            Şablonlu Mesaj Gönder
          </Button>
        )
      }
      page={page}
      totalPages={totalPages}
      total={total}
      limit={limit}
      onLimitChange={(l) => setLimit(l)}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      onPageChange={setPage}
      rowActions={(c) => (
        <>
          <IconButton tone="default" title="Detayları görüntüle" onClick={() => onSelect(c)}>
            <EyeIcon className="h-4 w-4" />
          </IconButton>
          {!isMuhtarScoped && (
            <IconButton
              tone={c.notifyMuhtar ? 'primary' : 'default'}
              title={c.notifyMuhtar ? 'Muhtar bildirimini kapat' : 'Muhtara bildir'}
              onClick={() => onToggleNotify(c)}
            >
              <BellRingIcon className="h-4 w-4" />
            </IconButton>
          )}
        </>
      )}
      empty={<EmptyState icon={MegaphoneIcon} title="Kayıt bulunamadı" description="Filtreyle eşleşen başvuru bulunmuyor." />}
      />
      <MuhtarlikSendMessageModal open={!!templateIds} ids={templateIds ?? []} onClose={() => setTemplateIds(null)} />
    </>
  )
}
