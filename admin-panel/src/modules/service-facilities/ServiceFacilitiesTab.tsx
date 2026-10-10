import { useState, useEffect, useCallback } from 'react'
import {
  Building2Icon, HomeIcon, TreesIcon, CheckCircle2Icon, LayersIcon, EyeIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Select, FilterField, IconButton, AdminFormShell } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import serviceFacilityService from '@/services/serviceFacility.service'
import type { ServiceFacility, ServiceFacilitySummary } from '@/types/serviceFacility.types'
import { FACILITY_STATUS_OPTIONS, LOCATION_TYPE_OPTIONS, FACILITY_TYPE_OPTIONS } from '@/types/serviceFacility.types'
import { facilityColumns } from './facilityColumns'
import { FacilityFormTabs } from './FacilityFormTabs'
import { FacilityDetailModal } from './FacilityDetailModal'
import {
  emptyFacilityForm, toFacilityForm, toFacilityRequest, getFacilityFormErrors, type FacilityForm,
} from './facilityForm'

export const ServiceFacilitiesTab = () => {
  const { can } = useAuth()
  const [typeFilter, setTypeFilter] = useState('')
  const [locationTypeFilter, setLocationTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [summary, setSummary] = useState<ServiceFacilitySummary | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const fetchSummary = useCallback(async () => {
    const params: Record<string, string> = {}
    if (typeFilter) params.type = typeFilter
    if (locationTypeFilter) params.locationType = locationTypeFilter
    try { setSummary(await serviceFacilityService.getSummary(params)) } catch { setSummary(null) }
  }, [typeFilter, locationTypeFilter])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  return (
    <>
      <CrudListTemplate<ServiceFacility, FacilityForm>
        icon={Building2Icon}
        title="Hizmet Tesislerimiz"
        subtitle="Belediyenin hizmet tesislerini ekleyin, düzenleyin ve yönetin"
        resourceName="Tesis"
        service={{
          getList: (p) => serviceFacilityService.getList(p),
          remove: can('service-facilities.delete') ? (id) => serviceFacilityService.delete(id) : undefined,
          toggleStatus: can('service-facilities.edit') ? (id) => serviceFacilityService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        columns={facilityColumns}
        defaultSort={{ key: 'createdAt', dir: 'desc' }}
        searchPlaceholder="Tesis adı, ilçe, adres veya yönetici ara..."
        selectable
        onMutated={fetchSummary}
        filterColumns={3}
        extraParams={{ type: typeFilter, locationType: locationTypeFilter, status: statusFilter }}
        hasActiveFilters={!!typeFilter || !!locationTypeFilter || !!statusFilter}
        onClearFilters={() => { setTypeFilter(''); setLocationTypeFilter(''); setStatusFilter('') }}
        renderFilters={() => (
          <>
            <FilterField label="Tür">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">Tüm Türler</option>
                {FACILITY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Konum Tipi">
              <Select value={locationTypeFilter} onChange={(e) => setLocationTypeFilter(e.target.value)}>
                <option value="">Tümü</option>
                {LOCATION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Durum">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                {FACILITY_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
          </>
        )}
        stats={({ total }) => [
          { label: 'Toplam', value: summary?.total ?? total, icon: Building2Icon, accent: 'blue' },
          { label: 'Kapalı Alan', value: summary?.indoor ?? 0, icon: HomeIcon, accent: 'violet' },
          { label: 'Açık Alan', value: summary?.outdoor ?? 0, icon: TreesIcon, accent: 'green' },
          { label: 'Aktif', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'primary' },
          { label: 'Sunulan Hizmet', value: summary?.services ?? 0, icon: LayersIcon, accent: 'orange' },
        ]}
        emptyForm={emptyFacilityForm}
        toForm={toFacilityForm}
        getFormErrors={getFacilityFormErrors}
        isActive={(r) => r.status === 'Active'}
        deleteConfirm={{ title: 'Tesisi Sil', description: 'Bu tesis silinecek. Bu tesise bağlı TÜM salonlar da birlikte silinecektir. Devam edilsin mi?' }}
        toggleConfirm={(row, willActivate) => willActivate
          ? { title: 'Tesisi Aktif Et', description: `"${row.name}" aktif edilecek.` }
          : { title: 'Tesisi Pasife Al', description: `"${row.name}" pasife alınacak; vatandaşa kapatılır. Devam edilsin mi?` }}
        drawerWidth={760}
        extraRowActions={(row) => (
          <IconButton tone="default" title="Görüntüle" onClick={() => setDetailId(row.id)}>
            <EyeIcon className="h-4 w-4" />
          </IconButton>
        )}
        creatable={can('service-facilities.create')}
        canEdit={() => can('service-facilities.edit')}
        canDelete={() => can('service-facilities.delete')}
        onCreate={can('service-facilities.create') ? async (f) => {
          const created = await serviceFacilityService.create(toFacilityRequest(f))
          toast.success('Tesis oluşturuldu.')
          if (f.modules.length === 0) return
          const result = await serviceFacilityService.assignModules(created.id, f.modules)
          if (result.assigned > 0) toast.success(`${result.assigned} modüle atandı.`)
          if (result.failed.length > 0) toast.error(`${result.failed.length} modülde atama başarısız oldu.`)
        } : undefined}
        onUpdate={can('service-facilities.edit') ? async (id, f) => { await serviceFacilityService.update(id, toFacilityRequest(f)); toast.success('Değişiklikler kaydedildi.') } : undefined}
        formShell
        renderForm={({ form, setForm, mode, editingId }) => (
          <AdminFormShell
            icon={Building2Icon}
            title={mode === 'edit' ? 'Tesis Bilgilerini Düzenle' : 'Yeni Hizmet Tesisi Ekle'}
            subtitle="Temel bilgiler, konum, hizmetler ve görseller tek akışta düzenlenir"
            badge="Hizmet Tesisi"
            tone="blue"
          >
            <FacilityFormTabs form={form} setForm={setForm} editingId={editingId} />
          </AdminFormShell>
        )}
      />

      {detailId && <FacilityDetailModal id={detailId} open={!!detailId} onClose={() => setDetailId(null)} />}
    </>
  )
}
