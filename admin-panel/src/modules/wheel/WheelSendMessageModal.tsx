import { ModuleSendMessageModal } from '@/components/specialized/ModuleNotificationTemplates'

export function WheelSendMessageModal({ open, ids, targetKind = 'giftRequest', onClose }: { open: boolean; ids: string[]; targetKind?: 'giftRequest' | 'gift'; onClose: () => void }) {
  return <ModuleSendMessageModal open={open} module="wheel" ids={ids} targetKind={targetKind} title="Çark / Hediye Şablonlu Mesaj" onClose={onClose} />
}
