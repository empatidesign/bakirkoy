import { Link, NavLink, Outlet } from 'react-router-dom'
import { CalendarDaysIcon, Building2Icon, ExternalLinkIcon } from 'lucide-react'
import { citizenPortalLoginUrl } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/etkinlikler', label: 'Etkinlikler', icon: CalendarDaysIcon },
  { to: '/tesisler', label: 'Hizmet Tesisleri', icon: Building2Icon },
]

export const PublicLayout = () => {
  return (
    <div className="flex min-h-screen flex-col bg-surface-1">
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Bakırköy Belediyesi" className="h-9 w-auto object-contain" />
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold text-foreground">Bakırköy Belediyesi Portalı</p>
              <p className="text-[11px] font-semibold text-primary">Etkinlikler ve Tesisler</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                    isActive ? 'bg-primary-soft text-primary' : 'text-foreground/60 hover:bg-surface-1 hover:text-foreground'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <a
            href={citizenPortalLoginUrl()}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-bold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            Vatandaş Girişi
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-4 py-1.5 sm:hidden">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                  isActive ? 'bg-primary-soft text-primary' : 'text-foreground/60'
                }`
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center">
          <p className="text-[12.5px] text-foreground/50">
            Bu sayfa üyelik gerektirmez, yalnızca görüntüleme amaçlıdır. Başvuru yapmak için{' '}
            <a href={citizenPortalLoginUrl()} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
              Vatandaş Portalı
            </a>{' '}
            üzerinden giriş yapmanız gerekir.
          </p>
          <p className="mt-1.5 text-[11px] text-foreground/35">© {new Date().getFullYear()} Bakırköy Belediyesi Portalı</p>
        </div>
      </footer>
    </div>
  )
}
