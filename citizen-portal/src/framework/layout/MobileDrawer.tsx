import { useEffect, useState, type ComponentType } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  XIcon, HomeIcon, CalendarCheckIcon, UserIcon, LogOutIcon,
  BellIcon, ClipboardListIcon, HistoryIcon, TrophyIcon, Disc3Icon,
  LayersIcon, ExternalLinkIcon,
} from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { useNotifications } from '@/framework/notifications/NotificationContext'
import { ThemeToggle } from './ThemeToggle'
import appMenuService, { type PublicMenuSection } from '@/services/appMenu.service'
import { AccountSwitcher } from '@/components/specialized/AccountSwitcher'
import { cn, isMenuTargetActive } from '@/lib/utils'
import { useSystemLogo } from '@/framework/branding/useSystemLogo'

const STATIC_NAV = [
  { to: '/', label: 'Ana Sayfa', icon: HomeIcon, end: true, color: '#6366F1' },
  { to: '/sadakat', label: 'Sadakat Puanım', icon: TrophyIcon, color: '#7C3AED' },
  { to: '/carkim', label: 'Hediye Çarkı', icon: Disc3Icon, color: '#F59E0B' },
  { to: '/basvurularim', label: 'Başvurularım', icon: ClipboardListIcon, color: '#8B5CF6' },
  { to: '/planlarim', label: 'Planlarım', icon: CalendarCheckIcon, color: '#34C27A' },
  { to: '/gecmisim', label: 'Geçmişim', icon: HistoryIcon, color: '#0EA5E9' },
  { to: '/bildirimler', label: 'Bildirimler', icon: BellIcon, color: '#EF4444' },
  { to: '/profil', label: 'Profil', icon: UserIcon, color: '#94A3B8' },
]

const safeLinkTarget = (url: string): string =>
  /^https?:\/\//i.test(url) ? url : '#'

const DynamicMenuIcon = ({ name, className }: { name?: string; className?: string }) => {
  const [Comp, setComp] = useState<ComponentType<{ className?: string }> | null>(null)
  useEffect(() => {
    if (!name) { setComp(null); return }
    let active = true
    import('lucide-react').then((mod) => {
      const C = (mod as Record<string, unknown>)[name] as ComponentType<{ className?: string }> | undefined
      if (active && C) setComp(() => C)
    }).catch(() => {})
    return () => { active = false }
  }, [name])
  const Icon = Comp ?? LayersIcon
  return <Icon className={className} />
}

const DrawerSection = ({ section, onClose }: { section: PublicMenuSection; onClose: () => void }) => {
  const location = useLocation()

  return (
    <div>
      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-foreground-subtle">
        {section.title}
      </p>
      {section.items.map(item => {
        const isExternal = item.linkType === 2
        const isActive = isMenuTargetActive(item.linkTarget, location.pathname, location.search)
        if (isExternal) {
          return (
            <a key={item.id} href={safeLinkTarget(item.linkTarget)} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface-1">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ background: '#F3F4F6', color: '#9CA3AF' }}>
                <ExternalLinkIcon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-semibold truncate text-foreground-default">{item.title}</span>
              <ExternalLinkIcon className="h-3.5 w-3.5 flex-shrink-0 text-foreground-subtle" />
            </a>
          )
        }
        return (
          <NavLink key={item.id} to={item.linkTarget} onClick={onClose}
            className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors relative"
            style={{ background: isActive ? item.color + '18' : 'transparent' }}>
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                style={{ width: 3, height: 20, background: item.color }} />
            )}
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl"
              style={isActive
                ? { background: `linear-gradient(135deg,${item.color},${item.color}cc)`, color: '#fff', boxShadow: `0 4px 12px ${item.color}40` }
                : { background: '#F3F4F6', color: '#9CA3AF' }}>
              <DynamicMenuIcon name={item.iconType === 0 ? item.icon : undefined} className="h-4 w-4" />
            </span>
            <span className="flex-1 text-sm font-semibold truncate"
              style={{ color: isActive ? item.color : '#111827' }}>{item.title}</span>
            {item.badgeText && (
              <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
                style={{ background: item.color }}>{item.badgeText}</span>
            )}
          </NavLink>
        )
      })}
    </div>
  )
}

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
}

export const MobileDrawer = ({ open, onClose }: MobileDrawerProps) => {
  const { logout } = useAuth()
  const { unreadCount } = useNotifications()
  const location = useLocation()
  const logoUrl = useSystemLogo()
  const [sections, setSections] = useState<PublicMenuSection[]>([])

  useEffect(() => {
    appMenuService.getSidebarSections().then(setSections).catch(() => setSections([]))
  }, [])

  useEffect(() => { onClose() }, [location.pathname, location.search, onClose])

  return (
    <>
      <div
        className={cn('fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden', open ? 'opacity-100' : 'pointer-events-none opacity-0')}
        onClick={onClose}
        aria-hidden
      />

      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-card shadow-2xl transition-transform duration-300 lg:hidden',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="relative flex flex-col items-center px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))]"
          style={{ background: 'linear-gradient(135deg,#1e1b4b,#4f46e5,#7c3aed)' }}>
          <button type="button" aria-label="Kapat" onClick={onClose}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/20">
            <XIcon className="h-4 w-4" />
          </button>

          <div className="flex flex-col items-center mb-4 mt-1">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-2"
              style={{ background: 'rgba(255,255,255,0.15)', border: '1.5px solid rgba(255,255,255,0.25)' }}>
              <img src={logoUrl} alt="" className="h-9 w-auto object-contain brightness-0 invert" />
            </div>
            <p className="text-[14px] font-black text-white leading-tight">Bakırköy Belediyesi</p>
            <p className="text-[11px] font-semibold text-white/70">Vatandaş Portalı</p>
          </div>

          <div className="w-full">
            <AccountSwitcher variant="dark" onAfterSwitch={onClose} />
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {STATIC_NAV.map(({ to, label, icon: Icon, end, color }) => {
            const isActive = end ? location.pathname === to : location.pathname.startsWith(to)
            return (
              <NavLink key={to} to={to} end={end} onClick={onClose}
                className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors relative"
                style={{ background: isActive ? `${color}18` : 'transparent' }}>
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full" style={{ width: 3, height: 20, background: color }} />
                )}
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-colors"
                  style={isActive
                    ? { background: `linear-gradient(135deg,${color},${color}cc)`, color: '#fff', boxShadow: `0 4px 12px ${color}40` }
                    : { background: '#F3F4F6', color: '#9CA3AF' }}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-semibold truncate" style={{ color: isActive ? color : '#111827' }}>{label}</span>
                {to === '/bildirimler' && unreadCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#EF4444,#F97316)' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </NavLink>
            )
          })}

          {sections.length > 0 && (
            <div className="pt-2">
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-foreground-subtle">Hizmetler</p>
              {sections.map(section => <DrawerSection key={section.id} section={section} onClose={onClose} />)}
            </div>
          )}
        </nav>

        <div className="flex-shrink-0 space-y-2 border-t border-border p-3">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold text-foreground-subtle">Görünüm</span>
            <ThemeToggle />
          </div>
          <button type="button" onClick={() => { onClose(); void logout() }}
            className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-red-400 transition-colors hover:bg-red-50">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <LogOutIcon className="h-3.5 w-3.5" />
            </div>
            <span className="text-sm font-semibold">Çıkış Yap</span>
          </button>
        </div>
      </aside>
    </>
  )
}
