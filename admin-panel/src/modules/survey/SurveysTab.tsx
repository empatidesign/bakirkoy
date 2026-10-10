import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  FileTextIcon,
  CheckCircle2Icon,
  PowerOffIcon,
  MessageSquareIcon,
  BarChart3Icon,
  SmartphoneIcon,
  CopyIcon,
  Trash2Icon,
  WandSparklesIcon,
  TargetIcon,
} from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { SurveyDeleteDialog } from './SurveyDeleteDialog'
import { Badge, Select, FilterField, IconButton, Button, AdminFormShell } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import surveyService from '@/services/survey.service'
import {
  SURVEY_STATUS_LABELS,
  SURVEY_STATUS_OPTIONS,
  SURVEY_STATUS_TONE,
  SURVEY_CATEGORY_OPTIONS,
} from '@/types/survey.types'
import type { Survey, SurveyForm as SurveyFormData, SurveySummary } from '@/types/survey.types'
import { isSurveyQuestionValid } from '@/components/specialized/SurveyBuilder'
import { formatDate } from '@/lib/utils'
import { emptySurveyForm, surveyToForm, todayIso } from './surveyConstants'
import { LayoutTemplateIcon } from 'lucide-react'
import { SurveyForm } from './SurveyForm'
import { SurveyPreviewModal } from './SurveyPreviewModal'
import { SurveySendMessageModal } from './SurveySendMessageModal'
import { SurveyQuotaModal } from './SurveyQuotaModal'
import { SurveyTemplatePickerModal } from './SurveyTemplatePickerModal'
import { SurveyWizardModal } from './SurveyWizardModal'

export const SurveysTab = () => {
  const { can } = useAuth()
  const [, setSearchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [summary, setSummary] = useState<SurveySummary | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null)
  const [deleteSurvey, setDeleteSurvey] = useState<Survey | null>(null)
  const [templateIds, setTemplateIds] = useState<string[] | null>(null)
  const [quotaSurvey, setQuotaSurvey] = useState<Survey | null>(null)
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  const loadSummary = useCallback(() => {
    surveyService.getSummary({}).then(setSummary).catch(() => setSummary(null))
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary])

  const hasActiveFilters = !!statusFilter || !!categoryFilter || !!activeFilter
  const extraParams: Record<string, string> = {}
  if (statusFilter) extraParams.status = statusFilter
  if (categoryFilter) extraParams.category = categoryFilter
  if (activeFilter) extraParams.isActive = activeFilter

  const openAnalytics = (row: Survey) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', 'analizler')
      n.set('surveyId', row.id)
      return n
    })

  const openResponses = (row: Survey) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', 'yanitlar')
      n.set('surveyId', row.id)
      return n
    })

  const duplicate = (row: Survey) =>
    surveyService.duplicate(row.id).then(() => {
      toast.success('Anket kopyalandı.')
      setRefreshSignal((s) => s + 1)
      loadSummary()
    })

  return (
    <>
      <CrudListTemplate<Survey, SurveyFormData>
        icon={FileTextIcon}
        title="Anketler"
        subtitle="Anketleri oluşturun, sorularını düzenleyin ve yanıtları izleyin"
        resourceName="Anket"
        listTitle="Anket Listesi"
        searchPlaceholder="Anket adı veya açıklama ara..."
        service={{
          getList: (p) => surveyService.getList(p),
          // Kullanıcı isteği (2026-09-01): anket silme tek tıkla yapılamaz. Şablonun
          // varsayılan silme akışı kapatıldı; satır aksiyonundaki çöp kutusu, yazılı onay
          // isteyen ve etki özetini gösteren SurveyDeleteDialog'u açar.
          remove: undefined,
          toggleStatus: can('survey.edit') ? (id) => surveyService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        selectable
        bulkActions={(rows) => (
          <>
            {can('survey.edit') && (
              <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateIds(rows.map((r) => r.id))}>SMS / Bildirim Gönder</Button>
            )}
          </>
        )}
        viewable
        drawerWidth={680}
        defaultSort={{ key: 'createdAt', dir: 'desc' }}
        refreshSignal={refreshSignal}
        onMutated={loadSummary}
        extraParams={extraParams}
        filterColumns={3}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => { setStatusFilter(''); setCategoryFilter(''); setActiveFilter('') }}
        renderFilters={() => (
          <>
            <FilterField label="Durum">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                {SURVEY_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Kategori">
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Tüm Kategoriler</option>
                {SURVEY_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Yayın">
              <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="">Tüm Yayın Durumları</option>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </Select>
            </FilterField>
          </>
        )}
        stats={() => [
          { label: 'Toplam Anket', value: summary?.total ?? 0, icon: FileTextIcon, accent: 'blue' },
          { label: 'Aktif', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif', value: summary?.passive ?? 0, icon: PowerOffIcon, accent: 'violet' },
          { label: 'Toplam Yanıt', value: summary?.totalResponses ?? 0, icon: MessageSquareIcon, accent: 'orange' },
        ]}
        columns={[
          {
            key: 'title', header: 'Anket Adı', sortable: true, sortKey: 'title',
            cell: (r) => (
              <div className="leading-tight">
                <div className="flex items-center gap-1.5">
                  <span className="type-body-strong">{r.title}</span>
                  {r.isRequired && <Badge tone="danger">Zorunlu</Badge>}
                  {r.sourceType && <Badge tone="info">{r.sourceType === 'Event' ? 'Etkinlik' : r.sourceType === 'Travel' ? 'Gezi' : r.sourceType === 'Library' ? 'Kütüphane' : 'Tesis'}</Badge>}
                </div>
                <span className="block type-caption line-clamp-1">{r.description}</span>
              </div>
            ),
          },
          { key: 'category', header: 'Kategori', cell: (r) => (r.category ? <Badge tone="neutral">{r.category}</Badge> : <span className="type-muted">—</span>) },
          { key: 'status', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? SURVEY_STATUS_TONE[r.status] : 'neutral'}>{r.isActive ? SURVEY_STATUS_LABELS[r.status] : 'Pasif'}</Badge> },
          { key: 'questionCount', header: 'Soru', align: 'center', cell: (r) => <span className="tabular-nums">{r.questionCount}</span> },
          { key: 'totalResponses', header: 'Yanıt', align: 'center', sortable: true, sortKey: 'totalResponses', cell: (r) => <span className="tabular-nums">{r.totalResponses}</span> },
          { key: 'createdAt', header: 'Oluşturma', align: 'center', sortable: true, sortKey: 'createdAt', cell: (r) => <span className="whitespace-nowrap type-muted">{r.createdAt ? formatDate(r.createdAt) : '—'}</span> },
          { key: 'estimatedDuration', header: 'Süre', align: 'center', cell: (r) => <span className="tabular-nums type-muted">{r.estimatedDuration} dk</span> },
        ]}
        extraHeaderActions={
          <>
            {/* Kullanıcı isteği (2026-09-01): tek sayfada soru+şık kuran anket sihirbazı. */}
            {can('survey.create') && (
              <Button variant="outline" size="sm" iconLeft={<WandSparklesIcon className="h-4 w-4" />} onClick={() => setWizardOpen(true)}>
                Anket Sihirbazı
              </Button>
            )}
            <Button variant="outline" size="sm" iconLeft={<LayoutTemplateIcon className="h-4 w-4" />} onClick={() => setTemplatePickerOpen(true)}>
              Şablondan Oluştur
            </Button>
          </>
        }
        emptyForm={emptySurveyForm()}
        toForm={surveyToForm}
        getFormErrors={(f) => [
          !f.title.trim() && 'Anket başlığı zorunludur.',
          f.questions.length === 0 && 'En az bir soru eklenmelidir.',
          !f.questions.every(isSurveyQuestionValid) && 'Tüm soruların bilgileri eksiksiz doldurulmalıdır.',
          (!!f.startDate && f.startDate < todayIso()) && 'Başlangıç tarihi geçmiş bir tarih olamaz.',
          (!!f.startDate && !!f.endDate && f.startDate > f.endDate) && 'Bitiş tarihi başlangıç tarihinden önce olamaz.',
        ].filter(Boolean) as string[]}
        formShell
        renderForm={({ form, setForm, mode, editingRow }) => (
          <AdminFormShell
            icon={FileTextIcon}
            title={mode === 'edit' ? 'Anket Düzenle' : 'Yeni Anket Ekle'}
            subtitle="Anket bilgileri, sorular ve yayın ayarlarını yönetin"
            badge={editingRow ? (editingRow.isActive ? 'Aktif' : 'Pasif') : 'Anket'}
            tone="violet"
          >
            <SurveyForm form={form} setForm={setForm} mode={mode} editingRow={editingRow} />
          </AdminFormShell>
        )}
        renderView={(row) => (
          <AdminFormShell
            icon={FileTextIcon}
            title="Anket Görüntüle"
            subtitle="Anket bilgileri, sorular ve yayın ayarları"
            badge={row.isActive ? 'Aktif' : 'Pasif'}
            tone="violet"
          >
            <SurveyForm form={surveyToForm(row)} setForm={() => {}} mode="edit" editingRow={row} readOnly />
          </AdminFormShell>
        )}
        isActive={(r) => r.isActive}
        toggleConfirm={(_row, willActivate) => ({
          title: willActivate ? 'Anketi Yayınla' : 'Anketi Pasife Al',
          description: willActivate
            ? 'Anket aktif edilecek ve yanıt toplamaya açılacak.'
            : 'Anket pasife alınacak ve yeni yanıt alınamayacak.',
        })}
        creatable={can('survey.create')}
        canEdit={() => can('survey.edit')}
        canDelete={() => false}
        onCreate={can('survey.create') ? (f) => surveyService.create(f).then(() => { loadSummary() }) : undefined}
        onUpdate={can('survey.edit') ? (id, f) => surveyService.update(id, f).then(() => { loadSummary() }) : undefined}
        collapseRowActions
        extraRowActions={(row) => (
          <>
            <IconButton tone="primary" title="Analitik" onClick={() => openAnalytics(row)}>
              <BarChart3Icon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="primary" title="Bireysel Yanıtlar" onClick={() => openResponses(row)}>
              <MessageSquareIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Önizle" onClick={() => setPreviewSurvey(row)}>
              <SmartphoneIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Kopyala" onClick={() => duplicate(row)}>
              <CopyIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Kota Yönetimi" onClick={() => setQuotaSurvey(row)}>
              <TargetIcon className="h-4 w-4" />
            </IconButton>
            {can('survey.delete') && (
              <IconButton tone="danger" title="Sil" onClick={() => setDeleteSurvey(row)}>
                <Trash2Icon className="h-4 w-4" />
              </IconButton>
            )}
          </>
        )}
        emptyTitle="Henüz anket yok"
        emptyDescription="İlk anketinizi oluşturmak için “Anket Ekle” düğmesine basın."
      />

      <SurveyDeleteDialog
        survey={deleteSurvey}
        onClose={() => setDeleteSurvey(null)}
        onDeleted={() => { setRefreshSignal((n) => n + 1); loadSummary() }}
      />

      {previewSurvey && (
        <SurveyPreviewModal survey={previewSurvey} open onClose={() => setPreviewSurvey(null)} />
      )}

      <SurveySendMessageModal open={!!templateIds} ids={templateIds ?? []} onClose={() => setTemplateIds(null)} />

      {quotaSurvey && (
        <SurveyQuotaModal surveyId={quotaSurvey.id} surveyTitle={quotaSurvey.title} onClose={() => setQuotaSurvey(null)} />
      )}

      <SurveyWizardModal
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCreated={() => { setRefreshSignal((n) => n + 1); loadSummary() }}
      />

      <SurveyTemplatePickerModal
        open={templatePickerOpen}
        onClose={() => setTemplatePickerOpen(false)}
        onCreated={() => { setRefreshSignal((s) => s + 1); loadSummary() }}
      />
    </>
  )
}
