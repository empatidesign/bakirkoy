import { useState } from 'react'
import { ShieldCheckIcon, BellRingIcon } from 'lucide-react'
import { Button, Modal } from '@/design-system'
import { useCompanyStaffAuth } from '@/framework/companyStaffAuth/CompanyStaffAuthContext'
import companyStaffAuthService from '@/services/companyStaffAuth.service'
import { useLegalDocuments } from './useLegalDocuments'
import { ConsentDocumentBlock } from './ConsentDocumentBlock'

// Kullanıcı isteği: KVKK/sözleşme onayı ile bildirim izni onayı — firma personeli girişi tarafı.
// Metinler legalTexts.ts'ten geliyor (login ekranındaki LegalTextLink ile aynı kaynak).
type Props = {
  children: React.ReactNode
}

export function CompanyStaffConsentGate({ children }: Props) {
  const legalDocuments = useLegalDocuments()
  const { state, refreshStaff } = useCompanyStaffAuth()
  const [kvkkChecked, setKvkkChecked] = useState(false)
  const [notifChecked, setNotifChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (state.status !== 'authenticated') return <>{children}</>

  const needsKvkk = !state.staff.kvkkAccepted
  const needsNotification = !state.staff.notificationConsentAccepted
  const needsConsent = needsKvkk || needsNotification

  if (!needsConsent) return <>{children}</>

  const canSubmit = (!needsKvkk || kvkkChecked) && (!needsNotification || notifChecked)

  const submit = async () => {
    setSubmitting(true)
    try {
      if (needsKvkk) await companyStaffAuthService.acceptKvkk()
      if (needsNotification) await companyStaffAuthService.acceptNotificationConsent()
      await refreshStaff()
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
              inputId="staff-consent-kvkk"
              icon={<ShieldCheckIcon className="h-4 w-4 text-primary" />}
              title="KVKK Aydınlatma Metni ve Sözleşme"
              text={legalDocuments.companyStaffKvkk}
              checked={kvkkChecked}
              onChange={setKvkkChecked}
              checkboxLabel="KVKK aydınlatma metnini ve kullanıcı sözleşmesini okudum, kabul ediyorum."
            />
          )}

          {needsNotification && (
            <ConsentDocumentBlock
              inputId="staff-consent-notification"
              icon={<BellRingIcon className="h-4 w-4 text-primary" />}
              title="Bildirim İzni Sözleşmesi"
              text={legalDocuments.companyStaffNotification}
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
