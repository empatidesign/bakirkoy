import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  PawPrintIcon, PlusIcon, DownloadIcon, ListIcon, HeartPulseIcon, StethoscopeIcon, HomeIcon, ScissorsIcon, SyringeIcon,
} from 'lucide-react'
import { PageHeader, Tabs, StatCard, DataTable, Button, Badge, type DataTableColumn } from '@/design-system'
import { UiStandardsContext } from '@/design-system/UiStandards/UiStandards'
import '@/templates/FacilityTemplate/pilot/facility-ui.css'

interface PetItem {
  id: string
  chipNumber: string
  petName: string
  species: 'Kedi' | 'Köpek'
  breed: string
  ownerName: string
  ownerPhone: string
  lastVaccineDate: string
  nextVaccineDate: string
  status: 'healthy' | 'treatment' | 'adopted'
}

const INITIAL_PETS: PetItem[] = [
  {
    id: 'pet-1',
    chipNumber: 'TR-990-2026-0041',
    petName: 'Duman',
    species: 'Kedi',
    breed: 'Tekir',
    ownerName: 'Demo Vatandaş',
    ownerPhone: '05550000001',
    lastVaccineDate: '2026-08-10',
    nextVaccineDate: '2026-11-10',
    status: 'healthy'
  },
  {
    id: 'pet-2',
    chipNumber: 'TR-990-2026-0042',
    petName: 'Maviş',
    species: 'Kedi',
    breed: 'Van Kedisi Melezi',
    ownerName: 'Ayşe Kaya',
    ownerPhone: '05321112233',
    lastVaccineDate: '2026-09-02',
    nextVaccineDate: '2026-12-02',
    status: 'healthy'
  },
  {
    id: 'pet-3',
    chipNumber: 'TR-990-2026-0043',
    petName: 'Kont',
    species: 'Köpek',
    breed: 'Golden Retriever',
    ownerName: 'Barış Demir',
    ownerPhone: '05445556677',
    lastVaccineDate: '2026-09-20',
    nextVaccineDate: '2026-10-20',
    status: 'treatment'
  }
]

type ActiveTab = 'all' | 'healthy' | 'treatment' | 'adopted'

export const VeterinerlikAdminPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') ?? 'all') as ActiveTab
  const [pets] = useState<PetItem[]>(INITIAL_PETS)
  const [search, setSearch] = useState('')

  const setTab = (tab: string) =>
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev)
      n.set('tab', tab)
      return n
    })

  const rows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr')
    return pets
      .filter(p => activeTab === 'all' || p.status === activeTab)
      .filter(p => !q || `${p.chipNumber} ${p.petName} ${p.ownerName}`.toLocaleLowerCase('tr').includes(q))
  }, [pets, activeTab, search])

  const columns: DataTableColumn<PetItem>[] = [
    { key: 'chipNumber', header: 'Mikroçip / Pati Kart No', cell: p => <span className="font-mono font-semibold">{p.chipNumber}</span> },
    { key: 'petName', header: 'Can Dostumuz', cell: p => <span className="font-semibold">{p.petName}</span> },
    { key: 'species', header: 'Tür / Irk', cell: p => `${p.species} • ${p.breed}` },
    {
      key: 'owner', header: 'Sahip Bilgisi', cell: p => (
        <div>
          <div className="font-semibold">{p.ownerName}</div>
          <div className="text-xs text-foreground-muted">{p.ownerPhone}</div>
        </div>
      ),
    },
    { key: 'lastVaccine', header: 'Son Aşı', cell: p => p.lastVaccineDate },
    { key: 'nextVaccine', header: 'Sonraki Aşı Tarihi', cell: p => <span className="font-semibold">{p.nextVaccineDate}</span> },
    {
      key: 'status', header: 'Sağlık Durumu', cell: p => p.status === 'healthy'
        ? <Badge tone="success">Sağlıklı / Aşılı</Badge>
        : p.status === 'treatment'
          ? <Badge tone="warning">Tedavi Aşamasında</Badge>
          : <Badge tone="info">Sahiplendirildi</Badge>,
    },
  ]

  return (
    <UiStandardsContext.Provider value={true}>
      <div className="facility-ui-pilot pilot-page-shell flex h-full flex-col">
        <PageHeader
          icon={PawPrintIcon}
          title="Veterinerlik & Pati Kart"
          subtitle="Mikroçip ve Pati Kart kayıtları, sokak hayvanı kısırlaştırma randevuları ve sahiplendirme ilanları"
          actions={
            <>
              <Button variant="outline" className="gap-2"><DownloadIcon className="w-4 h-4" /> Aşı Takvimi Dökümü</Button>
              <Button variant="primary" className="gap-2"><PlusIcon className="w-4 h-4" /> Yeni Pati Kart Kaydet</Button>
            </>
          }
        />

        <Tabs
          value={activeTab}
          onValueChange={setTab}
          tabs={[
            { key: 'all', label: 'Tüm Kayıtlar', icon: ListIcon, count: pets.length },
            { key: 'healthy', label: 'Sağlıklı', icon: HeartPulseIcon, count: pets.filter(p => p.status === 'healthy').length },
            { key: 'treatment', label: 'Tedavide', icon: StethoscopeIcon, count: pets.filter(p => p.status === 'treatment').length },
            { key: 'adopted', label: 'Sahiplendirilen', icon: HomeIcon, count: pets.filter(p => p.status === 'adopted').length },
          ]}
        />

        <div className="pilot-content flex-1 space-y-4 overflow-auto">
          <div className="pilot-stat-grid">
            <StatCard size="compact" label="Kayıtlı Pati Kart Sayısı" value="4,120" icon={PawPrintIcon} accent="primary" hint="Mikroçipli can dostumuz" />
            <StatCard size="compact" label="Bu Ay Yapılan Kısırlaştırma" value="184 İşlem" icon={ScissorsIcon} accent="violet" hint="Sokak hayvanları kliniği" />
            <StatCard size="compact" label="Yuvalandırılan Canlar" value="62 Sahiplendirme" icon={HomeIcon} accent="green" hint="Bu yıl +35% artış" />
            <StatCard size="compact" label="Yaklaşan Aşı Randevusu" value="45 Hayvan" icon={SyringeIcon} accent="orange" hint="Otomatik SMS uyarısı aktif" />
          </div>

          <DataTable<PetItem>
            title="Pati Kart Kayıtları"
            columns={columns}
            rows={rows}
            rowKey={p => p.id}
            searchable
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Çip no, hayvan adı veya sahip adı ara..."
            rowActions={() => <Button size="sm" variant="outline">Aşı Karnesi</Button>}
          />
        </div>
      </div>
    </UiStandardsContext.Provider>
  )
}
