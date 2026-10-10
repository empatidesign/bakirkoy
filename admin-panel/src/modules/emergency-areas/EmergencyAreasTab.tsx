import { useState, useEffect, useCallback } from 'react'
import {
  SirenIcon, CheckCircle2Icon, CircleSlashIcon, UsersIcon, MaximizeIcon, EyeIcon,
} from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { toast } from 'sonner'
import { Select, FilterField, IconButton, AdminFormShell } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import emergencyAreaService from '@/services/emergencyArea.service'
import type { SelectOption } from '@/types/common'
import type { EmergencyArea, EmergencyAreaSummary } from '@/types/emergencyArea.types'
import { EMERGENCY_STATUS_OPTIONS } from '@/types/emergencyArea.types'
import { emergencyAreaColumns } from './emergencyAreaColumns'
import { EmergencyAreaFormSections } from './EmergencyAreaFormSections'
import { EmergencyAreaDetailModal } from './EmergencyAreaDetailModal'
import { AfadSyncBar } from './AfadSyncBar'
import {
  emptyEmergencyAreaForm, toEmergencyAreaForm, toEmergencyAreaRequest, getEmergencyAreaFormErrors,
  type EmergencyAreaForm,
} from './emergencyAreaForm'

export const EmergencyAreasTab = () => {
  const { can } = useAuth()
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [neighborhoods, setNeighborhoods] = useState<SelectOption[]>([])
  const [summary, setSummary] = useState<EmergencyAreaSummary | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)

  useEffect(() => {
    let active = true
    emergencyAreaService.getNeighborhoodOptions()
      .then((data) => { if (active) setNeighborhoods(data) })
      .catch(() => { if (active) setNeighborhoods([]) })
    return () => { active = false }
  }, [])

  const fetchSummary = useCallback(async () => {
    const params: Record<string, string> = {}
    if (neighborhoodFilter) params.neighborhood = neighborhoodFilter
    if (statusFilter) params.status = statusFilter
    try { setSummary(await emergencyAreaService.getSummary(params)) } catch { setSummary(null) }
  }, [neighborhoodFilter, statusFilter])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  return (
    <>
      <AfadSyncBar
        canSync={can('emergency-areas.edit')}
        onSynced={() => { setRefreshSignal((n) => n + 1); fetchSummary() }}
      />
      <CrudListTemplate<EmergencyArea, EmergencyAreaForm>
        refreshSignal={refreshSignal}
        icon={SirenIcon}
        title="Acil Toplanma Alanları"
        subtitle="Afet ve acil durumlarda kullanılacak toplanma alanlarını ekleyin, düzenleyin ve yönetin"
        resourceName="Alan"
        tone="danger"
        service={{
          getList: (p) => emergencyAreaService.getList(p),
          remove: can('emergency-areas.delete') ? (id) => emergencyAreaService.delete(id) : undefined,
          toggleStatus: can('emergency-areas.edit') ? (id) => emergencyAreaService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        columns={emergencyAreaColumns}
        defaultSort={{ key: 'createdAt', dir: 'desc' }}
        searchPlaceholder="Alan adı, mahalle veya adres ara..."
        selectable
        onMutated={fetchSummary}
        filterColumns={2}
        extraParams={{ neighborhood: neighborhoodFilter, status: statusFilter }}
        hasActiveFilters={!!neighborhoodFilter || !!statusFilter}
        onClearFilters={() => { setNeighborhoodFilter(''); setStatusFilter('') }}
        renderFilters={() => (
          <>
            <FilterField label="Mahalle">
              <Select value={neighborhoodFilter} onChange={(e) => setNeighborhoodFilter(e.target.value)}>
                <option value="">Tüm Mahalleler</option>
                {neighborhoods.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Durum">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                {EMERGENCY_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
          </>
        )}
        stats={({ total }) => [
          { label: 'Toplam Alan', value: summary?.total ?? total, icon: SirenIcon, accent: 'blue' },
          { label: 'Aktif', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif', value: summary?.passive ?? 0, icon: CircleSlashIcon, accent: 'orange' },
          { label: 'Toplam Kapasite', value: (summary?.totalCapacity ?? 0).toLocaleString('tr-TR'), icon: UsersIcon, accent: 'primary' },
          { label: 'Toplam Alan (m²)', value: (summary?.totalAreaM2 ?? 0).toLocaleString('tr-TR'), icon: MaximizeIcon, accent: 'violet' },
        ]}
        emptyForm={emptyEmergencyAreaForm}
        toForm={toEmergencyAreaForm}
        getFormErrors={getEmergencyAreaFormErrors}
        isActive={(r) => r.status === 'Active'}
        deleteConfirm={{ title: 'Alanı Sil', description: 'Bu acil toplanma alanı silinecek. Bu işlem geri alınamaz. Devam edilsin mi?' }}
        toggleConfirm={(row, willActivate) => willActivate
          ? { title: 'Alanı Aktif Et', description: `"${row.name}" aktif edilecek; vatandaşa ve mobil uygulamada görünür olacak.` }
          : { title: 'Alanı Pasife Al', description: `"${row.name}" pasife alınacak; vatandaşa ve mobil uygulamada gösterilmez. Devam edilsin mi?` }}
        drawerWidth={640}
        extraRowActions={(row) => (
          <IconButton tone="default" title="Görüntüle" onClick={() => setDetailId(row.id)}>
            <EyeIcon className="h-4 w-4" />
          </IconButton>
        )}
        creatable={can('emergency-areas.create')}
        canEdit={() => can('emergency-areas.edit')}
        canDelete={() => can('emergency-areas.delete')}
        onCreate={can('emergency-areas.create') ? async (f) => { await emergencyAreaService.create(toEmergencyAreaRequest(f)); toast.success('Acil toplanma alanı oluşturuldu.') } : undefined}
        onUpdate={can('emergency-areas.edit') ? async (id, f) => { await emergencyAreaService.update(id, toEmergencyAreaRequest(f)); toast.success('Değişiklikler kaydedildi.') } : undefined}
        formShell
        renderForm={({ form, setForm, mode, editingRow }) => (
          <AdminFormShell
            icon={SirenIcon}
            title={mode === 'edit' ? 'Acil Alan Düzenle' : 'Yeni Acil Alan Ekle'}
            subtitle="Konum, kapasite, donanım ve sorumlu bilgilerini yönetin"
            badge={editingRow?.status ?? 'Alan'}
            tone="orange"
          >
            <EmergencyAreaFormSections form={form} setForm={setForm} />
          </AdminFormShell>
        )}
      />

      {detailId && <EmergencyAreaDetailModal id={detailId} open={!!detailId} onClose={() => setDetailId(null)} />}
    </>
  )
}
