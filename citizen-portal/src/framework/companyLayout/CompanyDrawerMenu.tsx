import { useEffect } from 'react'
import { NavLink } from 'react-router-dom'
import { XIcon, LogOutIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Badge } from '@/design-system'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_TONE } from '@/types/companyAuth.types'
import { ThemeToggle } from '@/framework/layout/ThemeToggle'
import { COMPANY_NAV } from './CompanyNav'

interface CompanyDrawerMenuProps {
  open: boolean
  onClose: () => void
}

export const CompanyDrawerMenu = ({ open, onClose }: CompanyDrawerMenuProps) => {
  const { state, logout } = useCompanyAuth()
  const company = state.status === 'authenticated' ? state.company : undefined

  useEffect(() => {
    if (open) {
      const handler = () => onClose()
      window.addEventListener('popstate', handler)
      return () => window.removeEventListener('popstate', handler)
    }
  }, [open, onClose])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-surface-0 shadow-xl transition-transform duration-300 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="relative flex-shrink-0 bg-gradient-to-br from-primary to-primary/80 px-4 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label="Menüyü Kapat"
            onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors hover:bg-white/20"
          >
            <XIcon className="h-4 w-4" />
          </button>
          {company && (
            <NavLink to="/firma/profile" onClick={onClose} className="flex items-center gap-3 mt-2">
              <Avatar name={company.name} src={company.logo ?? undefined} size="md" className="ring-2 ring-white/40" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-white leading-tight">{company.name}</p>
                <Badge tone={COMPANY_STATUS_TONE[company.status]} className="mt-1">
                  {COMPANY_STATUS_LABELS[company.status]}
                </Badge>
              </div>
            </NavLink>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {COMPANY_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) => cn(
                'flex items-center gap-3 rounded-field px-3 py-3 transition-colors',
                isActive ? 'bg-primary-soft text-primary' : 'text-foreground-default hover:bg-surface-1',
              )}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="type-body-strong">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="flex-shrink-0 space-y-3 border-t border-border p-3">
          <div className="flex items-center justify-between px-1">
            <span className="type-caption text-foreground-muted">Görünüm</span>
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={() => { onClose(); void logout() }}
            className="flex w-full items-center gap-3 rounded-field px-3 py-3 text-danger transition-colors hover:bg-danger/10"
          >
            <LogOutIcon className="h-5 w-5 flex-shrink-0" />
            <span className="type-body-strong">Çıkış Yap</span>
          </button>
        </div>
      </aside>
    </>
  )
}
