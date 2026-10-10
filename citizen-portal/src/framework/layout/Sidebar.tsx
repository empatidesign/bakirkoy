import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  HomeIcon, CalendarCheckIcon, UserIcon, LogOutIcon, BellIcon,
  ClipboardListIcon, HistoryIcon,
  ExternalLinkIcon, TrophyIcon,
} from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { ThemeToggle } from './ThemeToggle'
import { useNotifications } from '@/framework/notifications/NotificationContext'
import appMenuService, { type PublicMenuSection } from '@/services/appMenu.service'
import { AccountSwitcher } from '@/components/specialized/AccountSwitcher'
import { isMenuTargetActive } from '@/lib/utils'
import { resolveLucideIcon } from '@/lib/dynamicLucideIcon'

const STATIC_NAV = [
  { to: '/', label: 'Ana Sayfa', icon: HomeIcon, end: true, color: '#6366F1' },
  { to: '/sadakat', label: 'Sadakat Puanım', icon: TrophyIcon, color: '#7C3AED' },
  { to: '/basvurularim', label: 'Başvurularım', icon: ClipboardListIcon, color: '#8B5CF6' },
  { to: '/planlarim', label: 'Planlarım', icon: CalendarCheckIcon, color: '#34C27A' },
  { to: '/gecmisim', label: 'Geçmişim', icon: HistoryIcon, color: '#0EA5E9' },
  { to: '/bildirimler', label: 'Bildirimler', icon: BellIcon, color: '#EF4444' },
  { to: '/profil', label: 'Profil', icon: UserIcon, color: '#94A3B8' },
]

const safeLinkTarget = (url: string): string =>
  /^https?:\/\//i.test(url) ? url : '#'

const DynamicSectionNav = ({ section }: { section: PublicMenuSection }) => {
  const location = useLocation()

  return (
    <div>
      <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
        {section.title}
      </p>
      {section.items.map((item) => {
        const isExternal = item.linkType === 2
        const isActive = isMenuTargetActive(item.linkTarget, location.pathname, location.search)
        const ItemIcon = item.iconType === 0 ? resolveLucideIcon(item.icon) : null

        if (isExternal) {
          return (
            <a
              key={item.id}
              href={safeLinkTarget(item.linkTarget)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 transition-all duration-150 relative"
              style={{ borderRadius: 14 }}
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden"
                style={{ background: `${item.color}18`, color: item.color }}>
                {item.iconType === 1 && item.icon
                  ? <img src={item.icon} alt="" className="h-4 w-4 object-contain" />
                  : ItemIcon
                    ? <ItemIcon className="h-4 w-4" />
                    : <ExternalLinkIcon className="h-4 w-4" />}
              </span>
              <span className="flex-1 text-sm font-semibold truncate" style={{ color: '#111827' }}>{item.title}</span>
              {item.badgeText && (
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
                  style={{ background: item.color }}>{item.badgeText}</span>
              )}
            </a>
          )
        }

        return (
          <NavLink
            key={item.id}
            to={item.linkTarget}
            className="flex items-center gap-3 px-3 py-2.5 transition-all duration-150 relative"
            style={{
              borderRadius: 14,
              background: isActive ? item.color + '18' : 'transparent',
            }}
          >
            {isActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                style={{ width: 3, height: 20, background: item.color }} />
            )}
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden transition-all duration-200"
              style={isActive
                ? { background: `linear-gradient(135deg,${item.color},${item.color}cc)`, color: '#fff', boxShadow: `0 4px 12px ${item.color}40` }
                : { background: `${item.color}15`, color: item.color }}>
              {item.iconType === 1 && item.icon
                ? <img src={item.icon} alt="" className="h-4 w-4 object-contain" style={isActive ? { filter: 'brightness(0) invert(1)' } : undefined} />
                : ItemIcon
                  ? <ItemIcon className="h-4 w-4" />
                  : null}
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

export const Sidebar = () => {
  const { logout } = useAuth()
  const { unreadCount } = useNotifications()
  const location = useLocation()
  const [sections, setSections] = useState<PublicMenuSection[]>([])

  useEffect(() => {
    appMenuService.getSidebarSections().then(setSections).catch(() => setSections([]))
  }, [])

  return (
    <aside
      className="hidden w-64 flex-shrink-0 flex-col lg:flex overflow-hidden"
      style={{
        background: '#ffffff',
        borderRight: '1px solid rgba(99,102,241,0.1)',
      }}
    >
      <NavLink to="/" aria-label="Ana Sayfa" className="flex items-center gap-3 px-5 py-5">
        <img src="/logo-emblem.png" alt="" className="h-11 w-auto flex-shrink-0 object-contain" />
        <div className="leading-none" style={{ color: '#005da3' }}>
          <p className="text-[17px] font-black tracking-wide">BAKIRKÖY</p>
          <p className="mt-1 text-[13px] font-medium tracking-[0.18em]">BELEDİYESİ</p>
        </div>
      </NavLink>

      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(99,102,241,0.1)' }}>
        <AccountSwitcher variant="light" />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {STATIC_NAV.map(({ to, label, icon: Icon, end, color }) => {
          const isExactActive = end ? location.pathname === to : location.pathname.startsWith(to)

          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              className="group flex flex-1 items-center gap-3 px-3 py-2.5 transition-all duration-150 relative"
              style={{
                borderRadius: 14,
                background: isExactActive
                  ? `linear-gradient(135deg, ${color}18 0%, ${color}0d 100%)`
                  : 'transparent',
              }}
            >
              {isExactActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full"
                  style={{ width: 3, height: 20, background: color }} />
              )}
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-200"
                style={isExactActive
                  ? { background: `linear-gradient(135deg, ${color}, ${color}cc)`, color: '#fff', boxShadow: `0 4px 12px ${color}40` }
                  : { background: '#F3F4F6', color: '#9CA3AF' }
                }>
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1 text-sm font-semibold transition-colors truncate"
                style={{ color: isExactActive ? color : '#111827' }}>
                {label}
              </span>
              {to === '/bildirimler' && unreadCount > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #EF4444, #F97316)' }}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </NavLink>
          )
        })}

        {sections.length > 0 && (
          <div className="pt-2">
            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-gray-300">
              Hizmetler
            </p>
            {sections.map((section) => (
              <DynamicSectionNav key={section.id} section={section} />
            ))}
          </div>
        )}
      </nav>

      <div className="p-3 space-y-2" style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-semibold text-gray-400">Görünüm</span>
          <ThemeToggle />
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-all hover:bg-red-50"
          style={{ border: '1px solid transparent' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(239,68,68,0.15)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent' }}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-xl" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <LogOutIcon className="h-3.5 w-3.5 text-red-400" />
          </div>
          <span className="text-sm font-semibold text-red-400">Çıkış Yap</span>
        </button>
      </div>
    </aside>
  )
}