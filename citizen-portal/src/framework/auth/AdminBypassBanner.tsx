import { BypassReturnBanner } from './BypassReturnBanner'
import { useAuth } from './AuthContext'

// Vatandaş AppShell'de kullanılır: bypass oturumunda kullanıcı adını gösterir.
export const AdminBypassBanner = () => {
  const { state } = useAuth()
  if (state.status !== 'authenticated') return null
  return <BypassReturnBanner label={`${state.user.fullName} hesabını yönetici olarak görüntülüyorsunuz`} />
}
