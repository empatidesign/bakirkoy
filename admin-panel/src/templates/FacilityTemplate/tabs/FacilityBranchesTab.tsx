import { useState } from 'react'
import { toast } from 'sonner'
import { LayersIcon, CheckCircle2Icon, XCircleIcon, PowerIcon, FileTextIcon, TagIcon, SparklesIcon } from 'lucide-react'
import { Input, Textarea, Label, Switch, Badge, FilterField, Select, Combobox, AdminFormShell, FormSection, Field, Button, Modal } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import type { FacilityModuleConfig } from '../moduleConfig'
import type { FacilityModuleService } from '../types'
import type { BranchRecord, BranchForm } from '@/types/facility.types'

interface Props {
  config: FacilityModuleConfig
  service: FacilityModuleService
}

type BranchFormState = BranchForm & { bulk: boolean; bulkNames: string }

export const DEFAULT_BRANCH_CATEGORIES = [
  'Mutfak & Gastronomi',
  'Spor & Fitness',
  'El Sanatları & Tekstil',
  'Bilişim & Teknoloji',
  'Kültür, Sanat & Müzik',
  'Kişisel Gelişim & Dil',
  'Eğitim & Destek Kursları',
  'Çocuk & Gençlik Gelişim',
]

const emptyForm: BranchFormState = { name: '', description: '', category: '', periodMonths: '', absenceLimit: '', consecutiveAbsenceLimit: '', isActive: true, bulk: false, bulkNames: '' }

const parseBulkNames = (text: string) => [...new Set(text.split('\n').map((n) => n.trim()).filter(Boolean))]

export const FacilityBranchesTab = ({ config, service }: Props) => {
  const T = config.terminology
  const [status, setStatus] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  // Toplu kategori değiştirme modalı durumları
  const [bulkCategoryModalOpen, setBulkCategoryModalOpen] = useState(false)
  const [selectedBranches, setSelectedBranches] = useState<BranchRecord[]>([])
  const [targetCategory, setTargetCategory] = useState('')
  const [bulkCategorySaving, setBulkCategorySaving] = useState(false)
  const [clearSelectionFn, setClearSelectionFn] = useState<(() => void) | null>(null)
  const [refreshFn, setRefreshFn] = useState<(() => void) | null>(null)

  const handleBulkCategorySave = async () => {
    if (selectedBranches.length === 0) return
    setBulkCategorySaving(true)
    const trimmedCat = targetCategory.trim()
    try {
      const ids = selectedBranches.map((b) => b.id)
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
          selectedBranches.map((b) =>
            service.branches.update(b.id, {
              name: b.name,
              description: b.description ?? '',
              category: trimmedCat,
              periodMonths: b.periodMonths != null ? String(b.periodMonths) : '',
              absenceLimit: b.absenceLimit != null ? String(b.absenceLimit) : '',
              consecutiveAbsenceLimit: b.consecutiveAbsenceLimit != null ? String(b.consecutiveAbsenceLimit) : '',
              isActive: b.isActive,
            })
          )
        )
      }
      toast.success(
        trimmedCat
          ? `${selectedBranches.length} ${T.branchSingular.toLocaleLowerCase('tr')} kategorisi "${trimmedCat}" olarak güncellendi.`
          : `${selectedBranches.length} ${T.branchSingular.toLocaleLowerCase('tr')} kategorisi temizlendi.`
      )
      setBulkCategoryModalOpen(false)
      clearSelectionFn?.()
      refreshFn?.()
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string; title?: string } }; message?: string }
      const msg = anyErr?.response?.data?.message || anyErr?.response?.data?.title || anyErr?.message || 'Kategori güncellenirken bir hata oluştu.'
      toast.error(msg)
    } finally {
      setBulkCategorySaving(false)
    }
  }

  return (
    <>
      <CrudListTemplate<BranchRecord, BranchFormState>
        icon={config.icon}
        title={T.branchPlural}
        subtitle={`${T.facilitySingular} branşlarını tanımlayın ve yönetin`}
        resourceName={T.branchSingular}
        service={{
          getList: (p) => service.branches.getList(p),
          remove: (id) => service.branches.remove(id),
          toggleStatus: (id) => service.branches.toggleStatus(id),
        }}
        rowKey={(r) => r.id}
        searchPlaceholder={`${T.branchSingular} adı ara...`}
        columns={[
          { key: 'name', header: `${T.branchSingular} Adı`, sortable: true, sortKey: 'name', cell: (r) => <span className="type-body-strong">{r.name}</span> },
          { key: 'category', header: 'Kurs Grubu / Kategori', cell: (r) => r.category ? <Badge tone="info">{r.category}</Badge> : <span className="type-muted text-xs">—</span> },
          { key: 'description', header: 'Açıklama', cell: (r) => <span className="type-muted">{r.description || '—'}</span> },
          { key: 'groupCount', header: `${T.groupSingular} Sayısı`, align: 'right', cell: (r) => r.groupCount ?? 0 },
          { key: 'sessionCount', header: 'Seans Sayısı', align: 'right', cell: (r) => r.sessionCount ?? 0 },
          { key: 'applicationCount', header: 'Başvuru Sayısı', align: 'right', cell: (r) => r.applicationCount ?? 0 },
          { key: 'isActive', header: 'Durum', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
        ]}
        extraParams={{ isActive: status, category: categoryFilter }}
        selectable
        bulkActions={(selectedRows, { clear, refresh }) => (
          <Button
            variant="outline"
            size="sm"
            className="border-primary/50 bg-primary/5 text-primary hover:bg-primary/10 gap-1.5 font-medium"
            onClick={() => {
              setSelectedBranches(selectedRows)
              setTargetCategory(selectedRows[0]?.category || '')
              setClearSelectionFn(() => clear)
              setRefreshFn(() => refresh)
              setBulkCategoryModalOpen(true)
            }}
          >
            <TagIcon className="h-3.5 w-3.5" />
            Kategori Değiştir ({selectedRows.length})
          </Button>
        )}
        hasActiveFilters={!!status || !!categoryFilter}
        onClearFilters={() => { setStatus(''); setCategoryFilter('') }}
        filterColumns={3}
        renderFilters={() => (
          <>
            <FilterField label="Kategori">
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Tüm Kategoriler</option>
                {DEFAULT_BRANCH_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </FilterField>
            <FilterField label="Durum">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Tümü</option>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </Select>
            </FilterField>
          </>
        )}
        stats={({ rows, total }) => [
          { label: `Toplam ${T.branchSingular}`, value: total, icon: LayersIcon, accent: 'blue' },
          { label: 'Aktif', value: rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif', value: rows.filter((r) => !r.isActive).length, icon: XCircleIcon, accent: 'orange' },
        ]}
        emptyForm={emptyForm}
        toForm={(r) => ({
          name: r.name, description: r.description ?? '',
          category: r.category ?? '',
          periodMonths: r.periodMonths != null ? String(r.periodMonths) : '',
          absenceLimit: r.absenceLimit != null ? String(r.absenceLimit) : '',
          consecutiveAbsenceLimit: r.consecutiveAbsenceLimit != null ? String(r.consecutiveAbsenceLimit) : '',
          isActive: r.isActive,
          bulk: false,
          bulkNames: '',
        })}
        isFormValid={(f) => (f.bulk ? parseBulkNames(f.bulkNames).length > 0 : !!f.name.trim())}
        getFormErrors={(f) => {
          if (f.bulk) return parseBulkNames(f.bulkNames).length === 0 ? [`En az bir ${T.branchSingular.toLocaleLowerCase('tr')} adı giriniz.`] : []
          return !f.name.trim() ? [`${T.branchSingular} adı zorunludur.`] : []
        }}
        onCreate={async (f) => {
          if (!f.bulk) {
            await service.branches.create(f)
            toast.success(`${T.branchSingular} eklendi.`)
            return
          }
          const failed: string[] = []
          for (const name of parseBulkNames(f.bulkNames)) {
            try {
              await service.branches.create({ ...f, name })
            } catch {
              failed.push(name)
            }
          }
          const created = parseBulkNames(f.bulkNames).length - failed.length
          if (created === 0) {
            const message = `Hiçbir ${T.branchSingular.toLocaleLowerCase('tr')} eklenemedi: ${failed.join(', ')}`
            toast.error(message)
            throw new Error(message)
          }
          if (failed.length) toast.warning(`${created} ${T.branchSingular.toLocaleLowerCase('tr')} eklendi, eklenemeyenler: ${failed.join(', ')}`)
          else toast.success(`${created} ${T.branchSingular.toLocaleLowerCase('tr')} eklendi.`)
        }}
        onUpdate={async (id, f) => { await service.branches.update(id, f); toast.success('Değişiklikler kaydedildi.') }}
        isActive={(r) => r.isActive}
        deleteConfirm={{ title: `${T.branchSingular} Sil`, description: 'Bu branşı silmek istediğinizden emin misiniz?' }}
        formShell
        renderForm={({ form, setForm, mode }) => (
          <AdminFormShell
            icon={LayersIcon}
            title={mode === 'edit' ? `${T.branchSingular} Düzenle` : `Yeni ${T.branchSingular} Ekle`}
            subtitle="Branş adı, kategorisi, açıklaması ve durumu"
            badge={mode === 'edit' ? 'Düzenleme' : 'Yeni kayıt'}
            tone="violet"
          >
            <FormSection icon={FileTextIcon} title="Branş Bilgileri" variant="card">
              {mode === 'create' && (
                <div className="flex items-center justify-between gap-[15px]">
                  <Label>Çoklu ekleme</Label>
                  <Switch checked={form.bulk} onCheckedChange={(v) => setForm((p) => ({ ...p, bulk: v }))} />
                </div>
              )}
              {form.bulk ? (
                <Field label={`${T.branchPlural} (her satıra bir ad)`} required hint={`${parseBulkNames(form.bulkNames).length} ${T.branchSingular.toLocaleLowerCase('tr')} eklenecek`}>
                  <Textarea rows={8} placeholder={'Yüzme\nBasketbol\nVoleybol'} value={form.bulkNames} onChange={(e) => setForm((p) => ({ ...p, bulkNames: e.target.value }))} />
                </Field>
              ) : (
                <Field label={`${T.branchSingular} Adı`} required>
                  <Input placeholder={`${T.branchSingular} adını giriniz...`} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                </Field>
              )}

              <Field
                label="Kurs Grubu / Kategori"
                hint="Örn: Mutfak & Gastronomi, Spor & Fitness, El Sanatları... Aynı gruptan yalnızca bir kursa izin kuralı bu kategoriye göre işletilir."
              >
                <Combobox
                  value={form.category ?? ''}
                  onChange={(val) => setForm((p) => ({ ...p, category: val }))}
                  options={DEFAULT_BRANCH_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  allowCustom
                  placeholder="Kategori seçin veya yeni yazın..."
                />
              </Field>

              <Field label="Açıklama">
                <Textarea rows={3} placeholder="Kısa açıklama (opsiyonel)..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              </Field>
            </FormSection>

            <FormSection icon={PowerIcon} title="Durum" variant="card">
              <div className="flex items-center justify-between gap-[15px]">
                <Label>Aktif</Label>
                <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
              </div>
            </FormSection>
          </AdminFormShell>
        )}
      />

      {/* Toplu Kategori Değiştirme Modalı */}
      {/* Toplu Kategori Değiştirme Modalı */}
      <Modal
        open={bulkCategoryModalOpen}
        onClose={() => !bulkCategorySaving && setBulkCategoryModalOpen(false)}
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
                Seçili {selectedBranches.length} {T.branchSingular.toLocaleLowerCase('tr')} için kategori güncellemesi
              </p>
            </div>
          </div>
        }
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <Button
              variant="outline"
              size="sm"
              disabled={bulkCategorySaving || !targetCategory}
              onClick={() => setTargetCategory('')}
              className="text-xs text-[hsl(var(--foreground-muted))] hover:text-danger hover:border-danger/40 transition-colors"
            >
              Kategoriyi Temizle
            </Button>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                disabled={bulkCategorySaving}
                onClick={() => setBulkCategoryModalOpen(false)}
              >
                İptal
              </Button>
              <Button
                variant="primary"
                size="sm"
                isLoading={bulkCategorySaving}
                onClick={handleBulkCategorySave}
                className="px-5 font-semibold gap-1.5 shadow-sm"
              >
                Uygula ({selectedBranches.length})
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
                Seçilen {T.branchPlural} ({selectedBranches.length})
              </span>
              <span className="text-[11px] text-[hsl(var(--foreground-muted))]">
                Kategori atanacak kayıtlar
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {selectedBranches.map((b) => (
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
                  value={targetCategory}
                  onChange={setTargetCategory}
                  options={DEFAULT_BRANCH_CATEGORIES.map((c) => ({ value: c, label: c }))}
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
                const isSelected = targetCategory === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setTargetCategory(cat)}
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
    </>
  )
}
