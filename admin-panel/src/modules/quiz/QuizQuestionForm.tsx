import type { Dispatch, SetStateAction } from 'react'
import { HelpCircleIcon, ListChecksIcon, SlidersHorizontalIcon } from 'lucide-react'
import { Textarea, Select, NumberInput, Field, FormSection } from '@/design-system'
import { AnswerOptionsField } from '@/components/specialized/AnswerOptionsField'
import { QUIZ_DIFFICULTY_OPTIONS, QUIZ_DIFFICULTY_POINTS } from '@/types/quiz.types'
import type { QuizDifficulty, QuizQuestionForm as QuizQuestionFormData } from '@/types/quiz.types'
import type { SelectOption } from '@/types/common'

interface Props {
  form: QuizQuestionFormData
  setForm: Dispatch<SetStateAction<QuizQuestionFormData>>
  categoryOptions: SelectOption[]
  ageGroupOptions: SelectOption[]
}

export const QuizQuestionForm = ({ form, setForm, categoryOptions, ageGroupOptions }: Props) => {
  const patch = (p: Partial<QuizQuestionFormData>) => setForm((f) => ({ ...f, ...p }))

  return (
    <div className="space-y-[15px]">
      <FormSection variant="card" icon={HelpCircleIcon} title="Soru">
        <Field label="Soru Metni" required>
          <Textarea value={form.question} onChange={(e) => patch({ question: e.target.value })} rows={3} placeholder="Soru metnini giriniz..." />
        </Field>
      </FormSection>

      <FormSection variant="card" icon={ListChecksIcon} title="Seçenekler">
        <AnswerOptionsField
          options={form.options}
          correctAnswer={form.correctAnswer}
          onOptionsChange={(options) => patch({ options })}
          onCorrectAnswerChange={(correctAnswer) => patch({ correctAnswer })}
        />
      </FormSection>

      <FormSection variant="card" icon={SlidersHorizontalIcon} title="Soru Ayarları">
        <div className="grid gap-[15px] sm:grid-cols-2">
          <Field label="Kategori" required>
            <Select value={form.categoryId} onChange={(e) => patch({ categoryId: e.target.value })} placeholder="Kategori seçin">
              <option value="">Kategori seçin</option>
              {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Yaş Grubu" hint="Boş bırakılırsa yarışmanın yaş grubu geçerli olur">
            <Select value={form.ageGroupId} onChange={(e) => patch({ ageGroupId: e.target.value })} placeholder="Yaş grubu (opsiyonel)">
              <option value="">Yarışma yaş grubu</option>
              {ageGroupOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Zorluk" required hint="Zorluk değişince puan otomatik güncellenir">
            <Select
              value={form.difficulty}
              onChange={(e) => {
                const difficulty = e.target.value as QuizDifficulty
                patch({ difficulty, points: QUIZ_DIFFICULTY_POINTS[difficulty] })
              }}
            >
              {QUIZ_DIFFICULTY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Puan" required>
            <NumberInput value={form.points} onChange={(n) => patch({ points: n })} min={1} max={100} suffix="puan" />
          </Field>
          <Field label="Süre" required>
            <NumberInput value={form.timeLimit} onChange={(n) => patch({ timeLimit: n })} min={5} max={300} suffix="sn" />
          </Field>
        </div>
      </FormSection>
    </div>
  )
}
