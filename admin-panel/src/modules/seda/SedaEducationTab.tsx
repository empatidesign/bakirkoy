import { useEffect, useRef, useState } from 'react'
import { GraduationCapIcon, UploadIcon, FileSpreadsheetIcon, CheckCircle2Icon, AlertTriangleIcon, PencilIcon, InfoIcon } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import { Badge, Select, FilterField, IconButton, Button, Modal, Field, Input, Banner, NumberInput, Textarea, DatePicker, ToggleRow, DetailRow } from '@/design-system'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import sedaService from '@/services/seda.service'
import { formatDate, maskTC } from '@/lib/utils'
import type { SedaEducationRecord, SedaEducationImportResult, SedaPeriod } from '@/types/seda.types'
import excelIcon from '@/assets/icons/excel.png'

const YEAR_PATTERN = /^\d{4}-\d{4}$/

type EmptyFormShape = Record<string, never>

// Kullanıcı isteği (2026-08-12): tanımadığımız Excel sütunları detailsJson'a düşüyor —
// bu satırda gösterilecek bir şey var mı diye boş obje ("{}") kontrolü.
const hasExtraDetails = (r: SedaEducationRecord) => {
  try {
    const obj = JSON.parse(r.detailsJson || '{}') as Record<string, string>
    return Object.keys(obj).length > 0
  } catch {
    return false
  }
}

export const SedaEducationTab = () => {
  const { can } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [yearFilter, setYearFilter] = useState('')
  const [periodFilter, setPeriodFilter] = useState('')
  const [matchedFilter, setMatchedFilter] = useState('')
  const [winnerFilter, setWinnerFilter] = useState('')
  const [yearOptions, setYearOptions] = useState<string[]>([])
  const [periodOptions, setPeriodOptions] = useState<SedaPeriod[]>([])
  const [refreshSignal, setRefreshSignal] = useState(0)
  const [exporting, setExporting] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [importYear, setImportYear] = useState('')
  const [importPeriodId, setImportPeriodId] = useState('')
  // Kullanıcı isteği (2026-08-12): "hangi tarihler aralığında alınacak dediğinde zaten başlangıç
  // ve bitiş yılı dönemi verecek bize" — önceden "Dönemler" sekmesine gitmeden doğrudan bir tarih
  // aralığı girerek dönem otomatik bulunsun/oluşturulsun.
  const [useDateRange, setUseDateRange] = useState(false)
  const [importStartDate, setImportStartDate] = useState('')
  const [importEndDate, setImportEndDate] = useState('')
  const [importYearError, setImportYearError] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<SedaEducationImportResult | null>(null)
  const [editingRecord, setEditingRecord] = useState<SedaEducationRecord | null>(null)
  const [editScore, setEditScore] = useState<number | undefined>(undefined)
  const [editNote, setEditNote] = useState('')
  const [savingResult, setSavingResult] = useState(false)
  const [detailRecord, setDetailRecord] = useState<SedaEducationRecord | null>(null)

  const loadYears = () => {
    sedaService.getEducationYears().then((y) => setYearOptions(y ?? [])).catch(() => setYearOptions([]))
  }
  const loadPeriods = () => {
    sedaService.getPeriods({ page: 1, limit: 100, sort: 'startDate', order: 'desc' }).then((r) => setPeriodOptions(r.items ?? [])).catch(() => setPeriodOptions([]))
  }
  useEffect(() => { loadYears(); loadPeriods() }, [])

  const extraParams: Record<string, string> = {}
  if (periodFilter) extraParams.periodId = periodFilter
  else if (yearFilter) extraParams.academicYear = yearFilter
  if (matchedFilter) extraParams.matched = matchedFilter
  if (winnerFilter) extraParams.winner = winnerFilter

  const selectedImportPeriod = periodOptions.find((p) => p.id === importPeriodId)


  const handleExport = async () => {
    if (exporting) return
    setExporting(true)
    try {
      const { blob, fileName } = await sedaService.exportEducationRecordsExcel(extraParams)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Excel dosyası indirildi.')
    } catch {
      toast.error('Excel dosyası indirilemedi. Lütfen tekrar deneyin.')
    } finally {
      setExporting(false)
    }
  }

  const openImport = () => {
    setImportYear('')
    setImportPeriodId('')
    setUseDateRange(false)
    setImportStartDate('')
    setImportEndDate('')
    setImportYearError('')
    setImportFile(null)
    setImportResult(null)
    setImportOpen(true)
  }

  const handleImport = async () => {
    if (importing) return
    const hasDateRange = useDateRange && !!importStartDate && !!importEndDate
    if (!importPeriodId && !hasDateRange && !YEAR_PATTERN.test(importYear.trim())) {
      setImportYearError('Eğitim-öğretim yılı "2025-2026" biçiminde olmalıdır ya da bir dönem/tarih aralığı seçin.')
      return
    }
    if (hasDateRange && importEndDate < importStartDate) {
      setImportYearError('Bitiş tarihi başlangıç tarihinden önce olamaz.')
      return
    }
    if (!importFile) {
      toast.error('Lütfen bir Excel (.xlsx) dosyası seçin.')
      return
    }
    setImporting(true)
    try {
      const result = await sedaService.importEducationRecords(
        importFile,
        selectedImportPeriod?.name ?? importYear.trim(),
        importPeriodId || undefined,
        hasDateRange ? importStartDate : undefined,
        hasDateRange ? importEndDate : undefined,
      )
      setImportResult(result)
      toast.success('Excel dosyası içe aktarıldı.')
      setRefreshSignal((s) => s + 1)
      loadYears()
      loadPeriods()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'İçe aktarma başarısız oldu.')
    } finally {
      setImporting(false)
    }
  }


  const canEditModule = can('seda.edit')

  const openResultEditor = (record: SedaEducationRecord) => {
    setEditingRecord(record)
    setEditScore(record.score ?? undefined)
    setEditNote(record.resultNote ?? '')
  }

  const saveResult = async () => {
    if (!editingRecord || savingResult) return
    setSavingResult(true)
    try {
      await sedaService.updateEducationRecordResult(editingRecord.id, {
        score: editScore ?? null,
        resultNote: editNote.trim() || null,
      })
      toast.success('Sonuç bilgisi güncellendi.')
      setEditingRecord(null)
      setRefreshSignal((s) => s + 1)
    } catch {
      toast.error('Sonuç bilgisi güncellenemedi.')
    } finally {
      setSavingResult(false)
    }
  }

  return (
    <>
      <CrudListTemplate<SedaEducationRecord, EmptyFormShape>
        icon={GraduationCapIcon}
        title="Sınavı Kazananlar"
        subtitle="Sınavı kazanıp SEDA eğitimi alan öğrencilerin yıllara göre listesi"
        resourceName="Kayıt"
        listTitle="Sınavı Kazananlar Listesi"
        searchPlaceholder="TCKN veya ad soyad ara..."
        service={{
          getList: (p) => sedaService.getEducationRecords(p),
          remove: can('seda.delete') ? (id) => sedaService.deleteEducationRecord(id) : undefined,
        }}
        rowKey={(r) => r.id}
        defaultSort={{ key: 'createdAt', dir: 'desc' }}
        refreshSignal={refreshSignal}
        extraParams={extraParams}
        creatable={false}
        canEdit={() => false}
        canDelete={() => can('seda.delete')}
        filterColumns={4}
        hasActiveFilters={!!periodFilter || !!yearFilter || !!matchedFilter || !!winnerFilter}
        onClearFilters={() => { setPeriodFilter(''); setYearFilter(''); setMatchedFilter(''); setWinnerFilter('') }}
        renderFilters={() => (
          <>
            <FilterField label="Dönem">
              <Select value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
                <option value="">Tüm Dönemler</option>
                {periodOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Eğitim Yılı">
              <Select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="">Tüm Yıllar</option>
                {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
            </FilterField>
            <FilterField label="Katılımcı Eşleşmesi">
              <Select value={matchedFilter} onChange={(e) => setMatchedFilter(e.target.value)}>
                <option value="">Tümü</option>
                <option value="true">Eşleşti</option>
                <option value="false">Eşleşmedi</option>
              </Select>
            </FilterField>
            <FilterField label="Kazandı mı">
              <Select value={winnerFilter} onChange={(e) => setWinnerFilter(e.target.value)}>
                <option value="">Tümü</option>
                <option value="true">Kazandı</option>
                <option value="false">Kazanmadı</option>
              </Select>
            </FilterField>
          </>
        )}
        stats={({ total }) => [
          { label: 'Toplam Kayıt', value: total, icon: GraduationCapIcon, accent: 'blue' },
        ]}
        columns={[
          { key: 'tckn', header: 'TCKN', sortable: true, sortKey: 'tckn', cell: (r) => <span className="tabular-nums type-muted">{maskTC(r.tckn)}</span> },
          { key: 'fullName', header: 'Ad Soyad', sortable: true, sortKey: 'fullName', cell: (r) => <span className="type-body-strong">{r.fullName}</span> },
          { key: 'period', header: 'Dönem', align: 'center', cell: (r) => <Badge tone={r.periodId ? 'primary' : 'neutral'}>{r.periodName ?? r.academicYear}</Badge> },
          { key: 'rank', header: 'Sıra', align: 'center', cell: (r) => <span className="type-muted tabular-nums">{r.rank ?? '—'}</span> },
          { key: 'isWinner', header: 'Kazandı mı', align: 'center', cell: (r) => <Badge tone={r.isWinner ? 'success' : 'danger'}>{r.isWinner ? 'Kazandı' : 'Kazanmadı'}</Badge> },
          { key: 'score', header: 'Puan', align: 'center', cell: (r) => <span className="type-body-strong tabular-nums">{r.score ?? '—'}</span> },
          { key: 'resultNote', header: 'Sonuç', cell: (r) => <span className="type-muted">{r.resultNote || '—'}</span> },
          {
            key: 'participant', header: 'Katılımcı',
            cell: (r) => r.participantId
              ? (
                <div className="flex items-center gap-2">
                  <Badge tone="success">Eşleşti</Badge>
                  <span className="type-muted">{r.participantName}</span>
                </div>
              )
              : <Badge tone="neutral">Eşleşmedi</Badge>,
          },
          { key: 'createdAt', header: 'Kayıt Tarihi', sortable: true, sortKey: 'createdAt', cell: (r) => <span className="whitespace-nowrap type-muted">{formatDate(r.createdAt)}</span> },
          {
            key: 'resultAction', header: '', align: 'right',
            cell: (r) => (
              <div className="flex items-center justify-end gap-1">
                {hasExtraDetails(r) && (
                  <IconButton title="Excel'deki tüm ek alanları görüntüle" onClick={() => setDetailRecord(r)}>
                    <InfoIcon className="h-4 w-4" />
                  </IconButton>
                )}
                {canEditModule && (
                  <IconButton title="Puan ve sonuç düzenle" onClick={() => openResultEditor(r)}><PencilIcon className="h-4 w-4" /></IconButton>
                )}
              </div>
            ),
          },
        ]}
        emptyForm={{}}
        toForm={() => ({})}
        renderForm={() => null}
        selectable
        deleteConfirm={{ title: 'Kaydı Sil', description: 'Bu eğitim kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.' }}
        emptyTitle="Kayıt bulunamadı"
        emptyDescription="Excel'den yükleme yaparak sınavı kazananları ekleyebilirsiniz."
        extraHeaderActions={
          <>
            <IconButton
              onClick={handleExport}
              disabled={exporting || !can('seda.export')}
              title={can('seda.export') ? 'Excel İndir' : 'Dışa aktarma yetkiniz yok'}
            >
              <img src={excelIcon} alt="Excel" className="h-6 w-6" />
            </IconButton>
            {canEditModule && (
              <Button variant="primary" onClick={openImport}>
                <UploadIcon className="h-4 w-4" /> Excel'den Yükle
              </Button>
            )}
          </>
        }
      />

      <Modal
        open={importOpen}
        onClose={() => { if (!importing) setImportOpen(false) }}
        title="Excel'den Yükle"
        subtitle="Sınavı kazananlar listesini içe aktarın"
        width={520}
        footer={
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setImportOpen(false)} disabled={importing}>
              {importResult ? 'Kapat' : 'İptal'}
            </Button>
            {!importResult && (
              <Button variant="primary" className="flex-1" onClick={() => void handleImport()} isLoading={importing} disabled={!importFile || (!importPeriodId && !useDateRange && !importYear.trim()) || (useDateRange && (!importStartDate || !importEndDate))}>
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

          <Field label="Dönem">
            <Select
              value={importPeriodId}
              onChange={(e) => {
                setImportPeriodId(e.target.value)
                const period = periodOptions.find((p) => p.id === e.target.value)
                if (period) { setImportYear(period.name); setImportYearError('') }
                if (e.target.value) setUseDateRange(false)
              }}
              disabled={importing || !!importResult || useDateRange}
            >
              <option value="">Serbest yıl ile yükle</option>
              {periodOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>

          {/* Kullanıcı isteği (2026-08-12): "hangi tarihler aralığında alınacak dediğinde zaten
              başlangıç ve bitiş yılı dönemi verecek bize" — önceden "Dönemler" sekmesine gitmeye
              gerek kalmadan doğrudan tarih aralığı girilerek dönem otomatik bulunur/oluşturulur. */}
          <ToggleRow
            label="Tarih aralığından dönem oluştur"
            description="Önceden bir dönem seçmek yerine sadece başlangıç/bitiş tarihi girin, dönem otomatik oluşturulur."
            checked={useDateRange}
            onChange={(v) => { setUseDateRange(v); if (v) { setImportPeriodId(''); setImportYearError('') } }}
            disabled={importing || !!importResult || !!importPeriodId}
          />

          {useDateRange ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Başlangıç Tarihi" required error={importYearError || undefined}>
                <DatePicker value={importStartDate} onChange={setImportStartDate} disabled={importing || !!importResult} clearable />
              </Field>
              <Field label="Bitiş Tarihi" required>
                <DatePicker value={importEndDate} onChange={setImportEndDate} min={importStartDate || undefined} disabled={importing || !!importResult} clearable />
              </Field>
            </div>
          ) : (
            <Field label="Eğitim-Öğretim Yılı" required error={importYearError}>
              <Input
                value={importYear}
                onChange={(e) => {
                  setImportYear(e.target.value)
                  if (importYearError && YEAR_PATTERN.test(e.target.value.trim())) setImportYearError('')
                }}
                placeholder="2025-2026"
                disabled={importing || !!importResult || !!importPeriodId}
              />
            </Field>
          )}

          <Field label="Excel Dosyası (.xlsx)" required>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing || !!importResult}>
                <FileSpreadsheetIcon className="h-4 w-4" /> Dosya Seç
              </Button>
              <span className={importFile ? 'type-body' : 'type-muted'}>
                {importFile ? importFile.name : 'Dosya seçilmedi'}
              </span>
            </div>
          </Field>

          {importResult && (
            <div className="space-y-3">
              <Banner tone="success" variant="soft" icon={CheckCircle2Icon}>
                <div className="space-y-1">
                  <p className="type-body-strong">İçe aktarma tamamlandı.</p>
                  <p>Toplam satır: {importResult.totalRows.toLocaleString('tr-TR')}</p>
                  <p>Eklenen: {importResult.added.toLocaleString('tr-TR')}</p>
                  <p>Güncellenen: {importResult.updated.toLocaleString('tr-TR')}</p>
                  <p>Katılımcı eşleşen: {importResult.matchedParticipants.toLocaleString('tr-TR')}</p>
                  <p>Eşleşmeyen: {importResult.unmatchedCount.toLocaleString('tr-TR')}</p>
                </div>
              </Banner>
              {importResult.invalidRows.length > 0 && (
                <Banner tone="warning" variant="soft" icon={AlertTriangleIcon}>
                  <div className="space-y-1">
                    <p className="type-body-strong">Geçersiz satırlar ({importResult.invalidRows.length})</p>
                    {importResult.invalidRows.slice(0, 10).map((r) => (
                      <p key={r.row}>Satır {r.row}: {r.reason}</p>
                    ))}
                    {importResult.invalidRows.length > 10 && <p>… ve {importResult.invalidRows.length - 10} satır daha</p>}
                  </div>
                </Banner>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!editingRecord}
        onClose={() => { if (!savingResult) setEditingRecord(null) }}
        title="Puan ve Sonuç Düzenle"
        subtitle={editingRecord ? `${editingRecord.fullName} · ${editingRecord.periodName ?? editingRecord.academicYear}` : undefined}
        width={460}
        footer={
          <div className="flex w-full gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditingRecord(null)} disabled={savingResult}>İptal</Button>
            <Button variant="primary" className="flex-1" onClick={() => void saveResult()} isLoading={savingResult}>Kaydet</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Field label="Puan">
            <NumberInput value={editScore ?? 0} onChange={(value: number) => setEditScore(value)} min={0} max={1000} disabled={savingResult} />
          </Field>
          <Field label="Sonuç Notu">
            <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Kazandı, yedek veya açıklama" disabled={savingResult} />
          </Field>
        </div>
      </Modal>

      {/* Kullanıcı isteği (2026-08-12): "kazananlar listesinin detayı görüntülenmesi ... netler
          mi neler olduğu verilen excel dökümanına göre" — tanınmayan (Rank/Phone/Sonuç dışındaki)
          her Excel sütunu burada ham başlık→değer olarak gösterilir. */}
      <Modal
        open={!!detailRecord}
        onClose={() => setDetailRecord(null)}
        title="Kayıt Detayı"
        subtitle={detailRecord ? `${detailRecord.fullName} · ${detailRecord.periodName ?? detailRecord.academicYear}` : undefined}
        width={480}
        footer={<div className="flex justify-end"><Button variant="outline" onClick={() => setDetailRecord(null)}>Kapat</Button></div>}
      >
        <div className="space-y-1 p-1">
          {detailRecord && (() => {
            let extras: Record<string, string> = {}
            try { extras = JSON.parse(detailRecord.detailsJson || '{}') } catch { extras = {} }
            const entries = Object.entries(extras)
            if (entries.length === 0) return <p className="type-muted p-3">Bu kayıt için Excel'de ek bir alan bulunmuyor.</p>
            return entries.map(([key, value]) => <DetailRow key={key} label={key}>{value}</DetailRow>)
          })()}
        </div>
      </Modal>
    </>
  )
}
