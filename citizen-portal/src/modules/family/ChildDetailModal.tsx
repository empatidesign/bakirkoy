import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FingerprintIcon, CalendarIcon, UserIcon, InfoIcon, LogInIcon } from 'lucide-react'
import { Modal, Avatar, Badge, Button, DetailRow } from '@/design-system'
import { formatDate, maskTC } from '@/lib/utils'
import { useAuth } from '@/framework/auth/AuthContext'
import { GENDER_LABELS, type CitizenStatus } from '@/types/auth.types'
import type { CitizenChild } from '@/types/family.types'

const STATUS_META: Record<CitizenStatus, { label: string; tone: 'success' | 'neutral' | 'danger' }> = {
  Active: { label: 'Aktif', tone: 'success' },
  Passive: { label: 'Pasif', tone: 'neutral' },
  Blocked: { label: 'Engelli', tone: 'danger' },
}

export const ChildDetailModal = ({ child, onClose }: { child: CitizenChild | null; onClose: () => void }) => {
  const navigate = useNavigate()
  const { switchToChild } = useAuth()
  const [switching, setSwitching] = useState(false)

  const handleSwitch = async () => {
    if (!child) return
    setSwitching(true)
    try {
      await switchToChild(child.id)
      onClose()
      navigate('/', { replace: true })
    } catch {
      setSwitching(false)
    }
  }

  return (
    <Modal open={!!child} onClose={onClose} title="Çocuk Bilgileri" width={440} bodyClassName="p-5">
      {child && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name={child.fullName} src={child.photoUrl} size="md" />
            <div className="min-w-0">
              <p className="type-section truncate">{child.fullName}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <Badge tone={STATUS_META[child.status].tone}>{STATUS_META[child.status].label}</Badge>
                <Badge tone="info">{child.age} yaş</Badge>
              </div>
            </div>
          </div>
          <div className="space-y-3 border-t border-border pt-4">
            <DetailRow label="T.C. Kimlik No" icon={FingerprintIcon}>{maskTC(child.tckn)}</DetailRow>
            <DetailRow label="Doğum Tarihi" icon={CalendarIcon}>{formatDate(child.birthDate)}</DetailRow>
            <DetailRow label="Cinsiyet" icon={UserIcon}>{GENDER_LABELS[child.gender]}</DetailRow>
          </div>
          <div className="flex items-start gap-2 rounded-card border border-border bg-surface-1 p-3">
            <InfoIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
            <p className="type-caption">Çocuğunuzun hesabına geçerek onun adına başvuru yapabilir, bilgilerini yönetebilirsiniz. Üst köşeden kendi hesabınıza dönebilirsiniz.</p>
          </div>
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={switching}
            iconLeft={<LogInIcon className="h-4 w-4" />}
            onClick={handleSwitch}
          >
            Bu hesaba geç
          </Button>
        </div>
      )}
    </Modal>
  )
}
