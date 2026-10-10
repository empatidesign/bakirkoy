import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  ClipboardListIcon, Building2Icon, XCircleIcon,
  XIcon, CheckCircle2Icon, ClockIcon, UsersIcon, AlertCircleIcon, CalendarRangeIcon,
} from 'lucide-react'
import { SkeletonRows, ConfirmModal } from '@/design-system'
import { isPastDay } from '@/lib/utils'
import type { CitizenFacilityApplication } from '@/types/facility.types'
import { statusTone, statusLabel } from '@/types/applicationStatus'
import facilityService from '@/services/facility.service'
import { FacilityDetailModal } from './FacilityDetailModal'
import { FacilityStaticQrScanButton } from './FacilityStaticQrScanButton'

const BRANCH_COLORS: Record<string, { from: string; to: string; bg: string; text: string }> = {
  'Futsal':      { from: '#3b82f6', to: '#1d4ed8', bg: '#eff6ff', text: '#1d4ed8' },
  'Basketbol':   { from: '#f97316', to: '#c2410c', bg: '#fff7ed', text: '#c2410c' },
  'Voleybol':    { from: '#8b5cf6', to: '#6d28d9', bg: '#f5f3ff', text: '#6d28d9' },
  'Badminton':   { from: '#10b981', to: '#047857', bg: '#ecfdf5', text: '#047857' },
  'Masa Tenisi': { from: '#06b6d4', to: '#0e7490', bg: '#ecfeff', text: '#0e7490' },
  'Yüzme':       { from: '#0ea5e9', to: '#0369a1', bg: '#f0f9ff', text: '#0369a1' },
  'Su Aerobiği': { from: '#38bdf8', to: '#0284c7', bg: '#f0f9ff', text: '#0284c7' },
}
const getBranchColor = (name: string) =>
  BRANCH_COLORS[name] ?? { from: '#6366f1', to: '#4338ca', bg: '#eef2ff', text: '#4338ca' }

const cleanGroupName = (name: string): string =>
  name.replace(/\[[^\]]*\]/g, '').replace(/\b\d+\s*g[üu]n\b/gi, '').replace(/\s{2,}/g, ' ').trim()

function parseScheduleSummary(summary: string): { days: string[]; time: string } {
  if (!summary) return { days: [], time: '' }
  const [daysPart, timePart] = summary.split('·').map((s) => s.trim())
  return { days: daysPart.split(',').map((d) => d.trim()).filter(Boolean), time: timePart ?? '' }
}

interface AppGroup {
  key: string; module: string; groupId: string | null; groupName: string
  moduleLabel: string; branchName: string; instructorName?: string | null
  facilityName?: string | null
  serviceFacilityName?: string | null; serviceFacilityAddress?: string | null
  scheduleSummary: string; periodStart?: string | null; periodEnd?: string | null
  items: CitizenFacilityApplication[]
  /** Kullanıcı isteği (2026-08-29): dönemi (periodEnd) geçmiş bir kayıt Event/Travel
   * sekmelerindeki gibi soluklaştırılıp iptal edilemez hale getiriliyor — listeden hiç
   * kaldırılmıyor (geçmiş kayıt bilgisi kalıcı olarak görülebilir kalmalı). */
  isPast: boolean
}
interface CancelTarget { ids: string[]; title: string }

const isCancelable = (a: CitizenFacilityApplication) => a.canCancel
const getInitials = (name: string) => name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

function statusCfg(tone: string): { color: string; bg: string; Icon: React.ComponentType<{ className?: string }> } {
  if (tone === 'success') return { color: '#16a34a', bg: '#f0fdf4', Icon: CheckCircle2Icon }
  if (tone === 'warning') return { color: '#d97706', bg: '#fffbeb', Icon: ClockIcon }
  if (tone === 'danger')  return { color: '#dc2626', bg: '#fef2f2', Icon: XIcon }
  if (tone === 'info')    return { color: '#2563eb', bg: '#eff6ff', Icon: UsersIcon }
  return { color: '#94a3b8', bg: '#f1f5f9', Icon: AlertCircleIcon }
}

export const FacilityApplicationsTab = () => {
  const [apps, setApps] = useState<CitizenFacilityApplication[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelTarget, setCancelTarget] = useState<CancelTarget | null>(null)
  const [canceling, setCanceling] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [detail, setDetail] = useState<{ module: string; groupId: string; items: CitizenFacilityApplication[] } | null>(null)

  useEffect(() => {
    let active = true; setLoading(true)
    facilityService.applications({ scope: 'family', page: 1, limit: 50 })
      .then((r) => { if (active) setApps(r.items) })
      .catch(() => { if (active) setApps([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [refresh])

  const groups = useMemo<AppGroup[]>(() => {
    if (!apps) return []
    const map = new Map<string, AppGroup>()
    for (const a of apps) {
      const key = a.groupId ?? a.id
      const ex = map.get(key)
      if (ex) ex.items.push(a)
      else map.set(key, {
        key, module: a.module, groupId: a.groupId ?? null,
        groupName: a.groupName, moduleLabel: a.moduleLabel, branchName: a.branchName,
        instructorName: a.instructorName, facilityName: a.facilityName,
        serviceFacilityName: a.serviceFacilityName,
        serviceFacilityAddress: a.serviceFacilityAddress,
        scheduleSummary: a.scheduleSummary, periodStart: a.periodStart, periodEnd: a.periodEnd,
        items: [a],
        isPast: !!(a.periodEnd && isPastDay(a.periodEnd)),
      })
    }
    return [...map.values()]
  }, [apps])

  const runCancel = async () => {
    if (!cancelTarget) return; setCanceling(true)
    let ok = 0
    for (const id of cancelTarget.ids) { try { await facilityService.cancel(id); ok++ } catch { void 0 } }
    if (ok > 0) toast.success(ok === 1 ? 'Kayıt iptal edildi.' : `${ok} kayıt iptal edildi.`)
    setCanceling(false); setCancelTarget(null); setRefresh((n) => n + 1)
  }

  const hasApprovedActive = useMemo(
    () => groups.some((g) => !g.isPast && g.items.some((a) => a.status === 'approved')),
    [groups],
  )

  return (
    <div className="flex flex-col min-h-full bg-gray-50">
      {loading ? (
        <div className="p-4"><SkeletonRows rows={4} /></div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-24 text-center px-6">
          <ClipboardListIcon className="h-8 w-8 text-gray-200" />
          <p className="text-sm text-gray-400">Başvuru bulunamadı</p>
          <p className="text-xs text-gray-300">Programlara başvurduğunuzda burada görünür.</p>
        </div>
      ) : (
        <div className="p-4 space-y-3 pb-8">
          {hasApprovedActive && (
            <FacilityStaticQrScanButton
              label="Tesise Giriş/Çıkış için QR Okut"
              variant="primary"
              onSuccess={() => setRefresh((n) => n + 1)}
            />
          )}
          {groups.map((g) => {
            const cancelable = g.isPast ? [] : g.items.filter(isCancelable)
            const color = getBranchColor(g.branchName)
            const { days, time } = parseScheduleSummary(g.scheduleSummary ?? '')
            const cleanName = cleanGroupName(g.groupName)

            return (
              <div key={g.key} className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden" style={{ opacity: g.isPast ? 0.6 : 1 }}>
                <button
                  type="button"
                  className="w-full text-left p-3 hover:bg-gray-50/60 transition-colors"
                  onClick={() => !g.isPast && g.groupId ? setDetail({ module: g.module, groupId: g.groupId, items: g.items }) : undefined}
                  style={{ cursor: !g.isPast && g.groupId ? 'pointer' : 'default' }}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white text-[13px] font-bold"
                      style={{ background: `linear-gradient(135deg, ${color.from}, ${color.to})` }}>
                      {g.branchName.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: color.bg, color: color.text }}>{g.branchName}</span>
                      </div>
                      <p className="text-[15px] font-bold leading-snug text-gray-900">{cleanName}</p>
                      {(g.facilityName || g.serviceFacilityName) && (
                        <p className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Building2Icon className="h-3 w-3 flex-shrink-0" />{g.facilityName || g.serviceFacilityName}
                        </p>
                      )}
                      {days.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {days.map((d) => (
                            <span key={d} className="inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium"
                              style={{ background: `${color.from}14`, color: color.text }}>{d}</span>
                          ))}
                          {time && <span className="inline-flex items-center gap-1 text-[12px] text-gray-500 tabular-nums ml-0.5"><ClockIcon className="h-3 w-3 text-gray-400" />{time}</span>}
                        </div>
                      )}
                      {(g.periodStart || g.periodEnd) && (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                          <CalendarRangeIcon className="h-3 w-3 flex-shrink-0" />
                          {g.periodStart ? new Date(g.periodStart).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—'}
                          {' – '}
                          {g.periodEnd ? new Date(g.periodEnd).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—'}
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                {g.items.length > 0 && (
                  <div className="mx-3 mb-3 rounded-xl overflow-hidden bg-gray-50">
                    {g.items.map((a, i) => {
                      const displayName = a.isSelf ? 'Ben' : a.personName
                      const canCancel = !g.isPast && isCancelable(a)
                      const sc = statusCfg(statusTone(a.status))
                      const StatusIcon = sc.Icon
                      return (
                        <div key={a.id} className="flex items-center gap-2.5 px-3 py-2.5"
                          style={i > 0 ? { borderTop: '1px solid rgba(0,0,0,0.04)' } : {}}>
                          <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ background: a.isSelf ? color.from : '#8b5cf6' }}>
                            {getInitials(displayName)}
                          </div>
                          <p className="flex-1 text-xs font-medium text-gray-700 truncate">{displayName}</p>
                          <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium"
                            style={{ background: sc.bg, color: sc.color }}>
                            <StatusIcon className="h-3 w-3" />{statusLabel(a.status)}
                          </span>
                          {canCancel && (
                            <button type="button"
                              className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                              onClick={() => setCancelTarget({ ids: [a.id], title: `${displayName} · ${cleanName}` })}>
                              <XIcon className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {cancelable.length >= 2 && (
                  <div className="px-3 pb-3 flex justify-end">
                    <button type="button"
                      className="flex items-center gap-1 text-[11px] font-medium text-red-400 hover:text-red-600 transition-colors"
                      onClick={() => setCancelTarget({ ids: cancelable.map((a) => a.id), title: `${cleanName} · ${cancelable.length} kişi` })}>
                      <XCircleIcon className="h-3.5 w-3.5" /> Tümünü iptal et
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal open={!!cancelTarget} onClose={() => setCancelTarget(null)} onConfirm={runCancel}
        title="Kaydı iptal et"
        description={`${cancelTarget?.title ?? ''} için başvuru iptal edilecek. Emin misiniz?`}
        confirmLabel="İptal Et" tone="danger" loading={canceling} />
      <FacilityDetailModal
        module={detail?.module ?? null} groupId={detail?.groupId ?? null}
        onClose={() => setDetail(null)}
        onApplied={() => { setDetail(null); setRefresh((n) => n + 1) }}
        existingApplications={detail?.items.map((a) => ({ personName: a.personName, status: a.status, isSelf: a.isSelf }))}
        uploadedDocuments={detail?.items.flatMap((a) => a.documents ?? [])}
      />
    </div>
  )
}
