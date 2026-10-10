import { useState, useEffect } from 'react'
import {
  RadioTowerIcon, CheckCircle2Icon, XCircleIcon, DumbbellIcon, WavesIcon,
  HeartHandshakeIcon, CompassIcon, TentTreeIcon, FlaskConicalIcon,
  AccessibilityIcon, GraduationCapIcon, BusIcon, CalendarIcon,
  DoorOpenIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, Switch, Badge, Card, Banner, SkeletonRows } from '@/design-system'
import { api } from '@/services/api'

interface ModuleAttendanceConfig {
  id: string
  name: string
  category: 'facility' | 'travel' | 'event' | 'hall'
  icon: typeof DumbbellIcon
  attendanceSmsEnabled: boolean
  attendanceEnabled: boolean
  description: string
}

const INITIAL_MODULES: ModuleAttendanceConfig[] = [
  { id: 'sports', name: 'Spor Salonu Yönetimi', category: 'facility', icon: DumbbellIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Seans ve antrenman yoklamaları, veli ve sporcu SMS bildirimleri' },
  { id: 'pool', name: 'Havuz Yönetimi', category: 'facility', icon: WavesIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Havuz seans yoklamaları ve giriş-çıkış bildirimleri' },
  { id: 'women_family', name: 'Kadın ve Aile Kültür Sanat', category: 'facility', icon: HeartHandshakeIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Kurs ve atölye yoklamaları, katılımcı bilgilendirme SMS\'leri' },
  { id: 'kasif_cocuk', name: 'Kaşif Çocuk Akademisi', category: 'facility', icon: CompassIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Ders ve etkinlik yoklamaları, veli devamsızlık bildirimleri' },
  { id: 'youth_camp', name: 'Gençlik Kampı', category: 'facility', icon: TentTreeIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Kamp seans ve aktivite yoklamaları' },
  { id: 'scout_camp', name: 'İzcilik Kampı', category: 'facility', icon: TentTreeIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'İzci çalışma ve kamp yoklamaları' },
  { id: 'science_center', name: 'Bilim Merkezi', category: 'facility', icon: FlaskConicalIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Deney ve atölye seans yoklamaları' },
  { id: 'accessible', name: 'Engelsiz Yaşam Merkezi', category: 'facility', icon: AccessibilityIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Özel eğitim ve rehabilitasyon seans yoklamaları' },
  { id: 'seda', name: 'SEDA (Bakırköy Eğitime Destek)', category: 'facility', icon: GraduationCapIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Dershane ve etüt seans yoklamaları' },
  { id: 'travels', name: 'Gezi Sistemi', category: 'travel', icon: BusIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Sefer otobüs biniş manifestosu ve yolcu yoklamaları' },
  { id: 'events', name: 'Etkinlik Yönetimi', category: 'event', icon: CalendarIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Etkinlik giriş kontrolü, kiosk ve QR yoklamaları' },
  { id: 'halls', name: 'Salon Yönetimi', category: 'hall', icon: DoorOpenIcon, attendanceSmsEnabled: false, attendanceEnabled: true, description: 'Salon seans ve etkinlik giriş kontrolü' },
]

export const AttendanceControlSettingsTab = () => {
  const [modules, setModules] = useState<ModuleAttendanceConfig[]>(INITIAL_MODULES)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  const loadSettings = async () => {
    setLoading(true)
    try {
      const updated = await Promise.all(
        INITIAL_MODULES.map(async (mod) => {
          try {
            if (mod.category === 'facility') {
              const res = await api.get<{ data: { settings: { attendanceSmsEnabled?: boolean; attendanceEnabled?: boolean } } }>(
                `/${mod.id}/settings/general`,
              )
              const s = res.data.data?.settings ?? {}
              return {
                ...mod,
                attendanceSmsEnabled: s.attendanceSmsEnabled ?? false,
                attendanceEnabled: s.attendanceEnabled ?? true,
              }
            }
            if (mod.category === 'travel') {
              const raw = localStorage.getItem('travel_attendance_sms_enabled')
              return { ...mod, attendanceSmsEnabled: raw === 'true', attendanceEnabled: true }
            }
            if (mod.category === 'event') {
              const raw = localStorage.getItem('event_attendance_sms_enabled')
              return { ...mod, attendanceSmsEnabled: raw === 'true', attendanceEnabled: true }
            }
            if (mod.category === 'hall') {
              const raw = localStorage.getItem('hall_attendance_sms_enabled')
              return { ...mod, attendanceSmsEnabled: raw === 'true', attendanceEnabled: true }
            }
            return mod
          } catch {
            return mod
          }
        }),
      )
      setModules(updated)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [])

  const saveModuleConfig = async (modId: string, patch: Partial<ModuleAttendanceConfig>) => {
    setSavingId(modId)
    const target = modules.find((m) => m.id === modId)
    if (!target) return

    const nextSms = patch.attendanceSmsEnabled !== undefined ? patch.attendanceSmsEnabled : target.attendanceSmsEnabled
    const nextAtt = patch.attendanceEnabled !== undefined ? patch.attendanceEnabled : target.attendanceEnabled

    try {
      if (target.category === 'facility') {
        const res = await api.get<{ data: { settings: Record<string, unknown> } }>(`/${modId}/settings/general`)
        const current = res.data.data?.settings ?? {}
        await api.put(`/${modId}/settings/general`, {
          settings: {
            ...current,
            attendanceSmsEnabled: nextSms,
            attendanceEnabled: nextAtt,
          },
        })
      } else {
        localStorage.setItem(`${modId}_attendance_sms_enabled`, String(nextSms))
        localStorage.setItem(`${modId}_attendance_enabled`, String(nextAtt))
      }

      setModules((prev) => prev.map((m) => (m.id === modId ? { ...m, ...patch } : m)))
      toast.success(`${target.name} ayarları kaydedildi.`)
    } catch {
      toast.error(`${target.name} ayarı kaydedilirken hata oluştu.`)
    } finally {
      setSavingId(null)
    }
  }

  const setAllSmsState = async (enabled: boolean) => {
    setBulkProcessing(true)
    try {
      for (const mod of modules) {
        if (mod.category === 'facility') {
          try {
            const res = await api.get<{ data: { settings: Record<string, unknown> } }>(`/${mod.id}/settings/general`)
            const current = res.data.data?.settings ?? {}
            await api.put(`/${mod.id}/settings/general`, {
              settings: {
                ...current,
                attendanceSmsEnabled: enabled,
              },
            })
          } catch { /* sessiz geç */ }
        } else {
          localStorage.setItem(`${mod.id}_attendance_sms_enabled`, String(enabled))
        }
      }

      setModules((prev) => prev.map((m) => ({ ...m, attendanceSmsEnabled: enabled })))
      toast.success(enabled ? 'Tüm modüllerde yoklama SMS bildirimleri AKTİF yapıldı.' : 'Tüm modüllerde yoklama SMS bildirimleri PASİFE alındı (SMS gönderilmeyecek).')
    } finally {
      setBulkProcessing(false)
    }
  }

  const activeCount = modules.filter((m) => m.attendanceSmsEnabled).length
  const passiveCount = modules.length - activeCount

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[hsl(var(--border))] bg-card p-5 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <RadioTowerIcon className="h-5 w-5 text-primary" />
            <h2 className="text-base font-bold text-foreground-strong">Tüm Modüllerde Yoklama & SMS Kontrolü</h2>
          </div>
          <p className="text-xs text-foreground-muted">
            Yoklama alındığında katılımcı ve velilere SMS gönderilip gönderilmeyeceğini modül bazında veya toplu olarak buradan yönetebilirsiniz.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 mr-2">
            <Badge tone="success" className="tabular-nums font-semibold">{activeCount} Aktif</Badge>
            <Badge tone="neutral" className="tabular-nums font-semibold">{passiveCount} Pasif</Badge>
          </div>

          <Button
            variant="outline"
            size="sm"
            iconLeft={<CheckCircle2Icon className="h-4 w-4 text-success" />}
            isLoading={bulkProcessing}
            onClick={() => setAllSmsState(true)}
          >
            Tümünü Aktif Et
          </Button>

          <Button
            variant="outline"
            size="sm"
            iconLeft={<XCircleIcon className="h-4 w-4 text-danger" />}
            isLoading={bulkProcessing}
            onClick={() => setAllSmsState(false)}
          >
            Tümünü Pasif Yap
          </Button>
        </div>
      </div>

      <Banner tone="info" variant="soft">
        <strong>Güvenlik & Kota Önlemi:</strong> Bir modülde "Yoklama SMS Bildirimleri" pasifken, görevli personel yoklama alsa bile sisteme sadece katılım bilgisi kaydedilir; vatandaşlara veya velilere kesinlikle SMS gitmez. SMS gönderimi yalnızca ilgili modül açıkken yapılır.
      </Banner>

      {loading ? (
        <Card padded><SkeletonRows rows={8} /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {modules.map((mod) => {
            const Icon = mod.icon
            const isSaving = savingId === mod.id

            return (
              <Card key={mod.id} padded className="flex flex-col justify-between gap-4 transition-all hover:shadow-md">
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground-strong">{mod.name}</p>
                        <span className="text-[11px] text-foreground-muted">{mod.category === 'facility' ? 'Tesis Modülü' : 'Etkinlik / Gezi'}</span>
                      </div>
                    </div>

                    <Badge tone={mod.attendanceSmsEnabled ? 'success' : 'neutral'}>
                      {mod.attendanceSmsEnabled ? 'SMS Aktif' : 'SMS Pasif'}
                    </Badge>
                  </div>

                  <p className="text-xs text-foreground-muted leading-relaxed line-clamp-2">
                    {mod.description}
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-surface-1 p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-foreground-strong block">Yoklama SMS Bildirimi</span>
                      <span className="text-[10px] text-foreground-muted">Yoklama kaydedildiğinde SMS gönder</span>
                    </div>
                    <Switch
                      checked={mod.attendanceSmsEnabled}
                      disabled={isSaving || bulkProcessing}
                      onCheckedChange={(checked) => saveModuleConfig(mod.id, { attendanceSmsEnabled: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2">
                    <div>
                      <span className="text-xs font-semibold text-foreground-strong block">Yoklama Sistemi</span>
                      <span className="text-[10px] text-foreground-muted">Modülde yoklama alımına izin ver</span>
                    </div>
                    <Switch
                      checked={mod.attendanceEnabled}
                      disabled={isSaving || bulkProcessing}
                      onCheckedChange={(checked) => saveModuleConfig(mod.id, { attendanceEnabled: checked })}
                    />
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
