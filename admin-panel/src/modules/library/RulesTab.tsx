import { useCallback, useEffect, useState } from 'react'
import { FileTextIcon, CheckCircle2Icon, PowerOffIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Select, FilterField, Input, Textarea, Field, FormSection, AdminFormShell } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import libraryService from '@/services/library.service'
import {
  RULE_CATEGORY_LABELS, RULE_CATEGORY_OPTIONS,
  RULE_SEVERITY_LABELS, RULE_SEVERITY_TONE, RULE_SEVERITY_OPTIONS,
} from '@/types/library.types'
import type { LibraryRule, LibraryRuleForm, RuleSummary, RuleCategory, RuleSeverity } from '@/types/library.types'

const emptyForm: LibraryRuleForm = {
  category: 'general', title: '', description: '', icon: '📖', severity: 'info',
}

export const RulesTab = ({ libraryId }: { libraryId: string }) => {
  const { can } = useAuth()
  const [categoryFilter, setCategoryFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [summary, setSummary] = useState<RuleSummary | null>(null)

  const loadSummary = useCallback(() => {
    libraryService.rules.getSummary({ libraryId }).then(setSummary).catch(() => setSummary(null))
  }, [libraryId])
  useEffect(() => { loadSummary() }, [loadSummary])

  const extraParams: Record<string, string> = { libraryId }
  if (categoryFilter) extraParams.category = categoryFilter
  if (severityFilter) extraParams.severity = severityFilter

  return (
    <CrudListTemplate<LibraryRule, LibraryRuleForm>
      icon={FileTextIcon}
      title="Kütüphane Kuralları"
      subtitle="Üyelere gösterilen kullanım kuralları"
      resourceName="Kural"
      listTitle="Kural Listesi"
      searchPlaceholder="Kural başlığı veya açıklama ara..."
      service={{
        getList: (p) => libraryService.rules.getList(p),
        remove: can('library.delete') ? (id) => libraryService.rules.delete(id) : undefined,
        toggleStatus: can('library.edit') ? (id) => libraryService.rules.toggleStatus(id) : undefined,
      }}
      rowKey={(r) => r.id}
      selectable
      viewable
      isActive={(r) => r.isActive}
      onMutated={loadSummary}
      drawerWidth={480}
      extraParams={extraParams}
      filterColumns={2}
      hasActiveFilters={!!categoryFilter || !!severityFilter}
      filterCount={(categoryFilter ? 1 : 0) + (severityFilter ? 1 : 0)}
      onClearFilters={() => { setCategoryFilter(''); setSeverityFilter('') }}
      renderFilters={() => (
        <>
          <FilterField label="Kategori">
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Tüm Kategoriler</option>
              {RULE_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Önem">
            <Select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value="">Tümü</option>
              {RULE_SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
        </>
      )}
      stats={({ rows, total }) => [
        { label: 'Toplam Kural', value: summary?.total ?? total, icon: FileTextIcon, accent: 'blue' },
        { label: 'Aktif', value: summary?.active ?? rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
        { label: 'Pasif', value: summary?.passive ?? rows.filter((r) => !r.isActive).length, icon: PowerOffIcon, accent: 'orange' },
      ]}
      columns={[
        {
          key: 'title', header: 'Kural', sortable: true, sortKey: 'title',
          cell: (r) => (
            <div className="flex items-center gap-2">
              <span className="text-base leading-none">{r.icon}</span>
              <span className="type-body-strong">{r.title}</span>
            </div>
          ),
        },
        { key: 'category', header: 'Kategori', align: 'center', cell: (r) => <Badge tone="neutral">{RULE_CATEGORY_LABELS[r.category]}</Badge> },
        { key: 'description', header: 'Açıklama', cell: (r) => <span className="type-muted line-clamp-1">{r.description || '—'}</span> },
        { key: 'severity', header: 'Önem', align: 'center', cell: (r) => <Badge tone={RULE_SEVERITY_TONE[r.severity]}>{RULE_SEVERITY_LABELS[r.severity]}</Badge> },
        { key: 'isActive', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
      ]}
      emptyForm={emptyForm}
      toForm={(r) => ({ category: r.category, title: r.title, description: r.description, icon: r.icon, severity: r.severity })}
      getFormErrors={(f) => [
        !f.title.trim() && 'Başlık zorunludur.',
        !f.description.trim() && 'Açıklama zorunludur.',
      ].filter(Boolean) as string[]}
      formShell
      renderForm={({ form, setForm, mode, editingRow }) => (
        <AdminFormShell
          icon={FileTextIcon}
          title={mode === 'edit' ? 'Kural Düzenle' : 'Yeni Kural Ekle'}
          subtitle="Üyelere gösterilen kural metni, kategori ve önem bilgisini yönetin"
          badge={editingRow?.isActive === false ? 'Pasif' : 'Kural'}
          tone="blue"
        >
          <FormSection icon={FileTextIcon} title="Kural Bilgileri" variant="card">
            <div className="grid grid-cols-[80px_1fr] gap-[15px]">
              <Field label="İkon">
                <Input value={form.icon} onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))} placeholder="📖" className="text-center" />
              </Field>
              <Field label="Başlık" required>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Örn. Sessizlik Kuralı" />
              </Field>
            </div>
            <Field label="Açıklama" required>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Kuralın açıklaması" />
            </Field>
            <div className="grid grid-cols-2 gap-[15px]">
              <Field label="Kategori">
                <Select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as RuleCategory }))}>
                  {RULE_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Önem">
                <Select value={form.severity} onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value as RuleSeverity }))}>
                  {RULE_SEVERITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
            </div>
          </FormSection>
        </AdminFormShell>
      )}
      creatable={can('library.create')}
      canEdit={() => can('library.edit')}
      canDelete={() => can('library.delete')}
      onCreate={can('library.create') ? (f) => libraryService.rules.create({ ...f, libraryId }).then(() => { loadSummary() }) : undefined}
      onUpdate={can('library.edit') ? (id, f) => libraryService.rules.update(id, f).then(() => { loadSummary() }) : undefined}
      deleteConfirm={{ title: 'Kuralı Sil', description: 'Bu kuralı silmek istediğinizden emin misiniz?' }}
      toggleConfirm={(row, willActivate) => willActivate
        ? { title: 'Kuralı Aktif Et', description: `"${row.title}" yeniden aktif edilecek.` }
        : { title: 'Kuralı Pasife Al', description: `"${row.title}" pasife alınacak; üyelere gösterilmez.` }}
    />
  )
}
