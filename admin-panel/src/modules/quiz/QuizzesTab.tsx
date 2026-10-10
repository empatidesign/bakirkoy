import { useCallback, useEffect, useState } from 'react'
import {
  TrophyIcon, CheckCircle2Icon, PowerOffIcon, UsersIcon, BarChart3Icon,
  ListChecksIcon, MessageSquareIcon, SmartphoneIcon, EyeIcon,
} from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Select, FilterField, DrilldownCount, IconButton, AdminFormShell, Button } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import quizService from '@/services/quiz.service'
import {
  QUIZ_STATUS_LABELS, QUIZ_STATUS_OPTIONS, QUIZ_STATUS_TONE,
} from '@/types/quiz.types'
import type { Quiz, QuizForm as QuizFormData, QuizSummary } from '@/types/quiz.types'
import type { SelectOption } from '@/types/common'
import quizCategoryService from '@/services/quizCategory.service'
import { formatDate } from '@/lib/utils'
import { QuizForm } from './QuizForm'
import { QuizQuestionsModal } from './QuizQuestionsModal'
import { QuizParticipantsTable } from './QuizParticipantsTable'
import { QuizDetailModal } from './QuizDetailModal'
import { QuizMobilePreviewModal } from './QuizMobilePreviewModal'
import { emptyQuizForm, quizToForm } from './quizConstants'
import { QuizSendMessageModal } from './QuizSendMessageModal'

export const QuizzesTab = () => {
  const { can } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [summary, setSummary] = useState<QuizSummary | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [questionsQuiz, setQuestionsQuiz] = useState<Quiz | null>(null)
  const [detailQuiz, setDetailQuiz] = useState<Quiz | null>(null)
  const [mobilePreviewQuiz, setMobilePreviewQuiz] = useState<Quiz | null>(null)
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([])
  const [templateIds, setTemplateIds] = useState<string[] | null>(null)

  const loadSummary = useCallback(() => {
    quizService.getSummary({}).then(setSummary).catch(() => setSummary(null))
  }, [])
  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => {
    quizCategoryService.getOptions().then((o) => setCategoryOptions(o ?? [])).catch(() => setCategoryOptions([]))
  }, [])

  const hasActiveFilters = !!statusFilter || !!categoryFilter || !!activeFilter
  const extraParams: Record<string, string> = {}
  if (statusFilter) extraParams.status = statusFilter
  if (categoryFilter) extraParams.categoryId = categoryFilter
  if (activeFilter) extraParams.isActive = activeFilter

  const refreshAfterQuestions = () => {
    setRefreshSignal((s) => s + 1)
    loadSummary()
  }

  return (
    <>
      <CrudListTemplate<Quiz, QuizFormData>
        icon={TrophyIcon}
        title="Yarışmalar"
        subtitle="Bilgi yarışmalarını oluşturun, sorularını yönetin ve katılımları izleyin"
        resourceName="Yarışma"
        listTitle="Yarışma Listesi"
        searchPlaceholder="Yarışma başlığı veya açıklama ara..."
        service={{
          getList: (p) => quizService.getList(p),
          remove: can('quiz.delete') ? (id) => quizService.archive(id) : undefined,
          toggleStatus: can('quiz.edit') ? (id) => quizService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        selectable
        bulkActions={(rows) => (
          <>
            {can('quiz.edit') && (
              <Button variant="primary" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setTemplateIds(rows.map((r) => r.id))}>SMS / Bildirim Gönder</Button>
            )}
          </>
        )}
        viewable
        drawerWidth={620}
        defaultSort={{ key: 'startDate', dir: 'desc' }}
        refreshSignal={refreshSignal}
        onMutated={loadSummary}
        extraParams={extraParams}
        filterColumns={3}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => { setStatusFilter(''); setCategoryFilter(''); setActiveFilter('') }}
        renderFilters={() => (
          <>
            <FilterField label="Aşama">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Aşamalar</option>
                {QUIZ_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Kategori">
              <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="">Tüm Kategoriler</option>
                {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Durum">
              <Select value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                <option value="true">Aktif</option>
                <option value="false">Pasif</option>
              </Select>
            </FilterField>
          </>
        )}
        stats={() => [
          { label: 'Toplam Yarışma', value: summary?.total ?? 0, icon: TrophyIcon, accent: 'blue' },
          { label: 'Aktif', value: summary?.active ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif', value: summary?.passive ?? 0, icon: PowerOffIcon, accent: 'violet' },
          { label: 'Toplam Katılım', value: summary?.totalParticipants ?? 0, icon: UsersIcon, accent: 'orange' },
          { label: 'Ortalama Puan', value: Math.round(summary?.averageScore ?? 0), icon: BarChart3Icon, accent: 'primary' },
        ]}
        columns={[
          {
            key: 'title', header: 'Başlık', sortable: true, sortKey: 'title',
            cell: (r) => (
              <button
                type="button"
                onClick={() => setDetailQuiz(r)}
                className="text-left group flex flex-col items-start focus:outline-none"
                title="Detayları görüntülemek için tıklayın"
              >
                <span className="type-body-strong group-hover:text-primary transition-colors cursor-pointer">{r.title}</span>
                <span className="block type-caption line-clamp-1 text-foreground-muted group-hover:text-foreground-default transition-colors">{r.description}</span>
              </button>
            ),
          },
          { key: 'category', header: 'Kategori', cell: (r) => (r.categoryName ? <Badge color={r.categoryColor}>{r.categoryName}</Badge> : <span className="type-muted">—</span>) },
          {
            key: 'dates', header: 'Tarih Aralığı', sortable: true, sortKey: 'startDate',
            cell: (r) => <span className="whitespace-nowrap type-muted">{formatDate(r.startDate)} – {formatDate(r.endDate)}</span>,
          },
          { key: 'questionCount', header: 'Soru', align: 'center', cell: (r) => <span className="tabular-nums">{r.questionCount}</span> },
          {
            key: 'participants', header: 'Katılımcı', align: 'center',
            cell: (r) => (
              <DrilldownCount count={r.participantCount} title="Katılımcılar" subtitle={r.title} icon={UsersIcon}>
                <QuizParticipantsTable quiz={r} />
              </DrilldownCount>
            ),
          },
          { key: 'status', header: 'Aşama', align: 'center', cell: (r) => <Badge tone={QUIZ_STATUS_TONE[r.status]}>{QUIZ_STATUS_LABELS[r.status]}</Badge> },
          { key: 'isActive', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
        ]}
        emptyForm={emptyQuizForm()}
        toForm={quizToForm}
        getFormErrors={(f) => [
          !f.title.trim() && 'Yarışma başlığı zorunludur.',
          !f.description.trim() && 'Açıklama zorunludur.',
          !f.categoryId && 'Kategori seçimi zorunludur.',
          !f.startDate && 'Başlangıç tarihi zorunludur.',
          !f.endDate && 'Bitiş tarihi zorunludur.',
          (!!f.startDate && !!f.endDate && f.startDate > f.endDate) && 'Bitiş tarihi başlangıç tarihinden önce olamaz.',
          f.questionCount <= 0 && 'Soru sayısı en az 1 olmalıdır.',
          f.perQuestionTimeLimit <= 0 && 'Soru başına süre en az 1 olmalıdır.',
        ].filter(Boolean) as string[]}
        formShell
        renderForm={({ form, setForm, mode, editingRow }) => (
          <AdminFormShell
            icon={TrophyIcon}
            title={mode === 'edit' ? 'Yarışma Düzenle' : 'Yeni Yarışma Ekle'}
            subtitle="Yarışma bilgileri, tarihleri, kategori ve süre ayarlarını yönetin"
            badge={editingRow ? QUIZ_STATUS_LABELS[editingRow.status] : 'Yarışma'}
            tone="violet"
          >
            <QuizForm form={form} setForm={setForm} mode={mode} editingRow={editingRow} />
          </AdminFormShell>
        )}
        renderView={(row) => (
          <AdminFormShell
            icon={TrophyIcon}
            title="Yarışma Görüntüle"
            subtitle="Yarışma bilgileri ve katılım ayarları"
            badge={QUIZ_STATUS_LABELS[row.status]}
            tone="violet"
          >
            <QuizForm form={quizToForm(row)} setForm={() => {}} mode="edit" editingRow={row} readOnly />
          </AdminFormShell>
        )}
        deleteConfirm={{ title: 'Yarışmayı Arşivle', description: 'Yarışma arşive taşınacak. Arşiv sekmesinden geri alabilirsiniz.' }}
        isActive={(r) => r.isActive}
        toggleConfirm={(_row, willActivate) => ({
          title: willActivate ? 'Yarışmayı Aktifleştir' : 'Yarışmayı Pasife Al',
          description: willActivate
            ? 'Yarışma aktif edilecek ve katılıma açılabilecek.'
            : 'Yarışma pasife alınacak ve katılıma kapanacak.',
        })}
        creatable={can('quiz.create')}
        canEdit={() => can('quiz.edit')}
        canDelete={() => can('quiz.delete')}
        onCreate={can('quiz.create') ? (f) => quizService.create(f).then(() => { loadSummary() }) : undefined}
        onUpdate={can('quiz.edit') ? (id, f) => quizService.update(id, f).then(() => { loadSummary() }) : undefined}
        extraRowActions={(row) => (
          <>
            <IconButton tone="default" title="Detay Görüntüle" onClick={() => setDetailQuiz(row)}>
              <EyeIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Mobil Görünüm" onClick={() => setMobilePreviewQuiz(row)}>
              <SmartphoneIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="primary" title="Sorular" onClick={() => setQuestionsQuiz(row)}>
              <ListChecksIcon className="h-4 w-4" />
            </IconButton>
          </>
        )}
        emptyTitle="Henüz yarışma yok"
        emptyDescription="İlk bilgi yarışmanızı oluşturmak için “Yarışma Ekle” düğmesine basın."
      />

      {/* DETAIL MODAL */}
      <QuizDetailModal
        quiz={detailQuiz}
        open={detailQuiz !== null}
        onClose={() => setDetailQuiz(null)}
        onOpenMobilePreview={(q) => setMobilePreviewQuiz(q)}
        onOpenQuestions={(q) => setQuestionsQuiz(q)}
        onOpenParticipants={() => {}}
        canEdit={can('quiz.edit')}
      />

      {/* MOBILE PREVIEW MODAL */}
      <QuizMobilePreviewModal
        quiz={mobilePreviewQuiz}
        open={mobilePreviewQuiz !== null}
        onClose={() => setMobilePreviewQuiz(null)}
        onOpenQuestions={() => {
          if (mobilePreviewQuiz) setQuestionsQuiz(mobilePreviewQuiz)
        }}
      />

      {questionsQuiz && (
        <QuizQuestionsModal
          quiz={questionsQuiz}
          open
          onClose={() => setQuestionsQuiz(null)}
          onSaved={refreshAfterQuestions}
        />
      )}

      <QuizSendMessageModal open={!!templateIds} ids={templateIds ?? []} targetKind="quiz" onClose={() => setTemplateIds(null)} />
    </>
  )
}
