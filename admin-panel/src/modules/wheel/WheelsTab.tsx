import { useCallback, useEffect, useState } from 'react'
import { CircleDotIcon, CheckCircle2Icon, CircleSlashIcon, RotateCwIcon, PlayIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Select, FilterField, IconButton } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import wheelService from '@/services/wheel.service'
import { refreshSidebarBadges } from '@/lib/sidebarBadge'
import type { Wheel, WheelSummary } from '@/types/wheel.types'
import { WHEEL_STATUS_OPTIONS } from '@/types/wheel.types'
import { wheelColumns } from './wheelColumns'
import { WheelFormSections } from './WheelFormSections'
import { WheelPreviewModal } from './WheelPreviewModal'
import { emptyWheelForm, toWheelForm, toWheelInput, getWheelFormErrors, type WheelForm } from './wheelForm'

export const WheelsTab = () => {
  const { can } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [summary, setSummary] = useState<WheelSummary | null>(null)
  const [preview, setPreview] = useState<Wheel | null>(null)

  const fetchSummary = useCallback(async () => {
    try { setSummary(await wheelService.getSummary(statusFilter ? { status: statusFilter } : {})) }
    catch { setSummary(null) }
  }, [statusFilter])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  return (
    <>
      <CrudListTemplate<Wheel, WheelForm>
        icon={CircleDotIcon}
        title="Hediye Çarkları"
        subtitle="Kullanıcıların çevireceği çarkları ve dilim kazanma oranlarını yönetin"
        resourceName="Çark"
        service={{
          getList: (p) => wheelService.getList(p),
          remove: can('wheel.delete') ? async (id) => { await wheelService.delete(id); refreshSidebarBadges() } : undefined,
          toggleStatus: can('wheel.edit') ? (id) => wheelService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        columns={wheelColumns}
        defaultSort={{ key: 'createdAt', dir: 'desc' }}
        searchPlaceholder="Çark başlığı ara..."
        selectable
        drawerWidth={680}
        onMutated={fetchSummary}
        filterColumns={2}
        extraParams={{ status: statusFilter }}
        hasActiveFilters={!!statusFilter}
        onClearFilters={() => setStatusFilter('')}
        renderFilters={() => (
          <FilterField label="Durum">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tüm Durumlar</option>
              {WHEEL_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
        )}
        stats={({ total }) => [
          { label: 'Toplam Çark', value: summary?.total ?? total, icon: CircleDotIcon, accent: 'blue' },
          { label: 'Aktif', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif', value: summary?.passive ?? 0, icon: CircleSlashIcon, accent: 'orange' },
          { label: 'Toplam Çevirme', value: (summary?.totalSpins ?? 0).toLocaleString('tr-TR'), icon: RotateCwIcon, accent: 'violet' },
        ]}
        emptyForm={emptyWheelForm()}
        toForm={toWheelForm}
        getFormErrors={getWheelFormErrors}
        isActive={(r) => r.status === 'Active'}
        deleteConfirm={{ title: 'Çarkı Sil', description: 'Bu çark ve tüm dilimleri silinecek. Bu işlem geri alınamaz. Devam edilsin mi?' }}
        toggleConfirm={(row, willActivate) => willActivate
          ? { title: 'Çarkı Aktif Et', description: `"${row.title}" aktif edilecek ve kullanıcılara açılacak.` }
          : { title: 'Çarkı Pasife Al', description: `"${row.title}" pasife alınacak; kullanıcılar çeviremez. Devam edilsin mi?` }}
        extraRowActions={(row) => (
          <IconButton tone="primary" title="Test Et (önizleme)" onClick={() => setPreview(row)}>
            <PlayIcon className="h-4 w-4" />
          </IconButton>
        )}
        creatable={can('wheel.create')}
        canEdit={() => can('wheel.edit')}
        canDelete={() => can('wheel.delete')}
        onCreate={can('wheel.create') ? async (f) => { await wheelService.create(toWheelInput(f)); toast.success('Çark oluşturuldu.') } : undefined}
        onUpdate={can('wheel.edit') ? async (id, f) => { await wheelService.update(id, toWheelInput(f)); toast.success('Değişiklikler kaydedildi.') } : undefined}
        renderForm={({ form, setForm }) => <WheelFormSections form={form} setForm={setForm} />}
      />

      {preview && (
        <WheelPreviewModal open={!!preview} onClose={() => setPreview(null)} title={preview.title} slices={preview.slices} />
      )}
    </>
  )
}
