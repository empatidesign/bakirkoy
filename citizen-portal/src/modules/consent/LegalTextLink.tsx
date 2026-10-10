import { useState } from 'react'
import { ShieldCheckIcon } from 'lucide-react'
import { Modal } from '@/design-system'

// Kullanıcı isteği (2026-08-02): KVKK aydınlatma metni girişten önce, login ekranında da
// görülebilir/seçilebilir olmalı — daha önce yalnızca girişten SONRA (ConsentGate zorunlu-onay
// modalı) gösteriliyordu. Bu bileşen salt-okunur bir görüntüleme linki+modalıdır; onay/checkbox
// içermez (o iş ConsentGate'in görevi, değişmedi) — sadece kişiyi henüz hesap oluşturmadan/giriş
// yapmadan ÖNCE bilgilendirmek için var.
interface Props {
  text: string
  label?: string
  className?: string
}

export const LegalTextLink = ({ text, label = 'KVKK Aydınlatma Metni', className }: Props) => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen(true)
        }}
        className={className ?? 'type-link-sm'}
      >
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={label}
        width={680}
        className="max-w-[calc(100vw-24px)]"
        bodyClassName="p-5 sm:p-6"
      >
        <div className="rounded-lg border border-border bg-surface-1 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheckIcon className="h-4 w-4 text-primary" />
            <p className="type-body-strong">{label}</p>
          </div>
          <p className="whitespace-pre-line text-[13px] leading-6 text-foreground-subtle">
            {text}
          </p>
        </div>
      </Modal>
    </>
  )
}
