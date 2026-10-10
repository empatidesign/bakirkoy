import { useEffect, useState } from 'react'
import { CopyIcon, PlusIcon, Trash2Icon, CheckCircle2Icon, XCircleIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Modal, Button, Field, DatePicker, ToggleRow, Banner, IconButton, Badge } from '@/design-system'
import { todayIso } from '@/lib/utils'
import travelService from '@/services/travel.service'
import type { Travel, TravelCopyRequest, TravelBulkCopyResultItem } from '@/types/travel.types'

interface Props {
  travel: Travel | null
  onClose: () => void
  onCopied: () => void
}

type Row = { id: string; startDate: string; endDate: string; registrationStartDate: string; registrationEndDate: string }

const makeRow = (): Row => ({
  id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`,
  startDate: '', endDate: '', registrationStartDate: '', registrationEndDate: '',
})

/**
 * Kullanıcı isteği (2026-10-04): "çoklu olarak ekleme kopyalama" — Hizmetlerimiz (FacilityGroup)
 * modülündeki çoklu-hedefe-kopyalama desenini Gezi (Travel) sistemine taşır. Tek bir sefer
 * kaydından, her biri kendi gidiş/dönüş ve kayıt tarihi aralığına sahip BİRDEN FAZLA yeni sefer
 * tek işlemde oluşturulabilir (ör. aynı geziyi 3 farklı hafta sonu için tekrar açmak). İsim,
 * açıklama, kural, görsel, fiyat ve yaş/cinsiyet kısıtları kaynak seferden aynen miras alınır —
 * TravelCopyModal (tekil kopya) ile aynı backend uç noktasının çoklu versiyonunu kullanır.
 */
export const TravelBulkCopyModal = ({ travel, onClose, onCopied }: Props) => {
  const [rows, setRows] = useState<Row[]>([makeRow()])
  const [cloneBuses, setCloneBuses] = useState(false)
  const [saving, setSaving] = useState(false)
  const [results, setResults] = useState<TravelBulkCopyResultItem[] | null>(null)

  useEffect(() => {
    setRows([makeRow()])
    setCloneBuses(false)
    setResults(null)
  }, [travel?.id])

  if (!travel) return null

  const scheduleSummary = `${travel.name} · ${travel.code}`

  const addRow = () => setRows((r) => [...r, makeRow()])
  const removeRow = (id: string) => setRows((r) => r.filter((row) => row.id !== id))
  const patchRow = (id: string, p: Partial<Row>) => setRows((r) => r.map((row) => (row.id === id ? { ...row, ...p } : row)))

  const rowValid = (r: Row) =>
    !!r.startDate && !!r.endDate && r.endDate >= r.startDate
    && !!r.registrationStartDate && !!r.registrationEndDate && r.registrationEndDate >= r.registrationStartDate

  const allValid = rows.length > 0 && rows.every(rowValid)

  const save = async () => {
    if (!allValid) { toast.error('Tüm satırlardaki tarihleri kontrol edin.'); return }
    setSaving(true)
    try {
      const targets: TravelCopyRequest[] = rows.map((r) => ({
        startDate: r.startDate, endDate: r.endDate,
        registrationStartDate: r.registrationStartDate, registrationEndDate: r.registrationEndDate,
        cloneBuses,
      }))
      const res = await travelService.bulkCopy(travel.id, targets)
      setResults(res.results)
      const okCount = res.results.filter((r) => r.success).length
      const failCount = res.results.length - okCount
      if (okCount > 0) toast.success(`${okCount} yeni sefer oluşturuldu (pasif).`)
      if (failCount > 0) toast.error(`${failCount} hedef oluşturulamadı.`)
    } finally {
      setSaving(false)
    }
  }

  const finish = () => { onCopied(); onClose() }

  return (
    <Modal
      open={!!travel}
      onClose={onClose}
      title="Çoklu Sefer Ekle"
      subtitle={`"${travel.name}" — her satır için ayrı ve bağımsız bir sefer oluşturulacak`}
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
              {rows.length > 1 ? `${rows.length} Sefer Oluştur` : 'Sefer Oluştur'}
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-4 p-5">
        {!results && (
          <>
            <Banner tone="info" variant="soft">
              İsim, açıklama, kural, görsel, fiyat ve yaş/cinsiyet kısıtları <strong>{scheduleSummary}</strong> gezisinden aynen gelir.
              Her satır bağımsız bir sefer olarak, her zaman <strong>pasif</strong> oluşturulur.
            </Banner>

            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={r.id} className="space-y-2 rounded-card border border-border bg-surface-1 p-3">
                  <div className="flex items-center justify-between">
                    <span className="type-caption font-semibold">Sefer {i + 1}</span>
                    {rows.length > 1 && (
                      <IconButton tone="danger" title="Bu satırı kaldır" onClick={() => removeRow(r.id)}>
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </IconButton>
                    )}
                  </div>
                  <div className="grid gap-[15px] sm:grid-cols-2">
                    <Field label="Gidiş Tarihi" required>
                      <DatePicker value={r.startDate} onChange={(v) => patchRow(r.id, { startDate: v })} min={todayIso()} />
                    </Field>
                    <Field label="Dönüş Tarihi" required>
                      <DatePicker value={r.endDate} onChange={(v) => patchRow(r.id, { endDate: v })} min={r.startDate || todayIso()} />
                    </Field>
                  </div>
                  <div className="grid gap-[15px] sm:grid-cols-2">
                    <Field label="Kayıt Başlangıcı" required>
                      <DatePicker value={r.registrationStartDate} onChange={(v) => patchRow(r.id, { registrationStartDate: v })} min={todayIso()} />
                    </Field>
                    <Field label="Kayıt Bitişi" required>
                      <DatePicker value={r.registrationEndDate} onChange={(v) => patchRow(r.id, { registrationEndDate: v })} min={r.registrationStartDate || todayIso()} />
                    </Field>
                  </div>
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" iconLeft={<PlusIcon className="h-3.5 w-3.5" />} onClick={addRow}>
              Başka Sefer Ekle
            </Button>

            <ToggleRow
              label="Otobüsleri de çoğalt"
              description="Kapalıysa yeni seferler aynı havuz aracını (plaka) paylaşır. Açıksa her sefer için araçlar bağımsız kopyalanır."
              checked={cloneBuses}
              onChange={setCloneBuses}
            />
          </>
        )}

        {results && (
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.index} className="flex items-center justify-between gap-2 rounded-card border border-border px-3 py-2">
                <span className="type-body-strong">Sefer {r.index + 1}{r.code ? ` · ${r.code}` : ''}</span>
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
