import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  SettingsIcon, Users2Icon, BellIcon, ClipboardCheckIcon, QrCodeIcon, ImageIcon, MessageSquareIcon, InfoIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Select, Button, SkeletonRows, FormSection, Field, ToggleRow, NumberInput, Textarea, Badge, Banner } from '@/design-system'
import eventSettingsService from '@/services/eventSettings.service'
import { defaultEventSettings, LIMIT_PERIOD_OPTIONS, QR_MODE_OPTIONS, EVENT_NOTIFICATION_META, EVENT_NOTIFICATION_PLACEHOLDERS } from '@/types/eventSettings.types'
import type { EventSettings, ImageVariants, EventNotificationTemplate } from '@/types/eventSettings.types'

const SpecCell = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <NumberInput value={value} onChange={onChange} size="sm" className="px-2 text-center" />
)

const SPEC_ROWS: { key: keyof ImageVariants; label: string }[] = [
  { key: 'cover', label: 'Kapak' },
  { key: 'card', label: 'Kart' },
  { key: 'thumb', label: 'Küçük' },
]

const ImageGroup = ({ title, value, onChange }: { title: string; value: ImageVariants; onChange: (v: ImageVariants) => void }) => (
  <div className="rounded-card border border-border bg-surface-1 p-3">
    <p className="mb-2 type-body-strong">{title}</p>
    <div className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-x-2 gap-y-1.5">
      <span />
      <span className="type-caption text-center">Genişlik</span>
      <span className="type-caption text-center">Yükseklik</span>
      <span className="type-caption text-center">Maks (KB)</span>
      {SPEC_ROWS.map((r) => (
        <Fragment key={r.key}>
          <span className="pr-2 type-body-strong">{r.label}</span>
          <SpecCell value={value[r.key].width} onChange={(n) => onChange({ ...value, [r.key]: { ...value[r.key], width: n } })} />
          <SpecCell value={value[r.key].height} onChange={(n) => onChange({ ...value, [r.key]: { ...value[r.key], height: n } })} />
          <SpecCell value={value[r.key].maxSizeKb} onChange={(n) => onChange({ ...value, [r.key]: { ...value[r.key], maxSizeKb: n } })} />
        </Fragment>
      ))}
    </div>
  </div>
)

export const SettingsTab = () => {
  const [s, setS] = useState<EventSettings>(defaultEventSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    eventSettingsService.get()
      .then(setS)
      .catch(() => setS(defaultEventSettings()))
      .finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      await eventSettingsService.save(s)
      toast.success('Etkinlik ayarları kaydedildi.')
    } finally {
      setSaving(false)
    }
  }

  const patchGeneral = (p: Partial<EventSettings['general']>) => setS((c) => ({ ...c, general: { ...c.general, ...p } }))
  const patchPart = (p: Partial<EventSettings['participation']>) => setS((c) => ({ ...c, participation: { ...c.participation, ...p } }))
  const patchNotif = (p: Partial<EventSettings['notifications']>) => setS((c) => ({ ...c, notifications: { ...c.notifications, ...p } }))
  const patchTemplate = (event: string, p: Partial<EventNotificationTemplate>) => setS((c) => ({ ...c, notificationTemplates: (c.notificationTemplates ?? []).map((t) => (t.event === event ? { ...t, ...p } : t)) }))
  const patchAtt = (p: Partial<EventSettings['attendance']>) => setS((c) => ({ ...c, attendance: { ...c.attendance, ...p } }))
  const patchQr = (p: Partial<EventSettings['qr']>) => setS((c) => ({ ...c, qr: { ...c.qr, ...p } }))
  const patchImg = (p: Partial<EventSettings['images']>) => setS((c) => ({ ...c, images: { ...c.images, ...p } }))

  if (loading) return <SkeletonRows rows={6} />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="type-section">Etkinlik Ayarları</h2>
          <p className="type-section-sub">Bir etkinlik oluşturulurken ayar yapılmazsa bu varsayılanlar geçerli olur.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setS(defaultEventSettings())} disabled={saving}>Sıfırla</Button>
          <Button variant="primary" onClick={save} isLoading={saving}>Ayarları Kaydet</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormSection variant="card" icon={SettingsIcon} title="Genel Kurallar" subtitle="Onay, yedek liste ve yaş varsayılanları">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum Yaş"><NumberInput value={s.general.minAge} onChange={(n) => patchGeneral({ minAge: n })} suffix="yaş" /></Field>
            <Field label="Maksimum Yaş"><NumberInput value={s.general.maxAge} onChange={(n) => patchGeneral({ maxAge: n })} suffix="yaş" /></Field>
            <Field label="Yedek Liste Oranı" hint="Yeni etkinlik formunda kapasiteye göre önerilen yedek kontenjan hesaplamasında kullanılır."><NumberInput value={s.general.waitingListRatio} onChange={(n) => patchGeneral({ waitingListRatio: n })} suffix="%" /></Field>
            <Field label="İptal Süresi"><NumberInput value={s.general.cancellationDeadlineHours} onChange={(n) => patchGeneral({ cancellationDeadlineHours: n })} suffix="saat" /></Field>
          </div>
          <ToggleRow label="Başvurularda manuel onay zorunlu" description="Kapalıysa tüm başvurular otomatik onaylanır." checked={s.general.requireApproval} onChange={(v) => patchGeneral({ requireApproval: v })} />
          <ToggleRow label="Yedek liste açık" checked={s.general.allowWaitingList} onChange={(v) => patchGeneral({ allowWaitingList: v })} />
          <ToggleRow label="Yedek listeyi otomatik yükselt" description="Kontenjan boşalınca yedek listedeki ilk kişi onaylanır." checked={s.general.autoApproveWaitingList} onChange={(v) => patchGeneral({ autoApproveWaitingList: v })} />
        </FormSection>

        <FormSection variant="card" icon={Users2Icon} title="Katılım Kuralları" subtitle="Katılım sınırı ve başvuru kısıtları">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Varsayılan Limit Periyodu">
              <Select value={s.participation.defaultLimitPeriod} onChange={(e) => patchPart({ defaultLimitPeriod: e.target.value as EventSettings['participation']['defaultLimitPeriod'] })}>
                {LIMIT_PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            <Field label="Limit Adedi"><NumberInput value={s.participation.defaultLimitCount} onChange={(n) => patchPart({ defaultLimitCount: n })} suffix="kez" /></Field>
          </div>
          <ToggleRow label="TC Kimlik tekilliği zorunlu" description="Aynı TC aynı seansa birden fazla başvuramaz." checked={s.participation.enforceTcUnique} onChange={(v) => patchPart({ enforceTcUnique: v })} />
          <ToggleRow label="Çift başvuruları engelle" checked={s.participation.blockDuplicateApplications} onChange={(v) => patchPart({ blockDuplicateApplications: v })} />
          <ToggleRow label="Cinsiyet eşleşmesi zorunlu" description="Etkinlik cinsiyet kuralı varsa başvuran eşleşmelidir." checked={s.participation.requireGenderMatch} onChange={(v) => patchPart({ requireGenderMatch: v })} />
        </FormSection>

        <FormSection variant="card" icon={BellIcon} title="Bildirimler" subtitle="Başvuru, hatırlatma ve iptal bildirimleri">
          <ToggleRow label="SMS bildirimi" checked={s.notifications.sms} onChange={(v) => patchNotif({ sms: v })} />
          <ToggleRow label="E-posta bildirimi" description="Hatırlatmalar, katılımcının e-postası varsa ayrıca e-posta ile de gönderilir" checked={s.notifications.email} onChange={(v) => patchNotif({ email: v })} />
          <ToggleRow label="Başvuru onay bildirimi" checked={s.notifications.applicationConfirm} onChange={(v) => patchNotif({ applicationConfirm: v })} />
          <ToggleRow label="24 saat önce hatırlatma" checked={s.notifications.reminder24h} onChange={(v) => patchNotif({ reminder24h: v })} />
          <ToggleRow label="1 saat önce hatırlatma" checked={s.notifications.reminder1h} onChange={(v) => patchNotif({ reminder1h: v })} />
          <ToggleRow label="İptal bildirimi" checked={s.notifications.cancellationNotice} onChange={(v) => patchNotif({ cancellationNotice: v })} />
        </FormSection>

        <FormSection variant="card" full icon={MessageSquareIcon} title="SMS ve Bildirim Şablonları" subtitle="Başvuru durumuna göre katılımcıya gönderilecek SMS ve uygulama bildirimi metinleri">
          <div className="space-y-1.5">
            <p className="type-caption">Aşağıdaki değişkenler gönderim sırasında otomatik doldurulur:</p>
            <div className="flex flex-wrap gap-1.5">
              {EVENT_NOTIFICATION_PLACEHOLDERS.map((ph) => <Badge key={ph} tone="neutral">{ph}</Badge>)}
            </div>
          </div>
          {EVENT_NOTIFICATION_META.map((meta) => {
            const tpl = (s.notificationTemplates ?? []).find((t) => t.event === meta.event)
            if (!tpl) return null
            return (
              <div key={meta.event} className="space-y-3 rounded-card border border-border bg-surface-1 p-3">
                <p className="type-body-strong">{meta.label}</p>
                <p className="type-caption text-foreground-muted">{meta.hint}</p>
                <div className="space-y-2">
                  <ToggleRow label="SMS" checked={tpl.smsEnabled} onChange={(v) => patchTemplate(meta.event, { smsEnabled: v })} />
                  {tpl.smsEnabled && (
                    <Textarea value={tpl.smsBody} onChange={(e) => patchTemplate(meta.event, { smsBody: e.target.value })} rows={2} maxLength={320} placeholder="SMS metni..." />
                  )}
                </div>
                <div className="space-y-2">
                  <ToggleRow label="Uygulama Bildirimi (Push)" checked={tpl.notifyEnabled} onChange={(v) => patchTemplate(meta.event, { notifyEnabled: v })} />
                  {tpl.notifyEnabled && (
                    <Textarea value={tpl.notifyBody} onChange={(e) => patchTemplate(meta.event, { notifyBody: e.target.value })} rows={2} maxLength={500} placeholder="Bildirim metni..." />
                  )}
                </div>
              </div>
            )
          })}
        </FormSection>

        <FormSection variant="card" icon={ClipboardCheckIcon} title="Yoklama Kuralları" subtitle="QR, manuel ve toplu yoklama kontrolleri">
          <ToggleRow label="QR ile giriş" checked={s.attendance.qrCheckIn} onChange={(v) => patchAtt({ qrCheckIn: v })} />
          <ToggleRow label="Manuel giriş" checked={s.attendance.manualCheckIn} onChange={(v) => patchAtt({ manualCheckIn: v })} />
          <ToggleRow label="Toplu giriş" checked={s.attendance.bulkCheckIn} onChange={(v) => patchAtt({ bulkCheckIn: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giriş Açılış" hint="Başlangıçtan kaç dakika önce giriş alınmaya başlar (0 = sınır yok)"><NumberInput value={s.attendance.openBeforeMinutes} onChange={(n) => patchAtt({ openBeforeMinutes: n })} suffix="dk" /></Field>
            <Field label="Geç Kalma Eşiği"><NumberInput value={s.attendance.lateThresholdMinutes} onChange={(n) => patchAtt({ lateThresholdMinutes: n })} suffix="dk" /></Field>
            <Field label="Yoklama Kapanış"><NumberInput value={s.attendance.closeAfterMinutes} onChange={(n) => patchAtt({ closeAfterMinutes: n })} suffix="dk" /></Field>
            <Field label="Çıkış Kapanış" hint="Başlangıçtan kaç dakika sonra çıkış kaydı kapanır (0 = sınır yok)"><NumberInput value={s.attendance.checkOutCloseAfterMinutes} onChange={(n) => patchAtt({ checkOutCloseAfterMinutes: n })} suffix="dk" /></Field>
          </div>
          <ToggleRow label="Başvurusuz katılıma izin ver" description="Açık etkinliklerde QR okutan herkes katılmış sayılır." checked={s.attendance.allowWalkIn} onChange={(v) => patchAtt({ allowWalkIn: v })} />
          <ToggleRow label="Çıkış zamanını kaydet" checked={s.attendance.recordCheckOut} onChange={(v) => patchAtt({ recordCheckOut: v })} />
        </FormSection>

        <FormSection variant="card" full icon={QrCodeIcon} title="QR ve Kiosk" subtitle="QR türü, yenileme ve kiosk ekranı">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="QR Türü">
              <Select value={s.qr.mode} onChange={(e) => patchQr({ mode: e.target.value as EventSettings['qr']['mode'] })}>
                {QR_MODE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </Field>
            {s.qr.mode === 'rotating' && (
              <Field label="QR Yenileme Süresi"><NumberInput value={s.qr.rotationSeconds} onChange={(n) => patchQr({ rotationSeconds: n })} suffix="sn" /></Field>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow label="Kiosk / ekran modu aktif" checked={s.qr.kioskEnabled} onChange={(v) => patchQr({ kioskEnabled: v })} />
            <ToggleRow label="Kiosk otomatik tam ekran" checked={s.qr.kioskAutoFullscreen} onChange={(v) => patchQr({ kioskAutoFullscreen: v })} />
            <ToggleRow label="Okutan kişinin adını göster" checked={s.qr.kioskShowName} onChange={(v) => patchQr({ kioskShowName: v })} />
            <ToggleRow label="Görevli için açık paylaşım linki" checked={s.qr.publicLinkEnabled} onChange={(v) => patchQr({ publicLinkEnabled: v })} />
          </div>
          {s.qr.publicLinkEnabled && (
            <ToggleRow label="Paylaşım linki için PIN iste" description="Açık ama 4 haneli PIN ile korumalı." checked={s.qr.publicLinkRequiresPin} onChange={(v) => patchQr({ publicLinkRequiresPin: v })} />
          )}
        </FormSection>

        <FormSection variant="card" full icon={ImageIcon} title="Görsel Ayarları" subtitle="Kırpma kuralları ve ek görsel ölçüleri">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow label="Kırpma (crop) seçeneği aktif" description="Etkinlik formunda görsel yüklerken kırpma aracı açılır." checked={s.images.cropEnabled} onChange={(v) => patchImg({ cropEnabled: v })} />
            <ToggleRow label="Otomatik sıkıştırma" description="Yüklenen görsel hedef boyuta göre otomatik sıkıştırılır." checked={s.images.autoCompress} onChange={(v) => patchImg({ autoCompress: v })} />
          </div>

          <Banner tone="info" icon={InfoIcon}>
            <span className="font-semibold">Etkinlik kapak görselleri sabit oranlarla yüklenir</span> (16:9, 4:3, 9:16) —
            bu ölçüler formdaki kırpma aracından gelir ve aşağıdaki alanlardan etkilenmez.
            Aşağıdaki Web/Mobil ölçüleri yalnızca <span className="font-semibold">Gezi (rota) görselleri</span> için
            ek olarak kabul edilen boyutları tanımlar.
          </Banner>

          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleRow label="Web ölçülerini zorunlu kıl" description="Gezi görsellerinde aşağıdaki web ölçüleri de kabul edilir." checked={s.images.enforceWebSpecs} onChange={(v) => patchImg({ enforceWebSpecs: v })} />
            <ToggleRow label="Mobil ölçülerini zorunlu kıl" description="Gezi görsellerinde aşağıdaki mobil ölçüleri de kabul edilir." checked={s.images.enforceMobileSpecs} onChange={(v) => patchImg({ enforceMobileSpecs: v })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ImageGroup title="Web Görselleri (Gezi)" value={s.images.web} onChange={(v) => patchImg({ web: v })} />
            <ImageGroup title="Mobil Görseller (Gezi)" value={s.images.mobile} onChange={(v) => patchImg({ mobile: v })} />
          </div>
        </FormSection>
      </div>
    </div>
  )
}
