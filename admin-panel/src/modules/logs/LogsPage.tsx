import { useEffect, useState } from 'react'
import { ScrollTextIcon, ActivityIcon, UserIcon, ClockIcon, MessageSquareIcon } from 'lucide-react'
import { Badge, FilterField, Select, DateRangeSelect, SegmentedControl, SkeletonRows, type DateRangeValue, type DataTableColumn } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'
import { CrudListTemplate } from '@/templates/CrudListTemplate'
import auditService from '@/services/audit.service'
import type { AuditLogItem, AuditLogDetail, AuditLogFilterOptions } from '@/types/audit.types'
import { auditActionLabel, auditActionTone, auditResultLabel, auditResultTone } from '@/types/audit.types'
import { SmsAuditTab } from './SmsAuditTab'

const fmtDateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'

const prettyJson = (raw?: string | null): string => {
  if (!raw) return ''
  try { return JSON.stringify(JSON.parse(raw), null, 2) } catch { return raw }
}

const JsonBlock = ({ title, raw, tone }: { title: string; raw?: string | null; tone: 'danger' | 'success' }) => {
  const text = prettyJson(raw)
  if (!text) return null
  return (
    <div className="flex-1 min-w-0">
      <p className={`type-caption mb-1 font-semibold ${tone === 'danger' ? 'text-danger' : 'text-success'}`}>{title}</p>
      <pre className="max-h-72 overflow-auto rounded-card border border-border bg-surface-2 p-3 text-[hsl(var(--foreground-default))]" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
        {text}
      </pre>
    </div>
  )
}

const Meta = ({ label, value }: { label: string; value?: string | number | null }) =>
  value === null || value === undefined || value === '' ? null : (
    <div className="flex gap-2">
      <span className="type-caption w-32 flex-shrink-0 text-foreground-subtle">{label}</span>
      <span className="type-body break-all">{value}</span>
    </div>
  )

const AuditLogDetailView = ({ id }: { id: string }) => {
  const [detail, setDetail] = useState<AuditLogDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    auditService.getById(id)
      .then((d) => { if (active) setDetail(d) })
      .catch(() => { if (active) setDetail(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  if (loading) return <div className="p-5"><SkeletonRows rows={6} /></div>
  if (!detail) return <p className="p-5 type-muted">Log kaydı yüklenemedi.</p>

  return (
    <div className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={auditActionTone(detail.action)}>{auditActionLabel(detail.action)}</Badge>
        <Badge tone={auditResultTone(detail.result)}>{auditResultLabel(detail.result)}</Badge>
        {detail.module && <Badge tone="neutral">{detail.module}</Badge>}
        <span className="type-body-strong">{detail.entityType}</span>
      </div>

      {detail.description && <p className="type-body">{detail.description}</p>}

      <div className="space-y-1.5 rounded-card border border-border bg-surface-1 p-4">
        <Meta label="Kullanıcı" value={detail.userName ?? 'Sistem'} />
        <Meta label="Rol" value={detail.userRole} />
        <Meta label="Tarih" value={fmtDateTime(detail.createdAt)} />
        <Meta label="IP Adresi" value={detail.ipAddress} />
        <Meta label="Kayıt Türü / ID" value={detail.entityId ? `${detail.entityType} · ${detail.entityId}` : detail.entityType} />
        <Meta label="Süre (ms)" value={detail.durationMs} />
        <Meta label="Tarayıcı" value={detail.userAgent} />
      </div>

      {detail.errorMessage && (
        <div className="rounded-card border border-danger/30 bg-danger-soft p-3">
          <p className="type-caption font-semibold text-danger">Hata</p>
          <p className="type-body break-all">{detail.errorMessage}</p>
        </div>
      )}

      {(prettyJson(detail.oldValues) || prettyJson(detail.newValues)) && (
        <div className="flex flex-col gap-4 lg:flex-row">
          <JsonBlock title="Eski Değerler" raw={detail.oldValues} tone="danger" />
          <JsonBlock title="Yeni Değerler" raw={detail.newValues} tone="success" />
        </div>
      )}

      {prettyJson(detail.additionalDataJson) && (
        <div>
          <p className="type-caption mb-1 font-semibold text-foreground-subtle">Ek Bilgi</p>
          <pre className="max-h-56 overflow-auto rounded-card border border-border bg-surface-2 p-3" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>{prettyJson(detail.additionalDataJson)}</pre>
        </div>
      )}
    </div>
  )
}

const columns: DataTableColumn<AuditLogItem>[] = [
  { key: 'createdAt', header: 'Tarih', sortable: true, sortKey: 'createdAt', cell: (r) => (
    <span className="inline-flex items-center gap-1.5 text-foreground-muted">
      <ClockIcon className="h-3.5 w-3.5 flex-shrink-0" />
      {fmtDateTime(r.createdAt)}
    </span>
  ) },
  { key: 'actor', header: 'Kullanıcı', sortable: true, sortKey: 'userName', cell: (r) => (
    <div className="min-w-0">
      <p className="type-body-strong truncate">{r.userName ?? 'Sistem'}</p>
      {r.userRole && <p className="type-caption truncate">{r.userRole}</p>}
    </div>
  ) },
  { key: 'action', header: 'İşlem', sortable: true, sortKey: 'action', cell: (r) => <Badge tone={auditActionTone(r.action)}>{auditActionLabel(r.action)}</Badge> },
  { key: 'module', header: 'Modül', sortable: true, sortKey: 'module', cell: (r) => <span className="text-foreground-muted">{r.module ?? '—'}</span> },
  { key: 'entityType', header: 'Kayıt Türü', cell: (r) => <span className="text-foreground-muted">{r.entityType}</span> },
  { key: 'description', header: 'Açıklama', cell: (r) => <span className="type-body-strong">{r.description ?? '—'}</span> },
  { key: 'result', header: 'Sonuç', cell: (r) => <Badge tone={auditResultTone(r.result)}>{auditResultLabel(r.result)}</Badge> },
  { key: 'ipAddress', header: 'IP', cell: (r) => <span className="type-caption">{r.ipAddress ?? '—'}</span> },
]

export const LogsPage = () => {
  const [view, setView] = useState<'general' | 'sms'>('general')
  const [range, setRange] = useState<DateRangeValue>({ preset: 'custom' })
  const [action, setAction] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')
  const [result, setResult] = useState('')
  const [sortFilter, setSortFilter] = useState('')
  const [options, setOptions] = useState<AuditLogFilterOptions>({ modules: [], actions: [], entityTypes: [] })

  useEffect(() => {
    let active = true
    auditService.getFilters().then((o) => { if (active) setOptions(o) }).catch(() => { if (active) setOptions({ modules: [], actions: [], entityTypes: [] }) })
    return () => { active = false }
  }, [])

  const [sortKey, sortDir] = sortFilter ? (sortFilter.split('-') as [string, string]) : ['', '']
  const sortParams: Record<string, string> = sortFilter ? { sort: sortKey, order: sortDir } : {}

  const extraParams: Record<string, string> = { ...sortParams }
  if (action) extraParams.action = action
  if (moduleFilter) extraParams.module = moduleFilter
  if (result) extraParams.result = result
  if (range.from) extraParams.dateFrom = range.from
  if (range.to) extraParams.dateTo = range.to

  const hasFilters = !!(action || moduleFilter || result || range.from || range.to || sortFilter)
  const filterCount = (action ? 1 : 0) + (moduleFilter ? 1 : 0) + (result ? 1 : 0) + (range.from || range.to ? 1 : 0) + (sortFilter ? 1 : 0)

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell space-y-4 p-6">
        <div className="max-w-xs">
        <SegmentedControl
          value={view}
          onChange={(v) => setView(v as 'general' | 'sms')}
          columns={2}
          options={[
            { value: 'general', label: 'Genel Loglar', icon: ScrollTextIcon },
            { value: 'sms', label: 'SMS Gönderimleri', icon: MessageSquareIcon },
          ]}
        />
      </div>

      {view === 'sms' ? <SmsAuditTab /> : (
    <CrudListTemplate<AuditLogItem, Record<string, never>>
      icon={ScrollTextIcon}
      title="Sistem Logları"
      subtitle="Kim ne zaman hangi kaydı oluşturdu, düzenledi veya sildi — tüm işlemlerin denetim kaydı"
      resourceName="Log"
      service={{ getList: (p) => auditService.getList(p) }}
      rowKey={(r) => r.id}
      columns={columns}
      creatable={false}
      canEdit={() => false}
      viewable
      renderView={(row) => <AuditLogDetailView id={row.id} />}
      viewWidth={760}
      defaultSort={{ key: 'createdAt', dir: 'desc' }}
      searchPlaceholder="Kullanıcı, açıklama veya kayıt türü ara..."
      extraParams={extraParams}
      hasActiveFilters={hasFilters}
      filterCount={filterCount}
      filterColumns={3}
      onClearFilters={() => { setAction(''); setModuleFilter(''); setResult(''); setRange({ preset: 'custom' }); setSortFilter('') }}
      renderFilters={() => (
        <>
          <FilterField label="Sıralama">
            <Select value={sortFilter} onChange={(e) => setSortFilter(e.target.value)}>
              <option value="">Tarihe Göre (En Yeni)</option>
              <option value="createdat-asc">Tarihe Göre (En Eski)</option>
              <option value="createdat-desc">Tarihe Göre (En Yeni)</option>
              <option value="username-asc">Kullanıcı (A-Z)</option>
              <option value="username-desc">Kullanıcı (Z-A)</option>
              <option value="action-asc">İşlem Türü (A-Z)</option>
              <option value="module-asc">Modül (A-Z)</option>
            </Select>
          </FilterField>
          <FilterField label="İşlem">
            <Select searchable value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Tüm İşlemler</option>
              {options.actions.map((a) => <option key={a} value={a}>{auditActionLabel(a)}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Modül">
            <Select searchable value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
              <option value="">Tüm Modüller</option>
              {options.modules.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Sonuç">
            <Select value={result} onChange={(e) => setResult(e.target.value)}>
              <option value="">Tümü</option>
              <option value="Success">Başarılı</option>
              <option value="Failure">Başarısız</option>
              <option value="Partial">Kısmi</option>
            </Select>
          </FilterField>
          <FilterField label="Tarih Aralığı">
            <DateRangeSelect value={range} onChange={setRange} />
          </FilterField>
        </>
      )}
      stats={({ rows, total }) => [
        { label: 'Toplam Kayıt', value: total, icon: ScrollTextIcon, accent: 'blue' },
        { label: 'Bu Sayfada', value: rows.length, icon: ActivityIcon, accent: 'violet' },
        { label: 'Kullanıcı İşlemi', value: rows.filter((r) => r.userName).length, icon: UserIcon, accent: 'green' },
      ]}
      emptyForm={{}}
      toForm={() => ({})}
      renderForm={() => null}
    />
        )}
      </div>
    </UiStandardsContext.Provider>
  )
}
