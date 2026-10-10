import { useEffect, useState } from 'react'
import { CopyIcon, PlusIcon, Trash2Icon, CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Field, DatePicker, Banner, IconButton, Badge } from '@/design-system'
import { todayIso } from '@/lib/utils'
import eventService from '@/services/event.service'
import type { Event, EventBulkCopyTarget, EventBulkCopyResultItem } from '@/types/event.types'

interface Props {
  event: Event | null
  onClose: () => void
  onCopied: () => void
}

type Row = { id: string; startDate: string; endDate: string; applicationStartDate: string; applicationEndDate: string }

const makeRow = (): Row => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`,
  startDate: '', endDate: '', applicationStartDate: '', applicationEndDate: '',
})

/**
 * Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme kopyalama" — Hizmetlerimiz (FacilityGroup)
 * ve Gezi (TravelBulkCopyModal) sistemlerindeki çoklu-hedefe-kopyalama desenini Etkinlik Takvimi
 * modülüne taşır. Tek bir etkinlikten, her biri kendi tarih (ve isteğe bağlı başvuru tarihi)
 * aralığına sahip BİRDEN FAZLA bağımsız etkinlik kopyası tek işlemde oluşturulabilir (ör. aynı
 * seminer formatını 3 farklı tarihte tekrar açmak). İsim, mekan, kontenjan, erişim ayarları,
 * görseller ve fiyatlandırma kaynaktan aynen miras alınır.
 */
export const EventBulkCopyModal = ({ event, onClose, onCopied }: Props) => {
  const [rows, setRows] = useState<Row[]>([makeRow()])
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<EventBulkCopyResultItem[] | null>(null)

  useEffect(() => {
    setRows([makeRow()])
    setResults(null)
  }, [event?.id])

  if (!event) return null

  const addRow = () => setRows((r) => [...r, makeRow()])
  const removeRow = (id: string) => setRows((r) => r.filter((row) => row.id !== id))
  const patchRow = (id: string, p: Partial<Row>) => setRows((r) => r.map((row) => (row.id === id ? { ...row, ...p } : row)))

  const rowValid = (r: Row) => {
    if (!r.startDate || !r.endDate || r.endDate < r.startDate) return false
    if (r.applicationStartDate && r.applicationEndDate && r.applicationEndDate < r.applicationStartDate) return false
    return true
  }

  const allValid = rows.length > 0 && rows.every(rowValid)

  const save = async () => {
    if (!allValid) { toast.error('Tüm satırlardaki tarihleri kontrol edin.'); return }
    setSaving(true)
    try {
      const targets: EventBulkCopyTarget[] = rows.map((r) => ({
        startDate: r.startDate, endDate: r.endDate,
        applicationStartDate: r.applicationStartDate || null,
        applicationEndDate: r.applicationEndDate || null,
      }))
      const res = await eventService.bulkCopy(event.id, targets)
      setResults(res.results)
      const okCount = res.results.filter((r) => r.success).length
      const failCount = res.results.length - okCount
      if (okCount > 0) toast.success(`${okCount} yeni etkinlik oluşturuldu (pasif).`)
      if (failCount > 0) toast.error(`${failCount} hedef oluşturulamadı.`)
    } finally {
      setSaving(false)
    }
  }

  const finish = () => { onCopied(); onClose() }

  return (
    <Modal
      open={!!event}
      onClose={onClose}
      title="Çoklu Etkinlik Ekle"
      subtitle={`"${event.name}" — her satır için ayrı ve bağımsız bir etkinlik oluşturulacak`}
      width={680}
      className="max-w-[96vw]"
      footer={
        results ? (
          <div className="flex justify-end">
            <Button variant="outline" onClick={finish}>Kapat</Button>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>İptal</Button>
            <Button variant="primary" iconLeft={<CopyIcon className="h-4 w-4" />} isLoading={saving} disabled={!allValid} onClick={save}>
              {rows.length > 1 ? `${rows.length} Etkinlik Oluştur` : 'Etkinlik Oluştur'}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4 p-5">
        {!results && (
          <>
            <Banner tone="info" variant="soft">
              İsim, mekan, kontenjan, erişim ayarları, görseller ve fiyatlandırma <strong>{event.name}</strong> etkinliğinden aynen gelir.
              Her satır bağımsız bir etkinlik olarak, her zaman <strong>pasif</strong> oluşturulur.
            </Banner>

            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={r.id} className="space-y-2 rounded-card border border-border bg-surface-1 p-3">
                  <div className="flex items-center justify-between">
                    <span className="type-caption font-semibold">Etkinlik {i + 1}</span>
                    {rows.length > 1 && (
                      <IconButton tone="danger" title="Bu satırı kaldır" onClick={() => removeRow(r.id)}>
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                  </div>
                  <div className="grid gap-[15px] sm:grid-cols-2">
                    <Field label="Başlangıç Tarihi" required>
                      <DatePicker value={r.startDate} onChange={(v) => patchRow(r.id, { startDate: v })} min={todayIso()} />
                    </Field>
                    <Field label="Bitiş Tarihi" required>
                      <DatePicker value={r.endDate} onChange={(v) => patchRow(r.id, { endDate: v })} min={r.startDate || todayIso()} />
                    </Field>
                  </div>
                  <div className="grid gap-[15px] sm:grid-cols-2">
                    <Field label="Başvuru Başlangıcı" hint="Boş bırakılırsa kaynaktaki tarih korunur">
                      <DatePicker value={r.applicationStartDate} onChange={(v) => patchRow(r.id, { applicationStartDate: v })} clearable />
                    </Field>
                    <Field label="Başvuru Bitişi" hint="Boş bırakılırsa kaynaktaki tarih korunur">
                      <DatePicker value={r.applicationEndDate} onChange={(v) => patchRow(r.id, { applicationEndDate: v })} min={r.applicationStartDate || undefined} clearable />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" iconLeft={<PlusIcon className="h-3.5 w-3.5" />} onClick={addRow}>
              Başka Etkinlik Ekle
            </Button>
          </>
        )}

        {results && (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.index} className="flex items-center justify-between gap-2 rounded-card border border-border px-3 py-2">
                <span className="type-body-strong">Etkinlik {r.index + 1}{r.code ? ` · ${r.code}` : ''}</span>
                {r.success ? (
                  <Badge tone="success"><CheckCircle2Icon className="h-3 w-3" /> Oluşturuldu (pasif)</Badge>
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
