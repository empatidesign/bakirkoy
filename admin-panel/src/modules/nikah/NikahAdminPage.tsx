import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  HeartIcon, DownloadIcon, FileCheckIcon, CalendarHeartIcon, ClockIcon, Building2Icon, CheckCircle2Icon, ListIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Tabs, StatCard, DataTable, Button, Badge, type DataTableColumn } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'

interface WeddingItem {
  id: string
  trackingNo: string
  coupleNames: string
  hallName: string
  weddingDate: string
  weddingTime: string
  documentsStatus: 'complete' | 'missing'
  status: 'approved' | 'pending' | 'completed' | 'cancelled'
  officiantName?: string
}

const INITIAL_WEDDINGS: WeddingItem[] = [
  {
    id: 'wd-1',
    trackingNo: 'NKH-2026-401',
    coupleNames: 'Elif Yılmaz & Caner Aktaş',
    hallName: 'Yunus Emre KM Ana Nikah Salonu',
    weddingDate: '2026-10-18',
    weddingTime: '14:30',
    documentsStatus: 'complete',
    status: 'approved',
    officiantName: 'Mehmet Ali Memur'
  },
  {
    id: 'wd-2',
    trackingNo: 'NKH-2026-402',
    coupleNames: 'Merve Demir & Burak Çelik',
    hallName: 'Leyla Gencer Sanat Merkezi Salonu',
    weddingDate: '2026-10-24',
    weddingTime: '16:00',
    documentsStatus: 'complete',
    status: 'pending'
  },
  {
    id: 'wd-3',
    trackingNo: 'NKH-2026-403',
    coupleNames: 'Gizem Aydın & Kemal Şahin',
    hallName: 'Yunus Emre KM Kokteyl Nikah Salonu',
    weddingDate: '2026-10-25',
    weddingTime: '15:15',
    documentsStatus: 'missing',
    status: 'pending'
  }
]

type ActiveTab = 'all' | 'pending' | 'approved'

export const NikahAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'all') as ActiveTab
  const [weddings, setWeddings] = useState<WeddingItem[]>(INITIAL_WEDDINGS)
  const [search, setSearch] = useState('')

  const setTab = (tab: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', tab)
      return n
    })

  const handleApprove = (id: string) => {
    setWeddings(prev => prev.map(w => w.id === id ? { ...w, status: 'approved', officiantName: 'Belediye Nikah Memuru' } : w))
    toast.success('Nikah randevusu onaylandı ve gün-saat kesinleşti.')
  }

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return weddings
      .filter(w => activeTab === 'all' || w.status === activeTab)
      .filter(w => !q || `${w.trackingNo} ${w.coupleNames}`.toLocaleLowerCase('tr').includes(q))
  }, [weddings, activeTab, search])

  const columns: DataTableColumn<WeddingItem>[] = [
    { key: 'trackingNo', header: 'Başvuru No', cell: w => <span className="font-mono font-semibold">{w.trackingNo}</span> },
    { key: 'couple', header: 'Evlenecek Çift', cell: w => <span className="font-semibold">{w.coupleNames}</span> },
    { key: 'hall', header: 'Nikah Salonu', cell: w => w.hallName },
    { key: 'date', header: 'Tarih & Saat', cell: w => `${w.weddingDate} ${w.weddingTime}` },
    {
      key: 'documents', header: 'Evrak Durumu', cell: w => w.documentsStatus === 'complete'
        ? <Badge tone="success" className="gap-1"><FileCheckIcon className="w-3 h-3" /> Eksiksiz</Badge>
        : <Badge tone="warning">Eksik Evrak</Badge>,
    },
    { key: 'officiant', header: 'Nikah Memuru', cell: w => w.officiantName || 'Atama Bekliyor' },
    {
      key: 'status', header: 'Durum', cell: w => w.status === 'pending'
        ? <Badge tone="warning">Beklemede</Badge>
        : <Badge tone="success">Onaylandı</Badge>,
    },
  ]

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={HeartIcon}
          title="Nikah İşlemleri"
          subtitle="Nikah salonu rezervasyonları, çift evrak onayları ve nikah memuru atama takvimi"
          actions={<Button variant="outline" className="gap-2"><DownloadIcon className="w-4 h-4" /> Takvim Dökümü</Button>}
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'all', label: 'Tüm Başvurular', icon: ListIcon, count: weddings.length },
            { key: 'pending', label: 'Onay Bekleyen', icon: ClockIcon, count: weddings.filter(w => w.status === 'pending').length },
            { key: 'approved', label: 'Onaylanan', icon: CheckCircle2Icon, count: weddings.filter(w => w.status === 'approved').length },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          <div className="pilot-stat-grid">
            <StatCard size="compact" label="Bu Ay Kıyılacak Nikah" value="142" icon={CalendarHeartIcon} accent="primary" hint="Hafta sonları %100 dolu" />
            <StatCard size="compact" label="Onay Bekleyen Başvuru" value="18" icon={ClockIcon} accent="orange" hint="Evrak kontrolü gerekli" />
            <StatCard size="compact" label="Aktif Nikah Salonu" value="3" icon={Building2Icon} accent="violet" hint="Yunus Emre & Leyla Gencer" />
            <StatCard size="compact" label="Evrak Tamamlanma" value="%94" icon={FileCheckIcon} accent="green" hint="Sağlık raporu dijital entegre" />
          </div>

          <DataTable<WeddingItem>
            title="Nikah Başvuruları"
            columns={columns}
            rows={rows}
            rowKey={w => w.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Çift isimleri veya başvuru no ara..."
            rowActions={w => w.status === 'pending'
              ? <Button size="sm" variant="primary" onClick={() => handleApprove(w.id)}>Onayla & Memur Ata</Button>
              : <Button size="sm" variant="outline">Evrakları Gör</Button>}
          />
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
