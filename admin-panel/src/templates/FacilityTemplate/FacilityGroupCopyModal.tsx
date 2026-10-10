import { useEffect, useState } from 'react'
import { CopyIcon, CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Field, Input, MultiSelect, Banner, Badge, ToggleRow } from '@/design-system'
import type { FacilityModuleService } from './types'
import type { GroupRecord, FacilityRecord } from '@/types/facility.types'
import type { CopyGroupItemResult } from '@/types/facility.types'

interface Props {
  group: GroupRecord | null
  service: FacilityModuleService
  facilities: FacilityRecord[]
  groupLabel: string
  onClose: () => void
  onSingleCopyCreated: (targetFacilityId: string, groupId: string) => void
}

export const FacilityGroupCopyModal = ({ group, service, facilities, groupLabel, onClose, onSingleCopyCreated }: Props) => {
  const [targetIds, setTargetIds] = useState<string[]>([])
  const [name, setName] = useState('')
  const [includeSubGroups, setIncludeSubGroups] = useState(true)
  const [includeContent, setIncludeContent] = useState(true)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<CopyGroupItemResult[] | null>(null)

  useEffect(() => {
    setTargetIds(group ? [group.facilityId] : [])
    setName(group ? `${group.name} (Kopya)` : '')
    setIncludeSubGroups(true)
    setIncludeContent(true)
    setResults(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id])

  if (!group) return null

  const scheduleSummary = group.schedules && group.schedules.length > 0
    ? group.schedules.map((s) => `${s.day} ${s.start}–${s.end}`).join(', ')
    : 'Program tanımlı değil'

  const options = facilities.map((f) => ({ value: f.id, label: f.id === group.facilityId ? `${f.name} (bu tesis)` : f.name }))
  const nameError = name.trim() ? undefined : 'Yeni grup adı zorunludur.'

  const save = async () => {
    if (targetIds.length === 0 || nameError) return
    setSaving(true)
    try {
      const res = await service.groups.copyToFacilities(group.id, targetIds, { name: name.trim(), includeSubGroups, includeContent })
      setResults(res.results)
      const okCount = res.results.filter((r) => r.success).length
      const failCount = res.results.length - okCount
      if (okCount > 0) toast.success(`${okCount} tesise kopyalandı (pasif oluşturuldu).`)
      if (failCount > 0) toast.error(`${failCount} tesise kopyalanamadı.`)

      const onlyResult = res.results.length === 1 ? res.results[0] : null
      if (onlyResult?.success && onlyResult.groupId) {
        onSingleCopyCreated(onlyResult.facilityId, onlyResult.groupId)
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!group}
      onClose={onClose}
      title={`${groupLabel} Kopyala`}
      subtitle={`"${group.name}" — yeni ve bağımsız bir ${groupLabel.toLocaleLowerCase('tr')} olarak kopyalanacak`}
      width={560}
      className="max-w-[96vw]"
      footer={
        results ? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Kapat</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>İptal</Button>
            <Button variant="primary" iconLeft={<CopyIcon className="h-4 w-4" />} isLoading={saving} disabled={targetIds.length === 0 || !!nameError} onClick={save}>
              Kopyala
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4 p-5">
        {!results && (
          <>
            <Banner tone="info" variant="soft">
              Tüm şartlar ve ayarlar (tür, cinsiyet/yaş, ikamet, evrak, kontenjan, dönem, gün-saat programı) aynen kopyalanır.
              Başvurular, kayıtlar ve yoklamalar <strong>kopyalanmaz</strong> — kopya yeni açılmış gibi boş ve tamamen bağımsızdır,
              her zaman <strong>pasif</strong> oluşturulur.
            </Banner>

            <Field label="Yeni Ad" required error={nameError}>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder={`Yeni ${groupLabel.toLocaleLowerCase('tr')} adı`} />
            </Field>

            <Field label="Hedef Tesis(ler)" required hint={`Program: ${scheduleSummary}`}>
              <MultiSelect
                values={targetIds}
                onChange={setTargetIds}
                options={options}
                placeholder="Hedef tesis(ler) seçiniz..."
                searchPlaceholder="Tesis ara..."
                emptyText="Eşleşen tesis yok"
              />
            </Field>

            <div className="space-y-2">
              <ToggleRow
                label="Seanslarıyla birlikte kopyala"
                description="Alt seanslar da aynı şart ve programla, boş olarak kopyalanır."
                checked={includeSubGroups}
                onChange={setIncludeSubGroups}
              />
              <ToggleRow
                label="İçerikle birlikte kopyala"
                description="Hakkında metni, gereksinimler, başvuru koşulları ve görsel kopyalanır."
                checked={includeContent}
                onChange={setIncludeContent}
              />
            </div>
          </>
        )}

        {results && (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.facilityId} className="flex items-center justify-between gap-2 rounded-card border border-border px-3 py-2">
                <span className="type-body-strong">{r.facilityName}</span>
                {r.success ? (
                  <Badge tone="success"><CheckCircle2Icon className="h-3 w-3" /> Kopyalandı (pasif)</Badge>
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
      </div>
    </Modal>
  )
}
