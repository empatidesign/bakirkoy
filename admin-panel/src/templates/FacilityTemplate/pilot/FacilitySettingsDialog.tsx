import * as Dialog from '@radix-ui/react-dialog'
import { Settings2, X, Building2, SlidersHorizontal, Layers } from 'lucide-react'
import { useRef, type ReactNode, type KeyboardEvent } from 'react'

export function FacilitySettingsDialog({ open, onClose, title, tab, onTabChange, children, footer, branchTabLabel }: {
  open: boolean; onClose: () => void; title: string; tab: string;
  onTabChange: (value: string) => void; children: ReactNode; footer?: ReactNode;
  branchTabLabel?: string;
}) {
  const returnFocus = useRef<HTMLElement | null>(null)
  const tabsConfig = [
    { key: 'general', label: 'Genel ayarlar', icon: SlidersHorizontal },
    ...(branchTabLabel ? [{ key: 'branches', label: branchTabLabel, icon: Layers }] : []),
    { key: 'facility', label: 'Tesise özel ayarlar', icon: Building2 },
  ]
  const keys = tabsConfig.map((t) => t.key)

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    let next = keys.indexOf(tab)
    if (event.key === 'ArrowRight') next = (next + 1) % keys.length
    else if (event.key === 'ArrowLeft') next = (next + keys.length - 1) % keys.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = keys.length - 1
    else return
    event.preventDefault()
    onTabChange(keys[next])
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }
  return <Dialog.Root open={open} onOpenChange={(value) => { if (!value) onClose() }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm" />
      <Dialog.Content
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement | null
          if (target?.closest?.('[data-ds-popover]')) {
            e.preventDefault()
          }
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement | null
          if (target?.closest?.('[data-ds-popover]')) {
            e.preventDefault()
          }
        }}
        onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement }}
        onCloseAutoFocus={(event) => { event.preventDefault(); const target = returnFocus.current?.isConnected ? returnFocus.current : document.querySelector<HTMLElement>('[data-action="settings"]'); target?.focus() }}
        className="facility-ui-pilot pilot-form-dialog facility-settings-dialog"
        aria-describedby="facility-settings-description"
      >
        <header className="pilot-form-header ds-hero flex flex-shrink-0 items-center gap-3 px-5 py-4">
          <div className="pilot-form-icon flex h-8 w-8 items-center justify-center rounded-field"><Settings2 className="h-4 w-4 text-white" aria-hidden="true" /></div>
          <div className="min-w-0 flex-1">
            <Dialog.Title className="text-sm font-semibold text-foreground-strong">{title}</Dialog.Title>
            <Dialog.Description id="facility-settings-description" className="text-[11px] text-foreground-muted">Başvuru, katılım ve program kurallarını yönetin.</Dialog.Description>
          </div>
          <Dialog.Close asChild><button type="button" className="pilot-form-close ds-glass-btn flex h-8 w-8 items-center justify-center rounded-field transition-colors" aria-label="Ayarları kapat"><X className="h-4 w-4" aria-hidden="true" /></button></Dialog.Close>
        </header>
        <div role="tablist" aria-label="Ayar kapsamı" className="pilot-settings-tabs">
          {tabsConfig.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                id={`settings-tab-${item.key}`}
                aria-selected={tab === item.key}
                aria-controls={`settings-panel-${item.key}`}
                tabIndex={tab === item.key ? 0 : -1}
                onClick={() => onTabChange(item.key)}
                onKeyDown={onKeyDown}
              >
                <Icon aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>
        <div className="pilot-settings-body pilot-form-body" role="tabpanel" id={`settings-panel-${tab}`} aria-labelledby={`settings-tab-${tab}`} tabIndex={0}>
          {children}
        </div>
        {footer && <footer className="pilot-settings-footer pilot-form-footer">{footer}</footer>}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
}
