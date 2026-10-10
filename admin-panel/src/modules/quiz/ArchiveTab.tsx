import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ArchiveIcon, RotateCcwIcon, Trash2Icon } from 'lucide-react'
import { DataTable, IconButton, Badge, Button, ConfirmModal, EmptyState } from '@/design-system'
import type { DataTableColumn } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import quizService from '@/services/quiz.service'
import { QUIZ_STATUS_LABELS, QUIZ_STATUS_TONE } from '@/types/quiz.types'
import type { Quiz } from '@/types/quiz.types'
import { formatDate } from '@/lib/utils'

export const ArchiveTab = () => {
  const { state, can } = useAuth()
  const isSuperAdmin = state.status === 'authenticated' && state.user.isSuperAdmin === true
  const canRestore = can('quiz.edit')

  const [rows, setRows] = useState<Quiz[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  const [restoreRow, setRestoreRow] = useState<Quiz | null>(null)
  const [deleteRow, setDeleteRow] = useState<Quiz | null>(null)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkType, setBulkType] = useState<'restore' | 'delete' | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true)
      quizService
        .getList({ archived: 'true', page, limit, search: search || undefined })
        .then((res) => { setRows(res.items); setTotal(res.total); setSelected(new Set()) })
        .catch(() => { setRows([]); setTotal(0) })
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(handle)
  }, [page, limit, search, reload])

  const refresh = () => setReload((r) => r + 1)

  const doRestore = async () => {
    if (!restoreRow || busy) return
    setBusy(true)
    try {
      await quizService.restore(restoreRow.id)
      toast.success('Yarışma geri alındı.')
      setRestoreRow(null)
      refresh()
    } catch {
      toast.error('Yarışma geri alınamadı.')
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    if (!deleteRow || busy) return
    setBusy(true)
    try {
      await quizService.hardDelete(deleteRow.id)
      toast.success('Yarışma kalıcı olarak silindi.')
      setDeleteRow(null)
      refresh()
    } catch {
      toast.error('Yarışma silinemedi.')
    } finally {
      setBusy(false)
    }
  }

  const selectedRows = rows.filter((r) => selected.has(r.id))

  const runBulk = async () => {
    if (!bulkType || bulkBusy) return
    if (bulkType === 'delete' && !isSuperAdmin) return
    setBulkBusy(true)
    try {
      const results = bulkType === 'restore'
        ? await Promise.allSettled(selectedRows.map((r) => quizService.restore(r.id)))
        : await Promise.allSettled(selectedRows.map((r) => quizService.hardDelete(r.id)))
      const failed = results.filter((r) => r.status === 'rejected').length
      const okCount = results.length - failed
      if (okCount > 0) {
        toast.success(bulkType === 'restore'
          ? `${okCount} yarışma geri alındı.`
          : `${okCount} yarışma kalıcı olarak silindi.`)
      }
      if (failed > 0) {
        toast.error(bulkType === 'restore'
          ? `${failed} yarışma geri alınamadı.`
          : `${failed} yarışma silinemedi.`)
      }
      setBulkType(null); setSelected(new Set()); refresh()
    } finally {
      setBulkBusy(false)
    }
  }

  const bulkMessages = {
    restore: { title: 'Seçili Yarışmaları Geri Al', description: `Seçili ${selectedRows.length} yarışma arşivden çıkarılıp tekrar listeye eklenecek.` },
    delete: { title: 'Seçili Yarışmaları Kalıcı Sil', description: `Bu işlem geri alınamaz. Seçili ${selectedRows.length} yarışma ve tüm ilişkili veriler kalıcı olarak silinecek.` },
  }

  const columns: DataTableColumn<Quiz>[] = [
    {
      key: 'title', header: 'Başlık',
      cell: (r) => (
        <div className="leading-tight">
          <span className="type-body-strong">{r.title}</span>
          <span className="block type-caption line-clamp-1">{r.description}</span>
        </div>
      ),
    },
    { key: 'category', header: 'Kategori', cell: (r) => (r.categoryName ? <Badge color={r.categoryColor}>{r.categoryName}</Badge> : <span className="type-muted">—</span>) },
    { key: 'dates', header: 'Tarih Aralığı', cell: (r) => <span className="whitespace-nowrap type-muted">{formatDate(r.startDate)} – {formatDate(r.endDate)}</span> },
    { key: 'status', header: 'Aşama', align: 'center', cell: (r) => <Badge tone={QUIZ_STATUS_TONE[r.status]}>{QUIZ_STATUS_LABELS[r.status]}</Badge> },
    { key: 'archivedAt', header: 'Arşivlenme', cell: (r) => <span className="whitespace-nowrap type-muted">{r.archivedAt ? formatDate(r.archivedAt) : '—'}</span> },
  ]

  return (
    <>
      <DataTable<Quiz>
        title="Arşivlenmiş Yarışmalar"
        showRowNumbers
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        searchable
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Arşivde ara..."
        page={page}
        total={total}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        onPageChange={setPage}
        limit={limit}
        onLimitChange={(l) => { setLimit(l); setPage(1) }}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        selectionActions={
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={!canRestore}
              title={canRestore ? undefined : 'Geri alma yetkiniz yok'}
              onClick={() => setBulkType('restore')}
            >
              <RotateCcwIcon className="h-3.5 w-3.5 text-primary" /> Geri Al
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
        rowActions={(r) => (
          <>
            <IconButton
              tone="primary"
              title={canRestore ? 'Geri Al' : 'Geri alma yetkiniz yok'}
              disabled={!canRestore}
              onClick={() => setRestoreRow(r)}
            >
              <RotateCcwIcon className="h-4 w-4" />
            </IconButton>
            <IconButton
              tone="danger"
              title={isSuperAdmin ? 'Kalıcı Sil' : 'Kalıcı silme yalnızca süper admin'}
              disabled={!isSuperAdmin}
              onClick={() => setDeleteRow(r)}
            >
              <Trash2Icon className="h-4 w-4" />
            </IconButton>
          </>
        )}
        empty={<EmptyState icon={ArchiveIcon} title="Arşiv boş" description="Arşivlenmiş yarışma bulunmuyor." />}
      />

      <ConfirmModal
        open={restoreRow !== null}
        onClose={() => setRestoreRow(null)}
        onConfirm={doRestore}
        title="Yarışmayı Geri Al"
        description="Yarışma arşivden çıkarılıp tekrar listeye eklenecek."
        confirmLabel="Geri Al"
        tone="primary"
        loading={busy}
      />

      <ConfirmModal
        open={deleteRow !== null}
        onClose={() => setDeleteRow(null)}
        onConfirm={doDelete}
        title="Kalıcı Olarak Sil"
        description="Bu işlem geri alınamaz. Yarışma ve tüm ilişkili veriler kalıcı olarak silinecek."
        confirmLabel="Kalıcı Sil"
        tone="danger"
        loading={busy}
      />

      <ConfirmModal
        open={!!bulkType}
        onClose={() => setBulkType(null)}
        onConfirm={runBulk}
        title={bulkType ? bulkMessages[bulkType].title : ''}
        description={bulkType ? bulkMessages[bulkType].description : ''}
        confirmLabel={bulkType === 'delete' ? 'Evet, Kalıcı Sil' : 'Geri Al'}
        tone={bulkType === 'delete' ? 'danger' : 'primary'}
        loading={bulkBusy}
      />
    </>
  )
}
