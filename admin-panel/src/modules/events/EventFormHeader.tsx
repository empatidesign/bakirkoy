import { useContext, type ComponentType, type ReactNode } from 'react'
import { DialogHeaderContext } from '@/design-system/AdminFormShell'

// Kullanıcı isteği (2026-10-01): Etkinlik Takvimi modülündeki tüm form/drawer başlıklarının
// zemin rengi birbirinden farklıydı (Etkinlik formu mavi, Başvuru/Seans formları yeşil).
// Hepsi artık modülün kendi imza rengini (Etkinlik Detayı modalı ve vatandaş portalındaki
// Etkinlikler sayfasıyla aynı indigo/mor degrade) kullanan tek bir ortak component üzerinden
// render ediliyor.
const GRADIENT = 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 55%, #6366f1 100%)'

interface EventFormHeaderProps {
  icon: ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  children: ReactNode
}

export const EventFormHeader = ({ icon: Icon, title, subtitle, children }: EventFormHeaderProps) => {
  // "Detayı Görüntüle" modalı gibi zaten kendi (gri) başlığı olan bir diyalog içinde
  // render edilirse (bkz. AdminFormShell'deki aynı desen) rengli bandı tekrar çizmeyiz —
  // aksi halde iki başlık üst üste biner.
  const inHeaderedDialog = useContext(DialogHeaderContext)
  if (inHeaderedDialog) {
    return <div className="-m-5 flex min-h-full flex-col"><div className="space-y-[15px] p-[15px]">{children}</div></div>
  }

  return (
    <div className="-m-5 flex min-h-full flex-col">
      <div className="relative overflow-hidden" style={{ background: GRADIENT }}>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
        <div className="absolute bottom-0 left-8 h-20 w-20 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
        <div className="relative flex items-center gap-4 px-8 py-7">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg shadow-lg" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-white">{title}</p>
            {subtitle && <p className="mt-0.5 text-[12px] text-white/70">{subtitle}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-[15px] p-[15px]">
        {children}
      </div>
    </div>
  )
}
