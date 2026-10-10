import { useState } from 'react'
import { EyeIcon, EyeOffIcon, KeyRoundIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button, Field, Input, SegmentedControl, ToggleRow, CredentialDeliveryCard, Banner } from '@/design-system'
import companyService from '@/services/company.service'
import type { CompanyDeliveryChannel } from '@/types/company.types'

interface CompanyPasswordSectionProps {
  companyId?: string
}

const isStrong = (v: string) => v.length >= 8 && /\p{Lu}/u.test(v) && /[0-9]/.test(v)

export const CompanyPasswordSection = ({ companyId }: CompanyPasswordSectionProps) => {
  const [mode, setMode] = useState<'send' | 'manual'>('send')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [mustChange, setMustChange] = useState(false)
  const [saving, setSaving] = useState(false)

  const disabled = !companyId
  const valid = isStrong(password)

  const sendReset = async (channel: CompanyDeliveryChannel) => {
    if (!companyId) return
    await companyService.sendPasswordReset(companyId, channel)
    toast.success(`Geçici şifre ${channel === 'Email' ? 'e-posta' : 'SMS'} ile gönderildi. Firma ilk girişte şifresini değiştirecek.`)
  }

  const setManual = async () => {
    if (!companyId || !valid) return
    setSaving(true)
    try {
      await companyService.setManualPassword(companyId, password, mustChange)
      toast.success(mustChange
        ? 'Şifre belirlendi. Firma ilk girişte değiştirmek zorunda.'
        : 'Şifre belirlendi. Firma bu şifreyle giriş yapabilir.')
      setPassword(''); setShow(false); setMustChange(false)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-3">
      <SegmentedControl
        value={mode}
        onChange={(v) => setMode(v as 'send' | 'manual')}
        disabled={disabled}
        columns={2}
        options={[
          { value: 'send', label: 'Geçici Şifre Gönder', description: 'Rastgele üretilir, kanaldan iletilir' },
          { value: 'manual', label: 'Elle Şifre Belirle', description: 'Şifreyi siz girin' },
        ]}
      />

      {mode === 'send' ? (
        <CredentialDeliveryCard
          title="Geçici Şifre Gönder"
          description="Şifre buradan görünmez. Firmaya geçici bir şifre gönderilir; panelde ilk girişte kendi şifresini belirlemek zorundadır."
          onSend={sendReset}
          disabled={disabled}
        />
      ) : (
        <div className="space-y-3 rounded-card border border-border bg-surface-1/60 p-3">
          <Field
            label="Yeni Şifre"
            required
            error={password && !valid ? 'En az 8 karakter, bir büyük harf ve bir rakam içermelidir.' : undefined}
            hint={!password ? 'En az 8 karakter, bir büyük harf ve bir rakam.' : undefined}
          >
            <Input
              type={show ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={disabled}
              placeholder="Yeni şifreyi girin"
              autoComplete="new-password"
              iconRight={
                <button type="button" onClick={() => setShow((s) => !s)} className="text-foreground-muted transition-colors hover:text-foreground-strong" tabIndex={-1}>
                  {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
              }
            />
          </Field>

          <ToggleRow
            label="İlk girişte değiştirmesi zorunlu"
            description="Açıkken firma bu şifreyle giriş yapar ama ilk girişte kendi şifresini belirlemek zorunda kalır."
            checked={mustChange}
            onChange={setMustChange}
            disabled={disabled}
          />

          <Banner tone="warning" variant="soft">
            Şifreyi kaydederseniz firmanın açık oturumu kapatılır; yeni şifresiyle yeniden giriş yapması gerekir.
          </Banner>

          <Button variant="primary" className="w-full" isLoading={saving} disabled={disabled || !valid} onClick={setManual}>
            <KeyRoundIcon className="h-3.5 w-3.5" /> Şifreyi Kaydet
          </Button>
        </div>
      )}
    </div>
  )
}
