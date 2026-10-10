import {
  CalendarDaysIcon, InfoIcon,
} from 'lucide-react'
import { DatePicker, ToggleRow, Field, NumberInput, FormSection, Banner } from '@/design-system'
import type { ScopedSettings } from '@/types/facility.types'
import type { BranchRecord } from '@/types/facility.types'

interface Props {
  value: ScopedSettings
  onChange: (next: ScopedSettings) => void
  branches: BranchRecord[]
  branchLabel: string
}

export const ScopedSettingsForm = ({ value, onChange }: Props) => {
  const set = <K extends keyof ScopedSettings>(k: K, v: ScopedSettings[K]) => onChange({ ...value, [k]: v })

  return (
    <div className="space-y-[15px]">
      <Banner tone="info" variant="soft" icon={InfoIcon}>
        Bu bölüm sadece bu tesise özel yıllık katılım penceresini tanımlar (tarih aralığı, maksimum
        başvuru, yaş aralığı) — fiilen uygulanır. Devamsızlık/evrak/bildirim gibi diğer kurallar
        <strong> grup formunda</strong> ayarlanır (Otomatik Onay, İkamet Şartı, Evrak Gerekliliği,
        Devamsızlık Hakları, Yoklama Takibi).
      </Banner>

      <FormSection variant="card" icon={CalendarDaysIcon} tone="orange" title="Yıllık Katılım Şartları" subtitle="Bu tesise özel — kapalıysa genel/grup ayarları geçerlidir">
        <ToggleRow label="Yıllık Katılım Sistemi Aktif" checked={value.yearlyEnabled} onChange={(v) => set('yearlyEnabled', v)} />
        {value.yearlyEnabled && (
          <>
            <div className="grid grid-cols-2 gap-[15px]">
              <Field label="Başlangıç Tarihi">
                <DatePicker value={value.yearlyStartDate} onChange={(v) => set('yearlyStartDate', v)} clearable />
              </Field>
              <Field label="Bitiş Tarihi">
                <DatePicker value={value.yearlyEndDate} min={value.yearlyStartDate || undefined} onChange={(v) => set('yearlyEndDate', v)} clearable />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-[15px]">
              <Field label="Maksimum Başvuru" hint="0 = sınırsız"><NumberInput value={value.yearlyMaxApplications} onChange={(n) => set('yearlyMaxApplications', n)} /></Field>
              <Field label="Minimum Yaş" hint="0 = sınırsız"><NumberInput value={value.yearlyMinAge} onChange={(n) => set('yearlyMinAge', n)} /></Field>
              <Field label="Maksimum Yaş" hint="0 = sınırsız"><NumberInput value={value.yearlyMaxAge} onChange={(n) => set('yearlyMaxAge', n)} /></Field>
            </div>
          </>
        )}
      </FormSection>

      <FormSection variant="card" icon={CalendarDaysIcon} tone="pink" title="Tesise Özel Kurs ve Başvuru Kısıtı" subtitle="Genel kuralları bu tesiste geçersiz kılmak için özelleştirin">
        <ToggleRow
          label="Tesise özel başvuru kurallarını etkinleştir"
          description="Açıkken bu tesis için aşağıdaki kural ve kotalar geçerli olur; kapalıyken genel ayarlar uygulanır."
          checked={value.crossFacilityOverride ?? false}
          onChange={(v) => set('crossFacilityOverride', v)}
        />
        {value.crossFacilityOverride && (
          <div className="space-y-[15px] pt-1">
            <ToggleRow
              label="Aynı programa tekrar başvuruyu engelle"
              description="Bu tesiste aynı programa aktif kaydı/başvurusu varken tekrar başvuramaz."
              checked={value.crossFacilitySameBranchBlocked ?? true}
              onChange={(v) => set('crossFacilitySameBranchBlocked', v)}
            />
            <ToggleRow
              label="Aynı kurs grubundan yalnızca 1 kursa izin ver"
              description="Örn: Mutfak grubundaki bir kursa kayıtlıyken başka bir mutfak kursuna başvuramaz."
              checked={value.crossFacilitySameCategoryBlocked ?? true}
              onChange={(v) => set('crossFacilitySameCategoryBlocked', v)}
            />
            <Field label="Tesisteki Maksimum Kurs Hakkı" hint="0 = genel ayar geçerli, örn: 2">
              <NumberInput min={0} value={value.crossFacilityYearlyMaxApplications ?? 0} onChange={(n) => set('crossFacilityYearlyMaxApplications', n)} />
            </Field>
          </div>
        )}
      </FormSection>
    </div>
  )
}
