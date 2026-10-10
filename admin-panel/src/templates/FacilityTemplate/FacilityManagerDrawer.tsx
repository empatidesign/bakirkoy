import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import {
  SearchIcon, PlusIcon, EyeIcon, CheckCircle2Icon, XCircleIcon, InfoIcon, Trash2Icon,
  GripVerticalIcon, LayersIcon, TagIcon, SparklesIcon, Edit3Icon,
} from 'lucide-react'
import {
  Drawer, Button, Input, IconButton, RowActions, EmptyState, StatCard, Checkbox, Badge, Select,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell, ConfirmModal, AdminFormShell,
  Modal, Field, Textarea, Switch, Combobox,
} from '@/design-system'
import { cn } from '@/lib/utils'
import { useAuth } from '@/framework/auth/AuthContext'
import type { FacilityModuleConfig } from './moduleConfig'
import type { FacilityModuleService } from './types'
import type { FacilityRecord, BranchRecord, BranchForm } from '@/types/facility.types'
import { FacilityFormDrawer } from './FacilityFormDrawer'
import { DEFAULT_BRANCH_CATEGORIES } from './tabs/FacilityBranchesTab'

interface Props {
  open: boolean
  onClose: () => void
  config: FacilityModuleConfig
  service: FacilityModuleService
  onMutated: () => void
  onOpenFacility: (id: string) => void
}

const occupancyClass = (rate: number) => (rate > 80 ? 'text-danger' : rate > 50 ? 'text-warning' : 'text-success')

const rateOf = (r: FacilityRecord) => {
  const quota = r.totalGroupCapacity ?? 0
  return quota > 0 ? Math.round(((r.registeredCount || 0) / quota) * 100) : 0
}

const emptyBranchForm: BranchForm = {
  name: '',
  description: '',
  category: '',
  periodMonths: '',
  isActive: true,
}

export const FacilityManagerDrawer = ({ open, onClose, config, service, onMutated, onOpenFacility }: Props) => {
  const T = config.terminology
  const { can } = useAuth()
  const canDelete = can('service-facilities.delete')

  // Ana Sekme Durumu: 'facilities' (Merkezler) | 'branches' (Programlar)
  const [activeTab, setActiveTab] = useState<'facilities' | 'branches'>('facilities')

  // ─── TESİS (FACILITY) DURUMLARI ──────────────────────────────────────────
  const [rows, setRows] = useState<FacilityRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<FacilityRecord | null>(null)
  const [deleting, setDeleting] = useState<FacilityRecord | null>(null)
  const [removing, setRemoving] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkKind, setBulkKind] = useState<'activate' | 'deactivate' | 'delete' | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [sortMode, setSortMode] = useState<'name' | 'createdAt' | 'manual'>('name')
  const [dragId, setDragId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)

  // ─── PROGRAM (BRANCH) DURUMLARI ─────────────────────────────────────────
  const [branches, setBranches] = useState<BranchRecord[]>([])
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchSearch, setBranchSearch] = useState('')
  const [branchCategoryFilter, setBranchCategoryFilter] = useState('')
  const [branchStatusFilter, setBranchStatusFilter] = useState<'all' | 'active' | 'passive'>('all')
  const [branchSelected, setBranchSelected] = useState<Set<string>>(new Set())
  const [branchBulkKind, setBranchBulkKind] = useState<'activate' | 'deactivate' | 'delete' | null>(null)
  const [branchBulkBusy, setBranchBulkBusy] = useState(false)

  // Program Ekle/Düzenle modalı
  const [branchModalOpen, setBranchModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null)
  const [branchForm, setBranchForm] = useState<BranchForm>(emptyBranchForm)
  const [branchSaving, setBranchSaving] = useState(false)
  const [deletingBranch, setDeletingBranch] = useState<BranchRecord | null>(null)
  const [branchRemoving, setBranchRemoving] = useState(false)

  // Toplu Kategori Değiştir Modalı
  const [bulkCatModalOpen, setBulkCatModalOpen] = useState(false)
  const [bulkTargetCategory, setBulkTargetCategory] = useState('')
  const [bulkCatSaving, setBulkCatSaving] = useState(false)

  // Tesisleri Çek
  const fetchFacilities = useCallback(async () => {
    setLoading(true)
    try {
      const sort = sortMode === 'manual' ? 'manual' : sortMode
      const res = await service.facilities.getList({ page: 1, limit: 200, search, sort, order: 'asc' })
      setRows(res.items)
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [service, search, sortMode])

  // Programları Çek
  const fetchBranches = useCallback(async () => {
    setBranchLoading(true)
    try {
      const res = await service.branches.getList({ page: 1, limit: 500 })
      setBranches(res.items || [])
    } catch {
      setBranches([])
    } finally {
      setBranchLoading(false)
    }
  }, [service])

  useEffect(() => {
    if (open) {
      void fetchFacilities()
      void fetchBranches()
    }
  }, [open, fetchFacilities, fetchBranches])

  useEffect(() => { setSelected(new Set()) }, [search])
  useEffect(() => { setBranchSelected(new Set()) }, [branchSearch, branchCategoryFilter, branchStatusFilter])

  // Kategoriler (Varsayılan + veritabanında mevcut olanlar)
  const allBranchCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_BRANCH_CATEGORIES)
    for (const b of branches) {
      if (b.category?.trim()) set.add(b.category.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [branches])

  // Filtrelenmiş programlar
  const filteredBranches = useMemo(() => {
    const q = branchSearch.trim().toLocaleLowerCase('tr')
    return branches.filter((b) => {
      if (q) {
        const matchName = b.name.toLocaleLowerCase('tr').includes(q)
        const matchDesc = (b.description ?? '').toLocaleLowerCase('tr').includes(q)
        const matchCat = (b.category ?? '').toLocaleLowerCase('tr').includes(q)
        if (!matchName && !matchDesc && !matchCat) return false
      }
      if (branchCategoryFilter && b.category !== branchCategoryFilter) return false
      if (branchStatusFilter === 'active' && !b.isActive) return false
      if (branchStatusFilter === 'passive' && b.isActive) return false
      return true
    })
  }, [branches, branchSearch, branchCategoryFilter, branchStatusFilter])

  const mutated = () => {
    void fetchFacilities()
    void fetchBranches()
    onMutated()
  }

  // ─── TESİS AKSİYONLARI ──────────────────────────────────────────────────
  const activeCount = rows.filter((r) => r.isActive).length
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const toggleAll = (checked: boolean) => setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set())
  const toggleOne = (id: string) => setSelected((cur) => {
    const next = new Set(cur)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toggle = async (row: FacilityRecord) => {
    await service.facilities.toggleStatus(row.id)
    toast.success(row.isActive ? `${T.facilitySingular} pasife alındı.` : `${T.facilitySingular} aktif edildi.`)
    mutated()
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setRemoving(true)
    try {
      await service.facilities.remove(deleting.id)
      toast.success(`${T.facilitySingular} silindi.`)
      setDeleting(null)
      mutated()
    } finally {
      setRemoving(false)
    }
  }

  const selectedRows = rows.filter((r) => selected.has(r.id))
  const bulkTargets =
    bulkKind === 'delete' ? selectedRows
    : bulkKind === 'activate' ? selectedRows.filter((r) => !r.isActive)
    : bulkKind === 'deactivate' ? selectedRows.filter((r) => r.isActive)
    : []

  const runBulk = async () => {
    if (!bulkKind) return
    setBulkBusy(true)
    try {
      if (bulkKind === 'delete') {
        const results = await Promise.allSettled(bulkTargets.map((r) => service.facilities.remove(r.id)))
        const failed = results.filter((r) => r.status === 'rejected').length
        const okCount = results.length - failed
        if (okCount > 0) toast.success(`${okCount} ${T.facilitySingular.toLowerCase()} silindi.`)
        if (failed > 0) toast.error(`${failed} ${T.facilitySingular.toLowerCase()} silinemedi.`)
      } else {
        const results = await Promise.allSettled(bulkTargets.map((r) => service.facilities.toggleStatus(r.id)))
        const failed = results.filter((r) => r.status === 'rejected').length
        const okCount = results.length - failed
        if (okCount > 0) toast.success(bulkKind === 'activate' ? `${okCount} ${T.facilitySingular.toLowerCase()} aktif edildi.` : `${okCount} ${T.facilitySingular.toLowerCase()} pasife alındı.`)
        if (failed > 0) toast.error(bulkKind === 'activate' ? `${failed} ${T.facilitySingular.toLowerCase()} aktif edilemedi.` : `${failed} ${T.facilitySingular.toLowerCase()} pasife alınamadı.`)
      }
      setBulkKind(null)
      setSelected(new Set())
      mutated()
    } finally {
      setBulkBusy(false)
    }
  }

  const canReorder = sortMode === 'manual'
  const handleReorderDrop = async (fromId: string, toId: string) => {
    const ids = rows.map((r) => r.id)
    const from = ids.indexOf(fromId)
    const to = ids.indexOf(toId)
    if (from < 0 || to < 0 || from === to) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    setReordering(true)
    try {
      await service.facilities.reorder(ids)
      await fetchFacilities()
    } catch {
      toast.error('Sıra değiştirilemedi.')
    } finally {
      setReordering(false)
    }
  }

  // ─── PROGRAM (BRANCH) AKSİYONLARI ───────────────────────────────────────
  const activeBranchCount = branches.filter((b) => b.isActive).length
  const allBranchesSelected = filteredBranches.length > 0 && filteredBranches.every((b) => branchSelected.has(b.id))
  const toggleAllBranches = (checked: boolean) => setBranchSelected(checked ? new Set(filteredBranches.map((b) => b.id)) : new Set())
  const toggleOneBranch = (id: string) => setBranchSelected((cur) => {
    const next = new Set(cur)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const toggleBranch = async (b: BranchRecord) => {
    try {
      await service.branches.toggleStatus(b.id)
      toast.success(b.isActive ? `${T.branchSingular} pasife alındı.` : `${T.branchSingular} aktif edildi.`)
      mutated()
    } catch {
      toast.error('Durum değiştirilemedi.')
    }
  }

  const handleOpenEditBranch = (b: BranchRecord) => {
    setEditingBranch(b)
    setBranchForm({
      name: b.name,
      description: b.description ?? '',
      category: b.category ?? '',
      periodMonths: b.periodMonths != null ? String(b.periodMonths) : '',
      absenceLimit: b.absenceLimit != null ? String(b.absenceLimit) : '',
      consecutiveAbsenceLimit: b.consecutiveAbsenceLimit != null ? String(b.consecutiveAbsenceLimit) : '',
      isActive: b.isActive,
    })
    setBranchModalOpen(true)
  }

  const handleSaveBranch = async () => {
    if (!branchForm.name.trim()) {
      toast.error(`${T.branchSingular} adı zorunludur.`)
      return
    }
    setBranchSaving(true)
    try {
      if (editingBranch) {
        await service.branches.update(editingBranch.id, branchForm)
        toast.success(`${T.branchSingular} güncellendi.`)
      } else {
        await service.branches.create(branchForm)
        toast.success(`Yeni ${T.branchSingular.toLocaleLowerCase('tr')} eklendi.`)
      }
      setBranchModalOpen(false)
      mutated()
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string }
      toast.error(anyErr?.response?.data?.message || anyErr?.message || 'Kaydedilirken hata oluştu.')
    } finally {
      setBranchSaving(false)
    }
  }

  const confirmDeleteBranch = async () => {
    if (!deletingBranch) return
    setBranchRemoving(true)
    try {
      await service.branches.remove(deletingBranch.id)
      toast.success(`${T.branchSingular} silindi.`)
      setDeletingBranch(null)
      mutated()
    } catch {
      toast.error(`${T.branchSingular} silinemedi.`)
    } finally {
      setBranchRemoving(false)
    }
  }

  // Toplu Kategori Güncelleme (Graceful Fallback ile)
  const handleBulkCategorySave = async () => {
    if (branchSelected.size === 0) return
    setBulkCatSaving(true)
    const trimmedCat = bulkTargetCategory.trim()
    const ids = Array.from(branchSelected)
    try {
      let usedBulk = false
      if (service.branches.bulkUpdateCategory) {
        try {
          await service.branches.bulkUpdateCategory(ids, trimmedCat)
          usedBulk = true
        } catch (bulkErr: any) {
          const status = bulkErr?.response?.status
          if (status !== 404 && status !== 405) {
            throw bulkErr
          }
        }
      }
      if (!usedBulk) {
        await Promise.all(
          ids.map(async (id) => {
            const b = branches.find((item) => item.id === id)
            if (!b) return
            await service.branches.update(id, {
              name: b.name,
              description: b.description ?? '',
              category: trimmedCat,
              periodMonths: b.periodMonths != null ? String(b.periodMonths) : '',
              absenceLimit: b.absenceLimit != null ? String(b.absenceLimit) : '',
              consecutiveAbsenceLimit: b.consecutiveAbsenceLimit != null ? String(b.consecutiveAbsenceLimit) : '',
              isActive: b.isActive,
            })
          })
        )
      }
      toast.success(
        trimmedCat
          ? `${ids.length} ${T.branchSingular.toLocaleLowerCase('tr')} kategorisi "${trimmedCat}" olarak güncellendi.`
          : `${ids.length} ${T.branchSingular.toLocaleLowerCase('tr')} kategorisi temizlendi.`
      )
      setBulkCatModalOpen(false)
      setBranchSelected(new Set())
      mutated()
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string }
      toast.error(anyErr?.response?.data?.message || anyErr?.message || 'Kategori güncellenirken hata oluştu.')
    } finally {
      setBulkCatSaving(false)
    }
  }

  const selectedBranchesList = branches.filter((b) => branchSelected.has(b.id))
  const branchBulkTargets =
    branchBulkKind === 'delete' ? selectedBranchesList
    : branchBulkKind === 'activate' ? selectedBranchesList.filter((b) => !b.isActive)
    : branchBulkKind === 'deactivate' ? selectedBranchesList.filter((b) => b.isActive)
    : []

  const runBranchBulk = async () => {
    if (!branchBulkKind || branchBulkTargets.length === 0) return
    setBranchBulkBusy(true)
    try {
      if (branchBulkKind === 'delete') {
        const results = await Promise.allSettled(branchBulkTargets.map((b) => service.branches.remove(b.id)))
        const failed = results.filter((r) => r.status === 'rejected').length
        const okCount = results.length - failed
        if (okCount > 0) toast.success(`${okCount} ${T.branchSingular.toLowerCase()} silindi.`)
        if (failed > 0) toast.error(`${failed} ${T.branchSingular.toLowerCase()} silinemedi.`)
      } else {
        const results = await Promise.allSettled(branchBulkTargets.map((b) => service.branches.toggleStatus(b.id)))
        const failed = results.filter((r) => r.status === 'rejected').length
        const okCount = results.length - failed
        if (okCount > 0) toast.success(branchBulkKind === 'activate' ? `${okCount} ${T.branchSingular.toLowerCase()} aktif edildi.` : `${okCount} ${T.branchSingular.toLowerCase()} pasife alındı.`)
        if (failed > 0) toast.error(branchBulkKind === 'activate' ? `${failed} ${T.branchSingular.toLowerCase()} aktif edilemedi.` : `${failed} ${T.branchSingular.toLowerCase()} pasife alınamadı.`)
      }
      setBranchBulkKind(null)
      setBranchSelected(new Set())
      mutated()
    } finally {
      setBranchBulkBusy(false)
    }
  }

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        icon={config.icon}
        title={T.facilityManagementTitle}
        subtitle={`${T.facilityPlural} ve ${T.branchPlural} ekleyin, düzenleyin, toplu kategori ve durumlarını yönetin`}
        width={980}
        hideHeader
        footer={<Button variant="outline" className="w-full" onClick={onClose}>Kapat</Button>}
      >
        <AdminFormShell
          icon={config.icon}
          title={T.facilityManagementTitle}
          subtitle={`${T.facilityPlural} ve ${T.branchPlural} ekleyin, düzenleyin ve durumlarını yönetin`}
          badge="Yönetim"
          tone="blue"
        >
          {/* SEKME GEÇİŞİ (Tesisler / Programlar) */}
          <div className="flex items-center gap-2 border-b border-[hsl(var(--border))] pb-3">
            <button
              type="button"
              onClick={() => setActiveTab('facilities')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer',
                activeTab === 'facilities'
                  ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                  : 'bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--foreground-strong))] hover:bg-[hsl(var(--surface-2))]'
              )}
            >
              <config.icon className="h-4 w-4" />
              <span>{T.facilityPlural}</span>
              <span className={cn(
                'ml-1 rounded-full px-2 py-0.5 text-xs font-bold',
                activeTab === 'facilities' ? 'bg-white/20 text-white' : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground-muted))]'
              )}>
                {rows.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('branches')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer',
                activeTab === 'branches'
                  ? 'bg-[hsl(var(--primary))] text-white shadow-sm'
                  : 'bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--foreground-strong))] hover:bg-[hsl(var(--surface-2))]'
              )}
            >
              <LayersIcon className="h-4 w-4" />
              <span>{T.branchPlural}</span>
              <span className={cn(
                'ml-1 rounded-full px-2 py-0.5 text-xs font-bold',
                activeTab === 'branches' ? 'bg-white/20 text-white' : 'bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground-muted))]'
              )}>
                {branches.length}
              </span>
            </button>
          </div>

          {/* İSTATİSTİK KARTLARI */}
          {activeTab === 'facilities' ? (
            <div className="grid grid-cols-3 gap-[15px]">
              <StatCard label={`Toplam ${T.facilitySingular}`} value={rows.length} icon={config.icon} accent="blue" loading={loading} />
              <StatCard label="Aktif" value={activeCount} icon={CheckCircle2Icon} accent="green" loading={loading} />
              <StatCard label="Pasif" value={rows.length - activeCount} icon={XCircleIcon} accent="orange" loading={loading} />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-[15px]">
              <StatCard label={`Toplam ${T.branchSingular}`} value={branches.length} icon={LayersIcon} accent="blue" loading={branchLoading} />
              <StatCard label="Aktif" value={activeBranchCount} icon={CheckCircle2Icon} accent="green" loading={branchLoading} />
              <StatCard label="Pasif" value={branches.length - activeBranchCount} icon={XCircleIcon} accent="orange" loading={branchLoading} />
            </div>
          )}

          {/* ─── TESİSLER SEKME İÇERİĞİ ────────────────────────────────────────── */}
          {activeTab === 'facilities' && (
            <div className="space-y-4">
              {/* 1. Satır: İki Buton Yan Yana */}
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="md" onClick={() => { setEditing(null); setFormOpen(true) }}>
                  <PlusIcon className="h-4 w-4" /> Yeni {T.facilitySingular} Ekle
                </Button>
                <Button variant="outline" size="md" onClick={() => setActiveTab('branches')}>
                  <LayersIcon className="h-4 w-4" /> {T.branchPlural} Yönetimine Geç
                </Button>
              </div>

              {/* 2. Satır: Arama ve Filtreleme */}
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    tone="white"
                    iconLeft={<SearchIcon className="h-4 w-4" />}
                    placeholder={`${T.facilitySingular} ara (isim, ilçe, adres)...`}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="w-52">
                  <Select value={sortMode} onChange={(e) => setSortMode(e.target.value as typeof sortMode)}>
                    <option value="name">Ada Göre</option>
                    <option value="createdAt">Eklenme Tarihine Göre</option>
                    <option value="manual">Manuel Sıralama</option>
                  </Select>
                </div>
              </div>

              {canReorder && (
                <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-soft))]/60 px-3 py-2">
                  <GripVerticalIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
                  <p className="type-caption text-[hsl(var(--warning))]">Satırları tutamaçtan sürükleyip bırakarak sırayı değiştirebilirsiniz.</p>
                </div>
              )}

              {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2.5">
                  <Badge tone="primary">{selected.size} {T.facilitySingular.toLowerCase()} seçildi</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setBulkKind('activate')}>
                    <CheckCircle2Icon className="h-3.5 w-3.5 text-success" /> Aktif Yap
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setBulkKind('deactivate')}>
                    <XCircleIcon className="h-3.5 w-3.5 text-foreground-muted" /> Pasif Yap
                  </Button>
                  {canDelete && (
                    <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setBulkKind('delete')}>
                      <Trash2Icon className="h-3.5 w-3.5" /> Seçilenleri Sil
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Seçimi temizle</Button>
                </div>
              )}

              {rows.length === 0 ? (
                <EmptyState icon={config.icon} title={loading ? 'Yükleniyor...' : `${T.facilitySingular} bulunamadı`} description={loading ? '' : `Yeni bir ${T.facilitySingular.toLowerCase()} ekleyin.`} />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead align="center" className="w-12 pl-[15px]">
                        <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} />
                      </TableHead>
                      {canReorder && <TableHead align="center" className="w-8" />}
                      <TableHead align="center" className="w-12">Sıra No</TableHead>
                      <TableHead>{T.facilitySingular}</TableHead>
                      <TableHead align="center">Kontenjan</TableHead>
                      <TableHead align="center">Doluluk</TableHead>
                      <TableHead align="center">Durum</TableHead>
                      <TableHead align="right">Aksiyonlar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r, idx) => (
                      <TableRow
                        key={r.id}
                        draggable={canReorder && !reordering}
                        onDragStart={canReorder ? () => setDragId(r.id) : undefined}
                        onDragOver={canReorder ? (e) => { e.preventDefault(); setOverId(r.id) } : undefined}
                        onDragEnd={canReorder ? () => { setDragId(null); setOverId(null) } : undefined}
                        onDrop={canReorder ? (e) => { e.preventDefault(); if (dragId && dragId !== r.id) handleReorderDrop(dragId, r.id); setDragId(null); setOverId(null) } : undefined}
                        className={cn(overId === r.id && dragId !== r.id && 'bg-primary/10', dragId === r.id && 'opacity-50')}
                      >
                        <TableCell align="center" className="pl-[15px]">
                          <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                        </TableCell>
                        {canReorder && (
                          <TableCell align="center" className="cursor-grab active:cursor-grabbing">
                            <GripVerticalIcon className="h-4 w-4 text-foreground-subtle" />
                          </TableCell>
                        )}
                        <TableCell align="center">
                          <span className="text-sm font-bold tabular-nums text-foreground-strong">{idx + 1}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-[15px]">
                            <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', r.isActive ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-foreground-muted')}>
                              <config.icon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-normal text-foreground-default">{r.name}</div>
                              <div className="type-caption truncate max-w-[300px]">{[r.district, r.address].filter(Boolean).join(' · ') || '—'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell align="center">{(r.totalGroupCapacity ?? 0).toLocaleString('tr-TR')}</TableCell>
                        <TableCell align="center"><span className={cn('tabular-nums type-body-strong', occupancyClass(rateOf(r)))}>%{rateOf(r)}</span></TableCell>
                        <TableCell align="center">
                          <Button variant="ghost" size="sm" className={cn('h-7 gap-1 rounded-pill px-2.5', r.isActive ? 'bg-success-soft text-success hover:bg-success-soft' : 'bg-surface-2 text-foreground-muted hover:bg-surface-2')}
                            title={r.isActive ? 'Pasife al' : 'Aktife al'} onClick={() => toggle(r)}>
                            {r.isActive ? <CheckCircle2Icon className="h-3.5 w-3.5" /> : <XCircleIcon className="h-3.5 w-3.5" />}
                            {r.isActive ? 'Aktif' : 'Pasif'}
                          </Button>
                        </TableCell>
                        <TableCell align="right">
                          <RowActions
                            extra={<IconButton tone="default" title="Detayı görüntüle" onClick={() => onOpenFacility(r.id)}><EyeIcon className="h-4 w-4" /></IconButton>}
                            onEdit={() => { setEditing(r); setFormOpen(true) }}
                            onDelete={() => setDeleting(r)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {/* ─── PROGRAMLAR SEKME İÇERİĞİ ───────────────────────────────────────── */}
          {activeTab === 'branches' && (
            <div className="space-y-4">
              {/* 1. Satır: İki Buton Yan Yana */}
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary" size="md" onClick={() => { setEditingBranch(null); setBranchForm(emptyBranchForm); setBranchModalOpen(true) }}>
                  <PlusIcon className="h-4 w-4" /> Yeni {T.branchSingular} Ekle
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  disabled={branchSelected.size === 0}
                  onClick={() => { setBulkTargetCategory(''); setBulkCatModalOpen(true) }}
                  className={cn(branchSelected.size > 0 && 'border-[hsl(var(--primary))]/40 text-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 hover:bg-[hsl(var(--primary))]/10 font-semibold')}
                >
                  <TagIcon className="h-4 w-4" /> Toplu Kategori Değiştir {branchSelected.size > 0 && `(${branchSelected.size})`}
                </Button>
              </div>

              {/* 2. Satır: Arama ve Filtreleme */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Input
                    tone="white"
                    iconLeft={<SearchIcon className="h-4 w-4" />}
                    placeholder={`${T.branchSingular} ara (isim, açıklama, kategori)...`}
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                  />
                </div>
                <div className="w-52">
                  <Select value={branchCategoryFilter} onChange={(e) => setBranchCategoryFilter(e.target.value)}>
                    <option value="">Tüm Kategoriler ({allBranchCategories.length})</option>
                    {allBranchCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
                <div className="w-36">
                  <Select value={branchStatusFilter} onChange={(e) => setBranchStatusFilter(e.target.value as typeof branchStatusFilter)}>
                    <option value="all">Tüm Durumlar</option>
                    <option value="active">Aktif</option>
                    <option value="passive">Pasif</option>
                  </Select>
                </div>
              </div>

              {/* Seçim Varsa Toplu Aksiyon Çubuğu */}
              {branchSelected.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 px-3 py-2.5 shadow-xs">
                  <Badge tone="primary" className="font-semibold">
                    {branchSelected.size} {T.branchSingular.toLowerCase()} seçildi
                  </Badge>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => { setBulkTargetCategory(''); setBulkCatModalOpen(true) }}
                    className="gap-1.5 font-medium"
                  >
                    <TagIcon className="h-3.5 w-3.5" /> Toplu Kategori Değiştir
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setBranchBulkKind('activate')}>
                    <CheckCircle2Icon className="h-3.5 w-3.5 text-success" /> Aktif Yap
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setBranchBulkKind('deactivate')}>
                    <XCircleIcon className="h-3.5 w-3.5 text-foreground-muted" /> Pasif Yap
                  </Button>
                  {canDelete && (
                    <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setBranchBulkKind('delete')}>
                      <Trash2Icon className="h-3.5 w-3.5" /> Seçilenleri Sil
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setBranchSelected(new Set())}>Seçimi temizle</Button>
                </div>
              )}

              {filteredBranches.length === 0 ? (
                <EmptyState
                  icon={LayersIcon}
                  title={branchLoading ? 'Yükleniyor...' : `${T.branchSingular} bulunamadı`}
                  description={branchLoading ? '' : `Arama kriterlerine uygun ${T.branchSingular.toLowerCase()} yok veya henüz eklenmemiş.`}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead align="center" className="w-12 pl-[15px]">
                        <Checkbox checked={allBranchesSelected} onCheckedChange={(v) => toggleAllBranches(!!v)} />
                      </TableHead>
                      <TableHead align="center" className="w-12">Sıra No</TableHead>
                      <TableHead>{T.branchSingular}</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead align="center">Durum</TableHead>
                      <TableHead align="right">Aksiyonlar</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBranches.map((b, idx) => (
                      <TableRow key={b.id} className={cn(branchSelected.has(b.id) && 'bg-primary/5')}>
                        <TableCell align="center" className="pl-[15px]">
                          <Checkbox checked={branchSelected.has(b.id)} onCheckedChange={() => toggleOneBranch(b.id)} />
                        </TableCell>
                        <TableCell align="center">
                          <span className="text-sm font-bold tabular-nums text-foreground-strong">{idx + 1}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-[15px]">
                            <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', b.isActive ? 'bg-primary-soft text-primary' : 'bg-surface-2 text-foreground-muted')}>
                              <LayersIcon className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-foreground-strong">{b.name}</div>
                              {b.description && (
                                <div className="type-caption truncate max-w-[320px] text-foreground-muted">{b.description}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {b.category ? (
                            <Badge tone="primary" className="text-xs px-2.5 py-0.5 font-medium rounded-md">
                              {b.category}
                            </Badge>
                          ) : (
                            <span className="text-xs text-foreground-subtle italic">Kategorisiz</span>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn('h-7 gap-1 rounded-pill px-2.5', b.isActive ? 'bg-success-soft text-success hover:bg-success-soft' : 'bg-surface-2 text-foreground-muted hover:bg-surface-2')}
                            title={b.isActive ? 'Pasife al' : 'Aktife al'}
                            onClick={() => toggleBranch(b)}
                          >
                            {b.isActive ? <CheckCircle2Icon className="h-3.5 w-3.5" /> : <XCircleIcon className="h-3.5 w-3.5" />}
                            {b.isActive ? 'Aktif' : 'Pasif'}
                          </Button>
                        </TableCell>
                        <TableCell align="right">
                          <div className="flex items-center justify-end gap-1">
                            <IconButton tone="default" title="Düzenle" onClick={() => handleOpenEditBranch(b)}>
                              <Edit3Icon className="h-4 w-4" />
                            </IconButton>
                            {canDelete && (
                              <IconButton tone="danger" title="Sil" onClick={() => setDeletingBranch(b)}>
                                <Trash2Icon className="h-4 w-4" />
                              </IconButton>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-1 px-3 py-2.5">
            <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-foreground-muted" />
            <p className="type-caption">
              {activeTab === 'facilities'
                ? `Kontenjan, branş, cihaz ve detaylı ayarlar için ${T.facilitySingular.toLowerCase()}i seçip Ayarlar sekmesini kullanın.`
                : `${T.branchPlural} üzerinde toplu seçim yaparak kategorilerini tek tıkla değiştirebilir, durumlarını aktif veya pasife alabilirsiniz.`}
            </p>
          </div>
        </AdminFormShell>
      </Drawer>

      {/* Tesis Ekle/Düzenle Form Drawer */}
      <FacilityFormDrawer open={formOpen} onClose={() => setFormOpen(false)} config={config} service={service} editing={editing} onSaved={mutated} />

      {/* Program Ekle/Düzenle Modal */}
      <Modal
        open={branchModalOpen}
        onClose={() => setBranchModalOpen(false)}
        width={620}
        bodyClassName="px-7 py-6"
        title={editingBranch ? `${T.branchSingular} Düzenle` : `Yeni ${T.branchSingular} Ekle`}
        subtitle={editingBranch ? `${T.branchSingular} adı, kategori ve temel bilgilerini güncelleyin` : `Yeni ${T.branchSingular.toLocaleLowerCase('tr')} adı ve kategorisini belirleyin`}
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <Button variant="outline" onClick={() => setBranchModalOpen(false)}>Vazgeç</Button>
            <Button variant="primary" isLoading={branchSaving} onClick={handleSaveBranch} className="px-6 font-semibold shadow-sm">
              {editingBranch ? 'Güncelle' : 'Kaydet'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label={`${T.branchSingular} Adı`} required>
            <Input
              value={branchForm.name}
              onChange={(e) => setBranchForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Örn: 2. Seviye Pastacılık, Step Aerobik..."
              className="bg-white border-[hsl(var(--border))] text-[hsl(var(--foreground-strong))] shadow-2xs h-11"
            />
          </Field>

          <Field label="Kategori" hint="Aşağıdaki hazır kategorilerden seçebilir veya doğrudan yeni bir kategori adı yazabilirsiniz.">
            <div className="w-full [&_input]:!bg-white [&_input]:border-[hsl(var(--border))] [&_input]:text-[hsl(var(--foreground-strong))] [&_input]:shadow-2xs [&_input]:h-11">
              <Combobox
                value={branchForm.category ?? ''}
                onChange={(v) => setBranchForm((p) => ({ ...p, category: v }))}
                options={allBranchCategories.map((c) => ({ value: c, label: c }))}
                allowCustom
                placeholder="Kategori seçin veya yeni kategori adı yazın..."
              />
            </div>
          </Field>

          {/* Hızlı Kategori Seçim Hapları */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-card/60 p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--foreground-strong))]">
              <SparklesIcon className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
              <span>Önerilen Kategoriler:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DEFAULT_BRANCH_CATEGORIES.map((cat) => {
                const isSelected = branchForm.category === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setBranchForm((p) => ({ ...p, category: cat }))}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-xs'
                        : 'border-[hsl(var(--border))] bg-white text-[hsl(var(--foreground-default))] hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--surface-1))] shadow-2xs'
                    }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          <Field label="Açıklama">
            <Textarea
              rows={3}
              value={branchForm.description}
              onChange={(e) => setBranchForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Program hakkında kısa açıklama..."
              className="bg-white border-[hsl(var(--border))] text-[hsl(var(--foreground-strong))] shadow-2xs resize-none"
            />
          </Field>

          <div className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] bg-white p-4 shadow-2xs">
            <div>
              <div className="text-xs font-semibold text-[hsl(var(--foreground-strong))]">Durum</div>
              <div className="text-[11px] text-[hsl(var(--foreground-muted))]">Program kayıt ve başvurulara açık olsun mu?</div>
            </div>
            <Switch
              checked={branchForm.isActive}
              onCheckedChange={(checked) => setBranchForm((p) => ({ ...p, isActive: checked }))}
            />
          </div>
        </div>
      </Modal>

      {/* TOPLU KATEGORİ DEĞİŞTİRME MODALI */}
      <Modal
        open={bulkCatModalOpen}
        onClose={() => setBulkCatModalOpen(false)}
        width={620}
        bodyClassName="px-7 py-6"
        title="Toplu Kategori Değiştir"
        subtitle={`${selectedBranchesList.length} seçili ${T.branchSingular.toLocaleLowerCase('tr')} için yeni kategori belirleyin`}
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkTargetCategory('')}
              className="text-[12px] text-danger hover:bg-danger-soft"
              disabled={bulkCatSaving}
            >
              Kategoriyi Temizle
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkCatModalOpen(false)} disabled={bulkCatSaving}>
                Vazgeç
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={bulkCatSaving}
                onClick={handleBulkCategorySave}
                className="px-5 font-semibold gap-1.5 shadow-sm"
              >
                Uygula ({selectedBranchesList.length})
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Seçilen Programlar Listesi */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold text-[hsl(var(--foreground-strong))] flex items-center gap-1.5">
                <LayersIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                Seçilen {T.branchPlural} ({selectedBranchesList.length})
              </span>
              <span className="text-[11px] text-[hsl(var(--foreground-muted))]">
                Kategori atanacak kayıtlar
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {selectedBranchesList.map((b) => (
                <Badge key={b.id} tone="primary" className="text-xs py-1 px-2.5 rounded-md font-medium">
                  {b.name}
                  {b.category && (
                    <span className="ml-1.5 text-[10px] text-[hsl(var(--primary))]/80 font-normal">
                      ({b.category})
                    </span>
                  )}
                </Badge>
              ))}
            </div>
          </div>

          {/* Hedef Kategori Seçici */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-card p-4 shadow-xs space-y-2">
            <Field
              label="Hedef Kategori"
              hint="Aşağıdaki hazır kategorilerden birini seçebilir veya kutucuğa doğrudan yeni bir kategori adı yazabilirsiniz."
              required
            >
              <div className="w-full [&_input]:!bg-white [&_input]:border-[hsl(var(--border))] [&_input]:text-[hsl(var(--foreground-strong))] [&_input]:font-medium [&_input]:shadow-2xs focus-within:[&_input]:border-[hsl(var(--primary))] focus-within:[&_input]:ring-2 focus-within:[&_input]:ring-[hsl(var(--primary))]/20 [&_input]:h-11 [&_input]:text-sm [&_input]:rounded-lg">
                <Combobox
                  value={bulkTargetCategory}
                  onChange={setBulkTargetCategory}
                  options={allBranchCategories.map((c) => ({ value: c, label: c }))}
                  allowCustom
                  placeholder="Kategori seçin veya yeni kategori adı yazın..."
                />
              </div>
            </Field>
          </div>

          {/* Hızlı Kategori Seçim Hapları */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-card p-4 shadow-xs">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--foreground-strong))] mb-3">
              <SparklesIcon className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
              <span>Hızlı Kategori Seçimi:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {DEFAULT_BRANCH_CATEGORIES.map((cat) => {
                const isSelected = bulkTargetCategory === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setBulkTargetCategory(cat)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white shadow-sm ring-2 ring-[hsl(var(--primary))]/20'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--surface-0))] text-[hsl(var(--foreground-default))] hover:border-[hsl(var(--primary))]/50 hover:bg-[hsl(var(--surface-1))] shadow-xs'
                    }`}
                  >
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Tesis Tekil Silme Onayı */}
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={removing}
        tone="danger"
        title={`${T.facilitySingular} Sil`}
        description={`"${deleting?.name}" silinecek. Bu tesise bağlı TÜM ${T.groupPlural.toLowerCase()} ve içerikleri (seanslar, bekleyen başvurular) de birlikte silinecek. Katılımcıların kayıt/kullanım hakları ve kurallar etkilenmez. Bu işlem geri alınamaz. Devam edilsin mi?`}
        confirmLabel="Sil"
      />

      {/* Tesis Toplu İşlem Onayı */}
      <ConfirmModal
        open={!!bulkKind}
        onClose={() => setBulkKind(null)}
        onConfirm={runBulk}
        loading={bulkBusy}
        icon={bulkKind === 'delete' ? Trash2Icon : undefined}
        tone={bulkKind === 'deactivate' || bulkKind === 'delete' ? 'danger' : 'primary'}
        title={
          bulkKind === 'activate' ? `Seçili ${T.facilityPlural.toLowerCase()} aktif edilsin mi?`
          : bulkKind === 'deactivate' ? `Seçili ${T.facilityPlural.toLowerCase()} pasife alınsın mı?`
          : `Seçili ${T.facilityPlural.toLowerCase()} silinsin mi?`
        }
        description={
          bulkKind === 'delete'
            ? `Seçili ${bulkTargets.length} ${T.facilitySingular.toLowerCase()} kalıcı olarak silinecek. Bu tesislere bağlı TÜM ${T.groupPlural.toLowerCase()} ve içerikleri (seanslar, bekleyen başvurular) de birlikte silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`
            : `${bulkTargets.length} ${T.facilitySingular.toLowerCase()} durumu güncellenecek.`
        }
        confirmLabel={bulkKind === 'activate' ? 'Aktif Yap' : bulkKind === 'deactivate' ? 'Pasife Al' : 'Evet, Sil'}
      />

      {/* Program Tekil Silme Onayı */}
      <ConfirmModal
        open={!!deletingBranch}
        onClose={() => setDeletingBranch(null)}
        onConfirm={confirmDeleteBranch}
        loading={branchRemoving}
        tone="danger"
        title={`${T.branchSingular} Sil`}
        description={`"${deletingBranch?.name}" programı silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`}
        confirmLabel="Sil"
      />

      {/* Program Toplu İşlem Onayı */}
      <ConfirmModal
        open={!!branchBulkKind}
        onClose={() => setBranchBulkKind(null)}
        onConfirm={runBranchBulk}
        loading={branchBulkBusy}
        icon={branchBulkKind === 'delete' ? Trash2Icon : undefined}
        tone={branchBulkKind === 'deactivate' || branchBulkKind === 'delete' ? 'danger' : 'primary'}
        title={
          branchBulkKind === 'activate' ? `Seçili ${T.branchPlural.toLowerCase()} aktif edilsin mi?`
          : branchBulkKind === 'deactivate' ? `Seçili ${T.branchPlural.toLowerCase()} pasife alınsın mı?`
          : `Seçili ${T.branchPlural.toLowerCase()} silinsin mi?`
        }
        description={
          branchBulkKind === 'delete'
            ? `Seçili ${branchBulkTargets.length} ${T.branchSingular.toLowerCase()} silinecek. Bu işlem geri alınamaz. Devam edilsin mi?`
            : `${branchBulkTargets.length} ${T.branchSingular.toLowerCase()} durumu güncellenecek.`
        }
        confirmLabel={branchBulkKind === 'activate' ? 'Aktif Yap' : branchBulkKind === 'deactivate' ? 'Pasife Al' : 'Evet, Sil'}
      />
    </>
  )
}
