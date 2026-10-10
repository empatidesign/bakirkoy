import { useCallback, useEffect, useState } from 'react'
import { GiftIcon, CheckCircle2Icon, CircleSlashIcon, PackageCheckIcon, UsersIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Select, FilterField, IconButton, Modal } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import giftService from '@/services/gift.service'
import { refreshSidebarBadges } from '@/lib/sidebarBadge'
import type { Gift, GiftSummary } from '@/types/gift.types'
import { GIFT_STATUS_OPTIONS } from '@/types/gift.types'
import { giftColumns } from './giftColumns'
import { GiftFormSections } from './GiftFormSections'
import { GiftRequestsTab } from './GiftRequestsTab'
import { emptyGiftForm, toGiftForm, toGiftInput, getGiftFormErrors, type GiftForm } from './giftForm'

export const GiftsTab = () => {
  const { can } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [summary, setSummary] = useState<GiftSummary | null>(null)
  const [applicantsGift, setApplicantsGift] = useState<Gift | null>(null)
  const [requestsRefresh, setRequestsRefresh] = useState(0)

  const fetchSummary = useCallback(async () => {
    try { setSummary(await giftService.getSummary(statusFilter ? { status: statusFilter } : {})) }
    catch { setSummary(null) }
  }, [statusFilter])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  return (
    <>
    <CrudListTemplate<Gift, GiftForm>
      refreshSignal={requestsRefresh}
      extraRowActions={(row) => (
        <IconButton tone="primary" title="Başvuranlar" onClick={() => setApplicantsGift(row)}>
          <UsersIcon className="h-4 w-4" />
        </IconButton>
      )}
      icon={GiftIcon}
      title="Hediyeler"
      subtitle="Çarkta ve hediye taleplerinde kullanılacak hediyeleri, stoğu ve kazanan sırasını yönetin"
      resourceName="Hediye"
      service={{
        getList: (p) => giftService.getList(p),
        remove: can('wheel.delete') ? async (id) => { await giftService.delete(id); refreshSidebarBadges() } : undefined,
        toggleStatus: can('wheel.edit') ? (id) => giftService.toggleStatus(id) : undefined,
      }}
      rowKey={(r) => r.id}
      columns={giftColumns}
      defaultSort={{ key: 'createdAt', dir: 'desc' }}
      searchPlaceholder="Hediye adı ara..."
      selectable
      drawerWidth={560}
      onMutated={fetchSummary}
      filterColumns={2}
      extraParams={{ status: statusFilter }}
      hasActiveFilters={!!statusFilter}
      onClearFilters={() => setStatusFilter('')}
      renderFilters={() => (
        <FilterField label="Durum">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Tüm Durumlar</option>
            {GIFT_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
      )}
      stats={({ total }) => [
        { label: 'Toplam Hediye', value: summary?.total ?? total, icon: GiftIcon, accent: 'blue' },
        { label: 'Aktif', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
        { label: 'Pasif', value: summary?.passive ?? 0, icon: CircleSlashIcon, accent: 'orange' },
        { label: 'Dağıtılan', value: (summary?.awarded ?? 0).toLocaleString('tr-TR'), icon: PackageCheckIcon, accent: 'violet' },
      ]}
      emptyForm={emptyGiftForm}
      toForm={toGiftForm}
      getFormErrors={getGiftFormErrors}
      isActive={(r) => r.status === 'Active'}
      deleteConfirm={{ title: 'Hediyeyi Sil', description: 'Bu hediye silinecek. Bu işlem geri alınamaz. Devam edilsin mi?' }}
      toggleConfirm={(row, willActivate) => willActivate
        ? { title: 'Hediyeyi Aktif Et', description: `"${row.name}" aktif edilecek; çarkta ve taleplerde kullanılabilir olacak.` }
        : { title: 'Hediyeyi Pasife Al', description: `"${row.name}" pasife alınacak; yeni çark/taleplerde görünmeyecek. Devam edilsin mi?` }}
      creatable={can('wheel.create')}
      canEdit={() => can('wheel.edit')}
      canDelete={() => can('wheel.delete')}
      onCreate={can('wheel.create') ? async (f) => { await giftService.create(toGiftInput(f)); toast.success('Hediye oluşturuldu.') } : undefined}
      onUpdate={can('wheel.edit') ? async (id, f) => { await giftService.update(id, toGiftInput(f)); toast.success('Değişiklikler kaydedildi.') } : undefined}
      renderForm={({ form, setForm }) => <GiftFormSections form={form} setForm={setForm} />}
    />

    <Modal
      open={!!applicantsGift}
      onClose={() => setApplicantsGift(null)}
      title="Hediye Başvuranları"
      subtitle={applicantsGift?.name}
      width={1100}
      bodyClassName="p-4"
    >
      {applicantsGift && (
        <GiftRequestsTab
          key={applicantsGift.id}
          scope={{ giftId: applicantsGift.id }}
          embedded
          onMutated={() => { fetchSummary(); setRequestsRefresh((s) => s + 1) }}
        />
      )}
    </Modal>
    </>
  )
}
