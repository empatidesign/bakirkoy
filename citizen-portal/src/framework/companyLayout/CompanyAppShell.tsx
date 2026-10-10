import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { CompanySidebar } from './CompanySidebar'
import { CompanyMobileHeader } from './CompanyMobileHeader'
import { CompanyTabBar } from './CompanyTabBar'
import { CompanyDrawerMenu } from './CompanyDrawerMenu'
import { CompanyOnboarding } from '@/components/specialized/OnboardingWizard'
import { BypassReturnBanner } from '@/framework/auth/BypassReturnBanner'
import { useCompanyAuth } from '@/framework/companyAuth/CompanyAuthContext'

export const OPEN_COMPANY_ONBOARDING_EVENT = 'company-onboarding:open'

export const CompanyAppShell = () => {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const { state } = useCompanyAuth()
  const companyName = state.status === 'authenticated' ? state.company.name : ''

  useEffect(() => {
    const open = () => setOnboardingOpen(true)
    window.addEventListener(OPEN_COMPANY_ONBOARDING_EVENT, open)
    return () => window.removeEventListener(OPEN_COMPANY_ONBOARDING_EVENT, open)
  }, [])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-surface-1">
      <CompanySidebar onHelpClick={() => setOnboardingOpen(true)} />
      <CompanyDrawerMenu open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {companyName && <BypassReturnBanner label={`${companyName} firma panelini yönetici olarak görüntülüyorsunuz`} />}
        <CompanyMobileHeader onMenuClick={() => setDrawerOpen(true)} onHelpClick={() => setOnboardingOpen(true)} />
        <main className="flex-1 overflow-y-auto overscroll-contain">
          <Outlet />
        </main>
        <CompanyTabBar />
      </div>
      <CompanyOnboarding open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
  )
}
