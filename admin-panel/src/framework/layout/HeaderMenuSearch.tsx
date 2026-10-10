import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchIcon, Building2Icon, UsersIcon, FileTextIcon, UserIcon, HistoryIcon, BusIcon, CalendarIcon, LibraryIcon, LandmarkIcon } from 'lucide-react'
import { Combobox, type ComboOption } from '@/design-system'
import { useVisibleNavItems } from '@/framework/layout/Sidebar'
import { globalSearchService } from '@/services/globalSearch.service'
import { FACILITY_MODULES } from '@/templates/FacilityTemplate/moduleConfig'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

const RECENT_KEY = 'header-search-recent'
const RECENT_MAX = 8

type RecentItem = { value: string; label: string; description?: string }

const readRecent = (): RecentItem[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as RecentItem[]) : []
  } catch {
    return []
  }
}

const saveRecent = (item: RecentItem) => {
  try {
    const next = [item, ...readRecent().filter((r) => r.value !== item.value)].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    return
  }
}

const KIND_ICON: Record<string, ReactNode> = {
  facility: <Building2Icon className="h-4 w-4 text-[hsl(var(--primary))]" />,
  group: <UsersIcon className="h-4 w-4 text-[hsl(var(--accent-violet))]" />,
  application: <FileTextIcon className="h-4 w-4 text-[hsl(var(--warning))]" />,
  participant: <UserIcon className="h-4 w-4 text-[hsl(var(--success))]" />,
  travel: <BusIcon className="h-4 w-4 text-[hsl(var(--accent-orange))]" />,
  event: <CalendarIcon className="h-4 w-4 text-[hsl(var(--accent-blue))]" />,
  library: <LibraryIcon className="h-4 w-4 text-[hsl(var(--accent-green))]" />,
  servicefacility: <LandmarkIcon className="h-4 w-4 text-[hsl(var(--info))]" />,
}

const NAMED_KINDS = [
  { kind: 'travel', key: 'travels', label: 'Gezi' },
  { kind: 'event', key: 'events', label: 'Etkinlik' },
  { kind: 'library', key: 'libraries', label: 'Kıraathane' },
  { kind: 'servicefacility', key: 'serviceFacilities', label: 'Hizmet Tesisi' },
] as const

const iconFor = (value: string): ReactNode =>
  KIND_ICON[value.split(':')[0]] ?? <HistoryIcon className="h-4 w-4 text-foreground-subtle" />

export const HeaderMenuSearch = () => {
  const navigate = useNavigate()
  const items = useVisibleNavItems()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        wrapRef.current?.querySelector('input')?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const menuOptions = useMemo<ComboOption[]>(() => items.map((item) => ({
    value: `menu:${item.to}`,
    label: item.label,
    description: 'Sayfa',
    icon: <item.icon className="h-4 w-4 text-foreground-subtle" />,
  })), [items])

  const configByRouteId = useMemo(
    () => new Map(Object.values(FACILITY_MODULES).map((cfg) => [cfg.routeId, cfg])),
    [],
  )
  const moduleLabel = (module: string): string => configByRouteId.get(module)?.terminology.facilitySingular ?? module

  const onSearch = async (q: string): Promise<ComboOption[]> => {
    const trimmed = q.trim()
    if (!trimmed) return readRecent().map((r) => ({ ...r, icon: iconFor(r.value) }))
    const menuMatches = menuOptions.filter((o) => o.label.toLocaleLowerCase('tr').includes(trimmed.toLocaleLowerCase('tr')))
    if (trimmed.length < 2) return menuMatches

    try {
      const result = await globalSearchService.search(trimmed)
      const facilityOptions: ComboOption[] = result.facilities.map((f) => ({
        value: `facility:${f.module}:${f.id}`,
        label: f.name,
        description: `${moduleLabel(f.module)}${f.district ? ' · ' + f.district : ''}${!f.isActive ? ' · Pasif' : ''}`,
        icon: KIND_ICON.facility,
      }))
      const groupOptions: ComboOption[] = result.groups.map((g) => ({
        value: `group:${g.module}:${g.facilityId}:${g.id}:${encodeURIComponent(g.name)}`,
        label: g.name,
        description: `${moduleLabel(g.module)} Grubu${g.facilityName ? ' · ' + g.facilityName : ''}`,
        icon: KIND_ICON.group,
      }))
      const applicationOptions: ComboOption[] = result.applications.map((a) => ({
        value: `application:${a.module}:${a.facilityId}:${encodeURIComponent(a.tckn || a.fullName)}`,
        label: a.fullName,
        description: `Başvuru · ${a.tckn || a.phone || ''}${a.facilityName ? ' · ' + a.facilityName : ''}`.trim(),
        icon: KIND_ICON.application,
      }))
      const participantOptions: ComboOption[] = result.participants.map((p) => ({
        value: `participant:${p.id}:${encodeURIComponent(p.fullName)}`,
        label: p.fullName,
        description: `Katılımcı · ${p.tckn || p.phone || ''}`.trim(),
        icon: KIND_ICON.participant,
      }))
      const namedOptions: ComboOption[] = NAMED_KINDS.flatMap(({ kind, key, label }) => result[key].map((h) => ({
        value: `${kind}:${h.id}:${encodeURIComponent(h.name)}`,
        label: h.name,
        description: h.detail ? `${label} · ${h.detail}` : label,
        icon: KIND_ICON[kind],
      })))
      return [...menuMatches, ...namedOptions, ...facilityOptions, ...groupOptions, ...applicationOptions, ...participantOptions]
    } catch {
      return menuMatches
    }
  }

  const handleChange = (value: string, option?: ComboOption) => {
    if (!value) return
    if (option) saveRecent({ value, label: option.label, description: option.description })
    const [kind, ...rest] = value.split(':')
    if (kind === 'menu') {
      navigate(rest.join(':'))
    } else if (kind === 'facility') {
      const [module, id] = rest
      navigate(`/${module}?f=${id}`)
    } else if (kind === 'group') {
      const [module, facilityId, , name] = rest
      navigate(`/${module}?f=${facilityId}&tab=groups&q=${name}`)
    } else if (kind === 'application') {
      const [module, facilityId, name] = rest
      navigate(`/${module}?f=${facilityId}&tab=applications&q=${name}`)
    } else if (kind === 'participant') {
      const [id] = rest
      navigate(`/participants?pid=${id}`)
    } else if (kind === 'travel') {
      navigate(`/travels?tab=travels&q=${rest[1]}`)
    } else if (kind === 'event') {
      navigate(`/events?tab=events&q=${rest[1]}`)
    } else if (kind === 'library') {
      navigate(`/library?library=${rest[0]}`)
    } else if (kind === 'servicefacility') {
      navigate(`/service-facilities?q=${rest[1]}`)
    }
  }

  return (
    <div ref={wrapRef} className="header-menu-search relative hidden max-w-xl flex-1 md:block">
      <Combobox
        value=""
        onChange={handleChange}
        onSearch={onSearch}
        placeholder="Tesis, gezi, etkinlik, grup, ad soyad, TC ara..."
        emptyText="Eşleşen sonuç bulunamadı"
        iconLeft={<SearchIcon className="h-4 w-4" />}
        allowCustom={false}
        clearable={false}
      />
      <kbd className="header-menu-search-kbd" aria-hidden="true">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
    </div>
  )
}
