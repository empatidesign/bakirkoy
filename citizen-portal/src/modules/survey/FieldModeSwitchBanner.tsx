import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardListIcon, ArrowRightIcon } from 'lucide-react'
import surveyService from '@/services/survey.service'
import { useAuth } from '@/framework/auth/AuthContext'

// Kullanıcı isteği (2026-09-02): "anketör normal üye olacağı için burada vatandaş
// portalını da kullandığı için en üstte vatandaş portalı ile anket yönetim sayfasına
// geçiş olmalı; sadece bu üyede, başka bir üyede çıkmamalı."
//
// Giriş sonrası mod seçim ekranı (AppModeSelectPage) yalnızca bir kez gösteriliyordu;
// portala geçen anketörün sahaya dönmek için çıkış yapması gerekiyordu. Bu şerit
// portalın en üstünde kalıcı bir geçiş sunar.
//
// Görünürlük kuralı: yalnızca sunucunun "aktif saha görevin var" dediği üyede
// görünür (GET /me/surveys/field-assignment). Normal vatandaşta hiç render edilmez;
// istek başarısız olursa da gösterilmez, yani şerit yanlışlıkla sızmaz.
export const FieldModeSwitchBanner = () => {
  const navigate = useNavigate()
  const { state } = useAuth()
  const userId = state.status === 'authenticated' ? state.user.id : null
  const [isInterviewer, setIsInterviewer] = useState(false)

  useEffect(() => {
    if (!userId) {
      setIsInterviewer(false)
      return
    }
    let cancelled = false
    surveyService.fieldAssignment()
      .then((has) => { if (!cancelled) setIsInterviewer(has) })
      .catch(() => { if (!cancelled) setIsInterviewer(false) })
    return () => { cancelled = true }
    // Veli çocuk hesabına geçtiğinde yetki değişir; kullanıcı kimliği bağımlılıktır.
  }, [userId])

  if (!isInterviewer) return null

  return (
    <div className="px-3 pt-2 sm:px-4" data-testid="field-mode-switch">
      <button
        type="button"
        onClick={() => { sessionStorage.setItem('app_mode', 'field'); navigate('/saha') }}
        className="flex min-h-[48px] w-full items-center gap-3 rounded-xl bg-gradient-to-r from-[#3b1e8f] via-[#4c2bb0] to-[#6d3fd6] px-3 py-2.5 text-left text-white shadow-sm transition-transform active:scale-[0.99] sm:px-4"
      >
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/15">
          <ClipboardListIcon className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-tight">Anket Yönetim Sayfası</span>
          <span className="block truncate text-[11px] text-blue-100">
            Saha anketörü olarak görevlerinize geçin
          </span>
        </span>
        <span className="flex flex-shrink-0 items-center gap-1 rounded-lg bg-white/15 px-2.5 py-1.5 text-xs font-bold">
          Geç <ArrowRightIcon className="h-3.5 w-3.5" />
        </span>
      </button>
    </div>
  )
}
