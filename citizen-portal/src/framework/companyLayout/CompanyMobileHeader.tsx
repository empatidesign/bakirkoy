import { MenuIcon, LogOutIcon, HelpCircleIcon } from 'lucide-react'
import { ThemeToggle } from '@/framework/layout/ThemeToggle'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'

interface CompanyMobileHeaderProps {
  onMenuClick: () => void
  onHelpClick?: () => void
}

export const CompanyMobileHeader = ({ onMenuClick, onHelpClick }: CompanyMobileHeaderProps) => {
  const { state, logout } = useCompanyAuth()
  const company = state.status === 'authenticated' ? state.company : undefined

  return (
    <header className="flex items-center justify-between gap-2.5 border-b border-border bg-surface-0 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="Menüyü Aç"
          onClick={onMenuClick}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field text-foreground-muted transition-colors hover:bg-surface-1"
        >
          <MenuIcon className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          {company ? (
            <p className="type-brand truncate leading-none">{company.name}</p>
          ) : (
            <p className="type-brand truncate leading-none">Firma Paneli</p>
          )}
          <p className="type-brand-sub truncate">Bakırköy Belediyesi</p>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        {onHelpClick && (
          <button
            type="button"
            aria-label="Panel Kullanım Kılavuzu"
            onClick={onHelpClick}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field text-foreground-muted transition-colors hover:bg-surface-1 hover:text-primary"
          >
            <HelpCircleIcon className="h-4.5 w-4.5" />
          </button>
        )}
        <ThemeToggle />
        <button
          type="button"
          aria-label="Çıkış Yap"
          onClick={() => void logout()}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-field text-foreground-muted transition-colors hover:bg-surface-1 hover:text-danger"
        >
          <LogOutIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
