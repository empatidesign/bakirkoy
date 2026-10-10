import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Modal, Button, Badge, SkeletonRows, EmptyState } from '@/design-system'
import { LayoutTemplateIcon, ClipboardListIcon } from 'lucide-react'
import surveyPlatformService from '@/services/surveyPlatform.service'
import surveyService from '@/services/survey.service'
import { SURVEY_TYPE_LABELS } from '@/types/surveyPlatform.types'
import type { SurveyTemplate } from '@/types/surveyPlatform.types'
import { todayIso } from './surveyConstants'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export const SurveyTemplatePickerModal = ({ open, onClose, onCreated }: Props) => {
  const [templates, setTemplates] = useState<SurveyTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingKey, setCreatingKey] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    surveyPlatformService.getTemplates().then(setTemplates).catch(() => setTemplates([])).finally(() => setLoading(false))
  }, [open])

  const createFromTemplate = async (t: SurveyTemplate) => {
    setCreatingKey(t.key)
    try {
      await surveyService.create({
        title: t.title,
        description: t.description,
        category: t.category,
        targetAudience: 'all',
        startDate: todayIso(),
        endDate: '',
        estimatedDuration: t.estimatedDuration,
        isActive: false,
        isAnonymous: false,
        allowMultipleResponses: false,
        showResults: true,
        autoSendAfterEvent: false,
        sendReminderSMS: false,
        isRequired: false,
        sourceType: null,
        sourceId: null,
        surveyType: t.surveyType,
        identityMode: 'identified',
        topic: t.topic,
        targetNeighborhoods: [],
        targetResponseCount: 0,
        fieldEnabled: false,
        requireLocation: false,
        questions: t.questions.map((q) => ({
          type: q.type,
          question: q.question,
          description: q.description ?? '',
          required: q.required,
          options: q.options,
          config: q.config ?? {},
        })),
      })
      toast.success(`"${t.title}" şablonundan taslak anket oluşturuldu.`)
      onCreated()
      onClose()
    } catch {
      toast.error('Şablondan anket oluşturulamadı.')
    } finally {
      setCreatingKey(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Şablondan Anket Oluştur" subtitle="Hazır şablonlardan biriyle taslak anket oluşturun, sonra düzenleyin" width={720}>
      <div className="space-y-2 p-1">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : templates.length === 0 ? (
          <EmptyState icon={LayoutTemplateIcon} title="Şablon yok" />
        ) : (
          templates.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3 rounded-field border border-border bg-surface-1 px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="type-body-strong">{t.title}</p>
                  <Badge tone="neutral">{SURVEY_TYPE_LABELS[t.surveyType] ?? t.surveyType}</Badge>
                </div>
                <p className="type-caption line-clamp-1">{t.description}</p>
                <p className="type-caption text-foreground-subtle">{t.questions.length} soru · ~{t.estimatedDuration} dk</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                iconLeft={<ClipboardListIcon className="h-4 w-4" />}
                onClick={() => createFromTemplate(t)}
                isLoading={creatingKey === t.key}
              >
                Kullan
              </Button>
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}
