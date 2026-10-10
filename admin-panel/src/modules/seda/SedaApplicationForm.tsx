import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { GraduationCapIcon, UserIcon, PhoneIcon, ClipboardCheckIcon, ZapIcon } from 'lucide-react'
import { Input, PhoneInput, TcknInput, Textarea, Select, Combobox, DatePicker, Badge, Field, ReadonlyField } from '@/design-system'
import type { SelectOption } from '@/types/common'
import sedaService from '@/services/seda.service'
import participantService from '@/services/participant.service'
import {
  SEDA_APPLICATION_STATUS_LABELS,
  SEDA_APPLICATION_STATUS_OPTIONS,
  SEDA_APPLICATION_STATUS_TONE,
} from '@/types/seda.types'
import type { SedaApplication, SedaApplicationForm as SedaApplicationFormData } from '@/types/seda.types'
import {
  SEDA_EDUCATION_TYPE_FALLBACK_OPTIONS,
  SEDA_GRADE_FALLBACK_OPTIONS,
  todayIso,
} from './sedaConstants'

interface Props {
  form: SedaApplicationFormData
  setForm: Dispatch<SetStateAction<SedaApplicationFormData>>
  mode: 'create' | 'edit'
  editingRow: SedaApplication | null
  readOnly?: boolean
}

export const SedaApplicationForm = ({ form, setForm, readOnly, editingRow }: Props) => {
  const [schoolOptions, setSchoolOptions] = useState<SelectOption[]>([])
  const [gradeOptions, setGradeOptions] = useState<SelectOption[]>(SEDA_GRADE_FALLBACK_OPTIONS)
  const [educationTypeOptions, setEducationTypeOptions] = useState<SelectOption[]>(SEDA_EDUCATION_TYPE_FALLBACK_OPTIONS)
  const [examCenterOptions, setExamCenterOptions] = useState<SelectOption[]>([])
  const [autoFilledFrom, setAutoFilledFrom] = useState<string | null>(null)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [lookupError, setLookupError] = useState(false)
  const appliedTcknRef = useRef<string | null>(null)
  const editingId = editingRow?.id ?? null

  useEffect(() => {
    sedaService.getSchoolOptions().then((o) => setSchoolOptions(o ?? [])).catch(() => setSchoolOptions([]))
    sedaService.getDefinitionOptions('grade').then((o) => o?.length && setGradeOptions(o)).catch(() => undefined)
    sedaService.getDefinitionOptions('education-type').then((o) => o?.length && setEducationTypeOptions(o)).catch(() => undefined)
    sedaService.getDefinitionOptions('exam-center').then((o) => setExamCenterOptions(o ?? [])).catch(() => setExamCenterOptions([]))
  }, [])

  const clearAutoFilledFields = useCallback(() => setForm((f) => ({
    ...f, studentName: '', studentSurname: '', birthDate: '', studentPhone: '', parentPhone: '', address: '',
  })), [setForm])

  useEffect(() => {
    if (readOnly || editingId) return
    const tckn = form.tckn
    if (!/^\d{11}$/.test(tckn)) {
      if (appliedTcknRef.current) { clearAutoFilledFields(); appliedTcknRef.current = null; setAutoFilledFrom(null) }
      setLookupError(false)
      return
    }
    if (appliedTcknRef.current === tckn) return
    if (appliedTcknRef.current) { clearAutoFilledFields(); appliedTcknRef.current = null; setAutoFilledFrom(null) }
    setLookupError(false)
    setLookupBusy(true)
    let ignore = false
    participantService.lookupByTckn(tckn)
      .then((look) => {
        if (ignore) return
        if (!look.exists || !look.participant) { setAutoFilledFrom(null); return }
        const p = look.participant
        const parts = p.fullName.trim().split(/\s+/)
        const surname = parts.length > 1 ? (parts.pop() ?? '') : ''
        const name = parts.join(' ')
        setForm((f) => ({
          ...f,
          studentName: name,
          studentSurname: surname,
          birthDate: p.birthDate ? p.birthDate.slice(0, 10) : '',
          studentPhone: p.phone ?? '',
          parentPhone: p.guardianPhone ?? '',
          address: p.address ?? '',
        }))
        appliedTcknRef.current = tckn
        setAutoFilledFrom(p.fullName)
      })
      .catch(() => { if (!ignore) { setLookupError(true); setAutoFilledFrom(null) } })
      .finally(() => { if (!ignore) setLookupBusy(false) })
    return () => { ignore = true }
  }, [form.tckn, readOnly, editingId, setForm, clearAutoFilledFields])

  const patch = (p: Partial<SedaApplicationFormData>) => setForm((f) => ({ ...f, ...p }))

  if (readOnly) {
    const r = editingRow
    return (
      <div className="-m-5 flex min-h-full flex-col">
        <div className="relative overflow-hidden ds-hero">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
          <div className="absolute bottom-0 left-8 h-20 w-20 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
          <div className="relative flex items-center gap-4 px-8 py-7">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg shadow-lg" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <GraduationCapIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-bold text-white">Seda Başvuru Formu</p>
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.2)', color: '#e0e7ff' }}>
                  <ZapIcon className="h-2.5 w-2.5" />
                  Seda Eğitim
                </span>
              </div>
              <p className="text-[12px] text-white/70 mt-0.5">Başvuru bilgilerini doldurun</p>
            </div>
          </div>
        </div>

        <div className="space-y-[15px] p-[15px]">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4 bg-surface-1">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <UserIcon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground-strong">Öğrenci Bilgileri</p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ad Soyad"><ReadonlyField>{`${r?.studentName ?? ''} ${r?.studentSurname ?? ''}`.trim() || '—'}</ReadonlyField></Field>
                <Field label="T.C. Kimlik No"><ReadonlyField><span className="tabular-nums">{r?.tckn || '—'}</span></ReadonlyField></Field>
                <Field label="Doğum Tarihi"><ReadonlyField>{r?.birthDate ? new Date(r.birthDate).toLocaleDateString('tr-TR') : '—'}</ReadonlyField></Field>
                <Field label="Başvuru No"><ReadonlyField><span className="tabular-nums">{r?.code || '—'}</span></ReadonlyField></Field>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4 bg-surface-1">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <GraduationCapIcon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground-strong">Eğitim Bilgileri</p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Okul"><ReadonlyField>{r?.schoolName || '—'}</ReadonlyField></Field>
                <Field label="Gelecek Yıl Sınıfı"><ReadonlyField>{r?.nextYearGrade ? `${r.nextYearGrade}. Sınıf` : '—'}</ReadonlyField></Field>
                <Field label="Eğitim Türü"><ReadonlyField>{r?.educationType || '—'}</ReadonlyField></Field>
                <Field label="Sınav Merkezi"><ReadonlyField>{r?.examCenterName || '—'}</ReadonlyField></Field>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4 bg-surface-1">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <PhoneIcon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground-strong">İletişim</p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Öğrenci Telefonu"><ReadonlyField>{r?.studentPhone || '—'}</ReadonlyField></Field>
                <Field label="Veli Telefonu"><ReadonlyField>{r?.parentPhone || '—'}</ReadonlyField></Field>
              </div>
              <Field label="Adres"><ReadonlyField>{r?.address || '—'}</ReadonlyField></Field>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="border-b border-border px-5 py-4 bg-surface-1">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <ClipboardCheckIcon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-base font-semibold text-foreground-strong">Başvuru Durumu</p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Durum">
                  <div className="flex min-h-10 items-center">
                    {r && <Badge tone={SEDA_APPLICATION_STATUS_TONE[r.status]}>{SEDA_APPLICATION_STATUS_LABELS[r.status]}</Badge>}
                  </div>
                </Field>
                <Field label="Başvuru Tarihi"><ReadonlyField>{r?.appliedAt ? new Date(r.appliedAt).toLocaleDateString('tr-TR') : '—'}</ReadonlyField></Field>
              </div>
              {r?.rejectionReason && <Field label="Ret Sebebi"><ReadonlyField>{r.rejectionReason}</ReadonlyField></Field>}
              {r?.notes && <Field label="Notlar"><ReadonlyField>{r.notes}</ReadonlyField></Field>}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="-m-5 flex min-h-full flex-col">
      <div className="relative overflow-hidden ds-hero">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
        <div className="absolute bottom-0 left-8 h-20 w-20 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
        <div className="relative flex items-center gap-4 px-8 py-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg shadow-lg" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>
            <GraduationCapIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-bold text-white">Seda Başvuru Formu</p>
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: 'rgba(255,255,255,0.2)', color: '#e0e7ff' }}>
                <ZapIcon className="h-2.5 w-2.5" />
                Seda Eğitim
              </span>
            </div>
            <p className="text-[12px] text-white/70 mt-0.5">Başvuru bilgilerini doldurun</p>
          </div>
        </div>
      </div>

      <div className="space-y-[15px] p-[15px]">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <UserIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Öğrenci Bilgileri</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Öğrenci Adı" required>
                <Input sanitize="letters" value={form.studentName} onChange={(e) => patch({ studentName: e.target.value })} placeholder="Öğrenci adı" />
              </Field>
              <Field label="Öğrenci Soyadı" required>
                <Input sanitize="letters" value={form.studentSurname} onChange={(e) => patch({ studentSurname: e.target.value })} placeholder="Öğrenci soyadı" />
              </Field>
              <Field
                label="T.C. Kimlik No"
                required
                hint={lookupBusy ? 'Kayıtlı katılımcı sorgulanıyor…' : (autoFilledFrom ? `Kayıtlı katılımcıdan dolduruldu: ${autoFilledFrom}` : undefined)}
                error={lookupError ? 'Katılımcı bilgisi sorgulanamadı. Bilgileri elle girebilirsiniz.' : undefined}
              >
                <TcknInput value={form.tckn} onChange={(v) => patch({ tckn: v })} />
              </Field>
              <Field label="Doğum Tarihi">
                <DatePicker value={form.birthDate} onChange={(v) => patch({ birthDate: v })} max={todayIso()} clearable placeholder="Doğum tarihi" />
              </Field>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <GraduationCapIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Eğitim Bilgileri</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Okul" required>
                <Combobox
                  value={form.schoolName}
                  displayValue={form.schoolName}
                  options={schoolOptions}
                  allowCustom
                  onChange={(v) => patch({ schoolName: v })}
                  placeholder="Okul seçin veya yazın"
                  emptyText="Okul bulunamadı"
                  iconLeft={<GraduationCapIcon className="h-4 w-4" />}
                />
              </Field>
              <Field label="Gelecek Yıl Sınıfı" required>
                <Select value={form.nextYearGrade} onChange={(e) => patch({ nextYearGrade: e.target.value })} placeholder="Sınıf seçin">
                  <option value="">Sınıf seçin</option>
                  {gradeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Eğitim Türü" required>
                <Select value={form.educationType} onChange={(e) => patch({ educationType: e.target.value })} placeholder="Eğitim türü seçin">
                  <option value="">Eğitim türü seçin</option>
                  {educationTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
              <Field label="Sınav Merkezi">
                <Select value={form.examCenterName} onChange={(e) => patch({ examCenterName: e.target.value })} placeholder="Sınav merkezi seçin">
                  <option value="">Sınav merkezi seçin</option>
                  {examCenterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </Field>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <PhoneIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">İletişim</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Öğrenci Telefonu">
                <PhoneInput value={form.studentPhone} onChange={(v) => patch({ studentPhone: v })} />
              </Field>
              <Field label="Veli Telefonu" required>
                <PhoneInput value={form.parentPhone} onChange={(v) => patch({ parentPhone: v })} />
              </Field>
            </div>
            <Field label="Adres">
              <Textarea value={form.address} onChange={(e) => patch({ address: e.target.value })} rows={3} placeholder="Adres bilgileri" />
            </Field>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-4 bg-surface-1">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                <ClipboardCheckIcon className="h-4 w-4 text-primary" />
              </div>
              <p className="text-base font-semibold text-foreground-strong">Başvuru Durumu</p>
            </div>
          </div>
          <div className="p-5 space-y-5">
            <Field label="Durum">
              <Select value={form.status} onChange={(e) => patch({ status: e.target.value as SedaApplicationFormData['status'] })}>
                {SEDA_APPLICATION_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Notlar">
              <Textarea value={form.notes} onChange={(e) => patch({ notes: e.target.value })} rows={3} placeholder="Ek notlar..." />
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}
