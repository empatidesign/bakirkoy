import { Link } from 'react-router-dom'
import { BellIcon, MenuIcon } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { useNotifications } from '@/framework/notifications/NotificationContext'
import { useSystemLogo } from '@/framework/branding/useSystemLogo'

interface MobileHeaderProps {
  onMenuOpen: () => void
}

export const MobileHeader = ({ onMenuOpen }: MobileHeaderProps) => {
  const { unreadCount } = useNotifications()
  const logoUrl = useSystemLogo()
  return (
    <header className="flex items-center justify-between gap-2 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden bg-surface-0 border-b border-border">
      <button
        type="button"
        aria-label="Menüyü Aç"
        onClick={onMenuOpen}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-1"
      >
        <MenuIcon className="h-5 w-5" />
      </button>

      <Link to="/" aria-label="Ana Sayfa" className="flex flex-col items-center flex-1">
        <img src={logoUrl} alt="Bakırköy Belediyesi" className="h-8 w-auto object-contain" />
        <p className="text-xs font-bold text-foreground-strong leading-none mt-1">Bakırköy Belediyesi</p>
        <p className="text-[11px] font-semibold leading-none mt-1" style={{ color: '#005da3' }}>Vatandaş Portalı</p>
      </Link>

      <div className="flex flex-shrink-0 items-center gap-0.5">
        <Link to="/bildirimler" aria-label="Bildirimler"
          className="relative flex h-10 w-10 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-surface-1">
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>
        <ThemeToggle />
      </div>
    </header>
  )
}
