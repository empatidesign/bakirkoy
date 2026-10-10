import { ShieldAlertIcon } from 'lucide-react'
import { FormSection, ToggleRow, Field, NumberInput } from '@/design-system'

interface Props {
  sameBranchBlocked: boolean
  sameCategoryBlocked?: boolean
  yearlyMaxApplications: number
  onSameBranchBlockedChange: (v: boolean) => void
  onSameCategoryBlockedChange?: (v: boolean) => void
  onYearlyMaxApplicationsChange: (v: number) => void
}

/**
 * Kullanıcı isteği (2026-10-05): "aynı programa veya aynı kategorideki kurslara birden fazla
 * başvuru engellensin. Bir kişi yılda/dönemde en fazla 2 farklı kursa katılabilsin."
 */
export const CrossFacilityLimitSection = ({
  sameBranchBlocked,
  sameCategoryBlocked = true,
  yearlyMaxApplications,
  onSameBranchBlockedChange,
  onSameCategoryBlockedChange,
  onYearlyMaxApplicationsChange,
}: Props) => {
  return (
    <FormSection
      variant="card"
      tone="pink"
      icon={ShieldAlertIcon}
      title="Kurs Gruplama ve Başvuru Kısıtı"
      subtitle="Aynı kursa, aynı kurs grubuna ve dönemsel toplam başvuru sayısına göre kısıtlama kuralları"
    >
      <ToggleRow
        label="Aynı programa tekrar başvuruyu engelle"
        description={'Örnek: bir kişi "Aşçılık" programına aktif başvurusu/kaydı varken (aynı veya farklı tesiste, farklı saatte) "Aşçılık" programına tekrar başvuramaz.'}
        checked={sameBranchBlocked}
        onChange={onSameBranchBlockedChange}
      />

      {onSameCategoryBlockedChange && (
        <ToggleRow
          label="Aynı kurs grubundan (kategori) yalnızca 1 kursa izin ver"
          description={'Örnek: "Mutfak" grubundaki "Pastacılık" kursuna katılmış olan kişi, aynı veya başka bir merkezdeki "Aşçılık / Yemek" kursuna başvuramaz.'}
          checked={sameCategoryBlocked}
          onChange={onSameCategoryBlockedChange}
        />
      )}

      <Field
        label="Dönemsel / Yıllık Toplam Farklı Kurs Hakkı"
        hint="Kişinin bir takvim yılında katılabileceği maksimum farklı kurs sayısı (varsayılan: 2). 0 = sınırsız."
      >
        <NumberInput min={0} value={yearlyMaxApplications} onChange={onYearlyMaxApplicationsChange} />
      </Field>
    </FormSection>
  )
}
