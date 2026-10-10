import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Building2Icon, ClockIcon, CheckCircle2Icon, CircleSlashIcon, EyeIcon, XCircleIcon,
  UploadIcon, FileSpreadsheetIcon, AlertTriangleIcon, KeyRoundIcon, MessageSquareIcon,
  LockIcon, LockOpenIcon, Undo2Icon,
} from 'lucide-react'
import { useAuth } from '@/framework/auth/AuthContext'
import { toast } from 'sonner'
import {
  Select, Combobox, FilterField, IconButton, ConfirmModal, Modal, Textarea, Button, AdminFormShell, CredentialDeliveryCard,
  Field, Banner, FormSection,
} from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import companyService from '@/services/company.service'
import serviceCategoryService from '@/services/serviceCategory.service'
import type { Company, CompanySummary, CompanyDeliveryChannel, CompanyImportResult } from '@/types/company.types'
import { COMPANY_STATUS_OPTIONS } from '@/types/company.types'
import type { ServiceCategoryRef } from '@/types/serviceCategory.types'
import { buildCompanyColumns } from './companyColumns'
import { CompanyFormSections } from './CompanyFormSections'
import { CompanyPasswordSection } from './CompanyPasswordSection'
import { CompanyDetailModal } from './CompanyDetailModal'
import { CompanySendMessageModal } from './CompanySendMessageModal'
import { emptyCompanyForm, toCompanyForm, toCompanyInput, getCompanyFormErrors, type CompanyForm } from './companyForm'


export const CompaniesTab = () => {
  const { can } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sortFilter, setSortFilter] = useState('')
  const [categoryOptions, setCategoryOptions] = useState<ServiceCategoryRef[]>([])
  const [summary, setSummary] = useState<CompanySummary | null>(null)
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [detailCompany, setDetailCompany] = useState<Company | null>(null)
  const [approveRow, setApproveRow] = useState<Company | null>(null)
  const [rejectRow, setRejectRow] = useState<Company | null>(null)
  const [revertRow, setRevertRow] = useState<Company | null>(null)
  const [messageIds, setMessageIds] = useState<string[] | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [working, setWorking] = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<CompanyImportResult | null>(null)


  const fetchSummary = useCallback(async () => {
    try { setSummary(await companyService.getSummary(statusFilter ? { status: statusFilter } : {})) }
    catch { setSummary(null) }
  }, [statusFilter])
  useEffect(() => { fetchSummary() }, [fetchSummary])

  useEffect(() => {
    let active = true
    serviceCategoryService.getOptions()
      .then((o) => { if (active) setCategoryOptions(o) })
      .catch(() => { if (active) setCategoryOptions([]) })
    return () => { active = false }
  }, [])

  const refreshAll = () => { setRefreshSignal((s) => s + 1); fetchSummary() }

  const [sortKey, sortDir] = sortFilter ? sortFilter.split('-') as [string, string] : ['', '']
  const sortParams: Record<string, string> = sortFilter ? { sort: sortKey, order: sortDir } : {}

  const [unlockingId, setUnlockingId] = useState<string | null>(null)
  const unlockCompany = async (row: Company) => {
    setUnlockingId(row.id)
    try {
      await companyService.unlock(row.id)
      toast.success(`${row.name} firmasının hesap kilidi kaldırıldı.`)
      refreshAll()
    } finally {
      setUnlockingId(null)
    }
  }

  const doApprove = async () => {
    if (!approveRow) return
    setWorking(true)
    try {
      await companyService.approve(approveRow.id)
      toast.success('Firma onaylandı.')
      setApproveRow(null); refreshAll()
    } finally { setWorking(false) }
  }

  const doReject = async () => {
    if (!rejectRow) return
    setWorking(true)
    try {
      await companyService.reject(rejectRow.id, rejectReason.trim() || undefined)
      toast.success('Firma reddedildi.')
      setRejectRow(null); setRejectReason(''); refreshAll()
    } finally { setWorking(false) }
  }

  const doRevert = async () => {
    if (!revertRow) return
    setWorking(true)
    try {
      await companyService.revertApproval(revertRow.id)
      toast.success('Firma onayı geri alındı. Firma yeniden onay bekliyor.')
      setRevertRow(null); refreshAll()
    } finally { setWorking(false) }
  }

  const sendCreate = async (form: CompanyForm, channel: CompanyDeliveryChannel, close: () => void) => {
    const errs = getCompanyFormErrors(form)
    if (errs.length) { toast.error(errs[0]); return }
    await companyService.create({ ...toCompanyInput(form), deliveryChannel: channel })
    toast.success(`Firma oluşturuldu. Giriş şifresi ${channel === 'Email' ? 'e-posta' : 'SMS'} ile gönderildi.`)
    close(); refreshAll()
  }

  const openImport = () => {
    setImportFile(null)
    setImportResult(null)
    setImportOpen(true)
  }

  const handleImport = async () => {
    if (!importFile) { toast.error('Lütfen bir Excel (.xlsx) dosyası seçin.'); return }
    setImporting(true)
    try {
      const result = await companyService.import(importFile)
      setImportResult(result)
      if (result.added > 0) toast.success(`${result.added} firma eklendi.`)
      else toast.info('Yeni firma eklenmedi (tümü mükerrer veya hatalı).')
      refreshAll()
    } catch {
      toast.error('İçe aktarma başarısız oldu.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <CrudListTemplate<Company, CompanyForm>
        icon={Building2Icon}
        title="Firmalar"
        subtitle="Anlaşmalı firmaları kaydedin, onaylayın ve yönetin"
        resourceName="Firma"
        service={{
          getList: (p) => companyService.getList(p),
          remove: can('companies.delete') ? (id) => companyService.delete(id) : undefined,
          toggleStatus: can('companies.edit') ? (id) => companyService.toggleStatus(id) : undefined,
        }}
        rowKey={(r) => r.id}
        columns={buildCompanyColumns((row) => setDetailCompany(row))}
        defaultSort={{ key: 'createdAt', dir: 'desc' }}
        searchPlaceholder="Firma adı, e-posta, telefon, vergi no ara..."
        selectable
        bulkActions={(rows) => can('companies.edit') ? (
          <Button variant="outline" size="sm" iconLeft={<MessageSquareIcon className="h-4 w-4" />} onClick={() => setMessageIds(rows.map((row) => row.id))}>
            Şablonlu Mesaj Gönder
          </Button>
        ) : null}
        drawerWidth={640}
        refreshSignal={refreshSignal}
        onMutated={fetchSummary}
        extraHeaderActions={can('companies.create') && (
          <Button variant="outline" onClick={openImport}>
            <UploadIcon className="h-4 w-4" /> Excel'den Yükle
          </Button>
        )}
        filterColumns={3}
        extraParams={{ status: statusFilter, serviceCategoryId: categoryFilter, ...sortParams }}
        hasActiveFilters={!!statusFilter || !!categoryFilter || !!sortFilter}
        filterCount={(statusFilter ? 1 : 0) + (categoryFilter ? 1 : 0) + (sortFilter ? 1 : 0)}
        onClearFilters={() => { setStatusFilter(''); setCategoryFilter(''); setSortFilter('') }}
        renderFilters={() => (
          <>
            <FilterField label="Durum">
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tüm Durumlar</option>
                {COMPANY_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Hizmet Kategorisi">
              <Combobox
                value={categoryFilter}
                displayValue={categoryOptions.find((o) => o.id === categoryFilter)?.name}
                options={categoryOptions.map((o) => ({ value: o.id, label: o.name }))}
                onChange={(v) => setCategoryFilter(v)}
                clearable
                placeholder="Tüm Kategoriler"
                emptyText="Kategori bulunamadı"
              />
            </FilterField>
            <FilterField label="Sıralama">
              <Select value={sortFilter} onChange={(e) => setSortFilter(e.target.value)}>
                <option value="">Kayıt Tarihine Göre (Yeni)</option>
                <option value="name-asc">Alfabetik Sıra (A-Z)</option>
                <option value="name-desc">Alfabetik Sıra (Z-A)</option>
                <option value="category-asc">Sektöre Göre</option>
                <option value="createdat-asc">Kayıt Tarihine Göre (Eski)</option>
              </Select>
            </FilterField>
          </>
        )}
        stats={({ total }) => [
          { label: 'Toplam Firma', value: summary?.total ?? total, icon: Building2Icon, accent: 'blue' },
          { label: 'Beklemede', value: summary?.pending ?? 0, icon: ClockIcon, accent: 'orange' },
          { label: 'Onaylı', value: summary?.approved ?? 0, icon: CheckCircle2Icon, accent: 'green' },
          { label: 'Pasif', value: summary?.passive ?? 0, icon: CircleSlashIcon, accent: 'violet' },
        ]}
        emptyForm={emptyCompanyForm}
        toForm={toCompanyForm}
        getFormErrors={getCompanyFormErrors}
        isActive={(r) => r.status === 'Approved'}
        canToggle={(r) => r.status === 'Approved' || r.status === 'Passive'}
        deleteConfirm={{ title: 'Firmayı Sil', description: 'Bu firma, hizmetleri ve kampanyalarıyla birlikte silinecek. Bu işlem geri alınamaz. Devam edilsin mi?' }}
        toggleConfirm={(row, willActivate) => willActivate
          ? { title: 'Firmayı Aktif Et', description: `"${row.name}" aktif edilecek.` }
          : { title: 'Firmayı Pasife Al', description: `"${row.name}" pasife alınacak; kampanyaları yeni kullanıma kapanır. Devam edilsin mi?` }}
        creatable={can('companies.create')}
        canEdit={() => can('companies.edit')}
        canDelete={() => can('companies.delete')}
        onCreate={can('companies.create') ? async (f) => { await companyService.create(toCompanyInput(f)); toast.success('Firma kaydı oluşturuldu.') } : undefined}
        onUpdate={can('companies.edit') ? async (id, f) => { await companyService.update(id, toCompanyInput(f)); toast.success('Değişiklikler kaydedildi.') } : undefined}
        formShell
        renderFormFooter={({ mode, saving, submit, close }) =>
          mode === 'edit' ? (
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={close}>İptal</Button>
              <Button variant="primary" className="flex-1" isLoading={saving} onClick={submit}>Güncelle</Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full" onClick={close}>İptal</Button>
          )
        }
        renderForm={({ form, setForm, mode, editingRow, close }) => (
          <AdminFormShell
            icon={Building2Icon}
            title={mode === 'edit' ? 'Firma Düzenle' : 'Yeni Firma Ekle'}
            subtitle="Firma profili, iletişim, görsel ve kategori bilgilerini yönetin"
            badge={editingRow?.status ?? 'Firma'}
            tone="blue"
          >
            <CompanyFormSections form={form} setForm={setForm} />
            {mode === 'create' && (
              <CredentialDeliveryCard
                title="Giriş Şifresi Gönderimi"
                description="Firma için güçlü bir geçici şifre üretilir ve seçilen kanaldan iletilir; firma ilk girişte değiştirmek zorundadır."
                onSend={(channel) => sendCreate(form, channel as CompanyDeliveryChannel, close)}
                emailDisabled={!form.email.trim()}
                emailDisabledHint="Bu firmanın e-posta adresi girilmediği için şifre yalnızca SMS ile gönderilebilir."
              />
            )}
            {mode === 'edit' && (
              <FormSection
                variant="card"
                icon={KeyRoundIcon}
                title="Şifre İşlemleri"
                subtitle="Geçici şifre gönder veya elle şifre belirle"
              >
                <CompanyPasswordSection companyId={editingRow?.id} />
              </FormSection>
            )}
          </AdminFormShell>
        )}
        collapseRowActions
        extraRowActions={(row) => (
          <>
            <IconButton tone="primary" title="Detay" onClick={() => setDetailCompany(row)}>
              <EyeIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="success" title="Onayla" disabled={row.status !== 'Pending'} onClick={() => setApproveRow(row)}>
              <CheckCircle2Icon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="danger" title="Reddet" disabled={row.status !== 'Pending'} onClick={() => setRejectRow(row)}>
              <XCircleIcon className="h-4 w-4" />
            </IconButton>
            <IconButton tone="default" title="Onayı Geri Al" disabled={row.status !== 'Approved'} onClick={() => setRevertRow(row)}>
              <Undo2Icon className="h-4 w-4" />
            </IconButton>
            <IconButton
              tone={row.isLocked ? 'danger' : 'default'}
              title={row.isLocked
                ? `Hesap kilitli${row.lockedUntil ? ` (${new Date(row.lockedUntil).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla otomatik açılır)` : ''} — kaldırmak için tıklayın`
                : 'Hesap kilitli değil'}
              disabled={!row.isLocked || unlockingId === row.id}
              onClick={() => void unlockCompany(row)}
            >
              {row.isLocked ? <LockIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />}
            </IconButton>
          </>
        )}
      />

      <CompanyDetailModal company={detailCompany} onClose={() => setDetailCompany(null)} onMutated={refreshAll} />
      <CompanySendMessageModal open={!!messageIds} ids={messageIds ?? []} onClose={() => setMessageIds(null)} />

      <ConfirmModal
        open={!!approveRow}
        onClose={() => setApproveRow(null)}
        onConfirm={doApprove}
        icon={CheckCircle2Icon}
        tone="primary"
        title="Firmayı Onayla"
        description={approveRow ? `"${approveRow.name}" onaylanacak ve firma paneline erişebilecek. Devam edilsin mi?` : ''}
        confirmLabel="Onayla"
        loading={working}
      />

      <ConfirmModal
        open={!!revertRow}
        onClose={() => setRevertRow(null)}
        onConfirm={doRevert}
        icon={Undo2Icon}
        tone="danger"
        title="Onayı Geri Al"
        description={revertRow ? `"${revertRow.name}" onaysıza (beklemeye) çekilecek. Firma paneline erişimi kesilecek ve yeniden onay bekleyecek. Devam edilsin mi?` : ''}
        confirmLabel="Onayı Geri Al"
        loading={working}
      />

      <Modal
        open={!!rejectRow}
        onClose={() => { setRejectRow(null); setRejectReason('') }}
        title="Firmayı Reddet"
        subtitle={rejectRow ? rejectRow.name : undefined}
        width={460}
        bodyClassName="px-6 py-5"
        footer={
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => { setRejectRow(null); setRejectReason('') }}>Vazgeç</Button>
            <Button variant="danger" className="flex-1" isLoading={working} disabled={working} onClick={doReject}>Reddet</Button>
          </div>
        }
      >
        <Textarea
          rows={3}
          placeholder="Red sebebi (opsiyonel) — firmaya iletilebilir"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => { if (!importing) setImportOpen(false) }}
        title="Excel'den Yükle"
        subtitle="Firma listesini toplu olarak içe aktarın"
        width={560}
        footer={
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setImportOpen(false)} disabled={importing}>
              {importResult ? 'Kapat' : 'İptal'}
            </Button>
            {!importResult && (
              <Button variant="primary" className="flex-1" onClick={() => void handleImport()} isLoading={importing} disabled={!importFile}>
                Yükle
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) setImportFile(file)
              e.target.value = ''
            }}
          />

          <Field label="Excel Dosyası (.xlsx)" required hint='"Firma Adı", "Vergi Numarası", "Telefon", "Adres" sütunlarını içermelidir.'>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing || !!importResult}>
                <FileSpreadsheetIcon className="h-4 w-4" /> Dosya Seç
              </Button>
              <span className={importFile ? 'type-body' : 'type-muted'}>
                {importFile ? importFile.name : 'Dosya seçilmedi'}
              </span>
            </div>
          </Field>

          {!importResult && (
            <Banner tone="info" variant="soft">
              Eklenen firmalar hizmet kategorisine göre otomatik sınıflandırılır ve
              onay bekleyen (Beklemede) durumda oluşturulur. Mükerrer vergi
              numarası/telefon içeren satırlar atlanır.
            </Banner>
          )}

          {importResult && (
            <div className="space-y-3">
              <Banner tone="success" variant="soft" icon={CheckCircle2Icon}>
                <div className="space-y-1">
                  <p className="type-body-strong">İçe aktarma tamamlandı.</p>
                  <p>Toplam satır: {importResult.totalRows.toLocaleString('tr-TR')}</p>
                  <p>Eklenen: {importResult.added.toLocaleString('tr-TR')}</p>
                  <p>Atlanan (mükerrer): {importResult.skipped.toLocaleString('tr-TR')}</p>
                  <p>Hatalı satır: {importResult.failedRows.toLocaleString('tr-TR')}</p>
                </div>
              </Banner>
              {importResult.rows.filter((r) => r.outcome !== 'Eklendi').length > 0 && (
                <Banner tone="warning" variant="soft" icon={AlertTriangleIcon}>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    <p className="type-body-strong">Atlanan / hatalı satırlar</p>
                    {importResult.rows.filter((r) => r.outcome !== 'Eklendi').slice(0, 50).map((r) => (
                      <p key={r.row}>Satır {r.row} — {r.name}: {r.reason}</p>
                    ))}
                    {importResult.rows.filter((r) => r.outcome !== 'Eklendi').length > 50 && (
                      <p>… ve {importResult.rows.filter((r) => r.outcome !== 'Eklendi').length - 50} satır daha</p>
                    )}
                  </div>
                </Banner>
              )}
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
