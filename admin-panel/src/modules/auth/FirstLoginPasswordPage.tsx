import { useState, type FormEvent } from 'react'
import { Lock, KeyRound, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/design-system/Button'
import { PasswordInput } from '@/design-system/Input'
import { Label } from '@/design-system/Label'
import { useAuth } from '@/framework/auth/AuthContext'
import { isStrongPassword, PASSWORD_RULE_TEXT } from '@/lib/password'
import authService from '@/services/auth.service'

export const FirstLoginPasswordPage = () => {
  const { state } = useAuth()
  const email = state.status === 'authenticated' ? state.user.email : ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})

  const validate = (): boolean => {
    const next: typeof errors = {}
    if (!isStrongPassword(password)) next.password = PASSWORD_RULE_TEXT
    if (confirm !== password) next.confirm = 'Şifreler eşleşmiyor.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      await authService.changeInitialPassword(password)
      toast.success('Şifreniz belirlendi. Yönlendiriliyorsunuz...')
      window.location.href = `${import.meta.env.BASE_URL}dashboard`
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-1 p-4">
      <div className="w-full max-w-md rounded-panel border border-border bg-surface-0 p-8 shadow-pop">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-panel bg-gradient-brand">
            <ShieldCheck className="h-7 w-7 text-white" />
          </div>
          <h1 className="type-heading-sm">Şifrenizi Belirleyin</h1>
          <p className="mt-1 type-desc">
            İlk girişte güvenliğiniz için yeni bir şifre belirlemeniz zorunludur.
          </p>
          {email && <p className="mt-2 text-xs font-medium text-foreground-muted">{email}</p>}
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw" required>Yeni Şifre</Label>
            <PasswordInput
              id="pw"
              placeholder="En az 8 karakter"
              value={password}
              onChange={e => setPassword(e.target.value)}
              error={errors.password}
              iconLeft={<KeyRound className="h-4 w-4" />}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cpw" required>Yeni Şifre (Tekrar)</Label>
            <PasswordInput
              id="cpw"
              placeholder="Şifreyi tekrar giriniz"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              error={errors.confirm}
              iconLeft={<Lock className="h-4 w-4" />}
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading}>
            {!loading && 'Şifreyi Belirle ve Devam Et'}
          </Button>
        </form>
      </div>
    </div>
  )
}
