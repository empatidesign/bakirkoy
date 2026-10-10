import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/design-system'
import moduleNotificationService from '@/services/moduleNotification.service'
import type { ModuleNotificationTemplate } from '@/types/moduleNotification.types'
import { ModuleNotificationSettingsSection, type ModuleNotificationKey, mergeModuleNotificationTemplates } from './ModuleNotificationTemplates'

export function ModuleNotificationSettingsTab({ module }: { module: ModuleNotificationKey }) {
  const [templates, setTemplates] = useState<ModuleNotificationTemplate[]>([])
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    moduleNotificationService.getSettings(module)
      .then((settings) => setTemplates(mergeModuleNotificationTemplates(module, settings.notificationTemplates)))
      .catch(() => setTemplates(mergeModuleNotificationTemplates(module)))
  }, [module])
  const save = async () => {
    setSaving(true)
    try {
      const saved = await moduleNotificationService.saveSettings(module, { notificationTemplates: templates })
      setTemplates(mergeModuleNotificationTemplates(module, saved.notificationTemplates))
      toast.success('Mesaj şablonları kaydedildi.')
    } finally { setSaving(false) }
  }
  return <div className="space-y-4"><ModuleNotificationSettingsSection module={module} templates={templates} onChange={setTemplates} /><div className="flex justify-end"><Button variant="primary" onClick={save} isLoading={saving}>Şablonları Kaydet</Button></div></div>
}
