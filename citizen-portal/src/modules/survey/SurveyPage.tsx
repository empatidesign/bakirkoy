import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardListIcon, CheckCircle2Icon, ChevronRightIcon, UsersIcon } from 'lucide-react'
import { ModuleHeader } from '@/design-system'
import { SurveyListTab } from './SurveyListTab'
import surveyService from '@/services/survey.service'

type SurveyTab = 'pending' | 'done'

const HEADER_GRADIENT = 'linear-gradient(150deg, #0d9488 0%, #0f766e 55%, #134e4a 100%)'

export const SurveyPage = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<SurveyTab>('pending')
  // Kullanıcı isteği (2026-09-01): saha görevlisi vatandaş, giriş sonrası vatandaş portalını
  // seçmiş olsa bile anket sistemine (saha görev tablosu) buradan tek dokunuşla geçebilsin;
  // aksi hâlde çıkış yapıp yeniden giriş yapması gerekirdi.
  const [hasFieldAssignment, setHasFieldAssignment] = useState(false)

  useEffect(() => {
    let active = true
    surveyService.fieldAssignment()
      .then((v) => { if (active) setHasFieldAssignment(v) })
      .catch(() => { if (active) setHasFieldAssignment(false) })
    return () => { active = false }
  }, [])

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={ClipboardListIcon}
        title="Anketler"
        subtitle="Görüşlerinizle hizmetlerimizi geliştirelim"
        gradient={HEADER_GRADIENT}
        tabs={[
          { key: 'pending', label: 'Yanıtlanacak', icon: ClipboardListIcon },
          { key: 'done', label: 'Yanıtlandı', icon: CheckCircle2Icon },
        ]}
        value={tab}
        onValueChange={(k) => setTab(k as SurveyTab)}
      />

      <div className="flex-1 overflow-y-auto bg-gray-50">
        {hasFieldAssignment && (
          <button
            type="button"
            onClick={() => { sessionStorage.setItem('app_mode', 'survey'); navigate('/saha') }}
            className="flex w-full items-center gap-3 border-b border-border bg-teal-50 px-4 py-3.5 text-left transition-colors hover:bg-teal-100"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-white">
              <UsersIcon className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block type-body-strong text-teal-800">Saha Anket Sistemi</span>
              <span className="block type-caption text-teal-700">Size atanmış saha görevlerini açın</span>
            </span>
            <ChevronRightIcon className="h-5 w-5 text-teal-700" />
          </button>
        )}
        <SurveyListTab tab={tab} />
      </div>
    </div>
  )
}
