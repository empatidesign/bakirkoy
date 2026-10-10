import { ModuleSendMessageModal } from '@/components/specialized/ModuleNotificationTemplates'

export function MuhtarlikSendMessageModal({ open, ids, onClose }: { open: boolean; ids: string[]; onClose: () => void }) {
  return <ModuleSendMessageModal open={open} module="muhtarlik" ids={ids} targetKind="submission" title="Muhtarlık Şablonlu Mesaj" onClose={onClose} />
}
