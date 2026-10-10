import { useEffect, useState } from 'react'
import { PencilIcon, AlertTriangleIcon } from 'lucide-react'
import { Modal, Button, Field, Input, Textarea, Banner } from '@/design-system'
import type { LibraryShift } from '@/types/library.types'
import { fmtDate, fmtTime, fmtDuration } from './libraryHelpers'

const toLocalInputValue = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fromLocalInputValue = (v: string) => (v ? new Date(v).toISOString() : '')

interface Props {
  shift: LibraryShift | null
  onClose: () => void
  onSubmit: (shiftId: string, startTimeIso: string, endTimeIso: string, reason: string) => Promise<void>
  requireReason?: boolean
}

export const ShiftEditModal = ({ shift, onClose, onSubmit, requireReason }: Props) => {
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!shift) return
    setStart(toLocalInputValue(shift.startTime))
    setEnd(toLocalInputValue(shift.endTime))
    setReason('')
    setError('')
  }, [shift])

  const submit = async () => {
    if (!shift) return
    setError('')
    if (!start || !end) { setError('Giriş ve çıkış saati zorunludur.'); return }
    const startIso = fromLocalInputValue(start)
    const endIso = fromLocalInputValue(end)
    if (new Date(endIso) <= new Date(startIso)) { setError('Çıkış saati giriş saatinden sonra olmalıdır.'); return }
    if (new Date(endIso).getTime() > Date.now() + 5 * 60_000) { setError('Çıkış saati gelecekte olamaz.'); return }
    if (requireReason && !reason.trim()) { setError('Değişiklik sebebi zorunludur.'); return }

    setSaving(true)
    try {
      await onSubmit(shift.id, startIso, endIso, reason.trim())
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={!!shift}
      onClose={onClose}
      title="Mesai Saatini Düzenle"
      subtitle={shift ? `${shift.staffName} · ${shift.libraryName}` : undefined}
      width={460}
      footer={
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button variant="primary" className="flex-1" isLoading={saving} onClick={submit}>
            <PencilIcon className="h-4 w-4" /> Kaydet
          </Button>
        </div>
      }
    >
      <div className="space-y-4 p-6">
        {shift && (
          <div className="rounded-field bg-surface-1 px-3 py-2 text-sm text-foreground-muted">
            Kayıtlı: {fmtDate(shift.startTime)} · {fmtTime(shift.startTime)}
            {shift.endTime ? ` – ${fmtTime(shift.endTime)}` : ''} ({fmtDuration(shift.workedMinutes ?? 0)})
            {shift.autoClosedAtCutoff && (
              <span className="ml-1.5 inline-flex items-center gap-1 text-warning">
                <AlertTriangleIcon className="h-3 w-3" /> Gün sonu otomatik kapatıldı
              </span>
            )}
          </div>
        )}
        {shift?.wasEdited && (
          <Banner tone="warning" variant="soft">
            Bu kayıt daha önce {shift.lastEditedByName ?? 'bir yönetici'} tarafından düzenlenmiş.
            {shift.originalStartTime && (
              <> Orijinal: {fmtDate(shift.originalStartTime)} {fmtTime(shift.originalStartTime)}
                {shift.originalEndTime ? ` – ${fmtTime(shift.originalEndTime)}` : ''}.</>
            )}
          </Banner>
        )}
        <Field label="Giriş Saati" required>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </Field>
        <Field label="Çıkış Saati" required>
          <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
        </Field>
        <Field label="Değişiklik Sebebi" required={requireReason} hint={requireReason ? undefined : 'Opsiyonel, ama şeffaflık için önerilir.'}>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Örn. Mesai bitirmeyi unuttum, gerçek çıkış saatim 18:20'ydi." />
        </Field>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Modal>
  )
}
