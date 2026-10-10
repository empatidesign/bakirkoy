import { NavLink } from 'react-router-dom'
import { LogOutIcon, HelpCircleIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Badge, Button } from '@/design-system'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'
import { ThemeToggle } from '@/framework/layout/ThemeToggle'
import { COMPANY_STATUS_LABELS, COMPANY_STATUS_TONE } from '@/types/companyAuth.types'
import { COMPANY_NAV } from './CompanyNav'
import { useSystemLogo } from '@/framework/branding/useSystemLogo'

interface CompanySidebarProps {
  onHelpClick?: () => void
}

export const CompanySidebar = ({ onHelpClick }: CompanySidebarProps = {}) => {
  const { state, logout } = useCompanyAuth()
  const company = state.status === 'authenticated' ? state.company : undefined
  const logoUrl = useSystemLogo()

  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-border bg-surface-0 lg:flex">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-4">
        <img src={logoUrl} alt="Bakırköy Belediyesi" className="h-[34px] w-[46px] flex-shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="type-brand leading-tight">Bakırköy Belediyesi</p>
          <p className="type-brand-sub leading-tight">Firma Paneli</p>
        </div>
        {onHelpClick && (
          <button
            type="button"
            title="Panel Kullanım Kılavuzu"
            onClick={onHelpClick}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-field text-foreground-muted transition-colors hover:bg-surface-1 hover:text-primary"
          >
            <HelpCircleIcon className="h-4.5 w-4.5" />
          </button>
        )}
      </div>

      {company && (
        <NavLink
          to="/firma/profile"
          className="mx-3 mt-3 flex items-center gap-3 rounded-card bg-gradient-to-br from-primary/10 to-primary/5 p-3 ring-1 ring-primary/20 transition-colors hover:bg-primary/10"
        >
          <Avatar name={company.name} src={company.logo ?? undefined} size="md" className="flex-shrink-0 ring-2 ring-primary/30" />
          <div className="min-w-0 flex-1">
            <p className="type-body-strong truncate leading-tight">{company.name}</p>
            <Badge tone={COMPANY_STATUS_TONE[company.status]} className="mt-1">
              {COMPANY_STATUS_LABELS[company.status]}
            </Badge>
          </div>
        </NavLink>
      )}

      <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto p-3">
        {COMPANY_NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(
              'flex items-center gap-2.5 rounded-field px-3 py-2.5 transition-colors',
              isActive ? 'bg-primary-soft text-primary' : 'text-foreground-default hover:bg-surface-1',
            )}
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span className="type-body-strong">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t border-border p-3">
        <div className="flex items-center justify-between px-1">
          <span className="type-caption text-foreground-muted">Görünüm</span>
          <ThemeToggle />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start text-danger hover:border-danger/30 hover:bg-danger/5 hover:text-danger"
          iconLeft={<LogOutIcon className="h-4 w-4" />}
          onClick={() => void logout()}
        >
          Çıkış Yap
        </Button>
      </div>
    </aside>
  )
}
