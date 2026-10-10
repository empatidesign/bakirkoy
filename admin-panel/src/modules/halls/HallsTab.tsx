import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2Icon, ArmchairIcon, CheckCircle2Icon, PowerOffIcon, PowerIcon,
  XIcon, SlidersHorizontalIcon, EyeIcon, AlertTriangleIcon, InfoIcon, LayersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import {
  Button, Input, Textarea, Label, Select, Badge, ToggleChip, IconButton, FilterField, Banner, Field, FormSection, AdminFormShell,
} from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import hallService from '@/services/hall.service'
import type { Hall, HallForm, HallSummary, HallFeatureCatalog, FacilityOption, CreateHallRequest } from '@/types/hall.types'
import { HALL_TYPE_OPTIONS, DEFAULT_HALL_FEATURE_CATALOG } from '@/types/hall.types'
import {
  SeatingLayoutBuilder, SeatPlanModal, calculateTotalSeats, createDefaultLayout,
} from '@/components/specialized/seating'
import { HallFeaturesPanel } from '@/components/specialized/HallFeaturesPanel'
import { ServiceFacilitySelect } from '@/components/specialized/ServiceFacilitySelect'
import { HallDetailModal } from './HallDetailModal'
import { HallDevicesSection } from './HallDevicesSection'
import { makeHallColumns } from './hallColumns'

const emptyForm: HallForm = {
  facilityId: '', name: '', type: 'conference', buildingFloor: '',
  seatingMode: 'seated', capacity: '', description: '', about: '',
  featureIds: [], layout: createDefaultLayout(),
}

const getHallFormErrors = (f: HallForm): string[] => [
  !f.facilityId && 'Tesis seçimi zorunludur.',
  !f.name.trim() && 'Salon adı zorunludur.',
  !f.type && 'Salon türü seçimi zorunludur.',
  f.seatingMode === 'seated' && calculateTotalSeats(f.layout) <= 0 && 'En az bir koltuk eklenmelidir.',
  f.seatingMode !== 'seated' && (parseInt(f.capacity, 10) || 0) <= 0 && 'Kapasite en az 1 olmalıdır.',
].filter(Boolean) as string[]

const buildReq = (f: HallForm): CreateHallRequest => {
  const seated = f.seatingMode === 'seated'
  return {
    facilityId: f.facilityId,
    name: f.name.trim(),
    type: f.type,
    buildingFloor: f.buildingFloor.trim() === '' ? undefined : parseInt(f.buildingFloor, 10),
    seatingMode: f.seatingMode,
    capacity: seated ? calculateTotalSeats(f.layout) : Math.max(0, parseInt(f.capacity, 10) || 0),
    layout: seated ? f.layout : undefined,
    featureIds: f.featureIds,
    description: f.description.trim() || undefined,
    about: f.about.trim() || undefined,
  }
}

export const HallsTab = () => {
  const { can } = useAuth()
  const navigate = useNavigate()
  const [facilityOptions, setFacilityOptions] = useState<FacilityOption[]>([])
  const [catalog, setCatalog] = useState<HallFeatureCatalog>(DEFAULT_HALL_FEATURE_CATALOG)
  const [summary, setSummary] = useState<HallSummary | null>(null)
  const [facilityFilter, setFacilityFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [seatPlanHall, setSeatPlanHall] = useState<Hall | null>(null)
  const [detailHall, setDetailHall] = useState<Hall | null>(null)
  const [featuresPanelOpen, setFeaturesPanelOpen] = useState(false)

  const loadCatalog = useCallback(async () => {
    try { const c = await hallService.getFeatureCatalog(); if (c?.features?.length) setCatalog(c) } catch {  }
  }, [])

  useEffect(() => {
    void (async () => {
      try { setFacilityOptions(await hallService.getFacilityOptions()) } catch { setFacilityOptions([]) }
    })()
    void loadCatalog()
  }, [loadCatalog])

  const fetchSummary = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {}
      if (facilityFilter) params.facilityId = facilityFilter
      if (typeFilter) params.type = typeFilter
      setSummary(await hallService.getSummary(params))
    } catch { setSummary(null) }
  }, [facilityFilter, typeFilter])
  useEffect(() => { void fetchSummary() }, [fetchSummary])

  const featureNameOf = useCallback(
    (id: string) => catalog.features.find((f) => f.id === id)?.name ?? id,
    [catalog],
  )
  const columns = useMemo(() => makeHallColumns(featureNameOf), [featureNameOf])

  return (
    <>
      <CrudListTemplate<Hall, HallForm>
        icon={Building2Icon}
        title="Salonlar"
        subtitle="Etkinlik ve programların yapıldığı salonları yönetin"
        resourceName="Salon"
        service={{
          getList: (p) => hallService.getList(p),
          remove: can('halls.delete') ? (id) => hallService.delete(id) : undefined,
          toggleStatus: can('halls.edit') ? (id) => hallService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        columns={columns}
        defaultSort={{ key: 'name', dir: 'asc' }}
        searchPlaceholder="Salon adı, tür veya tesis ara..."
        selectable
        drawerWidth={760}
        extraParams={{
          facilityId: facilityFilter,
          type: typeFilter,
          isActive: statusFilter,
        }}
        hasActiveFilters={!!facilityFilter || !!typeFilter || !!statusFilter}
        onClearFilters={() => { setFacilityFilter(''); setTypeFilter(''); setStatusFilter('') }}
        renderFilters={() => (
          <>
            <FilterField label="Tesis">
              <Select value={facilityFilter} onChange={(e) => setFacilityFilter(e.target.value)}>
                <option value="">Tüm Tesisler</option>
                {facilityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Tür">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option value="">Tüm Türler</option>
                {HALL_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Durum">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </Select>
            </FilterField>
          </>
        )}
        filterColumns={4}
        stats={({ rows, total }) => [
          { label: 'Toplam Salon', value: summary?.total ?? total, icon: Building2Icon, accent: 'blue' },
          { label: 'Aktif', value: summary?.active ?? rows.filter((r) => r.isActive).length, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif', value: summary?.passive ?? rows.filter((r) => !r.isActive).length, icon: PowerOffIcon, accent: 'orange' },
          { label: 'Toplam Kapasite', value: summary?.totalCapacity ?? rows.reduce((s, r) => s + r.capacity, 0), icon: ArmchairIcon, accent: 'violet' },
        ]}
        onMutated={fetchSummary}
        emptyForm={emptyForm}
        toForm={(r) => ({
          facilityId: r.facilityId,
          name: r.name,
          type: r.type,
          buildingFloor: r.buildingFloor != null ? String(r.buildingFloor) : '',
          seatingMode: r.seatingMode,
          capacity: String(r.capacity),
          description: r.description ?? '',
          about: r.about ?? '',
          featureIds: r.featureIds ?? [],
          layout: r.layout ?? createDefaultLayout(),
        })}
        getFormErrors={getHallFormErrors}
        creatable={can('halls.create')}
        canEdit={() => can('halls.edit')}
        canDelete={() => can('halls.delete')}
        onCreate={can('halls.create') ? async (f) => { await hallService.create(buildReq(f)); toast.success('Salon oluşturuldu.') } : undefined}
        onUpdate={can('halls.edit') ? async (id, f) => { await hallService.update(id, buildReq(f)); toast.success('Salon güncellendi.') } : undefined}
        isActive={(r) => r.isActive}
        deleteConfirm={{ title: 'Salonu Sil', description: 'Bu salonu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.' }}
        toggleConfirm={(row, willActivate) => willActivate
          ? { title: 'Salonu Aktif Et', description: `"${row.name}" yeniden aktif edilecek.` }
          : { title: 'Salonu Pasife Al', description: `"${row.name}" pasife alınacak; yeni etkinliklerde seçilemez.` }}
        extraRowActions={(row) => {
          const seated = row.seatingMode === 'seated'
          return (
            <>
              <IconButton title="Görüntüle" onClick={() => setDetailHall(row)}>
                <EyeIcon className="h-4 w-4" />
              </IconButton>
              <IconButton
                title="Bağlı Seanslar"
                onClick={() => navigate(`/events?tab=sessions&hallId=${row.id}`)}
              >
                <LayersIcon className="h-4 w-4" />
              </IconButton>
              <IconButton
                tone="primary"
                title={seated ? 'Oturma Planı' : 'Ayakta düzende oturma planı yoktur'}
                disabled={!seated}
                onClick={() => setSeatPlanHall(row)}
              >
                <ArmchairIcon className="h-4 w-4" />
              </IconButton>
            </>
          )
        }}
        renderFormFooter={({ form, mode, saving, submit, close }) => {
          const seated = form.seatingMode === 'seated'
          const cap = seated ? calculateTotalSeats(form.layout) : (parseInt(form.capacity, 10) || 0)
          return (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between type-caption text-foreground-muted">
                <span className="inline-flex items-center gap-1">
                  <ArmchairIcon className="h-3.5 w-3.5" /> Kapasite: <strong className="text-foreground-strong">{cap}</strong>
                </span>
                <span>{form.featureIds.length} özellik seçili</span>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={close}>İptal</Button>
                <Button variant="primary" className="flex-1" isLoading={saving} disabled={saving} onClick={submit}>
                  {mode === 'edit' ? 'Güncelle' : 'Kaydet'}
                </Button>
              </div>
            </div>
          )
        }}
        formShell
        renderForm={({ form, setForm, mode, editingRow, requestToggleStatus }) => {
          const seated = form.seatingMode === 'seated'
          const computed = calculateTotalSeats(form.layout)
          const outdoorFacility = facilityOptions.find((o) => o.value === form.facilityId)?.locationType === 'Outdoor'
          const typeOptions = HALL_TYPE_OPTIONS.filter((o) => o.value !== 'outdoor' || outdoorFacility)
          const hasHolds = mode === 'edit' && !!editingRow && editingRow.availableCapacity < editingRow.capacity
          const layoutChanged = mode === 'edit' && !!editingRow && JSON.stringify(form.layout) !== JSON.stringify(editingRow.layout)
          return (
            <AdminFormShell
              icon={Building2Icon}
              title={mode === 'edit' ? 'Salon Bilgilerini Düzenle' : 'Yeni Salon Ekle'}
              subtitle="Salon bilgileri, kapasite, özellikler ve oturma düzeni"
              badge="Salon Yönetimi"
              tone="violet"
            >
              <FormSection icon={Building2Icon} title="Temel Bilgiler" variant="card">
                <Field label="Hizmet Tesisi" required hint={facilityOptions.length === 0 ? 'Tesis listesi Hizmet Tesisleri modülünden gelir.' : undefined}>
                  <ServiceFacilitySelect value={form.facilityId} placeholder="Tesis seçiniz..." onChange={(v, fac) => {
                    const outdoor = fac?.locationType === 'Outdoor'
                    setForm((p) => ({ ...p, facilityId: v, type: !outdoor && p.type === 'outdoor' ? 'conference' : p.type }))
                  }} />
                </Field>

                <div className="grid grid-cols-2 gap-[15px]">
                  <Field label="Salon Adı" required>
                    <Input placeholder="Salon adını giriniz..." value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
                  </Field>
                  <Field label="Tür" required hint={form.facilityId && !outdoorFacility ? 'Açık hava salonu yalnız açık hava tesisinde seçilebilir.' : undefined}>
                    <Select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
                      {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-[15px]">
                  <Field label="Bina Katı">
                    <Input sanitize="digits" placeholder="Örn. 0 (zemin)" value={form.buildingFloor} onChange={(e) => setForm((p) => ({ ...p, buildingFloor: e.target.value }))} />
                  </Field>
                  <Field label="Oturma Modu">
                    <div className="flex gap-1.5">
                      <ToggleChip active={seated} onClick={() => setForm((p) => ({ ...p, seatingMode: 'seated' }))}>Koltuklu</ToggleChip>
                      <ToggleChip active={!seated} onClick={() => setForm((p) => ({ ...p, seatingMode: 'standing' }))}>Ayakta</ToggleChip>
                    </div>
                  </Field>
                </div>

                {seated ? (
                  <Field label="Kapasite">
                    <div className="flex h-10 items-center gap-2 rounded-field border border-border bg-surface-1/60 px-3">
                      <ArmchairIcon className="h-4 w-4 text-primary" />
                      <span className="type-body-strong text-foreground-strong tabular-nums">{computed}</span>
                      <span className="type-caption text-foreground-muted">koltuk düzeninden otomatik hesaplanır</span>
                    </div>
                  </Field>
                ) : (
                  <Field label="Kapasite" required>
                    <Input sanitize="digits" placeholder="Kişi kapasitesi" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} />
                  </Field>
                )}

                <Banner tone="info" variant="soft" icon={InfoIcon}>
                  Etkinlik kontenjanları bu salonun kapasitesini aşamaz. Kapasiteyi (veya koltuk düzenini) değiştirdiğinizde, bu salonu kullanan ileri tarihli ve henüz başlamamış seansların kontenjanları otomatik güncellenir. Dolu bir koltuğu kapatırsanız oradaki katılımcı uygun boş bir koltuğa taşınır; uygun yer yoksa görevli personele bildirilir. Geçmiş ve devam eden seanslar etkilenmez.
                </Banner>
              </FormSection>

              <FormSection icon={InfoIcon} title="Açıklama ve Özellikler" variant="card">
                <Field label="Kısa Açıklama">
                  <Input placeholder="Tek satır açıklama (opsiyonel)..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                </Field>

                <Field label="Salon Hakkında">
                  <Textarea rows={3} placeholder="Salon hakkında detaylı bilgi (opsiyonel)..." value={form.about} onChange={(e) => setForm((p) => ({ ...p, about: e.target.value }))} />
                </Field>

                <Field label="Özellikler">
                  <div className="rounded-card border border-border bg-surface-1/60 p-3">
                    {form.featureIds.length === 0 ? (
                      <p className="type-caption text-foreground-muted">Henüz özellik seçilmedi.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {form.featureIds.map((id) => (
                          <span key={id} className="inline-flex items-center gap-1 rounded-field bg-surface-2 px-2 py-0.5 type-caption text-foreground-default">
                            {featureNameOf(id)}
                            <IconButton tone="danger" title="Kaldır" className="h-5 w-5" onClick={() => setForm((p) => ({ ...p, featureIds: p.featureIds.filter((x) => x !== id) }))}>
                              <XIcon className="h-3 w-3" />
                            </IconButton>
                          </span>
                        ))}
                      </div>
                    )}
                    <Button variant="outline" size="sm" className="mt-2.5" onClick={() => setFeaturesPanelOpen(true)}>
                      <SlidersHorizontalIcon className="h-3.5 w-3.5" /> {form.featureIds.length ? 'Özellikleri Düzenle' : 'Özellik Seç'}
                    </Button>
                  </div>
                  <HallFeaturesPanel
                    open={featuresPanelOpen}
                    onClose={() => { setFeaturesPanelOpen(false); void loadCatalog() }}
                    value={form.featureIds}
                    onChange={(ids) => setForm((p) => ({ ...p, featureIds: ids }))}
                  />
                </Field>
              </FormSection>

              {seated && (
                <FormSection icon={ArmchairIcon} title="Oturma Düzeni" variant="card">
                  {hasHolds && layoutChanged && (
                    <div className="flex items-start gap-2 rounded-card border border-warning/40 bg-warning-soft px-3 py-2">
                      <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
                      <p className="type-caption text-foreground-default">Oturma düzeni değişti. Kaydedince mevcut <strong>protokol / kapalı</strong> koltuk durumları <strong>sıfırlanacak</strong>.</p>
                    </div>
                  )}
                  <SeatingLayoutBuilder value={form.layout} onChange={(l) => setForm((p) => ({ ...p, layout: l }))} />
                </FormSection>
              )}

              {mode === 'edit' && editingRow && (
                <FormSection icon={PowerIcon} title="Durum" variant="card">
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

              {mode === 'edit' && editingRow && (
                <HallDevicesSection hallId={editingRow.id} />
              )}
            </AdminFormShell>
          )
        }}
      />

      <SeatPlanModal open={!!seatPlanHall} onClose={() => setSeatPlanHall(null)} hall={seatPlanHall} />
      <HallDetailModal open={!!detailHall} onClose={() => setDetailHall(null)} hall={detailHall} featureName={featureNameOf} />
    </>
  )
}
