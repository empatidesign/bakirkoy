import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  SettingsIcon, AwardIcon, CoffeeIcon, SaveIcon, HourglassIcon, InfoIcon,
} from 'lucide-react'
import {
  SectionToolbar, Card, FormSection, Field, NumberInput, DurationInput, ToggleRow, Button, SkeletonRows, Banner,
} from '@/design-system'
import libraryService from '@/services/library.service'
import type { LibrarySettings } from '@/types/library.types'
import { LibraryNotificationTemplatesSection } from './LibraryNotificationTemplatesSection'
import { LibraryStaticQrSection } from './LibraryStaticQrSection'

export const SettingsTab = ({ libraryId, libraryName }: { libraryId?: string | null; libraryName?: string }) => {
  const isGlobal = !libraryId
  const [form, setForm] = useState<LibrarySettings | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    libraryService.settings.get(libraryId ?? undefined).then(setForm).catch(() => setForm(null))
  }, [libraryId])
  useEffect(() => { load() }, [load])

  const set = <K extends keyof LibrarySettings>(key: K, value: LibrarySettings[K]) =>
    setForm((p) => (p ? { ...p, [key]: value } : p))

  const num = (label: string, key: keyof LibrarySettings, suffix?: string) => (
    <Field label={label}>
      <NumberInput value={Number((form as LibrarySettings)[key] ?? 0)} onChange={(n) => set(key, n as LibrarySettings[typeof key])} min={0} suffix={suffix} />
    </Field>
  )

  const save = async () => {
    if (!form) return
    setSaving(true)
    try {
      await libraryService.settings.save(libraryId ?? null, form)
      toast.success(isGlobal ? 'Genel varsayılan ayarlar kaydedildi.' : 'Ayarlar kaydedildi.')
    } finally { setSaving(false) }
  }

  if (!form) {
    return (
      <div className="space-y-4">
        <SectionToolbar icon={SettingsIcon} title="Ayarlar" subtitle="Puan ve operasyon kuralları" />
        <Card padded><SkeletonRows rows={5} /></Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionToolbar
        icon={SettingsIcon}
        title={isGlobal ? 'Genel Varsayılan Ayarlar' : 'Ayarlar'}
        subtitle={isGlobal
          ? 'Kütüphaneye özel ayarı OLMAYAN tüm kütüphanelere uygulanır. Belirli bir kütüphanede farklı bir değer gerekiyorsa, o kütüphanenin kendi Ayarlar sekmesinden değiştirin — bu, genel varsayılanı etkilemez.'
          : 'Bu kütüphaneye özel puan ve operasyon kuralları'}
        actions={<Button variant="primary" size="sm" isLoading={saving} onClick={save}><SaveIcon className="h-4 w-4" /> Kaydet</Button>}
      />
      {isGlobal && (
        <Banner tone="info" variant="soft" icon={InfoIcon}>
          Burada yaptığınız değişiklikler, kendi ayarını hiç kaydetmemiş TÜM kütüphanelerde anında geçerli olur. Zaten kendi ayarını kaydetmiş bir kütüphane bu genel değerlerden etkilenmez.
        </Banner>
      )}

      {libraryId && <LibraryStaticQrSection libraryId={libraryId} libraryName={libraryName} />}

      <FormSection variant="card" icon={AwardIcon} title="Puan Ayarları" subtitle="Turnike/QR giriş-çıkışı tamamlandığında verilen puanlar">
        <ToggleRow label="Puan sistemi aktif" description="Kapalıyken bu kütüphane puan üretmez." checked={form.pointsEnabled} onChange={(v) => set('pointsEnabled', v)} />
        {form.pointsEnabled && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {num('Ziyaret Başı Puan', 'pointsPerVisit', 'puan')}
              {num('Günlük Puan Tavanı', 'dailyPointCap', 'puan')}
              {num('Haftalık Puan Tavanı', 'weeklyPointCap', 'puan')}
            </div>
            <ToggleRow label="QR ile giriş zorunlu" description="Kapalıysa manuel/turnike girişi de puan üretir." checked={form.qrRequired} onChange={(v) => set('qrRequired', v)} />
            <ToggleRow label="Hem giriş hem çıkış kaydı gerekli" description="Sadece giriş yapanlar puan kazanmaz; çıkış kaydı zorunlu." checked={form.requiresEntryAndExit} onChange={(v) => set('requiresEntryAndExit', v)} />
          </>
        )}
      </FormSection>

      <FormSection variant="card" icon={InfoIcon} title="Giriş Kısıtlaması" subtitle="Puan ayarlarından bağımsız çalışır — puan sistemi kapalıyken de uygulanır">
        <Field label="Günlük Ziyaret Limiti" hint="0 = sınırsız (önerilen). 1'e ayarlarsanız bir kişi aynı gün ikinci kez GİREMEZ — turnike arızası/yanlış okutma gibi durumlarda bile. Yalnızca gerçekten 'günde bir kez' kuralı istiyorsanız değiştirin.">
          <NumberInput value={Number(form.dailyVisitCap ?? 0)} onChange={(n) => set('dailyVisitCap', n)} min={0} suffix="giriş/gün" />
        </Field>
        <ToggleRow
          label="Gecikmiş kitabı olan üyenin girişini engelle"
          description="Kapalıyken (varsayılan) sadece personele bildirim gider, üye yine de girebilir. Açıksa teslim tarihi geçmiş emanet/kitabı olan üye kapıdan giremez (tüm giriş yolları: manuel, sabit QR, turnike/cihaz)."
          checked={form.blockEntryOnOverdue ?? false}
          onChange={(v) => set('blockEntryOnOverdue', v)}
        />
      </FormSection>

      <FormSection variant="card" icon={CoffeeIcon} title="Mola & Çalışma Kuralları">
        <ToggleRow
          label="Mola sistemi aktif"
          description="Kapalıyken bu kütüphanede kısa/uzun mola talebi kabul edilmez; üyeler yalnızca giriş/çıkış yapabilir (ör. sadece giriş-çıkış saatinin tutulduğu kütüphaneler)."
          checked={form.breakSystemEnabled ?? true}
          onChange={(v) => set('breakSystemEnabled', v)}
        />
        {(form.breakSystemEnabled ?? true) && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {num('Standart Mola', 'breakDurationMinutes', 'dk')}
          {num('Günlük Max Mola', 'maxDailyBreaks', 'adet')}
          {num('Uzun Mola Süresi', 'longBreakDurationMinutes', 'dk')}
          {num('Kısa Mola Bekleme Süresi', 'shortBreakCooldownMinutes', 'dk')}
          <Field label="Günlük Max Uzun Mola" hint="0 = sınırsız.">
            <NumberInput value={Number(form.maxDailyLongBreaks ?? 0)} onChange={(n) => set('maxDailyLongBreaks', n)} min={0} suffix="adet" />
          </Field>
          <Field label="Günlük Max Çalışma" hint="0 = süresiz: üye o gün istediği kadar kalır. Süre girilirse bitimine son 15 dk kala uyarı gönderilir.">
            <NumberInput value={Number(form.maxStudyHoursPerDay ?? 0)} onChange={(n) => set('maxStudyHoursPerDay', n)} min={0} suffix="saat" />
          </Field>
          {num('Zorunlu Mola Sonrası', 'requireBreakAfterHours', 'saat')}
          {num('Moladan Dönüş Süresi', 'breakReturnGraceMinutes', 'dk')}
          <Field label="Giriş Sonrası Mola Bekleme" hint="Üye içeri girdikten sonra bu süre dolmadan kısa mola talep edemez (ör. 10 dk). 0 = kısıtlama yok.">
            <NumberInput value={Number(form.minEntryBeforeBreakMinutes ?? 0)} onChange={(n) => set('minEntryBeforeBreakMinutes', n)} min={0} suffix="dk" />
          </Field>
          <Field label="Max Oturum Süresi" hint="0 = Günlük Max Çalışma değeri kullanılır. Girilirse bu değer önceliklidir.">
            <NumberInput value={Number(form.maxSessionMinutes ?? 0)} onChange={(n) => set('maxSessionMinutes', n)} min={0} suffix="dk" />
          </Field>
          <Field label="Min. Çıkış Süresi" hint="Giriş yaptıktan sonra üye bu süre dolmadan çıkış yapamaz. 0 = kısıtlama yok.">
            <NumberInput value={Number(form.minCheckoutAfterMinutes ?? 0)} onChange={(n) => set('minCheckoutAfterMinutes', n)} min={0} suffix="dk" />
          </Field>
        </div>
        )}
        {(form.breakSystemEnabled ?? true) && (
        <>
        <ToggleRow label="Saat başı mola sistemi" description="Her çalışılan saat için mola hakkı biriktirir." checked={form.hourlyBreakEnabled} onChange={(v) => set('hourlyBreakEnabled', v)} />
        {form.hourlyBreakEnabled && (
          <div className="grid grid-cols-2 gap-3">
            {num('Her saat için mola', 'hourlyBreakMinutesPerHour', 'dk')}
            {num('Günlük Max Mola (saatlik)', 'hourlyBreakMaxPerDay', 'adet')}
          </div>
        )}
        </>
        )}
      </FormSection>

      <FormSection variant="card" icon={HourglassIcon} title="Sıra & Rezervasyon">
        <Banner tone="info" variant="soft" icon={InfoIcon}>
          Rezervasyon aynı gün içinde çalışır; ileri tarih seçilemez. Üye yer ayırttıktan sonra “Rezervasyon Giriş Süresi” içinde kütüphaneye giriş yapmalı; süre dolmadan son 5 dk kala uyarı gönderilir, dolduğunda rezervasyon düşer.
        </Banner>
        <ToggleRow
          label="Otomatik Sıra Çağrısı"
          description="Aktif çağrılan kalmadığında ve sırada bekleyen varsa sistem otomatik olarak sıra başını çağırır."
          checked={form.autoQueueCallEnabled ?? false}
          onChange={(v) => set('autoQueueCallEnabled', v)}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {num('Sıra Çağrı Penceresi', 'queueCallWindowMinutes', 'dk')}
          {num('Otomatik Çıkış Süresi', 'autoCheckOutAfterMinutes', 'dk')}
          {num('Günlük Rezervasyon Limiti', 'dailyReservationLimitPerLibrary', 'adet')}
        </div>
        <Field label="Rezervasyon Giriş Süresi" hint="Üye rezervasyon yaptıktan sonra bu süre içinde giriş yapmalı.">
          <DurationInput value={Number(form.reservationHoldWindowMinutes ?? 0)} onChange={(n) => set('reservationHoldWindowMinutes', n)} />
        </Field>
        <Field label="Yer Seçip Giriş Bekleme Süresi (Walk-in)" hint="Üye kapıda/mobil uygulamada boş yer seçtikten sonra kapı kilidini bu süre içinde okutmalı, aksi halde yer serbest kalır.">
          <DurationInput value={Number(form.walkInHoldMinutes ?? 0)} onChange={(n) => set('walkInHoldMinutes', n)} />
        </Field>
        <ToggleRow
          label="Uyarıları e-posta ile de gönder"
          description="Rezervasyon giriş süresi, mola bitişi ve çalışma süresi uyarıları, üyenin e-posta adresi varsa SMS/bildirime ek olarak e-posta ile de gönderilir."
          checked={form.memberWarnEmailEnabled ?? false}
          onChange={(v) => set('memberWarnEmailEnabled', v)}
        />
        <p className="type-caption">Sıra çağrı penceresi, geri sayım göstergesini belirler. Otomatik çıkış süresi “0” ise hareketsizlik kapanışı pasiftir.</p>
      </FormSection>

      <LibraryNotificationTemplatesSection
        templates={form.notificationTemplates}
        onChange={(templates) => set('notificationTemplates', templates)}
      />
    </div>
  )
}
