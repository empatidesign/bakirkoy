import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  HomeIcon,
  LandmarkIcon,
  RotateCwIcon,
  CreditCardIcon,
  CompassIcon
} from 'lucide-react'
import { MunicipalMenuSheet } from '@/modules/home/MunicipalMenuSheet'

const INACTIVE_COLOR = 'hsl(var(--foreground-muted))'

interface TabBarProps {
  visible?: boolean
}

export const TabBar = ({ visible = true }: TabBarProps) => {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <MunicipalMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />

      <nav
        className="flex items-stretch lg:hidden bg-surface-0 border-t border-border transition-transform duration-300 ease-out z-40"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          transform: visible ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        {/* 1. Ana Sayfa (Şartname 3.3.8.2.2.1) */}
        <NavLink to="/" end className="flex flex-1 flex-col items-center justify-center py-2">
          {({ isActive }) => (
            <div className="relative flex w-full flex-col items-center gap-1 py-1">
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-pill"
                  style={{ width: 24, height: 2, background: '#1486C9' }} />
              )}
              <HomeIcon className="h-5 w-5 transition-colors" strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#1486C9' : INACTIVE_COLOR, marginTop: 4 }} />
              <span className="type-caption transition-colors" style={{ color: isActive ? '#1486C9' : INACTIVE_COLOR, fontSize: 10, fontWeight: isActive ? 700 : 500 }}>
                Ana Sayfa
              </span>
            </div>
          )}
        </NavLink>

        {/* 2. E-Belediye (Şartname 3.3.8.2.2.2) */}
        <NavLink to="/e-belediye" className="flex flex-1 flex-col items-center justify-center py-2">
          {({ isActive }) => (
            <div className="relative flex w-full flex-col items-center gap-1 py-1">
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-pill"
                  style={{ width: 24, height: 2, background: '#3B82F6' }} />
              )}
              <LandmarkIcon className="h-5 w-5 transition-colors" strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#3B82F6' : INACTIVE_COLOR, marginTop: 4 }} />
              <span className="type-caption transition-colors" style={{ color: isActive ? '#3B82F6' : INACTIVE_COLOR, fontSize: 10, fontWeight: isActive ? 700 : 500 }}>
                E-Belediye
              </span>
            </div>
          )}
        </NavLink>

        {/* 3. Çark Menüsü (Şartname 3.3.8.2.2.3 - Ortada Yuvarlak Öne Çıkan İkon) */}
        <NavLink to="/cark" className="flex flex-1 flex-col items-center justify-center py-2">
          {({ isActive }) => (
            <div className="flex flex-col items-center gap-0.5" style={{ marginTop: '-10px' }}>
              <span className="flex items-center justify-center transition-all shadow-lg"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%)',
                  boxShadow: `0 4px 14px rgba(139, 92, 246, 0.4)`
                }}>
                <RotateCwIcon className="h-5 w-5 text-white animate-spin-slow" />
              </span>
              <span className="type-caption" style={{ color: isActive ? '#8B5CF6' : INACTIVE_COLOR, marginTop: 1, fontSize: 10, fontWeight: isActive ? 700 : 500 }}>
                Çark
              </span>
            </div>
          )}
        </NavLink>

        {/* 4. Bakkart (Şartname 3.3.8.2.2.4) */}
        <NavLink to="/bakkart" className="flex flex-1 flex-col items-center justify-center py-2">
          {({ isActive }) => (
            <div className="relative flex w-full flex-col items-center gap-1 py-1">
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-pill"
                  style={{ width: 24, height: 2, background: '#0EA5E9' }} />
              )}
              <CreditCardIcon className="h-5 w-5 transition-colors" strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#0EA5E9' : INACTIVE_COLOR, marginTop: 4 }} />
              <span className="type-caption transition-colors" style={{ color: isActive ? '#0EA5E9' : INACTIVE_COLOR, fontSize: 10, fontWeight: isActive ? 700 : 500 }}>
                Bakkart
              </span>
            </div>
          )}
        </NavLink>

        {/* 5. Keşfet (Şartname 3.3.8.2.2.5) */}
        <NavLink to="/kesfet" className="flex flex-1 flex-col items-center justify-center py-2">
          {({ isActive }) => (
            <div className="relative flex w-full flex-col items-center gap-1 py-1">
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-pill"
                  style={{ width: 24, height: 2, background: '#14B8A6' }} />
              )}
              <CompassIcon className="h-5 w-5 transition-colors" strokeWidth={isActive ? 2.5 : 2} style={{ color: isActive ? '#14B8A6' : INACTIVE_COLOR, marginTop: 4 }} />
              <span className="type-caption transition-colors" style={{ color: isActive ? '#14B8A6' : INACTIVE_COLOR, fontSize: 10, fontWeight: isActive ? 700 : 500 }}>
                Keşfet
              </span>
            </div>
          )}
        </NavLink>
      </nav>
    </>
  )
}
