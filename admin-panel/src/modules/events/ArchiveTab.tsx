import { useCallback, useEffect, useState } from 'react'
import { ArchiveIcon, Undo2Icon, Trash2Icon, HistoryIcon, SearchIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  DataTable, FilterBar, Input, Badge, IconButton, Banner, EmptyState, ConfirmModal, Button,
  type DataTableColumn, type SortState,
} from '@/design-system'
import eventService from '@/services/event.service'
import { useAuth } from '@/framework/auth/AuthContext'
import { EventAuditModal } from './EventAuditModal'
import type { Event } from '@/types/event.types'
import type { PagedResult } from '@/types/common'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')
const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—')

export const ArchiveTab = () => {
  const { state } = useAuth()
  const isSuperAdmin = state.status === 'authenticated' && state.user.isSuperAdmin === true

  const [result, setResult] = useState<PagedResult<Event> | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortState | null>({ key: 'deletedAt', dir: 'desc' })
  const [auditEvent, setAuditEvent] = useState<Event | null>(null)
  const [purgeId, setPurgeId] = useState<string | null>(null)
  const [purging, setPurging] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkType, setBulkType] = useState<'restore' | 'delete' | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { page, limit }
      if (search) params.search = search
      if (sort) { params.sort = sort.key; params.order = sort.dir }
      setResult(await eventService.getTrash(params))
      setSelected(new Set())
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, sort])
  useEffect(() => { fetchList() }, [fetchList])

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [searchInput])

  const restore = async (id: string) => {
    try {
      await eventService.restore(id)
      toast.success('Etkinlik geri yüklendi.')
      fetchList()
    } catch {
      toast.error('Etkinlik geri yüklenemedi.')
    }
  }

  const purge = async (id: string) => {
    if (purging) return
    setPurging(true)
    try {
      await eventService.permanentDelete(id)
      toast.success('Etkinlik kalıcı olarak silindi.')
      setPurgeId(null)
      fetchList()
    } catch {
      toast.error('Etkinlik silinemedi.')
    } finally {
      setPurging(false)
    }
  }

  const rows = result?.items ?? []
  const selectedRows = rows.filter((r) => selected.has(r.id))

  const runBulk = async () => {
    if (!bulkType || bulkBusy) return
    if (bulkType === 'delete' && !isSuperAdmin) return
    setBulkBusy(true)
    try {
      const results = bulkType === 'restore'
        ? await Promise.allSettled(selectedRows.map((r) => eventService.restore(r.id)))
        : await Promise.allSettled(selectedRows.map((r) => eventService.permanentDelete(r.id)))
      const failed = results.filter((r) => r.status === 'rejected').length
      const okCount = results.length - failed
      if (okCount > 0) {
        toast.success(bulkType === 'restore'
          ? `${okCount} etkinlik geri yüklendi.`
          : `${okCount} etkinlik kalıcı olarak silindi.`)
      }
      if (failed > 0) {
        toast.error(bulkType === 'restore'
          ? `${failed} etkinlik geri yüklenemedi.`
          : `${failed} etkinlik silinemedi.`)
      }
      setBulkType(null); setSelected(new Set()); fetchList()
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkMessages = {
    restore: { title: 'Seçili Etkinlikleri Geri Yükle', description: `Seçili ${selectedRows.length} etkinlik arşivden çıkarılıp tekrar listeye eklenecek.` },
    delete: { title: 'Seçili Etkinlikleri Kalıcı Sil', description: `Bu işlem geri alınamaz. Seçili ${selectedRows.length} etkinlik kalıcı olarak silinecek.` },
  }

  const columns: DataTableColumn<Event>[] = [
    { key: 'code', header: 'Kod', sortable: true, sortKey: 'code', cell: (r) => <span className="tabular-nums type-muted">#{r.code}</span> },
    {
      key: 'event', header: 'Etkinlik', sortable: true, sortKey: 'name',
      cell: (r) => (
        <div className="leading-tight">
          <span className="type-body-strong">{r.name}</span>
          <span className="block type-caption">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</span>
        </div>
      ),
    },
    { key: 'category', header: 'Kategori', cell: (r) => <Badge color={r.categoryColor}>{r.categoryName}</Badge> },
    { key: 'deletedBy', header: 'Silen', cell: (r) => <span className="type-muted">{r.deletedBy ?? '—'}</span> },
    { key: 'deletedAt', header: 'Silinme Tarihi', sortable: true, sortKey: 'deletedAt', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDateTime(r.deletedAt)}</span> },
  ]

  return (
    <>
      <Banner tone="warning" variant="soft" icon={ArchiveIcon}>
        Silinen etkinlikler kalıcı olarak silinmez; geri yüklenebilir. Kalıcı silme geri alınamaz.
      </Banner>

      <FilterBar
        search={
          <Input
            placeholder="Etkinlik adı veya kod ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        }
        hasActiveFilters={!!searchInput}
        onClear={() => { setSearchInput(''); setSearch(''); setPage(1) }}
      />

      <DataTable<Event>
        title="Silinen Etkinlikler"
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
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1) }}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        selectionActions={
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={() => setBulkType('restore')}>
              <Undo2Icon className="h-3.5 w-3.5 text-primary" /> Geri Yükle
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-danger hover:bg-danger-soft"
              disabled={!isSuperAdmin}
              title={isSuperAdmin ? undefined : 'Kalıcı silme yalnızca süper admin'}
              onClick={() => setBulkType('delete')}
            >
              <Trash2Icon className="h-3.5 w-3.5" /> Kalıcı Sil
            </Button>
            <Button variant="ghost" size="sm" className="ml-1" onClick={() => setSelected(new Set())}>Seçimi temizle</Button>
          </div>
        }
        rowActions={(row) => (
          <>
            <IconButton title="İşlem geçmişi" onClick={() => setAuditEvent(row)}>
              <HistoryIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="success" title="Geri yükle" onClick={() => restore(row.id)}>
              <Undo2Icon className="h-4 w-4" />
            </IconButton>
            <IconButton
              tone="danger"
              title={isSuperAdmin ? 'Kalıcı sil' : 'Kalıcı silme yalnızca süper admin'}
              disabled={!isSuperAdmin}
              onClick={() => setPurgeId(row.id)}
            >
              <Trash2Icon className="h-4 w-4" />
            </IconButton>
          </>
        )}
        empty={
          <EmptyState
            icon={ArchiveIcon}
            title="Çöp kutusu boş"
            description="Silinen etkinlikler burada listelenir ve geri yüklenebilir."
          />
        }
      />

      <EventAuditModal event={auditEvent} onClose={() => setAuditEvent(null)} />

      <ConfirmModal
        open={!!purgeId}
        onClose={() => setPurgeId(null)}
        onConfirm={() => purgeId && purge(purgeId)}
        icon={Trash2Icon}
        tone="danger"
        title="Etkinliği Kalıcı Sil"
        description="Bu etkinlik kalıcı olarak silinecek ve geri alınamayacak. Devam edilsin mi?"
        confirmLabel="Evet, Kalıcı Sil"
        loading={purging}
      />

      <ConfirmModal
        open={!!bulkType}
        onClose={() => setBulkType(null)}
        onConfirm={runBulk}
        icon={bulkType === 'delete' ? Trash2Icon : Undo2Icon}
        title={bulkType ? bulkMessages[bulkType].title : ''}
        description={bulkType ? bulkMessages[bulkType].description : ''}
        confirmLabel={bulkType === 'delete' ? 'Evet, Kalıcı Sil' : 'Geri Yükle'}
        tone={bulkType === 'delete' ? 'danger' : 'primary'}
        loading={bulkBusy}
      />
    </>
  )
}
