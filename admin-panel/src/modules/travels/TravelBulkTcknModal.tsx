import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { UsersRoundIcon, ClipboardPasteIcon, CheckCircle2Icon, SendIcon, XCircleIcon, AlertTriangleIcon, BusIcon } from 'lucide-react'
import { Modal, Button, Textarea, Badge, Banner, Field, Select, Switch } from '@/design-system'
import travelApplicationService from '@/services/travelApplication.service'
import travelBusService from '@/services/travelBus.service'
import travelService from '@/services/travel.service'
import type { Travel, TravelBulkTcknEntry, TravelBulkTcknResult, TravelBulkTcknOutcome, TravelBus } from '@/types/travel.types'

/**
 * Kullanıcı isteği (2026-08-07): admin bir geziye çok sayıda TC kimlik numarasını (isteğe
 * bağlı telefon ve koltuk numarasıyla birlikte) yapıştırıp toplu olarak yolcu ekleyebilmeli.
 * Her satır "TCKN", "TCKN,Telefon" veya "TCKN,Telefon,Koltuk" formatında olabilir. Sistemde
 * kayıtlı TC'ler doğrudan onaylı başvuru olarak eklenir; kayıtlı olmayan TC'lere — telefon
 * verilmişse — üyelik/uygulama daveti SMS'i gönderilir, verilmemişse "iletişim bilgisi eksik"
 * olarak işaretlenir (tek başına TC ile NVI sorgulanamadığı, telefon bilgisi alınamadığı için).
 *
 * Kullanıcı bulgusu (2026-08-07): önceden bu modalda araç/koltuk seçimi hiç yoktu — tüm
 * yolcular otomatik olarak koltuksuz (kontenjan bazlı) ekleniyordu, koltuklu bir araca "kim
 * nerede oturuyor" bilgisi hiç girilemiyordu. Artık gezinin araçları arasından seçim yapılabilir;
 * koltuklu bir araç seçilirse her satıra opsiyonel 3. alan (koltuk no) eklenebilir.
 */

interface Props {
  travel: Travel | null
  onClose: () => void
  onDone?: () => void
}

const OUTCOME_META: Record<TravelBulkTcknOutcome, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' | 'neutral'; icon: typeof CheckCircle2Icon }> = {
  added: { label: 'Üye — Eklendi', tone: 'success', icon: CheckCircle2Icon },
  invite_sent: { label: 'Üye Değil — Davet Gönderildi', tone: 'info', icon: SendIcon },
  invite_skipped: { label: 'Üye Değil — SMS Gönderilmedi', tone: 'neutral', icon: AlertTriangleIcon },
  no_contact: { label: 'Üye Değil — İletişim Bilgisi Eksik', tone: 'warning', icon: AlertTriangleIcon },
  duplicate: { label: 'Tekrar Eden', tone: 'neutral', icon: AlertTriangleIcon },
  invalid: { label: 'Geçersiz TC', tone: 'danger', icon: XCircleIcon },
  failed: { label: 'Eklenemedi', tone: 'danger', icon: XCircleIcon },
}

const parseLines = (raw: string): TravelBulkTcknEntry[] =>
  raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(/[,;\t]/).map((p) => p.trim())
      return {
        tckn: (parts[0] ?? '').replace(/\D/g, ''),
        phone: parts[1] ? parts[1].replace(/\D/g, '') : undefined,
        seatNumber: parts[2] ? parts[2].toUpperCase() : undefined,
        fullName: parts[3] || undefined,
      }
    })
    .filter((e) => e.tckn.length > 0)

export const TravelBulkTcknModal = ({ travel, onClose, onDone }: Props) => {
  const [raw, setRaw] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<TravelBulkTcknResult | null>(null)
  const [buses, setBuses] = useState<TravelBus[]>([])
  const [busId, setBusId] = useState('')
  const [sendInviteSms, setSendInviteSms] = useState(true)
  const [inviteDelayMinutes, setInviteDelayMinutes] = useState(5)

  useEffect(() => {
    if (!travel) { setBuses([]); setBusId(''); return }
    travelBusService.getByTravel(travel.id).then(setBuses).catch(() => setBuses([]))
  }, [travel])

  useEffect(() => {
    if (!travel) return
    travelService.getSettings().then((s) => {
      setSendInviteSms(s.general.autoInviteSmsEnabled)
      setInviteDelayMinutes(s.general.inviteSmsDelayMinutes)
    }).catch(() => {})
  }, [travel])

  const selectedBus = buses.find((b) => b.id === busId)
  const seatedBusSelected = !!selectedBus && selectedBus.vehicleType !== 'capacity'

  const entries = parseLines(raw)
  const invalidCount = entries.filter((e) => e.tckn.length !== 11).length
  const seatDuplicates = (() => {
    const seats = entries.map((e) => e.seatNumber).filter(Boolean) as string[]
    return new Set(seats).size !== seats.length
  })()

  const close = () => { setRaw(''); setResult(null); setBusId(''); onClose() }

  const submit = async () => {
    if (!travel || entries.length === 0) return
    if (seatedBusSelected && seatDuplicates) { toast.error('Aynı koltuk birden fazla satırda seçilemez.'); return }
    setSubmitting(true)
    try {
      const r = await travelApplicationService.bulkAddByTckn(travel.id, entries, busId || undefined, sendInviteSms)
      setResult(r)
      if (r.added > 0) toast.success(`${r.added} yolcu eklendi.`)
      if (r.invitesSent > 0) toast.info(`${r.invitesSent} kişiye üyelik daveti gönderildi.`)
      onDone?.()
    } catch {
      toast.error('Toplu ekleme sırasında bir hata oluştu.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={!!travel}
      onClose={close}
      title="Toplu T.C. Kimlik ile Yolcu Ekle"
      subtitle={travel ? travel.name : undefined}
      width={560}
      bodyClassName="p-5"
      footer={
        !result ? (
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={close}>Vazgeç</Button>
            <Button
              variant="primary"
              className="flex-1"
              isLoading={submitting}
              disabled={entries.length === 0}
              onClick={submit}
            >
              <UsersRoundIcon className="h-4 w-4" /> {entries.length > 0 ? `${entries.length} Kişiyi Ekle` : 'Ekle'}
            </Button>
          </div>
        ) : (
          <Button variant="primary" className="w-full" onClick={close}>Kapat</Button>
        )
      }
    >
      {!result ? (
        <div className="space-y-4">
          {buses.length > 0 && (
            <Field label="Araç" hint={seatedBusSelected ? 'Koltuklu araç seçildi — isterseniz her satırın 3. alanına (virgülle) koltuk numarası ekleyin.' : 'Araç seçmezseniz veya kontenjanlı bir araç seçerseniz yolcular yalnızca kontenjan bazlı (koltuksuz) eklenir.'}>
              <Select value={busId} onChange={(e) => setBusId(e.target.value)}>
                <option value="">Araç atanmadı (kontenjan bazlı)</option>
                {buses.map((b) => <option key={b.id} value={b.id}>{b.name}{b.vehicleType === 'capacity' ? ' (Kontenjanlı)' : ` · ${b.plateNumber}`}</option>)}
              </Select>
            </Field>
          )}
          <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-1 px-4 py-3">
            <div>
              <p className="type-body-strong">Üye olmayanlara davet SMS'i gönder</p>
              <p className="type-caption text-foreground-muted">Telefonu bulunan kişilere {inviteDelayMinutes > 0 ? `${inviteDelayMinutes} dakika sonra` : 'hemen'} otomatik üyelik bağlantısı gönderilir.</p>
            </div>
            <Switch checked={sendInviteSms} onCheckedChange={setSendInviteSms} />
          </div>
          <Banner tone="info" variant="soft" icon={ClipboardPasteIcon}>
            Her satıra bir T.C. kimlik numarası yazın. Sistemde kayıtlı olmayan kişilere davet SMS'i
            gönderebilmek için TC'nin yanına virgülle telefon numarası ekleyin{seatedBusSelected ? ', koltuklu araç seçiliyken 3. alana koltuk numarası da yazabilirsiniz' : ''}.
            4. alana (opsiyonel) ad-soyad yazarsanız, henüz üye olmayan kişi sonuç listesinde ismiyle görünür (Excel'den kopyala-yapıştır ile kolayca eklenebilir): {' '}
            <code>12345678901,5551234567{seatedBusSelected ? ',14A,Ahmet Yılmaz' : ',,Ahmet Yılmaz'}</code>
          </Banner>
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={10}
            placeholder={seatedBusSelected ? '12345678901,5551234567,14A,Ahmet Yılmaz\n23456789012,,15A\n...' : '12345678901\n23456789012,5551234567,,Ahmet Yılmaz\n...'}
            className="font-mono text-sm"
          />
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-foreground-muted">
            <Badge tone="primary">{entries.length} satır</Badge>
            {invalidCount > 0 && <Badge tone="danger">{invalidCount} geçersiz uzunlukta TC</Badge>}
            {seatedBusSelected && seatDuplicates && <Badge tone="danger">Aynı koltuk birden fazla satırda seçilmiş</Badge>}
            {seatedBusSelected && (
              <Badge tone="neutral"><BusIcon className="h-3 w-3" /> {entries.filter((e) => e.seatNumber).length} koltuklu, {entries.filter((e) => !e.seatNumber).length} koltuksuz</Badge>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-success/30 bg-success-soft/50 p-3 text-center">
              <p className="text-lg font-bold text-success">{result.added}</p>
              <p className="type-caption">Eklendi</p>
            </div>
            <div className="rounded-lg border border-info/30 bg-info-soft/50 p-3 text-center">
              <p className="text-lg font-bold text-info">{result.invitesSent}</p>
              <p className="type-caption">Üye Değil — Davet Gönderildi</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-1 p-3 text-center">
              <p className="text-lg font-bold text-foreground-muted">{result.skipped}</p>
              <p className="type-caption">Atlandı</p>
            </div>
          </div>
          <div className="max-h-[320px] space-y-1.5 overflow-y-auto">
            {result.items.map((item, idx) => {
              const meta = OUTCOME_META[item.outcome]
              const Icon = meta.icon
              return (
                <div key={`${item.tckn}-${idx}`} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="type-body-strong tabular-nums">{item.tckn}</p>
                    {(item.participantName || item.reason) && (
                      <p className="type-caption truncate">{item.participantName ?? item.reason}</p>
                    )}
                    {item.participantName && item.reason && <p className="type-caption text-foreground-muted">{item.reason}</p>}
                    {item.history && item.history.length > 0 && (
                      <div className="mt-1.5 rounded-md bg-surface-1 px-2 py-1.5">
                        <p className="type-caption font-semibold text-foreground-default">Önceki gezi geçmişi</p>
                        {item.history.map((h, historyIndex) => (
                          <p key={`${h.travelName}-${h.startDate}-${historyIndex}`} className="type-caption text-foreground-muted">
                            {h.travelName} · {new Date(h.startDate).toLocaleDateString('tr-TR')} – {new Date(h.endDate).toLocaleDateString('tr-TR')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Modal>
  )
}
