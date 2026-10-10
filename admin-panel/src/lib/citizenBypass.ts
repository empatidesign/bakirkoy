import { toast } from 'sonner'
import participantService from '@/services/participant.service'
import { citizenPortalBase } from '@/lib/citizenPortal'

export const openCitizenPortalAs = async (participantId: string, to?: string) => {
  const portalWindow = window.open('about:blank', `citizen_portal_${participantId}`)
  if (!portalWindow) {
    toast.error('Tarayıcı yeni pencereyi engelledi. Açılır pencerelere izin verin.')
    return
  }
  portalWindow.opener = null
  try {
    const { code } = await participantService.generateBypassCode(participantId)
    const base = citizenPortalBase()
    const q = `code=${encodeURIComponent(code)}${to ? `&to=${encodeURIComponent(to)}` : ''}`
    portalWindow.location.replace(`${base}/bypass?${q}`)
  } catch {
    portalWindow.close()
    toast.error('Vatandaş portalı açılamadı.')
  }
}
