import { useEffect, useRef } from 'react'

const stack: symbol[] = []

// Denetimde bulundu (2026-10-01): pilot FilterBar her zaman açık render olduğundan
// (eski collapsible filtre panelinin aksine), bir Drawer/Modal açıldığında arka plandaki
// filtre alanlarıyla aynı etiketli form alanları aynı anda DOM'da/erişilebilirlik ağacında
// bulunuyordu (ör. "Hizmet Kategorisi" hem filtrede hem Yeni Firma formunda) — ekran
// okuyucular ve strict-mode test selector'ları için gerçek bir belirsizlik. Düzeltme:
// herhangi bir overlay açıkken #root'u aria-hidden+inert yaparak arka planı erişilebilirlik
// ağacından tamamen çıkarıyoruz (üstteki overlay zaten document.body'ye portal'landığından
// bundan etkilenmez). Drawer/Modal/ImageLightbox/RowActions'ın hepsi bu hook'u paylaştığından
// tek merkezi düzeltme hepsini kapsar.
const setRootInert = (hidden: boolean) => {
  const root = document.getElementById('root')
  if (!root) return
  if (hidden) { root.setAttribute('aria-hidden', 'true'); root.setAttribute('inert', '') }
  else { root.removeAttribute('aria-hidden'); root.removeAttribute('inert') }
}

export function useOverlayDismiss(open: boolean, onClose: () => void) {
  const idRef = useRef<symbol>()
  if (!idRef.current) idRef.current = Symbol('overlay')

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const id = idRef.current!
    stack.push(id)
    setRootInert(true)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stack[stack.length - 1] === id) onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const i = stack.lastIndexOf(id)
      if (i !== -1) stack.splice(i, 1)
      if (stack.length === 0) setRootInert(false)
    }
  }, [open])
}
