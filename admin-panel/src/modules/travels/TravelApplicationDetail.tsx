import {
  FileTextIcon, CalendarIcon, MapPinIcon, UserIcon, PhoneIcon, MailIcon,
  UsersIcon, ArmchairIcon, BusIcon, UserPlusIcon, XCircleIcon,
} from 'lucide-react'
import { Banner } from '@/design-system'
import type { TravelApplication } from '@/types/travel.types'
import { applicationStatusMeta, documentStatusMeta } from './travelFormDefaults'
import { maskTC } from '@/lib/utils'

const fmtDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('tr-TR') : '—')

export const TravelApplicationDetail = ({ app }: { app: TravelApplication }) => {
  const status = applicationStatusMeta(app.status)
  const doc = documentStatusMeta(app.documentStatus)
  const genderLabel = app.gender === 'female' ? 'Kadın' : app.gender === 'male' ? 'Erkek' : 'Karma'

  return (
    <div className="flex flex-col">
      <div className="relative overflow-hidden ds-hero">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #fff, transparent)' }} />
        <div className="absolute bottom-0 left-8 h-16 w-16 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, #a78bfa, transparent)' }} />
        <div className="relative flex items-center gap-4 px-6 py-5">
          <span
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white shadow-lg"
            style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.35)' }}
          >
            {app.participantName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-white">{app.participantName}</p>
            <p className="mt-0.5 text-[12px] text-white/70">{maskTC(app.tckn)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                {status.label}
              </span>
              {/* TODO: Ödeme alanları geçici gizlendi (2026-08-05, kullanıcı isteği) — geri açılacaksa bu bloğu aç
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                Ödeme: {payment.label}
              </span>
              */}
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">
                Evrak: {doc.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {app.status === 'rejected' && app.rejectionReason && (
          <Banner tone="danger" variant="soft" icon={XCircleIcon}>Red gerekçesi: {app.rejectionReason}</Banner>
        )}
        <div className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-sm">
          <div className="border-b border-border bg-surface-1 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <FileTextIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground-strong">Başvuru Bilgileri</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--warning-soft))]">
                <FileTextIcon className="h-3.5 w-3.5 text-[hsl(var(--warning))]" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">Başvuru No</p>
                <p className="text-sm font-semibold text-foreground-default">#{app.id}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef3f8]">
                <CalendarIcon className="h-3.5 w-3.5 text-[#0f4c81]" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">Başvuru Tarihi</p>
                <p className="text-sm font-semibold text-foreground-default">{fmtDateTime(app.applicationDate)}</p>
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                <MapPinIcon className="h-3.5 w-3.5 text-orange-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">Gezi</p>
                <p className="text-sm font-semibold text-foreground-default">{app.travelName}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-sm">
          <div className="border-b border-border bg-surface-1 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <UserIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground-strong">Katılımcı Bilgileri</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <UserIcon className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">Ad Soyad</p>
                <p className="text-sm font-semibold text-foreground-default">{app.participantName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                <FileTextIcon className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">T.C. Kimlik No</p>
                <p className="text-sm font-semibold tabular-nums text-foreground-default">{maskTC(app.tckn)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50">
                <PhoneIcon className="h-3.5 w-3.5 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">Telefon</p>
                <p className="text-sm font-semibold tabular-nums text-foreground-default">{app.phone || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef3f8]">
                <MailIcon className="h-3.5 w-3.5 text-[#0f4c81]" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">E-posta</p>
                <p className="text-sm font-semibold text-foreground-default">{app.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1f7e8]">
                <UsersIcon className="h-3.5 w-3.5 text-[#5a8a2a]" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">Cinsiyet</p>
                <p className="text-sm font-semibold text-foreground-default">{genderLabel}</p>
              </div>
            </div>
          </div>
        </div>

        {app.isGuest && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-sm">
            <div className="border-b border-border bg-surface-1 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <UserPlusIcon className="h-3.5 w-3.5 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground-strong">Başvuruyu Yapan</p>
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-y divide-border">
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                  <UserIcon className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">Ad Soyad</p>
                  <p className="text-sm font-semibold text-foreground-default">{app.applicantName || '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                  <FileTextIcon className="h-3.5 w-3.5 text-slate-600" />
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">T.C. Kimlik No</p>
                  <p className="text-sm font-semibold tabular-nums text-foreground-default">{app.applicantTckn || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-sm">
          <div className="border-b border-border bg-surface-1 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <BusIcon className="h-3.5 w-3.5 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground-strong">Araç & Koltuk</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-y divide-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-yellow-50">
                <BusIcon className="h-3.5 w-3.5 text-yellow-600" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">Araç</p>
                <p className="text-sm font-semibold text-foreground-default">{app.busName ?? 'Atanmadı'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef3f8]">
                <ArmchairIcon className="h-3.5 w-3.5 text-[#0f4c81]" />
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-foreground-subtle">Koltuk No</p>
                <p className="text-sm font-semibold text-foreground-default">{app.seatNumber ? `#${app.seatNumber}` : 'Atanmadı'}</p>
              </div>
            </div>
          </div>
        </div>

        {app.notes && (
          <div className="overflow-hidden rounded-lg border border-border bg-surface-1 shadow-sm">
            <div className="border-b border-border bg-surface-1 px-4 py-3">
              <p className="text-sm font-semibold text-foreground-strong">Notlar</p>
            </div>
            <div className="p-4">
              <p className="type-body whitespace-pre-wrap text-foreground-default">{app.notes}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
