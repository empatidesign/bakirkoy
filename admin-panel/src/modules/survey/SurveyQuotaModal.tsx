import { useCallback, useEffect, useState } from 'react'
import { PlusIcon, Trash2Icon, TargetIcon } from 'lucide-react'
import { Modal, Button, Field, Select, Input, NumberInput, Progress, EmptyState, SkeletonRows } from '@/design-system'
import surveyPlatformService from '@/services/surveyPlatform.service'
import { useNeighborhoodOptions } from '@/hooks/useNeighborhoodOptions'
import { SURVEY_AGE_GROUPS, SURVEY_QUOTA_DIMENSION_OPTIONS } from '@/types/surveyPlatform.types'
import type { SurveyQuota, SurveyQuotaDimension, SurveyQuotaForm } from '@/types/surveyPlatform.types'
import { toast } from 'sonner'

interface Props {
  surveyId: string | null
  surveyTitle?: string
  onClose: () => void
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Erkek' },
  { value: 'female', label: 'Kadın' },
]

export const SurveyQuotaModal = ({ surveyId, surveyTitle, onClose }: Props) => {
  const neighborhoodOptions = useNeighborhoodOptions()
  const [quotas, setQuotas] = useState<SurveyQuota[]>([])
  const [drafts, setDrafts] = useState<SurveyQuotaForm[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    if (!surveyId) return
    setLoading(true)
    surveyPlatformService
      .getQuotas(surveyId)
      .then((res) => {
        setQuotas(res)
        setDrafts(res.map((q) => ({ dimension: q.dimension, value: q.value, targetCount: q.targetCount })))
      })
      .catch(() => { setQuotas([]); setDrafts([]) })
      .finally(() => setLoading(false))
  }, [surveyId])

  useEffect(() => { load() }, [load])

  if (!surveyId) return null

  const valueOptions = (dimension: SurveyQuotaDimension) =>
    dimension === 'neighborhood' ? neighborhoodOptions
      : dimension === 'age_group' ? SURVEY_AGE_GROUPS.map((v) => ({ value: v, label: v }))
      : GENDER_OPTIONS

  const patchDraft = (i: number, p: Partial<SurveyQuotaForm>) =>
    setDrafts((d) => d.map((row, idx) => (idx === i ? { ...row, ...p } : row)))

  const addDraft = () => setDrafts((d) => [...d, { dimension: 'neighborhood', value: '', targetCount: 100 }])
  const removeDraft = (i: number) => setDrafts((d) => d.filter((_, idx) => idx !== i))

  const save = async () => {
    setSaving(true)
    try {
      const res = await surveyPlatformService.saveQuotas(surveyId, drafts.filter((d) => d.value && d.targetCount > 0))
      setQuotas(res)
      toast.success('Kotalar güncellendi.')
    } catch {
      toast.error('Kotalar kaydedilemedi.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Kota Yönetimi" subtitle={surveyTitle} width={640}>
      <div className="space-y-5 p-1">
        {loading ? (
          <SkeletonRows rows={3} />
        ) : (
          <>
            {quotas.length > 0 && (
              <div className="space-y-2">
                <p className="type-caption font-semibold uppercase text-foreground-subtle">Gerçekleşme</p>
                {quotas.map((q) => (
                  <div key={q.id} className="space-y-1">
                    <div className="flex items-center justify-between type-caption">
                      <span>{SURVEY_QUOTA_DIMENSION_OPTIONS.find((o) => o.value === q.dimension)?.label}: {q.value}</span>
                      <span className="tabular-nums">{q.currentCount} / {q.targetCount} (%{Math.round(q.progressPercent)})</span>
                    </div>
                    <Progress value={Math.min(100, q.progressPercent)} tone={q.progressPercent >= 100 ? 'success' : 'primary'} />
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="type-caption font-semibold uppercase text-foreground-subtle">Kota Tanımları</p>
                <Button variant="outline" size="sm" onClick={addDraft} iconLeft={<PlusIcon className="h-4 w-4" />}>Kota Ekle</Button>
              </div>

              {drafts.length === 0 ? (
                <EmptyState icon={TargetIcon} title="Kota tanımlanmadı" description="Mahalle, yaş aralığı veya cinsiyet bazlı minimum katılım hedefi ekleyin." />
              ) : (
                <div className="space-y-2">
                  {drafts.map((d, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_100px_auto] items-end gap-2">
                      <Field label="Boyut">
                        <Select value={d.dimension} onChange={(e) => patchDraft(i, { dimension: e.target.value as SurveyQuotaDimension, value: '' })}>
                          {SURVEY_QUOTA_DIMENSION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </Select>
                      </Field>
                      <Field label="Değer">
                        {d.dimension === 'neighborhood' || d.dimension === 'age_group' || d.dimension === 'gender' ? (
                          <Select value={d.value} onChange={(e) => patchDraft(i, { value: e.target.value })}>
                            <option value="">Seçin</option>
                            {valueOptions(d.dimension).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </Select>
                        ) : (
                          <Input value={d.value} onChange={(e) => patchDraft(i, { value: e.target.value })} />
                        )}
                      </Field>
                      <Field label="Hedef">
                        <NumberInput value={d.targetCount} onChange={(n) => patchDraft(i, { targetCount: n })} min={0} max={100000} />
                      </Field>
                      <button type="button" onClick={() => removeDraft(i)} className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-field text-foreground-subtle hover:bg-[hsl(var(--danger-soft))] hover:text-[hsl(var(--danger))]">
                        <Trash2Icon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={onClose}>Kapat</Button>
              <Button variant="primary" onClick={save} isLoading={saving}>Kaydet</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
