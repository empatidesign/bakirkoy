import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  HomeIcon, TrophyIcon, ClipboardListIcon, CalendarCheckIcon,
  TicketPercentIcon, QrCodeIcon, ChevronRightIcon, ChevronLeftIcon, CheckIcon,
  ScanLineIcon, BuildingIcon,
} from 'lucide-react'
import { Button } from '@/design-system'
import { useAuth } from '@/framework/auth/AuthContext'

const CITIZEN_ONBOARDING_KEY = 'nexora_citizen_onboarding_done'
const COMPANY_ONBOARDING_KEY = 'nexora_company_onboarding_done'

interface Step {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  color: string
  title: string
  description: string
  route?: string // bu adımda gezinilecek sayfa
}

const CITIZEN_STEPS: Step[] = [
  {
    icon: HomeIcon,
    color: '#6366F1',
    title: 'Ana Sayfa',
    description: 'Etkinlikler, tesisler, kampanyalar ve duyurulara buradan ulaşabilirsiniz. Güncel içerikler her gün güncellenir.',
    route: '/',
  },
  {
    icon: TrophyIcon,
    color: '#7C3AED',
    title: 'Sadakat Puanım',
    description: 'Etkinliklere katılarak, başvuru yaparak ve kampanya kullanarak puan kazanırsınız. Biriktirdiğiniz puanlarla ödüller alabilirsiniz.',
    route: '/sadakat',
  },
  {
    icon: ClipboardListIcon,
    color: '#8B5CF6',
    title: 'Başvurularım',
    description: 'Yaptığınız tüm başvuruları (spor salonu, havuz, gezi, eğitim vb.) tek ekranda takip edebilirsiniz.',
    route: '/basvurularim',
  },
  {
    icon: CalendarCheckIcon,
    color: '#34C27A',
    title: 'Planlarım',
    description: 'Yaklaşan etkinlik ve randevularınızı görün, takvimde planlayın. Hiçbir etkinliği kaçırmayın.',
    route: '/planlarim',
  },
  {
    icon: TicketPercentIcon,
    color: '#F59E0B',
    title: 'Kampanyalar',
    description: 'Üye firmaların sunduğu özel indirimleri keşfedin. QR kodunuzu okutarak indirimden anında yararlanın.',
    route: '/kampanyalar',
  },
  {
    icon: QrCodeIcon,
    color: '#0EA5E9',
    title: 'QR Kodunuz',
    description: 'Kişisel QR kodunuz kimlik bilgilerinizdir. Etkinliklerde yoklama, firmalarda indirim almak için kullanın.',
    route: '/qr',
  },
]

const COMPANY_STEPS: Step[] = [
  {
    icon: HomeIcon,
    color: '#6366F1',
    title: 'Panel',
    description: 'Firma panelinizde günlük kullandırma istatistiklerini, aktif kampanyaları ve genel özeti görebilirsiniz.',
    route: '/firma',
  },
  {
    icon: ScanLineIcon,
    color: '#0EA5E9',
    title: 'Kullandır',
    description: 'Müşterinizin QR kodunu okutun — karşınıza müşterinin adı ve kampanya listesi gelir, dilediğinizi seçerek anında uygulayın. TC/telefon ile de kullandırabilirsiniz.',
    route: '/firma/redeem',
  },
  {
    icon: TicketPercentIcon,
    color: '#34C27A',
    title: 'Kampanyalar',
    description: 'İndirim kampanyalarınızı buradan oluşturun ve yönetin. Kampanya kuralları ve KVKK metni ekleyebilirsiniz.',
    route: '/firma/campaigns',
  },
  {
    icon: QrCodeIcon,
    color: '#F59E0B',
    title: 'QR Kodum',
    description: 'Firmanızın sabit QR kodunu buradan görüntüleyin ve yazdırın. Müşterileriniz bu kodu okutarak kampanyalarınıza ulaşabilir.',
    route: '/firma/qr',
  },
  {
    icon: BuildingIcon,
    color: '#8B5CF6',
    title: 'Firma Profili',
    description: 'Firma bilgilerinizi, logoyu, banner görseli, galeri fotoğraflarınızı ve hizmet tanıtımınızı buradan güncelleyebilirsiniz.',
    route: '/firma/profile',
  },
]

interface OnboardingWizardProps {
  type: 'citizen' | 'company'
  onDone: () => void
}

const OnboardingWizard = ({ type, onDone }: OnboardingWizardProps) => {
  const steps = type === 'citizen' ? CITIZEN_STEPS : COMPANY_STEPS
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const isLast = step === steps.length - 1
  const current = steps[step]
  const Icon = current.icon

  const goTo = (idx: number) => {
    setStep(idx)
    const route = steps[idx]?.route
    if (route) navigate(route)
  }

  const finish = () => {
    localStorage.setItem(type === 'citizen' ? CITIZEN_ONBOARDING_KEY : COMPANY_ONBOARDING_KEY, '1')
    onDone()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
    >
      <div className="w-full sm:w-[420px] rounded-t-2xl sm:rounded-2xl bg-surface-0 overflow-hidden shadow-2xl">
        <div className="flex flex-col items-center px-6 pt-8 pb-5 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl mb-4 shadow-card"
            style={{ background: `linear-gradient(135deg, ${current.color}22, ${current.color}44)` }}
          >
            <Icon className="h-8 w-8" style={{ color: current.color }} />
          </div>

          <h2 className="type-heading mb-2">{current.title}</h2>
          <p className="type-body text-foreground-muted leading-relaxed">{current.description}</p>

          <div className="mt-5 flex items-center gap-2">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Adım ${i + 1}`}
                onClick={() => goTo(i)}
                className="block rounded-full transition-all focus:outline-none"
                style={{
                  width: i === step ? 20 : 7,
                  height: 7,
                  backgroundColor: i === step ? current.color : 'hsl(var(--border))',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2 px-6 pb-8">
          {step > 0 ? (
            <Button
              variant="outline"
              className="flex-none"
              iconLeft={<ChevronLeftIcon className="h-4 w-4" />}
              onClick={() => goTo(step - 1)}
            >
              Geri
            </Button>
          ) : (
            <Button variant="ghost" className="flex-1 text-foreground-muted" onClick={finish}>
              Atla
            </Button>
          )}
          <Button
            variant="primary"
            className="flex-1"
            style={{ backgroundColor: current.color, borderColor: current.color }}
            iconRight={isLast ? <CheckIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />}
            onClick={isLast ? finish : () => goTo(step + 1)}
          >
            {isLast ? 'Başlayalım!' : 'İleri'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export const useCitizenOnboarding = () => {
  const [shown, setShown] = useState(() => !localStorage.getItem(CITIZEN_ONBOARDING_KEY))
  return { shown, dismiss: () => setShown(false), reopen: () => setShown(true) }
}

export const useCompanyOnboarding = () => {
  const [shown, setShown] = useState(() => !localStorage.getItem(COMPANY_ONBOARDING_KEY))
  return { shown, dismiss: () => setShown(false), reopen: () => setShown(true) }
}

export const CitizenOnboarding = () => {
  const { shown, dismiss } = useCitizenOnboarding()
  const { state } = useAuth()
  const consentPending = state.status === 'authenticated' &&
    (!state.user.kvkkAccepted || !state.user.notificationConsentAccepted)
  if (!shown || consentPending) return null
  return <OnboardingWizard type="citizen" onDone={dismiss} />
}

interface CompanyOnboardingProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export const CompanyOnboarding = ({ open: controlledOpen, onOpenChange }: CompanyOnboardingProps = {}) => {
  const { shown, dismiss } = useCompanyOnboarding()
  const isControlled = controlledOpen !== undefined
  const effectiveShown = isControlled ? controlledOpen : shown
  if (!effectiveShown) return null
  return (
    <OnboardingWizard
      type="company"
      onDone={() => { if (isControlled) onOpenChange?.(false); else dismiss() }}
    />
  )
}
