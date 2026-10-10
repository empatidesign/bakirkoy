import { EyeIcon } from 'lucide-react'
import { Banner, Button } from '@/design-system'
import { useAuth } from './AuthContext'

export const ImpersonationBanner = () => {
  const { state, switchBack } = useAuth()
  if (state.status !== 'authenticated' || !state.impersonatedFrom) return null
  return (
    <div className="px-4 pt-3">
      <Banner
        tone="warning"
        variant="soft"
        icon={EyeIcon}
        action={<Button size="sm" variant="outline" onClick={() => void switchBack()}>Kendi hesabıma dön</Button>}
      >
        {state.user.fullName} hesabını görüntülüyorsunuz
      </Banner>
    </div>
  )
}
