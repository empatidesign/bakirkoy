import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  UsersRoundIcon, SearchIcon, CoffeeIcon, LogOutIcon, ArmchairIcon, ClockIcon,
  ScanLineIcon, SendIcon,
} from 'lucide-react'
import {
  SectionToolbar, DataTable, FilterBar, FilterField, Input, TcknInput, Badge, IconButton, Button,
  EmptyState, ConfirmModal, Modal, type DataTableColumn, type SortState,
} from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import libraryService from '@/services/library.service'
import type { Occupant, LibraryReadFloor } from '@/types/library.types'
import type { PagedResult } from '@/types/common'
import { KrokiViewerModal, useKrokiViewer, KrokiIcon } from '@/components/specialized/KrokiViewerModal'
import { fmtTime, fmtDuration } from './libraryHelpers'
import { LibrarySendMessageModal } from './LibrarySendMessageModal'

export const InsideTab = ({ libraryId, floors, entryControlMode, onChanged, refreshKey }: { libraryId: string; floors: LibraryReadFloor[]; entryControlMode?: string; onChanged?: () => void; refreshKey?: number }) => {
  const { can } = useAuth()
  const canManage = can('library.edit')
  const [result, setResult] = useState<PagedResult<Occupant> | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [sort, setSort] = useState<SortState | null>({ key: 'entry', dir: 'asc' })
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [exiting, setExiting] = useState<Occupant | null>(null)
  const [busy, setBusy] = useState(false)
  const [checkInOpen, setCheckInOpen] = useState(false)
  const [checkInTckn, setCheckInTckn] = useState('')
  const [checkInBusy, setCheckInBusy] = useState(false)
  const [messageOpen, setMessageOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkExitOpen, setBulkExitOpen] = useState(false)
  const kroki = useKrokiViewer()

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit }
      if (search) params.search = search
      if (sort) { params.sort = sort.key; params.order = sort.dir }
      setResult(await libraryService.occupants.getList(libraryId, params))
    } catch { setResult(null) } finally { setLoading(false) }
  }, [libraryId, page, limit, sort, search])
  useEffect(() => { fetchList() }, [fetchList])
  useEffect(() => { if (refreshKey) fetchList() }, [refreshKey, fetchList])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const handleCheckIn = async () => {
    if (checkInTckn.trim().length !== 11) return
    setCheckInBusy(true)
    try {
      const method = entryControlMode === 'manual' ? 'manual' : 'qr'
      const result = await libraryService.checkIn(libraryId, { tckn: checkInTckn.trim(), method })
      if (result.queued) {
        toast.info(`Kütüphane dolu, sıraya alındı (${result.queueNumber ?? ''}).`)
      } else {
        toast.success(result.message || 'Giriş kaydedildi.')
      }
      if (result.overdueCount && result.overdueCount > 0) {
        const list = (result.overdueBooks ?? []).slice(0, 5).map((b) => `• ${b.title} (${b.daysOverdue} gün gecikmiş)`).join('\n')
        toast.warning(`Bu üyenin iade tarihi geçmiş ${result.overdueCount} kitabı var`, { description: list, duration: 15000 })
      }
      setCheckInOpen(false)
      setCheckInTckn('')
      fetchList(); onChanged?.()
    } finally { setCheckInBusy(false) }
  }

  const confirmExit = async () => {
    if (!exiting) return
    setBusy(true)
    try {
      await libraryService.occupants.exit(exiting.id)
      toast.success(`${exiting.memberName} çıkışı kaydedildi.`)
      setExiting(null)
      fetchList(); onChanged?.()
    } finally { setBusy(false) }
  }

  const confirmBulkExit = async () => {
    setBusy(true)
    try {
      const ids = [...selected]
      const results = await Promise.allSettled(ids.map((id) => libraryService.occupants.exit(id)))
      const ok = results.filter((r) => r.status === 'fulfilled').length
      if (ok > 0) toast.success(`${ok} üyenin çıkışı kaydedildi.`)
      setSelected(new Set())
      setBulkExitOpen(false)
      fetchList(); onChanged?.()
    } finally { setBusy(false) }
  }

  const rows = result?.items ?? []
  const hasFloors = floors.length > 0

  const columns: DataTableColumn<Occupant>[] = [
    { key: 'member', header: 'Üye', cell: (r) => <span className="type-body-strong">{r.memberName}</span> },
    {
      key: 'seat', header: 'Koltuk', align: 'center',
      cell: (r) => (
        <div className="flex items-center justify-center gap-1">
          {r.seat ? <Badge tone="neutral"><ArmchairIcon className="mr-1 inline h-3 w-3" />{r.seat}</Badge> : <span className="type-muted">—</span>}
          {hasFloors && (
            <IconButton title="Oturma planı krokisini gör" onClick={() => kroki.show(r.floorId)}>
              <KrokiIcon className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </div>
      ),
    },
    { key: 'entry', header: 'Giriş Saati', sortable: true, sortKey: 'entry', cell: (r) => <span className="tabular-nums type-muted"><ClockIcon className="mr-1 inline h-3 w-3 text-success" />{fmtTime(r.entryTime)}</span> },
    { key: 'duration', header: 'İçerde Kalma', sortable: true, sortKey: 'duration', cell: (r) => <span className="tabular-nums text-foreground-strong">{fmtDuration(r.durationMinutes)}</span> },
    {
      key: 'breaks', header: 'Mola Hakkı', align: 'center',
      cell: (r) => (
        <div className="flex justify-center gap-1.5">
          <Badge tone={r.shortBreaksRemaining === 0 ? 'danger' : 'neutral'}>Kısa {r.shortBreaksRemaining}</Badge>
          <Badge tone={r.longBreaksRemaining === 0 ? 'danger' : 'neutral'}>Uzun {r.longBreaksRemaining}</Badge>
        </div>
      ),
    },
    {
      key: 'status', header: 'Durum', align: 'center',
      cell: (r) => r.status === 'on_break'
        ? (r.breakType === 'long'
          ? <Badge tone="warning" className="bg-[hsl(var(--accent-orange-soft))] text-[hsl(var(--accent-orange))]"><CoffeeIcon className="mr-1 inline h-3 w-3" />Uzun Molada</Badge>
          : <Badge tone="warning"><CoffeeIcon className="mr-1 inline h-3 w-3" />Kısa Molada</Badge>)
        : <Badge tone="success">İçeride</Badge>,
    },
  ]

  return (
    <div className="space-y-4">
      <SectionToolbar
        icon={UsersRoundIcon}
        title="İçeridekiler"
        subtitle="Şu anda kütüphanede bulunan üyeler"
        actions={
          <>
            {hasFloors && (
              <Button variant="outline" size="sm" onClick={() => kroki.show(null)}>
                <KrokiIcon className="h-4 w-4" /> Kroki
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => { setCheckInTckn(''); setCheckInOpen(true) }}>
              <ScanLineIcon className="h-4 w-4" /> Cihaz Okudu
            </Button>
            {canManage && (
              <Button variant="outline" size="sm" onClick={() => setMessageOpen(true)}>
                <SendIcon className="h-4 w-4" /> Şablonlu Mesaj Gönder
              </Button>
            )}
          </>
        }
      />

      <FilterBar columns={1} hasActiveFilters={!!searchInput} onClear={() => { setSearchInput(''); setSearch(''); setPage(1) }}>
        <FilterField label="Ara">
          <Input placeholder="Üye adı veya koltuk ara..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} iconLeft={<SearchIcon className="h-3.5 w-3.5" />} />
        </FilterField>
      </FilterBar>

      <DataTable<Occupant>
        title="Aktif Kullanıcılar"
        showRowNumbers
        selectable={canManage}
        selected={selected}
        onSelectedChange={setSelected}
        selectionActions={
          <Button variant="danger" size="sm" onClick={() => setBulkExitOpen(true)}>
            <LogOutIcon className="h-4 w-4" /> Seçilenlere Çıkış Ver
          </Button>
        }
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
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1) }}
        rowActions={(r) => (
          <>
            <IconButton
              tone="danger"
              disabled={!canManage}
              title={!canManage ? 'Bu işlem yalnızca yöneticiler tarafından yapılabilir.' : 'Çıkış kaydet'}
              onClick={() => setExiting(r)}
            >
              <LogOutIcon className="h-4 w-4" />
            </IconButton>
          </>
        )}
        empty={<EmptyState icon={UsersRoundIcon} title="İçeride kimse yok" description="Şu anda kütüphanede bulunan üye bulunmuyor." />}
      />

      <ConfirmModal
        open={!!exiting}
        onClose={() => setExiting(null)}
        onConfirm={confirmExit}
        loading={busy}
        tone="danger"
        title="Çıkış Kaydet"
        description={`"${exiting?.memberName}" için çıkış kaydedilecek ve koltuk serbest bırakılacak. Devam edilsin mi?`}
        confirmLabel="Çıkış Kaydet"
      />

      <ConfirmModal
        open={bulkExitOpen}
        onClose={() => setBulkExitOpen(false)}
        onConfirm={confirmBulkExit}
        loading={busy}
        tone="danger"
        title="Toplu Çıkış"
        description={`Seçili ${selected.size} üye için çıkış kaydedilecek ve koltukları serbest bırakılacak. Devam edilsin mi?`}
        confirmLabel="Çıkış Kaydet"
      />

      <Modal
        open={checkInOpen}
        onClose={() => setCheckInOpen(false)}
        title="Cihaz Okudu — Giriş"
        subtitle="TC kimlik numarasını girerek giriş kaydedin"
        width={400}
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setCheckInOpen(false)}>İptal</Button>
            <Button variant="primary" className="flex-1" disabled={checkInTckn.trim().length !== 11} isLoading={checkInBusy} onClick={handleCheckIn}>Giriş Yaptır</Button>
          </div>
        }
      >
        <div className="p-6 space-y-1.5">
          <p className="type-label">TC Kimlik No</p>
          <TcknInput value={checkInTckn} onChange={(v) => setCheckInTckn(v)} autoFocus />
        </div>
      </Modal>

      <KrokiViewerModal open={kroki.open} onClose={kroki.hide} floors={floors} initialFloorId={kroki.floorId} />
      <LibrarySendMessageModal open={messageOpen} libraryId={libraryId} onClose={() => setMessageOpen(false)} />
    </div>
  )
}
