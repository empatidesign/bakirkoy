import type { ReactNode } from 'react'
import { LegalTextLink } from './LegalTextLink'

// Kullanıcı isteği (2026-08-02): KVKK Aydınlatma Metni ve Bildirim İzni Sözleşmesi giriş
// ekranında iki AYRI satır olarak, her birinin solunda kendi checkbox'ı ile gösterilmeli.
// Vatandaş metni (LegalTextLink linkine tıklayarak) okuyabilir, checkbox'ı işaretleyebilir;
// giriş bu ikisi işaretlenmeden gönderilemez. İşaretli durum, girişin tamamlanmasının
// hemen ardından backend'e (accept-kvkk / accept-notification-consent) yazılır — böylece
// veritabanında (Participant.KvkkAcceptedAt / NotificationConsentAcceptedAt) gerçekten
// görülebilir olur, sadece bilgilendirici bir link olarak kalmaz.
interface Props {
  text: string
  label: string
  suffix?: ReactNode
  checked: boolean
  onChange: (v: boolean) => void
  id: string
}

export const ConsentCheckboxRow = ({ text, label, suffix = "'ni okudum, kabul ediyorum.", checked, onChange, id }: Props) => (
  <label htmlFor={id} className="grid min-h-11 cursor-pointer select-none grid-cols-[18px_minmax(0,1fr)] items-center gap-x-2.5 py-1">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="h-[18px] w-[18px] accent-[hsl(var(--primary))] cursor-pointer"
    />
    <span
      className="min-w-0 text-left text-xs font-normal leading-[1.45] text-foreground-subtle"
      style={{ textTransform: 'none' }}
    >
      <LegalTextLink text={text} label={label} className="align-baseline text-xs font-semibold leading-[1.45] text-primary" />
      <span className="font-normal">{suffix}</span>
    </span>
  </label>
)
