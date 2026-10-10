import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/framework/auth/AuthContext'
import { CitizenPopupGate } from './CitizenPopupGate'

const ROUTE_MODULE_MAP: Record<string, string> = {
  '/': 'home',
  '/etkinlikler': 'events',
  '/hizmetler': 'facilities',
  '/geziler': 'travels',
  '/kutuphane': 'library',
  '/spor': 'sports',
  '/kampanyalar': 'campaigns',
  '/carkim': 'wheel',
  '/yarisma': 'quiz',
  '/anketler': 'survey',
  '/seda': 'seda',
  '/sadakat': 'loyalty',
  '/formlarim': 'submissions',
  '/acil-alanlar': 'emergency-areas',
}

type QueueItem = { trigger: 'first_login' | 'every_login' | 'module_enter'; moduleKey?: string }

export const PopupGateController = () => {
  const { state } = useAuth()
  const location = useLocation()
  const [active, setActive] = useState<QueueItem | null>(null)
  const checkedFirstLoginRef = useRef(false)
  const checkedHomeRef = useRef(false)
  const checkedModulesRef = useRef<Set<string>>(new Set())
  const queueRef = useRef<QueueItem[]>([])
  const processingRef = useRef(false)

  const enqueue = (item: QueueItem) => {
    queueRef.current.push(item)
    void processQueue()
  }

  const processQueue = async () => {
    if (processingRef.current || active) return
    const next = queueRef.current.shift()
    if (!next) return
    processingRef.current = true
    setActive(next)
    processingRef.current = false
  }

  useEffect(() => {
    if (state.status !== 'authenticated') return
    if (checkedFirstLoginRef.current) return
    checkedFirstLoginRef.current = true
    enqueue({ trigger: 'first_login' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status])

  useEffect(() => {
    if (state.status !== 'authenticated') return
    const path = location.pathname

    if (path === '/' && !checkedHomeRef.current) {
      checkedHomeRef.current = true
      enqueue({ trigger: 'every_login' })
    }

    const moduleKey = ROUTE_MODULE_MAP[path]
    if (moduleKey && moduleKey !== 'home' && !checkedModulesRef.current.has(moduleKey)) {
      checkedModulesRef.current.add(moduleKey)
      enqueue({ trigger: 'module_enter', moduleKey })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, state.status])

  const handleDone = () => {
    setActive(null)
    setTimeout(() => { void processQueue() }, 50)
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void processQueue() }, [active])

  if (state.status !== 'authenticated' || !active) return null

  return <CitizenPopupGate trigger={active.trigger} moduleKey={active.moduleKey} onDone={handleDone} />
}
