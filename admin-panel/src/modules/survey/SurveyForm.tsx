import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { FileTextIcon, ListChecksIcon, SlidersHorizontalIcon, MapPinnedIcon } from 'lucide-react'
import {
  DatePicker,
  Field,
  Input,
  MultiSelect,
  NumberInput,
  SegmentedControl,
  Select,
  SkeletonRows,
  Textarea,
  ToggleRow,
} from '@/design-system'
import { SurveyBuilder } from '@/components/specialized/SurveyBuilder'
import { SurveySourcePicker } from './SurveySourcePicker'
import surveyService from '@/services/survey.service'
import { useNeighborhoodOptions } from '@/hooks/useNeighborhoodOptions'
import {
  SURVEY_IDENTITY_MODE_OPTIONS,
  SURVEY_TOPIC_OPTIONS,
  SURVEY_TYPE_OPTIONS,
} from '@/types/surveyPlatform.types'
import {
  SURVEY_CATEGORY_OPTIONS,
  SURVEY_TARGET_AUDIENCE_OPTIONS,
} from '@/types/survey.types'
import type { Survey, SurveyForm as SurveyFormData, SurveyQuestionForm } from '@/types/survey.types'
import { questionToForm, todayIso } from './surveyConstants'

interface Props {
  form: SurveyFormData
  setForm: Dispatch<SetStateAction<SurveyFormData>>
  mode: 'create' | 'edit'
  editingRow: Survey | null
  readOnly?: boolean
}

const SECTIONS = [
  { value: 'temel', label: 'Temel Bilgiler', icon: FileTextIcon },
  { value: 'sorular', label: 'Sorular', icon: ListChecksIcon },
  { value: 'saha', label: 'Saha ve Hedefleme', icon: MapPinnedIcon },
  { value: 'ayarlar', label: 'Ayarlar', icon: SlidersHorizontalIcon },
]

export const SurveyForm = ({ form, setForm, editingRow, readOnly }: Props) => {
  const [section, setSection] = useState('temel')
  const neighborhoodOptions = useNeighborhoodOptions()
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [viewQuestions, setViewQuestions] = useState<SurveyQuestionForm[]>([])
  const patch = (p: Partial<SurveyFormData>) => setForm((f) => ({ ...f, ...p }))

  useEffect(() => {
    if (!editingRow) return
    setLoadingQuestions(true)
    surveyService
      .getQuestions(editingRow.id)
      .then((qs) => {
        const mapped = qs.map(questionToForm)
        if (readOnly) setViewQuestions(mapped)
        else setForm((f) => ({ ...f, questions: mapped }))
      })
      .catch(() => {})
      .finally(() => setLoadingQuestions(false))
  }, [editingRow, readOnly, setForm])

  const questions = readOnly ? viewQuestions : form.questions
  const selectedTopics = form.topic
    ? form.topic.split('|').map((topic) => topic.trim()).filter(Boolean)
    : []

  return (
    <>
      <SegmentedControl value={section} onChange={setSection} options={SECTIONS} columns={4} />

      {section === 'temel' && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <FileTextIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Temel Bilgiler</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <Field label="Anket Başlığı" required>
              <Input value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Anket başlığı" disabled={readOnly} />
            </Field>
            <Field label="Açıklama">
              <Textarea value={form.description} onChange={(e) => patch({ description: e.target.value })} rows={3} placeholder="Anket açıklaması" disabled={readOnly} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Kategori">
                <Select value={form.category} onChange={(e) => patch({ category: e.target.value })} disabled={readOnly} placeholder="Kategori seçin">
                  <option value="">Kategori seçin</option>
                  {SURVEY_CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Hedef Kitle">
                <Select value={form.targetAudience} onChange={(e) => patch({ targetAudience: e.target.value as SurveyFormData['targetAudience'] })} disabled={readOnly}>
                  {SURVEY_TARGET_AUDIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Başlangıç Tarihi" hint="Geçmiş tarih seçilemez">
                <DatePicker
                  value={form.startDate}
                  onChange={(v) => patch({ startDate: v, endDate: form.endDate && form.endDate < v ? v : form.endDate })}
                  min={todayIso()}
                  max={form.endDate || undefined}
                  clearable
                  disabled={readOnly}
                  placeholder="Başlangıç tarihi"
                />
              </Field>
              <Field label="Bitiş Tarihi">
                <DatePicker
                  value={form.endDate}
                  onChange={(v) => patch({ endDate: v })}
                  min={form.startDate || todayIso()}
                  clearable
                  disabled={readOnly}
                  placeholder="Bitiş tarihi"
                />
              </Field>
              <Field label="Tahmini Süre" hint="Anketin yaklaşık doldurma süresi">
                <NumberInput value={form.estimatedDuration} onChange={(n) => patch({ estimatedDuration: n })} min={1} max={60} suffix="dk" disabled={readOnly} />
              </Field>
            </div>
          </div>
        </div>
      )}

      {section === 'sorular' && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ListChecksIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Sorular</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            {loadingQuestions ? (
              <SkeletonRows rows={3} />
            ) : (
              <SurveyBuilder value={questions} onChange={(q) => patch({ questions: q })} disabled={readOnly} />
            )}
          </div>
        </div>
      )}

      {section === 'saha' && (
        <div className="overflow-visible rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <MapPinnedIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Saha ve Hedefleme</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Anket Türü" hint="Saha araştırması ve raporlamada anket tipini belirler">
                <Select value={form.surveyType} onChange={(e) => patch({ surveyType: e.target.value })} disabled={readOnly}>
                  {SURVEY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Kimlik Modu" hint="Tam anonim seçilirse kişisel veri hiç kaydedilmez">
                <Select value={form.identityMode} onChange={(e) => patch({ identityMode: e.target.value })} disabled={readOnly}>
                  {SURVEY_IDENTITY_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Konu" hint="Konu bazlı analiz ve talep korelasyonunda kullanılır">
                <MultiSelect
                  values={selectedTopics}
                  onChange={(values) => patch({ topic: values.join('|') })}
                  options={SURVEY_TOPIC_OPTIONS}
                  placeholder="Bir veya daha fazla konu seçin"
                  disabled={readOnly}
                  selectedSummary={selectedTopics.length > 0 ? `${selectedTopics.length} konu seçildi` : undefined}
                  showBulkActions={false}
                />
              </Field>
              <Field label="Hedef Katılım" hint="0 = hedef belirtilmedi">
                <NumberInput value={form.targetResponseCount} onChange={(n) => patch({ targetResponseCount: n })} min={0} max={1000000} suffix="kişi" disabled={readOnly} />
              </Field>
            </div>

            <Field label="Hedef Mahalleler" hint="Boş bırakılırsa anket ilçe genelinde uygulanır">
              <MultiSelect
                values={form.targetNeighborhoods}
                onChange={(v) => patch({ targetNeighborhoods: v })}
                options={neighborhoodOptions}
                placeholder="Tüm mahalleler"
                disabled={readOnly}
                selectedSummary={form.targetNeighborhoods.length > 0 ? `${form.targetNeighborhoods.length} mahalle seçildi` : undefined}
                placement="top"
              />
            </Field>

            <ToggleRow
              label="Saha Uygulamasında Kullanılabilir"
              description="Anket, tablet üzerinden saha personeline (anketörlere) açılır ve saha görevi atanabilir."
              checked={form.fieldEnabled}
              onChange={(v) => patch({ fieldEnabled: v })}
              disabled={readOnly}
            />
            <ToggleRow
              label="Konum Zorunlu"
              description="Saha kaydı sırasında GPS konumu alınmadan anket tamamlanamaz."
              checked={form.requireLocation}
              onChange={(v) => patch({ requireLocation: v })}
              disabled={readOnly}
            />
          </div>
        </div>
      )}

      {section === 'ayarlar' && (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <SlidersHorizontalIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Anket Ayarları</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <ToggleRow label="Anket Aktif" description="Anketin yayınlanma durumu" checked={form.isActive} onChange={(v) => patch({ isActive: v })} disabled={readOnly} />
            <ToggleRow
              label="Zorunlu Anket"
              description="Vatandaş bu anketi cevaplamadan uygulamayı kullanmaya devam edemez, ekran kilitlenir ve “Daha Sonra” seçeneği gösterilmez."
              checked={form.isRequired}
              onChange={(v) => patch({ isRequired: v })}
              disabled={readOnly}
            />
            <ToggleRow label="Anonim Anket" description="Katılımcı bilgileri gizli tutulur" checked={form.isAnonymous} onChange={(v) => patch({ isAnonymous: v })} disabled={readOnly} />
            <ToggleRow label="Çoklu Yanıt" description="Aynı kişi birden fazla yanıt verebilir" checked={form.allowMultipleResponses} onChange={(v) => patch({ allowMultipleResponses: v })} disabled={readOnly} />
            <ToggleRow label="Sonuçları Göster" description="Anket sonuçları katılımcılara gösterilir" checked={form.showResults} onChange={(v) => patch({ showResults: v })} disabled={readOnly} />
            <ToggleRow label="Etkinlik Sonrası Otomatik Gönder" description="Bağlantılı etkinlik/gezi bitiminde katılımcılara otomatik gönderilir" checked={form.autoSendAfterEvent} onChange={(v) => patch({ autoSendAfterEvent: v })} disabled={readOnly} />
            <ToggleRow label="SMS Hatırlatma" description="Katılımcılara SMS hatırlatması gönderilir" checked={form.sendReminderSMS} onChange={(v) => patch({ sendReminderSMS: v })} disabled={readOnly} />
            <SurveySourcePicker
              sourceType={form.sourceType}
              sourceId={form.sourceId}
              onChange={(sourceType, sourceId) => patch({ sourceType, sourceId })}
              disabled={readOnly}
            />
          </div>
        </div>
      )}
    </>
  )
}
