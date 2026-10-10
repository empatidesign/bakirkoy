import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import {
  SearchIcon, PlusIcon, EyeIcon, CheckCircle2Icon, XCircleIcon, BookOpenIcon, InfoIcon, Trash2Icon,
} from 'lucide-react'
import {
  Drawer, Badge, Button, Checkbox, Input, IconButton, Pagination, RowActions, EmptyState, StatCard, Select,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, ConfirmModal,
} from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import { cn } from '@/lib/utils'
import libraryService from '@/services/library.service'
import type { Library } from '@/types/library.types'
import { LibraryFormDrawer } from './LibraryFormDrawer'

interface Props {
  open: boolean
  onClose: () => void
  onChanged: () => void
  onOpenLibrary: (id: string) => void
}

const occupancyClass = (rate: number) => (rate > 80 ? 'text-danger' : rate > 50 ? 'text-warning' : 'text-success')

export const LibraryManagerDrawer = ({ open, onClose, onChanged, onOpenLibrary }: Props) => {
  const { can } = useAuth()
  const canDelete = can('library.delete')
  const [rows, setRows] = useState<Library[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Library | null>(null)
  const [deleting, setDeleting] = useState<Library | null>(null)
  const [removing, setRemoving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'passive'>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const res = await libraryService.getList({ page: 1, limit: 200, search })
      setRows(res.items)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { if (open) fetch() }, [open, fetch])

  const mutated = () => { fetch(); onChanged() }
  const activeCount = rows.filter((r) => r.isActive).length
  const filteredRows = rows.filter((row) =>
    statusFilter === 'all'
    || (statusFilter === 'active' && row.isActive)
    || (statusFilter === 'passive' && !row.isActive)
  )
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / limit))
  const pagedRows = filteredRows.slice((page - 1) * limit, page * limit)
  const pageIds = pagedRows.map((row) => row.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))

  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [search, statusFilter, limit])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const togglePageSelection = (checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current)
      pageIds.forEach((id) => checked ? next.add(id) : next.delete(id))
      return next
    })
  }

  const toggle = async (row: Library) => {
    await libraryService.toggleStatus(row.id)
    toast.success(row.isActive ? 'Kütüphane pasife alındı.' : 'Kütüphane aktif edildi.')
    mutated()
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    try {
      await libraryService.delete(deleting.id)
      toast.success('Kütüphane silindi.')
      setDeleting(null)
      mutated()
    } finally {
      setRemoving(false)
    }
  }

  const confirmBulkDelete = async () => {
    if (selected.size === 0) return
    setBulkDeleting(true)
    try {
      const ids = [...selected]
      const results = await Promise.allSettled(ids.map((id) => libraryService.delete(id)))
      const failed = results.filter((r) => r.status === 'rejected').length
      const succeeded = results.length - failed
      if (succeeded > 0) toast.success(`${succeeded} kütüphane silindi.`)
      if (failed > 0) toast.error(`${failed} kütüphane silinemedi.`)
      setBulkDeleteOpen(false)
      setSelected(new Set())
      mutated()
    } finally {
      setBulkDeleting(false)
    }
  }

  const rate = (r: Library) => (r.capacity > 0 ? Math.round((r.currentOccupancy / r.capacity) * 100) : 0)

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        icon={BookOpenIcon}
        title="Kütüphane Yönetimi"
        subtitle="Kütüphaneleri ekleyin, düzenleyin, durumlarını değiştirin veya silin"
        width={880}
        footer={<Button variant="outline" className="w-full" onClick={onClose}>Kapat</Button>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Toplam Kütüphane" value={rows.length} icon={BookOpenIcon} accent="blue" loading={loading} />
            <StatCard label="Aktif" value={activeCount} icon={CheckCircle2Icon} accent="green" loading={loading} />
            <StatCard label="Pasif" value={rows.length - activeCount} icon={XCircleIcon} accent="orange" loading={loading} />
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="md" onClick={() => { setEditing(null); setFormOpen(true) }}>
              <PlusIcon className="h-4 w-4" /> Yeni Kütüphane Ekle
            </Button>
            <div className="flex-1">
              <Input iconLeft={<SearchIcon className="h-4 w-4" />} placeholder="Kütüphane ara (isim, ilçe, adres)..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="w-44">
              <Select aria-label="Durum filtresi" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}>
                <option value="all">Tümü ({rows.length})</option>
                <option value="active">Aktif ({activeCount})</option>
                <option value="passive">Pasif ({rows.length - activeCount})</option>
              </Select>
            </div>
          </div>

          {selected.size > 0 && (
            <div className="flex items-center justify-end gap-2">
              <Badge tone="primary">{selected.size} kütüphane seçildi</Badge>
              {canDelete && (
                <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2Icon className="h-3.5 w-3.5" /> Seçilenleri Sil
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Seçimi temizle</Button>
            </div>
          )}

          {filteredRows.length === 0 ? (
            <EmptyState icon={BookOpenIcon} title={loading ? 'Yükleniyor...' : 'Kütüphane bulunamadı'} description={loading ? '' : 'Arama veya filtre ölçütünü değiştirin.'} />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                  <TableHead className="w-12 pl-[15px] text-center">
                    <Checkbox checked={allPageSelected} onCheckedChange={(value) => togglePageSelection(!!value)} />
                  </TableHead>
                  <TableHead className="w-12 text-center">No</TableHead>
                  <TableHead>Kütüphane</TableHead>
                  <TableHead align="center">Kapasite</TableHead>
                  <TableHead align="center">Doluluk</TableHead>
                  <TableHead align="center">Durum</TableHead>
                  <TableHead align="right">Aksiyonlar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {pagedRows.map((r, index) => (
                  <TableRow key={r.id}>
                    <TableCell align="center" className="pl-[15px]">
                      <Checkbox
                        checked={selected.has(r.id)}
                        onCheckedChange={(value) => setSelected((current) => {
                          const next = new Set(current)
                          if (value) next.add(r.id)
                          else next.delete(r.id)
                          return next
                        })}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <span className="type-muted tabular-nums">{(page - 1) * limit + index + 1}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field', r.isActive ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-foreground-muted')}>
                          <BookOpenIcon className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="type-body-strong">{r.name}</div>
                          <div className="type-caption max-w-[320px] truncate">{[r.serviceFacilityName, r.district, r.address].filter(Boolean).join(' · ') || '—'}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell align="center">{r.capacity.toLocaleString('tr-TR')}</TableCell>
                    <TableCell align="center"><span className={cn('tabular-nums type-body-strong', occupancyClass(rate(r)))}>%{rate(r)}</span></TableCell>
                    <TableCell align="center">
                      <Button variant="ghost" size="sm" className={cn('h-7 gap-1 rounded-pill px-2.5', r.isActive ? 'bg-success-soft text-success hover:bg-success-soft' : 'bg-surface-2 text-foreground-muted hover:bg-surface-2')}
                        title={r.isActive ? 'Pasife al' : 'Aktife al'} onClick={() => toggle(r)}>
                        {r.isActive ? <CheckCircle2Icon className="h-3.5 w-3.5" /> : <XCircleIcon className="h-3.5 w-3.5" />}
                        {r.isActive ? 'Aktif' : 'Pasif'}
                      </Button>
                    </TableCell>
                    <TableCell align="right">
                      <RowActions
                        extra={<IconButton tone="default" title="Detayı görüntüle" onClick={() => onOpenLibrary(r.id)}><EyeIcon className="h-4 w-4" /></IconButton>}
                        onEdit={() => { setEditing(r); setFormOpen(true) }}
                        onDelete={() => setDeleting(r)}
                      />
                    </TableCell>
                  </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={page}
                totalPages={totalPages}
                total={filteredRows.length}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            </div>
          )}

          <div className="flex items-start gap-2 rounded-card border border-border bg-surface-1 px-3 py-2.5">
            <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground-muted" />
            <p className="type-caption">Mola/çalışma kuralları ve puan ayarları için kütüphaneyi seçip <b>Ayarlar</b> sekmesini kullanın.</p>
          </div>
        </div>
      </Drawer>

      <LibraryFormDrawer open={formOpen} onClose={() => setFormOpen(false)} editing={editing} onSaved={mutated} />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={removing}
        tone="danger"
        title="Kütüphane Sil"
        description={`"${deleting?.name}" silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`}
        confirmLabel="Sil"
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        onConfirm={confirmBulkDelete}
        loading={bulkDeleting}
        tone="danger"
        icon={Trash2Icon}
        title="Seçili Kütüphaneleri Sil"
        description={`Seçili ${selected.size} kütüphane kalıcı olarak silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`}
        confirmLabel="Evet, Sil"
      />
    </>
  )
}
