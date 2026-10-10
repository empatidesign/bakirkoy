import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck, Clock3 } from 'lucide-react'
import { useSystemLogo, useSystemHorizontalLogo } from '@/framework/branding/useSystemLogo'

interface AuthLayoutProps {
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  variant?: 'citizen' | 'company'
  hideTabs?: boolean
  wide?: boolean
  centerContent?: boolean
}

const COMPANY_PATHS = ['/firma/login', '/firma/register', '/firma/forgot-password', '/firma/login/otp', '/firma/login/change-initial']

/**
 * Giriş ekranı kabuğu — tam ekran gündüz sahil sahnesi üzerinde yüzen
 * cam panel (glassmorphism).
 *
 * Kullanıcı isteği (2026-10-08): "tasarımı tamamen değiştir, halen
 * istediğim gibi olmadı" — önceki koyu/gece 50/50 split-screen (sol form /
 * sağ düz renkli hero bloğu) kaldırıldı; bu artık admin panelin yeni
 * tasarımıyla AYNI DİL'i (tam ekran illüstrasyon + cam kart) ama FARKLI
 * SAHNEYİ (sahil/vapur/fener vs. belediye binası/bulvar) kullanıyor, böylece
 * hem Sultangazi'den hem admin panelden görsel olarak ayrışıyor.
 *
 * Alt sayfaların (OTP, Kayıt, Şifremi Unuttum) içeriği `.auth-sheet__body`
 * içine eskisi gibi akar; o alt bileşenlerdeki `.auth-login-form`,
 * `.otp-*` vb. sınıflar değişmedi.
 */
export const AuthLayout = ({
  title,
  subtitle,
  children,
  footer,
  variant = 'citizen',
  hideTabs = false,
  wide = false,
  centerContent = false,
}: AuthLayoutProps) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const logoUrl = useSystemLogo()
  const horizontalLogoUrl = useSystemHorizontalLogo()
  const isFirma = variant === 'company'
  const activeVariant = COMPANY_PATHS.some(p => pathname.startsWith(p)) ? 'company' : 'citizen'

  const now = new Date()
  const timeLabel = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const dateLabel = now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className={`auth-shell ${isFirma ? 'auth-shell--company' : ''}`}>
      <img src="/bakirkoy-neon.jpg" alt="" aria-hidden="true" className="auth-shell__art" />
      <div className={`auth-shell__veil ${isFirma ? 'auth-shell__veil--company' : ''}`} />

      <header className="auth-shell__topbar">
        <div className="auth-shell__brand">
          {horizontalLogoUrl ? (
            <img src={horizontalLogoUrl} alt="Bakırköy Belediyesi" className="auth-shell__brand-logo-h" />
          ) : (
            <>
              <img src={logoUrl} alt="Bakırköy Belediyesi" className="auth-shell__brand-logo" />
              <span className="auth-shell__brand-name">Bakırköy Belediyesi</span>
            </>
          )}
        </div>
        <div className="auth-shell__clock">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{dateLabel} · {timeLabel}</span>
        </div>
      </header>

      <main className="auth-shell__center">
        <div className={`auth-glass${wide ? ' auth-glass--wide' : ''}`}>

          {!hideTabs && (
            <div className="auth-switch-wrap">
              <div className={`auth-switch ${activeVariant === 'company' ? 'auth-switch--company' : ''}`}>
                <div className={`auth-switch__pill ${activeVariant === 'company' ? 'auth-switch__pill--right' : ''}`} />
                <button
                  type="button"
                  className={`auth-switch__btn ${activeVariant === 'citizen' ? 'auth-switch__btn--active' : ''}`}
                  onClick={() => navigate('/login')}
                >
                  <svg className="auth-switch__ico" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Vatandaş
                </button>
                <button
                  type="button"
                  className={`auth-switch__btn ${activeVariant === 'company' ? 'auth-switch__btn--active auth-switch__btn--active-company' : ''}`}
                  onClick={() => navigate('/firma/login')}
                >
                  <svg className="auth-switch__ico" viewBox="0 0 24 24" fill="none">
                    <rect x="2" y="7" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2"/>
                    <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    <line x1="10" y1="14" x2="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                  Firma
                </button>
              </div>
            </div>
          )}

          <div className="auth-sheet">
            <div className={`auth-sheet__body${centerContent ? ' auth-sheet__body--center' : ''}`}>
              {title && !centerContent && (
                <>
                  <h2 className="auth-form-title">{title}</h2>
                  {subtitle && <p className="auth-form-sub">{subtitle}</p>}
                </>
              )}
              {children}
            </div>
            {footer && (
              <div className="auth-sheet__footer">
                {footer}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="auth-shell__footer">
        <span className="auth-shell__footer-chip"><ShieldCheck className="h-3.5 w-3.5" /> Güvenli oturum · OTP doğrulamalı</span>
        <span>© {now.getFullYear()} Bakırköy Belediyesi · {isFirma ? 'Firma Portalı' : 'Vatandaş Portalı'}</span>
      </footer>
    </div>
  )
}
