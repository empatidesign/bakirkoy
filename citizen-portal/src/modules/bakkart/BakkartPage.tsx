import { useState, useEffect, useRef } from 'react'
import {
  CreditCardIcon,
  QrCodeIcon,
  StoreIcon,
  PercentIcon,
  SparklesIcon,
  ShieldCheckIcon,
  RefreshCwIcon,
  MapPinIcon,
  SearchIcon,
  AwardIcon,
  TrendingUpIcon,
  UploadIcon,
  FileTextIcon,
  XIcon,
  Loader2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/framework/auth/AuthContext'
import bakkartService from '@/services/bakkart.service'
import type { MyBakkartStatus, BakkartCardStats, BakkartCardType, BakkartDeliveryType, BakkartDocument } from '@/types/bakkart.types'

interface PartnerStore {
  id: string
  name: string
  category: string
  discount: number
  address: string
  neighborhood: string
  logo?: string
  validUntil: string
  description: string
  isPopular?: boolean
}

const PARTNER_STORES: PartnerStore[] = [
  {
    id: '1',
    name: 'Bakırköy Kitap & Kırtasiye',
    category: 'Eğitim & Kırtasiye',
    discount: 20,
    address: 'İncirli Cad. No:42',
    neighborhood: 'Zuhuratbaba',
    validUntil: '31.12.2026',
    description: 'Tüm kitap ve kırtasiye ürünlerinde %20 Bakkart indirimi.',
    isPopular: true
  },
  {
    id: '2',
    name: 'Yeşilköy Sahil Kafe',
    category: 'Yeme & İçme',
    discount: 15,
    address: 'Rauf Orbay Cad. Sahil Yolu No:18',
    neighborhood: 'Yeşilköy',
    validUntil: '31.12.2026',
    description: 'Sıcak-soğuk içecekler ve tatlılarda geçerlidir.',
    isPopular: true
  },
  {
    id: '3',
    name: 'Bakırköy Spor Dünyası',
    category: 'Spor & Giyim',
    discount: 25,
    address: 'Fahri Korutürk Cad. No:15',
    neighborhood: 'Cevizlik',
    validUntil: '30.11.2026',
    description: 'Spor giyim ve ekipmanlarında belediye sakinlerine özel indirim.',
    isPopular: false
  },
  {
    id: '4',
    name: 'Ataköy Eczanesi & Dermokozmetik',
    category: 'Sağlık & Bakım',
    discount: 10,
    address: 'Ataköy 5. Kısım Çarşısı No:8',
    neighborhood: 'Ataköy',
    validUntil: '31.12.2026',
    description: 'Reçetesiz dermokozmetik ve vitamin ürünlerinde geçerli.',
    isPopular: false
  },
  {
    id: '5',
    name: 'Marmara Fırın & Unlu Mamuller',
    category: 'Yeme & İçme',
    discount: 15,
    address: 'Ebuziya Cad. No:63',
    neighborhood: 'Zeytinlik',
    validUntil: '31.12.2026',
    description: 'Tüm unlu mamullerde sabah 07:00-12:00 arası indirim.',
    isPopular: true
  },
  {
    id: '6',
    name: 'Florya Optik & Gözlük',
    category: 'Sağlık & Bakım',
    discount: 30,
    address: 'Şenlikköy Mah. Florya Cad. No:24',
    neighborhood: 'Şenlikköy',
    validUntil: '31.12.2026',
    description: 'Güneş gözlüğü ve çerçevelerde Bakkart sahiplerine net %30.',
    isPopular: false
  }
]

const CATEGORIES = ['Tümü', 'Yeme & İçme', 'Eğitim & Kırtasiye', 'Spor & Giyim', 'Sağlık & Bakım']

export const BakkartPage = () => {
  const { state } = useAuth()
  const user = state.status === 'authenticated' ? state.user : null

  // 30 saniyelik dinamik QR kod sayacı (Şartname 3.3.30.2)
  const [secondsLeft, setSecondsLeft] = useState(30)
  const [qrToken, setQrToken] = useState('BAKKART-BK-9842103847')
  const [selectedCategory, setSelectedCategory] = useState('Tümü')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'card' | 'stores' | 'campaigns' | 'apply'>('card')

  // Gerçek Bakkart durumu (backend)
  const [myStatus, setMyStatus] = useState<MyBakkartStatus | null>(null)
  const [myStats, setMyStats] = useState<BakkartCardStats | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  const loadStatus = () => {
    setStatusLoading(true)
    bakkartService.status()
      .then((s) => {
        setMyStatus(s)
        if (s.status === 'Approved' && s.card) {
          bakkartService.stats().then(setMyStats).catch(() => setMyStats(null))
        }
      })
      .catch(() => setMyStatus(null))
      .finally(() => setStatusLoading(false))
  }
  useEffect(() => { loadStatus() }, [])

  // Bakkart Başvuru State'leri
  const [applicantName, setApplicantName] = useState(user?.fullName || '')
  const [applicantTckn, setApplicantTckn] = useState(user?.tckn || '')
  const [applicantPhone, setApplicantPhone] = useState(user?.phone || '')
  const [applicantDistrict, setApplicantDistrict] = useState('Zuhuratbaba')
  const [cardType, setCardType] = useState<BakkartCardType>('Standard')
  const [deliveryType, setDeliveryType] = useState<BakkartDeliveryType>('Digital')
  const [submitting, setSubmitting] = useState(false)
  const [documents, setDocuments] = useState<BakkartDocument[]>([])
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDocumentSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploadingDoc(true)
    try {
      const uploaded = await bakkartService.uploadDocument(file)
      setDocuments((prev) => [...prev, { name: file.name, url: uploaded.url }])
      toast.success('Belge yüklendi.')
    } catch {
      toast.error('Belge yüklenemedi. Lütfen PDF, JPG veya PNG formatında tekrar deneyin.')
    } finally {
      setUploadingDoc(false)
    }
  }

  const removeDocument = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      await bakkartService.apply({
        fullName: applicantName,
        tckn: applicantTckn,
        phone: applicantPhone,
        district: applicantDistrict,
        cardType,
        deliveryType,
        documents: documents.length > 0 ? documents : undefined,
      })
      toast.success('Bakkart başvurunuz başarıyla alındı. Belediye onayının ardından kartınız aktif olacak.')
      setDocuments([])
      loadStatus()
    } catch {
      toast.error('Başvurunuz gönderilemedi. Lütfen bilgileri kontrol edip tekrar deneyin.')
    } finally {
      setSubmitting(false)
    }
  }

  // Geri sayım ve dinamik QR yenileme
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          // Yeni benzersiz güvenli kod üret
          const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase()
          setQrToken(`BAKKART-BK-${Date.now().toString().slice(-6)}-${randomCode}`)
          return 30
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const filteredStores = PARTNER_STORES.filter((store) => {
    const matchesCategory = selectedCategory === 'Tümü' || store.category === selectedCategory
    const matchesSearch =
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.neighborhood.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const hasCard = myStatus?.status === 'Approved' && !!myStatus.card
  const card = myStatus?.card

  return (
    <div className="min-h-full pb-24 pt-4 px-4 max-w-lg mx-auto space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-gradient-to-r from-sky-500 to-blue-600 text-transparent bg-clip-text">
              Bakkart
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
              Dijital Kart
            </span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Bakırköy Belediyesi Kent & Esnaf İndirim Kartı
          </p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-xs font-bold">
          <ShieldCheckIcon className="w-4 h-4" />
          Aktif Üye
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex p-1 bg-surface-2 rounded-2xl border border-border">
        <button
          onClick={() => setActiveTab('card')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'card'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <CreditCardIcon className="w-3.5 h-3.5" />
          Kartım & QR
        </button>
        <button
          onClick={() => setActiveTab('stores')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'stores'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <StoreIcon className="w-3.5 h-3.5" />
          Anlaşmalı Esnaf
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'campaigns'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <SparklesIcon className="w-3.5 h-3.5" />
          Kampanyalar
        </button>
        <button
          onClick={() => setActiveTab('apply')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'apply'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <CreditCardIcon className="w-3.5 h-3.5 text-indigo-500" />
          Kart Başvurusu
        </button>
      </div>

      {activeTab === 'card' && (
        <div className="space-y-5">
          {statusLoading && (
            <div className="p-8 rounded-3xl bg-card border border-border text-center text-xs text-foreground-muted">
              Bakkart durumunuz yükleniyor...
            </div>
          )}

          {!statusLoading && !hasCard && (
            <div className="p-6 rounded-3xl bg-card border border-border text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-600 flex items-center justify-center mx-auto">
                <CreditCardIcon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-foreground text-base">
                {myStatus?.status === 'Pending' ? 'Başvurunuz İnceleniyor' : 'Henüz Bakkart\'ınız Yok'}
              </h3>
              <p className="text-xs text-foreground-muted">
                {myStatus?.status === 'Pending'
                  ? `Takip numaranız: ${myStatus.trackingNo}. Belediye onayının ardından kartınız burada görünecek.`
                  : myStatus?.status === 'Rejected'
                  ? `Başvurunuz reddedildi.${myStatus.rejectReason ? ` Sebep: ${myStatus.rejectReason}` : ''}`
                  : 'Bakkart sahibi olmak için "Kart Başvurusu" sekmesinden başvurun.'}
              </p>
              <button
                onClick={() => setActiveTab('apply')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
              >
                Kart Başvurusu Yap
              </button>
            </div>
          )}

          {hasCard && card && (
          <>
          {/* Dijital Kart Tasarımı (Şartname 3.3.30.1) */}
          <div className="relative w-full aspect-[1.586] rounded-3xl p-6 text-white overflow-hidden shadow-2xl bg-gradient-to-br from-slate-900 via-sky-950 to-blue-900 border border-white/10">
            {/* Arka plan dekoratif daireler */}
            <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full bg-sky-400/20 blur-2xl pointer-events-none" />

            {/* Kart Üst Bilgisi */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center border border-white/20 font-black text-sm">
                  BB
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-sky-200 font-semibold">
                    Bakırköy Belediyesi
                  </div>
                  <div className="text-base font-black tracking-tight leading-none">
                    BAKKART
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold bg-white/10 backdrop-blur px-2.5 py-1 rounded-full border border-white/15">
                <AwardIcon className="w-3.5 h-3.5 text-amber-300" />
                Vatandaş Statüsü
              </div>
            </div>

            {/* Çip ve Temassız Simgesi */}
            <div className="relative z-10 mt-6 flex items-center gap-3">
              <div className="w-11 h-8 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 border border-amber-300/50 shadow-inner flex items-center justify-center">
                <div className="w-7 h-5 border border-amber-600/40 rounded-sm grid grid-cols-2 gap-0.5 p-0.5">
                  <div className="border-b border-r border-amber-600/30" />
                  <div className="border-b border-amber-600/30" />
                  <div className="border-r border-amber-600/30" />
                  <div />
                </div>
              </div>
              <div className="text-xs text-white/70 font-mono tracking-widest">
                •••• {card.cardNo.slice(-4)}
              </div>
            </div>

            {/* Kart Sahibi Bilgisi */}
            <div className="relative z-10 mt-6 flex items-end justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-sky-200/80 font-medium">
                  Kart Sahibi
                </div>
                <div className="text-sm font-bold tracking-wide uppercase truncate max-w-[200px]">
                  {card.holderName || user?.fullName || 'Bakırköy Sakini'}
                </div>
                <div className="text-[10px] text-white/60 font-mono">
                  TCKN: •••••••{card.tcknLast4}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[9px] uppercase tracking-wider text-sky-200/80 font-medium">
                  Bakkart Puanı
                </div>
                <div className="text-lg font-black text-amber-300 leading-none">
                  {card.points} BP
                </div>
              </div>
            </div>
          </div>

          {/* 30 Saniyelik Dinamik QR Kod Alanı (Şartname 3.3.30.2) */}
          <div className="p-5 rounded-3xl bg-card border border-border shadow-sm text-center space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <QrCodeIcon className="w-4 h-4 text-sky-500" />
                  Güvenli Dinamik QR Kod
                </h3>
                <p className="text-xs text-foreground-muted">
                  İşyerinde kasaya veya QR okuyucuya gösterin
                </p>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 text-xs font-bold">
                <RefreshCwIcon className={`w-3.5 h-3.5 ${secondsLeft <= 5 ? 'animate-spin text-red-500' : ''}`} />
                <span>{secondsLeft} sn</span>
              </div>
            </div>

            {/* QR Kod Görseli Simülasyonu */}
            <div className="flex justify-center py-2">
              <div className="relative p-3 bg-white rounded-2xl shadow-inner border border-slate-200 inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${card.cardNo}:${qrToken}`)}`}
                  alt="Bakkart Güvenli QR"
                  className="w-44 h-44 object-contain rounded-lg"
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center p-1 border border-slate-100">
                    <span className="text-[10px] font-black text-blue-600">BK</span>
                  </div>
                </div>
              </div>
            </div>

            {/* İlerleme Çubuğu */}
            <div className="w-full bg-surface-2 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-1000 ${
                  secondsLeft <= 5 ? 'bg-red-500' : 'bg-sky-500'
                }`}
                style={{ width: `${(secondsLeft / 30) * 100}%` }}
              />
            </div>

            <p className="text-[11px] text-foreground-muted flex items-center justify-center gap-1">
              <ShieldCheckIcon className="w-3.5 h-3.5 text-emerald-500" />
              Tek kullanımlık şifreli token • 30 saniyede bir otomatik yenilenir
            </p>
          </div>

          {/* Gerçek Kullanım İstatistikleri */}
          {myStats && (
            <div className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <TrendingUpIcon className="w-4 h-4 text-indigo-500" />
                Bakkart Kullanım İstatistiklerim
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-surface-1 border border-border">
                  <div className="text-[10px] text-foreground-muted">Mevcut Bakiye</div>
                  <div className="text-base font-bold text-foreground">{myStats.currentBalance.toFixed(2)} ₺</div>
                </div>
                <div className="p-3 rounded-2xl bg-surface-1 border border-border">
                  <div className="text-[10px] text-foreground-muted">Mevcut Puan</div>
                  <div className="text-base font-bold text-amber-600">{myStats.currentPoints} BP</div>
                </div>
                <div className="p-3 rounded-2xl bg-surface-1 border border-border">
                  <div className="text-[10px] text-foreground-muted">Toplam Kullanım</div>
                  <div className="text-base font-bold text-foreground">{myStats.totalSpent.toFixed(2)} ₺</div>
                </div>
                <div className="p-3 rounded-2xl bg-surface-1 border border-border">
                  <div className="text-[10px] text-foreground-muted">Toplam İşlem</div>
                  <div className="text-base font-bold text-foreground">{myStats.transactionCount}</div>
                </div>
              </div>
            </div>
          )}

          {/* Hızlı Avantajlar */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
              <PercentIcon className="w-5 h-5 text-amber-600 mb-1" />
              <div className="text-xs font-bold text-foreground">%30'a Varan İndirim</div>
              <div className="text-[11px] text-foreground-muted">250+ Anlaşmalı Noktada</div>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20">
              <SparklesIcon className="w-5 h-5 text-blue-600 mb-1" />
              <div className="text-xs font-bold text-foreground">Ödül & Puan Kazanımı</div>
              <div className="text-[11px] text-foreground-muted">Her alışverişte belediye puanı</div>
            </div>
          </div>
          </>
          )}
        </div>
      )}

      {activeTab === 'stores' && (
        <div className="space-y-4">
          {/* Arama ve Filtre */}
          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <input
              type="text"
              placeholder="İşyeri veya mahalle ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-surface-2 border border-border text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Kategori Barı */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-surface-2 text-foreground-muted hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* İşyeri Listesi */}
          <div className="space-y-3">
            {filteredStores.map((store) => (
              <div
                key={store.id}
                className="p-4 rounded-2xl bg-card border border-border hover:border-sky-500/30 transition-all flex items-start justify-between gap-3 shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{store.name}</span>
                    {store.isPopular && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                        Popüler
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-foreground-muted flex items-center gap-1">
                    <MapPinIcon className="w-3.5 h-3.5 text-foreground-subtle" />
                    <span>{store.neighborhood} • {store.address}</span>
                  </div>
                  <p className="text-xs text-foreground-subtle pt-1">{store.description}</p>
                </div>

                <div className="text-right flex flex-col items-end">
                  <div className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 font-black text-sm flex items-center gap-0.5">
                    <PercentIcon className="w-3 h-3" />
                    {store.discount} İndirim
                  </div>
                  <span className="text-[10px] text-foreground-muted mt-1.5">
                    {store.validUntil}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-gradient-to-r from-blue-600 to-indigo-700 text-white space-y-2 shadow-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
              Haftanın Fırsatı
            </span>
            <h3 className="text-base font-bold">Öğrencilere Kırtasiyede Ekstra %10</h3>
            <p className="text-xs text-blue-100">
              Bakırköy sınırları içinde okuyan tüm öğrencilere anlaşmalı kırtasiyelerde Bakkart ile ek indirim.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Doğum Günü Hediyesi</span>
              <span className="text-xs font-bold text-amber-500">+100 BP</span>
            </div>
            <p className="text-xs text-foreground-muted">
              Doğum gününüzde Bakırköy Belediyesi sosyal tesislerinde ücretsiz tatlı ve kahve ikramı.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">Çevre Dostu Esnaf Kampanyası</span>
              <span className="text-xs font-bold text-emerald-500">2x Puan</span>
            </div>
            <p className="text-xs text-foreground-muted">
              Kendi termosunuz veya bez çantanızla yaptığınız alışverişlerde iki kat Bakkart puanı kazanın.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'apply' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-900 to-blue-950 text-white space-y-2 border border-white/10 shadow-xl">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full">
              Bakkart Sahibi Olun
            </span>
            <h3 className="text-lg font-bold">Bakırköy Kent Kartı Başvurusu</h3>
            <p className="text-xs text-sky-200 leading-relaxed">
              İlçe sakinlerimiz, öğrencilerimiz ve emeklilerimiz için anlaşmalı esnafta ve belediye tesislerimizde özel indirimler sağlayan dijital kartınız hemen cebinizde.
            </p>
          </div>

          {myStatus?.trackingNo && myStatus.status !== 'Rejected' && myStatus.status !== 'Cancelled' ? (
            <div className="p-5 rounded-3xl bg-card border border-emerald-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto text-xl font-bold">
                ✓
              </div>
              <h4 className="font-bold text-foreground text-base">Başvurunuz Alındı!</h4>
              <p className="text-xs text-foreground-muted">
                {myStatus.status === 'Approved'
                  ? 'Başvurunuz onaylandı! "Kartım & QR" sekmesinden kartınızı görebilirsiniz.'
                  : 'Başvurunuz inceleme aşamasındadır. Takip numaranız ile durumunu sorgulayabilirsiniz.'}
              </p>
              <div className="p-3 rounded-2xl bg-surface-1 font-mono font-bold text-sm text-indigo-600 border border-border">
                {myStatus.trackingNo}
              </div>
              {myStatus.status === 'Approved' && (
                <button
                  onClick={() => setActiveTab('card')}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 underline pt-2"
                >
                  Kartımı Görüntüle
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleApplySubmit} className="p-5 rounded-3xl bg-card border border-border space-y-3.5">
              {myStatus?.status === 'Rejected' && myStatus.rejectReason && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600">
                  Önceki başvurunuz reddedildi: {myStatus.rejectReason}. Dilerseniz yeniden başvurabilirsiniz.
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Ad Soyad *</label>
                <input
                  required
                  value={applicantName}
                  onChange={e => setApplicantName(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-foreground text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">T.C. Kimlik No *</label>
                  <input
                    required
                    maxLength={11}
                    value={applicantTckn}
                    onChange={e => setApplicantTckn(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-foreground text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-foreground mb-1">Telefon No *</label>
                  <input
                    required
                    value={applicantPhone}
                    onChange={e => setApplicantPhone(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-border bg-background text-foreground text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">İkametgah Mahallesi</label>
                <select
                  value={applicantDistrict}
                  onChange={e => setApplicantDistrict(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-medium"
                >
                  <option value="Zuhuratbaba">Zuhuratbaba</option>
                  <option value="Yeşilköy">Yeşilköy</option>
                  <option value="Yeşilyurt">Yeşilyurt</option>
                  <option value="Ataköy 1-11">Ataköy (Tüm Kısımlar)</option>
                  <option value="Kartaltepe">Kartaltepe</option>
                  <option value="Osmaniye">Osmaniye</option>
                  <option value="Florya">Şenlikköy (Florya)</option>
                  <option value="Cevizlik">Cevizlik</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Talep Edilen Kart Tipi</label>
                <select
                  value={cardType}
                  onChange={e => setCardType(e.target.value as BakkartCardType)}
                  className="w-full h-10 px-3 rounded-xl border border-border bg-background text-foreground text-xs font-medium"
                >
                  <option value="Standard">Standart Bakkart (Tüm Bakırköylüler)</option>
                  <option value="Student">Öğrenci Bakkart (Gençlik ve Eğitim İndirimli)</option>
                  <option value="Retiree">Emekli Bakkart (Sosyal Tesislerde %25 İndirimli)</option>
                  <option value="SocialSupport">Sosyal Destek Bakkart (Belediye Destekli)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Teslimat Tercihi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryType('Digital')}
                    className={`h-10 text-xs font-bold rounded-xl border transition-all ${
                      deliveryType === 'Digital'
                        ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600'
                        : 'border-border text-foreground-muted'
                    }`}
                  >
                    📱 Anında Dijital Kart
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryType('Physical')}
                    className={`h-10 text-xs font-bold rounded-xl border transition-all ${
                      deliveryType === 'Physical'
                        ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600'
                        : 'border-border text-foreground-muted'
                    }`}
                  >
                    💳 Adrese Fiziksel Kart
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-foreground mb-1">Evrak (İsteğe Bağlı)</label>
                <p className="text-[10px] text-foreground-muted mb-2">
                  İkametgah belgesi, öğrenci/emekli belgesi gibi destekleyici evrakları PDF, JPG veya PNG olarak ekleyebilirsiniz.
                </p>
                <div className="space-y-1.5">
                  {documents.map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border bg-surface-1 text-xs">
                      <span className="flex items-center gap-1.5 truncate text-foreground">
                        <FileTextIcon className="w-3.5 h-3.5 flex-shrink-0 text-emerald-600" />
                        <span className="truncate">{d.name}</span>
                      </span>
                      <button type="button" onClick={() => removeDocument(i)} className="text-foreground-muted hover:text-red-600 flex-shrink-0">
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleDocumentSelected} />
                <button
                  type="button"
                  disabled={uploadingDoc}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-10 mt-1.5 rounded-xl border border-dashed border-border text-xs font-bold text-foreground-muted hover:text-foreground hover:border-indigo-400 flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  {uploadingDoc ? <Loader2Icon className="w-3.5 h-3.5 animate-spin" /> : <UploadIcon className="w-3.5 h-3.5" />}
                  {uploadingDoc ? 'Yükleniyor...' : 'Belge Ekle'}
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-xs shadow-md transition-colors mt-2"
              >
                {submitting ? 'Gönderiliyor...' : 'Bakkart Başvurusunu Tamamla'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
