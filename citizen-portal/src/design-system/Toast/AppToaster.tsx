import { Toaster as SonnerToaster } from 'sonner'

export const AppToaster = () => (
  <SonnerToaster
    position="top-right"
    closeButton
    expand
    gap={10}
    offset={16}
    toastOptions={{
      duration: 4000,
      classNames: {
        toast: '!rounded-lg !bg-white !text-gray-800 !border !border-gray-100 !border-l-4 !shadow-[0_8px_24px_rgba(15,23,42,0.12)]',
        title: '!text-[13px] !font-semibold !text-gray-900',
        description: '!text-[12px] !text-gray-500',
        success: '!border-l-emerald-500 [&_svg]:!text-emerald-500',
        error: '!border-l-red-500 [&_svg]:!text-red-500',
        warning: '!border-l-amber-500 [&_svg]:!text-amber-500',
        info: '!border-l-indigo-500 [&_svg]:!text-indigo-500',
        // Ölçüm bulgusu (2026-09-01, saha tablet E2E): Sonner'ın varsayılan
        // kapatma düğmesi 20x20px, dokunmatik ekranda parmakla isabet
        // ettirilemiyor. 44px'e çıkarıldı; görsel daire aynı boyutta kalsın
        // diye büyütme şeffaf dolgudan geliyor.
        closeButton: '!h-11 !w-11 !left-auto !right-1 !top-1 !border-0 !bg-transparent !text-gray-400 hover:!bg-gray-100 hover:!text-gray-700',
      },
    }}
  />
)
