import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ClipboardListIcon, CheckCircle2Icon, ClockIcon, XCircleIcon, SearchCheckIcon, HistoryIcon, XIcon,
} from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { toast } from 'sonner'
import { Badge, Select, FilterField, DatePicker, IconButton, Button } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import applicationsService from '@/services/applications.service'
import { maskTC } from '@/lib/utils'
import { ApplicationForm } from './ApplicationForm'
import { ApplicantHistoryModal } from './ApplicantHistoryModal'
import { RejectReasonModal } from '@/components/specialized/RejectReasonModal'
import type { Application, ApplicationForm as ApplicationFormData, ApplicationSummary, ApplicationStatus } from '@/types/application.types'
import {
  APPLICATION_STATUS_LABELS, APPLICATION_STATUS_TONE, APPLICATION_STATUS_OPTIONS,
} from '@/types/application.types'
import { GENDER_LABELS, GENDER_OPTIONS } from '@/types/participant.types'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')

const seatText = (key?: string) => {
  if (!key) return '—'
  const p = key.split(':')
  if (p.length >= 3) return `Sıra ${Number(p[1]) + 1} · K${p[2]}`
  if (p.length === 2) return `${Number(p[1]) + 1}. sıra`
  return key
}

const emptyForm: ApplicationFormData = {
  participantId: '', eventId: '', sessionId: '',
  status: 'pending', documentStatus: 'none', paymentStatus: 'unpaid',
  seatNumber: '',
}

const toForm = (r: Application): ApplicationFormData => ({
  participantId: r.participantId,
  eventId: r.eventId,
  sessionId: r.sessionId ?? '',
  status: r.status,
  documentStatus: r.documentStatus,
  paymentStatus: r.paymentStatus,
  seatNumber: r.seatNumber ?? '',
})

export const ApplicationsTab = ({ scope, embedded, onMutated }: { scope?: { eventId?: string; sessionId?: string; status?: string }; embedded?: boolean; onMutated?: () => void } = {}) => {
  const { can } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlEventId = searchParams.get('eventId') ?? ''
  const eventIdFilter = scope?.eventId ?? urlEventId
  const sessionIdFilter = scope?.sessionId ?? ''
  const lockedStatus = scope?.status ?? ''

  const [statusFilter, setStatusFilter] = useState('')
  const [genderFilter, setGenderFilter] = useState('')
  const [startFilter, setStartFilter] = useState('')
  const [endFilter, setEndFilter] = useState('')
  const [summary, setSummary] = useState<ApplicationSummary | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [statusPendingId, setStatusPendingId] = useState<string | null>(null)
  const [bulkPending, setBulkPending] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ rows: Application[]; clear?: () => void; refresh?: () => void } | null>(null)

  const loadSummary = useCallback(() => {
    const p: Record<string, unknown> = {}
    if (eventIdFilter) p.eventId = eventIdFilter
    applicationsService.getSummary(p).then(setSummary).catch(() => setSummary(null))
  }, [eventIdFilter])
  useEffect(() => { loadSummary() }, [loadSummary])

  const handleMutated = () => { loadSummary(); onMutated?.() }

  const canApprove = can('sessions.approve')

  const changeStatus = async (id: string, status: ApplicationStatus) => {
    if (statusPendingId) return
    setStatusPendingId(id)
    try {
      await applicationsService.setStatus(id, status)
      toast.success(status === 'approved' ? 'Başvuru onaylandı.' : 'Başvuru reddedildi.')
      setRefreshSignal((s) => s + 1)
      handleMutated()
    } finally {
      setStatusPendingId(null)
    }
  }

  const bulkSetStatus = async (rows: Application[], status: ApplicationStatus, clear?: () => void, refresh?: () => void, reason?: string) => {
    if (bulkPending) return
    const targets = rows.filter((r) => r.status !== status)
    if (targets.length === 0) { toast.info(status === 'approved' ? 'Seçili başvurular zaten onaylı.' : 'Seçili başvurular zaten reddedildi.'); return }
    setBulkPending(true)
    try {
      const outcomes = await Promise.allSettled(targets.map((r) => applicationsService.setStatus(r.id, status, reason)))
      const ok = outcomes.filter((o) => o.status === 'fulfilled').length
      const failed = outcomes.length - ok
      if (ok > 0)
        toast.success(status === 'approved' ? `${ok} başvuru onaylandı.` : `${ok} başvuru reddedildi.`)
      if (failed > 0)
        toast.warning(`${failed} başvuru işlenemedi. Kontenjan dolmuş olabilir; listeyi kontrol edin.`)
      clear?.()
      if (refresh) refresh(); else setRefreshSignal((s) => s + 1)
      handleMutated()
    } finally {
      setBulkPending(false)
    }
  }

  const clearEventFilter = () =>
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('eventId'); return n })

  const hasActiveFilters = embedded ? false : (!!statusFilter || !!genderFilter || !!startFilter || !!endFilter || !!eventIdFilter)
  const extraParams: Record<string, string> = {}
  if (eventIdFilter) extraParams.eventId = eventIdFilter
  if (sessionIdFilter) extraParams.sessionId = sessionIdFilter
  if (lockedStatus || statusFilter) extraParams.status = lockedStatus || statusFilter
  if (genderFilter) extraParams.gender = genderFilter
  if (startFilter) extraParams.startDate = startFilter
  if (endFilter) extraParams.endDate = endFilter

  return (
    <>
      {!embedded && !scope && urlEventId && (
        <div className="flex items-center justify-between rounded-card border border-border bg-[hsl(var(--info-soft))] px-3 py-2">
          <span className="type-body-strong text-[hsl(var(--info))]">Belirli bir etkinliğin başvuruları gösteriliyor.</span>
          <Button variant="ghost" size="sm" onClick={clearEventFilter}><XIcon className="h-4 w-4" /> Filtreyi kaldır</Button>
        </div>
      )}

      <CrudListTemplate<Application, ApplicationFormData>
        icon={ClipboardListIcon}
        title="Başvurular"
        subtitle="Etkinlik başvuruları ve onay süreci"
        resourceName="Başvuru"
        listTitle="Başvuru Listesi"
        searchPlaceholder="Ad, TC, telefon, e-posta ara..."
        service={{
          getList: (p) => applicationsService.getList(p),
          remove: can('sessions.delete') ? (id) => applicationsService.delete(id) : undefined,
        }}
        rowKey={(r) => r.id}
        selectable
        bulkActions={(rows, { clear, refresh }) => (
          <>
            {canApprove && (
            <Button variant="outline" size="sm" className="text-success hover:bg-success-soft" isLoading={bulkPending} disabled={bulkPending} onClick={() => bulkSetStatus(rows, 'approved', clear, refresh)}>
              <CheckCircle2Icon className="h-3.5 w-3.5" /> Onayla
            </Button>
            )}
            {canApprove && (
            <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" isLoading={bulkPending} disabled={bulkPending} onClick={() => setRejectTarget({ rows, clear, refresh })}>
              <XCircleIcon className="h-3.5 w-3.5" /> Reddet
            </Button>
            )}
          </>
        )}
        viewable={!embedded}
        embedded={embedded}
        drawerWidth={860}
        viewWidth={860}
        formShell
        defaultSort={{ key: 'appliedAt', dir: 'desc' }}
        refreshSignal={refreshSignal}
        onMutated={handleMutated}
        extraParams={extraParams}
        filterColumns={4}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => { setStatusFilter(''); setGenderFilter(''); setStartFilter(''); setEndFilter(''); if (eventIdFilter) clearEventFilter() }}
        renderFilters={embedded ? undefined : () => (
          <>
            <FilterField label="Onay Durumu">
              <Select value={lockedStatus || statusFilter} disabled={!!lockedStatus} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                {APPLICATION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Cinsiyet">
              <Select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                <option value="">Tümü</option>
                {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
          { label: 'Toplam Başvuru', value: summary?.total ?? 0, icon: ClipboardListIcon, accent: 'blue' },
          { label: 'Onaylanan', value: summary?.approved ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Beklemede', value: summary?.pending ?? 0, icon: ClockIcon, accent: 'orange' },
          { label: 'Reddedilen', value: summary?.rejected ?? 0, icon: XCircleIcon, accent: 'violet' },
          { label: 'İnceleniyor', value: summary?.reviewing ?? 0, icon: SearchCheckIcon, accent: 'primary' },
        ]}
        columns={[
          { key: 'code', header: 'Kod', sortKey: 'code', sortable: true, hideable: true, defaultHidden: true, cell: (r) => <span className="tabular-nums type-muted">#{r.code}</span> },
          {
            key: 'participant', header: 'Katılımcı', sortable: true, sortKey: 'participantName',
            cell: (r) => (
              <div className="leading-tight">
                <span className="type-body-strong">{r.participantName}</span>
                <span className="block tabular-nums type-caption">{maskTC(r.tckn)}</span>
              </div>
            ),
          },
          { key: 'event', header: 'Etkinlik', sortable: true, sortKey: 'eventName', cell: (r) => <span className="type-body-strong">{r.eventName}</span> },
          { key: 'category', header: 'Tür', cell: (r) => <Badge color={r.eventCategoryColor}>{r.eventCategoryName}</Badge> },
          { key: 'date', header: 'Tarih', sortable: true, sortKey: 'eventDate', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDate(r.eventDate)}{r.day ? ` · ${r.day}` : ''}</span> },
          { key: 'session', header: 'Seans', hideable: true, cell: (r) => <span className="type-muted">{r.sessionLabel ?? '—'}</span> },
          { key: 'seat', header: 'Koltuk', hideable: true, cell: (r) => <span className="whitespace-nowrap type-muted">{seatText(r.seatNumber)}</span> },
          { key: 'gender', header: 'Cinsiyet', align: 'center', hideable: true, cell: (r) => <Badge tone="neutral">{GENDER_LABELS[r.gender]}</Badge> },
          { key: 'age', header: 'Yaş', align: 'center', hideable: true, cell: (r) => <span className="tabular-nums type-muted">{r.age}</span> },
          { key: 'phone', header: 'Telefon', hideable: true, cell: (r) => <span className="whitespace-nowrap tabular-nums type-muted">{r.phone ?? '—'}</span> },
          { key: 'email', header: 'E-posta', hideable: true, cell: (r) => <span className="type-muted">{r.email ?? '—'}</span> },
          { key: 'status', header: 'Onay', align: 'center', cell: (r) => (
            <div className="leading-tight">
              <Badge tone={APPLICATION_STATUS_TONE[r.status]}>{APPLICATION_STATUS_LABELS[r.status]}</Badge>
              {r.status === 'rejected' && r.rejectionReason && <span className="mt-0.5 block max-w-48 truncate type-caption" title={r.rejectionReason}>{r.rejectionReason}</span>}
            </div>
          ) },
          { key: 'applied', header: 'Başvuru', sortable: true, sortKey: 'appliedAt', hideable: true, defaultHidden: true, cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDate(r.appliedAt)}</span> },
        ]}
        emptyForm={emptyForm}
        toForm={toForm}
        getFormErrors={(f) => [
          !f.participantId && 'Katılımcı seçimi zorunludur.',
          !f.eventId && 'Etkinlik seçimi zorunludur.',
        ].filter(Boolean) as string[]}
        renderForm={({ form, setForm, mode, editingRow }) => <ApplicationForm form={form} setForm={setForm} mode={mode} editingRow={editingRow} />}
        renderView={(row) => <ApplicationForm form={toForm(row)} setForm={() => {}} mode="edit" editingRow={row} readOnly />}
        deleteConfirm={{ title: 'Başvuruyu Sil', description: 'Bu başvuru kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.' }}
        creatable={can('sessions.approve')}
        canEdit={() => can('sessions.edit')}
        canDelete={() => can('sessions.delete')}
        onCreate={can('sessions.approve') ? (f) => applicationsService.create(f).then(() => { loadSummary() }) : undefined}
        onUpdate={can('sessions.edit') ? (id, f) => applicationsService.update(id, f).then(() => { loadSummary() }) : undefined}
        collapseRowActions
        extraRowActions={(row) => (
          <>
            {canApprove && (
            <IconButton tone="success" title={row.status === 'rejected' ? 'Reddedilmiş başvuru doğrudan onaylanamaz.' : 'Onayla'} disabled={row.status === 'approved' || row.status === 'rejected' || statusPendingId !== null} onClick={() => changeStatus(row.id, 'approved')}>
              <CheckCircle2Icon className="h-4 w-4" />
            </IconButton>
            )}
            {canApprove && (
            <IconButton tone="danger" title="Reddet" disabled={row.status === 'rejected' || statusPendingId !== null} onClick={() => setRejectTarget({ rows: [row] })}>
              <XCircleIcon className="h-4 w-4" />
            </IconButton>
            )}
            <IconButton tone="default" title="Katılım geçmişi" onClick={() => setHistoryId(row.participantId)}>
              <HistoryIcon className="h-4 w-4" />
            </IconButton>
          </>
        )}
      />

      <ApplicantHistoryModal participantId={historyId} onClose={() => setHistoryId(null)} />
      <RejectReasonModal
        open={!!rejectTarget}
        count={rejectTarget?.rows.length}
        onClose={() => setRejectTarget(null)}
        onConfirm={async (reason) => {
          if (!rejectTarget) return
          await bulkSetStatus(rejectTarget.rows, 'rejected', rejectTarget.clear, rejectTarget.refresh, reason)
          setRejectTarget(null)
        }}
      />
    </>
  )
}
