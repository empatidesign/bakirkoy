import { ModuleSendMessageModal } from '@/components/specialized/ModuleNotificationTemplates'

export function QuizSendMessageModal({ open, ids, targetKind, onClose }: { open: boolean; ids: string[]; targetKind: 'quiz' | 'participation'; onClose: () => void }) {
  return <ModuleSendMessageModal open={open} module="quiz" ids={ids} targetKind={targetKind} title="Bilgi Yarışması Şablonlu Mesaj" onClose={onClose} />
}
