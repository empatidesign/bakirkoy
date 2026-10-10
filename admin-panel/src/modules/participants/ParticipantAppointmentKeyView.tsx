import { useEffect, useState } from 'react'
import { CopyIcon, KeyRoundIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Card, ConfirmModal, Input, SkeletonRows } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import participantService from '@/services/participant.service'

// Kullanıcı isteği (2026-09-28): randevu sistemine gizli giriş anahtarı. Burada üretilen
// anahtar randevu panelinde ilgili kullanıcıya girilir; mobilde logoya 3 kez basan
// katılımcı bu anahtarla eşleşen randevu kullanıcısı olarak giriş yapar.
export const ParticipantAppointmentKeyView = ({ participantId }: { participantId: string }) => {
  const { can } = useAuth()
  const canEdit = can('participants.edit')
  const [key, setKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [confirm, setConfirm] = useState<'regenerate' | 'revoke' | null>(null)

  useEffect(() => {
    setLoading(true)
    participantService.getAppointmentKey(participantId)
      .then(setKey)
      .finally(() => setLoading(false))
  }, [participantId])

  const generate = async () => {
    setWorking(true)
    try {
      setKey(await participantService.generateAppointmentKey(participantId))
      toast.success('Randevu anahtarı üretildi.')
    } finally {
      setWorking(false)
      setConfirm(null)
    }
  }

  const revoke = async () => {
    setWorking(true)
    try {
      await participantService.revokeAppointmentKey(participantId)
      setKey(null)
      toast.success('Randevu anahtarı kaldırıldı.')
    } finally {
      setWorking(false)
      setConfirm(null)
    }
  }

  const copy = async () => {
    if (!key) return
    await navigator.clipboard.writeText(key)
    toast.success('Anahtar kopyalandı.')
  }

  return (
    <Card padded className="shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
          <KeyRoundIcon className="h-4 w-4 text-foreground-muted" />
        </div>
        <h4 className="text-sm font-semibold text-foreground-strong">Randevu Sistemi Anahtarı</h4>
      </div>
      <p className="type-caption mb-4">
        Anahtarı randevu panelinde ilgili kullanıcıya tanımlayın. Katılımcı mobil uygulamada logoya 3 kez
        bastığında bu kullanıcı olarak randevu sistemine girer. Anahtarı olmayan katılımcı giremez.
      </p>

      {loading ? (
        <SkeletonRows rows={2} />
      ) : key ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input value={key} readOnly className="font-mono" />
            <Button variant="outline" iconLeft={<CopyIcon className="h-3.5 w-3.5" />} onClick={copy}>
              Kopyala
            </Button>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                iconLeft={<RefreshCwIcon className="h-3.5 w-3.5" />}
                onClick={() => setConfirm('regenerate')}
              >
                Yeniden Üret
              </Button>
              <Button
                size="sm"
                variant="danger"
                iconLeft={<Trash2Icon className="h-3.5 w-3.5" />}
                onClick={() => setConfirm('revoke')}
              >
                Kaldır
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="type-muted">Bu katılımcıya randevu anahtarı atanmamış.</p>
          {canEdit && (
            <Button
              size="sm"
              variant="primary"
              iconLeft={<KeyRoundIcon className="h-3.5 w-3.5" />}
              isLoading={working}
              onClick={generate}
            >
              Key Ata
            </Button>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => (confirm === 'revoke' ? revoke() : generate())}
        tone="danger"
        title={confirm === 'revoke' ? 'Anahtarı Kaldır' : 'Anahtarı Yeniden Üret'}
        description={
          confirm === 'revoke'
            ? 'Katılımcı randevu sistemine artık giremeyecek. Devam edilsin mi?'
            : 'Eski anahtar geçersiz olacak; yeni anahtarı randevu panelinde tekrar tanımlamanız gerekir. Devam edilsin mi?'
        }
        confirmLabel={confirm === 'revoke' ? 'Evet, Kaldır' : 'Evet, Üret'}
        loading={working}
      />
    </Card>
  )
}
