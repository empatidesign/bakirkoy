import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CreditCardIcon, StoreIcon, UsersIcon, DownloadIcon, PlusIcon, QrCodeIcon, AwardIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, Tabs, StatCard, DataTable, Button, Badge, type DataTableColumn } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'

interface CardHolder {
  id: string
  cardNumber: string
  fullName: string
  tckn: string
  phone: string
  neighborhood: string
  points: number
  balance: number
  status: 'active' | 'passive' | 'blocked'
  createdAt: string
}

interface MerchantItem {
  id: string
  name: string
  category: string
  discountRate: number
  address: string
  phone: string
  totalRedemptions: number
  status: 'approved' | 'pending' | 'rejected'
}

const INITIAL_HOLDERS: CardHolder[] = [
  {
    id: 'h-1',
    cardNumber: '5399 2600 9041 2026',
    fullName: 'Demo Vatandaş',
    tckn: '98765432150',
    phone: '05550000001',
    neighborhood: 'Zuhuratbaba',
    points: 1250,
    balance: 450.00,
    status: 'active',
    createdAt: '2026-09-15'
  },
  {
    id: 'h-2',
    cardNumber: '5399 2600 8124 5510',
    fullName: 'Mehmet Ali Kaya',
    tckn: '11223344556',
    phone: '05324445566',
    neighborhood: 'Yeşilköy',
    points: 3200,
    balance: 120.50,
    status: 'active',
    createdAt: '2026-09-18'
  },
  {
    id: 'h-3',
    cardNumber: '5399 2600 7712 9901',
    fullName: 'Selin Yılmaz',
    tckn: '22334455667',
    phone: '05436667788',
    neighborhood: 'Ataköy',
    points: 850,
    balance: 0.00,
    status: 'active',
    createdAt: '2026-09-22'
  }
]

const INITIAL_MERCHANTS: MerchantItem[] = [
  {
    id: 'm-1',
    name: 'Bakırköy Esnafı (Demo)',
    category: 'Gıda & Market',
    discountRate: 10,
    address: 'Zuhuratbaba Mah. Demirkapı Cad. No:1',
    phone: '05550000002',
    totalRedemptions: 142,
    status: 'approved'
  },
  {
    id: 'm-2',
    name: 'Yeşilköy Sahil Kitap Kafe',
    category: 'Kırtasiye & Kafe',
    discountRate: 15,
    address: 'Yeşilköy Sahil Caddesi No:45',
    phone: '0212 555 44 33',
    totalRedemptions: 89,
    status: 'approved'
  },
  {
    id: 'm-3',
    name: 'Ataköy Spor Giyim & Ayakkabı',
    category: 'Giyim',
    discountRate: 20,
    address: 'Ataköy Galleria AVM Zemin Kat',
    phone: '0212 666 77 88',
    totalRedemptions: 34,
    status: 'pending'
  }
]

type ActiveTab = 'holders' | 'merchants'

const matches = (q: string, ...fields: string[]) => !q || fields.join(' ').toLocaleLowerCase('tr').includes(q)

const holderColumns: DataTableColumn<CardHolder>[] = [
  { key: 'cardNumber', header: 'Kart Numarası', cell: h => <span className="font-mono font-semibold tabular-nums">{h.cardNumber}</span> },
  { key: 'fullName', header: 'Kart Sahibi', cell: h => <span className="type-body-strong">{h.fullName}</span> },
  { key: 'tckn', header: 'T.C. Kimlik No', cell: h => <span className="type-muted tabular-nums">{h.tckn}</span> },
  { key: 'phone', header: 'Telefon', cell: h => <span className="type-muted">{h.phone}</span> },
  { key: 'neighborhood', header: 'Mahalle', cell: h => <span className="type-muted">{h.neighborhood}</span> },
  { key: 'points', header: 'Puan', align: 'right', cell: h => <span className="tabular-nums type-body-strong">{h.points.toLocaleString('tr-TR')} BP</span> },
  { key: 'balance', header: 'Bakiye (TL)', align: 'right', cell: h => <span className="tabular-nums type-body-strong">₺{h.balance.toFixed(2)}</span> },
  { key: 'status', header: 'Durum', cell: () => <Badge tone="success">Aktif</Badge> },
]

const merchantColumns: DataTableColumn<MerchantItem>[] = [
  { key: 'name', header: 'Esnaf / İşletme Adı', cell: m => <span className="type-body-strong">{m.name}</span> },
  { key: 'category', header: 'Sektör', cell: m => <span className="type-muted">{m.category}</span> },
  { key: 'discountRate', header: 'İndirim Oranı', cell: m => <Badge tone="success">%{m.discountRate} İndirim</Badge> },
  { key: 'address', header: 'Adres', cell: m => <span className="type-muted">{m.address}</span> },
  { key: 'phone', header: 'Telefon', cell: m => <span className="type-muted">{m.phone}</span> },
  { key: 'totalRedemptions', header: 'QR Kullanım', align: 'right', cell: m => <span className="tabular-nums type-body-strong">{m.totalRedemptions} işlem</span> },
  {
    key: 'status', header: 'Onay Durumu', cell: m => m.status === 'approved'
      ? <Badge tone="success">Onaylı Esnaf</Badge>
      : m.status === 'pending'
        ? <Badge tone="warning">Onay Bekliyor</Badge>
        : <Badge tone="danger">Reddedildi</Badge>,
  },
]

export const BakkartAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab: ActiveTab = searchParams.get('tab') === 'merchants' ? 'merchants' : 'holders'
  const [holders] = useState<CardHolder[]>(INITIAL_HOLDERS)
  const [merchants, setMerchants] = useState<MerchantItem[]>(INITIAL_MERCHANTS)
  const [search, setSearch] = useState('')

  const setTab = (tab: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', tab)
      return n
    })

  const handleApproveMerchant = (id: string) => {
    setMerchants(prev => prev.map(m => m.id === id ? { ...m, status: 'approved' } : m))
    toast.success('Esnaf Bakkart anlaşması onaylandı.')
  }

  const handleRejectMerchant = (id: string) => {
    setMerchants(prev => prev.map(m => m.id === id ? { ...m, status: 'rejected' } : m))
    toast.success('Esnaf başvurusu reddedildi.')
  }

  const q = search.trim().toLocaleLowerCase('tr')
  const holderRows = useMemo(
    () => holders.filter(h => matches(q, h.fullName, h.tckn, h.cardNumber, h.phone, h.neighborhood)),
    [holders, q],
  )
  const merchantRows = useMemo(
    () => merchants.filter(m => matches(q, m.name, m.category, m.address, m.phone)),
    [merchants, q],
  )

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={CreditCardIcon}
          title="Bakkart Yönetimi (Bakırköy Kart)"
          subtitle="Dijital kent kartı sahipleri, sadakat puanları ve anlaşmalı esnaf indirim ağı yönetimi."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2"><DownloadIcon className="w-4 h-4" /> Dışa Aktar</Button>
              <Button variant="primary" className="gap-2"><PlusIcon className="w-4 h-4" /> Yeni Esnaf Ekle</Button>
            </div>
          }
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'holders', label: 'Kart Sahipleri Listesi', icon: UsersIcon, count: holders.length },
            { key: 'merchants', label: 'Anlaşmalı Esnaflar', icon: StoreIcon, count: merchants.length },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          <div className="pilot-stat-grid">
            <StatCard size="compact" label="Aktif Bakkart Sayısı" value="24,850" icon={CreditCardIcon} accent="blue" hint="+420 yeni kart (Bu hafta)" />
            <StatCard size="compact" label="Anlaşmalı Esnaf" value="164 Esnaf" icon={StoreIcon} accent="green" hint="Bakırköy geneli" />
            <StatCard size="compact" label="Bu Ay QR İndirim Kullanımı" value="8,420 İşlem" icon={QrCodeIcon} accent="violet" hint="Toplam ₺410,000 tasarruf" />
            <StatCard size="compact" label="Dağıtılan Sadakat Puanı" value="1.2M Puan" icon={AwardIcon} accent="orange" hint="Kültür ve sporda geçerli" />
          </div>

          {activeTab === 'holders' ? (
            <DataTable<CardHolder>
              title="Kart Sahipleri"
              columns={holderColumns}
              rows={holderRows}
              rowKey={h => h.id}
              searchable
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="İsim, TCKN, kart no veya mahalle ara..."
              rowActions={() => <Button size="sm" variant="outline">Detay</Button>}
            />
          ) : (
            <DataTable<MerchantItem>
              title="Anlaşmalı Esnaflar"
              columns={merchantColumns}
              rows={merchantRows}
              rowKey={m => m.id}
              searchable
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Esnaf adı, sektör veya adres ara..."
              rowActions={m => m.status === 'pending'
                ? (
                  <div className="flex justify-end gap-1.5">
                    <Button size="sm" variant="primary" onClick={() => handleApproveMerchant(m.id)}>Onayla</Button>
                    <Button size="sm" variant="danger" onClick={() => handleRejectMerchant(m.id)}>Reddet</Button>
                  </div>
                )
                : <Button size="sm" variant="outline">Düzenle</Button>}
            />
          )}
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
