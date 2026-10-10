import { useCallback, useEffect, useState } from 'react'
import { SettingsIcon, CalendarCheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Badge, Progress, FormSection, ToggleRow, Button } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import sedaService from '@/services/seda.service'
import type { SedaSettings } from '@/types/seda.types'
import { SedaNotificationTemplatesSection } from './SedaNotificationTemplatesSection'
import { SedaSendMessageModal } from './SedaSendMessageModal'
import { mergeSedaNotificationTemplates } from './sedaNotificationDefaults'

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('tr-TR') : '—')
const fillPercent = (cur: number, max: number) => (max > 0 ? Math.min(100, Math.round((cur / max) * 100)) : 0)

export const SedaSettingsTab = () => {
  const { can } = useAuth()
  const canEdit = can('seda.edit')
  const [sendModalOpen, setSendModalOpen] = useState(false)
  const [settings, setSettings] = useState<SedaSettings>({
    applicationsOpen: false, requireApproval: true, autoCloseWhenFull: true, activePeriod: null, notificationTemplates: mergeSedaNotificationTemplates(null),
  })

  const loadSettings = useCallback(() => {
    sedaService.getSettings().then((s) => { if (s) setSettings((prev) => ({ ...prev, ...s, notificationTemplates: mergeSedaNotificationTemplates(s.notificationTemplates) })) }).catch(() => undefined)
  }, [])
  useEffect(() => { loadSettings() }, [loadSettings])

  const saveSetting = (patch: Partial<Omit<SedaSettings, 'activePeriod'>>) => {
    setSettings((s) => ({ ...s, ...patch }))
    sedaService.updateSettings(patch)
      .then(setSettings)
      .then(() => toast.success('Ayar güncellendi.'))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        toast.error(msg ?? 'Ayar kaydedilemedi.')
        loadSettings()
      })
  }

  const saveTemplates = () => {
    sedaService.updateSettings({ notificationTemplates: mergeSedaNotificationTemplates(settings.notificationTemplates) })
      .then((s) => setSettings({ ...s, notificationTemplates: mergeSedaNotificationTemplates(s.notificationTemplates) }))
      .then(() => toast.success('Mesaj şablonları kaydedildi.'))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        toast.error(msg ?? 'Mesaj şablonları kaydedilemedi.')
        loadSettings()
      })
  }

  const active = settings.activePeriod

  return (
    <div className="space-y-4">
      <div>
        <h2 className="type-section">Başvuru Sistemi Ayarları</h2>
        <p className="type-section-sub">Başvuru alımını ve onay kurallarını yönetin. Dönemler "Dönemler" sekmesinden tanımlanır.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormSection variant="card" icon={SettingsIcon} title="Başvuru Durumu" subtitle="Başvuru alımı ve onay kuralları">
          <ToggleRow
            label="Başvuru Alımı"
            description={settings.applicationsOpen ? 'Yeni başvurular alınıyor.' : 'Yeni başvurular alınmıyor.'}
            checked={settings.applicationsOpen}
            disabled={!canEdit}
            onChange={(v) => saveSetting({ applicationsOpen: v })}
          />
          <ToggleRow
            label="Onay Zorunlu"
            description="Başvurular yönetici onayından sonra kesinleşir."
            checked={settings.requireApproval}
            disabled={!canEdit}
            onChange={(v) => saveSetting({ requireApproval: v })}
          />
        </FormSection>

        <FormSection variant="card" icon={CalendarCheckIcon} title="Aktif Dönem" subtitle="Şu an başvuruya açık dönem">
          {active ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="type-body-strong">{active.name}</p>
                <Badge tone="success">Aktif</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-card border border-border bg-surface-1 px-3 py-2">
                  <p className="type-caption">Başlangıç</p>
                  <p className="type-body-strong">{fmtDate(active.startDate)}</p>
                </div>
                <div className="rounded-card border border-border bg-surface-1 px-3 py-2">
                  <p className="type-caption">Bitiş</p>
                  <p className="type-body-strong">{fmtDate(active.endDate)}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="type-caption">Başvuru doluluğu</span>
                  <span className="type-caption tabular-nums">{active.currentApplications} / {active.maxApplications} (%{fillPercent(active.currentApplications, active.maxApplications)})</span>
                </div>
                <Progress value={fillPercent(active.currentApplications, active.maxApplications)} tone="primary" />
              </div>
              <div className="flex items-center justify-between rounded-card border border-border bg-surface-1 px-3 py-2">
                <span className="type-muted">Kalan kontenjan</span>
                <span className="type-body-strong tabular-nums">{Math.max(0, active.maxApplications - active.currentApplications)}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center rounded-card border border-dashed border-border bg-surface-1 px-3 py-8 text-center">
              <span className="type-muted">Henüz aktif dönem yok. “Dönemler” sekmesinden bir dönemi aktif edin.</span>
            </div>
          )}
        </FormSection>
      </div>

      <div className="space-y-3">
        <SedaNotificationTemplatesSection
          templates={mergeSedaNotificationTemplates(settings.notificationTemplates)}
          onChange={(notificationTemplates) => setSettings((s) => ({ ...s, notificationTemplates }))}
        />
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setSendModalOpen(true)} disabled={!canEdit}>Toplu Mesaj Gönder</Button>
          <Button variant="primary" onClick={saveTemplates} disabled={!canEdit}>Mesaj Şablonlarını Kaydet</Button>
        </div>
      </div>
      <SedaSendMessageModal open={sendModalOpen} onClose={() => setSendModalOpen(false)} />
    </div>
  )
}
