import { ModuleSendMessageModal } from '@/components/specialized/ModuleNotificationTemplates'

export function SurveySendMessageModal({ open, ids, onClose }: { open: boolean; ids: string[]; onClose: () => void }) {
  return <ModuleSendMessageModal open={open} module="survey" ids={ids} targetKind="survey" title="Anket Şablonlu Mesaj" onClose={onClose} />
}
