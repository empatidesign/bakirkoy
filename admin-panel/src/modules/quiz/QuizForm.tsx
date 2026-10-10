import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { TrophyIcon, CalendarRangeIcon, SlidersHorizontalIcon, UsersIcon, InfoIcon } from 'lucide-react'
import { Input, Textarea, Select, DatePicker, NumberInput, Badge, Banner, Field, ReadonlyField } from '@/design-system'
import { QUIZ_STATUS_LABELS, QUIZ_STATUS_OPTIONS, QUIZ_STATUS_TONE } from '@/types/quiz.types'
import type { Quiz, QuizForm as QuizFormData } from '@/types/quiz.types'
import type { SelectOption } from '@/types/common'
import quizCategoryService from '@/services/quizCategory.service'
import quizAgeGroupService from '@/services/quizAgeGroup.service'
import { formatDate } from '@/lib/utils'
import { FULL_RESIDENCY_MODE_OPTIONS, type FullResidencyMode } from '@/lib/residency'
import { todayIso } from './quizConstants'

interface Props {
  form: QuizFormData
  setForm: Dispatch<SetStateAction<QuizFormData>>
  mode: 'create' | 'edit'
  editingRow: Quiz | null
  readOnly?: boolean
}

export const QuizForm = ({ form, setForm, readOnly, editingRow }: Props) => {
  const [categoryOptions, setCategoryOptions] = useState<SelectOption[]>([])
  const [ageGroupOptions, setAgeGroupOptions] = useState<SelectOption[]>([])
  const patch = (p: Partial<QuizFormData>) => setForm((f) => ({ ...f, ...p }))

  useEffect(() => {
    if (readOnly) return
    quizCategoryService.getOptions().then((o) => setCategoryOptions(o ?? [])).catch(() => setCategoryOptions([]))
    quizAgeGroupService.getOptions().then((o) => setAgeGroupOptions(o ?? [])).catch(() => setAgeGroupOptions([]))
  }, [readOnly])

  if (readOnly) {
    const r = editingRow
    return (
      <>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <TrophyIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Yarışma Bilgileri</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <Field label="Başlık"><ReadonlyField>{r?.title || '—'}</ReadonlyField></Field>
            <Field label="Açıklama"><ReadonlyField>{r?.description || '—'}</ReadonlyField></Field>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <CalendarRangeIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Tarih & Durum</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid gap-[15px] sm:grid-cols-2">
              <Field label="Başlangıç Tarihi"><ReadonlyField>{r?.startDate ? formatDate(r.startDate) : '—'}</ReadonlyField></Field>
              <Field label="Bitiş Tarihi"><ReadonlyField>{r?.endDate ? formatDate(r.endDate) : '—'}</ReadonlyField></Field>
              <Field label="Durum">
                <div className="flex min-h-10 items-center">
                  {r && <Badge tone={QUIZ_STATUS_TONE[r.status]}>{QUIZ_STATUS_LABELS[r.status]}</Badge>}
                </div>
              </Field>
              <Field label="Yayın Durumu">
                <div className="flex min-h-10 items-center">
                  {r && <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge>}
                </div>
              </Field>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <SlidersHorizontalIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Yarışma Ayarları</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid gap-[15px] sm:grid-cols-2">
              <Field label="Kategori">
                <div className="flex min-h-10 items-center">
                  {r?.categoryName ? <Badge color={r.categoryColor}>{r.categoryName}</Badge> : <span className="type-muted">—</span>}
                </div>
              </Field>
              <Field label="Yaş Grubu">
                <div className="flex min-h-10 items-center">
                  {r?.ageGroupName ? <Badge tone="info">{r.ageGroupName}</Badge> : <span className="type-muted">Tüm yaşlar</span>}
                </div>
              </Field>
              <Field label="Soru Sayısı"><ReadonlyField><span className="tabular-nums">{r?.questionCount ?? 0}</span></ReadonlyField></Field>
              <Field label="Toplam Süre"><ReadonlyField><span className="tabular-nums">{r?.durationMinutes ?? 0} dk</span></ReadonlyField></Field>
              <Field label="Soru Süresi"><ReadonlyField><span className="tabular-nums">{r?.perQuestionTimeLimit ?? 0} sn</span></ReadonlyField></Field>
              <Field label="Katılımcı"><ReadonlyField><span className="tabular-nums">{r?.participantCount ?? 0}</span></ReadonlyField></Field>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Banner tone="info" variant="soft" icon={InfoIcon}>
        Katılımcılar yarışmayı yalnız <strong>başlangıç–bitiş</strong> tarih aralığında çözebilir. Süre sınırı:
        en fazla <strong>{form.durationMinutes} dk</strong> ve soru başına <strong>{form.perQuestionTimeLimit} sn</strong>
        {' '}(hangisi önce dolarsa yarışma kapanır). Her kişi yarışmayı yalnız <strong>bir kez</strong> çözebilir.
      </Banner>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <TrophyIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Yarışma Bilgileri</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <Field label="Başlık" required>
            <Input value={form.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Yarışma başlığı" />
          </Field>
          <Field label="Açıklama" required>
            <Textarea value={form.description} onChange={(e) => patch({ description: e.target.value })} rows={3} placeholder="Yarışma açıklaması" />
          </Field>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <CalendarRangeIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Tarih & Durum</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid gap-[15px] sm:grid-cols-2">
            <Field label="Başlangıç Tarihi" required>
              <DatePicker
                value={form.startDate}
                onChange={(v) => patch({ startDate: v, endDate: form.endDate && form.endDate < v ? v : form.endDate })}
                min={todayIso()}
                max={form.endDate || undefined}
                clearable
                placeholder="Başlangıç tarihi"
              />
            </Field>
            <Field label="Bitiş Tarihi" required>
              <DatePicker
                value={form.endDate}
                onChange={(v) => patch({ endDate: v })}
                min={form.startDate || todayIso()}
                clearable
                placeholder="Bitiş tarihi"
              />
            </Field>
            <Field label="Durum" hint="Yakında, Devam Ediyor veya Tamamlandı">
              <Select value={form.status} onChange={(e) => patch({ status: e.target.value as QuizFormData['status'] })}>
                {QUIZ_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Kategori" required hint={'Kategoriler "Kategoriler" sekmesinden yönetilir'}>
              <Select value={form.categoryId} onChange={(e) => patch({ categoryId: e.target.value })} placeholder="Kategori seçin">
                <option value="">Kategori seçin</option>
                {categoryOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4 bg-surface-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <SlidersHorizontalIcon className="h-4 w-4 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground-strong">Yarışma Ayarları</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          <Field
            label="Yaş Grubu"
            hint={'Seçilirse bu yarışmayı yalnız o yaş grubundaki vatandaşlar görür. Yaş grupları "Yaş Grupları" sekmesinden yönetilir.'}
          >
            <Select value={form.ageGroupId} onChange={(e) => patch({ ageGroupId: e.target.value })} placeholder="Tüm yaşlar">
              <option value="">Tüm yaşlar (herkes görebilir)</option>
              {ageGroupOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Katılım Bölgesi (İkamet / Uyruk)" hint="Bu yarışmaya kimlerin katılabileceğini ikamet adresine (NVI/KPS) ve uyruğa (T.C./yabancı) göre belirler">
            <Select value={form.residencyMode} onChange={(e) => patch({ residencyMode: e.target.value as FullResidencyMode })}>
              {FULL_RESIDENCY_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <div className="grid gap-[15px] sm:grid-cols-2">
            <Field label="Soru Sayısı" required hint={'Yarışmada sorulacak soru sayısı (sorular "Sorular" ekranından eklenir)'}>
              <NumberInput value={form.questionCount} onChange={(n) => patch({ questionCount: n })} min={1} max={100} suffix="soru" />
            </Field>
            <Field label="Toplam Süre" required hint="Tüm yarışma için üst süre sınırı">
              <NumberInput value={form.durationMinutes} onChange={(n) => patch({ durationMinutes: n })} min={1} max={600} suffix="dk" />
            </Field>
            <Field label="Soru Süresi" required hint="Her soru için tanınan varsayılan süre">
              <NumberInput value={form.perQuestionTimeLimit} onChange={(n) => patch({ perQuestionTimeLimit: n })} min={5} max={300} suffix="sn" />
            </Field>
          </div>
          {editingRow && (
            <div className="flex items-center gap-2 type-muted">
              <UsersIcon className="h-4 w-4" />
              <span><span className="tabular-nums">{editingRow.participantCount}</span> katılımcı</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
