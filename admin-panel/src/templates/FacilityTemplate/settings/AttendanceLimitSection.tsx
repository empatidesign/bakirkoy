import { RepeatIcon } from 'lucide-react'
import { FormSection, ToggleRow, Field, NumberInput, Select } from '@/design-system'
import type { AttendanceLimitType } from '@/types/facility.types'

interface Props {
  limitType: AttendanceLimitType
  limitCount: number
  resetDay: number
  onLimitTypeChange: (v: AttendanceLimitType) => void
  onLimitCountChange: (v: number) => void
  onResetDayChange: (v: number) => void
  isOverride?: boolean
  overrideEnabled?: boolean
  onOverrideChange?: (v: boolean) => void
}

const LIMIT_OPTIONS: { value: AttendanceLimitType; label: string; desc: string }[] = [
  { value: 'unlimited', label: 'Sınırsız', desc: 'Katılım sayısı kısıtlanmaz — vatandaş istediği kadar başvurabilir' },
  { value: 'daily',    label: 'Günde',    desc: 'Her gün sıfırlanır' },
  { value: 'weekly',   label: 'Haftada',  desc: 'Her hafta başında (Pazartesi) sıfırlanır' },
  { value: 'monthly',  label: 'Aylık',    desc: 'Her ay başında sıfırlanır' },
  { value: 'yearly',   label: 'Yılda',    desc: 'Her takvim yılında belirtilen sayıda başvuru hakkı' },
]

const COUNT_LABEL: Record<AttendanceLimitType, string> = {
  unlimited: '',
  daily:     'Günlük Başvuru Hakkı',
  weekly:    'Haftalık Başvuru Hakkı',
  monthly:   'Aylık Başvuru Hakkı',
  yearly:    'Yıllık Başvuru Hakkı',
}

export const AttendanceLimitSection = ({
  limitType,
  limitCount,
  resetDay,
  onLimitTypeChange,
  onLimitCountChange,
  onResetDayChange,
  isOverride = false,
  overrideEnabled = false,
  onOverrideChange,
}: Props) => {
  const isActive = !isOverride || overrideEnabled
  const selected = LIMIT_OPTIONS.find((o) => o.value === limitType) ?? LIMIT_OPTIONS[0]

  return (
    <FormSection
      variant="card"
      tone="orange"
      icon={RepeatIcon}
      title={isOverride ? 'Katılım Sınırı Override' : 'Katılım Sınırı'}
      subtitle={
        isOverride
          ? 'Bu grup için genel ayarı geçersiz kıl'
          : 'Vatandaşın belirli dönemde kaç kez başvurabileceğini sınırla'
      }
    >
      {isOverride && onOverrideChange && (
        <ToggleRow
          label="Genel ayarı bu grupta geçersiz kıl"
          description="Kapalıysa genel sistem ayarı geçerlidir"
          checked={overrideEnabled}
          onChange={onOverrideChange}
        />
      )}

      {isActive && (
        <>
          <Field label="Sıfırlanma Periyodu">
            <Select
              value={limitType}
              onChange={(e) => onLimitTypeChange(e.target.value as AttendanceLimitType)}
            >
              {LIMIT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
            <p className="mt-1.5 text-[11px] text-foreground-subtle">{selected.desc}</p>
          </Field>

          {limitType !== 'unlimited' && (
            <div className="grid grid-cols-2 gap-[15px]">
              <Field label={COUNT_LABEL[limitType]} hint="0 = sınırsız">
                <NumberInput min={0} value={limitCount} onChange={onLimitCountChange} />
              </Field>

              {limitType === 'monthly' && (
                <Field label="Sıfırlanma Günü" hint="Ayın kaçıncı günü sıfırlanır (1-28)">
                  <NumberInput min={1} max={28} value={resetDay} onChange={onResetDayChange} />
                </Field>
              )}
            </div>
          )}
        </>
      )}

      {isOverride && !overrideEnabled && (
        <p className="text-[12px] text-foreground-subtle italic">
          Genel sistem ayarı kullanılıyor — override aktif değil
        </p>
      )}
    </FormSection>
  )
}
