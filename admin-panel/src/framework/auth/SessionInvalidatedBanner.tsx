import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { Banner, Button } from '@/design-system'

export const SessionInvalidatedBanner = () => {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => setVisible(true)
    window.addEventListener('session:invalidated', handler)
    return () => window.removeEventListener('session:invalidated', handler)
  }, [])

  if (!visible) return null

  return (
    <Banner
      tone="danger"
      fixed
      icon={ShieldAlert}
      action={
        <Button
          variant="outline"
          size="sm"
          className="border-white/40 bg-white/15 text-white hover:bg-white/25"
          onClick={() => navigate('/login', { replace: true })}
        >
          Giriş Yap
        </Button>
      }
    >
      Bu hesaba başka bir cihazdan giriş yapıldı. Mevcut oturumunuz sonlandırıldı.
    </Banner>
  )
}
