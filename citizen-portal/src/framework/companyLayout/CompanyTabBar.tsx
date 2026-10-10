import { NavLink } from 'react-router-dom'
import { COMPANY_NAV } from './CompanyNav'

export const CompanyTabBar = () => {
  return (
    <nav
      className="flex items-stretch lg:hidden bg-surface-0 border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {COMPANY_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="flex flex-1 flex-col items-center justify-center py-2">
          {({ isActive }) => (
            <div className="relative flex w-full flex-col items-center gap-1 py-1">
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 rounded-pill"
                  style={{ width: 24, height: 2, background: 'hsl(var(--primary))' }}
                />
              )}
              <Icon
                className="h-5 w-5 transition-colors"
                style={{ color: isActive ? 'hsl(var(--primary))' : '#8A97A8', marginTop: 4 }}
              />
              <span
                className="transition-colors"
                style={{ color: isActive ? 'hsl(var(--primary))' : '#8A97A8', fontSize: 10, fontWeight: 500 }}
              >
                {label}
              </span>
            </div>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
