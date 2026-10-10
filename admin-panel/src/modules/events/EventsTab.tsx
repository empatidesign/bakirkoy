import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/framework/auth/AuthContext'
import {
  CalendarIcon, CheckCircle2Icon, PowerOffIcon, Users2Icon, ArmchairIcon,
  LayersIcon, ClipboardListIcon, ActivityIcon, CopyIcon, CopyPlusIcon, HistoryIcon, EyeIcon, MessageSquareIcon, LockIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Button, Select, FilterField, ToggleRow, DatePicker, IconButton, DrilldownCount, Banner } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { BroadcastModal } from '@/components/specialized/BroadcastModal'
import { todayIso } from '@/lib/utils'
import eventService from '@/services/event.service'
import eventCategoryService from '@/services/eventCategory.service'
import { ApplicationsTab } from './ApplicationsTab'
import { EventAuditModal } from './EventAuditModal'
import { EventFormHeader } from './EventFormHeader'
import { EventAccessSetupModal } from './EventAccessSetupModal'
import { EventForm } from './EventForm'
import { EventDetailModal } from './EventDetailModal'
import { EventBulkCopyModal } from './EventBulkCopyModal'
import { SeatPlanModal } from '@/components/specialized/seating'
import hallService from '@/services/hall.service'
import type { Hall } from '@/types/hall.types'
import { emptyEventForm, eventToForm } from './eventFormDefaults'
import eventSettingsService from '@/services/eventSettings.service'
import type { EventSettings } from '@/types/eventSettings.types'
import type { Event, EventFormData, EventSummary } from '@/types/event.types'
import type { FacilityOption } from '@/types/hall.types'
import type { SelectOption } from '@/types/common'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')

// Etkinliğin hem başlangıç hem bitiş tarihi bugünden önce ise (tamamen geçmişte kaldıysa)
// yalnızca süper yönetici düzenleyebilir — bkz. EventService.UpdateAsync EVENT_PAST_SUPERADMIN_ONLY.
const isFullyPastEvent = (r: Pick<Event, 'startDate' | 'endDate'>) => {
  const today = todayIso()
  return r.startDate.slice(0, 10) < today && r.endDate.slice(0, 10) < today
}

export const EventsTab = () => {
  const { can, isSuperAdmin } = useAuth()
  const [, setSearchParams] = useSearchParams()
  const [categories, setCategories] = useState<SelectOption[]>([])
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [hallOptions, setHallOptions] = useState<{ value: string; label: string }[]>([])
  const [categoryFilter, setCategoryFilter] = useState('')
  const [facilityFilter, setFacilityFilter] = useState('')
  const [hallFilter, setHallFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [startFilter, setStartFilter] = useState('')
  const [endFilter, setEndFilter] = useState('')
  // Kullanıcı isteği (2026-08-11): gezi/travels modülündeki "Geçmiş Seferleri Göster"
  // filtresiyle aynı desen — varsayılan olarak bitiş tarihi geçmiş etkinlikler gizlenir.
  const [showPast, setShowPast] = useState(false)
  const [summary, setSummary] = useState<EventSummary | null>(null)
  const [search, setSearch] = useState('')
  const [auditEvent, setAuditEvent] = useState<Event | null>(null)
  const [detailEvent, setDetailEvent] = useState<Event | null>(null)
  const [bulkCopyEvent, setBulkCopyEvent] = useState<Event | null>(null)
  const [copying, setCopying] = useState<string | null>(null)
  const [editRequestId, setEditRequestId] = useState<string | null>(null)
  const [seatPlan, setSeatPlan] = useState<{ hall: Hall; eventId: string } | null>(null)
  const openEventSeatPlan = async (hallId: string, eventId: string) => {
    try { setSeatPlan({ hall: await hallService.getById(hallId), eventId }) } catch { /* hata api.ts interceptor'ından */ }
  }
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [broadcastIds, setBroadcastIds] = useState<string[] | null>(null)
  const [settings, setSettings] = useState<EventSettings | null>(null)

  useEffect(() => {
    eventCategoryService.getOptions().then(setCategories).catch(() => setCategories([]))
    hallService.getFacilityOptions().then(setFacilities).catch(() => setFacilities([]))
    eventSettingsService.get().then(setSettings).catch(() => setSettings(null))
  }, [])

  useEffect(() => {
    hallService.getHallOptions(facilityFilter || undefined)
      .then((hs) => setHallOptions(hs.map((h) => ({ value: h.value, label: h.label }))))
      .catch(() => setHallOptions([]))
  }, [facilityFilter])

  const loadSummary = useCallback(() => {
    const params: Record<string, unknown> = {}
    if (categoryFilter) params.categoryId = categoryFilter
    if (facilityFilter) params.facilityId = facilityFilter
    if (hallFilter) params.hallId = hallFilter
    if (statusFilter) params.isActive = statusFilter
    if (startFilter) params.startDate = startFilter
    if (endFilter) params.endDate = endFilter
    if (!showPast) params.hidePast = 'true'
    if (search) params.search = search
    eventService.getSummary(params).then(setSummary).catch(() => setSummary(null))
  }, [categoryFilter, facilityFilter, hallFilter, statusFilter, startFilter, endFilter, showPast, search])
  useEffect(() => { loadSummary() }, [loadSummary, refreshSignal])

  const navTo = (tab: string, eventId: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', tab)
      n.set('eventId', eventId)
      return n
    })

  const copyEvent = async (id: string) => {
    setCopying(id)
    try {
      const copyResult = await eventService.copy(id)
      toast.success('Etkinlik kopyalandı. Tarihleri güncelleyebilirsiniz.')
      setRefreshSignal((s) => s + 1)
      loadSummary()
      // Liste yeniden yüklenip yeni kopya satırı göründüğünde düzenleme formunu otomatik aç,
      // böylece admin geçmiş tarihli kaynaktan miras kalan başlangıç/bitiş tarihlerini hemen
      // güncelleyip yeni (bağımsız) etkinliği aktive edebilsin.
      setEditRequestId(copyResult.id)
    } finally {
      setCopying(null)
    }
  }

  const hasActiveFilters = !!categoryFilter || !!facilityFilter || !!hallFilter || !!statusFilter || !!startFilter || !!endFilter || showPast
  const extraParams: Record<string, string> = {}
  if (categoryFilter) extraParams.categoryId = categoryFilter
  if (facilityFilter) extraParams.facilityId = facilityFilter
  if (hallFilter) extraParams.hallId = hallFilter
  if (statusFilter) extraParams.isActive = statusFilter
  if (startFilter) extraParams.startDate = startFilter
  if (endFilter) extraParams.endDate = endFilter
  if (!showPast) extraParams.hidePast = 'true'

  return (
    <>
      <CrudListTemplate<Event, EventFormData>
        icon={CalendarIcon}
        title="Etkinlikler"
        subtitle="Etkinlik takvimi kayıtları"
        resourceName="Etkinlik"
        listTitle="Etkinlik Listesi"
        searchPlaceholder="Etkinlik adı, kod, tesis, salon veya başvuran adı/TC ara..."
        service={{
          getList: (p) => eventService.getList(p),
          remove: can('events.delete') ? (id) => eventService.delete(id) : undefined,
          toggleStatus: can('events.edit') ? (id) => eventService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        selectable
        bulkActions={(rows) => (
          <Button variant="outline" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setBroadcastIds(rows.map((r) => r.id))}>
            SMS / Bildirim Gönder
          </Button>
        )}
        isActive={(r) => r.isActive}
        drawerWidth={780}
        defaultSort={{ key: 'startDate', dir: 'asc' }}
        refreshSignal={refreshSignal}
        onMutated={loadSummary}
        onSearchChange={setSearch}
        editRequestId={editRequestId}
        onEditRequestHandled={() => setEditRequestId(null)}
        extraParams={extraParams}
        filterColumns={3}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => { setCategoryFilter(''); setFacilityFilter(''); setHallFilter(''); setStatusFilter(''); setStartFilter(''); setEndFilter(''); setShowPast(false) }}
        renderFilters={() => (
          <>
            <FilterField label="Geçmiş Etkinlikler">
              <ToggleRow
                label="Geçmiş Etkinlikleri Göster"
                description="Açıksa, bitiş tarihi geçmişte kalan etkinlikler de listede görünür."
                checked={showPast}
                onChange={setShowPast}
              />
            </FilterField>
            <FilterField label="Hizmet Tesisi">
              <Select value={facilityFilter} onChange={(e) => { setFacilityFilter(e.target.value); setHallFilter('') }}>
                <option value="">Tüm Tesisler</option>
                {facilities.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Salon">
              <Select value={hallFilter} onChange={(e) => setHallFilter(e.target.value)}>
                <option value="">Tüm Salonlar</option>
                {hallOptions.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Kategori">
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} placeholder="Tüm kategoriler">
                <option value="">Tüm kategoriler</option>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Durum">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </Select>
            </FilterField>
            <FilterField label="Başlangıç (en erken)">
              <DatePicker value={startFilter} onChange={setStartFilter} clearable />
            </FilterField>
            <FilterField label="Bitiş (en geç)">
              <DatePicker value={endFilter} onChange={setEndFilter} clearable />
            </FilterField>
          </>
        )}
        columns={[
          { key: 'code', header: 'Kod', sortable: true, sortKey: 'code', defaultHidden: true, cell: (r) => <span className="tabular-nums type-muted">#{r.code}</span> },
          {
            key: 'name', header: 'Etkinlik', sortable: true, sortKey: 'name',
            cell: (r) => (
              <button
                type="button"
                onClick={() => setDetailEvent(r)}
                className="text-left type-body-strong text-[hsl(var(--primary))] transition-colors hover:underline"
              >
                {r.name}
              </button>
            ),
          },
          { key: 'category', header: 'Kategori', cell: (r) => <Badge color={r.categoryColor}>{r.categoryName}</Badge> },
          { key: 'facility', header: 'Hizmet Tesisi', hideable: true, cell: (r) => <span className="type-muted">{r.facilityName ?? '—'}</span> },
          { key: 'hall', header: 'Salon', cell: (r) => <span className="type-muted">{r.hallName ?? '—'}</span> },
          { key: 'date', header: 'Tarih', sortable: true, sortKey: 'startDate', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDate(r.startDate)} – {fmtDate(r.endDate)}</span> },
          { key: 'capacity', header: 'Kontenjan', align: 'center', sortable: true, sortKey: 'capacity', cell: (r) => <span className="tabular-nums font-bold text-[hsl(var(--primary))]">{r.capacity.toLocaleString('tr-TR')}</span> },
          {
            key: 'registered', header: 'Kayıtlı', align: 'center',
            cell: (r) => (
              <DrilldownCount count={r.registeredCount} title={`${r.name} — Kayıtlı Katılımcılar`} subtitle="Onaylı (asil) kayıtlar" icon={Users2Icon} triggerClassName="tabular-nums font-bold text-[hsl(var(--success))]">
                <ApplicationsTab embedded scope={{ eventId: r.id, status: 'approved' }} onMutated={() => setRefreshSignal((s) => s + 1)} />
              </DrilldownCount>
            ),
          },
          {
            key: 'reserve', header: 'Yedek', align: 'center',
            cell: (r) => (
              <DrilldownCount count={r.reserveCount} title={`${r.name} — Yedek Liste`} subtitle="Yedek listesindeki başvurular" icon={Users2Icon} triggerClassName="tabular-nums font-bold text-[hsl(var(--warning))]">
                <ApplicationsTab embedded scope={{ eventId: r.id, status: 'waitlist' }} onMutated={() => setRefreshSignal((s) => s + 1)} />
              </DrilldownCount>
            ),
          },
          { key: 'sessions', header: 'Seans', align: 'center', cell: (r) => <span className="tabular-nums font-bold text-[hsl(var(--accent-violet))]">{r.sessionCount}</span> },
          {
            key: 'rowReservation', header: 'Sıra', align: 'center',
            cell: (r) => (r.access.reservationType === 'row' || r.access.reservationType === 'seat')
              ? <Badge tone="info">Sıra</Badge>
              : <span className="type-muted">—</span>,
          },
          {
            key: 'seatReservation', header: 'Koltuk', align: 'center',
            cell: (r) => r.access.reservationType === 'seat'
              ? <Badge tone="primary">Koltuk</Badge>
              : <span className="type-muted">—</span>,
          },
          { key: 'age', header: 'Yaş', align: 'center', cell: (r) => <span className="whitespace-nowrap type-muted">{r.minAge}–{r.maxAge}</span> },
          { key: 'isActive', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
        ]}
        stats={({ total }) => [
          { label: 'Toplam Etkinlik', value: summary?.total ?? total, icon: CalendarIcon, accent: 'blue' },
          { label: 'Aktif Etkinlik', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif Etkinlik', value: summary?.passive ?? 0, icon: PowerOffIcon, accent: 'orange' },
          { label: 'Toplam Kayıt', value: summary?.totalRegistered ?? 0, icon: Users2Icon, accent: 'violet' },
          { label: 'Toplam Kontenjan', value: summary?.totalCapacity ?? 0, icon: ArmchairIcon, accent: 'primary' },
        ]}
        emptyForm={emptyEventForm(settings ?? undefined)}
        toForm={eventToForm}
        getFormErrors={(f) => [
          !f.name.trim() && 'Etkinlik adı zorunludur.',
          !f.categoryId && 'Kategori seçimi zorunludur.',
          !f.startDate && 'Başlangıç tarihi zorunludur.',
          (!!f.endDate && f.endDate.slice(0, 10) < f.startDate.slice(0, 10)) && 'Bitiş tarihi, başlangıç tarihinden önce olamaz.',
          (f.isSingleDay && f.startTime && f.endTime && f.endTime <= f.startTime) && 'Bitiş saati başlangıç saatinden sonra olmalıdır.',
          (f.participationPeriod !== 'none' && f.participationLimit < 1) && 'Katılım limiti en az 1 olmalıdır.',
          (f.minAge > f.maxAge) && 'En küçük yaş, en büyük yaştan büyük olamaz.',
          (f.access.registrationMode === 'required' && !f.applicationStartDate) && 'Kayıt zorunlu etkinlikte başvuru başlangıç tarihi zorunludur.',
          (f.access.registrationMode === 'required' && !f.applicationEndDate) && 'Kayıt zorunlu etkinlikte başvuru bitiş tarihi zorunludur.',
          (!!f.applicationStartDate && !!f.applicationEndDate && f.applicationEndDate < f.applicationStartDate) && 'Başvuru bitiş tarihi, başvuru başlangıç tarihinden önce olamaz.',
          (!!f.applicationEndDate && !!f.startDate && f.applicationEndDate.slice(0, 10) > f.startDate.slice(0, 10)) && 'Başvuru bitişi, etkinlik başlangıcından sonra olamaz.',
        ].filter(Boolean) as string[]}
        formShell
        renderForm={({ form, setForm, mode, editingRow }) => {
          const pastLocked = mode === 'edit' && !!editingRow && !isSuperAdmin && isFullyPastEvent(editingRow)
          return (
            <EventFormHeader
              icon={CalendarIcon}
              title={mode === 'edit' ? 'Etkinlik Bilgilerini Düzenle' : 'Yeni Etkinlik Ekle'}
              subtitle="Mekan, tarih, kontenjan, görsel ve erişim ayarları"
            >
              {pastLocked && (
                <Banner tone="danger" variant="soft" icon={LockIcon}>
                  Bu etkinliğin başlangıç ve bitiş tarihi geçmişte kaldığı için yalnızca süper yönetici düzenleyebilir.
                </Banner>
              )}
              <EventForm
                form={form}
                setForm={setForm}
                readOnly={pastLocked}
                eventId={editingRow?.id}
                eventName={editingRow?.name}
                eventStarted={
                  !!editingRow
                  && editingRow.startDate.slice(0, 10) <= todayIso()
                  // Henüz hiçbir gerçek katılımcı/seans verisi yoksa (ör. Kopyala ile yeni
                  // oluşturulmuş bir taslak), tarih kilidi backend'de de uygulanmıyor —
                  // formda da kilitlemeyelim ki admin tarihleri hemen güncelleyebilsin.
                  && (editingRow.registeredCount > 0 || editingRow.reserveCount > 0 || editingRow.sessionCount > 0)
                }
              />
            </EventFormHeader>
          )
        }}
        createGate={({ open, onContinue, onCancel }) => (
          <EventAccessSetupModal open={open} onContinue={onContinue} onCancel={onCancel} settings={settings ?? undefined} />
        )}
        deleteConfirm={{
          title: 'Etkinliği Çöp Kutusuna Taşı',
          description: 'Etkinlik ve seansları arşive taşınacak. Başvuran / koltuk ayırmış kişilere iptal bildirimi gönderilecektir. Arşiv sekmesinden geri yükleyebilir veya kalıcı silebilirsiniz.',
        }}
        creatable={can('events.create')}
        // Kullanıcı isteği (2026-10-04): "mavi butonu tabloda sütunların sağına ekle" —
        // "Yeni Etkinlik" butonu üst başlık yerine tablonun kendi araç çubuğuna (Sütunlar
        // butonunun soluna) taşındı.
        createButtonPlacement="table"
        canEdit={(row) => can('events.edit') && (isSuperAdmin || !isFullyPastEvent(row))}
        canDelete={() => can('events.delete')}
        collapseRowActions
        onCreate={can('events.create') ? (f) => eventService.create(f).then(() => undefined) : undefined}
        onUpdate={can('events.edit') ? (id, f) => eventService.update(id, f).then(() => undefined) : undefined}
        extraRowActions={(row) => (
          <>
            <IconButton tone="default" title="Etkinlik detayları" onClick={() => setDetailEvent(row)}>
              <EyeIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title={row.access.hasSessions ? 'Seanslar' : 'Bu etkinlik seanssız — seans eklenemez'} disabled={!row.access.hasSessions} onClick={() => navTo('sessions', row.id)}>
              <LayersIcon className="h-4 w-4" />
            </IconButton>
            <IconButton
              tone="default"
              title={
                !row.hallId
                  ? 'Bu etkinliğe salon atanmamış'
                  : !row.access.hasSeating
                    ? 'Bu etkinlikte koltuk düzeni yok'
                    : row.access.hasSessions
                      ? 'Seanslı etkinlik — koltuk düzeni Seanslar sekmesinde seans bazında düzenlenir'
                      : 'Etkinlik oturma düzeni (yalnız bu etkinliğe ait)'
              }
              disabled={!row.hallId || !row.access.hasSeating || row.access.hasSessions}
              onClick={() => row.hallId && openEventSeatPlan(row.hallId, row.id)}
            >
              <ArmchairIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Başvurular" onClick={() => navTo('applications', row.id)}>
              <ClipboardListIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Yoklama / Kontrol" onClick={() => navTo('control', row.id)}>
              <ActivityIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Etkinliği kopyala" disabled={copying === row.id} onClick={() => copyEvent(row.id)}>
              <CopyIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Çoklu etkinlik ekle — birden fazla tarihe aynı anda kopyala" onClick={() => setBulkCopyEvent(row)}>
              <CopyPlusIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="İşlem geçmişi" onClick={() => setAuditEvent(row)}>
              <HistoryIcon className="h-4 w-4" />
            </IconButton>
          </>
        )}
      />

      <EventAuditModal event={auditEvent} onClose={() => setAuditEvent(null)} />
      <EventDetailModal event={detailEvent} onClose={() => setDetailEvent(null)} />
      <EventBulkCopyModal event={bulkCopyEvent} onClose={() => setBulkCopyEvent(null)} onCopied={() => setRefreshSignal((s) => s + 1)} />
      <SeatPlanModal open={!!seatPlan} onClose={() => setSeatPlan(null)} onSaved={() => setRefreshSignal((s) => s + 1)} hall={seatPlan?.hall ?? null} eventId={seatPlan?.eventId} />
      <BroadcastModal open={!!broadcastIds} target="event" ids={broadcastIds ?? []} count={broadcastIds?.length ?? 0} onClose={() => setBroadcastIds(null)} />
    </>
  )
}
