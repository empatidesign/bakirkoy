import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CompassIcon, DownloadIcon, ListIcon, ClockIcon, CheckCircle2Icon, XCircleIcon, FileStackIcon, MapIcon, TimerIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Tabs, StatCard, DataTable, Button, Badge, type DataTableColumn } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'

interface ImarApplicationItem {
  id: string
  trackingNo: string
  neighborhood: string
  ada: string
  parsel: string
  applicantName: string
  applicantPhone: string
  applicationType: 'İmar Durumu Belgesi' | 'Yapı Ruhsatı' | 'Eksper Ön İnceleme' | 'İskan Talebi'
  appliedAt: string
  status: 'approved' | 'in_review' | 'rejected'
}

const INITIAL_IMAR: ImarApplicationItem[] = [
  {
    id: 'im-1',
    trackingNo: 'IMR-2026-1101',
    neighborhood: 'Zuhuratbaba Mah.',
    ada: '412',
    parsel: '18',
    applicantName: 'Demo Vatandaş',
    applicantPhone: '05550000001',
    applicationType: 'İmar Durumu Belgesi',
    appliedAt: '2026-10-06',
    status: 'in_review'
  },
  {
    id: 'im-2',
    trackingNo: 'IMR-2026-1102',
    neighborhood: 'Yeşilköy Mah.',
    ada: '108',
    parsel: '4',
    applicantName: 'Murat Mimarlık Ltd. Şti.',
    applicantPhone: '0212 555 99 88',
    applicationType: 'Yapı Ruhsatı',
    appliedAt: '2026-10-04',
    status: 'approved'
  },
  {
    id: 'im-3',
    trackingNo: 'IMR-2026-1103',
    neighborhood: 'Kartaltepe Mah.',
    ada: '250',
    parsel: '31',
    applicantName: 'Serkan Öztürk',
    applicantPhone: '0533 111 22 99',
    applicationType: 'Eksper Ön İnceleme',
    appliedAt: '2026-10-05',
    status: 'approved'
  }
]

type ActiveTab = 'all' | 'in_review' | 'approved' | 'rejected'

export const ImarAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'all') as ActiveTab
  const [applications, setApplications] = useState<ImarApplicationItem[]>(INITIAL_IMAR)
  const [search, setSearch] = useState('')

  const setTab = (tab: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', tab)
      return n
    })

  const handleApprove = (id: string) => {
    setApplications(prev => prev.map(a => a.id === id ? { ...a, status: 'approved' } : a))
    toast.success('İmar başvurusu onaylandı ve resmi imar durum belgesi oluşturuldu.')
  }

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return applications
      .filter(a => activeTab === 'all' || a.status === activeTab)
      .filter(a => !q || `${a.trackingNo} ${a.neighborhood} ${a.ada} ${a.parsel} ${a.applicantName}`.toLocaleLowerCase('tr').includes(q))
  }, [applications, activeTab, search])

  const columns: DataTableColumn<ImarApplicationItem>[] = [
    { key: 'trackingNo', header: 'Başvuru No', cell: a => <span className="font-mono font-semibold">{a.trackingNo}</span> },
    { key: 'neighborhood', header: 'Mahalle / Konum', cell: a => <span className="font-semibold">{a.neighborhood}</span> },
    { key: 'adaParsel', header: 'Ada / Parsel', cell: a => <span className="font-mono font-semibold">Ada {a.ada} / P.{a.parsel}</span> },
    { key: 'type', header: 'Başvuru Türü', cell: a => a.applicationType },
    {
      key: 'applicant', header: 'Başvuran Bilgisi', cell: a => (
        <div>
          <div className="font-semibold">{a.applicantName}</div>
          <div className="text-xs text-foreground-muted">{a.applicantPhone}</div>
        </div>
      ),
    },
    { key: 'appliedAt', header: 'Tarih', cell: a => a.appliedAt },
    {
      key: 'status', header: 'Durum', cell: a => a.status === 'approved'
        ? <Badge tone="success">Onaylandı</Badge>
        : a.status === 'in_review'
          ? <Badge tone="warning">İncelemede</Badge>
          : <Badge tone="danger">Reddedildi</Badge>,
    },
  ]

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={CompassIcon}
          title="İmar & Şehircilik"
          subtitle="Ada/parsel imar durumu sorguları, eksper inceleme randevuları ve dijital ruhsat süreçleri"
          actions={<Button variant="outline" className="gap-2"><DownloadIcon className="w-4 h-4" /> Dışa Aktar</Button>}
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'all', label: 'Tüm Başvurular', icon: ListIcon, count: applications.length },
            { key: 'in_review', label: 'İncelemede', icon: ClockIcon, count: applications.filter(a => a.status === 'in_review').length },
            { key: 'approved', label: 'Onaylanan', icon: CheckCircle2Icon, count: applications.filter(a => a.status === 'approved').length },
            { key: 'rejected', label: 'Reddedilen', icon: XCircleIcon, count: applications.filter(a => a.status === 'rejected').length },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          <div className="pilot-stat-grid">
            <StatCard size="compact" label="Toplam E-İmar Başvurusu" value="1,240" icon={FileStackIcon} accent="primary" hint="Bu ay %92 dijital teslim" />
            <StatCard size="compact" label="İncelenen Parsel" value={`${applications.filter(a => a.status === 'in_review').length} Dosya`} icon={MapIcon} accent="orange" hint="Harita mühendisi atandı" />
            <StatCard size="compact" label="Onaylanan Ruhsat" value="42 Ruhsat" icon={CheckCircle2Icon} accent="green" hint="Kentsel dönüşüm öncelikli" />
            <StatCard size="compact" label="Ortalama Belge Süresi" value="1.2 Gün" icon={TimerIcon} accent="blue" hint="Hedef: 24 saat" />
          </div>

          <DataTable<ImarApplicationItem>
            title="E-İmar Başvuruları"
            columns={columns}
            rows={rows}
            rowKey={a => a.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Ada, parsel, mahalle veya isim ara..."
            rowActions={a => a.status === 'in_review'
              ? <Button size="sm" variant="primary" onClick={() => handleApprove(a.id)}>Onayla</Button>
              : <Button size="sm" variant="outline">Belgeyi İndir</Button>}
          />
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
