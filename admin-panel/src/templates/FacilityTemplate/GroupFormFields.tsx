import type { Dispatch, SetStateAction } from 'react'
import { CalendarDaysIcon, ClipboardCheckIcon, FileTextIcon, PowerIcon, QrCodeIcon, UsersIcon, ShieldCheckIcon, MapPinIcon, BookOpenIcon, UploadIcon, ListIcon, PlusIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/framework/auth/AuthContext'
import { Input, Textarea, Label, Switch, SegmentedControl, Select, DatePicker, FormSection, Field, ToggleRow, CheckboxRow, ToggleChip, AdminFormShell, NumberInput, IconButton } from '@/design-system'
import { RecurringScheduleField, type DayPlan, WEEK_DAYS } from '@/components/specialized/RecurringScheduleField'
import { todayIso } from '@/lib/utils'
import { FULL_RESIDENCY_MODE_OPTIONS } from '@/lib/residency'
import { FacilityGroupApplyToFacilitiesSection } from './FacilityGroupApplyToFacilitiesSection'
import type { FacilityModuleConfig } from './moduleConfig'
import type { FacilityModuleService } from './types'
import type { BranchRecord, GroupForm, GroupRecord, FacilityRecord, InstructorOption, RequiredDocument, AttendanceLimitType } from '@/types/facility.types'

interface Props {
  config: FacilityModuleConfig
  form: GroupForm
  setForm: Dispatch<SetStateAction<GroupForm>>
  branches: BranchRecord[]
  instructors: InstructorOption[]
  documentLibrary: RequiredDocument[]
  facilityCapacity?: number
  mode?: 'create' | 'edit'
  isSubGroup?: boolean
  editingRow?: GroupRecord | null
  service?: FacilityModuleService
  allFacilities?: FacilityRecord[]
  allGroups?: GroupRecord[]
}

const FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
]

const addMonths = (d: Date, m: number) => {
  const r = new Date(d)
  r.setMonth(r.getMonth() + m)
  return r
}
const fmtTr = (d: Date) => d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const firstPeriod = (startIso?: string | null, months?: number): { start: string; end: string } | null => {
  if (!startIso || !months || months <= 0) return null
  const start = new Date(`${startIso}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const pe = addMonths(start, months)
  pe.setDate(pe.getDate() - 1)
  return { start: fmtTr(start), end: fmtTr(pe) }
}

export const GroupFormFields = ({ config, form, setForm, branches, instructors, documentLibrary, facilityCapacity, mode = 'create', isSubGroup = false, editingRow, service, allFacilities, allGroups }: Props) => {
  const { can } = useAuth()
  const navigate = useNavigate()
  const T = config.terminology

  const prerequisiteOptions = (allGroups ?? []).filter((g) => g.id !== editingRow?.id && !g.parentGroupId)

  const addCustomQuestion = () =>
    setForm((p) => ({
      ...p,
      customQuestions: [...p.customQuestions, { id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `q-${Date.now()}`, question: '', required: true }],
    }))
  const updateCustomQuestion = (id: string, patch: Partial<GroupForm['customQuestions'][number]>) =>
    setForm((p) => ({ ...p, customQuestions: p.customQuestions.map((q) => (q.id === id ? { ...q, ...patch } : q)) }))
  const removeCustomQuestion = (id: string) =>
    setForm((p) => ({ ...p, customQuestions: p.customQuestions.filter((q) => q.id !== id) }))

  const dayPlans: DayPlan[] = (() => {
    const grouped: Record<string, { startTime: string; endTime: string }[]> = {}
    for (const s of form.schedules) {
      const key = s.day.toLowerCase()
      if (!grouped[key]) grouped[key] = []
      grouped[key].push({ startTime: s.start, endTime: s.end })
    }
    return WEEK_DAYS.filter((d) => !!grouped[d.key]).map((d) => ({ day: d.key, slots: grouped[d.key] }))
  })()

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()

  const onScheduleChange = (plans: DayPlan[]) =>
    setForm((p) => ({
      ...p,
      days: plans.map((dp) => capitalize(dp.day)),
      schedules: plans.flatMap((dp) => dp.slots.map((s) => ({ day: capitalize(dp.day), start: s.startTime, end: s.endTime }))),
    }))

  const onTypeChange = (v: GroupForm['type']) =>
    setForm((p) => ({
      ...p,
      type: v,
      academyWhitelistEnabled: v === 'akademi' ? true : p.academyWhitelistEnabled,
    }))

  const toggleDocument = (id: string, on: boolean) =>
    setForm((p) => ({
      ...p,
      requiredDocumentIds: on ? [...p.requiredDocumentIds, id] : p.requiredDocumentIds.filter((x) => x !== id),
      documentFormats: on ? p.documentFormats : Object.fromEntries(Object.entries(p.documentFormats).filter(([k]) => k !== id)),
    }))

  const toggleDocFormat = (docId: string, format: string) =>
    setForm((p) => {
      const current = p.documentFormats[docId] ?? []
      const next = current.includes(format) ? current.filter((f) => f !== format) : [...current, format]
      const formats = { ...p.documentFormats }
      if (next.length > 0) formats[docId] = next
      else delete formats[docId]
      return { ...p, documentFormats: formats }
    })

  const hasSessionData = mode === 'edit' && (
    Number(form.capacity) > 0 || form.schedules.length > 0 || !!form.periodStart || !!form.periodEnd
  )
  const isParentMode = !isSubGroup && !form.parentGroupId && !hasSessionData
  const showSessionSettings = mode === 'create' || !isParentMode
  const isKurs = form.type === 'kurs'
  const isAkademi = form.type === 'akademi'
  const isRecurring = form.periodType === 'recurring'
  const periodMode: 'range' | 'recurring' | 'days' =
    form.periodType === 'recurring' ? 'recurring' : form.periodUnit === 'day' ? 'days' : 'range'
  const setPeriodMode = (mode: 'range' | 'recurring' | 'days') =>
    setForm((p) => ({
      ...p,
      periodType: mode === 'recurring' ? 'recurring' : 'date_range',
      periodUnit: mode === 'days' ? 'day' : 'month',
    }))
  const dayEnd = form.periodStart && Number(form.periodDays) > 0
    ? new Date(new Date(form.periodStart).getTime() + Number(form.periodDays) * 86400000).toISOString().slice(0, 10)
    : ''

  return (
    <AdminFormShell
      icon={UsersIcon}
      title={mode === 'edit' ? `${T.groupSingular} Düzenle` : isSubGroup ? 'Seans Oluştur' : `Yeni ${T.groupSingular} Ekle`}
      subtitle={showSessionSettings ? 'Kontenjan, dönem, yaş/cinsiyet ve katılım şartları' : 'Ana grup — ders/program adı, branş ve katılım bölgesi. Seanslar buraya bağlanır.'}
      badge={mode === 'edit' ? 'Düzenleme' : 'Yeni kayıt'}
      tone="blue"
    >
      {isParentMode && !showSessionSettings && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 mb-2">
          <p className="text-xs text-blue-700 font-medium">Ana Grup (Ders/Program) oluşturuyorsunuz</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Seçtiğiniz tür (Kurs veya Akademi) ve katılım bölgesi tüm seanslara otomatik uygulanır.
            Kontenjan, yaş/cinsiyet, dönem ve yoklama detayları Seans Oluştur ekranında girilir.
          </p>
        </div>
      )}

      {isSubGroup && (
        <div className={`rounded-lg border p-3 mb-2 ${isAkademi ? 'border-[#5a8a2a]/20 bg-[#f1f7e8]' : 'border-[#0f4c81]/20 bg-[#eef3f8]'}`}>
          <p className={`text-xs font-medium ${isAkademi ? 'text-[#5a8a2a]' : 'text-[#0f4c81]'}`}>
            {isAkademi ? 'Akademi Seansı' : 'Kurs Seansı'}
          </p>
          <p className={`text-xs mt-0.5 ${isAkademi ? 'text-[#3f5d1a]' : 'text-[#0a3a66]'}`}>
            {isAkademi
              ? 'Akademi: TC kimlik numarası listesi yüklenerek kayıt yapılır, genel başvuru alınmaz. Dönem/süre yukarıdan belirlenir.'
              : 'Kurs: Dönemler halinde yürütülür. Başvuru tarihleri ve dönem bilgisi girilir.'}
          </p>
        </div>
      )}

      <FormSection icon={UsersIcon} title="Temel Bilgiler" variant="card" tone="blue">
        <Field label={`${T.groupSingular} Adı`} required>
          <Input placeholder={`${T.groupSingular} adını giriniz...`} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </Field>

        <Field label={T.branchSingular} required>
          <Select searchable searchPlaceholder={`${T.branchSingular} ara...`} value={form.branchId} onChange={(e) => {
            const branchId = e.target.value
            setForm((p) => ({ ...p, branchId }))
          }}>
            <option value="">{T.branchSingular} seçiniz...</option>
            {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            {form.branchId && !branches.some((b) => b.id === form.branchId) && (
              <option value={form.branchId}>{editingRow?.branchName || 'Mevcut Program'}</option>
            )}
          </Select>
        </Field>

        {!isSubGroup && (isParentMode || mode === 'edit') && (
          <Field label="Grup Türü" required>
            <SegmentedControl value={form.type} onChange={(v) => onTypeChange(v as GroupForm['type'])} columns={2}
              options={[
                { value: 'kurs', label: 'Kurs', description: 'Dönemli program' },
                { value: 'akademi', label: 'Akademi', description: 'TC whitelist, dönem serbest' },
              ]} />
          </Field>
        )}
        {showSessionSettings && (
            <>
              <Field label="Cinsiyet">
                <SegmentedControl value={form.gender} onChange={(v) => setForm((p) => ({ ...p, gender: v as GroupForm['gender'] }))} columns={3}
                  options={[{ value: 'mixed', label: 'Karma', tone: 'primary' }, { value: 'male', label: 'Erkek', tone: 'blue' }, { value: 'female', label: 'Kadın', tone: 'pink' }]} />
              </Field>
              <Field label="Eğitmen">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <Select searchable searchPlaceholder="Eğitmen ara..." value={form.instructorId} onChange={(e) => setForm((p) => ({ ...p, instructorId: e.target.value }))}>
                      <option value="">Eğitmen seçiniz (opsiyonel)...</option>
                      {instructors.map((i) => <option key={i.id} value={i.id}>{i.fullName}{i.specialty ? ` - ${i.specialty}` : ''}</option>)}
                    </Select>
                  </div>
                  {can('admins.view') && (
                    <IconButton type="button" tone="default" title="Eğitmen listesi" onClick={() => navigate('/admin?tab=admins')}>
                      <ListIcon className="h-4 w-4" />
                    </IconButton>
                  )}
                  {can('admins.create') && (
                    <IconButton type="button" tone="primary" title="Yeni eğitmen ekle" onClick={() => navigate('/admin?tab=admins&create=1&role=tpl-egitmen')}>
                      <PlusIcon className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
              </Field>
            </>
        )}
      </FormSection>

      {mode === 'edit' && editingRow && service && allFacilities && (
        <FacilityGroupApplyToFacilitiesSection
          group={editingRow}
          service={service}
          facilities={allFacilities}
          groupLabel={T.groupSingular}
        />
      )}

      {isParentMode && !showSessionSettings && (
        <FormSection icon={MapPinIcon} title="Katılım Bölgesi" variant="card" tone="pink" subtitle="Bu ders/programa kimler başvurabilir — tüm seanslara uygulanan genel ayar">
          <Field label="Başvuru Kriteri">
            <Select value={form.residencyMode || 'sultangazi_only'} onChange={(e) => setForm((p) => ({ ...p, residencyMode: e.target.value as GroupForm['residencyMode'] }))}>
              {FULL_RESIDENCY_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </FormSection>
      )}

      {isParentMode && !showSessionSettings && (
        <div className="rounded-lg border border-dashed border-border p-4 flex items-center justify-center text-center">
          <p className="type-caption text-foreground-muted">Ana grubu kaydettikten sonra <strong>Seans Oluştur</strong> butonunu kullanarak yaş grupları, dönem/kontenjan ve seans programını tanımlayabilirsiniz.</p>
        </div>
      )}

      {showSessionSettings && <>
        <FormSection icon={ClipboardCheckIcon} title="Kontenjan ve Yaş" variant="card" tone="green">
          <div className="grid grid-cols-2 gap-[15px]">
            <Field label="Kontenjan" required={form.isActive}>
              <Input sanitize="digits" placeholder="Örn. 20" value={form.capacity} onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))} />
              {facilityCapacity ? (
                Number(form.capacity) > facilityCapacity
                  ? <p className="type-caption text-danger">Kontenjan, tesis kapasitesini ({facilityCapacity.toLocaleString('tr-TR')}) aşamaz.</p>
                  : <p className="type-caption">Tesis kapasitesi: {facilityCapacity.toLocaleString('tr-TR')}</p>
              ) : null}
            </Field>
            <Field label="Yedek Kontenjan">
              <Input sanitize="digits" placeholder="Örn. 5" value={form.reserveCapacity} onChange={(e) => setForm((p) => ({ ...p, reserveCapacity: e.target.value }))} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-[15px]">
            <Field label="Yaş (En Az)" required>
              <Input sanitize="digits" placeholder="Örn. 8" value={form.ageMin} onChange={(e) => setForm((p) => ({ ...p, ageMin: e.target.value }))} />
            </Field>
            <Field label="Yaş (En Çok)" required>
              <Input sanitize="digits" placeholder="Örn. 14" value={form.ageMax} onChange={(e) => setForm((p) => ({ ...p, ageMax: e.target.value }))} />
            </Field>
          </div>
        </FormSection>

        <FormSection icon={MapPinIcon} title="İkamet ve Katılım Bölgesi" variant="card" tone="pink"
          subtitle="Bakırköy içi/dışı, T.C./yabancı ve ikametgah şartı">
          <Field label="Katılım Bölgesi" hint={isSubGroup ? "Ana gruptan geliyor, bu seans için değiştirilebilir" : "Bu gruba/seansa kimlerin başvurabileceğini belirler"}>
            <Select value={form.residencyMode || 'sultangazi_only'} onChange={(e) => setForm((p) => ({ ...p, residencyMode: e.target.value as GroupForm['residencyMode'] }))}>
              {FULL_RESIDENCY_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <ToggleRow label="İkamet Şartı Gerekli" description="Açıksa başvuruda ikametgah belgesi zorunludur"
            checked={form.residenceRequired}
            onChange={(v) => setForm((p) => ({ ...p, residenceRequired: v }))} />
        </FormSection>

        <FormSection icon={CalendarDaysIcon} title="Program" variant="card" tone="violet">
          <Field label="Yoklama Takibi">
            <SegmentedControl value={form.attendanceMode} onChange={(v) => setForm((p) => ({ ...p, attendanceMode: v as GroupForm['attendanceMode'] }))} columns={3}
              options={[
                { value: 'full', label: 'Tam Takip', description: 'Yoklama + devamsızlık' },
                { value: 'tracking_only', label: 'Sadece Yoklama', description: 'Devamsızlık yok' },
                { value: 'off', label: 'Yok', description: 'Yoklama alınmaz' },
              ]} />
          </Field>

          {form.attendanceMode !== 'off' && (
            <ToggleRow
              label="Geç Gelme Takibi"
              description={'Kapalıysa yoklama ekranında "Geç Geldi" seçeneği hiç görünmez.'}
              checked={form.lateTrackingEnabled}
              onChange={(v) => setForm((p) => ({ ...p, lateTrackingEnabled: v }))}
            />
          )}

          <RecurringScheduleField value={dayPlans} onChange={onScheduleChange} singleSlotPerDay />

          <Field label="Açıklama">
            <Textarea rows={2} placeholder="Grup açıklaması (opsiyonel)..." value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </Field>

          <Field label="Kurallar" hint="Her kuralı ayrı satıra yazın.">
            <Textarea rows={3} placeholder="Örn: Spor kıyafeti zorunludur.&#10;Antrenmana zamanında gelinmelidir." value={form.requirements} onChange={(e) => setForm((p) => ({ ...p, requirements: e.target.value }))} />
          </Field>

          <Field label="Başvuru Koşulları">
            <Textarea rows={2} placeholder="Başvuru için gereken koşullar (opsiyonel)..." value={form.applicationConditions} onChange={(e) => setForm((p) => ({ ...p, applicationConditions: e.target.value }))} />
          </Field>

          <Field label="Etkinlik Hakkında">
            <Textarea rows={3} placeholder="Program hakkında tanıtım metni (opsiyonel)..." value={form.aboutHtml} onChange={(e) => setForm((p) => ({ ...p, aboutHtml: e.target.value }))} />
          </Field>
        </FormSection>

        {(isKurs || isAkademi) && (
          <FormSection icon={CalendarDaysIcon} title="Dönem / Periyot Ayarları" variant="card" tone="info">
            <div className="rounded-lg border border-[#0f4c81]/20 bg-[#eef3f8] px-3 py-2.5 text-[12px] text-[#0f4c81] leading-relaxed">
              <span className="font-semibold">Dönem mantığı:</span>
              {' '}
              {periodMode === 'recurring'
                ? 'Başlangıçtan itibaren, dönem süresi (ay) kadar dönemler siz grubu pasife çekene kadar otomatik oluşur; her dönem bitince sıradaki dönemin seansları arka planda üretilir. Her katılımcı asıl listeye girdiği günden itibaren bir dönem süresi kadar hak kazanır. Her dönemin kontenjanı bağımsız ilerler.'
                : periodMode === 'days'
                ? 'Tek dönem: başlangıç tarihinden itibaren girilen gün sayısı kadar sürer. Kısa/tek seferlik programlar için (ör. 10 veya 30 günlük).'
                : 'Dönem başı ve bitişi sabittir. Seanslar bu dönem içinde haftalık programa göre üretilir.'}
            </div>

            <Field label="Dönem Tipi">
              <SegmentedControl
                value={periodMode}
                onChange={(v) => setPeriodMode(v as 'range' | 'recurring' | 'days')}
                columns={3}
                options={[
                  { value: 'range', label: 'Tarih Aralığı', description: 'Başlangıç ve bitiş tarihi' },
                  { value: 'recurring', label: 'Tekrarlı (Ay)', description: 'Aylık süre, kapatana kadar' },
                  { value: 'days', label: 'Süre (Gün)', description: 'Başlangıç + gün sayısı' },
                ]}
              />
            </Field>

            {periodMode === 'days' ? (
              <>
                <div className="grid grid-cols-2 gap-[15px]">
                  <Field label="Dönem Başlangıcı">
                    <DatePicker value={form.periodStart} onChange={(v) => setForm((p) => ({ ...p, periodStart: v }))} min={todayIso()} clearable />
                  </Field>
                  <Field label="Dönem Süresi (Gün)">
                    <Input sanitize="digits" placeholder="Örn. 10, 30 veya 90" value={form.periodDays} onChange={(e) => setForm((p) => ({ ...p, periodDays: e.target.value }))} />
                    <p className="type-caption">Başlangıçtan itibaren bu kadar gün sürer (tek dönem)</p>
                  </Field>
                </div>
                {dayEnd && (
                  <div className="rounded-lg border border-border bg-surface-1 px-3 py-2">
                    <p className="type-caption text-foreground-muted">
                      Dönem: <span className="font-semibold text-foreground-default">{form.periodStart}</span> → <span className="font-semibold text-foreground-default">{dayEnd}</span> ({form.periodDays} gün)
                    </p>
                  </div>
                )}
              </>
            ) : periodMode === 'range' ? (
              <div className="grid grid-cols-2 gap-[15px]">
                <Field label="Dönem Başlangıcı">
                  <DatePicker value={form.periodStart} onChange={(v) => setForm((p) => ({ ...p, periodStart: v }))} min={todayIso()} clearable />
                </Field>
                <Field label="Dönem Bitişi">
                  <DatePicker value={form.periodEnd} onChange={(v) => setForm((p) => ({ ...p, periodEnd: v }))} min={form.periodStart || todayIso()} clearable />
                </Field>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-[15px]">
                  <Field label="Dönem Başlangıcı">
                    <DatePicker value={form.periodStart} onChange={(v) => setForm((p) => ({ ...p, periodStart: v }))} min={todayIso()} clearable />
                  </Field>
                  <Field label="Dönem Süresi (Ay)">
                    <Input sanitize="digits" placeholder="Örn. 3 veya 4" value={form.periodMonths} onChange={(e) => setForm((p) => ({ ...p, periodMonths: e.target.value }))} />
                    <p className="type-caption">Her dönem bu kadar ay sürer; siz grubu pasife çekene kadar tekrar eder</p>
                  </Field>
                </div>
                {(() => {
                  const first = firstPeriod(form.periodStart, Number(form.periodMonths))
                  if (!first) return null
                  return (
                    <div className="rounded-lg border border-border bg-surface-1 p-3">
                      <p className="type-caption mb-2 font-semibold text-foreground-muted">İlk dönem</p>
                      <div className="flex items-center gap-2 rounded-field bg-surface-0 px-2.5 py-1.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">1</span>
                        <span className="type-caption text-foreground-default">{first.start} – {first.end}</span>
                      </div>
                      <p className="type-caption mt-2 text-foreground-muted">
                        Bu dönem her {form.periodMonths} ayda bir, siz grubu pasife çekene kadar otomatik tekrar eder. Her dönem bitince sıradaki dönemin seansları arka planda üretilir.
                      </p>
                    </div>
                  )
                })()}
              </>
            )}

            <div className="grid grid-cols-2 gap-[15px]">
              <Field label="Başvuru Başlangıcı">
                <DatePicker value={form.applicationStartDate} onChange={(v) => setForm((p) => ({ ...p, applicationStartDate: v }))} min={todayIso()} clearable />
                <p className="type-caption">{isRecurring ? 'Boş ise oluşturma tarihinden başlar' : 'Başvuruların açıldığı tarih'}</p>
              </Field>
              <Field label="Başvuru Bitişi">
                <DatePicker value={form.applicationEndDate} onChange={(v) => setForm((p) => ({ ...p, applicationEndDate: v }))} min={form.applicationStartDate || ''} clearable />
                <p className="type-caption">{isRecurring ? 'Boş ise son dönemin başlangıcına kadar' : 'Başvuruların kapandığı tarih'}</p>
              </Field>
            </div>
          </FormSection>
        )}

        {isAkademi && (
          <FormSection icon={BookOpenIcon} title="Akademi Ayarları" variant="card" tone="warning">
            <div className="rounded-lg border border-[#5a8a2a]/20 bg-[#f1f7e8] px-3 py-2.5 text-[12px] text-[#5a8a2a] leading-relaxed space-y-1">
              <p>
                <span className="font-semibold">Akademi kayıt mantığı:</span>
                {' '}Genel başvuru alınmaz. TC kimlik numaraları liste olarak yüklenir. Süre/dönem yukarıdaki <span className="font-semibold">Dönem / Periyot Ayarları</span> bölümünden belirlenir.
              </p>
            </div>

            <div className="rounded-lg border border-[#5a8a2a]/20 bg-[#f1f7e8]/60 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <UploadIcon className="h-3.5 w-3.5 text-[#5a8a2a]" />
                <span className="text-xs font-semibold text-[#5a8a2a]">TC Kimlik Whitelist</span>
              </div>
              <p className="text-[11px] text-[#3f5d1a] leading-relaxed">
                Akademi grubu oluşturulduktan sonra grup detayına girerek TC kimlik numaralarını liste halinde yükleyebilirsiniz.
              </p>
            </div>

            <ToggleRow
              label="TC Whitelist Zorunlu"
              description="Açıksa sadece listede olan TC'ler başvurabilir"
              checked={form.academyWhitelistEnabled}
              onChange={(v) => setForm((p) => ({ ...p, academyWhitelistEnabled: v }))}
            />
          </FormSection>
        )}

        <FormSection icon={QrCodeIcon} title="Seans Girişi (QR)" variant="card" tone="blue">
          <div className="grid grid-cols-2 gap-[15px]">
            <Field label="Giriş Toleransı (dk)">
              <Input sanitize="digits" placeholder="Örn. 10" value={form.entryGraceMinutes} onChange={(e) => setForm((p) => ({ ...p, entryGraceMinutes: e.target.value }))} />
            </Field>
          </div>
          <p className="type-caption">Katılımcının QR ile girişi seans başlamadan 30 dk önce açılır ve bu tolerans süresi kadar sonrasına kadar geçerlidir.</p>
        </FormSection>

        <FormSection icon={FileTextIcon} title="Evrak Şartları" variant="card" tone="orange">
          {config.id === 'accessible' && (
            <p className="type-caption rounded-field border border-warning/30 bg-warning-soft px-3 py-2 text-warning">
              Bu modülde SGK Engelli Sağlık Kurulu Raporu, Sağlık Raporu ve İkametgâh Belgesi her grupta
              otomatik olarak zorunludur — "Evrak Gerekli" kapalı olsa bile vatandaştan istenir.
            </p>
          )}
          <ToggleRow label="Evrak Gerekli" description="Başvuruda katılımcıdan evrak yüklenmesi istenir"
            checked={form.documentsRequired}
            onChange={(v) => setForm((p) => ({ ...p, documentsRequired: v, requiredDocumentIds: v ? p.requiredDocumentIds : [] }))} />
          {form.documentsRequired && (
            documentLibrary.length === 0 ? (
              <p className="type-caption text-warning">Bu modül için evrak kütüphanesi tanımlı değil.</p>
            ) : (
              <div className="space-y-2">
                <Label>İstenen Evraklar</Label>
                {documentLibrary.map((doc) => {
                  const isSelected = form.requiredDocumentIds.includes(doc.id)
                  const selectedFormats = form.documentFormats[doc.id] ?? []
                  return (
                    <div key={doc.id} className="space-y-1.5">
                      <CheckboxRow variant="inline" label={doc.label} description={doc.description}
                        checked={isSelected} onChange={(v) => toggleDocument(doc.id, v)} />
                      {isSelected && (
                        <div className="ml-6 flex items-center gap-1.5">
                          <span className="type-caption">Kabul edilen format:</span>
                          {FORMAT_OPTIONS.map((f) => (
                            <ToggleChip key={f.value} active={selectedFormats.includes(f.value)} onClick={() => toggleDocFormat(doc.id, f.value)} tone="info">
                              {f.label}
                            </ToggleChip>
                          ))}
                          {selectedFormats.length === 0 && <span className="type-caption text-text-3">tümü kabul</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          )}
        </FormSection>

        {!isSubGroup && (
          <FormSection icon={BookOpenIcon} title="Önkoşul Kurs ve Özel Sorular" variant="card" tone="violet"
            subtitle="Bu gruba başvurmak için önce tamamlanması gereken bir kurs veya özel evet/hayır soruları">
            <Field label="Önkoşul Kurs" hint="Seçilirse, yalnızca bu kursa kayıtlı/tamamlamış kişiler başvurabilir (örn. Arapça Seviye 2 → önkoşul: Arapça Seviye 1)">
              <Select value={form.prerequisiteGroupId} onChange={(e) => setForm((p) => ({ ...p, prerequisiteGroupId: e.target.value }))}>
                <option value="">Önkoşul yok</option>
                {prerequisiteOptions.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
            </Field>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Label>Özel Sorular</Label>
                <button type="button" onClick={addCustomQuestion} className="type-caption font-semibold text-primary hover:underline">
                  + Soru Ekle
                </button>
              </div>
              <p className="type-caption">
                Örn. Havuz'da "Yüzme biliyor musunuz?" — vatandaş başvuru formunda evet/hayır olarak yanıtlar.
              </p>
              {form.customQuestions.length === 0 ? (
                <p className="type-caption text-text-3">Henüz özel soru eklenmedi.</p>
              ) : (
                <div className="space-y-2">
                  {form.customQuestions.map((q, i) => (
                    <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-field border border-border bg-surface-1 px-3 py-2.5">
                      <span className="type-caption tabular-nums">{i + 1}.</span>
                      <Input
                        className="min-w-[220px] flex-1"
                        placeholder="Örn. Yüzme biliyor musunuz?"
                        value={q.question}
                        onChange={(e) => updateCustomQuestion(q.id, { question: e.target.value })}
                      />
                      <span className="flex items-center gap-1.5">
                        <span className="type-caption">Zorunlu</span>
                        <Switch aria-label={`${q.question || 'Soru'} zorunlu`} checked={q.required} onCheckedChange={(v) => updateCustomQuestion(q.id, { required: v })} />
                      </span>
                      <button type="button" onClick={() => removeCustomQuestion(q.id)} className="type-caption font-semibold text-danger hover:underline">
                        Kaldır
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </FormSection>
        )}

        <FormSection icon={ShieldCheckIcon} title="Başvuru Onay Sistemi" variant="card" tone="success">
          <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-700 leading-relaxed">
            <span className="font-semibold">Onay mantığı:</span>
            {' '}Otomatik onay açıksa başvurular anında kabul edilir; kapalıysa yönetici onayına düşer.
          </div>
          <ToggleRow label="Otomatik Onay" description="Açık: başvurular anında onaylanır · Kapalı: yönetici onayı gerekir"
            checked={form.autoApprove}
            onChange={(v) => setForm((p) => ({ ...p, autoApprove: v }))} />
        </FormSection>

        <FormSection icon={ClipboardCheckIcon} title="Devamsızlık Hakları" variant="card" tone="danger">
          <div className="grid grid-cols-2 gap-[15px]">
            <Field label="Devamsızlık Hakkı (Toplam)">
              <Input sanitize="digits" placeholder="Örn. 5" value={form.absenceLimit} onChange={(e) => setForm((p) => ({ ...p, absenceLimit: e.target.value }))} />
            </Field>
            <Field label="Üst Üste Devamsızlık Hakkı">
              <Input sanitize="digits" placeholder="Örn. 3" value={form.consecutiveAbsenceLimit} onChange={(e) => setForm((p) => ({ ...p, consecutiveAbsenceLimit: e.target.value }))} />
            </Field>
          </div>
          <p className="type-caption">Hak dolan katılımcı programdan çıkarılır, yerine ilk yedek asıl olarak alınır.</p>
        </FormSection>

        {isSubGroup && (
          <FormSection icon={CalendarDaysIcon} title="Katılım Sınırı (Override)" variant="card" tone="info"
            subtitle="Bu alt grupta genel sistem ayarını geçersiz kıl">
            <ToggleRow
              label="Genel katılım sınırını bu grupta değiştir"
              description="Kapalıysa genel sistem ayarı geçerlidir"
              checked={form.attendanceLimitOverride ?? false}
              onChange={(v) => setForm((p) => ({ ...p, attendanceLimitOverride: v }))}
            />
            {form.attendanceLimitOverride && (
              <>
                <Field label="Sıfırlanma Periyodu">
                  <Select
                    value={form.attendanceLimitType ?? 'unlimited'}
                    onChange={(e) => setForm((p) => ({ ...p, attendanceLimitType: e.target.value as AttendanceLimitType }))}
                  >
                    <option value="unlimited">Sınırsız</option>
                    <option value="daily">Günde</option>
                    <option value="weekly">Haftada</option>
                    <option value="monthly">Aylık</option>
                    <option value="yearly">Yılda</option>
                  </Select>
                </Field>
                {(form.attendanceLimitType ?? 'unlimited') !== 'unlimited' && (
                  <Field label="Dönem Başvuru Hakkı" hint="0 = sınırsız">
                    <NumberInput
                      min={0}
                      value={Number(form.attendanceLimitCount ?? 0)}
                      onChange={(v) => setForm((p) => ({ ...p, attendanceLimitCount: String(v) }))}
                    />
                  </Field>
                )}
              </>
            )}
          </FormSection>
        )}

        <FormSection icon={PowerIcon} title="Durum" variant="card" tone="green">
          <div className="flex items-center justify-between gap-[15px]">
            <Label>Aktif</Label>
            <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
          </div>
        </FormSection>
      </>}

      {!showSessionSettings && <FormSection icon={PowerIcon} title="Durum" variant="card" tone="green">
        <div className="flex items-center justify-between gap-[15px]">
          <Label>Aktif</Label>
          <Switch checked={form.isActive} onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))} />
        </div>
      </FormSection>}
    </AdminFormShell>
  )
}
