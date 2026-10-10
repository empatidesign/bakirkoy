import { NavLink } from 'react-router-dom'
import {
  HomeIcon, CalendarCheckIcon, GraduationCapIcon, BusIcon,
  BookOpenIcon, UsersIcon, BellIcon, UserIcon,
} from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { useNotifications } from '@/framework/notifications/NotificationContext'
import { useSystemLogo } from '@/framework/branding/useSystemLogo'

const TABS = [
  { to: '/', label: 'Ana Sayfa', icon: HomeIcon, end: true, color: '#1486C9' },
  { to: '/services', label: 'Hizmetler', icon: GraduationCapIcon, color: '#F59E0B' },
  { to: '/travels', label: 'Geziler', icon: BusIcon, color: '#10B981' },
  { to: '/libraries', label: 'Kıraathaneler', icon: BookOpenIcon, color: '#3B82F6' },
  { to: '/plans', label: 'Planım', icon: CalendarCheckIcon, color: '#34C27A' },
  { to: '/family', label: 'Ailem', icon: UsersIcon, color: '#EC4899' },
  { to: '/notifications', label: 'Bildirimler', icon: BellIcon, color: '#EF4444' },
  { to: '/profile', label: 'Profil', icon: UserIcon, color: '#94A3B8' },
]

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()

export const TopTabBar = () => {
  const { state } = useAuth()
  const { unreadCount } = useNotifications()
  const logoUrl = useSystemLogo()
  const user = state.status === 'authenticated' ? state.user : undefined

  return (
    <header
      className="hidden md:flex lg:hidden items-center gap-1 px-4"
      style={{
        background: 'linear-gradient(135deg, #0c2942 0%, #0E3054 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        minHeight: 56,
      }}
    >
      <div className="flex flex-shrink-0 items-center gap-2 mr-3 pr-3" style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}>
        <img src={logoUrl} alt="Bakırköy Belediyesi" className="h-7 w-auto object-contain brightness-0 invert" />
        <span className="text-xs font-bold text-white/80 leading-tight hidden xl:block">
          Bakırköy<br />Belediyesi
        </span>
      </div>

      <nav className="flex flex-1 items-center gap-0.5 overflow-x-auto no-scrollbar">
        {TABS.map(({ to, label, icon: Icon, end, color }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="relative flex flex-shrink-0 items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-150 text-xs font-medium whitespace-nowrap"
            style={({ isActive }) => ({
              background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
              color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
            })}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-t-full" style={{ width: 20, height: 2, background: color }} />
                )}
                <span className="relative">
                  <Icon className="h-4 w-4" />
                  {to === '/notifications' && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {user && (
        <NavLink
          to="/profil"
          className="flex flex-shrink-0 items-center gap-2 ml-2 pl-3 transition-opacity hover:opacity-80"
          style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}
        >
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #1486C9, #0c6aaa)', border: '1.5px solid rgba(255,255,255,0.2)' }}
          >
            {user.photoUrl
              ? <img src={user.photoUrl} alt="" className="h-full w-full rounded-lg object-cover" />
              : getInitials(user.fullName)}
          </div>
          <div className="hidden xl:block min-w-0">
            <p className="text-xs font-semibold text-white leading-tight truncate max-w-[100px]">{user.fullName}</p>
            <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {user.tckn?.slice(0, 3)}•••••{user.tckn?.slice(-3)}
            </p>
          </div>
        </NavLink>
      )}
    </header>
  )
}
