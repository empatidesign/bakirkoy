import { useEffect, useRef } from 'react'

const stack: symbol[] = []

export function useOverlayDismiss(open: boolean, onClose: () => void) {
  const idRef = useRef<symbol>()
  if (!idRef.current) idRef.current = Symbol('overlay')

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    const id = idRef.current!
    stack.push(id)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && stack[stack.length - 1] === id) onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      const i = stack.lastIndexOf(id)
      if (i !== -1) stack.splice(i, 1)
    }
  }, [open])
}
