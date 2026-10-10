import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ClipboardListIcon } from 'lucide-react'
import {
  Modal,
  Button,
  Field,
  Combobox,
  DatePicker,
  NumberInput,
  Textarea,
  ToggleRow,
  MultiSelect,
} from '@/design-system'
import surveyPlatformService from '@/services/surveyPlatform.service'
import surveyService from '@/services/survey.service'
import { useNeighborhoodOptions } from '@/hooks/useNeighborhoodOptions'
import { SurveyInterviewerPicker } from './SurveyInterviewerPicker'
import type { BatchCreateSurveyFieldTaskForm } from '@/types/surveyPlatform.types'
import type { SelectOption } from '@/types/common'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const todayIso = () => new Date().toISOString().split('T')[0]

const emptyForm = (): BatchCreateSurveyFieldTaskForm => ({
  surveyId: '',
  interviewers: [],
  neighborhoods: [],
  allNeighborhoods: false,
  startDate: todayIso(),
  endDate: todayIso(),
  targetCount: 50,
  dailyTarget: 10,
  note: '',
})

export const SurveyFieldTaskBatchModal = ({ open, onClose, onCreated }: Props) => {
  const neighborhoodOptions = useNeighborhoodOptions()
  const [surveyOptions, setSurveyOptions] = useState<SelectOption[]>([])
  const [form, setForm] = useState<BatchCreateSurveyFieldTaskForm>(emptyForm())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(emptyForm())
    surveyService
      .getList({ page: 1, limit: 100, sort: 'createdAt', order: 'desc' })
      .then((res) => setSurveyOptions(res.items.map((s) => ({ value: s.id, label: s.title }))))
      .catch(() => setSurveyOptions([]))
  }, [open])

  const patch = (p: Partial<BatchCreateSurveyFieldTaskForm>) => setForm((f) => ({ ...f, ...p }))

  const errors = [
    !form.surveyId && 'Anket seçilmelidir.',
    form.interviewers.length === 0 && 'En az bir anketör seçilmelidir.',
    !form.allNeighborhoods && form.neighborhoods.length === 0 && 'Mahalle seçin veya “Tüm Mahalleler” işaretleyin.',
    !form.startDate && 'Başlangıç tarihi zorunludur.',
    !form.endDate && 'Bitiş tarihi zorunludur.',
    (!!form.startDate && !!form.endDate && form.startDate > form.endDate) && 'Bitiş tarihi başlangıç tarihinden önce olamaz.',
  ].filter(Boolean) as string[]

  const submit = async () => {
    if (errors.length > 0) return
    setSaving(true)
    try {
      const created = await surveyPlatformService.batchCreateFieldTasks(form)
      toast.success(`${created.length} saha görevi oluşturuldu.`)
      onCreated()
      onClose()
    } catch {
      toast.error('Saha görevleri oluşturulamadı.')
    } finally {
      setSaving(false)
    }
  }

  const header = (
    <div className="relative overflow-hidden -mx-6 -mt-5 mb-0 ds-hero">
      <div className="absolute -right-12 -top-12 h-52 w-52 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
      <div className="absolute -bottom-6 right-24 h-32 w-32 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #fff, transparent 70%)' }} />
      <div className="relative px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg shadow-xl" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.25), rgba(255,255,255,0.15))', border: '2px solid rgba(255,255,255,0.35)' }}>
            <ClipboardListIcon className="h-6 w-6 text-white" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-white">Yeni Saha Görevi</h3>
            <p className="mt-0.5 type-caption text-white/80">Bir veya birden çok anketöre, bir veya tüm mahallelere toplu görev atayın</p>
          </div>
        </div>
      </div>
    </div>
  )

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onClose}>İptal</Button>
      <Button variant="primary" onClick={submit} isLoading={saving} disabled={errors.length > 0}>Görevleri Oluştur</Button>
    </div>
  )

  return (
    <Modal open={open} onClose={onClose} header={header} footer={footer} width={640} bodyClassName="p-5 [--input-bg:var(--surface-1)]">
      <div className="space-y-5">
        <Field label="Anket" required>
          <Combobox value={form.surveyId} onChange={(v) => patch({ surveyId: v })} options={surveyOptions} placeholder="Anket seçin" />
        </Field>

        <Field label="Anketör(ler)" required hint="Yönetici hesabı veya site üyesi (vatandaş) seçebilirsiniz; TC/telefon ile arayın">
          <SurveyInterviewerPicker values={form.interviewers} onChange={(interviewers) => patch({ interviewers })} multiple />
        </Field>

        <ToggleRow
          label="Tüm Mahalleler"
          description="Açıkken görev mahalle kısıtı olmadan (ilçe geneli) atanır."
          checked={form.allNeighborhoods}
          onChange={(v) => patch({ allNeighborhoods: v, neighborhoods: v ? [] : form.neighborhoods })}
        />

        {!form.allNeighborhoods && (
          <Field label="Mahalleler" required hint="Birden fazla mahalle seçebilirsiniz">
            <MultiSelect
              values={form.neighborhoods}
              onChange={(neighborhoods) => patch({ neighborhoods })}
              options={neighborhoodOptions}
              placeholder="Mahalle seçin"
              selectAllLabel="Tüm Mahalleleri Seç"
            />
          </Field>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Başlangıç Tarihi" required>
            <DatePicker
              value={form.startDate}
              onChange={(v) => patch({ startDate: v, endDate: form.endDate && form.endDate < v ? v : form.endDate })}
              max={form.endDate || undefined}
              placeholder="Başlangıç tarihi"
            />
          </Field>
          <Field label="Bitiş Tarihi" required>
            <DatePicker value={form.endDate} onChange={(v) => patch({ endDate: v })} min={form.startDate || undefined} placeholder="Bitiş tarihi" />
          </Field>
          <Field label="Anketör Başına Hedef" hint="Her anketöre / mahalleye ayrı hedef">
            <NumberInput value={form.targetCount} onChange={(n) => patch({ targetCount: n })} min={0} max={100000} suffix="anket" />
          </Field>
          <Field label="Günlük Hedef" hint="0 = günlük sınır yok">
            <NumberInput value={form.dailyTarget} onChange={(n) => patch({ dailyTarget: n })} min={0} max={1000} suffix="anket" />
          </Field>
        </div>

        <Field label="Not">
          <Textarea value={form.note} onChange={(e) => patch({ note: e.target.value })} rows={3} placeholder="Saha ekibine not" />
        </Field>

        {form.interviewers.length > 0 && (
          <p className="type-caption text-foreground-subtle">
            {form.interviewers.length} anketör × {form.allNeighborhoods ? 1 : Math.max(1, form.neighborhoods.length)} mahalle = {form.interviewers.length * (form.allNeighborhoods ? 1 : Math.max(1, form.neighborhoods.length))} görev oluşturulacak.
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="outline" onClick={onClose}>İptal</Button>
          <Button variant="primary" onClick={submit} isLoading={saving} disabled={errors.length > 0}>Görevleri Oluştur</Button>
        </div>
      </div>
    </Modal>
  )
}
