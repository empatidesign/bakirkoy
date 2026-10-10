import { useState, type ReactNode } from 'react'
import { CalendarIcon, EyeIcon, EyeOffIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon, ShieldXIcon, UserIcon } from 'lucide-react'
import { type DataTableColumn } from '@/design-system'
import { formatDate, maskTC } from '@/lib/utils'
import type { Participant } from '@/types/participant.types'
import { GENDER_LABELS, PARTICIPANT_STATUS_LABELS } from '@/types/participant.types'

const STATUS_COLORS: Record<string, string> = {
  Active: '#16a34a',
  Passive: '#64748b',
  Blocked: '#dc2626',
  Pending: '#d97706',
  Deleted: '#94a3b8',
}

const STATUS_BG: Record<string, string> = {
  Active: '#dcfce7',
  Passive: '#f1f5f9',
  Blocked: '#fee2e2',
  Pending: '#fef3c7',
  Deleted: '#f1f5f9',
}

const GENDER_COLORS: Record<string, string> = {
  male: '#2563eb',
  female: '#db2777',
  other: '#7c3aed',
}

const AGE_COLORS = (age: number) => {
  if (age < 13) return { color: '#d97706', bg: '#fef3c7' }
  if (age < 18) return { color: '#7c3aed', bg: '#ede9fe' }
  if (age < 35) return { color: '#2563eb', bg: '#dbeafe' }
  if (age < 55) return { color: '#059669', bg: '#d1fae5' }
  return { color: '#64748b', bg: '#f1f5f9' }
}

const initials = (name: string) =>
  name.trim().split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase()

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return { firstName: fullName.trim(), lastName: '' }
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] }
}

/**
 * Kullanıcı bulgusu (2026-08-09): katılımcı listesinde profil fotoğrafı hiç
 * gösterilmiyordu — sütun her zaman baş harflerden oluşan bir rozet
 * render ediyordu, r.photoUrl alanı (backend zaten doğru dolduruyor)
 * tamamen kullanılmıyordu. Bu bileşen fotoğraf varsa gösterir; yüklenemezse
 * (404, silinmiş dosya vb.) React state ile baş harflere geri döner —
 * CSS display:none yaklaşımı boş bir kutu bırakırdı, bu daha güvenilir.
 */
const ParticipantAvatar = ({ photoUrl, fullName, color }: { photoUrl?: string; fullName: string; color: string }) => {
  const [failed, setFailed] = useState(false)
  if (photoUrl && !failed) {
    return (
      <img
        src={photoUrl}
        alt=""
        className="h-12 w-12 rounded-lg object-cover shadow-md"
        onError={() => setFailed(true)}
      />
    )
  }
  return (
    <span
      className="flex h-12 w-12 items-center justify-center rounded-lg text-sm font-bold text-white shadow-md"
      style={{ background: `linear-gradient(135deg, ${color}, ${color}bb)` }}
    >
      {initials(fullName)}
    </span>
  )
}

// Kullanıcı isteği (2026-09-22): T.C. kimlik numaraları listede varsayılan olarak
// maskeli görünsün (KVKK), göz ikonuna tıklandığında o satır için geçici açılsın.
// Arama fonksiyonu etkilenmez çünkü backend aramayı DB'deki tam Tckn üzerinden yapar
// (ParticipantRepository.cs: x.Tckn.Contains(term)) — burada yalnızca görüntü maskeleniyor.
const MaskedTckn = ({ tckn }: { tckn: string }) => {
  const [revealed, setRevealed] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setRevealed((v) => !v) }}
      className="inline-flex items-center gap-1.5 tabular-nums text-[13px] font-medium tracking-wider text-foreground-muted hover:text-foreground-default"
      title={revealed ? 'Gizle' : 'Göster'}
    >
      {revealed ? tckn : maskTC(tckn)}
      {revealed ? <EyeOffIcon className="h-3.5 w-3.5 shrink-0" /> : <EyeIcon className="h-3.5 w-3.5 shrink-0" />}
    </button>
  )
}

export interface ParticipantColumnRenderers {
  renderChildren: (p: Participant) => ReactNode
  renderEvents: (p: Participant) => ReactNode
  renderActivity: (p: Participant) => ReactNode
}

export const buildParticipantColumns = (
  { renderChildren, renderEvents, renderActivity }: ParticipantColumnRenderers,
): DataTableColumn<Participant>[] => [
  {
    key: 'ad', header: 'Ad', sortable: true, sortKey: 'fullName', width: 'w-px whitespace-nowrap',
    cell: (r) => {
      const color = GENDER_COLORS[r.gender] ?? '#2563eb'
      const isMinor = (r.age ?? 99) < 18
      return (
        <div className="flex items-center gap-3.5 py-1">
          <div className="relative shrink-0">
            <ParticipantAvatar photoUrl={r.photoUrl} fullName={r.fullName} color={color} />
            {isMinor && (
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-warning text-white shadow-sm ring-2 ring-white">
                <span className="text-[9px] font-bold leading-none">18-</span>
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-foreground-strong leading-snug">{splitName(r.fullName).firstName}</p>
            <p className="mt-1 flex items-center gap-1 truncate text-[12px] text-foreground-muted">
              <MapPinIcon className="h-3.5 w-3.5 shrink-0 text-foreground-subtle" />
              {[r.district, r.city].filter(Boolean).join(' · ') || r.address || '—'}
            </p>
          </div>
        </div>
      )
    },
  },
  {
    key: 'soyad', header: 'Soyad',
    cell: (r) => (
      <span className="text-[14px] font-semibold text-foreground-strong">{splitName(r.fullName).lastName || '—'}</span>
    ),
  },
  {
    // Kullanıcı isteği (2026-09-22): T.C. kimlik numaraları listede normalde
    // görünmesin (KVKK/gizlilik) ama arama yaptığında bulunabilsin. Arama zaten
    // backend'de tam Tckn üzerinden çalışıyor (ParticipantRepository: Tckn.Contains),
    // burada sadece görünen değer maskeleniyor — tıklayınca geçici olarak açılır.
    key: 'tckn', header: 'T.C. Kimlik', sortable: true, sortKey: 'tckn',
    cell: (r) => <MaskedTckn tckn={r.tckn} />,
  },
  {
    key: 'telefon', header: 'Telefon',
    cell: (r) => (
      r.phone
        ? <span className="inline-flex items-center gap-2 tabular-nums text-[13px] text-foreground-default">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-surface-2">
              <PhoneIcon className="h-3.5 w-3.5 text-foreground-muted" />
            </span>
            {r.phone}
          </span>
        : <span className="text-[13px] text-foreground-subtle">—</span>
    ),
  },
  {
    key: 'yas', header: 'Yaş', align: 'center', sortable: true, sortKey: 'age',
    cell: (r) => {
      if (r.age == null) return <span className="text-[13px] text-foreground-subtle">—</span>
      const { color, bg } = AGE_COLORS(r.age)
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold"
          style={{ color, backgroundColor: bg }}
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {r.age}
        </span>
      )
    },
  },
  {
    key: 'cinsiyet', header: 'Cinsiyet',
    cell: (r) => {
      const color = GENDER_COLORS[r.gender] ?? '#64748b'
      return (
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
          style={{ color, backgroundColor: `${color}15` }}
        >
          <UserIcon className="h-3.5 w-3.5" />
          {GENDER_LABELS[r.gender] ?? r.gender}
        </span>
      )
    },
  },
  {
    key: 'cocuklar', header: 'Çocuklar', align: 'center',
    cell: (r) => renderChildren(r),
  },
  {
    key: 'dogrulama', header: 'Doğrulama', align: 'center',
    cell: (r) => (
      r.isVerified
        ? <span className="inline-flex items-center gap-1.5 rounded-lg bg-info-soft px-3 py-1.5 text-[12px] font-semibold text-info">
            <ShieldCheckIcon className="h-3.5 w-3.5" />
            Doğrulandı
          </span>
        : <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-foreground-muted">
            <ShieldXIcon className="h-3.5 w-3.5" />
            Bekliyor
          </span>
    ),
  },
  {
    key: 'durum', header: 'Durum', sortable: true, sortKey: 'status',
    cell: (r) => {
      const color = STATUS_COLORS[r.status] ?? '#64748b'
      const bg = STATUS_BG[r.status] ?? '#f1f5f9'
      const label = PARTICIPANT_STATUS_LABELS[r.status] ?? r.status
      return (
        <span
          className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold"
          style={{ color, backgroundColor: bg }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
      )
    },
  },
  {
    key: 'etkinlik', header: 'Etkinlik', align: 'center',
    cell: (r) => renderEvents(r),
  },
  {
    key: 'aktivite', header: 'Aktivite', align: 'center',
    cell: (r) => renderActivity(r),
  },
  {
    key: 'kayit', header: 'Kayıt', sortable: true, sortKey: 'registeredAt',
    cell: (r) => (
      <span className="tabular-nums text-[12px] text-foreground-muted">
        {r.registeredAt ? formatDate(r.registeredAt) : '—'}
      </span>
    ),
  },
]
