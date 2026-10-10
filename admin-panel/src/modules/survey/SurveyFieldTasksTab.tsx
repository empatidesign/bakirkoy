import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  MapPinnedIcon,
  TargetIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  CalendarDaysIcon,
  UsersIcon,
  PlusIcon,
  XIcon,
  EyeIcon,
  PencilIcon,
  Trash2Icon,
  BellIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import {
  AdminFormShell,
  Badge,
  Button,
  IconButton,
  Combobox,
  DataTable,
  DatePicker,
  EmptyState,
  Field,
  FilterBar,
  FilterField,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  StatCard,
  Textarea,
  type DataTableColumn,
} from '@/design-system'
import surveyPlatformService from '@/services/surveyPlatform.service'
import surveyService from '@/services/survey.service'
import { useNeighborhoodOptions } from '@/hooks/useNeighborhoodOptions'
import { SurveyInterviewerPicker } from './SurveyInterviewerPicker'
import { SurveyNotificationReceiptsTab } from './SurveyNotificationReceiptsTab'
import { SurveyInterviewersTab } from './SurveyInterviewersTab'
import { SurveyFieldTaskBatchModal } from './SurveyFieldTaskBatchModal'
import { SurveyFieldTaskDetailPanel } from './SurveyFieldTaskDetailPanel'
import { formatDate } from '@/lib/utils'
import { openCitizenPortalAs } from '@/lib/citizenBypass'
import {
  SURVEY_FIELD_TASK_STATUS_LABELS,
  SURVEY_FIELD_TASK_STATUS_OPTIONS,
  SURVEY_FIELD_TASK_STATUS_TONE,
} from '@/types/surveyPlatform.types'
import type {
  SurveyFieldTask,
  SurveyFieldTaskForm,
  SurveyFieldTaskBulkAction,
} from '@/types/surveyPlatform.types'
import type { SelectOption } from '@/types/common'

const todayIso = () => new Date().toISOString().split('T')[0]

const toForm = (r: SurveyFieldTask): SurveyFieldTaskForm => ({
  surveyId: r.surveyId,
  interviewerId: r.interviewerId,
  interviewerType: r.interviewerType,
  interviewerLabel: r.interviewerName,
  neighborhood: r.neighborhood === 'Tüm Mahalleler' ? '' : r.neighborhood,
  startDate: r.startDate ? r.startDate.split('T')[0] : todayIso(),
  endDate: r.endDate ? r.endDate.split('T')[0] : todayIso(),
  targetCount: r.targetCount,
  dailyTarget: r.dailyTarget,
  note: r.note ?? '',
  status: r.status,
})

// Kullanıcı isteği (2026-09-01): toplu işlem onay diyaloğu için ekranda gösterilecek metin.
const BULK_LABELS: Record<SurveyFieldTaskBulkAction, string> = {
  activate: 'Toplu Aktif Et',
  deactivate: 'Toplu Pasif Et',
  'assign-neighborhood': 'Toplu Mahalle Ata',
  'assign-survey': 'Toplu Anket Ata',
  delete: 'Toplu Sil',
}

export const SurveyFieldTasksTab = () => {
  const { can } = useAuth()
  const neighborhoodOptions = useNeighborhoodOptions()
  const [surveyOptions, setSurveyOptions] = useState<SelectOption[]>([])
  const [statusFilter, setStatusFilter] = useState('')
  const [neighborhoodFilter, setNeighborhoodFilter] = useState('')
  const [surveyFilter, setSurveyFilter] = useState('')
  const [search, setSearch] = useState('')

  const [rows, setRows] = useState<SurveyFieldTask[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [loading, setLoading] = useState(true)
  const [refreshSignal, setRefreshSignal] = useState(0)

  const [batchOpen, setBatchOpen] = useState(false)
  const [editing, setEditing] = useState<SurveyFieldTask | null>(null)
  const [editForm, setEditForm] = useState<SurveyFieldTaskForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SurveyFieldTask | null>(null)
  const [bypassingId, setBypassingId] = useState<string | null>(null)
  // Kullanıcı isteği (2026-09-01): "Anketörler" sekmesi aynı verinin başka bir kırılımı
  // olduğu için ayrı sekme kaldırıldı; buradan görünüm olarak erişilir.
  const [view, setView] = useState<'gorevler' | 'anketorler' | 'bildirimler'>('gorevler')
  // Kullanıcı isteği (2026-09-01): ekran ikiye bölünür — solda liste, sağda tıklanan
  // görevin detayı. `detailId` tıklanan satırı tutar; satır listeden düşerse panel kapanır.
  const [detailId, setDetailId] = useState<string | null>(null)

  // Toplu işlem durumu.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<SurveyFieldTaskBulkAction | null>(null)
  const [bulkNeighborhood, setBulkNeighborhood] = useState('')
  const [bulkSurveyId, setBulkSurveyId] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)

  useEffect(() => {
    surveyService
      .getList({ page: 1, limit: 100, sort: 'createdAt', order: 'desc' })
      .then((res) => setSurveyOptions(res.items.map((s) => ({ value: s.id, label: s.title }))))
      .catch(() => setSurveyOptions([]))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    const params: Record<string, unknown> = { page, limit, search: search || undefined }
    if (statusFilter) params.status = statusFilter
    if (neighborhoodFilter) params.neighborhood = neighborhoodFilter
    if (surveyFilter) params.surveyId = surveyFilter
    surveyPlatformService
      .getFieldTasks(params)
      .then((res) => { setRows(res.items); setTotal(res.total) })
      .catch(() => { setRows([]); setTotal(0) })
      .finally(() => setLoading(false))
  }, [page, limit, search, statusFilter, neighborhoodFilter, surveyFilter])

  useEffect(() => { load() }, [load, refreshSignal])

  const hasActiveFilters = !!statusFilter || !!neighborhoodFilter || !!surveyFilter
  const refresh = () => setRefreshSignal((s) => s + 1)

  // Sağ paneldeki görev ve onun listedeki sıra numarası (sayfalama dahil genel sıra).
  // Kayıt listeden düşerse (silme/filtre) panel otomatik kapanır.
  const detailIndex = detailId ? rows.findIndex((r) => r.id === detailId) : -1
  const detailTask = detailIndex >= 0 ? rows[detailIndex] : null
  const detailRowNumber = detailIndex >= 0 ? (page - 1) * limit + detailIndex + 1 : null

  const openEdit = (row: SurveyFieldTask) => {
    setEditing(row)
    setEditForm(toForm(row))
  }

  const saveEdit = async () => {
    if (!editing || !editForm) return
    if (!editForm.surveyId || !editForm.interviewerId || !editForm.startDate || !editForm.endDate) {
      toast.error('Anket, anketör, başlangıç ve bitiş tarihi zorunludur.')
      return
    }
    if (editForm.endDate < editForm.startDate) {
      toast.error('Bitiş tarihi başlangıç tarihinden önce olamaz.')
      return
    }
    if (editForm.dailyTarget > editForm.targetCount && editForm.targetCount > 0) {
      toast.error('Günlük hedef toplam hedeften büyük olamaz.')
      return
    }
    setSaving(true)
    try {
      await surveyPlatformService.updateFieldTask(editing.id, editForm)
      setEditing(null)
      setEditForm(null)
      toast.success('Saha görevi güncellendi.')
      refresh()
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    await surveyPlatformService.removeFieldTask(deleteTarget.id)
    setDeleteTarget(null)
    // Soft-delete: görev listeden kalkar, toplanan yanıtlar korunur.
    toast.success('Görev silindi. Toplanan anket yanıtları korundu.')
    refresh()
  }

  const runBulk = async () => {
    if (!bulkAction) return
    const ids = [...selected]
    if (ids.length === 0) return
    setBulkRunning(true)
    try {
      const res = await surveyPlatformService.bulkFieldTaskAction({
        ids,
        action: bulkAction,
        neighborhood: bulkAction === 'assign-neighborhood' ? (bulkNeighborhood || null) : undefined,
        surveyId: bulkAction === 'assign-survey' ? bulkSurveyId : undefined,
      })
      toast.success(
        `${res.affected} görev güncellendi.` +
        (res.skipped > 0 ? ` ${res.skipped} kayıt yetki kapsamı dışında olduğu için atlandı.` : '') +
        (bulkAction === 'delete' ? ' Toplanan anket yanıtları korundu.' : '')
      )
      setSelected(new Set())
      setBulkAction(null)
      setBulkNeighborhood('')
      setBulkSurveyId('')
      refresh()
    } finally {
      setBulkRunning(false)
    }
  }

  const bulkDisabled =
    (bulkAction === 'assign-survey' && !bulkSurveyId) || bulkRunning

  const columns: DataTableColumn<SurveyFieldTask>[] = useMemo(() => [
    {
      // Kullanıcı isteği (2026-09-02): sütun "Anket / Anketör" değil "Anketör" olsun ve
      // görevli ismi başta yazsın; anket adı ikincil satırda kalır.
      key: 'interviewerName',
      header: 'Anketör',
      cell: (r) => (
        <div className="leading-tight">
          <span className="type-body-strong">
            {r.interviewerName}
            {r.interviewerType === 'participant' && <Badge tone="info" className="ml-1.5">Üye</Badge>}
          </span>
          <span className="block type-caption">{r.surveyTitle}</span>
        </div>
      ),
    },
    { key: 'neighborhood', header: 'Mahalle', cell: (r) => <Badge tone={r.neighborhood === 'Tüm Mahalleler' ? 'primary' : 'neutral'}>{r.neighborhood}</Badge> },
    { key: 'dates', header: 'Tarih Aralığı', align: 'center', cell: (r) => <span className="whitespace-nowrap type-muted">{formatDate(r.startDate)} — {formatDate(r.endDate)}</span> },
    {
      key: 'progress',
      header: 'Gerçekleşme',
      cell: (r) => (
        <div className="min-w-[140px] space-y-1">
          <div className="flex items-center justify-between type-caption">
            <span className="tabular-nums">{r.completedCount} / {r.targetCount || '—'}</span>
            <span className="tabular-nums">%{Math.round(r.progressPercent)}</span>
          </div>
          <Progress value={Math.min(100, r.progressPercent)} tone={r.progressPercent >= 100 ? 'success' : 'primary'} />
        </div>
      ),
    },
    { key: 'todayCount', header: 'Bugün', align: 'center', cell: (r) => <span className="tabular-nums">{r.todayCount}</span> },
    { key: 'status', header: 'Durum', align: 'center', cell: (r) => <Badge tone={SURVEY_FIELD_TASK_STATUS_TONE[r.status]}>{SURVEY_FIELD_TASK_STATUS_LABELS[r.status]}</Badge> },
    { key: 'lastSyncAt', header: 'Son Senkron', align: 'center', defaultHidden: true, cell: (r) => <span className="whitespace-nowrap type-muted">{r.lastSyncAt ? formatDate(r.lastSyncAt) : '—'}</span> },
  ], [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="type-section">Anketörler</p>
          <p className="type-caption">Anketörlere mahalle bazlı anket görevi atayın ve gerçekleşmeyi izleyin</p>
        </div>
        {can('survey.create') && view === 'gorevler' && (
          <Button variant="primary" iconLeft={<PlusIcon className="h-4 w-4" />} onClick={() => setBatchOpen(true)}>Saha Görevi Ekle</Button>
        )}
      </div>

      {/* Not (2026-09-01): üst sekmelerdeki "Anketör Performansı" ayrı bir ekrandır
          (puan/skor analizi). Buradaki görünüm, saha görevlerinin anketöre göre
          gruplandığı gerçekleşme özetidir; iki ekran karışmasın diye "Anketör Özeti". */}
      <SegmentedControl
        value={view}
        onChange={(v) => setView(v as 'gorevler' | 'anketorler' | 'bildirimler')}
        columns={3}
        className="max-w-md"
        options={[
          { value: 'gorevler', label: 'Görev Listesi', description: 'Atama, toplu işlem ve düzenleme', icon: MapPinnedIcon },
          { value: 'anketorler', label: 'Anketör Özeti', description: 'Anketör bazında görev ve gerçekleşme', icon: UsersIcon, tone: 'violet' },
          // Kullanıcı isteği (2026-09-02): gönderilen bildirimi kimin okuduğu adminde görülmeli.
          { value: 'bildirimler', label: 'Bildirim Takibi', description: 'Kim okudu, kim onayladı', icon: BellIcon, tone: 'orange' },
        ]}
      />

      {view === 'bildirimler' ? <SurveyNotificationReceiptsTab />
        : view === 'anketorler' ? <SurveyInterviewersTab /> : <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Toplam Görev" value={total} icon={ClipboardListIcon} accent="blue" />
        <StatCard label="Devam Eden" value={rows.filter((r) => r.status === 'in_progress' || r.status === 'assigned').length} icon={CalendarDaysIcon} accent="orange" />
        <StatCard label="Tamamlanan Anket" value={rows.reduce((s, r) => s + r.completedCount, 0)} icon={CheckCircle2Icon} accent="green" />
        <StatCard label="Toplam Hedef" value={rows.reduce((s, r) => s + r.targetCount, 0)} icon={TargetIcon} accent="violet" />
      </div>

      <FilterBar
        hasActiveFilters={hasActiveFilters}
        onClear={() => { setStatusFilter(''); setNeighborhoodFilter(''); setSurveyFilter(''); setPage(1) }}
        columns={3}
      >
        <FilterField label="Anket">
          <Select value={surveyFilter} onChange={(e) => { setSurveyFilter(e.target.value); setPage(1) }}>
            <option value="">Tüm Anketler</option>
            {surveyOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
        <FilterField label="Mahalle">
          <Select value={neighborhoodFilter} onChange={(e) => { setNeighborhoodFilter(e.target.value); setPage(1) }}>
            <option value="">Tüm Mahalleler</option>
            {neighborhoodOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
        <FilterField label="Durum">
          <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}>
            <option value="">Tüm Durumlar</option>
            {SURVEY_FIELD_TASK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
      </FilterBar>

      {/* Kullanıcı isteği (2026-09-01): ekran ikiye bölünür — solda liste, sağda detay.
          Detay kapalıyken liste tüm genişliği kullanır. */}
      <div className={detailTask ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]' : ''}>
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        showRowNumbers
        onRowClick={(r) => setDetailId((cur) => cur === r.id ? null : r.id)}
        activeRowKey={detailId}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        searchable
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchPlaceholder="Anket, anketör veya mahalle ara..."
        page={page}
        limit={limit}
        total={total}
        totalPages={Math.max(1, Math.ceil(total / limit))}
        onPageChange={setPage}
        onLimitChange={(n) => { setLimit(n); setPage(1) }}
        empty={<EmptyState icon={MapPinnedIcon} title="Henüz saha görevi yok" description="Anketörlere mahalle bazlı görev atamak için “Saha Görevi Ekle” düğmesine basın." />}
        // Kullanıcı isteği (2026-09-01): seçili satırlara toplu aktif/pasif, mahalle ve anket atama, silme.
        selectionActions={
          <div className="flex flex-wrap items-center gap-1.5">
            {can('survey.edit') && <>
              <Button variant="ghost" size="sm" onClick={() => setBulkAction('activate')}>Aktif Et</Button>
              <Button variant="ghost" size="sm" onClick={() => setBulkAction('deactivate')}>Pasif Et</Button>
              <Button variant="ghost" size="sm" onClick={() => setBulkAction('assign-neighborhood')}>Mahalle Ata</Button>
              <Button variant="ghost" size="sm" onClick={() => setBulkAction('assign-survey')}>Anket Ata</Button>
            </>}
            {can('survey.delete') && <Button variant="ghost" size="sm" onClick={() => setBulkAction('delete')}>Sil</Button>}
          </div>
        }
        rowActions={(r) => (
          // Kullanıcı isteği (2026-09-02): görüntüleme, düzenle ve sil ikon düğmesi olsun.
          // Tooltip'te anketörün ismi de görünür ki hangi kişiye ait olduğu net olsun.
          <div className="flex items-center gap-0.5">
            {/* Anketörün sahada gördüğü ekranı (citizen-portal /saha) bypass ile aç.
                Yalnızca üye (Participant) anketörlerde mümkün. */}
            {r.interviewerType === 'participant' && can('participants.impersonate') && (
              <IconButton
                title={`${r.interviewerName} — saha ekranını gör`}
                disabled={bypassingId === r.interviewerId}
                onClick={async () => {
                  setBypassingId(r.interviewerId)
                  try { await openCitizenPortalAs(r.interviewerId, '/saha') } finally { setBypassingId(null) }
                }}
              >
                <EyeIcon className="h-4 w-4" />
              </IconButton>
            )}
            {can('survey.edit') && (
              <IconButton title={`${r.interviewerName} görevini düzenle`} onClick={() => openEdit(r)}>
                <PencilIcon className="h-4 w-4" />
              </IconButton>
            )}
            {can('survey.delete') && (
              <IconButton tone="danger" title={`${r.interviewerName} görevini sil`} onClick={() => setDeleteTarget(r)}>
                <Trash2Icon className="h-4 w-4" />
              </IconButton>
            )}
          </div>
        )}
      />

      {detailTask && (
        <div className="xl:sticky xl:top-4">
          <SurveyFieldTaskDetailPanel
            task={detailTask}
            rowNumber={detailRowNumber}
            onClose={() => setDetailId(null)}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
            onOpenScreen={async (t) => {
              setBypassingId(t.interviewerId)
              try { await openCitizenPortalAs(t.interviewerId, '/saha') } finally { setBypassingId(null) }
            }}
            openingScreen={bypassingId === detailTask.interviewerId}
            canEdit={can('survey.edit')}
            canDelete={can('survey.delete')}
            canImpersonate={can('participants.impersonate')}
          />
        </div>
      )}
      </div>

      <SurveyFieldTaskBatchModal open={batchOpen} onClose={() => setBatchOpen(false)} onCreated={refresh} />
      </>}

      {bulkAction && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => !bulkRunning && setBulkAction(null)}>
          <div className="w-full max-w-md rounded-card bg-[hsl(var(--surface-1))] p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <p className="type-body-strong mb-1">{BULK_LABELS[bulkAction]}</p>
            <p className="type-caption mb-4">
              {selected.size} görev seçildi.
              {bulkAction === 'delete' && ' Görevler listeden kaldırılır; toplanan anket yanıtları ve tüm veriler korunur (soft-delete).'}
              {bulkAction === 'activate' && ' Seçili görevler "Devam Ediyor" durumuna alınır.'}
              {bulkAction === 'deactivate' && ' Seçili görevler "İptal" durumuna alınır ve anketörler bu görevle saha kaydı yapamaz.'}
            </p>

            {bulkAction === 'assign-neighborhood' && (
              <Field label="Hedef Mahalle">
                <Combobox value={bulkNeighborhood} onChange={setBulkNeighborhood} options={neighborhoodOptions} placeholder="Tüm Mahalleler (boş bırakın)" />
              </Field>
            )}
            {bulkAction === 'assign-survey' && (
              <Field label="Hedef Anket" required>
                <Combobox value={bulkSurveyId} onChange={setBulkSurveyId} options={surveyOptions} placeholder="Anket seçin" />
              </Field>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkAction(null)} disabled={bulkRunning}>İptal</Button>
              <Button
                variant={bulkAction === 'delete' ? 'danger' : 'primary'}
                onClick={runBulk}
                isLoading={bulkRunning}
                disabled={bulkDisabled}
              >Uygula</Button>
            </div>
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="pilot-form-dialog relative flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-card bg-[hsl(var(--surface-1))] shadow-pop" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Kapat"
              onClick={() => setEditing(null)}
              disabled={saving}
              className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-field border border-white/25 bg-white/15 text-white transition-colors hover:bg-white/25 disabled:opacity-50"
            >
              <XIcon className="h-4 w-4" />
            </button>
            <div className="pilot-form-body min-h-0 flex-1 overflow-y-auto">
            <AdminFormShell className="m-0" icon={MapPinnedIcon} title="Saha Görevi Düzenle" subtitle="Anket, anketör, mahalle ve hedef bilgilerini güncelleyin" badge="Saha" tone="violet">
              <div className="space-y-5" style={{ '--input-bg': 'var(--surface-1)' } as React.CSSProperties}>
                <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                  <Field label="Anket" required error={!editForm.surveyId ? 'Anket seçimi zorunludur.' : undefined}>
                    <Combobox value={editForm.surveyId} onChange={(v) => setEditForm((f) => f && { ...f, surveyId: v })} options={surveyOptions} placeholder="Anket seçin" />
                  </Field>
                  <Field label="Mahalle">
                    <Combobox value={editForm.neighborhood} onChange={(v) => setEditForm((f) => f && { ...f, neighborhood: v })} options={neighborhoodOptions} placeholder="Tüm Mahalleler (boş bırakın)" />
                  </Field>
                </div>
                <Field label="Anketör" required error={!editForm.interviewerId ? 'Anketör seçimi zorunludur.' : undefined}>
                  <SurveyInterviewerPicker
                    values={editForm.interviewerId ? [{ id: editForm.interviewerId, type: editForm.interviewerType, label: editForm.interviewerLabel }] : []}
                    onChange={(v) => setEditForm((f) => f && { ...f, interviewerId: v[0]?.id ?? '', interviewerType: v[0]?.type ?? 'admin', interviewerLabel: v[0]?.label ?? '' })}
                    multiple={false}
                  />
                </Field>
                <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
                  <Field label="Durum">
                    <Select value={editForm.status} onChange={(e) => setEditForm((f) => f && { ...f, status: e.target.value as SurveyFieldTaskForm['status'] })}>
                      {SURVEY_FIELD_TASK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Toplam Hedef">
                    <NumberInput value={editForm.targetCount} onChange={(n) => setEditForm((f) => f && { ...f, targetCount: n })} min={0} max={100000} suffix="anket" />
                  </Field>
                  <Field label="Başlangıç Tarihi" required error={!editForm.startDate ? 'Başlangıç tarihi zorunludur.' : undefined}>
                    <DatePicker value={editForm.startDate} onChange={(v) => setEditForm((f) => f && { ...f, startDate: v })} max={editForm.endDate || undefined} />
                  </Field>
                  <Field label="Bitiş Tarihi" required error={!editForm.endDate ? 'Bitiş tarihi zorunludur.' : editForm.endDate < editForm.startDate ? 'Bitiş tarihi başlangıçtan önce olamaz.' : undefined}>
                    <DatePicker value={editForm.endDate} onChange={(v) => setEditForm((f) => f && { ...f, endDate: v })} min={editForm.startDate || undefined} />
                  </Field>
                  <Field label="Günlük Hedef">
                    <NumberInput value={editForm.dailyTarget} onChange={(n) => setEditForm((f) => f && { ...f, dailyTarget: n })} min={0} max={1000} suffix="anket" />
                  </Field>
                </div>
                <Field label="Not">
                  <Textarea value={editForm.note} onChange={(e) => setEditForm((f) => f && { ...f, note: e.target.value })} rows={3} />
                </Field>
                <div className="sticky -bottom-[15px] z-10 -mx-[15px] -mb-[15px] flex justify-end gap-2 border-t border-border bg-surface-0 px-[15px] py-4 shadow-[0_-8px_20px_rgba(15,23,42,0.04)]">
                  <Button variant="outline" onClick={() => setEditing(null)}>İptal</Button>
                  <Button
                    variant="primary"
                    onClick={saveEdit}
                    isLoading={saving}
                    disabled={!editForm.surveyId || !editForm.interviewerId || !editForm.startDate || !editForm.endDate || editForm.endDate < editForm.startDate || (editForm.targetCount > 0 && editForm.dailyTarget > editForm.targetCount)}
                  >Kaydet</Button>
                </div>
              </div>
            </AdminFormShell>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-card bg-[hsl(var(--surface-1))] p-5 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <p className="type-body-strong mb-1">Görevi Sil</p>
            <p className="type-caption mb-4">Saha görevi listeden kaldırılır (soft-delete). Toplanan anket yanıtları ve anketörün diğer verileri etkilenmez.</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>İptal</Button>
              <Button variant="danger" onClick={confirmDelete}>Sil</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
