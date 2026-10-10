import { useCallback, useEffect, useState } from 'react'
import { MegaphoneIcon, CheckCircle2Icon, AlertOctagonIcon, EyeIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { PageHeader, Select, FilterField, Badge } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import popupService from '@/services/popup.service'
import type { PopupCampaign, PopupSummary } from '@/types/popup.types'
import { POPUP_TRIGGER_LABELS, POPUP_MODULE_TARGET_OPTIONS, emptyPopupForm, popupToForm } from '@/types/popup.types'
import type { PopupForm } from '@/types/popup.types'
import { PopupFormSections } from './PopupFormSections'

export const PopupPage = () => {
  const { can } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [mandatoryFilter, setMandatoryFilter] = useState('')
  const [summary, setSummary] = useState<PopupSummary | null>(null)

  const fetchSummary = useCallback(async () => {
    try { setSummary(await popupService.getSummary({})) }
    catch { setSummary(null) }
  }, [])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  const extraParams: Record<string, string> = {}
  if (statusFilter) extraParams.isActive = statusFilter
  if (mandatoryFilter) extraParams.isMandatory = mandatoryFilter

  const getFormErrors = (f: PopupForm) => [
    !f.title.trim() && 'Popup başlığı zorunludur.',
    f.mediaItems.length === 0 && 'En az bir içerik öğesi eklenmelidir.',
    f.triggerType === 'module_enter' && !f.triggerModuleKey && 'Modül tetiklemesi için hedef alan seçilmelidir.',
    f.mediaItems.some((m) => (m.type === 'image' || m.type === 'video') && !m.url) && 'Resim/video içerikleri için dosya yüklenmeli veya bağlantı girilmelidir.',
    f.mediaItems.some((m) => m.type === 'text' && !m.text?.trim()) && 'Metin içerikleri boş bırakılamaz.',
  ].filter(Boolean) as string[]

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={MegaphoneIcon}
          title="Popup / Duyuru"
          subtitle="Vatandaş uygulamasında gösterilecek zorunlu ve bilgilendirme popup'larını yönetin"
          breadcrumb="Pazarlama / Popup"
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
        <CrudListTemplate<PopupCampaign, PopupForm>
          icon={MegaphoneIcon}
          title="Popup Kampanyaları"
          subtitle="Resim, video veya metin içerikli popup'lar oluşturun, tetikleme ve zamanlama kurallarını belirleyin"
          resourceName="Popup"
          searchPlaceholder="Popup başlığı ara..."
          service={{
            getList: (p) => popupService.getList(p),
            remove: can('popups.delete') ? (id) => popupService.remove(id) : undefined,
            toggleStatus: can('popups.edit') ? (id) => popupService.toggleStatus(id) : undefined,
          }}
          rowKey={(r) => r.id}
          selectable
          drawerWidth={680}
          defaultSort={{ key: 'priority', dir: 'desc' }}
          onMutated={fetchSummary}
          extraParams={extraParams}
          filterColumns={2}
          hasActiveFilters={!!statusFilter || !!mandatoryFilter}
          onClearFilters={() => { setStatusFilter(''); setMandatoryFilter('') }}
          renderFilters={() => (
            <>
              <FilterField label="Durum">
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">Tüm Durumlar</option>
                  <option value="true">Aktif</option>
                  <option value="false">Pasif</option>
                </Select>
              </FilterField>
              <FilterField label="Zorunluluk">
                <Select value={mandatoryFilter} onChange={(e) => setMandatoryFilter(e.target.value)}>
                  <option value="">Tümü</option>
                  <option value="true">Zorunlu</option>
                  <option value="false">Bilgilendirme</option>
                </Select>
              </FilterField>
            </>
          )}
          stats={() => [
            { label: 'Toplam Popup', value: summary?.total ?? 0, icon: MegaphoneIcon, accent: 'blue' },
            { label: 'Aktif', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
            { label: 'Zorunlu', value: summary?.mandatory ?? 0, icon: AlertOctagonIcon, accent: 'orange' },
          ]}
          columns={[
            {
              key: 'title', header: 'Başlık', sortable: true, sortKey: 'title',
              cell: (r) => (
                <div className="leading-tight">
                  <span className="type-body-strong">{r.title}</span>
                  <span className="block type-caption">{r.mediaItems.length} içerik öğesi</span>
                </div>
              ),
            },
            {
              key: 'trigger', header: 'Tetikleme',
              cell: (r) => (
                <div className="leading-tight">
                  <span className="type-body">{POPUP_TRIGGER_LABELS[r.triggerType]}</span>
                  {r.triggerType === 'module_enter' && r.triggerModuleKey && (
                    <span className="block type-caption">
                      {POPUP_MODULE_TARGET_OPTIONS.find((o) => o.value === r.triggerModuleKey)?.label ?? r.triggerModuleKey}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'mandatory', header: 'Tür', align: 'center',
              cell: (r) => <Badge tone={r.isMandatory ? 'danger' : 'info'}>{r.isMandatory ? 'Zorunlu' : 'Bilgilendirme'}</Badge>,
            },
            {
              key: 'views', header: 'Gösterim / Onay', align: 'center',
              cell: (r) => (
                <span className="flex items-center justify-center gap-1 tabular-nums">
                  <EyeIcon className="h-3.5 w-3.5 text-muted-foreground" /> {r.viewCount} / {r.acknowledgeCount}
                </span>
              ),
            },
            { key: 'priority', header: 'Öncelik', align: 'center', sortable: true, sortKey: 'priority', cell: (r) => <span className="tabular-nums">{r.priority}</span> },
            { key: 'status', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
          ]}
          emptyForm={emptyPopupForm()}
          toForm={popupToForm}
          getFormErrors={getFormErrors}
          isActive={(r) => r.isActive}
          deleteConfirm={{ title: 'Popup\'ı Sil', description: 'Bu popup ve gösterim geçmişi silinecek. Bu işlem geri alınamaz. Devam edilsin mi?' }}
          toggleConfirm={(row, willActivate) => willActivate
            ? { title: 'Popup\'ı Aktif Et', description: `"${row.title}" aktif edilecek ve vatandaşlara gösterilmeye başlanacak.` }
            : { title: 'Popup\'ı Pasife Al', description: `"${row.title}" pasife alınacak; vatandaşlara gösterilmeyecek.` }}
          creatable={can('popups.create')}
          canEdit={() => can('popups.edit')}
          canDelete={() => can('popups.delete')}
          onCreate={can('popups.create') ? (f) => popupService.create(f).then(() => fetchSummary()) : undefined}
          onUpdate={can('popups.edit') ? (id, f) => popupService.update(id, f).then(() => fetchSummary()) : undefined}
          renderForm={({ form, setForm }) => <PopupFormSections form={form} setForm={setForm} />}
          emptyTitle="Henüz popup yok"
          emptyDescription="İlk popup'ınızı oluşturmak için 'Popup Ekle' düğmesine basın."
        />
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
