import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  BookOpenIcon, UsersIcon, UserCheckIcon, CoffeeIcon, HourglassIcon,
  MapPinIcon, SearchIcon, PlusIcon, Trash2Icon,
  CheckCircle2Icon, XCircleIcon, MessageSquareIcon,
} from 'lucide-react'
import {
  StatCard, Progress, Badge, Button, RowActions, EmptyState, SkeletonRows, Input,
  DataTable, type DataTableColumn, ConfirmModal, Card,
} from '@/design-system'
import { cn } from '@/lib/utils'
import { useAuth } from '@/framework/auth/AuthContext'
import libraryService from '@/services/library.service'
import { teamRealtime } from '@/services/teamRealtime'
import type { Library, LibraryOverviewSummary } from '@/types/library.types'
import { occupancyTone } from './libraryHelpers'
import { FacilityBreakdownModal } from './FacilityBreakdownModal'
import type { LiveTileKey } from './FacilityBreakdownModal'
import { LibraryFormDrawer } from './LibraryFormDrawer'
import { LibrarySendMessageModal } from './LibrarySendMessageModal'

const RATE_TEXT: Record<ReturnType<typeof occupancyTone>, string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
}

const fmt = (n: number) => n.toLocaleString('tr-TR')

const locationOf = (lib: Library) => [lib.serviceFacilityName, lib.district].filter(Boolean).join(' · ')

export const LibraryOverview = ({ onSelect }: { onSelect: (id: string) => void }) => {
  const { can, isSuperAdmin } = useAuth()
  const canEdit = can('library.edit') || isSuperAdmin
  const canDelete = can('library.delete') || isSuperAdmin
  const canCreate = can('library.create') || isSuperAdmin
  const canSms = can('sms-send.assign') || can('sms.send') || canEdit || isSuperAdmin

  const [summary, setSummary] = useState<LibraryOverviewSummary | null>(null)
  const [libraries, setLibraries] = useState<Library[]>([])
  const [loading, setLoading] = useState(true)
  const [breakdownKey, setBreakdownKey] = useState<LiveTileKey | null>(null)
  const [search, setSearch] = useState('')
  const [personMatchLibraryIds, setPersonMatchLibraryIds] = useState<Set<string> | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [smsModalOpen, setSmsModalOpen] = useState(false)
  const [targetSmsLibraryId, setTargetSmsLibraryId] = useState<string>('')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Library | null>(null)
  const [deleting, setDeleting] = useState<Library | null>(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [s, list] = await Promise.all([
        libraryService.getOverviewSummary(),
        libraryService.getList({ page: 1, limit: 200 }),
      ])
      setSummary(s)
      setLibraries(list.items)
    } catch { if (!silent) { setSummary(null); setLibraries([]) } }
    finally { if (!silent) setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const id = setInterval(() => { void load(true) }, 10000)
    void teamRealtime.start()
    const off = teamRealtime.onLibrarySession(() => { void load(true) })
    return () => { clearInterval(id); off(); void teamRealtime.stop() }
  }, [load])

  useEffect(() => {
    const q = search.trim()
    if (!q) { setPersonMatchLibraryIds(null); return }
    let cancelled = false
    const timer = setTimeout(() => {
      libraryService.getAllPersons({ search: q, limit: 200 })
        .then((res) => {
          if (cancelled) return
          setPersonMatchLibraryIds(new Set(res.items.map((p) => p.libraryId)))
        })
        .catch(() => { if (!cancelled) setPersonMatchLibraryIds(new Set()) })
    }, 300)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [search])

  const q = search.trim().toLocaleLowerCase('tr-TR')
  const filteredLibraries = q
    ? libraries.filter((lib) =>
        lib.name.toLocaleLowerCase('tr-TR').includes(q) || (personMatchLibraryIds?.has(lib.id) ?? false))
    : libraries

  const mutated = () => load()

  const openCreate = () => { setEditing(null); setFormOpen(true) }

  const toggleStatus = async (lib: Library) => {
    await libraryService.toggleStatus(lib.id)
    toast.success(lib.isActive ? 'Kütüphane pasife alındı.' : 'Kütüphane aktif edildi.')
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

  const rateOf = (lib: Library) => (lib.capacity > 0 ? Math.round((lib.currentOccupancy / lib.capacity) * 100) : 0)

  const actionsFor = (lib: Library, collapse?: boolean) => (
    <RowActions
      collapse={collapse}
      menuTitle={`${lib.name} işlemleri`}
      onView={() => onSelect(lib.id)}
      onEdit={canEdit ? () => { setEditing(lib); setFormOpen(true) } : undefined}
      onToggleStatus={canEdit ? () => toggleStatus(lib) : undefined}
      isActive={lib.isActive}
      onDelete={canDelete ? () => setDeleting(lib) : undefined}
    />
  )

  const columns: DataTableColumn<Library>[] = [
    {
      key: 'name', header: 'Kütüphane',
      cell: (lib) => (
        <div className="min-w-0">
          <p className="truncate type-body-strong">{lib.name}</p>
          {locationOf(lib) && (
            <p className="mt-0.5 flex items-center gap-1 truncate type-caption">
              <MapPinIcon className="h-3 w-3 shrink-0" />
              {locationOf(lib)}
            </p>
          )}
        </div>
      ),
    },
    { key: 'occupancy', header: 'İçeride', align: 'center', cell: (lib) => <span className="tabular-nums">{fmt(lib.currentOccupancy)}</span> },
    { key: 'onBreak', header: 'Molada', align: 'center', cell: (lib) => <span className="tabular-nums">{fmt(lib.onBreakCount)}</span> },
    { key: 'waiting', header: 'Sırada', align: 'center', cell: (lib) => <span className="tabular-nums">{fmt(lib.waitingCount)}</span> },
    {
      key: 'rate', header: 'Doluluk',
      cell: (lib) => {
        const rate = rateOf(lib)
        return (
          <div className="flex w-40 items-center gap-2">
            <Progress value={rate} tone={occupancyTone(rate)} className="flex-1" />
            <span className={cn('w-10 text-right type-caption tabular-nums', RATE_TEXT[occupancyTone(rate)])}>%{rate}</span>
          </div>
        )
      },
    },
    {
      key: 'status', header: 'Durum', align: 'center',
      cell: (lib) => <Badge tone={lib.isActive ? 'success' : 'neutral'}>{lib.isActive ? 'Aktif' : 'Pasif'}</Badge>,
    },
  ]

  const handleBulkSetStatus = async (active: boolean) => {
    if (!canEdit) {
      toast.error('Bu işlem için kütüphane düzenleme yetkiniz (library.edit) bulunmuyor.')
      return
    }
    const targets = libraries.filter((lib) => selectedIds.has(lib.id) && lib.isActive !== active)
    if (targets.length === 0) {
      toast.info(active ? 'Seçilen kütüphaneler zaten aktif durumda.' : 'Seçilen kütüphaneler zaten pasif durumda.')
      return
    }
    setBulkLoading(true)
    try {
      await Promise.all(targets.map((lib) => libraryService.toggleStatus(lib.id)))
      toast.success(`${targets.length} kütüphane ${active ? 'aktif edildi' : 'pasife alındı'}.`)
      setSelectedIds(new Set())
      mutated()
    } catch {
      toast.error('Durum güncellenirken bir hata oluştu.')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleBulkToggleSmsService = async (enable: boolean) => {
    if (!canSms) {
      toast.error('SMS bildirim servisini yönetmek için yetkiniz bulunmuyor.')
      return
    }
    const selectedList = libraries.filter((lib) => selectedIds.has(lib.id))
    if (selectedList.length === 0) return

    setBulkLoading(true)
    try {
      let count = 0
      for (const lib of selectedList) {
        try {
          const settings = await libraryService.settings.get(lib.id)
          const updatedTemplates = (settings.notificationTemplates ?? []).map((t) => ({
            ...t,
            smsEnabled: enable,
          }))
          await libraryService.settings.save(lib.id, {
            ...settings,
            notificationTemplates: updatedTemplates,
          })
          count++
        } catch {
          // ignore individual fails
        }
      }
      toast.success(`${count} kütüphanenin SMS bildirim servisi ${enable ? 'aktif edildi' : 'pasife alındı'}.`)
      setSelectedIds(new Set())
    } catch {
      toast.error('SMS bildirim servisi güncellenirken bir hata oluştu.')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleOpenSmsModal = () => {
    if (!canSms) {
      toast.error('SMS gönderimi için yetkiniz bulunmuyor.')
      return
    }
    const ids = Array.from(selectedIds)
    if (ids.length === 0) {
      toast.warning('Lütfen SMS göndermek istediğiniz bir kütüphane seçin.')
      return
    }
    setTargetSmsLibraryId(ids[0])
    setSmsModalOpen(true)
  }

  const selectionActions = (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        disabled={bulkLoading || !canEdit}
        iconLeft={<CheckCircle2Icon className="h-3.5 w-3.5 text-success" />}
        onClick={() => handleBulkSetStatus(true)}
        title={!canEdit ? 'Yetki gerekli (library.edit)' : 'Seçilenleri aktif et'}
      >
        Tümü Aktif
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={bulkLoading || !canEdit}
        iconLeft={<XCircleIcon className="h-3.5 w-3.5 text-foreground-muted" />}
        onClick={() => handleBulkSetStatus(false)}
        title={!canEdit ? 'Yetki gerekli (library.edit)' : 'Seçilenleri pasife al'}
      >
        Tümü Pasif
      </Button>
      <div className="mx-1 h-4 w-px bg-border" />
      <Button
        variant="outline"
        size="sm"
        disabled={bulkLoading || !canSms}
        iconLeft={<MessageSquareIcon className="h-3.5 w-3.5 text-primary" />}
        onClick={handleOpenSmsModal}
        title={!canSms ? 'SMS yetkisi gerekli' : 'Seçili kütüphaneye SMS gönder'}
      >
        SMS Gönder
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={bulkLoading || !canSms}
        onClick={() => handleBulkToggleSmsService(true)}
        title={!canSms ? 'SMS yetkisi gerekli' : 'Seçilen kütüphanelerde SMS bildirim hizmetini açar'}
        className="text-xs"
      >
        SMS Hizmetini Aç
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={bulkLoading || !canSms}
        onClick={() => handleBulkToggleSmsService(false)}
        title={!canSms ? 'SMS yetkisi gerekli' : 'Seçilen kütüphanelerde SMS bildirim hizmetini kapatır'}
        className="text-xs text-foreground-muted"
      >
        SMS Hizmetini Kapat
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={bulkLoading}
        onClick={() => setSelectedIds(new Set())}
        className="text-xs text-foreground-muted"
      >
        Seçimi Temizle
      </Button>
    </div>
  )

  return (
    <div className="space-y-5 px-2 py-5">

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Toplam Kapasite" value={summary?.totalCapacity ?? 0} icon={UsersIcon} accent="blue" loading={loading} />
        <StatCard label="Şu An İçeride" value={summary?.totalOccupancy ?? 0} icon={UserCheckIcon} accent="green" loading={loading} onClick={() => setBreakdownKey('occupancy')} />
        <StatCard label="Molada" value={summary?.totalOnBreak ?? 0} icon={CoffeeIcon} accent="orange" loading={loading} onClick={() => setBreakdownKey('onBreak')} />
        <StatCard label="Sıra Bekleyen" value={summary?.totalWaiting ?? 0} icon={HourglassIcon} accent="violet" loading={loading} onClick={() => setBreakdownKey('waiting')} />
      </div>

      <FacilityBreakdownModal
        open={breakdownKey !== null}
        onClose={() => setBreakdownKey(null)}
        breakdownKey={breakdownKey}
        libraries={libraries}
        onSelect={onSelect}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="type-section">Kütüphaneler</h2>
            <Badge tone="neutral" className="tabular-nums font-semibold">
              {filteredLibraries.length}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-72">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Kütüphane veya kişi adı ara..."
                iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
              />
            </div>
            {filteredLibraries.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedIds.size === filteredLibraries.length) {
                    setSelectedIds(new Set())
                  } else {
                    setSelectedIds(new Set(filteredLibraries.map((lib) => lib.id)))
                  }
                }}
              >
                {selectedIds.size === filteredLibraries.length ? 'Seçimi Bırak' : 'Tümünü Seç'}
              </Button>
            )}
            {canCreate && (
              <Button variant="primary" size="sm" iconLeft={<PlusIcon className="h-4 w-4" />} onClick={openCreate}>
                Yeni Kütüphane
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <Card padded><SkeletonRows rows={3} /></Card>
        ) : filteredLibraries.length === 0 ? (
          <Card className="py-8">
            <EmptyState
              icon={BookOpenIcon}
              title={q ? 'Aramaya uygun kütüphane yok' : 'Henüz kütüphane yok'}
              description={q ? 'Farklı bir kütüphane veya kişi adı deneyin.' : 'Yeni bir kütüphane tanımlamak için "Yeni Kütüphane" butonunu kullanın.'}
              action={!q && canCreate ? <Button variant="primary" size="sm" onClick={openCreate}>Yeni Kütüphane</Button> : undefined}
            />
          </Card>
        ) : (
          <DataTable<Library>
            columns={columns}
            rows={filteredLibraries}
            rowKey={(lib) => lib.id}
            loading={loading}
            total={filteredLibraries.length}
            showRowNumbers
            selectable
            selected={selectedIds}
            onSelectedChange={setSelectedIds}
            selectionActions={selectionActions}
            onRowClick={(lib) => onSelect(lib.id)}
            rowActions={(lib) => actionsFor(lib)}
          />
        )}
      </div>

      {targetSmsLibraryId && (
        <LibrarySendMessageModal
          open={smsModalOpen}
          libraryId={targetSmsLibraryId}
          onClose={() => {
            setSmsModalOpen(false)
            setTargetSmsLibraryId('')
          }}
        />
      )}

      <LibraryFormDrawer open={formOpen} onClose={() => setFormOpen(false)} editing={editing} onSaved={mutated} />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={removing}
        tone="danger"
        icon={Trash2Icon}
        title="Kütüphane Sil"
        description={`"${deleting?.name}" silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`}
        confirmLabel="Sil"
      />

    </div>
  )
}
