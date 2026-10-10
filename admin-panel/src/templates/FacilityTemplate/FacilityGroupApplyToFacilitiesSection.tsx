import { useState } from 'react'
import { CopyIcon, CheckCircle2Icon, XCircleIcon, Building2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Field, MultiSelect, FormSection, Badge } from '@/design-system'
import type { FacilityModuleService } from './types'
import type { GroupRecord, FacilityRecord, CopyGroupItemResult } from '@/types/facility.types'

interface Props {
  group: GroupRecord
  service: FacilityModuleService
  facilities: FacilityRecord[]
  groupLabel: string
}

// Kullanıcı isteği (2026-10-02): "düzenlemede istenirse başka tesislerde de grup ve
// seansları eklenebilecek, çoklu seçim olabilsin — örnek 1 grup özellikleri atandı bu
// özelliklerle başka tesislerde de seçebilsin." Düzenleme formunun İÇİNDEN, ayrı bir
// modal açmaya gerek kalmadan, aynı anda birden çok hedef tesis seçip grubu (güncel
// kaydedilmiş özellikleriyle) oraya da uygulayabilsin diye eklendi. Mevcut satır
// aksiyonundaki FacilityGroupCopyModal ile aynı backend uç noktasını (groups/{id}/copy)
// kullanır — kopya her zaman pasif oluşur, admin hedefte gözden geçirip aktive eder.
// Yalnızca gerçek üst-seviye kayıtlarda gösterilir (alt gruplar backend'de doğrudan
// kopyalanamaz — SUBGROUP_COPY_NOT_ALLOWED).
export const FacilityGroupApplyToFacilitiesSection = ({ group, service, facilities, groupLabel }: Props) => {
  const [targetIds, setTargetIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<CopyGroupItemResult[] | null>(null)

  if (group.parentGroupId) return null

  const otherFacilities = facilities.filter((f) => f.id !== group.facilityId)
  const options = otherFacilities.map((f) => ({ value: f.id, label: f.name }))

  const apply = async () => {
    if (targetIds.length === 0) return
    setSaving(true)
    try {
      const res = await service.groups.copyToFacilities(group.id, targetIds)
      setResults(res.results)
      const okCount = res.results.filter((r) => r.success).length
      const failCount = res.results.length - okCount
      if (okCount > 0) toast.success(`${okCount} tesise uygulandı (pasif oluşturuldu).`)
      if (failCount > 0) toast.error(`${failCount} tesise uygulanamadı.`)
      setTargetIds([])
    } finally {
      setSaving(false)
    }
  }

  return (
    <FormSection
      icon={Building2Icon}
      title="Başka Tesis(ler)e Uygula"
      subtitle="Bu gruba kaydedilmiş özellikler (ad, tür, cinsiyet/yaş, program, dönem, kontenjan, katılım şartları) seçeceğiniz tesis(ler)e aynen kopyalanır"
      variant="card"
    >
      <Field
        label="Hedef Tesis(ler)"
        hint={otherFacilities.length === 0 ? 'Bu modülde başka tesis bulunmuyor.' : 'Birden fazla tesis seçebilirsiniz. Kopya her zaman pasif oluşur — hedefte gözden geçirip aktive edin.'}
      >
        <MultiSelect
          values={targetIds}
          onChange={setTargetIds}
          options={options}
          placeholder="Hedef tesis(ler) seçiniz..."
          searchPlaceholder="Tesis ara..."
          emptyText="Eşleşen tesis yok"
          disabled={otherFacilities.length === 0}
        />
      </Field>

      <Button
        variant="outline"
        size="sm"
        iconLeft={<CopyIcon className="h-3.5 w-3.5" />}
        isLoading={saving}
        disabled={targetIds.length === 0}
        onClick={apply}
      >
        {targetIds.length > 0 ? `${targetIds.length} Tesise Uygula` : 'Tesislere Uygula'}
      </Button>

      {results && (
        <div className="space-y-1.5 pt-1">
          {results.map((r) => (
            <div key={r.facilityId} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
              <span className="text-sm font-medium text-foreground-default">{r.facilityName}</span>
              {r.success ? (
                <Badge tone="success"><CheckCircle2Icon className="h-3 w-3" /> Uygulandı (pasif)</Badge>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Badge tone="danger"><XCircleIcon className="h-3 w-3" /> Başarısız</Badge>
                  {r.error && <span className="type-caption text-danger">{r.error}</span>}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="type-caption text-foreground-muted">"(Kopya)" eki isme otomatik eklenir — {groupLabel.toLocaleLowerCase('tr')} adını hedefte dilediğiniz gibi değiştirebilirsiniz.</p>
    </FormSection>
  )
}
