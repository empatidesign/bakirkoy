import { useEffect, useState } from 'react'
import {
  BookMarkedIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import {
  AdminFormShell,
  Badge,
  Button,
  Combobox,
  Field,
  FilterField,
  Input,
  NumberInput,
  RemovableTag,
  Select,
  Textarea,
  ToggleRow,
} from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import surveyPlatformService from '@/services/surveyPlatform.service'
import {
  SURVEY_QUESTION_TYPE_LABELS,
  SURVEY_QUESTION_TYPE_OPTIONS,
  SURVEY_QUESTION_TYPES_WITH_OPTIONS,
} from '@/types/survey.types'
import { SURVEY_TOPIC_OPTIONS } from '@/types/surveyPlatform.types'
import type { SurveyQuestionBankForm, SurveyQuestionBankItem } from '@/types/surveyPlatform.types'
import type { SurveyQuestionType } from '@/types/survey.types'

const emptyForm = (): SurveyQuestionBankForm => ({
  question: '',
  description: '',
  type: 'text',
  options: [],
  topic: '',
  unit: '',
  config: {},
  isActive: true,
})

const toForm = (r: SurveyQuestionBankItem): SurveyQuestionBankForm => ({
  question: r.question,
  description: r.description ?? '',
  type: r.type,
  options: [...r.options],
  topic: r.topic,
  unit: r.unit ?? '',
  config: { ...r.config },
  isActive: r.isActive,
})

export const SurveyQuestionBankTab = () => {
  const { can } = useAuth()
  const [topicFilter, setTopicFilter] = useState('')
  const [topics, setTopics] = useState<string[]>([])

  useEffect(() => {
    surveyPlatformService.getQuestionBankTopics().then(setTopics).catch(() => setTopics([]))
  }, [])

  const topicOptions = topics.length > 0 ? topics.map((t) => ({ value: t, label: t })) : SURVEY_TOPIC_OPTIONS

  return (
    <CrudListTemplate<SurveyQuestionBankItem, SurveyQuestionBankForm>
      icon={BookMarkedIcon}
      title="Soru Bankası"
      subtitle="Anketlerde tekrar kullanılabilen, konu etiketli hazır sorular"
      resourceName="Soru"
      listTitle="Soru Listesi"
      searchPlaceholder="Soru metni veya konu ara..."
      service={{
        getList: (p) => surveyPlatformService.getQuestionBank(p),
        remove: can('survey.delete') ? (id) => surveyPlatformService.removeQuestionBankItem(id) : undefined,
        toggleStatus: can('survey.edit') ? (id) => surveyPlatformService.toggleQuestionBankItem(id) : undefined,
      }}
      rowKey={(r) => r.id}
      viewable
      drawerWidth={600}
      defaultSort={{ key: 'createdAt', dir: 'desc' }}
      extraParams={topicFilter ? { topic: topicFilter } : {}}
      filterColumns={2}
      hasActiveFilters={!!topicFilter}
      onClearFilters={() => setTopicFilter('')}
      renderFilters={() => (
        <FilterField label="Konu">
          <Select value={topicFilter} onChange={(e) => setTopicFilter(e.target.value)}>
            <option value="">Tüm Konular</option>
            {topicOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </FilterField>
      )}
      columns={[
        {
          key: 'question', header: 'Soru',
          cell: (r) => (
            <div className="leading-tight">
              <span className="type-body-strong">{r.question}</span>
              <span className="block type-caption">{SURVEY_QUESTION_TYPE_LABELS[r.type]}</span>
            </div>
          ),
        },
        { key: 'topic', header: 'Konu', cell: (r) => <Badge tone="neutral">{r.topic}</Badge> },
        { key: 'unit', header: 'Birim', cell: (r) => r.unit ? <span className="type-caption">{r.unit}</span> : <span className="type-muted">—</span> },
        { key: 'usageCount', header: 'Kullanım', align: 'center', sortable: true, sortKey: 'usageCount', cell: (r) => <span className="tabular-nums">{r.usageCount}</span> },
        { key: 'isActive', header: 'Durum', align: 'center', cell: (r) => <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge> },
      ]}
      emptyForm={emptyForm()}
      toForm={toForm}
      getFormErrors={(f) => [
        !f.question.trim() && 'Soru metni zorunludur.',
        !f.topic.trim() && 'Konu seçilmelidir.',
        SURVEY_QUESTION_TYPES_WITH_OPTIONS.includes(f.type) && f.options.filter((o) => o.trim()).length < 2 && 'Seçmeli sorularda en az iki seçenek gerekir.',
      ].filter(Boolean) as string[]}
      formShell
      renderForm={({ form, setForm, mode }) => (
        <AdminFormShell
          icon={BookMarkedIcon}
          title={mode === 'edit' ? 'Soru Düzenle' : 'Yeni Soru Ekle'}
          subtitle="Merkezi soru bankasına ekleyin, anketlerde tekrar kullanın"
          badge="Soru Bankası"
          tone="violet"
        >
          <QuestionBankFormBody form={form} patch={(p) => setForm((f) => ({ ...f, ...p }))} topicOptions={topicOptions} />
        </AdminFormShell>
      )}
      renderView={(row) => (
        <AdminFormShell icon={BookMarkedIcon} title="Soru Detayı" subtitle={row.topic} badge={row.isActive ? 'Aktif' : 'Pasif'} tone="violet">
          <QuestionBankFormBody form={toForm(row)} patch={() => {}} topicOptions={topicOptions} readOnly />
        </AdminFormShell>
      )}
      deleteConfirm={{ title: 'Soruyu Sil', description: 'Soru bankasından kalıcı olarak silinecek.' }}
      isActive={(r) => r.isActive}
      toggleConfirm={(_row, willActivate) => ({
        title: willActivate ? 'Soruyu Aktifleştir' : 'Soruyu Pasifleştir',
        description: willActivate ? 'Soru anket oluştururken listelenecek.' : 'Soru anket oluştururken listelenmeyecek.',
      })}
      creatable={can('survey.create')}
      canEdit={() => can('survey.edit')}
      canDelete={() => can('survey.delete')}
      onCreate={can('survey.create') ? (f) => surveyPlatformService.createQuestionBankItem(f).then(() => {}) : undefined}
      onUpdate={can('survey.edit') ? (id, f) => surveyPlatformService.updateQuestionBankItem(id, f).then(() => {}) : undefined}
      emptyTitle="Soru bankası boş"
      emptyDescription="Anketlerde tekrar kullanmak için ilk sorunuzu ekleyin."
    />
  )
}

interface FormBodyProps {
  form: SurveyQuestionBankForm
  patch: (p: Partial<SurveyQuestionBankForm>) => void
  topicOptions: { value: string; label: string }[]
  readOnly?: boolean
}

const QuestionBankFormBody = ({ form, patch, topicOptions, readOnly }: FormBodyProps) => {
  const hasOptions = SURVEY_QUESTION_TYPES_WITH_OPTIONS.includes(form.type)

  const changeType = (type: SurveyQuestionType) =>
    patch({ type, options: SURVEY_QUESTION_TYPES_WITH_OPTIONS.includes(type) ? (form.options.length >= 2 ? form.options : ['', '']) : [] })

  const setOption = (i: number, val: string) => patch({ options: form.options.map((o, idx) => (idx === i ? val : o)) })
  const addOption = () => patch({ options: [...form.options, ''] })
  const removeOption = (i: number) => patch({ options: form.options.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-5">
      <Field label="Soru Metni" required>
        <Textarea className="bg-white" value={form.question} onChange={(e) => patch({ question: e.target.value })} rows={2} placeholder="Soru metnini yazın" disabled={readOnly} />
      </Field>
      <Field label="Yardım Metni">
        <Input className="bg-white" value={form.description} onChange={(e) => patch({ description: e.target.value })} placeholder="Opsiyonel açıklama" disabled={readOnly} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Soru Tipi" required>
          <Select className="bg-white" value={form.type} onChange={(e) => changeType(e.target.value as SurveyQuestionType)} disabled={readOnly}>
            {SURVEY_QUESTION_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
        <Field label="Konu" required>
          {/* Kullanıcı isteği (2026-09-02): "içinde arama olan bir konu seçici olsun." —
              konu sayısı arttıkça (belediyeler kendi konularını da ekleyebiliyor) düz
              <Select> ile bulmak zorlaştığı için aranabilir Combobox kullanılır. */}
          <Combobox
            className="bg-white"
            value={form.topic}
            onChange={(v) => patch({ topic: v })}
            options={topicOptions}
            placeholder="Konu ara veya seçin..."
            disabled={readOnly}
            allowCustom
          />
        </Field>
        <Field label="İlgili Birim">
          <Input className="bg-white" value={form.unit} onChange={(e) => patch({ unit: e.target.value })} placeholder="Ör. Temizlik İşleri Müdürlüğü" disabled={readOnly} />
        </Field>
      </div>

      {form.type === 'scale' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Min Değer"><NumberInput className="bg-white" value={form.config.scaleMin ?? 1} onChange={(n) => patch({ config: { ...form.config, scaleMin: n } })} disabled={readOnly} /></Field>
          <Field label="Max Değer"><NumberInput className="bg-white" value={form.config.scaleMax ?? 10} onChange={(n) => patch({ config: { ...form.config, scaleMax: n } })} disabled={readOnly} /></Field>
        </div>
      )}
      {form.type === 'rating' && (
        <Field label="Yıldız Sayısı"><NumberInput className="bg-white" value={form.config.ratingCount ?? 5} onChange={(n) => patch({ config: { ...form.config, ratingCount: n } })} min={2} max={10} disabled={readOnly} /></Field>
      )}

      {hasOptions && (
        <Field label="Seçenekler" required>
          <div className="space-y-2">
            {form.options.map((opt, i) => (
              readOnly ? (
                <RemovableTag key={i} label={opt || `Seçenek ${i + 1}`} onRemove={() => {}} disabled />
              ) : (
                <div key={i} className="flex items-center gap-2">
                  <Input className="bg-white" value={opt} onChange={(e) => setOption(i, e.target.value)} placeholder={`Seçenek ${i + 1}`} />
                  {form.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(i)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-field text-foreground-subtle hover:bg-[hsl(var(--danger-soft))] hover:text-[hsl(var(--danger))]">
                      <Trash2Icon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            ))}
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addOption} iconLeft={<PlusIcon className="h-4 w-4" />}>Seçenek Ekle</Button>
            )}
          </div>
        </Field>
      )}

      <ToggleRow label="Aktif" description="Pasif sorular anket oluştururken listelenmez." checked={form.isActive} onChange={(v) => patch({ isActive: v })} disabled={readOnly} />
    </div>
  )
}
