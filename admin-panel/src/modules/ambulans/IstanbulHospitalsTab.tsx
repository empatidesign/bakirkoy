import { useState } from 'react'
import { ISTANBUL_HOSPITALS, type IstanbulHospital } from './hospitalsData'
import {
  Input, Button, Badge, Modal, Field, CheckboxRow, FilterBar, FilterField, StatCard, IconButton,
  Select, DataTable, type DataTableColumn,
} from '@/design-system'
import { toast } from 'sonner'
import {
  Building2Icon,
  SearchIcon,
  MapPinIcon,
  PhoneIcon,
  ClockIcon,
  ExternalLinkIcon,
  PlusIcon,
  ActivityIcon,
  CopyIcon,
  CheckIcon,
  HospitalIcon
} from 'lucide-react'

export const IstanbulHospitalsTab = () => {
  const [hospitals, setHospitals] = useState<IstanbulHospital[]>(ISTANBUL_HOSPITALS)
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string>('ALL')
  const [selectedDistrict, setSelectedDistrict] = useState<string>('ALL')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)

  const [newHosp, setNewHosp] = useState({
    name: '',
    shortName: '',
    type: 'OZEL' as IstanbulHospital['type'],
    typeLabel: 'Özel Hastane',
    district: 'Bakırköy',
    neighborhood: '',
    address: '',
    lat: '40.9900',
    lng: '28.8700',
    phone: '',
    hasEmergency: true,
    hasAdultIntensiveCare: true,
    hasPediatricIntensiveCare: false,
    estimatedMinutesFromBakirkoy: 15,
    departments: 'Acil, Poliklinik, Dahiliye'
  })

  const districts = ['ALL', ...Array.from(new Set(hospitals.map(h => h.district)))]

  const filteredHospitals = hospitals.filter(h => {
    const matchSearch =
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.district.toLowerCase().includes(search.toLowerCase()) ||
      h.address.toLowerCase().includes(search.toLowerCase()) ||
      h.departments.some(d => d.toLowerCase().includes(search.toLowerCase()))

    const matchType = selectedType === 'ALL' || h.type === selectedType
    const matchDistrict = selectedDistrict === 'ALL' || h.district === selectedDistrict

    return matchSearch && matchType && matchDistrict
  })

  const totalPages = Math.max(1, Math.ceil(filteredHospitals.length / limit))
  const pagedHospitals = filteredHospitals.slice((page - 1) * limit, page * limit)

  const handleCopyCoord = (h: IstanbulHospital) => {
    navigator.clipboard.writeText(`${h.coordinates.lat}, ${h.coordinates.lng}`)
    setCopiedId(h.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleAddHospital = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newHosp.name || !newHosp.address) {
      toast.error('Lütfen hastane adı ve adresini giriniz.')
      return
    }

    const created: IstanbulHospital = {
      id: `custom-hosp-${Date.now()}`,
      name: newHosp.name,
      shortName: newHosp.shortName || newHosp.name,
      type: newHosp.type,
      typeLabel:
        newHosp.type === 'SEHIR'
          ? 'Şehir Hastanesi'
          : newHosp.type === 'EAH'
            ? 'Eğitim ve Araştırma'
            : newHosp.type === 'DEVLET'
              ? 'Devlet Hastanesi'
              : newHosp.type === 'UNIVERSITE'
                ? 'Üniversite Hastanesi'
                : 'Özel Hastane',
      district: newHosp.district,
      neighborhood: newHosp.neighborhood,
      address: newHosp.address,
      coordinates: {
        lat: parseFloat(newHosp.lat) || 40.99,
        lng: parseFloat(newHosp.lng) || 28.87
      },
      phone: newHosp.phone || '0212 000 00 00',
      hasEmergency: newHosp.hasEmergency,
      hasAdultIntensiveCare: newHosp.hasAdultIntensiveCare,
      hasPediatricIntensiveCare: newHosp.hasPediatricIntensiveCare,
      estimatedMinutesFromBakirkoy: Number(newHosp.estimatedMinutesFromBakirkoy) || 15,
      departments: newHosp.departments.split(',').map(d => d.trim()).filter(Boolean)
    }

    setHospitals([created, ...hospitals])
    setIsAddModalOpen(false)
    toast.success(`"${created.name}" sisteme eklendi.`)
  }

  const typeTone = (t: IstanbulHospital['type']) =>
    t === 'SEHIR' ? 'danger' : t === 'EAH' ? 'primary' : t === 'UNIVERSITE' ? 'info' : 'neutral'

  const hasActiveFilters = !!search || selectedType !== 'ALL' || selectedDistrict !== 'ALL'

  const columns: DataTableColumn<IstanbulHospital>[] = [
    {
      key: 'name', header: 'Sağlık Kuruluşu',
      cell: h => (
        <div className="max-w-xs">
          <div className="flex items-center gap-1.5 font-semibold text-foreground">
            <Building2Icon className="h-4 w-4 shrink-0 text-primary" />
            <span>{h.name}</span>
          </div>
          <div className="type-caption mt-0.5">{h.shortName}</div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {h.departments.slice(0, 3).map(dep => (
              <Badge key={dep} tone="neutral">{dep}</Badge>
            ))}
            {h.departments.length > 3 && <Badge tone="primary">+{h.departments.length - 3}</Badge>}
          </div>
        </div>
      ),
    },
    {
      key: 'type', header: 'Tür & İlçe',
      cell: h => (
        <>
          <Badge tone={typeTone(h.type)}>{h.typeLabel}</Badge>
          <div className="mt-1.5 flex items-center gap-1 font-medium text-foreground">
            <MapPinIcon className="h-3.5 w-3.5 text-foreground-muted" />
            <span>{h.district}</span>
          </div>
          <div className="type-caption">{h.neighborhood}</div>
        </>
      ),
    },
    {
      key: 'address', header: 'Adres & Telefon',
      cell: h => (
        <div className="max-w-xs">
          <div className="leading-relaxed text-foreground">{h.address}</div>
          <a
            href={`tel:${h.phone.replace(/\s+/g, '')}`}
            className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            <PhoneIcon className="h-3.5 w-3.5" />
            {h.phone}
          </a>
        </div>
      ),
    },
    {
      key: 'gps', header: 'GPS / Konum',
      cell: h => (
        <div className="flex items-center gap-1">
          <span className="font-mono text-foreground-muted">
            {h.coordinates.lat.toFixed(4)}, {h.coordinates.lng.toFixed(4)}
          </span>
          <IconButton
            title={copiedId === h.id ? 'Kopyalandı' : 'Koordinatları kopyala'}
            onClick={() => handleCopyCoord(h)}
          >
            {copiedId === h.id ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
          </IconButton>
        </div>
      ),
    },
    {
      key: 'duration', header: "Bakırköy'den Süre", align: 'center',
      cell: h => (
        <Badge tone="info">
          <ClockIcon className="h-3 w-3" /> ~{h.estimatedMinutesFromBakirkoy} dk
        </Badge>
      ),
    },
    {
      key: 'care', header: 'Acil & Yoğun Bakım', align: 'center',
      cell: h => (
        <div className="flex flex-col items-center gap-1">
          {h.hasEmergency ? <Badge tone="success" dot>Acil Açık</Badge> : <Badge tone="neutral">Randevulu</Badge>}
          {h.hasAdultIntensiveCare && <Badge tone="danger">Erişkin YB</Badge>}
          {h.hasPediatricIntensiveCare && <Badge tone="warning">Çocuk YB</Badge>}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="pilot-stat-grid">
        <StatCard size="compact" label="Kayıtlı Hastane" value={hospitals.length} icon={Building2Icon} accent="neutral" hint="İstanbul geneli tüm ilçeler" />
        <StatCard size="compact" label="Bakırköy İlçe İçi" value={hospitals.filter(h => h.district === 'Bakırköy').length} icon={MapPinIcon} accent="blue" hint="Ort. varış: 10 dk" />
        <StatCard size="compact" label="Şehir & EAH" value={hospitals.filter(h => h.type === 'SEHIR' || h.type === 'EAH').length} icon={HospitalIcon} accent="green" hint="Tam teşekküllü sevk noktaları" />
        <StatCard size="compact" label="24/7 Acil Servis" value={hospitals.filter(h => h.hasEmergency).length} icon={ActivityIcon} accent="danger" hint="GPS ve rota senkronlu" />
      </div>

      <FilterBar
        columns={2}
        hasActiveFilters={hasActiveFilters}
        onClear={() => { setSearch(''); setSelectedType('ALL'); setSelectedDistrict('ALL') }}
        search={
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hastane adı, ilçe, branş veya adres ara..."
            iconLeft={<SearchIcon className="h-3.5 w-3.5" />}
          />
        }
      >
        <FilterField label="Kuruluş Türü">
          <Select value={selectedType} onChange={e => setSelectedType(e.target.value)}>
            <option value="ALL">Tüm Türler ({hospitals.length})</option>
            <option value="SEHIR">Şehir Hastaneleri</option>
            <option value="EAH">Eğitim ve Araştırma (EAH)</option>
            <option value="UNIVERSITE">Üniversite Tıp Fakülteleri</option>
            <option value="DEVLET">Devlet Hastaneleri</option>
            <option value="DAL">Dal Hastaneleri (FTR, Göğüs, Ruh Sağlığı)</option>
            <option value="OZEL">Özel Sağlık Grupları</option>
          </Select>
        </FilterField>
        <FilterField label="İlçe">
          <Select value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)} searchable>
            <option value="ALL">Tüm İlçeler</option>
            {districts.filter(d => d !== 'ALL').map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </Select>
        </FilterField>
      </FilterBar>

      <DataTable<IstanbulHospital>
        showRowNumbers
        columns={columns}
        rows={pagedHospitals}
        rowKey={h => h.id}
        page={page}
        limit={limit}
        total={filteredHospitals.length}
        totalPages={totalPages}
        onPageChange={setPage}
        onLimitChange={n => { setLimit(n); setPage(1) }}
        pageSizeOptions={[10, 25, 50, 100]}
        toolbarActions={
          <Button iconLeft={<PlusIcon className="h-4 w-4" />} onClick={() => setIsAddModalOpen(true)}>
            Yeni Hastane Ekle
          </Button>
        }
        rowActions={h => (
          <Button asChild variant="outline" size="sm">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.name + ' ' + h.address)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLinkIcon className="h-4 w-4" />
              Haritada Aç
            </a>
          </Button>
        )}
      />

      <Modal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yeni Sağlık Kuruluşu Ekle"
        subtitle="Eklenen kuruluş tüm ambulans sevk rotalarında kullanılabilir."
        width={640}
        footer={
          <>
            <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>İptal</Button>
            <Button type="submit" form="add-hospital-form">Hastaneyi Kaydet</Button>
          </>
        }
      >
        <form id="add-hospital-form" onSubmit={handleAddHospital} className="space-y-4">
          <Field label="Hastane Resmi Adı" required>
            <Input
              required
              value={newHosp.name}
              onChange={e => setNewHosp({ ...newHosp, name: e.target.value })}
              placeholder="Örn: Özel Acıbadem Maslak Hastanesi"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Kısa Ad">
              <Input
                value={newHosp.shortName}
                onChange={e => setNewHosp({ ...newHosp, shortName: e.target.value })}
                placeholder="Örn: Acıbadem Maslak"
              />
            </Field>
            <Field label="Kuruluş Türü">
              <Select
                value={newHosp.type}
                onChange={e => setNewHosp({ ...newHosp, type: e.target.value as IstanbulHospital['type'] })}
              >
                <option value="SEHIR">Şehir Hastanesi</option>
                <option value="EAH">Eğitim ve Araştırma Hastanesi</option>
                <option value="UNIVERSITE">Üniversite Tıp Fakültesi</option>
                <option value="DEVLET">Devlet Hastanesi</option>
                <option value="DAL">Özel Dal Hastanesi (FTR/Ruh/Göz)</option>
                <option value="OZEL">Özel Hastane / Tıp Merkezi</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="İlçe">
              <Input
                value={newHosp.district}
                onChange={e => setNewHosp({ ...newHosp, district: e.target.value })}
                placeholder="Örn: Bakırköy, Şişli"
              />
            </Field>
            <Field label="Mahalle">
              <Input
                value={newHosp.neighborhood}
                onChange={e => setNewHosp({ ...newHosp, neighborhood: e.target.value })}
                placeholder="Örn: Maslak Mah."
              />
            </Field>
          </div>

          <Field label="Açık Adres" required>
            <Input
              required
              value={newHosp.address}
              onChange={e => setNewHosp({ ...newHosp, address: e.target.value })}
              placeholder="Tam adres bilgisi..."
            />
          </Field>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Enlem (Lat)">
              <Input value={newHosp.lat} onChange={e => setNewHosp({ ...newHosp, lat: e.target.value })} placeholder="41.0000" />
            </Field>
            <Field label="Boylam (Lng)">
              <Input value={newHosp.lng} onChange={e => setNewHosp({ ...newHosp, lng: e.target.value })} placeholder="28.9000" />
            </Field>
            <Field label="Bakırköy'den Süre (dk)">
              <Input
                type="number"
                value={newHosp.estimatedMinutesFromBakirkoy}
                onChange={e => setNewHosp({ ...newHosp, estimatedMinutesFromBakirkoy: Number(e.target.value) })}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Santral Telefonu">
              <Input value={newHosp.phone} onChange={e => setNewHosp({ ...newHosp, phone: e.target.value })} placeholder="0212 000 00 00" />
            </Field>
            <Field label="Branşlar" hint="Virgülle ayırın">
              <Input
                value={newHosp.departments}
                onChange={e => setNewHosp({ ...newHosp, departments: e.target.value })}
                placeholder="Acil, Onkoloji, Diyaliz"
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <CheckboxRow
              label="24 Saat Acil"
              checked={newHosp.hasEmergency}
              onChange={v => setNewHosp({ ...newHosp, hasEmergency: v })}
            />
            <CheckboxRow
              label="Erişkin Yoğun Bakım"
              checked={newHosp.hasAdultIntensiveCare}
              onChange={v => setNewHosp({ ...newHosp, hasAdultIntensiveCare: v })}
            />
            <CheckboxRow
              label="Çocuk Yoğun Bakım"
              checked={newHosp.hasPediatricIntensiveCare}
              onChange={v => setNewHosp({ ...newHosp, hasPediatricIntensiveCare: v })}
            />
          </div>
        </form>
      </Modal>
    </div>
  )
}
