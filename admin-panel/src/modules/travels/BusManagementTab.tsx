import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BusIcon, ArmchairIcon, Users2Icon, RouteIcon, XIcon, LayoutGridIcon, InfoIcon, ShipIcon, CopyIcon, HistoryIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Combobox, Input, Button, IconButton, Modal, FilterField, Field, ConfirmModal, Banner, FormSection, SegmentedControl, NumberInput } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import {
  BusSeatPlanner, getBusTemplate, getBusTemplateOrNull, generateBusSeatPositions, createInitialBusSeatStates,
  type BusSeatState,
} from '@/components/specialized/seating'
import travelBusService from '@/services/travelBus.service'
import travelService from '@/services/travel.service'
import { TravelBusUsageHistoryModal } from './TravelBusUsageHistoryModal'
import type { TravelBus, TravelBusFormData, TravelBusSummary, TravelVehicleType } from '@/types/travel.types'

const emptyBusForm = (): TravelBusFormData => {
  const tmpl = getBusTemplate()
  return {
    name: '', plateNumber: '', templateId: tmpl.id,
    seatStates: createInitialBusSeatStates(generateBusSeatPositions(tmpl)),
    vehicleType: 'bus', capacity: 0,
  }
}

const busToForm = (b: TravelBus): TravelBusFormData => {
  const tmpl = getBusTemplateOrNull(b.templateId) ?? getBusTemplate()
  return {
    name: b.name, plateNumber: b.plateNumber, templateId: tmpl.id,
    seatStates: b.seatStates ?? createInitialBusSeatStates(generateBusSeatPositions(tmpl)),
    vehicleType: b.vehicleType, capacity: b.capacity,
  }
}

const BusFields = ({
  form, setForm, readOnly,
}: {
  form: TravelBusFormData
  setForm: Dispatch<SetStateAction<TravelBusFormData>>
  readOnly?: boolean
}) => {
  const patch = (p: Partial<TravelBusFormData>) => setForm((f) => ({ ...f, ...p }))

  const changeTemplate = (id: string) => {
    const positions = generateBusSeatPositions(getBusTemplate(id))
    patch({ templateId: id, seatStates: createInitialBusSeatStates(positions) })
  }

  return (
    <div className="p-5 space-y-5">
      <FormSection icon={BusIcon} title="Araç Bilgileri" variant="card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Araç Adı" required>
            <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Örn: 1 Numaralı Otobüs / Vapur Seferi" disabled={readOnly} />
          </Field>
          <Field label="Plaka / Sefer No" required={form.vehicleType === 'bus'}>
            <Input value={form.plateNumber} onChange={(e) => patch({ plateNumber: e.target.value.toUpperCase() })} placeholder={form.vehicleType === 'bus' ? '34 ABC 123' : 'Opsiyonel'} disabled={readOnly} />
          </Field>
        </div>

        <Field label="Araç Tipi" hint={form.vehicleType === 'capacity'
          ? 'Vapur, tekne gibi koltuk numarası olmayan araçlar için. Başvurular koltuk seçmeden, yalnızca toplam kontenjana göre kabul edilir.'
          : 'Koltuk numaralı klasik otobüs/minibüs. Başvuru sırasında koltuk seçilir.'}>
          <SegmentedControl
            value={form.vehicleType}
            onChange={(v) => patch({ vehicleType: v as TravelVehicleType })}
            columns={2}
            disabled={readOnly}
            options={[
              { value: 'bus', label: 'Otobüs (Koltuk Numaralı)', icon: BusIcon, tone: 'blue' },
              { value: 'capacity', label: 'Kontenjanlı (Vapur / Tekne)', icon: ShipIcon, tone: 'violet' },
            ]}
          />
        </Field>

        {form.vehicleType === 'capacity' ? (
          <Field label="Toplam Kontenjan" required hint="Bu araca (ör. vapur seferi) kabul edilecek toplam kişi sayısı — koltuk numarası yok.">
            <NumberInput value={form.capacity} onChange={(n) => patch({ capacity: n })} min={0} placeholder="Örn: 150" disabled={readOnly} />
          </Field>
        ) : (
          <Field label="Koltuk Düzeni" hint="Koltuğa tıklayarak dolu/rezerve/bloke durumunu ayarlayın">
            <BusSeatPlanner
              templateId={form.templateId}
              onTemplateChange={changeTemplate}
              seatStates={form.seatStates}
              onSeatChange={(s) => patch({ seatStates: s })}
              allowTemplateChange={!readOnly}
              readOnly={readOnly}
            />
          </Field>
        )}
      </FormSection>
    </div>
  )
}

export const BusManagementTab = () => {
  const { can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const travelIdFilter = searchParams.get('travelId') ?? ''
  const [travelFilter, setTravelFilter] = useState<{ id: string; label: string }>({ id: '', label: '' })
  const [summary, setSummary] = useState<TravelBusSummary | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [seatBus, setSeatBus] = useState<TravelBus | null>(null)
  const [seatDraft, setSeatDraft] = useState<Record<string, BusSeatState>>({})
  const [savingSeats, setSavingSeats] = useState(false)
  const [confirmSeatSave, setConfirmSeatSave] = useState(false)
  const [historyBus, setHistoryBus] = useState<TravelBus | null>(null)
  const [cloning, setCloning] = useState<string | null>(null)

  const loadSummary = useCallback(() => {
    const p: Record<string, unknown> = {}
    if (travelIdFilter) p.travelId = travelIdFilter
    travelBusService.getSummary(p).then(setSummary).catch(() => setSummary(null))
  }, [travelIdFilter])
  useEffect(() => { loadSummary() }, [loadSummary])

  const clearTravelFilter = () =>
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('travelId'); return n })

  const openSeatPlan = (bus: TravelBus) => {
    const tmpl = getBusTemplateOrNull(bus.templateId) ?? getBusTemplate()
    setSeatBus(bus)
    setSeatDraft(bus.seatStates ?? createInitialBusSeatStates(generateBusSeatPositions(tmpl)))
  }

  const doSaveSeatPlan = async () => {
    if (!seatBus) return
    setSavingSeats(true)
    try {
      await travelBusService.update(seatBus.id, { ...busToForm(seatBus), seatStates: seatDraft })
      toast.success('Koltuk düzeni kaydedildi. İleri tarihli gezilere yansıtıldı.')
      setConfirmSeatSave(false)
      setSeatBus(null)
      setRefreshSignal((s) => s + 1)
      loadSummary()
    } finally {
      setSavingSeats(false)
    }
  }

  const requestSaveSeatPlan = () => {
    if (seatBus?.travelName) setConfirmSeatSave(true)
    else doSaveSeatPlan()
  }

  const cloneBus = async (bus: TravelBus) => {
    setCloning(bus.id)
    try {
      const clone = await travelBusService.clone(bus.id)
      toast.success(`"${clone.name}" oluşturuldu. Bir sefere atayarak bağımsız kullanmaya başlayabilirsiniz.`)
      setRefreshSignal((s) => s + 1)
      loadSummary()
    } finally {
      setCloning(null)
    }
  }

  const hasActiveFilters = !!travelFilter.id
  const extraParams: Record<string, string> = {}
  if (travelIdFilter) extraParams.travelId = travelIdFilter
  else if (travelFilter.id) extraParams.travelId = travelFilter.id

  return (
    <>
      {travelIdFilter && (
        <div className="flex items-center justify-between rounded-card border border-border bg-[hsl(var(--info-soft))] px-3 py-2">
          <span className="type-body-strong text-[hsl(var(--info))]">Belirli bir gezinin araçları gösteriliyor.</span>
          <Button variant="ghost" size="sm" onClick={clearTravelFilter}><XIcon className="h-4 w-4" /> Filtreyi kaldır</Button>
        </div>
      )}

      <CrudListTemplate<TravelBus, TravelBusFormData>
        icon={BusIcon}
        title="Araç Yönetimi"
        subtitle="Gezilere atanan otobüsler, vapur/tekne (kontenjanlı) araçlar ve koltuk düzenleri"
        resourceName="Araç"
        listTitle="Araç Listesi"
        searchPlaceholder="Araç adı, plaka veya şoför ara..."
        service={{
          getList: (p) => travelBusService.getList(p),
          remove: can('travels.delete') ? (id) => travelBusService.delete(id) : undefined,
          toggleStatus: can('travels.edit') ? (id) => travelBusService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        selectable
        isActive={(r) => r.isActive}
        drawerWidth={720}
        refreshSignal={refreshSignal}
        onMutated={loadSummary}
        extraParams={extraParams}
        filterColumns={2}
        hasActiveFilters={hasActiveFilters}
        filterCount={travelFilter.id ? 1 : 0}
        onClearFilters={() => { setTravelFilter({ id: '', label: '' }); if (travelIdFilter) clearTravelFilter() }}
        renderFilters={travelIdFilter ? undefined : () => (
          <FilterField label="Gezi">
            <Combobox
              value={travelFilter.id}
              displayValue={travelFilter.label}
              onChange={(v, opt) => setTravelFilter({ id: v, label: opt?.label ?? '' })}
              onSearch={(q) => travelService.getOptions(q)}
              placeholder="Tüm geziler"
              clearable
            />
          </FilterField>
        )}
        stats={() => [
          { label: 'Toplam Araç', value: summary?.totalBuses ?? 0, icon: BusIcon, accent: 'blue' },
          { label: 'Toplam Kapasite', value: summary?.totalCapacity ?? 0, icon: ArmchairIcon, accent: 'green' },
          { label: 'Dolu Koltuk', value: summary?.totalOccupied ?? 0, icon: Users2Icon, accent: 'violet' },
          { label: 'Aktif Rota', value: summary?.activeTravels ?? 0, icon: RouteIcon, accent: 'orange' },
        ]}
        columns={[
          { key: 'travel', header: 'Gezi', cell: (r) => <span className="type-muted">{r.travelName ?? '—'}</span> },
          { key: 'name', header: 'Araç', sortable: true, sortKey: 'name', cell: (r) => <span className="type-body-strong">{r.name}</span> },
          { key: 'plate', header: 'Plaka', cell: (r) => <span className="tabular-nums type-muted">{r.plateNumber || '—'}</span> },
          { key: 'type', header: 'Tip', cell: (r) => r.vehicleType === 'capacity'
            ? <span className="inline-flex items-center gap-1 type-muted"><ShipIcon className="h-3.5 w-3.5" /> Kontenjanlı</span>
            : <span className="type-muted">{getBusTemplate(r.templateId).name}</span> },
          { key: 'capacity', header: 'Kapasite', align: 'center', cell: (r) => <span className="tabular-nums">{r.capacity}</span> },
          { key: 'occupied', header: 'Dolu', align: 'center', cell: (r) => <span className="tabular-nums text-[hsl(var(--primary))]">{r.occupiedCount}</span> },
        ]}
        emptyForm={emptyBusForm()}
        toForm={busToForm}
        getFormErrors={(f) => [
          !f.name.trim() && 'Araç adı zorunludur.',
          f.vehicleType === 'bus' && !f.plateNumber.trim() && 'Plaka numarası zorunludur.',
          f.vehicleType === 'bus' && !f.templateId && 'Koltuk şablonu seçimi zorunludur.',
          f.vehicleType === 'capacity' && f.capacity <= 0 && 'Toplam kontenjan 0\'dan büyük olmalıdır.',
        ].filter(Boolean) as string[]}
        renderForm={({ form, setForm }) => (
          <BusFields form={form} setForm={setForm} />
        )}
        deleteConfirm={{ title: 'Aracı Sil', description: 'Bu araç silinecek. Koltuk/kontenjan atamaları kaldırılacak.' }}
        creatable={can('travels.create')}
        canEdit={() => can('travels.edit')}
        canDelete={() => can('travels.delete')}
        onCreate={can('travels.create') ? (f) => travelBusService.create(f).then(() => undefined) : undefined}
        onUpdate={can('travels.edit') ? (id, f) => travelBusService.update(id, f).then(() => undefined) : undefined}
        extraRowActions={(row) => (
          <>
            {row.vehicleType !== 'capacity' && (
              <IconButton tone="primary" title="Koltuk planı" onClick={() => openSeatPlan(row)}>
                <LayoutGridIcon className="h-4 w-4" />
              </IconButton>
            )}
            <IconButton tone="default" title="Kullanım geçmişi" onClick={() => setHistoryBus(row)}>
              <HistoryIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Aracı çoğalt (sefere özel bağımsız kopya oluştur)" disabled={cloning === row.id} onClick={() => cloneBus(row)}>
              <CopyIcon className="h-4 w-4" />
            </IconButton>
          </>
        )}
      />

      <Modal
        open={!!seatBus}
        onClose={() => setSeatBus(null)}
        title={seatBus ? `${seatBus.name} — Koltuk Planı` : 'Koltuk Planı'}
        subtitle={seatBus ? `${seatBus.plateNumber} · ${getBusTemplate(seatBus.templateId).name}` : undefined}
        width={720}
        className="max-w-[96vw]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setSeatBus(null)}>İptal</Button>
            <Button variant="primary" isLoading={savingSeats} onClick={requestSaveSeatPlan}>Değişiklikleri Kaydet</Button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          <Banner tone="warning" variant="soft" icon={InfoIcon}>
            Koltuk durumunu değiştirmek, bu otobüsün ileri tarihli ve henüz başlamamış tüm gezilerindeki koltuk düzenini de günceller.
            Kapatılan koltuktaki yolcular uygun boş koltuğa taşınır; yer yoksa görevliye bildirilir. Geçmiş ve devam eden geziler etkilenmez.
          </Banner>
          {seatBus && (
            <BusSeatPlanner
              templateId={seatBus.templateId}
              seatStates={seatDraft}
              onSeatChange={setSeatDraft}
            />
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={confirmSeatSave}
        onClose={() => setConfirmSeatSave(false)}
        onConfirm={doSaveSeatPlan}
        loading={savingSeats}
        tone="primary"
        icon={InfoIcon}
        title="İleri tarihli geziler etkilenecek"
        description={seatBus?.travelName
          ? `Bu otobüs "${seatBus.travelName}" gibi ileri tarihli gezilere atanmış. Koltuk değişikliği bu gezilere yansıyacak ve gerekirse yolcular taşınacak. Devam edilsin mi?`
          : 'Koltuk değişikliği ileri tarihli gezilere yansıyacak. Devam edilsin mi?'}
        confirmLabel="Evet, kaydet"
      />

      <TravelBusUsageHistoryModal bus={historyBus} onClose={() => setHistoryBus(null)} />
    </>
  )
}
