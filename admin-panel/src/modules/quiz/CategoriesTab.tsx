import { useCallback, useEffect, useState } from 'react'
import { TagIcon, CheckCircle2Icon, PowerOffIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Input, Textarea, Field, ColorSwatchPicker, isHexColor, FormSection, AdminFormShell } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import quizCategoryService from '@/services/quizCategory.service'
import type { QuizCategory, QuizCategoryForm } from '@/types/quizCategory.types'

const PRESET_COLORS = ['#2563eb', '#16a34a', '#ea580c', '#7c3aed', '#dc2626', '#0891b2', '#db2777', '#ca8a04']

export const CategoriesTab = ({ embedded }: { embedded?: boolean }) => {
  const { can } = useAuth()
  const [summary, setSummary] = useState<{ total: number; active: number; passive: number } | null>(null)

  const loadSummary = useCallback(() => {
    quizCategoryService.getSummary({}).then(setSummary).catch(() => setSummary(null))
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary])

  return (
    <CrudListTemplate<QuizCategory, QuizCategoryForm>
      icon={TagIcon}
      title="Yarışma Kategorileri"
      subtitle="Bilgi yarışmalarının sınıflandırıldığı kategoriler"
      resourceName="Kategori"
      embedded={embedded}
      service={{
        getList: (p) => quizCategoryService.getList(p),
        remove: can('quiz.delete') ? (id) => quizCategoryService.delete(id) : undefined,
        toggleStatus: can('quiz.edit') ? (id) => quizCategoryService.toggleStatus(id) : undefined,
      }}
      rowKey={(r) => r.id}
      searchPlaceholder="Kategori adı veya açıklama ara..."
      selectable
      viewable
      isActive={(r) => r.isActive}
      canDelete={(r) => can('quiz.delete') && r.quizCount === 0}
      canToggle={(r) => can('quiz.edit') && (!r.isActive || r.quizCount === 0)}
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
          key: 'quizCount', header: 'Yarışma', align: 'center', sortable: true, sortKey: 'quizCount',
          cell: (r) => <span className="tabular-nums text-foreground-strong">{r.quizCount}</span>,
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
        : { title: 'Kategoriyi Pasife Al', description: `"${row.name}" pasife alınacak; yeni yarışmalarda seçilemez. Yalnızca yarışma tanımlı olmayan kategoriler pasife alınabilir.` }}
      emptyForm={{ name: '', description: '', color: PRESET_COLORS[0] }}
      toForm={(r) => ({ name: r.name, description: r.description ?? '', color: r.color })}
      getFormErrors={(f) => [
        !f.name.trim() && 'Kategori adı zorunludur.',
        !isHexColor(f.color) && 'Geçerli bir renk seçiniz.',
      ].filter(Boolean) as string[]}
      formShell
      renderForm={({ form, setForm, mode, editingRow }) => (
        <AdminFormShell
          icon={TagIcon}
          title={mode === 'edit' ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
          subtitle="Yarışma kategorisinin adını, açıklamasını ve rengini yönetin"
          badge={editingRow?.isActive === false ? 'Pasif' : 'Kategori'}
          tone="violet"
        >
          <FormSection icon={TagIcon} title="Kategori Bilgileri" variant="card">
            <Field label="Kategori Adı" required>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Örn. Bakırköy"
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
      creatable={can('quiz.create')}
      canEdit={() => can('quiz.edit')}
      onCreate={can('quiz.create') ? (f) => quizCategoryService.create(f).then(() => undefined) : undefined}
      onUpdate={can('quiz.edit') ? (id, f) => quizCategoryService.update(id, f).then(() => undefined) : undefined}
    />
  )
}
