import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import companyService from '@/services/company.service'
import type { CompanySettings } from '@/types/company.types'
import { CompanyNotificationTemplatesSection } from './CompanyNotificationTemplatesSection'
import { mergeCompanyNotificationTemplates } from './companyNotificationDefaults'

export const CompanySettingsTab = () => {
  const { can } = useAuth()
  const canEdit = can('companies.edit')
  const [settings, setSettings] = useState<CompanySettings>({
    notificationTemplates: mergeCompanyNotificationTemplates(null),
  })

  const loadSettings = useCallback(() => {
    companyService.getSettings()
      .then((s) => setSettings({ ...s, notificationTemplates: mergeCompanyNotificationTemplates(s.notificationTemplates) }))
      .catch(() => undefined)
  }, [])
  useEffect(() => { loadSettings() }, [loadSettings])

  const saveTemplates = () => {
    companyService.updateSettings({ notificationTemplates: mergeCompanyNotificationTemplates(settings.notificationTemplates) })
      .then((s) => setSettings({ ...s, notificationTemplates: mergeCompanyNotificationTemplates(s.notificationTemplates) }))
      .then(() => toast.success('Mesaj şablonları kaydedildi.'))
      .catch((err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        toast.error(msg ?? 'Mesaj şablonları kaydedilemedi.')
        loadSettings()
      })
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="type-section">Firma Modülü Ayarları</h2>
        <p className="type-section-sub">Geçici şifre, onay ve şifre sıfırlama SMS metinlerini yönetin.</p>
      </div>

      <div className="space-y-3">
        <CompanyNotificationTemplatesSection
          templates={mergeCompanyNotificationTemplates(settings.notificationTemplates)}
          onChange={(notificationTemplates) => setSettings((s) => ({ ...s, notificationTemplates }))}
        />
        <div className="flex justify-end">
          <Button variant="primary" onClick={saveTemplates} disabled={!canEdit}>Mesaj Şablonlarını Kaydet</Button>
        </div>
      </div>
    </div>
  )
}
