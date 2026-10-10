import { useCallback, useEffect, useState } from 'react'
import { TagIcon, CheckCircle2Icon, PowerOffIcon, LayersIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { Button, Badge, Input, NumberInput, Textarea, Field, ColorSwatchPicker, isHexColor, FormSection } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import eventCategoryService from '@/services/eventCategory.service'
import type { EventCategory, EventCategoryForm } from '@/types/eventCategory.types'
import { CategoryBulkCreateModal } from './CategoryBulkCreateModal'

const PRESET_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#ca8a04']

export const CategoriesTab = ({ embedded }: { embedded?: boolean }) => {
  const { can } = useAuth()
  const [summary, setSummary] = useState<{ total: number; active: number; passive: number } | null>(null)

  const loadSummary = useCallback(() => {
    eventCategoryService.getSummary({}).then(setSummary).catch(() => setSummary(null))
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [refreshSignal, setRefreshSignal] = useState(0)

  return (
    <>
    <CategoryBulkCreateModal
      open={bulkOpen}
      onClose={() => setBulkOpen(false)}
      onCreated={() => { setRefreshSignal((n) => n + 1); loadSummary() }}
    />
    <CrudListTemplate<EventCategory, EventCategoryForm>
      icon={TagIcon}
      title="Etkinlik Kategorileri"
      subtitle="Etkinliklerin sınıflandırıldığı kategori ve programlar"
      resourceName="Kategori"
      embedded={embedded}
      refreshSignal={refreshSignal}
      extraHeaderActions={can('events.create') && (
        <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)} iconLeft={<LayersIcon className="h-3.5 w-3.5" />}>
          Çoklu Ekle
        </Button>
      )}
      service={{
        getList: (p) => eventCategoryService.getList(p),
        remove: can('events.delete') ? (id) => eventCategoryService.delete(id) : undefined,
        toggleStatus: can('events.edit') ? (id) => eventCategoryService.toggleStatus(id) : undefined,
      }}
      rowKey={(r) => r.id}
      searchPlaceholder="Kategori adı veya açıklama ara..."
      selectable
      viewable
      isActive={(r) => r.isActive}
      creatable={can('events.create')}
      canEdit={() => can('events.edit')}
      canDelete={(r) => can('events.delete') && r.eventCount === 0}
      canToggle={(r) => can('events.edit') && (!r.isActive || r.eventCount === 0)}
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
          key: 'defaultPoints', header: 'Varsayılan Puan', align: 'center', sortable: true, sortKey: 'defaultPoints',
          cell: (r) => <span className="tabular-nums text-foreground-strong">{r.defaultPoints}</span>,
        },
        {
          key: 'eventCount', header: 'Etkinlik', align: 'center', sortable: true, sortKey: 'eventCount',
          cell: (r) => <span className="tabular-nums text-foreground-strong">{r.eventCount}</span>,
        },
        {
          key: 'isActive', header: 'Durum', align: 'center',
          cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge>,
        },
      ]}
      stats={({ rows, total }) => [
        { label: 'Toplam Kategori', value: summary?.total ?? total, icon: TagIcon, accent: 'blue' },
        { label: 'Aktif Kategori', value: summary?.active ?? rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
        { label: 'Pasif Kategori', value: summary?.passive ?? rows.filter((r) => !r.isActive).length, icon: PowerOffIcon, accent: 'orange' },
      ]}
      deleteConfirm={{
        title: 'Kategoriyi Sil',
        description: 'Bu kategoriyi silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      }}
      toggleConfirm={(row, willActivate) => willActivate
        ? { title: 'Kategoriyi Aktif Et', description: `"${row.name}" yeniden aktif edilecek.` }
        : { title: 'Kategoriyi Pasife Al', description: `"${row.name}" pasife alınacak; yeni etkinliklerde seçilemez. Yalnızca etkinlik tanımlı olmayan kategoriler pasife alınabilir.` }}
      emptyForm={{ name: '', description: '', color: PRESET_COLORS[0], defaultPoints: 0 }}
      toForm={(r) => ({ name: r.name, description: r.description ?? '', color: r.color, defaultPoints: r.defaultPoints })}
      getFormErrors={(f) => [
        !f.name.trim() && 'Kategori adı zorunludur.',
        !isHexColor(f.color) && 'Geçerli bir renk seçiniz.',
      ].filter(Boolean) as string[]}
      renderForm={({ form, setForm }) => (
        <div className="p-5 space-y-5">
          <FormSection icon={TagIcon} title="Kategori Bilgileri" variant="card">
            <Field label="Kategori Adı" required>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Örn. Tiyatro"
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

            <Field label="Varsayılan Katılım Puanı">
              <NumberInput
                value={form.defaultPoints}
                onChange={(n) => setForm((p) => ({ ...p, defaultPoints: n }))}
                min={0}
                suffix="puan"
              />
            </Field>

            <div className="rounded-card border border-border bg-surface-1 p-3">
              <p className="type-caption mb-2">Önizleme</p>
              <Badge color={isHexColor(form.color) ? form.color : undefined}>
                {form.name.trim() || 'Kategori adı'}
              </Badge>
            </div>
          </FormSection>
        </div>
      )}
      onCreate={can('events.create') ? (f) => eventCategoryService.create(f).then(() => undefined) : undefined}
      onUpdate={can('events.edit') ? (id, f) => eventCategoryService.update(id, f).then(() => undefined) : undefined}
    />
    </>
  )
}
