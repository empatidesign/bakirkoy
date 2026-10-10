import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  WandSparklesIcon, ClipboardPasteIcon, ArrowRightIcon, AlertTriangleIcon,
  CheckCircle2Icon, ListChecksIcon,
} from 'lucide-react'
import {
  Badge, Button, EmptyState, Field, Input, Modal, Select, Textarea,
} from '@/design-system'
import { SurveyBuilder } from '@/components/specialized/SurveyBuilder'
import surveyService from '@/services/survey.service'
import {
  SURVEY_CATEGORY_OPTIONS,
  SURVEY_QUESTION_TYPE_LABELS,
} from '@/types/survey.types'
import type { SurveyQuestionForm } from '@/types/survey.types'
import { emptySurveyForm, todayIso } from './surveyConstants'
import { parseSurveyText, SURVEY_TEXT_EXAMPLE } from './surveyTextParser'
import { SURVEY_TEMPLATES } from './surveyTemplates'

// Kullanıcı isteği (2026-09-01): "anket düzenlerken de bunu tek sayfada, soruların ne olduğu,
// cevap şıkları çoktan seçmeli mi veya nasıl cevap seçeneklerinin olması gerektiği anket
// sihirbazı olması lazım ... veya yapay zeka yardımıyla soruları ve cevapları verdiğinde
// otomatikmen bir anket sistemine çevirir."
//
// Sihirbaz TEK sayfadır: solda serbest metin (yapıştır), sağda anında oluşan anket önizlemesi.
// Yönetici metni yapıştırır, sistem soru tiplerini ve şıkları otomatik çıkarır; ardından
// istediği soruyu düzenleyebilir, sırasını sürükleyerek değiştirebilir ve tek tıkla kaydeder.

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

export const SurveyWizardModal = ({ open, onClose, onCreated }: Props) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(SURVEY_CATEGORY_OPTIONS[0]?.value ?? '')
  const [text, setText] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [questions, setQuestions] = useState<SurveyQuestionForm[]>([])
  const [parsed, setParsed] = useState(false)
  const [saving, setSaving] = useState(false)

  const parseResult = useMemo(() => parseSurveyText(text), [text])

  const applyParse = () => {
    const { questions: qs, ignoredLines } = parseResult
    if (qs.length === 0) {
      toast.error('Metinden soru çıkarılamadı. Her satıra bir soru, altına şıkları yazın.')
      return
    }
    setQuestions(qs.map(({ sourceLine: _ignored, ...q }) => q))
    setParsed(true)
    if (ignoredLines.length > 0) {
      toast.warning(`${qs.length} soru oluşturuldu, ${ignoredLines.length} satır atlandı.`)
    } else {
      toast.success(`${qs.length} soru oluşturuldu.`)
    }
  }

  const applyTemplate = (id: string) => {
    setTemplateId(id)
    const template = SURVEY_TEMPLATES.find((item) => item.id === id)
    if (!template) return

    const result = parseSurveyText(template.text)
    setTitle(template.title)
    setDescription(template.description)
    setCategory(template.category)
    setText(template.text)
    setQuestions(result.questions.map(({ sourceLine: _ignored, ...question }) => question))
    setParsed(true)
    toast.success(`${template.name} şablonu hazırlandı.`)
  }

  const reset = () => {
    setTitle('')
    setDescription('')
    setText('')
    setTemplateId('')
    setQuestions([])
    setParsed(false)
  }

  const close = () => {
    reset()
    onClose()
  }

  const save = async () => {
    if (!title.trim()) {
      toast.error('Anket başlığı zorunludur.')
      return
    }
    if (questions.length === 0) {
      toast.error('En az bir soru eklemelisiniz.')
      return
    }
    setSaving(true)
    try {
      await surveyService.create({
        ...emptySurveyForm(),
        title: title.trim(),
        description: description.trim(),
        category,
        startDate: todayIso(),
        // Sihirbazla üretilen anket taslak (pasif) başlar; yönetici kontrol edip yayınlar.
        isActive: false,
        estimatedDuration: Math.max(1, Math.round(questions.length * 0.7)),
        questions,
      })
      toast.success('Anket oluşturuldu. Kontrol edip yayınlayabilirsiniz.')
      onCreated()
      close()
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg || 'Anket oluşturulamadı.')
    } finally {
      setSaving(false)
    }
  }

  const typeSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const q of questions) counts.set(q.type, (counts.get(q.type) ?? 0) + 1)
    return [...counts.entries()]
  }, [questions])

  return (
    <Modal
      open={open}
      onClose={close}
      width={1180}
      className="max-w-[calc(100vw-2rem)] overflow-hidden"
    >
      <div className="flex h-[calc(100dvh-2rem)] max-h-[860px] min-h-0 flex-col">
        <div className="flex flex-shrink-0 items-start gap-4 border-b border-border px-5 py-4 pr-14 sm:px-6 sm:py-5 sm:pr-14">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-field bg-primary-soft">
            <WandSparklesIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground-strong">Anket Sihirbazı</h3>
            <p className="mt-1 max-w-3xl type-muted">
              Sorularınızı ve cevap şıklarınızı yapıştırın; sistem soru tiplerini otomatik belirleyip
              anketi kursun. Ardından tek sayfada düzenleyip sıralayabilirsiniz.
            </p>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)] lg:overflow-hidden">
          {/* SOL: metin girişi */}
          <div className="space-y-4 border-border p-5 sm:p-6 lg:overflow-y-auto lg:border-r">
            <Field
              label="Hazır Anket Şablonu"
              hint="Bir şablon seçtiğinizde başlık, açıklama ve sorular otomatik hazırlanır. Tüm alanları değiştirebilirsiniz."
            >
              <Select
                value={templateId}
                onChange={(e) => applyTemplate(e.target.value)}
                placeholder="Anket türüne göre şablon seçin"
                className="bg-white"
              >
                <option value="" disabled>Şablon seçin</option>
                {SURVEY_TEMPLATES.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Anket Başlığı" required>
                <Input tone="white" className="bg-white" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Örn. Belediye Hizmet Memnuniyeti" />
              </Field>
              <Field label="Kategori">
                <Select className="bg-white" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {SURVEY_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Açıklama">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                placeholder="Anketin amacını kısaca açıklayın" />
            </Field>

            <Field
              label="Sorular ve Cevap Şıkları"
              hint="Her soruyu bir satıra yazın; şıkları altına “- ” veya “a) ” ile ekleyin. Tip belirtmek için [yıldız], [çoklu], [ölçek] gibi etiketler kullanabilirsiniz."
            >
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={12}
                className="min-h-64 resize-y font-mono text-[13px] leading-5"
                placeholder={SURVEY_TEXT_EXAMPLE}
              />
            </Field>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={applyParse} iconLeft={<ArrowRightIcon className="h-4 w-4" />}>
                Ankete Çevir
              </Button>
              {!templateId && (
                <Button variant="outline" onClick={() => setText(SURVEY_TEXT_EXAMPLE)}
                  iconLeft={<ClipboardPasteIcon className="h-4 w-4" />}>
                  Örnek Metni Doldur
                </Button>
              )}
              {text.trim() && (
                <Badge tone="info">{parseResult.questions.length} soru algılandı</Badge>
              )}
            </div>

            {parseResult.ignoredLines.length > 0 && (
              <div className="rounded-field border border-warning/30 bg-warning-soft/40 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-warning">
                  <AlertTriangleIcon className="h-4 w-4" />
                  {parseResult.ignoredLines.length} satır anlaşılamadı
                </p>
                <ul className="mt-1 space-y-0.5 type-caption">
                  {parseResult.ignoredLines.slice(0, 5).map((l) => (
                    <li key={l.line}>Satır {l.line}: {l.reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* SAĞ: oluşan anket */}
          <div className="min-h-[320px] space-y-4 border-t border-border bg-surface-1/40 p-5 sm:p-6 lg:overflow-y-auto lg:border-l-0 lg:border-t-0">
            {!parsed || questions.length === 0 ? (
              <EmptyState
                icon={ListChecksIcon}
                title="Anket burada oluşacak"
                description="Soldaki alana sorularınızı yazıp “Ankete Çevir” düğmesine basın. Oluşan soruları burada düzenleyebilir, sürükleyerek sıralayabilirsiniz."
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-success">
                    <CheckCircle2Icon className="h-4 w-4" /> {questions.length} soru hazır
                  </span>
                  {typeSummary.map(([type, count]) => (
                    <Badge key={type} tone="neutral">
                      {SURVEY_QUESTION_TYPE_LABELS[type as keyof typeof SURVEY_QUESTION_TYPE_LABELS] ?? type} × {count}
                    </Badge>
                  ))}
                </div>
                <SurveyBuilder value={questions} onChange={setQuestions} />
              </>
            )}
          </div>
        </div>

        <div className="flex flex-shrink-0 flex-col-reverse gap-3 border-t border-border bg-surface-0 px-5 py-4 sm:flex-row sm:px-6">
          <Button variant="outline" className="flex-1" onClick={close} disabled={saving}>
            Vazgeç
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            onClick={save}
            disabled={saving || questions.length === 0 || !title.trim()}
            isLoading={saving}
          >
            Anketi Oluştur ({questions.length} soru)
          </Button>
        </div>
      </div>
    </Modal>
  )
}
