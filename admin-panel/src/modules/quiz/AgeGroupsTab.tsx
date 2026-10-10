import { useCallback, useEffect, useState } from 'react'
import { UsersIcon, CheckCircle2Icon, PowerOffIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Input, Field, FormSection, AdminFormShell } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import quizAgeGroupService from '@/services/quizAgeGroup.service'
import type { QuizAgeGroup, QuizAgeGroupForm } from '@/types/quizAgeGroup.types'

const rangeLabel = (g: { minAge: number; maxAge: number }): string =>
  g.minAge > 0 && g.maxAge > 0 ? `${g.minAge}–${g.maxAge} yaş`
    : g.minAge > 0 ? `${g.minAge}+ yaş`
      : g.maxAge > 0 ? `0–${g.maxAge} yaş` : 'Tüm yaşlar'

export const AgeGroupsTab = ({ embedded }: { embedded?: boolean }) => {
  const { can } = useAuth()
  const [summary, setSummary] = useState<{ total: number; active: number; passive: number } | null>(null)

  const loadSummary = useCallback(() => {
    quizAgeGroupService.getSummary({}).then(setSummary).catch(() => setSummary(null))
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary])

  return (
    <CrudListTemplate<QuizAgeGroup, QuizAgeGroupForm>
      icon={UsersIcon}
      title="Yaş Grupları"
      subtitle="Yarışmaların atandığı yaş grupları; her grup kendi liderlik tablosuna sahiptir"
      resourceName="Yaş Grubu"
      embedded={embedded}
      service={{
        getList: (p) => quizAgeGroupService.getList(p),
        remove: can('quiz.delete') ? (id) => quizAgeGroupService.delete(id) : undefined,
        toggleStatus: can('quiz.edit') ? (id) => quizAgeGroupService.toggleStatus(id) : undefined,
      }}
      rowKey={(r) => r.id}
      searchPlaceholder="Yaş grubu adı ara..."
      selectable
      isActive={(r) => r.isActive}
      canDelete={(r) => can('quiz.delete') && r.quizCount === 0}
      canToggle={(r) => can('quiz.edit') && (!r.isActive || r.quizCount === 0)}
      onMutated={loadSummary}
      drawerWidth={460}
      columns={[
        {
          key: 'name', header: 'Yaş Grubu', sortable: true, sortKey: 'name',
          cell: (r) => <span className="type-body-strong">{r.name}</span>,
        },
        {
          key: 'range', header: 'Aralık', align: 'center',
          cell: (r) => <Badge tone="info">{rangeLabel(r)}</Badge>,
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
        { label: 'Toplam Yaş Grubu', value: summary?.total ?? total, icon: UsersIcon, accent: 'blue' },
        { label: 'Aktif', value: summary?.active ?? rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
        { label: 'Pasif', value: summary?.passive ?? rows.filter((r) => !r.isActive).length, icon: PowerOffIcon, accent: 'orange' },
      ]}
      deleteConfirm={{
        title: 'Yaş Grubunu Sil',
        description: 'Bu yaş grubunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      }}
      toggleConfirm={(row, willActivate) => willActivate
        ? { title: 'Yaş Grubunu Aktif Et', description: `"${row.name}" yeniden aktif edilecek.` }
        : { title: 'Yaş Grubunu Pasife Al', description: `"${row.name}" pasife alınacak; yeni yarışmalarda seçilemez. Yalnızca yarışma tanımlı olmayan yaş grupları pasife alınabilir.` }}
      emptyForm={{ name: '', minAge: 0, maxAge: 0, sortOrder: 0 }}
      toForm={(r) => ({ name: r.name, minAge: r.minAge, maxAge: r.maxAge, sortOrder: r.sortOrder })}
      getFormErrors={(f) => [
        !f.name.trim() && 'Yaş grubu adı zorunludur.',
        f.maxAge > 0 && f.maxAge < f.minAge && 'En büyük yaş, en küçük yaştan küçük olamaz.',
      ].filter(Boolean) as string[]}
      formShell
      renderForm={({ form, setForm, mode, editingRow }) => (
        <AdminFormShell
          icon={UsersIcon}
          title={mode === 'edit' ? 'Yaş Grubu Düzenle' : 'Yeni Yaş Grubu Ekle'}
          subtitle="Yaş grubunun adını ve yaş aralığını yönetin"
          badge={editingRow?.isActive === false ? 'Pasif' : 'Yaş Grubu'}
          tone="violet"
        >
          <FormSection icon={UsersIcon} title="Yaş Grubu Bilgileri" variant="card">
            <Field label="Grup Adı" required>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Örn. 7-9 Yaş"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="En Küçük Yaş" hint="0 = alt sınır yok">
                <Input
                  sanitize="digits"
                  inputMode="numeric"
                  value={form.minAge ? String(form.minAge) : ''}
                  onChange={(e) => setForm((p) => ({ ...p, minAge: e.target.value ? Number(e.target.value) : 0 }))}
                  placeholder="0"
                />
              </Field>
              <Field label="En Büyük Yaş" hint="0 = üst sınır yok (60+ gibi)">
                <Input
                  sanitize="digits"
                  inputMode="numeric"
                  value={form.maxAge ? String(form.maxAge) : ''}
                  onChange={(e) => setForm((p) => ({ ...p, maxAge: e.target.value ? Number(e.target.value) : 0 }))}
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label="Sıra" hint="Listeleme sırası (küçük önce)">
              <Input
                sanitize="digits"
                inputMode="numeric"
                value={form.sortOrder ? String(form.sortOrder) : ''}
                onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value ? Number(e.target.value) : 0 }))}
                placeholder="0"
              />
            </Field>

            <div className="rounded-card border border-border bg-surface-1 p-3">
              <p className="type-caption mb-2">Önizleme</p>
              <Badge tone="info">{form.name.trim() || 'Yaş grubu adı'} · {rangeLabel(form)}</Badge>
            </div>
          </FormSection>
        </AdminFormShell>
      )}
      creatable={can('quiz.create')}
      canEdit={() => can('quiz.edit')}
      onCreate={can('quiz.create') ? (f) => quizAgeGroupService.create(f).then(() => undefined) : undefined}
      onUpdate={can('quiz.edit') ? (id, f) => quizAgeGroupService.update(id, f).then(() => undefined) : undefined}
    />
  )
}
