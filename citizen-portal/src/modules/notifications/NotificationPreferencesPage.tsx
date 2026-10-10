import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { BellRingIcon, BellOffIcon, Loader2Icon } from 'lucide-react'
import { Card, Switch, Button, ModuleHeader, TimePicker } from '@/design-system'
import { MoonIcon } from 'lucide-react'
import notificationPreferenceService from '@/services/notificationPreference.service'
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_LABELS,
  type NotificationCategory,
  type NotificationPreference,
} from '@/types/notificationPreference.types'

type Channel = 'pushEnabled' | 'smsEnabled' | 'emailEnabled' | 'inAppEnabled'

const CHANNEL_LABELS: Record<Channel, string> = {
  pushEnabled: 'Push Bildirim',
  smsEnabled: 'SMS',
  emailEnabled: 'E-posta',
  inAppEnabled: 'Uygulama İçi',
}

const CHANNELS: Channel[] = ['pushEnabled', 'smsEnabled', 'emailEnabled', 'inAppEnabled']

const defaultPreference = (category: NotificationCategory): NotificationPreference => ({
  id: null,
  category,
  pushEnabled: true,
  smsEnabled: true,
  emailEnabled: true,
  inAppEnabled: true,
  quietHoursStart: null,
  quietHoursEnd: null,
})

export const NotificationPreferencesPage = () => {
  const [preferences, setPreferences] = useState<Record<NotificationCategory, NotificationPreference> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [savingCategory, setSavingCategory] = useState<NotificationCategory | null>(null)
  const [optingOutAll, setOptingOutAll] = useState(false)
  const [quietStart, setQuietStart] = useState('')
  const [quietEnd, setQuietEnd] = useState('')
  const [savingQuiet, setSavingQuiet] = useState(false)

  const load = async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await notificationPreferenceService.getPreferences()
      const byCategory = Object.fromEntries(
        NOTIFICATION_CATEGORIES.map((c) => {
          const found = data.find((p) => p.category === c)
          return [c, found ?? defaultPreference(c)]
        }),
      ) as Record<NotificationCategory, NotificationPreference>
      setPreferences(byCategory)
      const withQuiet = data.find((p) => p.quietHoursStart && p.quietHoursEnd)
      setQuietStart(withQuiet?.quietHoursStart ?? '')
      setQuietEnd(withQuiet?.quietHoursEnd ?? '')
    } catch {
      setPreferences(null)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const handleToggle = async (category: NotificationCategory, channel: Channel, value: boolean) => {
    if (!preferences) return
    const current = preferences[category]
    const updated = { ...current, [channel]: value }

    setPreferences((prev) => (prev ? { ...prev, [category]: updated } : prev))
    setSavingCategory(category)
    try {
      const saved = await notificationPreferenceService.upsert({
        category,
        pushEnabled: updated.pushEnabled,
        smsEnabled: updated.smsEnabled,
        emailEnabled: updated.emailEnabled,
        inAppEnabled: updated.inAppEnabled,
        quietHoursStart: quietStart || null,
        quietHoursEnd: quietEnd || null,
      })
      setPreferences((prev) => (prev ? { ...prev, [category]: saved } : prev))
    } catch {
      setPreferences((prev) => (prev ? { ...prev, [category]: current } : prev))
      toast.error('Tercih güncellenemedi.')
    } finally {
      setSavingCategory(null)
    }
  }

  const handleSaveQuietHours = async (start: string, end: string) => {
    if (!preferences) return
    const bothOrNone = (!start && !end) || (start && end)
    if (!bothOrNone) {
      toast.error('Sessiz saatler için hem başlangıç hem bitiş girin.')
      return
    }
    const nextStart = start || null
    const nextEnd = end || null
    setSavingQuiet(true)
    try {
      const saved = await notificationPreferenceService.setQuietHoursForAll(
        Object.values(preferences),
        nextStart,
        nextEnd,
      )
      const byCategory = Object.fromEntries(saved.map((p) => [p.category, p])) as Record<
        NotificationCategory,
        NotificationPreference
      >
      setPreferences((prev) => (prev ? { ...prev, ...byCategory } : prev))
      toast.success(nextStart ? 'Sessiz saatler kaydedildi.' : 'Sessiz saatler kaldırıldı.')
    } catch {
      toast.error('Sessiz saatler kaydedilemedi.')
    } finally {
      setSavingQuiet(false)
    }
  }

  const handleOptOutAll = async () => {
    setOptingOutAll(true)
    try {
      await notificationPreferenceService.optOutAll()
      toast.success('Tüm bildirimler kapatıldı.')
      await load()
    } catch {
      toast.error('İşlem başarısız oldu.')
    } finally {
      setOptingOutAll(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={BellRingIcon}
        title="Bildirim Tercihleri"
        subtitle="Hangi kategoriden, hangi kanaldan bildirim almak istediğinizi seçin"
        gradient="linear-gradient(160deg,#0f172a 0%,#1e3a8a 55%,#1a56a0 100%)"
      />
      <div className="flex-1 space-y-3 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : loadError || !preferences ? (
          <Card padded>
            <div className="space-y-3 py-4 text-center">
              <BellOffIcon className="mx-auto h-8 w-8 text-foreground-subtle" />
              <p className="type-body-strong">Tercihleriniz yüklenemedi</p>
              <p className="type-caption text-foreground-subtle">
                Mevcut tercihleriniz görüntülenemediği için değişiklik yapılamıyor.
                Bağlantınızı kontrol edip tekrar deneyin.
              </p>
              <Button variant="outline" size="sm" onClick={() => void load()}>Tekrar Dene</Button>
            </div>
          </Card>
        ) : (
          <>
            <Card padded>
              <div className="flex items-center gap-2">
                <MoonIcon className="h-4 w-4 text-primary" />
                <p className="type-body-strong">Sessiz Saatler</p>
                {savingQuiet && <Loader2Icon className="h-3.5 w-3.5 animate-spin text-foreground-subtle" />}
              </div>
              <p className="type-caption mt-1 text-foreground-subtle">
                Bu saatler arasında anlık bildirim ve SMS gönderilmez. Uygulama içi bildirimler kaydedilmeye devam eder.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <span className="type-caption mb-1 block">Başlangıç</span>
                  <TimePicker value={quietStart} onChange={setQuietStart} disabled={savingQuiet} />
                </div>
                <div>
                  <span className="type-caption mb-1 block">Bitiş</span>
                  <TimePicker value={quietEnd} onChange={setQuietEnd} disabled={savingQuiet} />
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                isLoading={savingQuiet}
                onClick={() => void handleSaveQuietHours(quietStart, quietEnd)}
              >
                Sessiz Saatleri Kaydet
              </Button>
            </Card>

            {NOTIFICATION_CATEGORIES.map((category) => {
              const pref = preferences[category]
              return (
                <Card key={category} padded>
                  <div className="flex items-center justify-between">
                    <p className="type-body-strong">{NOTIFICATION_CATEGORY_LABELS[category]}</p>
                    {savingCategory === category && <Loader2Icon className="h-3.5 w-3.5 animate-spin text-foreground-subtle" />}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {CHANNELS.map((channel) => (
                      <div key={channel} className="flex items-center justify-between gap-2">
                        <span className="type-caption truncate">{CHANNEL_LABELS[channel]}</span>
                        <Switch
                          checked={pref[channel]}
                          disabled={savingCategory === category}
                          onCheckedChange={(v) => void handleToggle(category, channel, v)}
                        />
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}

            <Button
              variant="outline"
              size="lg"
              className="w-full text-danger"
              iconLeft={<BellOffIcon className="h-4 w-4" />}
              isLoading={optingOutAll}
              onClick={() => void handleOptOutAll()}
            >
              Tüm Bildirimleri Kapat
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
