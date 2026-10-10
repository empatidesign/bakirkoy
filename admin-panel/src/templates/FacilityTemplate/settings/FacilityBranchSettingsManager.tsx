import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  LayersIcon, PlusIcon, SearchIcon, Edit3Icon, Trash2Icon, SparklesIcon, TagIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Button, Input, Textarea, Select, Switch, Badge, Modal,
  Field, EmptyState, SkeletonRows, ConfirmModal, Combobox, Checkbox,
} from '@/design-system'
import type { FacilityModuleConfig } from '../moduleConfig'
import type { FacilityModuleService } from '../types'
import type { BranchRecord, BranchForm } from '@/types/facility.types'
import { DEFAULT_BRANCH_CATEGORIES } from '../tabs/FacilityBranchesTab'

interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
}

const emptyForm: BranchForm = {
  name: '',
  description: '',
  category: '',
  periodMonths: '',
  isActive: true,
}

export const FacilityBranchSettingsManager = ({ config, service }: Props) => {
  const T = config.terminology
  const [branches, setBranches] = useState<BranchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'passive'>('all')

  // Edit / Create Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null)
  const [form, setForm] = useState<BranchForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  // Bulk Add Modal state
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkCategory, setBulkCategory] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)

  // Delete Confirm Modal state
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Toplu seçim ve toplu kategori değiştirme
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCatModalOpen, setBulkCatModalOpen] = useState(false)
  const [bulkTargetCategory, setBulkTargetCategory] = useState('')
  const [bulkCatSaving, setBulkCatSaving] = useState(false)

  const loadBranches = useCallback(async () => {
    setLoading(true)
    try {
      const res = await service.branches.getList({ page: 1, limit: 500 })
      setBranches(res.items || [])
    } catch {
      toast.error(`${T.branchPlural} yüklenirken hata oluştu.`)
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [service, T.branchPlural])

  useEffect(() => {
    void loadBranches()
  }, [loadBranches])

  // Extract all categories found in existing branches + default categories
  const allCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_BRANCH_CATEGORIES)
    for (const b of branches) {
      if (b.category?.trim()) set.add(b.category.trim())
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'tr'))
  }, [branches])

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return branches.filter((b) => {
      if (q && !b.name.toLocaleLowerCase('tr').includes(q) && !(b.description ?? '').toLocaleLowerCase('tr').includes(q)) {
        return false
      }
      if (categoryFilter !== 'all' && b.category !== categoryFilter) {
        return false
      }
      if (statusFilter === 'active' && !b.isActive) return false
      if (statusFilter === 'passive' && b.isActive) return false
      return true
    })
  }, [branches, search, categoryFilter, statusFilter])

  const stats = useMemo(() => {
    const total = branches.length
    const active = branches.filter((b) => b.isActive).length
    const passive = total - active
    return { total, active, passive }
  }, [branches])

  const openCreate = () => {
    setEditingBranch(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (branch: BranchRecord) => {
    setEditingBranch(branch)
    setForm({
      name: branch.name,
      description: branch.description ?? '',
      category: branch.category ?? '',
      periodMonths: branch.periodMonths != null ? String(branch.periodMonths) : '',
      isActive: branch.isActive,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error(`${T.branchSingular} adı zorunludur.`)
      return
    }
    setSaving(true)
    try {
      if (editingBranch) {
        await service.branches.update(editingBranch.id, form)
        toast.success(`${T.branchSingular} güncellendi.`)
      } else {
        await service.branches.create(form)
        toast.success(`${T.branchSingular} başarıyla eklendi.`)
      }
      setModalOpen(false)
      await loadBranches()
    } catch {
      toast.error('Kayıt sırasında bir hata oluştu.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleStatus = async (branch: BranchRecord) => {
    try {
      await service.branches.toggleStatus(branch.id)
      setBranches((prev) =>
        prev.map((b) => (b.id === branch.id ? { ...b, isActive: !b.isActive } : b))
      )
      toast.success(
        branch.isActive
          ? `${branch.name} pasife alındı.`
          : `${branch.name} aktif edildi.`
      )
    } catch {
      toast.error('Durum değiştirilemedi.')
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)
    try {
      await service.branches.remove(deleteId)
      toast.success(`${T.branchSingular} silindi.`)
      setDeleteId(null)
      await loadBranches()
    } catch {
      toast.error(`${T.branchSingular} silinirken hata oluştu. Bağlı grup veya seanslar olabilir.`)
    } finally {
      setDeleting(false)
    }
  }

  const handleBulkAdd = async () => {
    const names = Array.from(
      new Set(
        bulkText
          .split('\n')
          .map((n) => n.trim())
          .filter(Boolean)
      )
    )
    if (names.length === 0) {
      toast.error('Lütfen en az bir program adı yazın.')
      return
    }
    setBulkSaving(true)
    let added = 0
    let failed = 0
    try {
      for (const name of names) {
        try {
          await service.branches.create({
            name,
            description: '',
            category: bulkCategory || undefined,
            periodMonths: '',
            isActive: false, // Varsayılan pasif
          })
          added++
        } catch {
          failed++
        }
      }
      toast.success(`${added} ${T.branchSingular.toLocaleLowerCase('tr')} eklendi${failed > 0 ? `, ${failed} başarısız` : ''}.`)
      setBulkModalOpen(false)
      setBulkText('')
      setBulkCategory('')
      await loadBranches()
    } finally {
      setBulkSaving(false)
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map((b) => b.id)))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkCategoryUpdate = async () => {
    if (selectedIds.size === 0) return
    setBulkCatSaving(true)
    const trimmedCat = bulkTargetCategory.trim()
    try {
      const ids = Array.from(selectedIds)
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
          ? `${selectedIds.size} ${T.branchSingular.toLocaleLowerCase('tr')} kategorisi "${trimmedCat}" olarak güncellendi.`
          : `${selectedIds.size} ${T.branchSingular.toLocaleLowerCase('tr')} kategorisi temizlendi.`
      )
      setBulkCatModalOpen(false)
      setSelectedIds(new Set())
      await loadBranches()
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string; title?: string } }; message?: string }
      const msg = anyErr?.response?.data?.message || anyErr?.response?.data?.title || anyErr?.message || 'Kategori güncellenirken bir hata oluştu.'
      toast.error(msg)
    } finally {
      setBulkCatSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header Info & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-card p-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <LayersIcon className="h-5 w-5 text-[hsl(var(--primary))]" />
            <h3 className="text-sm font-semibold text-[hsl(var(--foreground-strong))]">
              {T.branchPlural} Yönetimi
            </h3>
            <span className="rounded-full bg-[hsl(var(--surface-1))] px-2.5 py-0.5 text-xs font-semibold text-[hsl(var(--foreground-muted))]">
              {stats.total} Toplam • {stats.active} Aktif • {stats.passive} Pasif
            </span>
          </div>
          <p className="mt-1 text-xs text-[hsl(var(--foreground-muted))]">
            Sistemde tanımlı tüm {T.branchSingular.toLocaleLowerCase('tr')} listesini görüntüleyin, yeni ekleyin, düzenleyin veya kaldırın.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkModalOpen(true)}
            className="gap-1.5"
          >
            <SparklesIcon className="h-3.5 w-3.5" />
            Toplu Ekle
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openCreate}
            className="gap-1.5"
          >
            <PlusIcon className="h-4 w-4" />
            Yeni {T.branchSingular}
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center gap-2.5 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-0))] p-2.5">
        <div className="relative flex-1 min-w-0">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--foreground-muted))]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`${T.branchSingular} adı ara...`}
            className="w-full rounded-lg border border-[hsl(var(--border))] bg-card pl-9 pr-3 py-1.5 text-xs text-[hsl(var(--foreground-default))] placeholder:text-[hsl(var(--foreground-muted))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
        </div>

        <div className="w-52 shrink-0">
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs"
          >
            <option value="all">Tüm Kategoriler ({allCategories.length})</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div className="w-36 shrink-0">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'passive')}
            className="text-xs"
          >
            <option value="all">Tümü ({stats.total})</option>
            <option value="active">Aktif ({stats.active})</option>
            <option value="passive">Pasif ({stats.passive})</option>
          </Select>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5 p-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[hsl(var(--primary))]">
              {selectedIds.size} {T.branchSingular.toLocaleLowerCase('tr')} seçildi
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs h-7 text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--foreground-default))]"
            >
              Seçimi Temizle
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const firstSelected = branches.find((b) => selectedIds.has(b.id))
                setBulkTargetCategory(firstSelected?.category || '')
                setBulkCatModalOpen(true)
              }}
              className="gap-1.5 h-8 text-xs font-medium"
            >
              <TagIcon className="h-3.5 w-3.5" />
              Kategori Değiştir ({selectedIds.size})
            </Button>
          </div>
        </div>
      )}

      {/* Program List Table */}
      <div className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-card shadow-sm">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={8} />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={LayersIcon}
            title={`${T.branchSingular} bulunamadı`}
            description={
              search || categoryFilter !== 'all' || statusFilter !== 'all'
                ? 'Arama kriterlerinize uygun program bulunamadı.'
                : `Henüz kayıtlı bir ${T.branchSingular.toLocaleLowerCase('tr')} bulunmuyor.`
            }
            action={
              <Button size="sm" onClick={openCreate} className="gap-1.5">
                <PlusIcon className="h-4 w-4" /> Yeni {T.branchSingular} Ekle
              </Button>
            }
          />
        ) : (
          <div className="max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground-muted))] font-semibold">
                <tr>
                  <th className="w-10 px-3 py-2.5 text-center">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Tümünü seç"
                    />
                  </th>
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-4 py-2.5">{T.branchSingular} Adı</th>
                  <th className="px-4 py-2.5">Kategori / Grup</th>
                  <th className="px-4 py-2.5 text-center">Durum</th>
                  <th className="px-4 py-2.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {filtered.map((b, idx) => (
                  <tr
                    key={b.id}
                    className={`transition-colors hover:bg-[hsl(var(--surface-1))]/60 ${
                      selectedIds.has(b.id) ? 'bg-[hsl(var(--primary))]/5' : ''
                    }`}
                  >
                    <td className="w-10 px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(b.id)}
                        onCheckedChange={() => toggleSelectOne(b.id)}
                        aria-label={`${b.name} seç`}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-[hsl(var(--foreground-muted))] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[hsl(var(--foreground-strong))]">
                      <div className="flex flex-col">
                        <span>{b.name}</span>
                        {b.description && (
                          <span className="text-[11px] text-[hsl(var(--foreground-muted))] truncate max-w-xs">
                            {b.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      {b.category ? (
                        <Badge tone="info" className="text-[11px]">
                          {b.category}
                        </Badge>
                      ) : (
                        <span className="text-[hsl(var(--foreground-muted))]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Switch
                          checked={b.isActive}
                          onCheckedChange={() => handleToggleStatus(b)}
                          aria-label={`${b.name} durumunu değiştir`}
                        />
                        <span className={`text-[11px] font-semibold ${b.isActive ? 'text-success' : 'text-gray-400'}`}>
                          {b.isActive ? 'Aktif' : 'Pasif'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(b)}
                          className="h-7 w-7 p-0 text-[hsl(var(--foreground-muted))] hover:text-[hsl(var(--primary))]"
                          title="Düzenle"
                        >
                          <Edit3Icon className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteId(b.id)}
                          className="h-7 w-7 p-0 text-[hsl(var(--foreground-muted))] hover:text-danger"
                          title="Sil"
                        >
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Create Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBranch ? `${T.branchSingular} Düzenle` : `Yeni ${T.branchSingular} Ekle`}
        width={540}
      >
        <div className="space-y-4 p-5">
          <Field label={`${T.branchSingular} Adı`} required>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={`Ör: Pastacılık, Dikiş Nakış, vb.`}
              autoFocus
            />
          </Field>

          <Field label="Kategori / Kurs Grubu">
            <div className="space-y-2">
              <Select
                value={form.category ?? ''}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">Kategori Seçin...</option>
                {allCategories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Input
                value={form.category ?? ''}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="Veya yeni bir kategori adı yazın..."
              />
            </div>
          </Field>

          <Field label="Açıklama">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Program içeriği hakkında kısa bilgi..."
            />
          </Field>


          <div className="flex items-center justify-between rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
            <div>
              <p className="text-xs font-semibold text-[hsl(var(--foreground-strong))]">Durum</p>
              <p className="text-[11px] text-[hsl(var(--foreground-muted))]">
                Aktif programlar yeni başvurulara ve grup oluşturmaya açılır.
              </p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked: boolean) => setForm({ ...form, isActive: checked })}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[hsl(var(--border))]">
            <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" size="sm" disabled={saving} onClick={handleSave}>
              {saving ? 'Kaydediliyor...' : editingBranch ? 'Güncelle' : 'Ekle'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal
        open={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        title={`Toplu ${T.branchSingular} Ekleme`}
        width={560}
      >
        <div className="space-y-4 p-5">
          <p className="text-xs text-[hsl(var(--foreground-muted))]">
            Her satıra bir {T.branchSingular.toLocaleLowerCase('tr')} adı gelecek şekilde yapıştırın. Sistem tümünü otomatik oluşturacaktır.
          </p>

          <Field label="Ortak Kategori (İsteğe Bağlı)">
            <Select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
            >
              <option value="">Kategori seçin (opsiyonel)...</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </Field>

          <Field label={`${T.branchPlural} Listesi (Satır Satır)`} required>
            <Textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Örnek:&#10;Aşçılık ve Mutfak Sanatları&#10;Geleneksel El Nakışı&#10;Web Tasarımı ve Kodlama"
              className="font-mono text-xs"
            />
          </Field>

          <div className="flex items-center justify-between text-xs text-[hsl(var(--foreground-muted))]">
            <span>
              {bulkText.split('\n').filter((l) => l.trim()).length} adet program algılandı.
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setBulkModalOpen(false)}>
                İptal
              </Button>
              <Button variant="primary" size="sm" disabled={bulkSaving} onClick={handleBulkAdd}>
                {bulkSaving ? 'Ekleniyor...' : 'Toplu Ekle'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={`${T.branchSingular} Silinsin mi?`}
        description="Bu programı silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        confirmLabel={deleting ? 'Siliniyor...' : 'Evet, Sil'}
        cancelLabel="Vazgeç"
        tone="danger"
      />

      {/* Bulk Category Change Modal */}
      {/* Bulk Category Change Modal */}
      <Modal
        open={bulkCatModalOpen}
        onClose={() => !bulkCatSaving && setBulkCatModalOpen(false)}
        width={720}
        bodyClassName="bg-surface-2 p-6 space-y-5"
        header={
          <div className="flex items-center gap-3 pr-10">
            <div className="pilot-form-icon flex h-10 w-10 flex-shrink-0 items-center justify-center">
              <TagIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Toplu Kategori Değiştir</h3>
              <p className="mt-0.5 text-xs text-white/80">
                Seçili {selectedIds.size} {T.branchSingular.toLocaleLowerCase('tr')} için kategori güncellemesi
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkCatSaving || !bulkTargetCategory}
              onClick={() => setBulkTargetCategory('')}
              className="text-xs text-[hsl(var(--foreground-muted))] hover:text-danger hover:border-danger/40 transition-colors"
            >
              Kategoriyi Temizle
            </Button>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                disabled={bulkCatSaving}
                onClick={() => setBulkCatModalOpen(false)}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={bulkCatSaving}
                onClick={handleBulkCategoryUpdate}
                className="px-5 font-semibold gap-1.5 shadow-sm"
              >
                Uygula ({selectedIds.size})
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-5">
          {/* Selected Programs Box */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-card p-4 shadow-xs">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-semibold text-[hsl(var(--foreground-strong))] flex items-center gap-1.5">
                <LayersIcon className="h-4 w-4 text-[hsl(var(--primary))]" />
                Seçilen {T.branchPlural} ({selectedIds.size})
              </span>
              <span className="text-[11px] text-[hsl(var(--foreground-muted))]">
                Kategori atanacak kayıtlar
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {branches
                .filter((b) => selectedIds.has(b.id))
                .map((b) => (
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

          {/* Target Category Selector */}
          <div className="rounded-xl border border-[hsl(var(--border))] bg-card p-4 shadow-xs space-y-2">
            <Field
              label="Hedef Kategori"
              hint="Aşağıdaki hazır kategorilerden birini seçebilir veya kutucuğa doğrudan yeni bir kategori adı yazabilirsiniz."
              required
            >
              <div className="w-full [&_input]:bg-[hsl(var(--surface-0))] [&_input]:border-[hsl(var(--border))] [&_input]:text-[hsl(var(--foreground-strong))] [&_input]:font-medium [&_input]:shadow-xs focus-within:[&_input]:border-[hsl(var(--primary))] focus-within:[&_input]:ring-2 focus-within:[&_input]:ring-[hsl(var(--primary))]/20 [&_input]:h-10 [&_input]:text-xs [&_input]:rounded-lg">
                <Combobox
                  value={bulkTargetCategory}
                  onChange={setBulkTargetCategory}
                  options={allCategories.map((c) => ({ value: c, label: c }))}
                  allowCustom
                  placeholder="Kategori seçin veya yeni kategori adı yazın..."
                />
              </div>
            </Field>
          </div>

          {/* Quick Selection Chips */}
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
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
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
    </div>
  )
}
