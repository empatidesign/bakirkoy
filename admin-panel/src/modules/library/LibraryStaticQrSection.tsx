import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { QrCodeIcon, RefreshCwIcon, DownloadIcon, PrinterIcon, CopyIcon, ExternalLinkIcon, LinkIcon, ImageIcon } from 'lucide-react'
import { Button, Label, Select, Switch, FormSection, QrCode, NumberInput } from '@/design-system'
import libraryService from '@/services/library.service'
import type { LibraryStaticQr, LibraryStaticQrMode } from '@/types/library.types'
import { labeledQrsOf, staticQrUrl, downloadLabeledQrPng, printLabeledQrs, type LabeledQr } from '@/lib/staticQrPrint'

interface Props {
  libraryId: string
  libraryName?: string
}

const MODE_OPTIONS: { value: LibraryStaticQrMode; label: string; hint: string }[] = [
  { value: 'attendance', label: 'Sadece Yoklama', hint: 'Tek QR: içeride değilse giriş, içerideyse çıkış kaydı düşer. Kapı/turnike tetiklenmez.' },
  { value: 'entry', label: 'Sadece Giriş', hint: 'Tek QR, yalnız giriş kaydı düşer. Kapı/turnike tetiklenmez.' },
  { value: 'entry_exit', label: 'Giriş / Çıkış (Tek QR)', hint: 'İçeride değilse giriş, içerideyse çıkış yapar. Kapı/turnike tetiklenmez.' },
  { value: 'split', label: 'Ayrı Giriş ve Çıkış QR', hint: 'Girişe Giriş QR, çıkışa Çıkış QR asılır. Giriş QR yalnız giriş, Çıkış QR yalnız çıkış yapar. Kapı/turnike tetiklenmez.' },
]

interface StaticQrCardProps {
  qr: LabeledQr
  view: 'qr' | 'link'
}

const StaticQrCard = ({ qr, view }: StaticQrCardProps) => {
  const qrUrl = staticQrUrl(qr.code)
  const title = `${qr.label.charAt(0)}${qr.label.slice(1).toLocaleLowerCase('tr-TR')} QR`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl)
      toast.success('QR bağlantısı kopyalandı.')
    } catch {
      toast.error('Bağlantı kopyalanamadı, elle seçip kopyalayın.')
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="type-section">{title}</p>
      <div className={view === 'qr' ? '' : 'hidden'}>
        <QrCode value={qrUrl} size={180} />
      </div>
      {view === 'link' && (
        <p className="type-caption w-full break-all rounded-card bg-surface-1 p-3 text-center font-mono select-all">{qrUrl}</p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        {view === 'qr' ? (
          <>
            <Button variant="outline" size="sm" onClick={() => downloadLabeledQrPng(qr)}>
              <DownloadIcon className="mr-1 h-3.5 w-3.5" />PNG İndir
            </Button>
            <Button variant="outline" size="sm" onClick={() => printLabeledQrs([qr], `${qr.name} - ${title}`)}>
              <PrinterIcon className="mr-1 h-3.5 w-3.5" />Yazdır
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={copyLink}>
              <CopyIcon className="mr-1 h-3.5 w-3.5" />Linki Kopyala
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open(qrUrl, '_blank', 'noopener')}>
              <ExternalLinkIcon className="mr-1 h-3.5 w-3.5" />Aç
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export const LibraryStaticQrSection = ({ libraryId, libraryName }: Props) => {
  const [info, setInfo] = useState<LibraryStaticQr | undefined>(undefined)
  const [toggling, setToggling] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [savingMode, setSavingMode] = useState(false)
  const [savingTiming, setSavingTiming] = useState(false)
  const [minExitDraft, setMinExitDraft] = useState(3)
  const [cooldownDraft, setCooldownDraft] = useState(0)
  const [view, setView] = useState<'qr' | 'link'>('qr')

  const load = useCallback(() => {
    libraryService.staticQr.get(libraryId).then((res) => {
      setInfo(res)
      setMinExitDraft(res.minExitSeconds ?? 3)
      setCooldownDraft(res.reentryCooldownSeconds ?? 0)
    }).catch(() => setInfo({ enabled: false, mode: 'attendance' }))
  }, [libraryId])

  useEffect(() => { load() }, [load])

  const handleToggle = async (checked: boolean) => {
    setToggling(true)
    try {
      const res = await libraryService.staticQr.toggle(libraryId, checked)
      setInfo(res)
      toast.success(checked ? 'Sabit QR etkinleştirildi.' : 'Sabit QR devre dışı bırakıldı.')
    } finally {
      setToggling(false)
    }
  }

  const handleModeChange = async (mode: LibraryStaticQrMode) => {
    setSavingMode(true)
    try {
      const res = await libraryService.staticQr.setMode(libraryId, mode)
      setInfo(res)
      toast.success('QR modu güncellendi.')
    } finally {
      setSavingMode(false)
    }
  }

  const handleSaveTiming = async () => {
    setSavingTiming(true)
    try {
      const res = await libraryService.staticQr.setTiming(libraryId, minExitDraft, cooldownDraft)
      setInfo(res)
      toast.success('Süre ayarları güncellendi.')
    } finally {
      setSavingTiming(false)
    }
  }

  const timingDirty = !!info && (minExitDraft !== (info.minExitSeconds ?? 3) || cooldownDraft !== (info.reentryCooldownSeconds ?? 0))

  const handleRotate = async () => {
    setRotating(true)
    try {
      const res = await libraryService.staticQr.rotate(libraryId)
      setInfo(res)
      toast.success('QR kodu yenilendi. Eski çıktı artık geçersiz.')
    } finally {
      setRotating(false)
    }
  }

  const qrCards = labeledQrsOf(libraryName || 'Kütüphane', info)

  return (
    <FormSection variant="card" icon={QrCodeIcon} title="Sabit Giriş QR'ı" subtitle="Kapıya/duvara asılabilen, kişiye özel olmayan sabit bir QR kodu. Üye kendi telefonuyla tarar. Bu QR fiziksel kapı/turnike AÇMAZ, yalnızca giriş-çıkış kaydı tutar — kapı açan sistemler ayrıdır (turnike/kiosk).">
      <div className="flex items-center justify-between">
        <div>
          <Label>Sabit QR Aktif</Label>
          <p className="type-caption">Kapalıyken bu kütüphane için sabit QR taraması kabul edilmez.</p>
        </div>
        <Switch checked={!!info?.enabled} onCheckedChange={handleToggle} disabled={toggling || !info} />
      </div>

      {info?.enabled && (
        <div className="space-y-4 border-t border-border pt-4">
          <div className="space-y-1.5">
            <Label>Tarama Modu</Label>
            <Select value={info.mode} onChange={(e) => handleModeChange(e.target.value as LibraryStaticQrMode)} disabled={savingMode}>
              {MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            <p className="type-caption">{MODE_OPTIONS.find((o) => o.value === info.mode)?.hint}</p>
          </div>

          {(info.mode === 'entry_exit' || info.mode === 'split') && (
            <div className="space-y-3 rounded-card border border-border bg-surface-1 p-3">
              <p className="type-caption font-semibold text-foreground-strong">Giriş/Çıkış Süre Ayarları (saniye)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="type-caption">Çıkış için min. süre (sn)</Label>
                  <NumberInput value={minExitDraft} onChange={setMinExitDraft} min={0} max={3600} suffix="sn" />
                  <p className="type-caption text-foreground-muted">
                    {info.mode === 'split'
                      ? 'Giriş yapıldıktan sonra bu kadar sn geçmeden Çıkış QR\'ı okutulursa henüz işlenmez.'
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

          {info.code && (
            <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-surface-0 p-4">
              <div className="flex gap-2">
                <Button variant={view === 'qr' ? 'primary' : 'outline'} size="sm" onClick={() => setView('qr')}>
                  <ImageIcon className="mr-1 h-3.5 w-3.5" />QR Dosyası
                </Button>
                <Button variant={view === 'link' ? 'primary' : 'outline'} size="sm" onClick={() => setView('link')}>
                  <LinkIcon className="mr-1 h-3.5 w-3.5" />QR Linki
                </Button>
              </div>
              <div className={qrCards.length > 1 ? 'grid w-full gap-6 sm:grid-cols-2' : 'w-full'}>
                {qrCards.map((c) => (
                  <StaticQrCard key={c.code} qr={c} view={view} />
                ))}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {qrCards.length > 1 && (
                  <Button variant="outline" size="sm" onClick={() => printLabeledQrs(qrCards, `${libraryName ?? ''} - QR`)}>
                    <PrinterIcon className="mr-1 h-3.5 w-3.5" />Giriş + Çıkış Birlikte Yazdır
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleRotate} isLoading={rotating}>
                  <RefreshCwIcon className="mr-1 h-3.5 w-3.5" />Yeni Kod Üret
                </Button>
              </div>
              <p className="type-caption text-center text-warning">Yeni kod üretilirse eski çıktılar geçersiz olur, yeniden yazdırmanız gerekir.{info.mode === 'split' ? ' Mod değişirse kapıdaki QR\'ları da yeniden yazdırın.' : ''}</p>
            </div>
          )}
        </div>
      )}
    </FormSection>
  )
}

export default LibraryStaticQrSection
