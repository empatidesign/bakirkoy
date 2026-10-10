import { Building2Icon, PowerIcon, CheckCircle2Icon, CircleSlashIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Input, Label, Badge, Button, DrilldownCount, Field, FormSection, type DataTableColumn } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import departmentService from '@/services/department.service'
import type { Department } from '@/types/department.types'
import { AdminsTab } from './AdminsTab'

interface DeptForm { name: string; description: string }
const emptyForm: DeptForm = { name: '', description: '' }

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

const columns: DataTableColumn<Department>[] = [
  { key: 'name', header: 'Departman Adı', sortable: true, sortKey: 'name', cell: (r) => <span className="font-medium text-foreground-strong">{r.name}</span> },
  { key: 'description', header: 'Açıklama', sortable: true, sortKey: 'description', cell: (r) => <span className="text-foreground-muted">{r.description ?? '—'}</span> },
  { key: 'assigned', header: 'Atanan Yönetici', align: 'center', cell: (r) => (
    <DrilldownCount
      count={r.assignedUserCount}
      icon={UsersIcon}
      title={`${r.name} · Atanmış Yöneticiler`}
      subtitle={`Bu departmana atanmış ${r.assignedUserCount} yönetici`}
    >
      <AdminsTab scope={{ department: r.name }} embedded />
    </DrilldownCount>
  ) },
  { key: 'durum', header: 'Durum', sortable: true, sortKey: 'isActive', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
  { key: 'olusturma', header: 'Oluşturma', sortable: true, sortKey: 'createdAt', cell: (r) => <span className="text-foreground-muted">{fmtDate(r.createdAt)}</span> },
]

export const DepartmentsTab = ({ onChanged }: { onChanged?: () => void }) => {
  const { can } = useAuth()
  return (
  <CrudListTemplate<Department, DeptForm>
    icon={Building2Icon}
    title="Departmanlar"
    subtitle="Yöneticilere atanan departmanları yönetin"
    resourceName="Departman"
    service={{
      getList: (p) => departmentService.getList(p),
      remove: can('departments.delete') ? (id) => departmentService.delete(id) : undefined,
      toggleStatus: can('departments.edit') ? (id) => departmentService.toggleStatus(id) : undefined,
    }}
    rowKey={(r) => r.id}
    columns={columns}
    selectable
    viewable
    defaultSort={{ key: 'name', dir: 'asc' }}
    searchPlaceholder="Departman adı veya açıklama ara..."
    stats={({ rows, total }) => [
      { label: 'Toplam Departman', value: total, icon: Building2Icon, accent: 'blue' },
      { label: 'Aktif Departman', value: rows.filter(r => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
      { label: 'Pasif Departman', value: rows.filter(r => !r.isActive).length, icon: CircleSlashIcon, accent: 'orange' },
    ]}
    emptyForm={emptyForm}
    toForm={(r) => ({ name: r.name, description: r.description ?? '' })}
    getFormErrors={(f) => [
      !f.name.trim() && 'Departman adı zorunludur.',
    ].filter(Boolean) as string[]}
    creatable={can('departments.create')}
    canEdit={() => can('departments.edit')}
    canDelete={() => can('departments.delete')}
    onCreate={can('departments.create') ? async (f) => { await departmentService.create({ name: f.name.trim(), description: f.description.trim() || undefined }); toast.success('Departman oluşturuldu.') } : undefined}
    onUpdate={can('departments.edit') ? async (id, f) => { await departmentService.update(id, { name: f.name.trim(), description: f.description.trim() || undefined }); toast.success('Departman güncellendi.') } : undefined}
    isActive={(r) => r.isActive}
    deleteConfirm={{ title: 'Departmanı Sil', description: 'Bu departmanı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.' }}
    toggleConfirm={(row, willActivate) => willActivate
      ? { title: 'Departmanı Aktif Et', description: `"${row.name}" departmanı yeniden aktif edilecek. Not: bu departmana bağlı yöneticiler OTOMATİK aktif olmaz — onları tek tek aktif etmeniz gerekir.` }
      : { title: 'Departmanı Pasife Al', description: `"${row.name}" pasife alınacak ve bu departmana bağlı TÜM yöneticiler de pasife alınıp girişleri engellenecek. Devam edilsin mi?` }}
    onMutated={onChanged}
    renderForm={({ form, setForm, mode, editingRow, requestToggleStatus }) => (
      <div className="p-5 space-y-5">
        <FormSection title="Departman Bilgileri" variant="card" icon={Building2Icon}>
          <Field label="Departman Adı" required>
            <Input placeholder="Departman adını giriniz..." value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </Field>
          <Field label="Açıklama">
            <Input placeholder="Kısa açıklama (opsiyonel)..." value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </Field>
        </FormSection>
        {mode === 'edit' && editingRow && (
          <FormSection title="Durum" variant="card" icon={PowerIcon}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Durum</Label>
                <Badge tone={editingRow.isActive ? 'success' : 'neutral'}>{editingRow.isActive ? 'Aktif' : 'Pasif'}</Badge>
              </div>
              <Button variant={editingRow.isActive ? 'outline' : 'primary'} size="sm" onClick={requestToggleStatus}>
                {editingRow.isActive ? 'Pasife Al' : 'Aktif Et'}
              </Button>
            </div>
          </FormSection>
        )}
      </div>
    )}
  />
  )
}
