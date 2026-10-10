import { useEffect, useRef, useState } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import familyService from '@/services/family.service'
import { tokenStorage } from '@/services/tokenStorage'

type Variant = 'light' | 'dark'

interface AccountSwitcherProps {
  variant?: Variant
  onAfterSwitch?: () => void
}

interface FamilyAccount {
  id: string
  fullName: string
  age: number | null
  photoUrl?: string
}

interface FamilyRoster {
  parent: FamilyAccount
  children: FamilyAccount[]
}

const getInitials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((n) => n[0]).join('').toUpperCase()

const ageLabel = (age: number | null) => (age != null ? `${age} yaş` : '')

const AVATAR_GRADIENT = 'linear-gradient(135deg, #6366F1, #8B5CF6)'

const HEADER_THEME: Record<Variant, { bg: string; border: string; name: string; sub: string; chevron: string; avatarBg: string }> = {
  light: {
    bg: 'rgba(99,102,241,0.06)', border: 'rgba(99,102,241,0.16)',
    name: '#1f2937', sub: '#9ca3af', chevron: '#a5b4fc', avatarBg: AVATAR_GRADIENT,
  },
  dark: {
    bg: 'rgba(255,255,255,0.12)', border: 'rgba(255,255,255,0.18)',
    name: '#ffffff', sub: 'rgba(255,255,255,0.6)', chevron: 'rgba(255,255,255,0.55)', avatarBg: 'rgba(255,255,255,0.2)',
  },
}

const SwitcherAvatar = ({ name, photoUrl, bg, size }: { name: string; photoUrl?: string; bg: string; size: number }) => (
  <div
    className="flex flex-shrink-0 items-center justify-center rounded-xl font-black text-white overflow-hidden"
    style={{ height: size, width: size, background: bg, fontSize: size <= 32 ? 11 : 13 }}
  >
    {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : getInitials(name)}
  </div>
)

export const AccountSwitcher = ({ variant = 'light', onAfterSwitch }: AccountSwitcherProps) => {
  const { state, switchToChild, switchBack } = useAuth()
  const [roster, setRoster] = useState<FamilyRoster | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const user = state.status === 'authenticated' ? state.user : undefined
  const impersonatedFrom = state.status === 'authenticated' ? state.impersonatedFrom : undefined
  const impersonating = !!impersonatedFrom
  const t = HEADER_THEME[variant]

  useEffect(() => {
    if (!user) return
    if (!impersonating) {
      const parent: FamilyAccount = { id: user.id, fullName: user.fullName, age: user.age ?? null, photoUrl: user.photoUrl }
      familyService.getChildren()
        .then((list) => {
          const next: FamilyRoster = { parent, children: list.map((c) => ({ id: c.id, fullName: c.fullName, age: c.age ?? null, photoUrl: c.photoUrl })) }
          setRoster(next)
          tokenStorage.setFamilyRoster(JSON.stringify(next))
        })
        .catch(() => {
          const cached = tokenStorage.getFamilyRoster()
          if (cached) {
            try {
              setRoster(JSON.parse(cached) as FamilyRoster)
              return
            } catch { void 0 }
          }
          setRoster({ parent, children: [] })
        })
    } else {
      const cached = tokenStorage.getFamilyRoster()
      if (cached) {
        try { setRoster(JSON.parse(cached) as FamilyRoster) } catch { setRoster(null) }
      } else {
        setRoster(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kasıtlı: sadece user.id değişince roster yeniden çekilir, user objesi (fullName/age/photoUrl) değişince gereksiz refetch istenmez
  }, [user?.id, impersonating])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null

  const parentAccount: FamilyAccount = impersonating
    ? (roster?.parent ?? { id: '__parent__', fullName: impersonatedFrom ?? 'Hesabım', age: null })
    : { id: user.id, fullName: user.fullName, age: user.age ?? null, photoUrl: user.photoUrl }

  const childAccounts = roster?.children ?? []
  const allAccounts = [parentAccount, ...childAccounts]
  const others = allAccounts.filter((a) => a.id !== user.id)
  const hasOthers = others.length > 0

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      setOpen(false)
      onAfterSwitch?.()
    } finally {
      setBusy(false)
    }
  }

  const selectAccount = (account: FamilyAccount) => {
    if (account.id === parentAccount.id) run(switchBack)
    else run(() => switchToChild(account.id))
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => hasOthers && setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors"
        style={{ background: t.bg, border: `1px solid ${t.border}`, cursor: hasOthers ? 'pointer' : 'default' }}
      >
        <SwitcherAvatar name={user.fullName} photoUrl={user.photoUrl} bg={t.avatarBg} size={40} />
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[13px] font-semibold leading-tight" style={{ color: t.name }}>{user.fullName}</p>
          {user.age != null && <p className="text-[10px] leading-tight" style={{ color: t.sub }}>{user.age} yaş</p>}
        </div>
        {hasOthers && (
          <ChevronDownIcon
            className="h-4 w-4 flex-shrink-0 transition-transform duration-200"
            style={{ color: t.chevron, transform: open ? 'rotate(180deg)' : 'none' }}
          />
        )}
      </button>

      {open && hasOthers && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-pop">
          <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest text-foreground-subtle">Hesap değiştir</p>
          {others.map((account) => (
            <button
              key={account.id}
              type="button"
              disabled={busy}
              onClick={() => selectAccount(account)}
              className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-1 disabled:opacity-60"
            >
              <SwitcherAvatar name={account.fullName} photoUrl={account.photoUrl} bg={AVATAR_GRADIENT} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold leading-tight text-foreground-strong">{account.fullName}</p>
                {ageLabel(account.age) && <p className="truncate text-[10px] leading-tight text-foreground-subtle">{ageLabel(account.age)}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
