import { Toaster as SonnerToaster } from 'sonner'

export const AppToaster = () => (
  <SonnerToaster
    position="top-right"
    closeButton
    expand
    gap={10}
    offset={16}
    toastOptions={{ duration: 2000 }}
  />
)
