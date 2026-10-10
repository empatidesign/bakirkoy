import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { XIcon, ChevronRightIcon, ExternalLinkIcon, SearchIcon } from 'lucide-react'
import appMenuService, { type PublicMenuSection, type PublicMenuItem } from '@/services/appMenu.service'

const DynamicIcon = ({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) => {
  const [Comp, setComp] = useState<React.ComponentType<{ className?: string; style?: React.CSSProperties }> | null>(null)
  useEffect(() => {
    import('lucide-react').then((mod) => {
      const C = (mod as Record<string, unknown>)[name] as React.ComponentType<{ className?: string; style?: React.CSSProperties }> | undefined
      if (C) setComp(() => C)
    }).catch(() => {})
  }, [name])
  if (!Comp) return <span className={className} style={style}>●</span>
  return <Comp className={className} style={style} />
}

const isExternal = (url: string) => /^https?:\/\//i.test(url)
const safeHref   = (url: string) => isExternal(url) ? url : '#'
const safeInternal = (url: string) => url.startsWith('/') ? url : '/'

interface Props {
  open: boolean
  onClose: () => void
}

export const MunicipalMenuSheet = ({ open, onClose }: Props) => {
  const [sections, setSections] = useState<PublicMenuSection[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSearch('')
    appMenuService.getPublicMenu()
      .then((s) => setSections(s.filter(sec => sec.isVisible)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  const filteredSections = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((i) => i.isVisible && (!q
          || i.title.toLocaleLowerCase('tr').includes(q)
          || sec.title.toLocaleLowerCase('tr').includes(q))),
      }))
      .filter((sec) => sec.items.length > 0)
  }, [sections, search])

  const totalItems = useMemo(
    () => filteredSections.reduce((n, s) => n + s.items.length, 0),
    [filteredSections],
  )

  if (!open) return null

  const MenuItemRow = ({ item }: { item: PublicMenuItem }) => {
    const target = item.mobileLinkTarget || item.linkTarget
    const ext = isExternal(target)

    const inner = (
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-surface-1 active:bg-surface-2 transition-colors cursor-pointer">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${item.color}18` }}>
          <DynamicIcon name={item.icon} className="h-5 w-5" style={{ color: item.color }} />
        </div>
        <div className="flex-1 min-w-0">
          {/* Hata raporu (docs/hata.md #2): uzun hizmet adları sınırsız satıra yayılıp
              rozet/ikon alanıyla iç içe geçiyordu. Ad en fazla iki satır, taşan kısım "…"
              ile kısaltılır; rozet ve sağdaki ikon kendi alanında sabit kalır. */}
          <p className="line-clamp-2 break-words text-[13px] font-bold text-foreground-strong" title={item.title}>{item.title}</p>
          {item.badgeText && (
            <span className="mt-0.5 inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
              style={{ background: item.color }}>
              {item.badgeText}
            </span>
          )}
        </div>
        {ext
          ? <ExternalLinkIcon className="h-4 w-4 text-foreground-subtle flex-shrink-0" />
          : <ChevronRightIcon className="h-4 w-4 text-foreground-subtle flex-shrink-0" />}
      </div>
    )

    if (ext) {
      return (
        <a href={safeHref(target)} target="_blank" rel="noopener noreferrer" onClick={onClose}>
          {inner}
        </a>
      )
    }
    return (
      <Link to={safeInternal(target)} onClick={onClose}>
        {inner}
      </Link>
    )
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col justify-end lg:justify-center lg:items-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        ref={ref}
        className="relative z-10 w-full lg:max-w-2xl rounded-t-3xl lg:rounded-3xl bg-card flex flex-col overflow-hidden"
        style={{ maxHeight: '88vh', boxShadow: '0 -8px 48px rgba(0,0,0,0.2)' }}
      >
        <div className="flex justify-center pt-3 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-surface-2" />
        </div>

        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-black text-foreground-strong">Belediye Hizmetleri</p>
              <p className="text-[11px] text-foreground-subtle mt-0.5">
                {loading ? 'Bakırköy Belediyesi' : `${totalItems} hizmet`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-foreground-muted hover:bg-surface-2 transition-colors"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="relative mt-3">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hizmet ara…"
              className="w-full rounded-xl border border-border bg-surface-1 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-300 focus:bg-card"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-1 py-2">
                  <div className="h-10 w-10 rounded-xl bg-surface-1 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-3 w-32 rounded bg-surface-1 animate-pulse mb-2" />
                    <div className="h-2 w-20 rounded bg-surface-1 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredSections.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center px-6">
              <SearchIcon className="h-7 w-7 text-foreground-subtle" />
              <p className="text-sm text-foreground-subtle">"{search}" için hizmet bulunamadı</p>
            </div>
          ) : (
            <div className="pb-2">
              {filteredSections.map((sec) => (
                <div key={sec.id}>
                  <div className="sticky top-0 z-[1] flex items-center gap-2 bg-card/95 backdrop-blur-sm px-5 py-2 border-b border-border">
                    <DynamicIcon name={sec.icon} className="h-3.5 w-3.5 flex-shrink-0" style={{ color: '#1486C9' }} />
                    <p className="text-[11px] font-bold uppercase tracking-wide text-foreground-muted">{sec.title}</p>
                  </div>
                  <div className="divide-y divide-border">
                    {sec.items.map((item) => (
                      <MenuItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 flex gap-2 flex-wrap" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {[
            { label: 'E-Ödeme', href: 'https://www.bakirkoy.bel.tr/e-belediye', color: '#005da3' },
            { label: 'İmar Durumu', href: 'https://www.bakirkoy.bel.tr/imar-durumu', color: '#10B981' },
            { label: 'İletişim', href: 'https://www.bakirkoy.bel.tr/iletisim', color: '#8B5CF6' },
            { label: 'Haber & Duyuru', href: 'https://www.bakirkoy.bel.tr/haberler', color: '#F59E0B' },
          ].map(({ label, href, color }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold transition-all hover:opacity-80"
              style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}
            >
              <ExternalLinkIcon className="h-3 w-3" />
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
