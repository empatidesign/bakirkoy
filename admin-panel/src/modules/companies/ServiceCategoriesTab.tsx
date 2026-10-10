import { useCallback, useEffect, useState } from 'react'
import { TagsIcon, CheckCircle2Icon, PowerOffIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Input, Textarea, Field, ColorSwatchPicker, isHexColor, FormSection, AdminFormShell } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import serviceCategoryService from '@/services/serviceCategory.service'
import { SERVICE_CATEGORY_PALETTE } from '@/types/serviceCategory.types'
import type { ServiceCategory, ServiceCategoryForm } from '@/types/serviceCategory.types'

export const ServiceCategoriesTab = ({ embedded }: { embedded?: boolean } = {}) => {
  const { can } = useAuth()
  const [summary, setSummary] = useState<{ total: number; active: number; passive: number } | null>(null)

  const loadSummary = useCallback(() => {
    serviceCategoryService.getSummary({}).then(setSummary).catch(() => setSummary(null))
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary])

  return (
    <CrudListTemplate<ServiceCategory, ServiceCategoryForm>
      icon={TagsIcon}
      title="Hizmet Kategorileri"
      subtitle="Firmaların sunduğu hizmet türleri — kampanyalar bu kategorilere göre filtrelenir"
      resourceName="Kategori"
      embedded={embedded}
      service={{
        getList: (p) => serviceCategoryService.getList(p),
        remove: can('companies.delete') ? (id) => serviceCategoryService.delete(id) : undefined,
        toggleStatus: can('companies.edit') ? (id) => serviceCategoryService.toggleStatus(id) : undefined,
      }}
      rowKey={(r) => r.id}
      searchPlaceholder="Kategori adı veya açıklama ara..."
      selectable
      viewable
      isActive={(r) => r.isActive}
      creatable={can('companies.create')}
      canEdit={() => can('companies.edit')}
      canDelete={(r) => can('companies.delete') && r.companyCount === 0}
      canToggle={(r) => can('companies.edit') && (!r.isActive || r.companyCount === 0)}
      onMutated={loadSummary}
      drawerWidth={460}
      columns={[
        {
          key: 'name', header: 'Kategori', sortable: true, sortKey: 'name',
          cell: (r) => <Badge color={r.color}>{r.name}</Badge>,
        },
        {
          key: 'description', header: 'Açıklama',
          cell: (r) => <span className="type-muted">{r.description || '—'}</span>,
        },
        {
          key: 'companyCount', header: 'Firma', align: 'center', sortable: true, sortKey: 'companyCount',
          cell: (r) => <span className="tabular-nums text-foreground-strong">{r.companyCount}</span>,
        },
        {
          key: 'isActive', header: 'Durum', align: 'center',
          cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge>,
        },
      ]}
      stats={({ rows, total }) => [
        { label: 'Toplam Kategori', value: summary?.total ?? total, icon: TagsIcon, accent: 'blue' },
        { label: 'Aktif Kategori', value: summary?.active ?? rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
        { label: 'Pasif Kategori', value: summary?.passive ?? rows.filter((r) => !r.isActive).length, icon: PowerOffIcon, accent: 'orange' },
      ]}
      deleteConfirm={{
        title: 'Kategoriyi Sil',
        description: 'Bu hizmet kategorisini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz. Yalnızca hiçbir firmaya atanmamış kategoriler silinebilir.',
      }}
      toggleConfirm={(row, willActivate) => willActivate
        ? { title: 'Kategoriyi Aktif Et', description: `"${row.name}" yeniden aktif edilecek.` }
        : { title: 'Kategoriyi Pasife Al', description: `"${row.name}" pasife alınacak; firmalar yeni atamada seçemez. Yalnızca firmaya atanmamış kategoriler pasife alınabilir.` }}
      emptyForm={{ name: '', description: '', color: SERVICE_CATEGORY_PALETTE[0] }}
      toForm={(r) => ({ name: r.name, description: r.description ?? '', color: r.color })}
      getFormErrors={(f) => [
        !f.name.trim() && 'Kategori adı zorunludur.',
        !isHexColor(f.color) && 'Geçerli bir renk seçiniz.',
      ].filter(Boolean) as string[]}
      formShell
      renderForm={({ form, setForm, mode, editingRow }) => (
        <AdminFormShell
          icon={TagsIcon}
          title={mode === 'edit' ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
          subtitle="Hizmet kategorisinin adını, açıklamasını ve görünüm rengini düzenleyin"
          badge={editingRow?.isActive === false ? 'Pasif' : 'Kategori'}
          tone="violet"
        >
          <FormSection icon={TagsIcon} title="Kategori Bilgileri" variant="card">
            <Field label="Kategori Adı" required>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Örn. Restoran"
              />
            </Field>

            <Field label="Açıklama">
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Kategori hakkında kısa açıklama"
              />
            </Field>

            <Field label="Renk" required>
              <ColorSwatchPicker value={form.color} onChange={(c) => setForm((p) => ({ ...p, color: c }))} />
            </Field>

            <div className="rounded-card border border-border bg-surface-1 p-3">
              <p className="type-caption mb-2">Önizleme</p>
              <Badge color={isHexColor(form.color) ? form.color : undefined}>
                {form.name.trim() || 'Kategori adı'}
              </Badge>
            </div>
          </FormSection>
        </AdminFormShell>
      )}
      onCreate={can('companies.create') ? (f) => serviceCategoryService.create(f).then(() => undefined) : undefined}
      onUpdate={can('companies.edit') ? (id, f) => serviceCategoryService.update(id, f).then(() => undefined) : undefined}
    />
  )
}
