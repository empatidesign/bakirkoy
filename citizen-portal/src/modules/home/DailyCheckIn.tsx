import { useEffect, useState } from 'react'
import { CheckCircle2Icon, StarIcon, SunIcon, XIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { todayIso } from '@/lib/utils'

const STORAGE_KEY = 'daily_checkin_date'

const getTodayKey = () => todayIso()

const GREETINGS = [
  'Günaydın! Bugün harika bir gün olacak.',
  'Merhaba! Bugün yeni fırsatlar seni bekliyor.',
  "Hoş geldin! Bakırköy'ü birlikte keşfedelim.",
  'Tekrar hoş geldin! Bugün neler yapmak istersin?',
]

const TIPS = [
  'Etkinlikleri kontrol et — belki ilginç bir şey kaçırıyorsundur.',
  'Kampanyaları incele, belki bugün sana özel bir fırsat var.',
  'QR kodunu kullanarak çevrendeki hizmetlerden yararlanabilirsin.',
  'Planlarım sekmesinden bugünkü programını görebilirsin.',
]

export const DailyCheckIn = () => {
  const { state } = useAuth()
  const [visible, setVisible] = useState(false)
  const [greeting] = useState(() => GREETINGS[Math.floor(Date.now() / 1000) % GREETINGS.length])
  const [tip] = useState(() => TIPS[Math.floor(Date.now() / 1000) % TIPS.length])

  const user = state.status === 'authenticated' ? state.user : null

  useEffect(() => {
    if (!user) return
    const last = localStorage.getItem(STORAGE_KEY)
    const today = getTodayKey()
    if (last !== today) {
      setVisible(true)
    }
  }, [user])

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, getTodayKey())
    setVisible(false)
  }

  if (!visible || !user) return null

  const hour = new Date().getHours()
  const timeLabel = hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
  const firstName = user.fullName.split(' ')[0]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div
        className="relative w-full max-w-md rounded-t-3xl sm:rounded-2xl p-6 pb-8"
        style={{ background: 'linear-gradient(135deg, #1486C9 0%, #0c3f7a 100%)' }}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="Karşılama mesajını kapat"
          className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
        >
          <XIcon className="h-4 w-4" />
        </button>

        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20">
            <SunIcon className="h-7 w-7 text-yellow-300" />
          </div>
          <div>
            <p className="text-xs font-medium text-white/70">{timeLabel},</p>
            <h2 className="text-xl font-bold text-white">{firstName}!</h2>
          </div>
        </div>

        <p className="mb-5 text-sm text-white/80 leading-relaxed">{greeting}</p>

        <div className="mb-6 rounded-xl bg-white/15 px-4 py-3">
          <div className="mb-1 flex items-center gap-2">
            <StarIcon className="h-4 w-4 text-yellow-300" />
            <span className="text-xs font-semibold text-white">Günün İpucu</span>
          </div>
          <p className="text-sm text-white/80">{tip}</p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-blue-700 transition-opacity hover:opacity-90"
        >
          <CheckCircle2Icon className="h-4 w-4" />
          Harika, Başlayalım!
        </button>
      </div>
    </div>
  )
}
