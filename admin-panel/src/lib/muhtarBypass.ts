import { toast } from 'sonner'
import authService from '@/services/auth.service'

export const openAdminPanelAs = async (adminUserId: string, next = '/') => {
  const panelWindow = window.open('about:blank', `admin_panel_${adminUserId}`)
  if (!panelWindow) {
    toast.error('Tarayıcı yeni pencereyi engelledi. Açılır pencerelere izin verin.')
    return
  }
  panelWindow.opener = null
  try {
    const { code } = await authService.generateBypassCode(adminUserId)
    const query = new URLSearchParams({ code })
    if (next && next !== '/') query.set('next', next)
    const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
    panelWindow.location.replace(`${window.location.origin}${base}/bypass?${query.toString()}`)
  } catch {
    panelWindow.close()
    toast.error('Panel açılamadı.')
  }
}

export const openMuhtarPanelAs = (adminUserId: string) => openAdminPanelAs(adminUserId, '/muhtarlik?tab=panelim')
