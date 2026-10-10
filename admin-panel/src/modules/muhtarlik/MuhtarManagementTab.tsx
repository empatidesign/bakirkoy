import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  UserPlusIcon, PhoneIcon, MailIcon, CheckCircle2Icon, CircleDashedIcon, CopyIcon, KeyRoundIcon,
  BarChart3Icon, InboxIcon, ClockIcon, FlameIcon, LogInIcon, PencilIcon, PowerIcon, PowerOffIcon,
} from 'lucide-react'
import {
  Modal, Button, Field, Input, Banner, EmptyState, Badge, DataTable, IconButton,
} from '@/design-system'
import type { DataTableColumn } from '@/design-system'
import adminService from '@/services/admin.service'
import muhtarlikService from '@/services/muhtarlik.service'
import { useAuth } from '@/framework/auth/AuthContext'
import { openMuhtarPanelAs } from '@/lib/muhtarBypass'
import type { MuhtarAssignment, ProvisionMuhtarResult, MuhtarNeighborhoodStat } from '@/types/muhtarlik.types'
import { MuhtarNeighborhoodDetailModal } from './MuhtarNeighborhoodDetailModal'

const EMPTY_FORM = { fullName: '', phone: '', email: '' }

interface Row extends MuhtarAssignment {
  stat?: MuhtarNeighborhoodStat
}

export const MuhtarManagementTab = () => {
  const { can } = useAuth()
  const canImpersonate = can('admins.impersonate')
  const canEditAdmins = can('admins.edit')
  const canProvision = can('admins.create')
  const [assignments, setAssignments] = useState<MuhtarAssignment[] | null>(null)
  const [editing, setEditing] = useState<MuhtarAssignment | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [lastResult, setLastResult] = useState<ProvisionMuhtarResult | null>(null)
  const [stats, setStats] = useState<MuhtarNeighborhoodStat[] | null>(null)
  const [detailNeighborhood, setDetailNeighborhood] = useState<string | null>(null)
  const [bypassingId, setBypassingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = useCallback(() => {
    muhtarlikService.getMuhtarAssignments().then(setAssignments).catch(() => setAssignments([]))
    muhtarlikService.getMuhtarDashboard().then((d) => setStats(d.neighborhoodStats)).catch(() => setStats([]))
  }, [])
  useEffect(() => { load() }, [load])

  const openEdit = (a: MuhtarAssignment) => {
    setEditing(a)
    setForm({ fullName: a.fullName ?? '', phone: a.phone ?? '', email: a.email ?? '' })
    setLastResult(null)
  }

  const handleSave = async () => {
    if (!editing || !form.fullName.trim()) return
    setSaving(true)
    try {
      const result = await muhtarlikService.provisionMuhtar(editing.neighborhood, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      })
      setLastResult(result)
      toast.success(result.accountCreated
        ? `${editing.neighborhood} için muhtar hesabı oluşturuldu.`
        : `${editing.neighborhood} muhtar bilgileri güncellendi.`)
      load()
    } catch {
      toast.error('Muhtar hesabı oluşturulamadı.')
    } finally {
      setSaving(false)
    }
  }

  const copyCredentials = () => {
    if (!lastResult) return
    const text = `Kullanıcı Adı: ${lastResult.email}\nGeçici Şifre: ${lastResult.temporaryPassword ?? '(mevcut şifre korunuyor)'}`
    navigator.clipboard.writeText(text).then(() => toast.success('Bilgiler panoya kopyalandı.'))
  }

  const handleBypass = async (row: Row) => {
    if (!row.adminUserId) return
    setBypassingId(row.adminUserId)
    try {
      await openMuhtarPanelAs(row.adminUserId)
    } finally {
      setBypassingId(null)
    }
  }

  const handleToggleActive = async (row: Row) => {
    if (!row.adminUserId) return
    setTogglingId(row.adminUserId)
    try {
      await adminService.toggleStatus(row.adminUserId)
      toast.success(row.isActive ? 'Muhtar hesabı pasife alındı.' : 'Muhtar hesabı aktif edildi.')
      load()
    } catch {
      toast.error('İşlem gerçekleştirilemedi.')
    } finally {
      setTogglingId(null)
    }
  }

  const handleBulkToggle = async (targetActive: boolean) => {
    const targets = rows.filter((r) => r.adminUserId && selected.has(r.neighborhood) && r.isActive !== targetActive)
    if (targets.length === 0) {
      toast.info(targetActive ? 'Seçili hesaplar zaten aktif.' : 'Seçili hesaplar zaten pasif.')
      return
    }
    setBulkBusy(true)
    let ok = 0
    let fail = 0
    for (const r of targets) {
      try {
        await adminService.toggleStatus(r.adminUserId!)
        ok++
      } catch {
        fail++
      }
    }
    setBulkBusy(false)
    setSelected(new Set())
    load()
    if (fail === 0) toast.success(`${ok} muhtar hesabı ${targetActive ? 'aktif edildi' : 'pasife alındı'}.`)
    else toast.error(`${ok} başarılı, ${fail} başarısız oldu.`)
  }

  if (!assignments) {
    return <div className="p-8 text-center type-muted">Yükleniyor…</div>
  }

  const provisionedCount = assignments.filter((a) => a.accountProvisioned).length
  const rows: Row[] = assignments.map((a) => ({ ...a, stat: stats?.find((s) => s.neighborhood === a.neighborhood) }))
  const selectedToggleableCount = rows.filter((r) => r.adminUserId && selected.has(r.neighborhood)).length

  const columns: DataTableColumn<Row>[] = [
    {
      key: 'neighborhood',
      header: 'Mahalle',
      hideable: false,
      cell: (r) => (
        <div className="min-w-0">
          <p className="type-body-strong truncate">{r.neighborhood}</p>
          {r.accountProvisioned ? (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-success">
              <CheckCircle2Icon className="h-3 w-3" /> Hesap Atanmış
            </span>
          ) : (
            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-foreground-subtle">
              <CircleDashedIcon className="h-3 w-3" /> Hesap Atanmamış
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'muhtar',
      header: 'Muhtar',
      cell: (r) => r.accountProvisioned ? (
        <div className="space-y-0.5">
          <p className="type-body truncate">{r.fullName}</p>
          {r.email && (
            <p className="flex items-center gap-1 type-caption text-foreground-subtle">
              <MailIcon className="h-3 w-3 shrink-0" /> <span className="truncate">{r.email}</span>
            </p>
          )}
          {r.phone && (
            <p className="flex items-center gap-1 type-caption text-foreground-subtle">
              <PhoneIcon className="h-3 w-3 shrink-0" /> {r.phone}
            </p>
          )}
        </div>
      ) : <span className="type-muted">—</span>,
    },
    {
      key: 'durum',
      header: 'Durum',
      cell: (r) => r.accountProvisioned && r.adminUserId ? (
        <Badge tone={r.isActive ? 'success' : 'neutral'}>{r.isActive ? 'Aktif' : 'Pasif'}</Badge>
      ) : <span className="type-muted">—</span>,
    },
    {
      key: 'talepler',
      header: 'Talep / Öneri / Şikayet',
      cell: (r) => r.stat && r.stat.total > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone="neutral"><InboxIcon className="h-3 w-3" /> {r.stat.total}</Badge>
          <Badge tone="info">{r.stat.requestCount} talep</Badge>
          <Badge tone="success">{r.stat.suggestionCount} öneri</Badge>
          <Badge tone="danger">{r.stat.complaintCount} şikayet</Badge>
        </div>
      ) : <span className="type-muted">Kayıt yok</span>,
    },
    {
      key: 'cozum',
      header: 'Çözüm',
      cell: (r) => r.stat && r.stat.total > 0 ? (
        <div className="flex flex-wrap items-center gap-1">
          <Badge tone="success"><CheckCircle2Icon className="h-3 w-3" /> {r.stat.resolved} çözüldü</Badge>
          {r.stat.urgent > 0 && <Badge tone="danger"><FlameIcon className="h-3 w-3" /> {r.stat.urgent} acil</Badge>}
          {r.stat.open > 0 && <Badge tone="warning"><ClockIcon className="h-3 w-3" /> {r.stat.open} açık</Badge>}
        </div>
      ) : <span className="type-muted">—</span>,
    },
  ]

  return (
    <div className="space-y-4">
      <Banner tone="info" variant="soft" icon={UserPlusIcon}>
        {provisionedCount} / {assignments.length} mahallede gerçek muhtar hesabı atanmış. Atanmamış mahalleler için
        "Hesap Oluştur"a tıklayarak mahalle adına dayalı kullanıcı adıyla otomatik hesap açabilirsiniz.
      </Banner>

      {rows.length === 0 ? (
        <EmptyState icon={UserPlusIcon} title="Mahalle bulunamadı" />
      ) : (
        <DataTable<Row>
          title="Mahalle / Muhtar Listesi"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.neighborhood}
          showRowNumbers
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          selectionActions={canEditAdmins && selectedToggleableCount > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                isLoading={bulkBusy}
                disabled={bulkBusy}
                iconLeft={<PowerIcon className="h-4 w-4" />}
                onClick={() => handleBulkToggle(true)}
              >
                Toplu Aktif Et
              </Button>
              <Button
                variant="danger"
                size="sm"
                isLoading={bulkBusy}
                disabled={bulkBusy}
                iconLeft={<PowerOffIcon className="h-4 w-4" />}
                onClick={() => handleBulkToggle(false)}
              >
                Toplu Pasife Al
              </Button>
            </div>
          )}
          rowActions={(r) => (
            <>
              {r.stat && r.stat.total > 0 && (
                <IconButton tone="primary" title="Mahalle İstatistiklerini Gör" onClick={() => setDetailNeighborhood(r.neighborhood)}>
                  <BarChart3Icon className="h-4 w-4" />
                </IconButton>
              )}
              <IconButton tone="success" title={r.accountProvisioned ? 'Muhtar Bilgilerini Güncelle' : 'Hesap Oluştur'} onClick={() => openEdit(r)} disabled={!canProvision}>
                <PencilIcon className="h-4 w-4" />
              </IconButton>
              {r.accountProvisioned && r.adminUserId && (
                <>
                  {canImpersonate && (
                    <IconButton
                      tone="primary"
                      title="Muhtar panelini bu hesapla aç (bypass)"
                      disabled={bypassingId === r.adminUserId}
                      onClick={() => handleBypass(r)}
                    >
                      <LogInIcon className="h-4 w-4" />
                    </IconButton>
                  )}
                  {canEditAdmins && (
                    <IconButton
                      tone={r.isActive ? 'danger' : 'success'}
                      title={r.isActive ? 'Hesabı Pasife Al' : 'Hesabı Aktif Et'}
                      disabled={togglingId === r.adminUserId}
                      onClick={() => handleToggleActive(r)}
                    >
                      {r.isActive ? <PowerOffIcon className="h-4 w-4" /> : <PowerIcon className="h-4 w-4" />}
                    </IconButton>
                  )}
                </>
              )}
            </>
          )}
          empty={<EmptyState icon={UserPlusIcon} title="Mahalle bulunamadı" />}
        />
      )}

      <Modal
        open={!!editing}
        onClose={() => { setEditing(null); setLastResult(null) }}
        title={editing?.accountProvisioned ? 'Muhtar Bilgilerini Güncelle' : 'Muhtar Hesabı Oluştur'}
        subtitle={editing?.neighborhood}
        width={440}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setEditing(null); setLastResult(null) }}>Kapat</Button>
            {!lastResult && (
              <Button variant="primary" isLoading={saving} disabled={saving || !form.fullName.trim()} onClick={handleSave}>
                {editing?.accountProvisioned ? 'Güncelle' : 'Hesap Oluştur'}
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4 p-4">
          {!lastResult ? (
            <>
              <Banner tone="neutral" variant="soft">
                {editing?.accountProvisioned
                  ? 'Bu mahalle için zaten bir muhtar hesabı var. Bilgileri güncelleyebilirsiniz; e-posta/kullanıcı adı değişmez.'
                  : 'Kullanıcı adı mahalle adından otomatik üretilir (örn. muhtar.cevizlik@bakirkoy.bel.tr). Güçlü, rastgele bir geçici şifre otomatik oluşturulur; ilk girişte değiştirilmesi zorunludur.'}
              </Banner>
              <Field label="Ad Soyad">
                <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Muhtarın adı soyadı" />
              </Field>
              <Field label="Telefon" hint="SMS ile şifre iletimi için (opsiyonel).">
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="05XX XXX XX XX" />
              </Field>
              {!editing?.accountProvisioned && (
                <Field label="E-posta (opsiyonel)" hint="Boş bırakılırsa mahalle adından otomatik üretilir.">
                  <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="muhtar.cevizlik@bakirkoy.bel.tr" />
                </Field>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <Banner tone="success" variant="soft" icon={CheckCircle2Icon}>
                {lastResult.accountCreated ? 'Hesap oluşturuldu.' : 'Bilgiler güncellendi.'}
              </Banner>
              <div className="space-y-2 rounded-card border border-border bg-surface-1 p-3.5">
                <div className="flex items-center gap-2">
                  <MailIcon className="h-4 w-4 text-foreground-subtle" />
                  <span className="type-body-strong">{lastResult.email}</span>
                </div>
                {lastResult.temporaryPassword && (
                  <div className="flex items-center gap-2">
                    <KeyRoundIcon className="h-4 w-4 text-foreground-subtle" />
                    <span className="type-body-strong tabular-nums">{lastResult.temporaryPassword}</span>
                  </div>
                )}
              </div>
              {lastResult.temporaryPassword && (
                <Button variant="outline" className="w-full" onClick={copyCredentials}>
                  <CopyIcon className="h-4 w-4" /> Bilgileri Kopyala
                </Button>
              )}
              <p className="type-caption text-foreground-subtle">
                Bu bilgileri muhtara güvenli bir kanaldan iletin. İlk girişte şifre değişikliği zorunludur.
              </p>
            </div>
          )}
        </div>
      </Modal>

      <MuhtarNeighborhoodDetailModal
        neighborhood={detailNeighborhood}
        onClose={() => setDetailNeighborhood(null)}
      />
    </div>
  )
}
