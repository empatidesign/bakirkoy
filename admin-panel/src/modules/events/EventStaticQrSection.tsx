import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { QrCodeIcon, RefreshCwIcon, DownloadIcon, PrinterIcon } from 'lucide-react'
import { Button, Label, Select, Switch, FormSection, QrCode, NumberInput } from '@/design-system'
import eventService from '@/services/event.service'
import type { EventStaticQr, EventStaticQrMode } from '@/types/event.types'
import { labeledQrsOf, staticQrUrl, downloadLabeledQrPng, printLabeledQrs, type LabeledQr } from '@/lib/staticQrPrint'

interface Props {
  eventId: string
  eventName: string
}

const MODE_OPTIONS: { value: EventStaticQrMode; label: string; hint: string }[] = [
  { value: 'attendance', label: 'Sadece Yoklama', hint: 'Tek QR: içeride değilse giriş, içerideyse çıkış kaydı düşer. Kapı/turnike tetiklenmez.' },
  { value: 'entry', label: 'Sadece Giriş', hint: 'Tek QR, yalnız giriş kaydı düşer. Çıkış için ayrı bir okutma gerekmez. Kapı/turnike tetiklenmez.' },
  { value: 'entry_exit', label: 'Giriş / Çıkış (Tek QR)', hint: 'İçeride değilse giriş, içerideyse çıkış yapar. Kapı/turnike tetiklenmez.' },
  { value: 'split', label: 'Ayrı Giriş ve Çıkış QR', hint: 'Girişe Giriş QR, çıkışa Çıkış QR asılır. Giriş QR yalnız giriş, Çıkış QR yalnız çıkış yapar. Kapı/turnike tetiklenmez.' },
]

const StaticQrCard = ({ qr }: { qr: LabeledQr }) => {
  const qrUrl = staticQrUrl(qr.code)
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="type-caption font-semibold">{qr.label}</p>
      <QrCode value={qrUrl} size={180} />
      <p className="type-caption break-all text-center font-mono">{qrUrl}</p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => downloadLabeledQrPng(qr)}>
          <DownloadIcon className="mr-1 h-3.5 w-3.5" />PNG İndir
        </Button>
        <Button variant="outline" size="sm" onClick={() => printLabeledQrs([qr], `${qr.name} - ${qr.label}`)}>
          <PrinterIcon className="mr-1 h-3.5 w-3.5" />Yazdır
        </Button>
      </div>
    </div>
  )
}

/**
 * Kullanıcı isteği (2026-10-06): "QR okutma kütüphane/tesislerde olduğu gibi cihazlı veya
 * cihazsız çalışsın, aynı mantık her yerde geçerli olsun" — FacilityStaticQrSection.tsx'in
 * birebir kopyası, Event'e uyarlandı. Önceden etkinlik için "QR Türü: Sabit/Değişken" admin
 * panelde seçiliyordu ama hiçbir çalışan QR üretim/tarama akışına bağlı değildi (bkz.
 * docs/etkinlik-erisim-yoklama-derin-inceleme-2026-07-29.md madde 9-11) — bu bölüm o sahte
 * alanların yerini alır, gerçekten çalışan sabit QR altyapısına bağlıdır.
 */
export const EventStaticQrSection = ({ eventId, eventName }: Props) => {
  const [info, setInfo] = useState<EventStaticQr | undefined>(undefined)
  const [toggling, setToggling] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [savingMode, setSavingMode] = useState(false)
  const [savingTiming, setSavingTiming] = useState(false)
  const [minExitDraft, setMinExitDraft] = useState(3)
  const [cooldownDraft, setCooldownDraft] = useState(0)

  const load = useCallback(() => {
    eventService.getStaticQr(eventId).then((res) => {
      setInfo(res)
      setMinExitDraft(res.minExitSeconds)
      setCooldownDraft(res.reentryCooldownSeconds)
    }).catch(() => setInfo({ enabled: false, mode: 'attendance', minExitSeconds: 3, reentryCooldownSeconds: 0 }))
  }, [eventId])

  useEffect(() => { load() }, [load])

  const handleToggle = async (checked: boolean) => {
    setToggling(true)
    try {
      const res = await eventService.toggleStaticQr(eventId, checked)
      setInfo(res)
      toast.success(checked ? 'Sabit QR etkinleştirildi.' : 'Sabit QR devre dışı bırakıldı.')
    } finally {
      setToggling(false)
    }
  }

  const handleModeChange = async (mode: EventStaticQrMode) => {
    setSavingMode(true)
    try {
      const res = await eventService.setStaticQrMode(eventId, mode)
      setInfo(res)
      toast.success('QR modu güncellendi.')
    } finally {
      setSavingMode(false)
    }
  }

  const handleSaveTiming = async () => {
    setSavingTiming(true)
    try {
      const res = await eventService.setStaticQrTiming(eventId, minExitDraft, cooldownDraft)
      setInfo(res)
      toast.success('Süre ayarları güncellendi.')
    } finally {
      setSavingTiming(false)
    }
  }

  const timingDirty = !!info && (minExitDraft !== info.minExitSeconds || cooldownDraft !== info.reentryCooldownSeconds)

  const handleRotate = async () => {
    setRotating(true)
    try {
      const res = await eventService.rotateStaticQr(eventId)
      setInfo(res)
      toast.success('QR kodu yenilendi. Eski çıktı artık geçersiz.')
    } finally {
      setRotating(false)
    }
  }

  const qrCards = labeledQrsOf(eventName, info)

  return (
    <FormSection variant="card" icon={QrCodeIcon} tone="blue" title="Sabit Giriş QR'ı (Cihazsız)" subtitle="Kapıya/duvara asılabilen, kişiye özel olmayan sabit bir QR kodu. Katılımcı kendi telefonuyla tarar. Bu QR fiziksel kapı/turnike AÇMAZ, yalnızca giriş-çıkış kaydı tutar — cihazlı turnike/kiosk Salon Cihazları bölümünden yönetilir.">
      <div className="flex items-center justify-between">
        <div>
          <Label>Sabit QR Aktif</Label>
          <p className="type-caption">Kapalıyken bu etkinlik için sabit QR taraması kabul edilmez.</p>
        </div>
        <Switch aria-label="Sabit QR ile giriş" checked={!!info?.enabled} onCheckedChange={handleToggle} disabled={toggling || !info} />
      </div>

      {info?.enabled && (
        <div className="space-y-4 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label>Tarama Modu</Label>
            <Select value={info.mode} onChange={(e) => handleModeChange(e.target.value as EventStaticQrMode)} disabled={savingMode}>
              {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <p className="type-caption">{MODE_OPTIONS.find((o) => o.value === info.mode)?.hint}</p>
          </div>

          {(info.mode === 'attendance' || info.mode === 'entry_exit' || info.mode === 'split') && (
            <div className="space-y-3 rounded-card border border-border bg-surface-1 p-3">
              <p className="type-caption font-semibold text-foreground-strong">Giriş/Çıkış Süre Ayarları (saniye)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="type-caption">Çıkış için min. süre (sn)</Label>
                  <NumberInput value={minExitDraft} onChange={setMinExitDraft} min={0} max={3600} suffix="sn" />
                  <p className="type-caption text-foreground-muted">
                    {info.mode === 'split'
                      ? 'Giriş yapıldıktan sonra bu kadar sn geçmeden Çıkış QR\'ı okutulursa henüz işlenmez (çift/yanlışlıkla okutmayı önler).'
                      : 'İlk okutma giriş sayılır. Bu süre dolmadan tekrar okutmak çıkış üretmez. Hızlı akış için düşük tutun (varsayılan 3 sn).'}
                  </p>
                </div>
                <div className="space-y-1">
                  <Label className="type-caption">Tekrar giriş bekleme (sn)</Label>
                  <NumberInput value={cooldownDraft} onChange={setCooldownDraft} min={0} max={3600} suffix="sn" />
                  <p className="type-caption text-foreground-muted">Çıkıştan sonra tekrar giriş için beklenmesi gereken süre. 0 = bekleme yok (varsayılan).</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleSaveTiming} isLoading={savingTiming} disabled={!timingDirty}>
                Süre Ayarlarını Kaydet
              </Button>
            </div>
          )}

          {qrCards.length > 0 && (
            <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface-0 p-4">
              <div className={qrCards.length > 1 ? 'grid w-full gap-6 sm:grid-cols-2' : 'w-full'}>
                {qrCards.map((c) => <StaticQrCard key={c.code} qr={c} />)}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {qrCards.length > 1 && (
                  <Button variant="outline" size="sm" onClick={() => printLabeledQrs(qrCards, `${eventName} - QR`)}>
                    <PrinterIcon className="mr-1 h-3.5 w-3.5" />Giriş + Çıkış Birlikte Yazdır
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleRotate} isLoading={rotating}>
                  <RefreshCwIcon className="mr-1 h-3.5 w-3.5" />Yeni Kod Üret (Yenile)
                </Button>
              </div>
              <p className="type-caption text-center text-warning">Yeni kod üretilirse eski çıktılar geçersiz olur, kapıdaki QR'ları yeniden yazdırmanız gerekir.</p>
            </div>
          )}
        </div>
      )}
    </FormSection>
  )
}

export default EventStaticQrSection
