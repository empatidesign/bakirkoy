import {
  MapPinnedIcon,
  XIcon,
  UserIcon,
  CalendarDaysIcon,
  TargetIcon,
  ClipboardListIcon,
  ExternalLinkIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { Badge, Button, EmptyState, Progress } from '@/design-system'
import { formatDate } from '@/lib/utils'
import {
  SURVEY_FIELD_TASK_STATUS_LABELS,
  SURVEY_FIELD_TASK_STATUS_TONE,
} from '@/types/surveyPlatform.types'
import type { SurveyFieldTask } from '@/types/surveyPlatform.types'

// Kullanıcı isteği (2026-09-01): "sol ekran ile sağ ekran listesini ayarla, ikiye böl,
// ekranda sıra no görebilelim, sağda tıklandığında" — solda görev listesi, sağda
// tıklanan görevin detayı. Sıra no (listedeki kaçıncı kayıt) burada da gösterilir ki
// kullanıcı hangi satıra baktığını kaybetmesin.
interface Props {
  task: SurveyFieldTask | null
  /** Listedeki genel sıra numarası (sayfalama dahil). */
  rowNumber?: number | null
  onClose: () => void
  onEdit?: (task: SurveyFieldTask) => void
  onDelete?: (task: SurveyFieldTask) => void
  onOpenScreen?: (task: SurveyFieldTask) => void
  openingScreen?: boolean
  canEdit?: boolean
  canDelete?: boolean
  canImpersonate?: boolean
}

const Row = ({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) => (
  <div className="flex items-start gap-2.5 py-2.5" style={{ borderBottom: '0.5px solid hsl(var(--border))' }}>
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--foreground-subtle))]" />
    <div className="min-w-0 flex-1">
      <p className="type-caption">{label}</p>
      <div className="type-body-strong break-words">{children}</div>
    </div>
  </div>
)

export const SurveyFieldTaskDetailPanel = ({
  task, rowNumber, onClose, onEdit, onDelete, onOpenScreen,
  openingScreen, canEdit, canDelete, canImpersonate,
}: Props) => {
  if (!task) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg bg-white p-6"
           style={{ border: '0.5px solid hsl(var(--border))' }}>
        <EmptyState
          icon={MapPinnedIcon}
          title="Görev seçilmedi"
          description="Detayını görmek için soldaki listeden bir saha görevi satırına tıklayın."
        />
      </div>
    )
  }

  const pct = Math.min(100, task.progressPercent)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg bg-white"
         style={{ border: '0.5px solid hsl(var(--border))' }}>
      <div className="flex items-start justify-between gap-2 px-4 py-3"
           style={{ borderBottom: '0.5px solid hsl(var(--border))', background: 'hsl(214, 40%, 98.5%)' }}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {rowNumber != null && (
              <span className="rounded-full bg-[hsl(var(--primary)/0.1)] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[hsl(var(--primary))]">
                #{rowNumber}
              </span>
            )}
            <Badge tone={SURVEY_FIELD_TASK_STATUS_TONE[task.status]}>
              {SURVEY_FIELD_TASK_STATUS_LABELS[task.status]}
            </Badge>
          </div>
          <p className="mt-1.5 type-body-strong leading-tight">{task.surveyTitle}</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Detay panelini kapat"
          className="rounded-lg p-1 text-[hsl(var(--foreground-muted))] transition-colors hover:bg-[hsl(var(--surface-0))]"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="py-3">
          <div className="mb-1.5 flex items-center justify-between type-caption">
            <span className="tabular-nums">{task.completedCount} / {task.targetCount || '—'} anket</span>
            <span className="tabular-nums font-semibold">%{Math.round(task.progressPercent)}</span>
          </div>
          <Progress value={pct} tone={task.progressPercent >= 100 ? 'success' : 'primary'} />
        </div>

        <Row icon={UserIcon} label="Anketör">
          <span className="flex flex-wrap items-center gap-1.5">
            {task.interviewerName}
            {task.interviewerType === 'participant' && <Badge tone="info">Üye</Badge>}
          </span>
        </Row>
        <Row icon={MapPinnedIcon} label="Mahalle">
          <Badge tone={task.neighborhood === 'Tüm Mahalleler' ? 'primary' : 'neutral'}>{task.neighborhood}</Badge>
        </Row>
        <Row icon={CalendarDaysIcon} label="Tarih Aralığı">
          {formatDate(task.startDate)} — {formatDate(task.endDate)}
        </Row>
        <Row icon={TargetIcon} label="Hedefler">
          Toplam {task.targetCount || '—'} · Günlük {task.dailyTarget || 'sınırsız'}
        </Row>
        <Row icon={ClipboardListIcon} label="Bugün Toplanan">
          <span className="tabular-nums">{task.todayCount}</span>
        </Row>
        <Row icon={CalendarDaysIcon} label="Son Senkron">
          {task.lastSyncAt ? formatDate(task.lastSyncAt) : '—'}
        </Row>
        {task.note && (
          <Row icon={ClipboardListIcon} label="Not">
            <span className="font-normal">{task.note}</span>
          </Row>
        )}
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-3"
           style={{ borderTop: '0.5px solid hsl(var(--border))', background: 'hsl(var(--surface-0))' }}>
        {task.interviewerType === 'participant' && canImpersonate && onOpenScreen && (
          <Button
            variant="outline" size="sm"
            iconLeft={<ExternalLinkIcon className="h-3.5 w-3.5" />}
            isLoading={openingScreen}
            onClick={() => onOpenScreen(task)}
          >Ekranını Gör</Button>
        )}
        {canEdit && onEdit && (
          <Button variant="outline" size="sm" iconLeft={<PencilIcon className="h-3.5 w-3.5" />}
                  onClick={() => onEdit(task)}>Düzenle</Button>
        )}
        {canDelete && onDelete && (
          <Button variant="ghost" size="sm" iconLeft={<Trash2Icon className="h-3.5 w-3.5" />}
                  onClick={() => onDelete(task)}>Sil</Button>
        )}
      </div>
    </div>
  )
}
