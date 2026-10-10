import { useCallback, useEffect, useState } from 'react'
import {
  FileTextIcon, CheckCircle2Icon, ClockIcon, XCircleIcon, MessageSquareIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Select, Combobox, MultiSelect, FilterField, DatePicker, IconButton, Button, Modal, Field, Textarea } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import { BroadcastModal } from '@/components/specialized/BroadcastModal'
import sedaService from '@/services/seda.service'
import { SedaApplicationForm } from './SedaApplicationForm'
import { emptySedaApplicationForm, sedaApplicationToForm, SEDA_EDUCATION_TYPE_FALLBACK_OPTIONS, SEDA_GRADE_FALLBACK_OPTIONS } from './sedaConstants'
import type { SelectOption } from '@/types/common'
import type { SedaApplication, SedaApplicationForm as SedaApplicationFormData, SedaApplicationStatus, SedaApplicationSummary } from '@/types/seda.types'
import {
  SEDA_APPLICATION_STATUS_LABELS, SEDA_APPLICATION_STATUS_TONE, SEDA_APPLICATION_STATUS_OPTIONS,
} from '@/types/seda.types'
import { maskTC } from '@/lib/utils'
import excelIcon from '@/assets/icons/excel.png'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')

interface Props {
  scope?: { schoolName?: string; status?: string }
  embedded?: boolean
}

export const SedaApplicationsTab = ({ scope, embedded }: Props = {}) => {
  const { can } = useAuth()
  const lockedSchool = scope?.schoolName ?? ''
  const lockedStatus = scope?.status ?? ''

  const [statusFilter, setStatusFilter] = useState('')
  const [educationTypeFilter, setEducationTypeFilter] = useState('')
  const [gradeFilters, setGradeFilters] = useState<string[]>([])
  const [examCenterFilter, setExamCenterFilter] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [startFilter, setStartFilter] = useState('')
  const [endFilter, setEndFilter] = useState('')
  const [summary, setSummary] = useState<SedaApplicationSummary | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [broadcastIds, setBroadcastIds] = useState<string[] | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ ids: string[]; clear?: () => void; refresh?: () => void } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  const [gradeOptions, setGradeOptions] = useState<SelectOption[]>(SEDA_GRADE_FALLBACK_OPTIONS)
  const [educationTypeOptions, setEducationTypeOptions] = useState<SelectOption[]>(SEDA_EDUCATION_TYPE_FALLBACK_OPTIONS)
  const [examCenterOptions, setExamCenterOptions] = useState<SelectOption[]>([])
  const [schoolOptions, setSchoolOptions] = useState<SelectOption[]>([])

  useEffect(() => {
    sedaService.getDefinitionOptions('grade').then((o) => o?.length && setGradeOptions(o)).catch(() => undefined)
    sedaService.getDefinitionOptions('education-type').then((o) => o?.length && setEducationTypeOptions(o)).catch(() => undefined)
    sedaService.getDefinitionOptions('exam-center').then((o) => setExamCenterOptions(o ?? [])).catch(() => setExamCenterOptions([]))
    sedaService.getSchoolOptions().then((o) => setSchoolOptions(o ?? [])).catch(() => setSchoolOptions([]))
  }, [])

  const loadSummary = useCallback(() => {
    const p: Record<string, unknown> = {}
    if (lockedSchool) p.schoolName = lockedSchool
    sedaService.getApplicationSummary(p).then(setSummary).catch(() => setSummary(null))
  }, [lockedSchool])
  useEffect(() => { loadSummary() }, [loadSummary])

  const changeStatus = async (id: string, status: SedaApplicationStatus) => {
    try {
      await sedaService.setApplicationStatus(id, status)
      toast.success(status === 'approved' ? 'Başvuru onaylandı.' : 'Başvuru reddedildi.')
      setRefreshSignal((s) => s + 1)
      loadSummary()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? (status === 'approved' ? 'Başvuru onaylanamadı.' : 'Başvuru reddedilemedi.'))
    }
  }

  const bulkChangeStatus = async (rows: SedaApplication[], status: SedaApplicationStatus, clear: () => void, refresh: () => void) => {
    setBulkBusy(true)
    try {
      const targets = rows.filter((r) => r.status !== status)
      const results = await Promise.allSettled(targets.map((r) => sedaService.setApplicationStatus(r.id, status)))
      const ok = results.filter((x) => x.status === 'fulfilled').length
      if (ok) toast.success(`${ok} başvuru ${status === 'approved' ? 'onaylandı' : 'reddedildi'}.`)
      if (results.length - ok > 0) toast.warning(`${results.length - ok} başvuru işlenemedi.`)
      clear(); refresh(); loadSummary()
    } finally {
      setBulkBusy(false)
    }
  }

  const openReject = (ids: string[], clear?: () => void, refresh?: () => void) => {
    setRejectReason('')
    setRejectTarget({ ids, clear, refresh })
  }

  const confirmReject = async () => {
    if (!rejectTarget || rejecting) return
    setRejecting(true)
    try {
      const results = await Promise.allSettled(
        rejectTarget.ids.map((id) => sedaService.setApplicationStatus(id, 'rejected', rejectReason)),
      )
      const ok = results.filter((x) => x.status === 'fulfilled').length
      if (ok) toast.success(ok === 1 ? 'Başvuru reddedildi.' : `${ok} başvuru reddedildi.`)
      if (results.length - ok > 0) toast.warning(`${results.length - ok} başvuru işlenemedi.`)
      rejectTarget.clear?.()
      rejectTarget.refresh?.()
      setRefreshSignal((s) => s + 1)
      loadSummary()
      setRejectTarget(null)
    } finally {
      setRejecting(false)
    }
  }

  const schoolParam = lockedSchool || schoolFilter
  const hasActiveFilters = !!statusFilter || !!educationTypeFilter || gradeFilters.length > 0 || !!examCenterFilter || (!lockedSchool && !!schoolFilter) || !!startFilter || !!endFilter

  const extraParams: Record<string, string> = {}
  if (schoolParam) extraParams.schoolName = schoolParam
  if (lockedStatus || statusFilter) extraParams.status = lockedStatus || statusFilter
  if (educationTypeFilter) extraParams.educationType = educationTypeFilter
  if (gradeFilters.length > 0) extraParams.grades = gradeFilters.join(',')
  if (examCenterFilter) extraParams.examCenterName = examCenterFilter
  if (startFilter) extraParams.startDate = startFilter
  if (endFilter) extraParams.endDate = endFilter

  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const { blob, fileName } = await sedaService.exportApplicationsExcel(extraParams)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Excel dosyası indirildi.')
    } catch {
      toast.error('Excel dosyası indirilemedi. Lütfen tekrar deneyin.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
    <CrudListTemplate<SedaApplication, SedaApplicationFormData>
      icon={FileTextIcon}
      title="Başvurular"
      subtitle="Seda Eğitim başvurularını görüntüleyin, onaylayın ve yönetin"
      resourceName="Başvuru"
      extraHeaderActions={
        <IconButton
          onClick={handleExport}
          disabled={exporting || !can('seda.export')}
          title={can('seda.export') ? 'Excel İndir' : 'Dışa aktarma yetkiniz yok'}
        >
          <img src={excelIcon} alt="Excel" className="h-6 w-6" />
        </IconButton>
      }
      listTitle="Başvuru Listesi"
      searchPlaceholder="Ad, soyad, TC, başvuru no veya okul ara..."
      service={{
        getList: (p) => sedaService.getApplications(p),
        remove: can('seda.delete') ? (id) => sedaService.deleteApplication(id) : undefined,
      }}
      rowKey={(r) => r.id}
      selectable
      bulkActions={(rows, { clear, refresh }) => (
        <>
          <Button variant="outline" size="sm" className="text-success hover:bg-success-soft" isLoading={bulkBusy}
            disabled={bulkBusy || !can('seda.edit')}
            title={can('seda.edit') ? undefined : 'Onaylama yetkiniz yok'}
            onClick={() => bulkChangeStatus(rows, 'approved', clear, refresh)}>
            <CheckCircle2Icon className="h-4 w-4" /> Toplu Onayla
          </Button>
          <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" isLoading={bulkBusy}
            disabled={bulkBusy || !can('seda.edit')}
            title={can('seda.edit') ? undefined : 'Reddetme yetkiniz yok'}
            onClick={() => openReject(rows.filter((r) => r.status !== 'rejected').map((r) => r.id), clear, refresh)}>
            <XCircleIcon className="h-4 w-4" /> Toplu Reddet
          </Button>
          <Button variant="outline" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setBroadcastIds(rows.map((r) => r.id))}>
            SMS / Bildirim Gönder
          </Button>
        </>
      )}
      viewable={!embedded}
      embedded={embedded}
      drawerWidth={640}
      defaultSort={{ key: 'appliedAt', dir: 'desc' }}
      refreshSignal={refreshSignal}
      onMutated={loadSummary}
      extraParams={extraParams}
      filterColumns={4}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={() => { setStatusFilter(''); setEducationTypeFilter(''); setGradeFilters([]); setExamCenterFilter(''); setSchoolFilter(''); setStartFilter(''); setEndFilter('') }}
      renderFilters={() => (
        <>
          <FilterField label="Onay Durumu">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tüm Durumlar</option>
              {SEDA_APPLICATION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Eğitim Türü">
            <Select value={educationTypeFilter} onChange={(e) => setEducationTypeFilter(e.target.value)}>
              <option value="">Tüm Türler</option>
              {educationTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Gelecek Yıl Sınıfı">
            <MultiSelect
              values={gradeFilters}
              onChange={setGradeFilters}
              options={gradeOptions}
              placeholder="Tüm Sınıflar"
              emptyText="Sınıf bulunamadı"
            />
          </FilterField>
          <FilterField label="Sınav Merkezi">
            <Select value={examCenterFilter} onChange={(e) => setExamCenterFilter(e.target.value)}>
              <option value="">Tüm Merkezler</option>
              {examCenterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Okul">
            {lockedSchool ? (
              <Select value="__locked" disabled>
                <option value="__locked">{lockedSchool}</option>
              </Select>
            ) : (
              <Combobox
                value={schoolFilter}
                displayValue={schoolFilter}
                options={schoolOptions}
                onChange={(v) => setSchoolFilter(v)}
                clearable
                placeholder="Tüm Okullar"
                emptyText="Okul bulunamadı"
              />
            )}
          </FilterField>
          <FilterField label="İlk Başvuru Tarihi">
            <DatePicker value={startFilter} max={endFilter || undefined} onChange={setStartFilter} clearable />
          </FilterField>
          <FilterField label="Son Başvuru Tarihi">
            <DatePicker value={endFilter} min={startFilter || undefined} onChange={setEndFilter} clearable />
          </FilterField>
        </>
      )}
      stats={() => [
        { label: 'Toplam Başvuru', value: summary?.total ?? 0, icon: FileTextIcon, accent: 'blue' },
        { label: 'Onaylanan', value: summary?.approved ?? 0, icon: CheckCircle2Icon, accent: 'green' },
        { label: 'Beklemede', value: summary?.pending ?? 0, icon: ClockIcon, accent: 'orange' },
        { label: 'Reddedilen', value: summary?.rejected ?? 0, icon: XCircleIcon, accent: 'violet' },
      ]}
      columns={[
        { key: 'code', header: 'Başvuru No', sortable: true, sortKey: 'code', cell: (r) => <span className="tabular-nums type-muted">{r.code}</span> },
        {
          key: 'student', header: 'Ad Soyad', sortable: true, sortKey: 'studentName',
          cell: (r) => (
            <div className="leading-tight">
              <span className="type-body-strong">{r.studentName} {r.studentSurname}</span>
              <span className="block tabular-nums type-caption">{maskTC(r.tckn)}</span>
            </div>
          ),
        },
        { key: 'school', header: 'Okul', sortable: true, sortKey: 'schoolName', cell: (r) => <span className="type-muted">{r.schoolName || '—'}</span> },
        { key: 'grade', header: 'Sınıf', align: 'center', cell: (r) => <span className="tabular-nums">{r.nextYearGrade ? `${r.nextYearGrade}.` : '—'}</span> },
        { key: 'educationType', header: 'Eğitim Türü', cell: (r) => <span className="type-muted">{r.educationType || '—'}</span> },
        { key: 'examCenter', header: 'Sınav Merkezi', hideable: true, cell: (r) => <span className="type-muted">{r.examCenterName || '—'}</span> },
        { key: 'applied', header: 'Başvuru Tarihi', sortable: true, sortKey: 'appliedAt', cell: (r) => <span className="whitespace-nowrap type-muted">{fmtDate(r.appliedAt)}</span> },
        { key: 'status', header: 'Durum', align: 'center', cell: (r) => <Badge tone={SEDA_APPLICATION_STATUS_TONE[r.status]}>{SEDA_APPLICATION_STATUS_LABELS[r.status]}</Badge> },
      ]}
      emptyForm={emptySedaApplicationForm()}
      toForm={sedaApplicationToForm}
      getFormErrors={(f) => [
        !f.studentName.trim() && 'Öğrenci adı zorunludur.',
        !f.studentSurname.trim() && 'Öğrenci soyadı zorunludur.',
        f.tckn.length !== 11 && 'TC Kimlik Numarası 11 haneli olmalıdır.',
        !f.schoolName.trim() && 'Okul adı zorunludur.',
        !f.nextYearGrade && 'Gelecek yıl sınıf seçimi zorunludur.',
        !f.educationType && 'Eğitim türü seçimi zorunludur.',
        f.parentPhone.length < 10 && 'Geçerli bir veli telefon numarası giriniz.',
      ].filter(Boolean) as string[]}
      renderForm={({ form, setForm, mode, editingRow }) => <SedaApplicationForm form={form} setForm={setForm} mode={mode} editingRow={editingRow} />}
      renderView={(row) => <SedaApplicationForm form={sedaApplicationToForm(row)} setForm={() => {}} mode="edit" editingRow={row} readOnly />}
      deleteConfirm={{ title: 'Başvuruyu Sil', description: 'Bu başvuru kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.' }}
      creatable={can('seda.create')}
      canEdit={() => can('seda.edit')}
      canDelete={() => can('seda.delete')}
      onCreate={can('seda.create') ? (f) => sedaService.createApplication(f).then(() => { loadSummary() }) : undefined}
      onUpdate={can('seda.edit') ? (id, f) => sedaService.updateApplication(id, f).then(() => { loadSummary() }) : undefined}
      extraRowActions={(row) => (
        <>
          <IconButton
            tone="success"
            title={can('seda.edit') ? 'Onayla' : 'Onaylama yetkiniz yok'}
            disabled={row.status === 'approved' || !can('seda.edit')}
            onClick={() => changeStatus(row.id, 'approved')}
          >
            <CheckCircle2Icon className="h-4 w-4" />
          </IconButton>
          <IconButton
            tone="danger"
            title={can('seda.edit') ? 'Reddet' : 'Reddetme yetkiniz yok'}
            disabled={row.status === 'rejected' || !can('seda.edit')}
            onClick={() => openReject([row.id])}
          >
            <XCircleIcon className="h-4 w-4" />
          </IconButton>
        </>
      )}
    />

    <BroadcastModal open={!!broadcastIds} target="sedaApplication" ids={broadcastIds ?? []} count={broadcastIds?.length ?? 0} onClose={() => setBroadcastIds(null)} />

    <Modal
      open={!!rejectTarget}
      onClose={() => { if (!rejecting) setRejectTarget(null) }}
      title={rejectTarget && rejectTarget.ids.length > 1 ? `${rejectTarget.ids.length} Başvuruyu Reddet` : 'Başvuruyu Reddet'}
      width={480}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRejectTarget(null)} disabled={rejecting}>İptal</Button>
          <Button variant="danger" isLoading={rejecting} onClick={() => void confirmReject()}>Reddet</Button>
        </div>
      }
    >
      <div className="space-y-3 p-5">
        <p className="type-body text-foreground-muted">
          Gerekçe vatandaşa bildirimde gösterilir. Boş bırakılırsa gerekçesiz red bildirimi gider.
        </p>
        <Field label="Red Gerekçesi">
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Örn. Başvuru koşulları sağlanmıyor..."
            autoFocus
          />
        </Field>
      </div>
    </Modal>
    </>
  )
}
