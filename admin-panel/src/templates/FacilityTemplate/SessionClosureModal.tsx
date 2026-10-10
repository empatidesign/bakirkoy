import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { InfoIcon } from 'lucide-react'
import { Modal, Button, SegmentedControl, CheckboxRow, DatePicker, Textarea, Field, ToggleRow, Banner } from '@/design-system'
import { todayIso } from '@/lib/utils'
import type { FacilityModuleService } from './types'
import type { GroupRecord } from '@/types/facility.types'

interface Props {
  open: boolean
  onClose: () => void
  service: FacilityModuleService
  facilityId: string
  groupSingular: string
  onDone: () => void
}

type Mode = 'cancel' | 'reopen'
type Scope = 'facility' | 'groups'

export const SessionClosureModal = ({ open, onClose, service, facilityId, groupSingular, onDone }: Props) => {
  const [mode, setMode] = useState<Mode>('cancel')
  const [scope, setScope] = useState<Scope>('facility')
  const [groups, setGroups] = useState<GroupRecord[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [useRange, setUseRange] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode('cancel'); setScope('facility'); setSelectedGroupIds([])
    setUseRange(false); setStartDate(''); setEndDate(''); setReason('')
    service.groups.getList({ facilityId, page: 1, limit: 200 })
      .then((r) => setGroups(r.items))
      .catch(() => setGroups([]))
  }, [open, service, facilityId])

  const toggleGroup = (id: string, on: boolean) =>
    setSelectedGroupIds((prev) => on ? [...prev, id] : prev.filter((x) => x !== id))

  const valid =
    !!startDate
    && (!useRange || (!!endDate && endDate >= startDate))
    && (scope !== 'groups' || selectedGroupIds.length > 0)
    && (mode !== 'cancel' || !!reason.trim())

  const submit = async () => {
    setBusy(true)
    try {
      const scopeReq = {
        facilityId: scope === 'facility' ? facilityId : null,
        groupIds: scope === 'groups' ? selectedGroupIds : null,
        startDate,
        endDate: useRange ? endDate : null,
      }
      if (mode === 'cancel') {
        const res = await service.sessions.bulkCancel({ ...scopeReq, reason: reason.trim() })
        toast.success(res.affectedSessions === 0
          ? 'Seçilen aralıkta kapatılacak seans bulunamadı.'
          : `${res.affectedSessions} seans kapatıldı, ${res.notifiedUsers} kişiye bilgilendirme gönderildi.`)
      } else {
        const res = await service.sessions.bulkReopen(scopeReq)
        toast.success(res.affectedSessions === 0
          ? 'Seçilen aralıkta yeniden açılacak kapalı seans bulunamadı.'
          : `${res.affectedSessions} seans yeniden açıldı.`)
      }
      onDone()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Seans Kapatma"
      subtitle="Resmi tatil vb. durumlarda seansları toplu kapatın veya geri açın"
      width={560}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>İptal</Button>
          <Button variant={mode === 'cancel' ? 'danger' : 'primary'} onClick={submit} isLoading={busy} disabled={!valid}>
            {mode === 'cancel' ? 'Seansları Kapat' : 'Seansları Geri Aç'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-6">
        <Field label="İşlem">
          <SegmentedControl value={mode} onChange={(v) => setMode(v as Mode)} columns={2}
            options={[
              { value: 'cancel', label: 'Kapat', description: 'Seansları iptal et' },
              { value: 'reopen', label: 'Geri Aç', description: 'Kapatmayı geri al' },
            ]} />
        </Field>

        <Field label="Kapsam">
          <SegmentedControl value={scope} onChange={(v) => setScope(v as Scope)} columns={2}
            options={[
              { value: 'facility', label: 'Tüm Tesis', description: 'Tesisteki tüm gruplar' },
              { value: 'groups', label: `Belirli ${groupSingular}lar`, description: 'Bir veya birden çok grup' },
            ]} />
        </Field>

        {scope === 'groups' && (
          <Field label={`${groupSingular} Seçimi`} required hint={selectedGroupIds.length > 0 ? `${selectedGroupIds.length} grup seçili` : 'En az bir grup seçin'}>
            {groups.length === 0 ? (
              <p className="type-caption">Bu tesiste grup bulunmuyor.</p>
            ) : (
              <div className="max-h-52 space-y-1.5 overflow-y-auto rounded-card border border-border bg-surface-1 p-2">
                {groups.map((g) => (
                  <CheckboxRow key={g.id} variant="inline" label={g.name} description={g.branchName}
                    checked={selectedGroupIds.includes(g.id)} onChange={(v) => toggleGroup(g.id, v)} />
                ))}
              </div>
            )}
          </Field>
        )}

        <ToggleRow label="Tarih Aralığı" description="Kapalıyken tek gün, açıkken başlangıç–bitiş aralığı"
          checked={useRange} onChange={(v) => { setUseRange(v); if (!v) setEndDate('') }} />

        <div className={useRange ? 'grid grid-cols-2 gap-3' : ''}>
          <Field label={useRange ? 'Başlangıç' : 'Tarih'} required>
            <DatePicker value={startDate} onChange={setStartDate} min={todayIso()} clearable />
          </Field>
          {useRange && (
            <Field label="Bitiş" required>
              <DatePicker value={endDate} onChange={setEndDate} min={startDate || todayIso()} clearable />
            </Field>
          )}
        </div>

        {mode === 'cancel' && (
          <Field label="Kapatma Sebebi" required hint="Bu sebep, etkilenen katılımcılara mesaj olarak gönderilir.">
            <Textarea rows={2} placeholder="Örn. Resmi tatil (Ramazan Bayramı)" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        )}

        <Banner tone="info" variant="soft" icon={InfoIcon}>
          {mode === 'cancel'
            ? 'Kapatılan seanslardaki tüm katılımcılara, belirttiğiniz sebeple birlikte tek bir bilgilendirme mesajı gönderilir.'
            : 'Seçilen kapsam ve tarihteki kapalı seanslar yeniden açılır.'}
        </Banner>
      </div>
    </Modal>
  )
}
