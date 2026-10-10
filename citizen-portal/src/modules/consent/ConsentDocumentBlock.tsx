import type { ReactNode } from 'react'

// Kullanıcı isteği (2026-08-30): ConsentGate modallarında başlık ("KVKK Aydınlatma Metni ve
// Sözleşme" / "Bildirim İzni Sözleşmesi") ve onay checkbox'ı, metin okuma alanının (gri kutu)
// İÇİNDE değil DIŞINDA olmalı; okuma alanı yalnızca metni içermeli ve modal daha geniş olmalı.
// Üç gate (vatandaş, firma, firma personeli) aynı düzeni kullansın diye tek bileşene alındı.
type Props = {
  icon: ReactNode
  title: string
  text: string
  checked: boolean
  onChange: (value: boolean) => void
  checkboxLabel: string
  inputId: string
}

export const ConsentDocumentBlock = ({
  icon, title, text, checked, onChange, checkboxLabel, inputId,
}: Props) => (
  <section className="space-y-2">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="type-body-strong font-semibold text-foreground-strong">{title}</h3>
    </div>

    <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-surface-1 p-4">
      <p className="type-caption whitespace-pre-line text-foreground-subtle">{text}</p>
    </div>

    <label className="flex items-start gap-2 cursor-pointer" htmlFor={inputId}>
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0"
      />
      <span className="type-caption font-semibold text-foreground-strong">{checkboxLabel}</span>
    </label>
  </section>
)
