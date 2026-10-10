import { useState } from 'react'
import { ShieldCheckIcon, BellRingIcon } from 'lucide-react'
import { Button, Modal } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'
import authService from '@/services/auth.service'
import { useLegalDocuments } from './useLegalDocuments'
import { ConsentDocumentBlock } from './ConsentDocumentBlock'

// Kullanıcı isteği: KVKK/sözleşme onayı ile bildirim izni (SMS/e-posta/push) onayı ayrı
// checkbox'lar olarak alınır. İkisi de kabul edilene kadar uygulamaya erişim engellenir.
// Kabul edildikten sonra backend'de saklanır (Participant.KvkkAcceptedAt/
// NotificationConsentAcceptedAt), bu ekran bir daha çıkmaz. Metinler artik legalTexts.ts'ten
// geliyor (login ekranındaki LegalTextLink ile aynı kaynak, sapma riski yok).
type Props = {
  children: React.ReactNode
}

export function ConsentGate({ children }: Props) {
  const legalDocuments = useLegalDocuments()
  const { state, refreshUser } = useAuth()
  const [kvkkChecked, setKvkkChecked] = useState(false)
  const [notifChecked, setNotifChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (state.status !== 'authenticated') return <>{children}</>

  const needsKvkk = !state.user.kvkkAccepted
  const needsNotification = !state.user.notificationConsentAccepted
  const needsConsent = needsKvkk || needsNotification

  if (!needsConsent) return <>{children}</>

  const canSubmit = (!needsKvkk || kvkkChecked) && (!needsNotification || notifChecked)

  const submit = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      if (needsKvkk) await authService.acceptKvkk()
      if (needsNotification) await authService.acceptNotificationConsent()
      await refreshUser()
    } catch {
      void 0
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {children}
      <Modal
        open
        hideClose
        onClose={() => { /* Kullanıcı isteği: onay zorunlu, dışa tıklama/ESC ile kapanmaz */ }}
        title="Devam Etmeden Önce"
        subtitle="Uygulamayı kullanabilmek için aşağıdaki metinleri onaylamanız gerekiyor."
        width={640}
        bodyClassName="p-5"
        footer={
          <Button
            size="lg"
            className="w-full"
            disabled={!canSubmit}
            isLoading={submitting}
            onClick={() => void submit()}
          >
            Onaylayıp Devam Et
          </Button>
        }
      >
        <div className="space-y-5">
          {needsKvkk && (
            <ConsentDocumentBlock
              inputId="citizen-consent-kvkk"
              icon={<ShieldCheckIcon className="h-4 w-4 text-primary" />}
              title="KVKK Aydınlatma Metni ve Sözleşme"
              text={legalDocuments.citizenKvkk}
              checked={kvkkChecked}
              onChange={setKvkkChecked}
              checkboxLabel="KVKK aydınlatma metnini ve kullanıcı sözleşmesini okudum, kabul ediyorum."
            />
          )}

          {needsNotification && (
            <ConsentDocumentBlock
              inputId="citizen-consent-notification"
              icon={<BellRingIcon className="h-4 w-4 text-primary" />}
              title="Bildirim İzni Sözleşmesi"
              text={legalDocuments.citizenNotification}
              checked={notifChecked}
              onChange={setNotifChecked}
              checkboxLabel="SMS, e-posta ve push bildirimi ile iletişim kurulmasını kabul ediyorum."
            />
          )}
        </div>
      </Modal>
    </>
  )
}
