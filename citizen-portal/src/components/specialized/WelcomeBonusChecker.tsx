import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { GiftIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import loyaltyService from '@/services/loyalty.service'

const CONSUMED_SESSION_KEY = 'nexora-welcome-bonus-checked'

/**
 * Vatandaş uygulamaya girdiğinde bir kez POST /me/loyalty/welcome-bonus/consume
 * çağırır. Backend zaten idempotent (Participant.WelcomeBonusSeenAt ile tek
 * seferlik tüketim garantili), bu bileşen sadece frontend'in bu endpoint'i
 * HİÇ çağırmaması sorununu (bkz. docs/hosgeldin-bonusu-e2e-test-2026-07-29.md,
 * P0 bulgusu) düzeltir. shouldShow=true dönerse kısa bir toast gösterir.
 */
export const WelcomeBonusChecker = () => {
  const { state } = useAuth()
  const checkedRef = useRef(false)

  useEffect(() => {
    if (state.status !== 'authenticated') return
    if (checkedRef.current) return
    if (sessionStorage.getItem(CONSUMED_SESSION_KEY)) return

    checkedRef.current = true
    sessionStorage.setItem(CONSUMED_SESSION_KEY, '1')

    loyaltyService.consumeWelcomeBonus()
      .then((result) => {
        if (result.shouldShow && result.points > 0) {
          toast.success(`Hoş geldiniz! ${result.points} puan kazandınız 🎁`, {
            icon: <GiftIcon className="h-4 w-4" />,
            duration: 6000,
          })
        }
      })
      .catch(() => { /* sessizce yok say, kritik olmayan bir bonus bildirimi */ })
  }, [state.status])

  return null
}
