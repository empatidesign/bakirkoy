import { useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Clock3 } from 'lucide-react'
import { Button } from '@/design-system/Button'
import { Select } from '@/design-system/Select'
import { EmailInput, PasswordInput, isValidEmail } from '@/design-system/Input'
import { CheckboxRow } from '@/design-system/Field'
import { useAuth } from '@/framework/auth/AuthContext'
import authService from '@/services/auth.service'
import { tokenStorage } from '@/services/tokenStorage'
import { useSystemLogo, useSystemHorizontalLogo } from '@/framework/branding/useSystemLogo'
import { BakirkoySkylineArt } from '@/components/brand/BakirkoySkylineArt'
import { DEMO_OTP_CODE, DEMO_PASSWORD, DEMO_USERS, type DemoUser } from './demoUsers'

interface FormErrors {
  email?: string
  password?: string
}

type LoginIconKind = 'user' | 'mail' | 'lock' | 'users'

const LoginIcon2D = ({ kind, className = 'h-4 w-4' }: { kind: LoginIconKind; className?: string }) => {
  const paths: Record<LoginIconKind, React.ReactNode> = {
    user: <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-5 0-8 2.5-8 5.25V21h16v-1.75C20 16.5 17 14 12 14Z" />,
    mail: <path d="M3 5h18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm9 7.25L20.25 7H3.75L12 12.25Zm0 2.35L3 8.88V17h18V8.88l-9 5.72Z" />,
    lock: <path d="M6 10V7a6 6 0 1 1 12 0v3h1.25A1.75 1.75 0 0 1 21 11.75v8.5A1.75 1.75 0 0 1 19.25 22H4.75A1.75 1.75 0 0 1 3 20.25v-8.5A1.75 1.75 0 0 1 4.75 10H6Zm3 0h6V7a3 3 0 0 0-6 0v3Zm3 3a2 2 0 0 0-1 3.73V19h2v-2.27A2 2 0 0 0 12 13Z" />,
    users: <path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM9 13c-4.42 0-7 2.17-7 4.75V20h14v-2.25C16 15.17 13.42 13 9 13Zm7.18-.98c1.7 1.2 2.82 3.14 2.82 5.73V20h3v-2.25c0-2.42-2.2-4.48-5.82-5.73Z" />,
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      {paths[kind]}
    </svg>
  )
}

export const LoginPage = () => {
  const navigate = useNavigate()
  const { login } = useAuth()
  const logoUrl = useSystemLogo()
  const horizontalLogoUrl = useSystemHorizontalLogo()

  const [email, setEmail] = useState(() => tokenStorage.getSavedEmail())
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => tokenStorage.isRemembered())
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDemo, setSelectedDemo] = useState('')

  const validate = (): boolean => {
    const next: FormErrors = {}
    if (!email.trim()) next.email = 'Email alanı zorunludur.'
    else if (!isValidEmail(email)) next.email = 'Geçerli bir email adresi girin.'
    if (!password) next.password = 'Şifre alanı zorunludur.'
    else if (password.length < 6) next.password = 'Şifre en az 6 karakter olmalıdır.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const normalizedEmail = email.trim().toLowerCase()
    tokenStorage.setRemember(rememberMe)
    if (rememberMe) tokenStorage.setSavedEmail(normalizedEmail)
    else tokenStorage.clearSavedEmail()

    setIsLoading(true)
    try {
      const result = await authService.login({ email: normalizedEmail, password })

      const demoUser = import.meta.env.DEV
        ? DEMO_USERS.find((item) => item.email === normalizedEmail)
        : undefined

      if (result.requiresOtp && result.otpSessionToken && demoUser) {
        const authenticated = await authService.verifyOtp({
          otpSessionToken: result.otpSessionToken,
          code: DEMO_OTP_CODE,
        })
        login(authenticated.user, authenticated.accessToken, authenticated.refreshToken, authenticated.sessionConfig)
        navigate('/', { replace: true })
        return
      }

      if (result.requiresOtp) {
        navigate('/login/otp', {
          state: {
            otpSessionToken: result.otpSessionToken,
            otpChannel: result.otpChannel,
            resendCooldownSeconds: result.resendCooldownSeconds,
            hasActiveSessions: result.hasActiveSessions ?? false,
            email,
          },
        })
        return
      }

      if (result.accessToken && result.refreshToken && result.user) {
        login(result.user, result.accessToken, result.refreshToken,
          result.sessionConfig ?? { inactivityTimeoutMinutes: 60 })
        navigate('/', { replace: true })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const selectDemoUser = (demo: DemoUser) => {
    const demoPassword = demo.password ?? DEMO_PASSWORD
    setSelectedDemo(demo.email)
    setEmail(demo.email)
    setPassword(demoPassword)
    setErrors({})
  }

  const now = new Date()
  const timeLabel = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const dateLabel = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="login-scene">
      <BakirkoySkylineArt className="login-scene__art" />
      <div className="login-scene__veil" />

      <header className="login-scene__topbar">
        <div className="login-scene__brand">
          {horizontalLogoUrl ? (
            <img src={horizontalLogoUrl} alt="Bakırköy Belediyesi" className="login-scene__brand-logo-h" />
          ) : (
            <>
              <img src={logoUrl} alt="Bakırköy Belediyesi" className="login-scene__brand-logo" />
              <span className="login-scene__brand-name">Bakırköy Belediyesi</span>
            </>
          )}
        </div>
        <div className="login-scene__clock">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{dateLabel} · {timeLabel}</span>
        </div>
      </header>

      <main className="login-scene__center">
        <div className="login-glass">
          <div className="login-glass__head">
            <span className="login-glass__eyebrow">KURUMSAL YÖNETİM PORTALI</span>
            <h1 className="login-glass__title">Hoş geldiniz</h1>
            <p className="login-glass__sub">Çalışma alanınıza erişmek için hesabınıza giriş yapın.</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="login-glass__form">
            <div className="space-y-1.5">
              <label htmlFor="email" className="type-label flex items-center gap-1">
                <LoginIcon2D kind="user" className="h-3.5 w-3.5 text-[hsl(var(--foreground-muted))]" />
                E-posta <span className="text-[hsl(var(--danger))]">*</span>
              </label>
              <EmailInput
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                autoComplete="email"
                autoFocus
                iconLeft={<LoginIcon2D kind="mail" className="h-3.5 w-3.5" />}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="type-label flex items-center gap-1">
                <LoginIcon2D kind="lock" className="h-3.5 w-3.5 text-[hsl(var(--foreground-muted))]" />
                Şifre <span className="text-[hsl(var(--danger))]">*</span>
              </label>
              <PasswordInput
                id="password"
                placeholder="Şifrenizi girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                iconLeft={<LoginIcon2D kind="lock" className="h-4 w-4" />}
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <CheckboxRow
                variant="inline"
                label="Beni hatırla"
                checked={rememberMe}
                onChange={setRememberMe}
              />
              <Link to="/login/forgot-password" className="type-link hover:underline">
                Şifremi unuttum
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="mt-2 w-full"
              iconRight={!isLoading ? <ArrowRight className="h-4 w-4" /> : undefined}
              isLoading={isLoading}
            >
              {!isLoading && 'Giriş Yap'}
            </Button>
          </form>

          {import.meta.env.DEV && (
            <div className="login-glass__demo">
              <div className="mb-3 flex items-start gap-2.5">
                <LoginIcon2D kind="users" className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--warning))]" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--warning))]">Hızlı Test Girişi</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--foreground-muted))]">
                    Kullanıcıyı seçin, bilgiler otomatik dolsun. Giriş Yap dediğinizde OTP de otomatik doğrulanır.
                  </p>
                </div>
              </div>
              <Select
                id="demo-user"
                value={selectedDemo}
                placeholder="Yönetici seçin..."
                disabled={isLoading}
                onChange={(event) => {
                  const demo = DEMO_USERS.find((item) => item.email === event.target.value)
                  if (demo) selectDemoUser(demo)
                }}
              >
                {DEMO_USERS.map((demo) => (
                  <option key={demo.email} value={demo.email}>{demo.label}</option>
                ))}
              </Select>
              {selectedDemo && (
                <p className="mt-2 text-[11px] text-[hsl(var(--foreground-muted))]">Kullanıcı adı ve şifre dolduruldu. Yukarıdaki Giriş Yap butonuna basın.</p>
              )}
            </div>
          )}
        </div>
      </main>

      <footer className="login-scene__footer">
        <span className="login-scene__footer-chip"><ShieldCheck className="h-3.5 w-3.5" /> Güvenli oturum · OTP doğrulamalı</span>
        <span>© {now.getFullYear()} Bakırköy Belediyesi · Yönetim Portalı</span>
      </footer>
    </div>
  )
}
