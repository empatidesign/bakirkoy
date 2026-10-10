import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '@/framework/auth/AuthContext'
import {
  LayersIcon, CheckCircle2Icon, PowerOffIcon, Users2Icon, ArmchairIcon, ClipboardListIcon, XIcon, AlertTriangleIcon, MessageSquareIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Select, FilterField, DatePicker, IconButton, Button, Modal, DrilldownCount } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { ApplicationsTab } from './ApplicationsTab'
import { BroadcastModal } from '@/components/specialized/BroadcastModal'
import { SeatPlanModal } from '@/components/specialized/seating'
import { isResponsiblePersonValid } from '@/components/specialized/ResponsiblePersonField'
import sessionService from '@/services/session.service'
import hallService from '@/services/hall.service'
import eventCategoryService from '@/services/eventCategory.service'
import applicationsService from '@/services/applications.service'
import excelIcon from '@/assets/icons/excel.png'
import { downloadBlob } from '@/lib/utils'
import { SessionForm } from './SessionForm'
import { emptySessionForm } from '@/types/session.types'
import type { Session, SessionForm as SessionFormData, SessionSummary, SessionConflict } from '@/types/session.types'
import type { Hall, FacilityOption } from '@/types/hall.types'
import type { SelectOption } from '@/types/common'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')

const toForm = (r: Session): SessionFormData => ({
  ...emptySessionForm(),
  eventId: r.eventId,
  hallId: r.hallId ?? '',
  mode: 'single',
  date: r.date,
  startTime: r.startTime,
  endTime: r.endTime,
  capacity: r.capacity,
  reserveCapacity: r.reserveCapacity,
  instructor: r.instructor ?? '',
  instructorId: r.instructorId ?? '',
  instructorPhone: r.instructorPhone ?? '',
  instructorEmail: r.instructorEmail ?? '',
  emergencyPhone: r.emergencyPhone ?? '',
  isActive: r.isActive,
})

export const SessionsTab = () => {
  const { can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const eventIdFilter = searchParams.get('eventId') ?? ''
  // Kullanıcı isteği (2026-10-04): Salonlar listesinden "bağlı seanslara ulaşabilelim" — salon
  // satırından buraya ?hallId=... ile gelindiğinde seanslar o salona göre önceden filtrelenir.
  const hallIdParam = searchParams.get('hallId') ?? ''

  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [facilityFilter, setFacilityFilter] = useState('')
  const [hallFilter, setHallFilter] = useState(hallIdParam)
  const [startFilter, setStartFilter] = useState('')
  const [endFilter, setEndFilter] = useState('')
  const [categories, setCategories] = useState<SelectOption[]>([])
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [hallOptions, setHallOptions] = useState<{ value: string; label: string }[]>([])
  const [summary, setSummary] = useState<SessionSummary | null>(null)
  const [seatPlan, setSeatPlan] = useState<{ hall: Hall; sessionId: string } | null>(null)
  const [conflictState, setConflictState] = useState<{ conflicts: SessionConflict[]; form: SessionFormData } | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [broadcastIds, setBroadcastIds] = useState<string[] | null>(null)
  const [exportingId, setExportingId] = useState<string | null>(null)

  const exportSession = async (eventId: string, sessionId: string) => {
    setExportingId(sessionId)
    try {
      const { blob, fileName } = await applicationsService.exportExcel({ eventId, sessionId })
      downloadBlob(blob, fileName)
    } finally { setExportingId(null) }
  }

  const loadSummary = useCallback(() => {
    const p: Record<string, unknown> = {}
    if (eventIdFilter) p.eventId = eventIdFilter
    sessionService.getSummary(p).then(setSummary).catch(() => setSummary(null))
  }, [eventIdFilter])
  useEffect(() => { loadSummary() }, [loadSummary, refreshSignal])

  useEffect(() => {
    eventCategoryService.getOptions().then(setCategories).catch(() => setCategories([]))
    hallService.getFacilityOptions().then(setFacilities).catch(() => setFacilities([]))
  }, [])

  useEffect(() => {
    hallService.getHallOptions(facilityFilter || undefined)
      .then((hs) => setHallOptions(hs.map((h) => ({ value: h.value, label: h.label }))))
      .catch(() => setHallOptions([]))
  }, [facilityFilter])

  const doGenerate = async (f: SessionFormData) => {
    const res = await sessionService.generate(f)
    toast.success(`${res.created} seans oluşturuldu${res.skipped ? `, ${res.skipped} atlandı (çakışma/çalışma saati)` : ''}.`)
    setRefreshSignal((s) => s + 1)
    loadSummary()
  }

  const clearEventFilter = () =>
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('eventId'); return n })

  const clearHallParam = () => {
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('hallId'); return n })
    setHallFilter('')
  }

  const goApplications = (eventId: string) =>
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('tab', 'applications'); n.set('eventId', eventId); return n })

  const openSeatPlan = async (hallId: string, sessionId: string) => {
    try { setSeatPlan({ hall: await hallService.getById(hallId), sessionId }) } catch { /* hata toast'ı api.ts interceptor'ından */ }
  }

  const hasActiveFilters = !!statusFilter || !!categoryFilter || !!facilityFilter || !!hallFilter || !!startFilter || !!endFilter || !!eventIdFilter
  const extraParams: Record<string, string> = {}
  if (eventIdFilter) extraParams.eventId = eventIdFilter
  if (statusFilter) extraParams.isActive = statusFilter
  if (categoryFilter) extraParams.categoryId = categoryFilter
  if (facilityFilter) extraParams.facilityId = facilityFilter
  if (hallFilter) extraParams.hallId = hallFilter
  if (startFilter) extraParams.startDate = startFilter
  if (endFilter) extraParams.endDate = endFilter

  return (
    <>
      {eventIdFilter && (
        <div className="flex items-center justify-between rounded-card border border-border bg-[hsl(var(--info-soft))] px-3 py-2">
          <span className="type-body-strong text-[hsl(var(--info))]">Belirli bir etkinliğin seansları gösteriliyor.</span>
          <Button variant="ghost" size="sm" onClick={clearEventFilter}><XIcon className="h-4 w-4" /> Filtreyi kaldır</Button>
        </div>
      )}
      {!eventIdFilter && hallIdParam && (
        <div className="flex items-center justify-between rounded-card border border-border bg-[hsl(var(--info-soft))] px-3 py-2">
          <span className="type-body-strong text-[hsl(var(--info))]">Belirli bir salonun seansları gösteriliyor.</span>
          <Button variant="ghost" size="sm" onClick={clearHallParam}><XIcon className="h-4 w-4" /> Filtreyi kaldır</Button>
        </div>
      )}

      <CrudListTemplate<Session, SessionFormData>
        icon={LayersIcon}
        title="Seanslar"
        subtitle="Etkinliklerin tarih, saat ve salon oturumları"
        resourceName="Seans"
        listTitle="Seans Listesi"
        searchPlaceholder="Etkinlik, salon veya eğitmen ara..."
        service={{
          getList: (p) => sessionService.getList(p),
          remove: can('sessions.delete') ? (id) => sessionService.delete(id) : undefined,
          toggleStatus: can('sessions.edit') ? (id) => sessionService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        selectable
        bulkActions={(rows) => (
          <Button variant="outline" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setBroadcastIds(rows.map((r) => r.id))}>
            SMS / Bildirim Gönder
          </Button>
        )}
        viewable
        isActive={(r) => r.isActive}
        drawerWidth={640}
        // Kullanıcı isteği (2026-10-01): Drawer'ın kendi gri başlığı ile SessionForm'un
        // içindeki renkli EventFormHeader üst üste (çift başlık) görünüyordu — Etkinlikler
        // sekmesindeki aynı desene uyularak formShell açıldı, tek renkli başlık kalıyor.
        formShell
        defaultSort={{ key: 'date', dir: 'desc' }}
        refreshSignal={refreshSignal}
        onMutated={loadSummary}
        extraParams={extraParams}
        filterColumns={3}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => { setStatusFilter(''); setCategoryFilter(''); setFacilityFilter(''); setHallFilter(''); setStartFilter(''); setEndFilter(''); if (eventIdFilter) clearEventFilter(); if (hallIdParam) clearHallParam() }}
        renderFilters={() => (
          <>
            <FilterField label="Durum">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </Select>
            </FilterField>
            <FilterField label="Kategori">
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Tüm Kategoriler</option>
                {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
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
            <FilterField label="Başlangıç">
              <DatePicker value={startFilter} max={endFilter || undefined} onChange={setStartFilter} clearable />
            </FilterField>
            <FilterField label="Bitiş">
              <DatePicker value={endFilter} min={startFilter || undefined} onChange={setEndFilter} clearable />
            </FilterField>
          </>
        )}
        stats={() => [
          { label: 'Toplam Seans', value: summary?.total ?? 0, icon: LayersIcon, accent: 'blue' },
          { label: 'Aktif Seans', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif Seans', value: summary?.passive ?? 0, icon: PowerOffIcon, accent: 'orange' },
          { label: 'Toplam Kayıt', value: summary?.totalRegistered ?? 0, icon: Users2Icon, accent: 'violet' },
          { label: 'Toplam Kontenjan', value: summary?.totalCapacity ?? 0, icon: ArmchairIcon, accent: 'primary' },
        ]}
        columns={[
          { key: 'code', header: 'Kod', sortKey: 'code', sortable: true, hideable: true, defaultHidden: true, cell: (r) => <span className="tabular-nums type-muted">#{r.code}</span> },
          { key: 'event', header: 'Etkinlik', sortable: true, sortKey: 'eventName', cell: (r) => <span className="type-body-strong">{r.eventName}</span> },
          { key: 'category', header: 'Kategori', cell: (r) => <Badge color={r.eventCategoryColor}>{r.eventCategoryName}</Badge> },
          { key: 'facility', header: 'Hizmet Tesisi', hideable: true, cell: (r) => <span className="type-muted">{r.facilityName ?? '—'}</span> },
          { key: 'hall', header: 'Salon', cell: (r) => <span className="type-muted">{r.hallName ?? '—'}</span> },
          { key: 'date', header: 'Tarih', sortable: true, sortKey: 'date', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDate(r.date)}{r.day ? ` · ${r.day}` : ''}</span> },
          { key: 'time', header: 'Saat', align: 'center', cell: (r) => <span className="whitespace-nowrap tabular-nums">{r.startTime}–{r.endTime}</span> },
          { key: 'capacity', header: 'Kontenjan', align: 'center', sortable: true, sortKey: 'capacity', cell: (r) => <span className="tabular-nums">{r.capacity.toLocaleString('tr-TR')}</span> },
          { key: 'registered', header: 'Kayıtlı', align: 'center', cell: (r) => (
            <DrilldownCount count={r.registeredCount} title={`${r.eventName} — Kayıtlı (${fmtDate(r.date)})`} subtitle="Onaylı ve onay bekleyen başvurular" icon={Users2Icon} triggerClassName="tabular-nums font-medium text-[hsl(var(--success))]">
              <ApplicationsTab embedded scope={{ sessionId: r.id, status: 'approved,pending' }} onMutated={() => setRefreshSignal((s) => s + 1)} />
            </DrilldownCount>
          ) },
          { key: 'reserve', header: 'Yedek', align: 'center', hideable: true, cell: (r) => (
            <DrilldownCount count={r.reserveCount} title={`${r.eventName} — Yedek (${fmtDate(r.date)})`} subtitle="Yedek listesindeki başvurular" icon={Users2Icon} triggerClassName="tabular-nums font-medium text-[hsl(var(--warning))]">
              <ApplicationsTab embedded scope={{ sessionId: r.id, status: 'waitlist' }} onMutated={() => setRefreshSignal((s) => s + 1)} />
            </DrilldownCount>
          ) },
          { key: 'remaining', header: 'Kalan', align: 'center', cell: (r) => <span className="tabular-nums font-medium text-[hsl(var(--info))]">{Math.max(0, r.capacity - r.registeredCount).toLocaleString('tr-TR')}</span> },
          { key: 'instructor', header: 'Eğitmen', hideable: true, cell: (r) => <span className="type-muted">{r.instructor ?? '—'}</span> },
          {
            key: 'status', header: 'Durum', align: 'center',
            cell: (r) => (
              r.capacity > 0 && r.registeredCount >= r.capacity
                ? <Badge tone="danger">Dolu</Badge>
                : <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge>
            ),
          },
        ]}
        emptyForm={{ ...emptySessionForm(), eventId: eventIdFilter }}
        toForm={toForm}
        getFormErrors={(f) => [
          !f.eventId && 'Etkinlik seçimi zorunludur.',
          !isResponsiblePersonValid({ managerId: f.instructorId, manager: f.instructor, managerPhone: f.instructorPhone, tckn: f.tckn, grantAccess: f.grantAccess }) && 'Eğitmen bilgileri eksik veya hatalı.',
          ...(f.mode === 'recurring'
            ? [
                !f.startDate && 'Başlangıç tarihi zorunludur.',
                !f.endDate && 'Bitiş tarihi zorunludur.',
                f.dayPlans.length === 0 && 'En az bir gün planı eklenmelidir.',
                f.dayPlans.some((p) => p.slots.some((s) => s.startTime && s.endTime && s.endTime <= s.startTime)) && 'Bitiş saati başlangıç saatinden sonra olmalıdır.',
              ]
            : [
                !f.date && 'Tarih zorunludur.',
                !f.startTime && 'Başlangıç saati zorunludur.',
                !f.endTime && 'Bitiş saati zorunludur.',
                (f.startTime && f.endTime && f.endTime <= f.startTime) && 'Bitiş saati başlangıç saatinden sonra olmalıdır.',
              ]),
        ].filter(Boolean) as string[]}
        renderForm={({ form, setForm, mode, editingRow }) => <SessionForm form={form} setForm={setForm} mode={mode} editingRow={editingRow} lockEvent={!!eventIdFilter && mode === 'create'} />}
        renderView={(row) => <SessionForm form={toForm(row)} setForm={() => {}} mode="edit" editingRow={row} readOnly />}
        deleteConfirm={{ title: 'Seansı Sil', description: 'Bu seans silinecek. Koltuk ayırmış / kayıtlı katılımcılara iptal bildirimi gönderilecektir.' }}
        toggleConfirm={(row, willActivate) => willActivate
          ? { title: 'Seansı Aktif Et', description: `"${row.eventName}" seansı yeniden aktif edilecek.` }
          : { title: 'Seansı Pasife Al', description: `"${row.eventName}" seansı pasife alınacak; katılımcılara gösterilmez.` }}
        creatable={can('sessions.create')}
        // Kullanıcı isteği (2026-10-04): "seansta da aynı şekilde ... üst tarafta seans
        // ekleme seçeneği burda olsun" — "Yeni Seans" butonu tablonun kendi araç çubuğuna
        // (Sütunlar butonunun soluna) taşındı.
        createButtonPlacement="table"
        canEdit={() => can('sessions.edit')}
        canDelete={() => can('sessions.delete')}
        onCreate={can('sessions.create') ? async (f) => {
          if (f.mode !== 'recurring') {
            await sessionService.create(f)
            toast.success('Seans oluşturuldu.')
            setRefreshSignal((s) => s + 1)
            loadSummary()
            return
          }
          const conflicts = await sessionService.checkConflicts(f)
          if (conflicts.length > 0) { setConflictState({ conflicts, form: f }); return }
          await doGenerate(f)
        } : undefined}
        onUpdate={can('sessions.edit') ? (id, f) => sessionService.update(id, f).then(() => { toast.success('Seans güncellendi.'); loadSummary() }) : undefined}
        collapseRowActions
        extraRowActions={(row) => (
          <>
            <IconButton tone="primary" title={row.hallId ? 'Oturma düzeni' : 'Salon atanmamış'} disabled={!row.hallId} onClick={() => row.hallId && openSeatPlan(row.hallId, row.id)}>
              <ArmchairIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Başvurular" onClick={() => goApplications(row.eventId)}>
              <ClipboardListIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Excel İndir (bu seans)" disabled={exportingId === row.id} onClick={() => exportSession(row.eventId, row.id)}>
              <img src={excelIcon} alt="Excel" className="h-5 w-5" />
            </IconButton>
          </>
        )}
      />

      <SeatPlanModal open={!!seatPlan} onClose={() => setSeatPlan(null)} onSaved={() => setRefreshSignal((s) => s + 1)} hall={seatPlan?.hall ?? null} sessionId={seatPlan?.sessionId} />

      {conflictState && (
        <Modal open onClose={() => setConflictState(null)} width={600} className="max-w-[94vw]">
          <div className="border-b border-border px-6 py-4 pr-14">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-field bg-[hsl(var(--warning-soft))]">
                <AlertTriangleIcon className="h-4 w-4 text-[hsl(var(--warning))]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground-strong">Çakışma / Uygunluk Uyarısı</h3>
                <p className="type-caption">{conflictState.conflicts.length} gün-saat oluşturulamıyor; kalan uygun seanslar oluşturulacak.</p>
              </div>
            </div>
          </div>
          <div className="max-h-[50vh] space-y-2 overflow-auto p-4">
            {conflictState.conflicts.map((c, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface-1 px-3 py-2">
                <div className="min-w-0">
                  <p className="type-body-strong">{fmtDate(c.date)} · {c.day} · {c.startTime}–{c.endTime}</p>
                  <p className="type-caption">
                    {c.reason === 'hall'
                      ? `Salon dolu${c.conflictEventName ? `: ${c.conflictEventName}` : ''}`
                      : 'Tesis çalışma saatleri dışında'}
                    {c.hallName ? ` · ${c.hallName}` : ''}
                  </p>
                </div>
                <Badge tone={c.reason === 'hall' ? 'danger' : 'warning'}>{c.reason === 'hall' ? 'Salon Çakışması' : 'Saat Dışı'}</Badge>
              </div>
            ))}
          </div>
          <div className="flex gap-3 border-t border-border px-6 py-4">
            <Button variant="outline" className="flex-1" onClick={() => setConflictState(null)}>Vazgeç</Button>
            <Button variant="primary" className="flex-1" onClick={async () => { const f = conflictState.form; setConflictState(null); await doGenerate(f) }}>
              Çakışanları Atla ve Oluştur
            </Button>
          </div>
        </Modal>
      )}
      <BroadcastModal open={!!broadcastIds} target="session" ids={broadcastIds ?? []} count={broadcastIds?.length ?? 0} onClose={() => setBroadcastIds(null)} />
    </>
  )
}
