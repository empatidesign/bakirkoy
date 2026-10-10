import { useEffect, useState } from 'react'
import {
  TrophyIcon, SearchIcon, PowerIcon, PowerOffIcon, Trash2Icon,
  UsersIcon, ZapIcon, CalendarIcon, CheckCircle2Icon, EyeIcon,
  SmartphoneIcon, ListChecksIcon, PencilIcon, ArchiveIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Input, Modal, Badge, Button, DataTable, EmptyState, ConfirmModal,
  Drawer, AdminFormShell, RowActions, type DataTableColumn,
} from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import quizService from '@/services/quiz.service'
import type { Quiz, QuizStatus, QuizForm as QuizFormData } from '@/types/quiz.types'
import { QUIZ_STATUS_LABELS } from '@/types/quiz.types'
import { formatDate } from '@/lib/utils'
import { QuizParticipantsTable } from './QuizParticipantsTable'
import { QuizDetailModal } from './QuizDetailModal'
import { QuizMobilePreviewModal } from './QuizMobilePreviewModal'
import { QuizQuestionsModal } from './QuizQuestionsModal'
import { QuizForm } from './QuizForm'
import { emptyQuizForm, quizToForm } from './quizConstants'

interface Props { status?: QuizStatus }

const STATUS_CFG = {
  ongoing: { icon: ZapIcon, label: 'Devam Ediyor', tone: 'success' as const },
  upcoming: { icon: CalendarIcon, label: 'Yakında', tone: 'info' as const },
  completed: { icon: CheckCircle2Icon, label: 'Tamamlandı', tone: 'neutral' as const },
}

export const QuizBrowseTab = ({ status }: Props) => {
  const { can } = useAuth()
  const [rows, setRows] = useState<Quiz[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [reload, setReload] = useState(0)

  // Interactive Modals
  const [detailQuiz, setDetailQuiz] = useState<Quiz | null>(null)
  const [mobilePreviewQuiz, setMobilePreviewQuiz] = useState<Quiz | null>(null)
  const [questionsQuiz, setQuestionsQuiz] = useState<Quiz | null>(null)
  const [participantsQuiz, setParticipantsQuiz] = useState<Quiz | null>(null)

  // Editing Drawer
  const [editQuiz, setEditQuiz] = useState<Quiz | null>(null)
  const [editFormData, setEditFormData] = useState<QuizFormData>(emptyQuizForm())
  const [editSaving, setEditSaving] = useState(false)

  // Single Item Actions
  const [archiveTarget, setArchiveTarget] = useState<Quiz | null>(null)
  const [hardDeleteTarget, setHardDeleteTarget] = useState<Quiz | null>(null)
  const [actionRunning, setActionRunning] = useState(false)

  // Bulk Operations
  const [bulkType, setBulkType] = useState<'activate' | 'deactivate' | 'delete' | null>(null)
  const [bulkRunning, setBulkRunning] = useState(false)

  const refresh = () => setReload((r) => r + 1)

  useEffect(() => { setPage(1) }, [status])

  useEffect(() => {
    const h = setTimeout(() => {
      setLoading(true)
      quizService
        .getList({ page, limit, search: search || undefined, status, sort: 'startDate', order: 'desc' })
        .then((r) => { setRows(r.items); setTotal(r.total); setSelected(new Set()) })
        .catch(() => { setRows([]); setTotal(0) })
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(h)
  }, [page, limit, search, status, reload])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  const selectedRows = rows.filter((r) => selected.has(r.id))
  const targetsFor = (type: 'activate' | 'deactivate' | 'delete') => {
    if (type === 'delete') return selectedRows
    return selectedRows.filter((r) => (type === 'activate' ? !r.isActive : r.isActive))
  }

  const handleOpenEdit = (q: Quiz) => {
    setEditQuiz(q)
    setEditFormData(quizToForm(q))
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editQuiz) return
    if (!editFormData.title.trim()) {
      toast.error('Yarışma başlığı zorunludur.')
      return
    }
    setEditSaving(true)
    try {
      await quizService.update(editQuiz.id, editFormData)
      toast.success('Yarışma başarıyla güncellendi.')
      setEditQuiz(null)
      refresh()
    } catch {
      toast.error('Yarışma güncellenirken bir hata oluştu.')
    } finally {
      setEditSaving(false)
    }
  }

  const handleToggleStatus = async (q: Quiz) => {
    try {
      await quizService.toggleStatus(q.id)
      toast.success(q.isActive ? 'Yarışma pasife alındı.' : 'Yarışma aktif edildi.')
      refresh()
    } catch {
      toast.error('Yarışma durumu değiştirilemedi.')
    }
  }

  const handleArchive = async () => {
    if (!archiveTarget || actionRunning) return
    setActionRunning(true)
    try {
      await quizService.archive(archiveTarget.id)
      toast.success('Yarışma arşive taşındı.')
      setArchiveTarget(null)
      refresh()
    } catch {
      toast.error('Yarışma arşivlenemedi.')
    } finally {
      setActionRunning(false)
    }
  }

  const handleHardDelete = async () => {
    if (!hardDeleteTarget || actionRunning) return
    setActionRunning(true)
    try {
      await quizService.hardDelete(hardDeleteTarget.id)
      toast.success('Yarışma kalıcı olarak silindi.')
      setHardDeleteTarget(null)
      refresh()
    } catch {
      toast.error('Yarışma silinemedi.')
    } finally {
      setActionRunning(false)
    }
  }

  const runBulk = async () => {
    if (!bulkType || bulkRunning) return
    const targets = targetsFor(bulkType)
    setBulkRunning(true)
    try {
      const results = bulkType === 'delete'
        ? await Promise.allSettled(targets.map((r) => quizService.archive(r.id)))
        : await Promise.allSettled(targets.map((r) => quizService.toggleStatus(r.id)))
      const failed = results.filter((r) => r.status === 'rejected').length
      const okCount = results.length - failed
      const successLabel = bulkType === 'delete'
        ? `${okCount} yarışma arşive taşındı.`
        : bulkType === 'activate' ? `${okCount} yarışma aktif edildi.` : `${okCount} yarışma pasife alındı.`
      const failLabel = bulkType === 'delete'
        ? `${failed} yarışma arşive taşınamadı.`
        : bulkType === 'activate' ? `${failed} yarışma aktif edilemedi.` : `${failed} yarışma pasife alınamadı.`
      if (okCount > 0) toast.success(successLabel)
      if (failed > 0) toast.error(failLabel)
      setBulkType(null); setSelected(new Set()); refresh()
    } finally {
      setBulkRunning(false)
    }
  }

  const bulkMessages = {
    activate: { title: 'Seçili Yarışmaları Aktif Et', description: `Seçili yarışmalardan pasif olan ${targetsFor('activate').length} tanesi aktif edilecek. Devam edilsin mi?` },
    deactivate: { title: 'Seçili Yarışmaları Pasife Al', description: `Seçili yarışmalardan aktif olan ${targetsFor('deactivate').length} tanesi pasife alınacak. Devam edilsin mi?` },
    delete: { title: 'Seçili Yarışmaları Arşivle', description: `Seçili ${targetsFor('delete').length} yarışma arşive taşınacak. Arşiv sekmesinden geri alabilirsiniz.` },
  }

  const columns: DataTableColumn<Quiz>[] = [
    {
      key: 'title',
      header: 'Yarışma',
      cell: (q) => (
        <button
          type="button"
          onClick={() => setDetailQuiz(q)}
          className="min-w-0 text-left group flex flex-col items-start focus:outline-none"
          title="Detayları görüntülemek için tıklayın"
        >
          <p className="type-body-strong truncate text-foreground-strong group-hover:text-primary transition-colors cursor-pointer">
            {q.title}
          </p>
          {q.categoryName && (
            <p className="type-caption text-foreground-muted truncate group-hover:text-foreground-default transition-colors">
              {q.categoryName}
            </p>
          )}
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Durum',
      cell: (q) => {
        const cfg = STATUS_CFG[q.status] ?? STATUS_CFG.completed
        return (
          <div className="flex flex-col items-start gap-1">
            <Badge tone={cfg.tone}>{cfg.label}</Badge>
            <Badge tone={q.isActive ? 'success' : 'neutral'}>{q.isActive ? 'Aktif' : 'Pasif'}</Badge>
          </div>
        )
      },
    },
    {
      key: 'questionCount',
      header: 'Soru',
      align: 'center',
      cell: (q) => <span className="tabular-nums type-body-strong">{q.questionCount}</span>,
    },
    {
      key: 'participantCount',
      header: 'Katılımcı',
      align: 'center',
      cell: (q) => <span className="tabular-nums type-body-strong">{q.participantCount}</span>,
    },
    {
      key: 'perQuestionTimeLimit',
      header: 'Süre / Soru',
      align: 'center',
      cell: (q) => <span className="tabular-nums type-caption text-foreground-muted">{q.perQuestionTimeLimit}sn</span>,
    },
    {
      key: 'dates',
      header: 'Tarih Aralığı',
      cell: (q) => (
        <span className="tabular-nums type-caption text-foreground-muted">
          {formatDate(q.startDate)} – {formatDate(q.endDate)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="max-w-sm">
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          iconLeft={<SearchIcon className="h-4 w-4" />}
          placeholder="Yarışma ara..."
        />
      </div>

      <DataTable<Quiz>
        title="Yarışmalar"
        showRowNumbers
        columns={columns}
        rows={rows}
        rowKey={(q) => q.id}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        limit={limit}
        onPageChange={setPage}
        onLimitChange={(l) => { setLimit(l); setPage(1) }}
        selectable={can('quiz.edit') || can('quiz.delete')}
        selected={selected}
        onSelectedChange={setSelected}
        selectionActions={
          <div className="flex items-center gap-1.5">
            {can('quiz.edit') && (
              <>
                <Button variant="outline" size="sm" onClick={() => setBulkType('activate')}>
                  <PowerIcon className="h-3.5 w-3.5 text-success" /> Aktif Et
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkType('deactivate')}>
                  <PowerOffIcon className="h-3.5 w-3.5 text-warning" /> Pasife Al
                </Button>
              </>
            )}
            {can('quiz.delete') && (
              <Button variant="outline" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setBulkType('delete')}>
                <Trash2Icon className="h-3.5 w-3.5" /> Arşivle
              </Button>
            )}
            <Button variant="ghost" size="sm" className="ml-1" onClick={() => setSelected(new Set())}>Seçimi temizle</Button>
          </div>
        }
        rowActions={(q) => (
          <RowActions
            menu={[
              {
                label: 'Detay Görüntüle',
                icon: EyeIcon,
                tone: 'primary',
                onClick: () => setDetailQuiz(q),
              },
              {
                label: 'Mobil Görünüm',
                icon: SmartphoneIcon,
                onClick: () => setMobilePreviewQuiz(q),
              },
              {
                label: 'Soruları Yönet',
                icon: ListChecksIcon,
                onClick: () => setQuestionsQuiz(q),
              },
              {
                label: 'Katılımcılar',
                icon: UsersIcon,
                onClick: () => setParticipantsQuiz(q),
              },
              ...(can('quiz.edit')
                ? [
                    { divider: true, label: 'div-edit' },
                    {
                      label: 'Düzenle',
                      icon: PencilIcon,
                      onClick: () => handleOpenEdit(q),
                    },
                    {
                      label: q.isActive ? 'Pasife Al' : 'Aktif Et',
                      icon: q.isActive ? PowerOffIcon : PowerIcon,
                      tone: q.isActive ? ('warning' as const) : ('primary' as const),
                      onClick: () => handleToggleStatus(q),
                    },
                  ]
                : []),
              ...(can('quiz.delete')
                ? [
                    { divider: true, label: 'div-delete' },
                    {
                      label: 'Arşive Al',
                      icon: ArchiveIcon,
                      onClick: () => setArchiveTarget(q),
                    },
                    {
                      label: 'Kalıcı Olarak Sil',
                      icon: Trash2Icon,
                      tone: 'danger' as const,
                      onClick: () => setHardDeleteTarget(q),
                    },
                  ]
                : []),
            ]}
          />
        )}
        empty={
          <EmptyState
            icon={TrophyIcon}
            title="Yarışma yok"
            description={search ? 'Aramanıza uygun yarışma bulunamadı.' : 'Bu listede yarışma bulunmuyor.'}
          />
        }
      />

      {/* DETAIL MODAL */}
      <QuizDetailModal
        quiz={detailQuiz}
        open={detailQuiz !== null}
        onClose={() => setDetailQuiz(null)}
        onOpenMobilePreview={(q) => setMobilePreviewQuiz(q)}
        onOpenQuestions={(q) => setQuestionsQuiz(q)}
        onOpenParticipants={(q) => setParticipantsQuiz(q)}
        onEdit={(q) => handleOpenEdit(q)}
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

      {/* QUESTIONS MODAL */}
      {questionsQuiz && (
        <QuizQuestionsModal
          quiz={questionsQuiz}
          open={questionsQuiz !== null}
          onClose={() => setQuestionsQuiz(null)}
          onSaved={() => {
            refresh()
          }}
        />
      )}

      {/* PARTICIPANTS MODAL */}
      <Modal
        open={participantsQuiz !== null}
        onClose={() => setParticipantsQuiz(null)}
        title="Katılımcılar"
        subtitle={participantsQuiz?.title}
        width={1100}
        className="max-w-[96vw]"
      >
        {participantsQuiz && <QuizParticipantsTable quiz={participantsQuiz} />}
      </Modal>

      {/* EDIT DRAWER */}
      {editQuiz && (
        <Drawer
          open={!!editQuiz}
          onClose={() => setEditQuiz(null)}
          title="Yarışma Düzenle"
          subtitle={editQuiz.title}
          width={640}
          hideHeader
        >
          <form onSubmit={handleSaveEdit} className="flex h-full flex-col justify-between">
            <div className="overflow-y-auto">
              <AdminFormShell
                icon={TrophyIcon}
                title="Yarışma Düzenle"
                subtitle="Yarışma bilgileri, tarihleri, kategori ve süre ayarlarını yönetin"
                badge={QUIZ_STATUS_LABELS[editQuiz.status]}
                tone="violet"
              >
                <div className="p-4 space-y-4">
                  <QuizForm
                    form={editFormData}
                    setForm={setEditFormData}
                    mode="edit"
                    editingRow={editQuiz}
                  />
                </div>
              </AdminFormShell>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-surface-1 p-4">
              <Button variant="outline" type="button" onClick={() => setEditQuiz(null)}>
                Vazgeç
              </Button>
              <Button variant="primary" type="submit" isLoading={editSaving}>
                Değişiklikleri Kaydet
              </Button>
            </div>
          </form>
        </Drawer>
      )}

      {/* ARCHIVE CONFIRM MODAL */}
      <ConfirmModal
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        icon={ArchiveIcon}
        tone="primary"
        title="Yarışmayı Arşive Al"
        description={`"${archiveTarget?.title}" yarışması arşive taşınacak. Arşiv sekmesinden istediğiniz zaman geri alabilirsiniz.`}
        confirmLabel="Evet, Arşivle"
        loading={actionRunning}
      />

      {/* HARD DELETE CONFIRM MODAL */}
      <ConfirmModal
        open={!!hardDeleteTarget}
        onClose={() => setHardDeleteTarget(null)}
        onConfirm={handleHardDelete}
        icon={Trash2Icon}
        tone="danger"
        title="Yarışmayı Kalıcı Olarak Sil"
        description={`"${hardDeleteTarget?.title}" yarışması ve ilgili tüm soru kayıtları veritabanından kalıcı olarak silinecektir. Bu işlem geri alınamaz!`}
        confirmLabel="Evet, Kalıcı Olarak Sil"
        loading={actionRunning}
      />

      {/* BULK ACTIONS CONFIRM MODAL */}
      <ConfirmModal
        open={!!bulkType}
        onClose={() => setBulkType(null)}
        onConfirm={runBulk}
        icon={bulkType === 'delete' ? Trash2Icon : PowerIcon}
        tone={bulkType === 'delete' ? 'danger' : 'primary'}
        title={bulkType ? bulkMessages[bulkType].title : ''}
        description={bulkType ? bulkMessages[bulkType].description : ''}
        confirmLabel={bulkType === 'delete' ? 'Evet, Arşivle' : 'Onayla'}
        loading={bulkRunning}
      />
    </div>
  )
}
