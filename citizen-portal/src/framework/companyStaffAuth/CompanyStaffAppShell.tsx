import { NavLink, Outlet } from 'react-router-dom'
import { LogOutIcon, ScanLineIcon, TicketPercentIcon } from 'lucide-react'
import { useCompanyStaffAuth } from './CompanyStaffAuthContext'
import { Button } from '@/design-system'
import { cn } from '@/lib/utils'

export const CompanyStaffAppShell = () => {
  const { state, logout } = useCompanyStaffAuth()
  const staff = state.status === 'authenticated' ? state.staff : undefined
  const company = state.status === 'authenticated' ? state.company : undefined
  const canManageCampaigns = staff?.canManageCampaigns ?? false

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-surface-1">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-surface-0 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <ScanLineIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="type-body-strong truncate">{staff?.fullName}</p>
            <p className="type-caption truncate text-foreground-muted">{company?.name} · Personel</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void logout()} iconLeft={<LogOutIcon className="h-4 w-4" />}>
          Çıkış
        </Button>
      </header>
      {canManageCampaigns && (
        <nav className="flex shrink-0 items-center gap-1 border-b border-border bg-surface-0 px-4 py-2">
          <NavLink
            to="/firma/personel/kullandir"
            className={({ isActive }) => cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-primary-soft text-primary' : 'text-foreground-muted hover:bg-surface-1',
            )}
          >
            <ScanLineIcon className="h-4 w-4" /> Kullandır
          </NavLink>
          <NavLink
            to="/firma/personel/kampanyalar"
            className={({ isActive }) => cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-primary-soft text-primary' : 'text-foreground-muted hover:bg-surface-1',
            )}
          >
            <TicketPercentIcon className="h-4 w-4" /> Kampanyalar
          </NavLink>
        </nav>
      )}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>
    </div>
  )
}
