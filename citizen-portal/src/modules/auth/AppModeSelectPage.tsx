import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardListIcon, HomeIcon } from 'lucide-react'
import { AuthLayout } from '@/framework/layout/AuthLayout'
import { Button } from '@/design-system'

// Kullanıcı isteği (2026-09-01): saha görevlisi olarak atanmış (SurveyFieldTask,
// InterviewerType=participant) vatandaşlar giriş yaptığında, normal vatandaş portalı
// ile anket/saha uygulaması arasında seçim yapabilsin. Bu sayfa yalnızca giriş sonrası
// aktif bir saha görevi olduğu tespit edildiğinde gösterilir (bkz. OtpVerifyPage).
export const AppModeSelectPage = () => {
  const navigate = useNavigate()
  const [loading, setLoading] = useState<'portal' | 'survey' | null>(null)

  const go = (mode: 'portal' | 'survey') => {
    setLoading(mode)
    sessionStorage.setItem('app_mode', mode)
    navigate(mode === 'survey' ? '/saha' : '/', { replace: true })
  }

  return (
    <AuthLayout title="Nasıl devam etmek istersiniz?" subtitle="Hesabınıza saha anketörlüğü görevi atanmış. Vatandaş portalına mı, yoksa anket sistemine mi geçmek istersiniz?">
      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => go('portal')}
          disabled={loading !== null}
          className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-1 p-6 text-center transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
        >
          <HomeIcon className="h-8 w-8 text-primary" />
          <span className="type-body-strong">Vatandaş Portalı</span>
          <span className="type-caption">Belediye hizmetlerinden yararlanın, kendi anketlerinizi doldurun.</span>
        </button>
        <button
          type="button"
          onClick={() => go('survey')}
          disabled={loading !== null}
          className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-1 p-6 text-center transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
        >
          <ClipboardListIcon className="h-8 w-8 text-primary" />
          <span className="type-body-strong">Anket Sistemi</span>
          <span className="type-caption">Size atanmış saha görevlerini tablo hâlinde görün, sahada anket toplayın.</span>
        </button>
      </div>
      <Button variant="outline" className="mt-6 w-full" onClick={() => go('portal')} disabled={loading !== null}>
        Şimdilik atla, vatandaş portalına git
      </Button>
    </AuthLayout>
  )
}
