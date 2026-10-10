import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  CoffeeIcon, SearchIcon, PlayIcon, AlertTriangleIcon, ArmchairIcon, ClockIcon,
} from 'lucide-react'
import {
  SectionToolbar, DataTable, FilterBar, FilterField, Input, Textarea, Badge, IconButton, Button,
  EmptyState, ConfirmModal, Modal, type DataTableColumn,
} from '@/design-system'
import libraryService from '@/services/library.service'
import { BREAK_TYPE_LABELS, BREAK_TYPE_TONE } from '@/types/library.types'
import type { LibraryBreak, LibraryReadFloor } from '@/types/library.types'
import type { PagedResult } from '@/types/common'
import { KrokiViewerModal, useKrokiViewer, KrokiIcon } from '@/components/specialized/KrokiViewerModal'
import { fmtTime, fmtRemaining } from './libraryHelpers'

export const OnBreakTab = ({ libraryId, floors, onChanged, refreshKey }: { libraryId: string; floors: LibraryReadFloor[]; onChanged?: () => void; refreshKey?: number }) => {
  const [result, setResult] = useState<PagedResult<LibraryBreak> | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [ending, setEnding] = useState<LibraryBreak | null>(null)
  const [warning, setWarning] = useState<LibraryBreak | null>(null)
  const [warnMsg, setWarnMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const kroki = useKrokiViewer()

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit }
      if (search) params.search = search
      setResult(await libraryService.breaks.getList(libraryId, params))
    } catch { setResult(null) } finally { setLoading(false) }
  }, [libraryId, page, limit, search])
  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => { if (refreshKey) fetchList() }, [refreshKey, fetchList])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const confirmEnd = async () => {
    if (!ending) return
    setBusy(true)
    try {
      await libraryService.breaks.end(ending.id)
      toast.success(`${ending.memberName} molası bitirildi.`)
      setEnding(null)
      fetchList(); onChanged?.()
    } finally { setBusy(false) }
  }

  const sendWarning = async () => {
    if (!warning || !warnMsg.trim()) return
    setBusy(true)
    try {
      await libraryService.breaks.warn(warning.memberId, warnMsg.trim())
      toast.success('Uyarı gönderildi.')
      setWarning(null); setWarnMsg('')
    } finally { setBusy(false) }
  }

  const rows = result?.items ?? []
  const hasFloors = floors.length > 0

  const columns: DataTableColumn<LibraryBreak>[] = [
    { key: 'member', header: 'Üye', cell: (r) => <span className="type-body-strong">{r.memberName}</span> },
    { key: 'type', header: 'Mola Tipi', align: 'center', cell: (r) => <Badge tone={BREAK_TYPE_TONE[r.type]}>{BREAK_TYPE_LABELS[r.type]}</Badge> },
    { key: 'start', header: 'Başlangıç', cell: (r) => <span className="tabular-nums type-muted"><ClockIcon className="mr-1 inline h-3 w-3" />{fmtTime(r.startTime)}</span> },
    {
      key: 'remaining', header: 'Kalan Süre', align: 'center',
      cell: (r) => <span className={r.remainingMinutes <= 0 ? 'type-body-strong text-danger' : r.remainingMinutes <= 5 ? 'type-body-strong text-warning' : 'tabular-nums text-foreground-strong'}>{fmtRemaining(r.remainingMinutes)}</span>,
    },
    {
      key: 'seat', header: 'Koltuk Durumu', align: 'center',
      cell: (r) => (
        <div className="flex items-center justify-center gap-1">
          {r.seatHeld
            ? <Badge tone="success"><ArmchairIcon className="mr-1 inline h-3 w-3" />Tutuldu{r.seat ? ` · ${r.seat}` : ''}</Badge>
            : <Badge tone="danger">Serbest</Badge>}
          {hasFloors && (
            <IconButton title="Oturma planı krokisini gör" onClick={() => kroki.show(r.floorId)}>
              <KrokiIcon className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <SectionToolbar
        icon={CoffeeIcon}
        title="Molada Olanlar"
        subtitle="Aktif moladaki üyeler"
        actions={hasFloors && (
          <Button variant="outline" size="sm" onClick={() => kroki.show(null)}>
            <KrokiIcon className="h-4 w-4" /> Kroki
          </Button>
        )}
      />

      <FilterBar columns={1} hasActiveFilters={!!searchInput} onClear={() => { setSearchInput(''); setSearch(''); setPage(1) }}>
        <FilterField label="Ara">
          <Input placeholder="Üye adı ara..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} iconLeft={<SearchIcon className="h-3.5 w-3.5" />} />
        </FilterField>
      </FilterBar>

      <DataTable<LibraryBreak>
        title="Aktif Molalar"
        showRowNumbers
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        page={result?.page ?? 1}
        totalPages={result?.totalPages ?? 1}
        total={result?.total ?? 0}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(n) => { setLimit(n); setPage(1) }}
        rowActions={(r) => (
          <>
            <IconButton tone="success" title="Molayı bitir" onClick={() => setEnding(r)}><PlayIcon className="h-4 w-4" /></IconButton>
            <IconButton tone="warning" title="Uyarı gönder" onClick={() => { setWarning(r); setWarnMsg('') }}><AlertTriangleIcon className="h-4 w-4" /></IconButton>
          </>
        )}
        empty={<EmptyState icon={CoffeeIcon} title="Molada kimse yok" description="Şu anda molada olan üye bulunmuyor." />}
      />

      <ConfirmModal
        open={!!ending}
        onClose={() => setEnding(null)}
        onConfirm={confirmEnd}
        loading={busy}
        tone="primary"
        title="Molayı Bitir"
        description={`"${ending?.memberName}" için molayı bitirmek istediğinizden emin misiniz?`}
        confirmLabel="Molayı Bitir"
      />

      <Modal
        open={!!warning}
        onClose={() => setWarning(null)}
        title="Uyarı Gönder"
        subtitle={warning?.memberName}
        width={440}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setWarning(null)}>İptal</Button>
            <Button variant="primary" className="flex-1" disabled={!warnMsg.trim()} isLoading={busy} onClick={sendWarning}>Gönder</Button>
          </div>
        }
      >
        <div className="space-y-1.5">
          <p className="type-label">Uyarı Mesajı</p>
          <Textarea rows={3} placeholder="Örn. Mola süreniz doldu, lütfen koltuğunuza dönün." value={warnMsg} onChange={(e) => setWarnMsg(e.target.value)} />
        </div>
      </Modal>

      <KrokiViewerModal open={kroki.open} onClose={kroki.hide} floors={floors} initialFloorId={kroki.floorId} />
    </div>
  )
}
