import { useState } from 'react'
import { School2Icon, ListChecksIcon, CheckCircle2Icon, PowerOffIcon, FileTextIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Select, FilterField, Input, Field, DrilldownCount, FormSection } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import sedaService from '@/services/seda.service'
import { SedaApplicationsTab } from './SedaApplicationsTab'
import type { SedaSchool, SedaSchoolForm } from '@/types/seda.types'

export const SedaSchoolsTab = () => {
  const { can } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')

  const extraParams: Record<string, string> = {}
  if (statusFilter) extraParams.isActive = statusFilter

  return (
    <CrudListTemplate<SedaSchool, SedaSchoolForm>
      icon={School2Icon}
      title="Okullar"
      subtitle="Başvurularda seçilebilecek okul listesini yönetin"
      resourceName="Okul"
      listTitle="Okul Listesi"
      searchPlaceholder="Okul adı ara..."
      service={{
        getList: (p) => sedaService.getSchools(p),
        remove: can('seda.delete') ? (id) => sedaService.deleteSchool(id) : undefined,
        toggleStatus: can('seda.edit') ? (id) => sedaService.toggleSchool(id) : undefined,
      }}
      rowKey={(r) => r.id}
      selectable
      isActive={(r) => r.isActive}
      defaultSort={{ key: 'name', dir: 'asc' }}
      extraParams={extraParams}
      filterColumns={3}
      hasActiveFilters={!!statusFilter}
      onClearFilters={() => setStatusFilter('')}
      renderFilters={() => (
        <FilterField label="Durum">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tüm Durumlar</option>
            <option value="true">Aktif</option>
            <option value="false">Pasif</option>
          </Select>
        </FilterField>
      )}
      stats={({ rows, total }) => [
        { label: 'Toplam Okul', value: total, icon: ListChecksIcon, accent: 'blue' },
        { label: 'Aktif', value: rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
        { label: 'Pasif', value: rows.filter((r) => !r.isActive).length, icon: PowerOffIcon, accent: 'orange' },
      ]}
      columns={[
        { key: 'name', header: 'Okul Adı', sortable: true, sortKey: 'name', cell: (r) => <span className="type-body-strong">{r.name}</span> },
        {
          key: 'applications', header: 'Başvuru', align: 'center',
          cell: (r) => (
            <DrilldownCount
              count={r.applicationCount}
              title={`${r.name} — Başvurular`}
              subtitle="Bu okula ait başvurular"
              icon={FileTextIcon}
            >
              <SedaApplicationsTab embedded scope={{ schoolName: r.name }} />
            </DrilldownCount>
          ),
        },
        { key: 'isActive', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
      ]}
      emptyForm={{ name: '' }}
      toForm={(r) => ({ name: r.name })}
      getFormErrors={(f) => [
        !f.name.trim() && 'Okul adı zorunludur.',
      ].filter(Boolean) as string[]}
      renderForm={({ form, setForm }) => (
        <div className="p-5 space-y-5">
          <FormSection icon={School2Icon} title="Okul Bilgileri" variant="card">
            <Field label="Okul Adı" required>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Örn. Bakırköy Anadolu Lisesi" />
            </Field>
          </FormSection>
        </div>
      )}
      creatable={can('seda.create')}
      canEdit={() => can('seda.edit')}
      canDelete={() => can('seda.delete')}
      onCreate={can('seda.create') ? (f) => sedaService.createSchool(f).then(() => undefined) : undefined}
      onUpdate={can('seda.edit') ? (id, f) => sedaService.updateSchool(id, f).then(() => undefined) : undefined}
      deleteConfirm={{ title: 'Okulu Sil', description: 'Bu okulu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.' }}
      toggleConfirm={(row, willActivate) => willActivate
        ? { title: 'Okulu Aktif Et', description: `"${row.name}" yeniden aktif edilecek ve başvurularda seçilebilecek.` }
        : { title: 'Okulu Pasife Al', description: `"${row.name}" pasife alınacak ve yeni başvurularda seçilemeyecek.` }}
    />
  )
}
