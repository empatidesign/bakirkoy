import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon, Loader2Icon, SearchIcon, UserIcon, UsersIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/design-system'
import surveyPlatformService from '@/services/surveyPlatform.service'
import type { SurveyFieldTaskInterviewerRef, SurveyInterviewerCandidate } from '@/types/surveyPlatform.types'

// Kullanıcı isteği (2026-09-01): saha görevlisi olarak yönetici hesabı ya da site üyesi
// (vatandaş) seçilebilsin; TC kimlik numarası veya telefonla arama yapılabilsin. Bu bileşen
// hem tekli hem çoklu seçim modunu destekler ve arka planı beyaz (bg-surface-1) tutar.
interface Props {
  values: SurveyFieldTaskInterviewerRef[]
  onChange: (values: SurveyFieldTaskInterviewerRef[]) => void
  multiple?: boolean
  disabled?: boolean
  placeholder?: string
}

export const SurveyInterviewerPicker = ({ values, onChange, multiple = true, disabled, placeholder = 'İsim, T.C. kimlik no veya telefon ile arayın...' }: Props) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SurveyInterviewerCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    const t = window.setTimeout(() => {
      surveyPlatformService
        .searchInterviewerCandidates(query)
        .then((res) => { if (alive) setResults(res) })
        .catch(() => { if (alive) setResults([]) })
        .finally(() => { if (alive) setLoading(false) })
    }, 250)
    return () => { alive = false; window.clearTimeout(t) }
  }, [open, query])

  const isSelected = (c: SurveyInterviewerCandidate) => values.some((v) => v.id === c.id && v.type === c.type)

  const toggle = (c: SurveyInterviewerCandidate) => {
    if (isSelected(c)) {
      onChange(values.filter((v) => !(v.id === c.id && v.type === c.type)))
      return
    }
    const ref: SurveyFieldTaskInterviewerRef = { id: c.id, type: c.type, label: c.fullName }
    onChange(multiple ? [...values, ref] : [ref])
    if (!multiple) setOpen(false)
  }

  const remove = (id: string, type: string, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(values.filter((v) => !(v.id === id && v.type === type)))
  }

  return (
    <div ref={ref} className="relative w-full">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => { if (!disabled) setOpen((o) => !o) }}
        className={cn(
          'flex min-h-11 w-full cursor-pointer items-start gap-2 rounded-field border border-border bg-[hsl(var(--surface-1))] px-2 py-1.5 text-left text-sm text-foreground-default transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary',
          open && 'border-primary ring-2 ring-primary/30',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        {values.length === 0 ? (
          <span className="type-muted flex-1 self-center">{placeholder}</span>
        ) : (
          <span className="flex min-w-0 flex-1 flex-wrap gap-1">
            {values.map((v) => (
              <span key={`${v.type}-${v.id}`} className="inline-flex min-h-6 max-w-full items-center gap-1 rounded-pill bg-primary/10 px-2 py-0.5 text-xs text-primary">
                {v.type === 'participant' ? <UsersIcon className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                <span className="truncate">{v.label}</span>
                <span role="button" tabIndex={-1} onClick={(e) => remove(v.id, v.type, e)} className="shrink-0 cursor-pointer rounded-full hover:bg-primary/20">
                  <XIcon className="h-3 w-3" />
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronDownIcon className={cn('h-4 w-4 shrink-0 self-center text-foreground-muted transition-transform', open && 'rotate-180')} />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-card border border-border bg-[hsl(var(--surface-1))] shadow-pop">
          <div className="border-b border-border p-1.5">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2.5 text-foreground-subtle">
                <SearchIcon className="h-3.5 w-3.5" />
              </span>
              <input
                type="text"
                autoFocus
                value={query}
                placeholder="Ad, T.C. no veya telefon"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
                className="h-10 w-full rounded-field border border-border bg-[hsl(var(--surface-1))] pl-8 pr-2.5 text-sm text-foreground-default placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>
          </div>

          <ul className="max-h-[min(18rem,40vh)] overflow-y-auto py-1">
            {loading && (
              <li className="flex items-center gap-2 px-3 py-2.5 type-caption"><Loader2Icon className="h-3.5 w-3.5 animate-spin" /> Aranıyor...</li>
            )}
            {!loading && results.length === 0 && (
              <li className="px-3 py-3 type-muted text-sm">{query ? 'Sonuç bulunamadı' : 'Aramak için yazmaya başlayın'}</li>
            )}
            {!loading && results.map((c) => {
              const selected = isSelected(c)
              return (
                <li key={`${c.type}-${c.id}`}>
                  <button
                    type="button"
                    onClick={() => toggle(c)}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-primary/5',
                      selected && 'bg-primary/10',
                    )}
                  >
                    {c.type === 'participant' ? <UsersIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" /> : <UserIcon className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted" />}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate type-body-strong">{c.fullName}</span>
                        <Badge tone={c.type === 'participant' ? 'info' : 'neutral'}>{c.type === 'participant' ? 'Üye' : 'Yönetici'}</Badge>
                      </span>
                      <span className="block type-caption">
                        {[c.tcknMasked, c.phone, c.department, c.neighborhood].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
