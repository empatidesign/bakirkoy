import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  LandmarkIcon, DownloadIcon, FileTextIcon, ListIcon, CheckCircle2Icon, RotateCcwIcon, XCircleIcon,
  WalletIcon, CalendarIcon, PercentIcon, CreditCardIcon,
} from 'lucide-react'
import { PageHeader, Tabs, StatCard, DataTable, Button, Badge, type DataTableColumn } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'

interface TransactionItem {
  id: string
  receiptNo: string
  taxType: string
  citizenName: string
  tckn: string
  amount: number
  paymentMethod: string
  cardMasked: string
  paidAt: string
  status: 'success' | 'refunded' | 'failed'
}

const INITIAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: 'tx-1',
    receiptNo: 'MKZ-2026-904123',
    taxType: 'Emlak Vergisi (Bina)',
    citizenName: 'Demo Vatandaş',
    tckn: '98765432150',
    amount: 1450.00,
    paymentMethod: '3D Secure Kredi Kartı',
    cardMasked: '5399 **** **** 4120',
    paidAt: '2026-10-06 15:42',
    status: 'success'
  },
  {
    id: 'tx-2',
    receiptNo: 'MKZ-2026-904124',
    taxType: 'Çevre Temizlik Vergisi',
    citizenName: 'Ahmet Karaca',
    tckn: '12345678912',
    amount: 320.50,
    paymentMethod: '3D Secure Banka Kartı',
    cardMasked: '4543 **** **** 1099',
    paidAt: '2026-10-06 16:10',
    status: 'success'
  },
  {
    id: 'tx-3',
    receiptNo: 'MKZ-2026-904125',
    taxType: 'İmar Durumu Belge Harcı',
    citizenName: 'Zeynep Kaya',
    tckn: '88776655443',
    amount: 850.00,
    paymentMethod: 'Bakkart Bakiye',
    cardMasked: 'Bakkart #2026',
    paidAt: '2026-10-06 17:05',
    status: 'success'
  },
  {
    id: 'tx-4',
    receiptNo: 'MKZ-2026-904126',
    taxType: 'Tiyatro & Kültür Bileti',
    citizenName: 'Mustafa Çelik',
    tckn: '77665544332',
    amount: 150.00,
    paymentMethod: '3D Secure Kredi Kartı',
    cardMasked: '5400 **** **** 8821',
    paidAt: '2026-10-06 18:22',
    status: 'success'
  }
]

type ActiveTab = 'all' | 'success' | 'refunded' | 'failed'

export const EBelediyeAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'all') as ActiveTab
  const [transactions] = useState<TransactionItem[]>(INITIAL_TRANSACTIONS)
  const [search, setSearch] = useState('')

  const setTab = (tab: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', tab)
      return n
    })

  const totalCollected = transactions.reduce((acc, t) => acc + t.amount, 0)

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return transactions
      .filter(t => activeTab === 'all' || t.status === activeTab)
      .filter(t => !q || `${t.receiptNo} ${t.taxType} ${t.citizenName} ${t.tckn}`.toLocaleLowerCase('tr').includes(q))
  }, [transactions, activeTab, search])

  const columns: DataTableColumn<TransactionItem>[] = [
    { key: 'receiptNo', header: 'Makbuz No', cell: t => <span className="font-mono font-semibold">{t.receiptNo}</span> },
    { key: 'taxType', header: 'Gelir / Vergi Kalemi', cell: t => <span className="font-semibold">{t.taxType}</span> },
    {
      key: 'citizen', header: 'Mükellef Bilgisi', cell: t => (
        <div>
          <div className="font-semibold">{t.citizenName}</div>
          <div className="text-xs text-foreground-muted">TC: {t.tckn}</div>
        </div>
      ),
    },
    {
      key: 'payment', header: 'Ödeme Kanalı', cell: t => (
        <div>
          <div className="font-medium">{t.paymentMethod}</div>
          <div className="text-xs text-foreground-muted font-mono">{t.cardMasked}</div>
        </div>
      ),
    },
    { key: 'paidAt', header: 'Tarih & Saat', cell: t => t.paidAt },
    { key: 'amount', header: 'Tutar (TL)', align: 'right', cell: t => <span className="font-semibold">₺{t.amount.toFixed(2)}</span> },
    {
      key: 'status', header: 'Durum', cell: t => t.status === 'success'
        ? <Badge tone="success">Tahsil Edildi</Badge>
        : t.status === 'refunded'
          ? <Badge tone="warning">İade Edildi</Badge>
          : <Badge tone="danger">Başarısız</Badge>,
    },
  ]

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={LandmarkIcon}
          title="E-Belediye & Tahsilat"
          subtitle="Online borç sorgulama, vergi tahsilatları, imar/etkinlik harçları ve sanal POS işlem dökümleri"
          actions={<Button variant="outline" className="gap-2"><DownloadIcon className="w-4 h-4" /> Muhasebe Raporu (Excel)</Button>}
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'all', label: 'Tüm İşlemler', icon: ListIcon, count: transactions.length },
            { key: 'success', label: 'Tahsil Edilen', icon: CheckCircle2Icon, count: transactions.filter(t => t.status === 'success').length },
            { key: 'refunded', label: 'İade Edilen', icon: RotateCcwIcon, count: transactions.filter(t => t.status === 'refunded').length },
            { key: 'failed', label: 'Başarısız', icon: XCircleIcon, count: transactions.filter(t => t.status === 'failed').length },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          <div className="pilot-stat-grid">
            <StatCard size="compact" label="Bugünkü Tahsilat" value={`₺${totalCollected.toLocaleString()}`} icon={WalletIcon} accent="green" hint="%100 online işlem" />
            <StatCard size="compact" label="Bu Ay Toplam Online Tahsilat" value="₺4,850,200" icon={CalendarIcon} accent="primary" hint="3,420 makbuz kesildi" />
            <StatCard size="compact" label="Emlak & ÇTV Tahsilat Oranı" value="%74.2" icon={PercentIcon} accent="blue" hint="Hedef: %85" />
            <StatCard size="compact" label="POS Başarı Oranı" value="%99.4" icon={CreditCardIcon} accent="violet" hint="Vakıfbank & Garanti 3D Secure" />
          </div>

          <DataTable<TransactionItem>
            title="Tahsilat İşlemleri"
            columns={columns}
            rows={rows}
            rowKey={t => t.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Makbuz no, vergi türü, isim veya TCKN ara..."
            rowActions={() => <Button size="sm" variant="outline" className="gap-1"><FileTextIcon className="w-3.5 h-3.5" /> Dekont Yazdır</Button>}
          />
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
