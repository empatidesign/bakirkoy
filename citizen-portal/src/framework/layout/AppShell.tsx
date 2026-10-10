import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileHeader } from './MobileHeader'
import { MobileDrawer } from './MobileDrawer'
import { TabBar } from './TabBar'
import { ImpersonationBanner } from '@/framework/auth/ImpersonationBanner'
import { AdminBypassBanner } from '@/framework/auth/AdminBypassBanner'
import { FieldModeSwitchBanner } from '@/modules/survey/FieldModeSwitchBanner'
import { CitizenOnboarding } from '@/components/specialized/OnboardingWizard'
import { WelcomeBonusChecker } from '@/components/specialized/WelcomeBonusChecker'
import { PopupGateController } from '@/modules/popups/PopupGateController'

// Kullanıcı isteği: alt menü varsayılan olarak (sayfanın en üstündeyken)
// görünmesin, kullanıcı aşağı kaydırdığında görünür hale gelsin.
// İçerik kaydırılamayacak kadar kısaysa (ör. boş liste) menü gizli
// kalıp erişilemez hale gelmesin diye görünür tutulur.
const SHOW_THRESHOLD = 24

export const AppShell = () => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tabBarVisible, setTabBarVisible] = useState(true)
  const mainRef = useRef<HTMLElement>(null)

  const checkScrollable = useCallback(() => {
    const el = mainRef.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight + SHOW_THRESHOLD) {
      setTabBarVisible(true)
    } else {
      setTabBarVisible(el.scrollTop > SHOW_THRESHOLD)
    }
  }, [])

  useLayoutEffect(() => {
    checkScrollable()
    const el = mainRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(checkScrollable)
    observer.observe(el)
    return () => observer.disconnect()
  }, [checkScrollable])

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const el = e.currentTarget
    if (el.scrollHeight <= el.clientHeight + SHOW_THRESHOLD) {
      setTabBarVisible(true)
      return
    }
    setTabBarVisible(el.scrollTop > SHOW_THRESHOLD)
  }, [])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-surface-1">
      <Sidebar />
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <ImpersonationBanner />
        <AdminBypassBanner />
        {/* Kullanıcı isteği (2026-09-02): anketör üye portalın en üstünden anket
            yönetim sayfasına geçebilsin; diğer üyelerde hiç görünmez. */}
        <FieldModeSwitchBanner />
        <MobileHeader onMenuOpen={() => setDrawerOpen(true)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain" onScroll={handleScroll}>
          <Outlet />
        </main>
        <TabBar visible={tabBarVisible} />
      </div>
      <CitizenOnboarding />
      <WelcomeBonusChecker />
      <PopupGateController />
    </div>
  )
}
