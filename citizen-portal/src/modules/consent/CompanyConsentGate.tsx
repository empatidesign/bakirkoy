import { useState } from 'react'
import { ShieldCheckIcon, BellRingIcon } from 'lucide-react'
import { Button, Modal } from '@/design-system'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import companyAuthService from '@/services/companyAuth.service'
import { useLegalDocuments } from './useLegalDocuments'
import { ConsentDocumentBlock } from './ConsentDocumentBlock'

// Kullanıcı isteği: KVKK/sözleşme onayı ile bildirim izni onayı — firma girişi tarafı.
// Aynı desen citizen-portal/modules/consent/ConsentGate.tsx (vatandaş) ile birebir. Metinler
// legalTexts.ts'ten geliyor (login ekranındaki LegalTextLink ile aynı kaynak).
type Props = {
  children: React.ReactNode
}

export function CompanyConsentGate({ children }: Props) {
  const legalDocuments = useLegalDocuments()
  const { state, refreshCompany } = useCompanyAuth()
  const [kvkkChecked, setKvkkChecked] = useState(false)
  const [notifChecked, setNotifChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (state.status !== 'authenticated') return <>{children}</>

  const needsKvkk = !state.company.kvkkAccepted
  const needsNotification = !state.company.notificationConsentAccepted
  const needsConsent = needsKvkk || needsNotification

  if (!needsConsent) return <>{children}</>

  const canSubmit = (!needsKvkk || kvkkChecked) && (!needsNotification || notifChecked)

  const submit = async () => {
    setSubmitting(true)
    try {
      if (needsKvkk) await companyAuthService.acceptKvkk()
      if (needsNotification) await companyAuthService.acceptNotificationConsent()
      await refreshCompany()
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
              inputId="company-consent-kvkk"
              icon={<ShieldCheckIcon className="h-4 w-4 text-primary" />}
              title="KVKK Aydınlatma Metni ve Sözleşme"
              text={legalDocuments.companyKvkk}
              checked={kvkkChecked}
              onChange={setKvkkChecked}
              checkboxLabel="KVKK aydınlatma metnini ve kullanıcı sözleşmesini okudum, kabul ediyorum."
            />
          )}

          {needsNotification && (
            <ConsentDocumentBlock
              inputId="company-consent-notification"
              icon={<BellRingIcon className="h-4 w-4 text-primary" />}
              title="Bildirim İzni Sözleşmesi"
              text={legalDocuments.companyNotification}
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
