import { useState } from 'react'
import {
  CreditCardIcon,
  ReceiptIcon,
  CalculatorIcon,
  SearchIcon,
  Building2Icon,
  DownloadIcon,
  CheckCircle2Icon,
  ArrowRightIcon,
  LandmarkIcon,
  CompassIcon
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/framework/auth/AuthContext'

interface DebtItem {
  id: string
  type: string
  period: string
  dueDate: string
  amount: number
  penalty: number
  selected: boolean
}

interface ReceiptItem {
  id: string
  receiptNo: string
  date: string
  type: string
  amount: number
  channel: string
}

export const EBelediyePage = () => {
  const { state } = useAuth()
  const user = state.status === 'authenticated' ? state.user : null

  const [activeSection, setActiveSection] = useState<'borc' | 'imar' | 'tahsilat' | 'rayic'>('borc')

  // Borç Sorgulama State
  const [debts, setDebts] = useState<DebtItem[]>([
    {
      id: 'd1',
      type: 'Bina Vergisi (1. Taksit)',
      period: '2026/1',
      dueDate: '31.05.2026',
      amount: 1450.0,
      penalty: 0,
      selected: true
    },
    {
      id: 'd2',
      type: 'Çevre Temizlik Vergisi',
      period: '2026/1',
      dueDate: '31.05.2026',
      amount: 320.5,
      penalty: 0,
      selected: true
    },
    {
      id: 'd3',
      type: 'İlan ve Reklam Vergisi',
      period: '2025/2',
      dueDate: '30.11.2025',
      amount: 680.0,
      penalty: 45.2,
      selected: false
    }
  ])

  // Geçmiş Tahsilatlar
  const receipts: ReceiptItem[] = [
    {
      id: 'r1',
      receiptNo: 'BK-2025-89421',
      date: '28.11.2025',
      type: 'Bina Vergisi (2. Taksit)',
      amount: 1250.0,
      channel: 'Mobil Uygulama (3D Secure)'
    },
    {
      id: 'r2',
      receiptNo: 'BK-2025-45120',
      date: '15.05.2025',
      type: 'Çevre Temizlik Vergisi',
      amount: 280.0,
      channel: 'Belediye Veznesi'
    },
    {
      id: 'r3',
      receiptNo: 'BK-2024-99124',
      date: '20.11.2024',
      type: 'İmar Harcı Ödemesi',
      amount: 3450.0,
      channel: 'E-Belediye Kredi Kartı'
    }
  ]

  // E-İmar Formu
  const [neighborhood, setNeighborhood] = useState('Zuhuratbaba')
  const [ada, setAda] = useState('1452')
  const [parsel, setParsel] = useState('38')
  const imarResult = {
    status: 'Yapılaşmaya Uygun (Konut Alanı)',
    planFunction: 'Ayrık Nizam 4 Kat Konut Alanı',
    taks: '0.35',
    kaks: '1.40',
    maxHeight: '12.50 metre (Hmax)',
    zoningPlan: 'Bakırköy 1/1000 Ölçekli Uygulama İmar Planı'
  }

  // Rayiç Sorgulama
  const [streetQuery, setStreetQuery] = useState('')
  const rayicResults = [
    { street: 'İncirli Caddesi', neighborhood: 'Zuhuratbaba', year: '2026', value: '45.200 TL / m²' },
    { street: 'Fahri Korutürk Caddesi', neighborhood: 'Cevizlik', year: '2026', value: '58.500 TL / m²' },
    { street: 'Ebuziya Caddesi', neighborhood: 'Zeytinlik', year: '2026', value: '52.000 TL / m²' },
    { street: 'Mor Sümbül Sokak', neighborhood: 'Ataköy 5. Kısım', year: '2026', value: '38.400 TL / m²' }
  ]

  const toggleDebt = (id: string) => {
    setDebts((prev) =>
      prev.map((d) => (d.id === id ? { ...d, selected: !d.selected } : d))
    )
  }

  const selectedTotal = debts
    .filter((d) => d.selected)
    .reduce((sum, d) => sum + d.amount + d.penalty, 0)

  return (
    <div className="min-h-full pb-24 pt-4 px-4 max-w-lg mx-auto space-y-5">
      {/* Üst Bilgi */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">
              E-Belediye
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
              Resmi Hizmetler
            </span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Bakırköy Belediyesi Dijital Hizmetler Portalı
          </p>
        </div>
        <div className="p-2 rounded-2xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
          <LandmarkIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Navigasyon Sekmeleri */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-surface-2 rounded-2xl border border-border">
        <button
          onClick={() => setActiveSection('borc')}
          className={`py-2 text-[11px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeSection === 'borc'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <CreditCardIcon className="w-3.5 h-3.5" />
          Borç Sorgula
        </button>
        <button
          onClick={() => setActiveSection('imar')}
          className={`py-2 text-[11px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeSection === 'imar'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <Building2Icon className="w-3.5 h-3.5" />
          E-İmar
        </button>
        <button
          onClick={() => setActiveSection('tahsilat')}
          className={`py-2 text-[11px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeSection === 'tahsilat'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <ReceiptIcon className="w-3.5 h-3.5" />
          Tahsilatlar
        </button>
        <button
          onClick={() => setActiveSection('rayic')}
          className={`py-2 text-[11px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeSection === 'rayic'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-foreground-muted hover:text-foreground'
          }`}
        >
          <CalculatorIcon className="w-3.5 h-3.5" />
          Arsa Rayiç
        </button>
      </div>

      {/* 1. BORÇ SORGULAMA VE ÖDEME */}
      {activeSection === 'borc' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-foreground-muted">Mükellef Bilgisi</div>
              <div className="text-sm font-bold text-foreground">{user?.fullName || 'Bakırköy Sakini'}</div>
              <div className="text-[11px] text-foreground-subtle font-mono">
                Sicil No: 94820194 • TCKN: {user?.tckn ? `•••••••${user.tckn.slice(-4)}` : '•••••••••••'}
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 text-[11px] font-bold">
              3 Borç Kaydı
            </div>
          </div>

          <div className="space-y-2.5">
            {debts.map((debt) => (
              <div
                key={debt.id}
                onClick={() => toggleDebt(debt.id)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  debt.selected
                    ? 'bg-sky-500/5 border-sky-500/40 shadow-sm'
                    : 'bg-card border-border hover:border-border-strong'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                      debt.selected
                        ? 'bg-sky-500 border-sky-500 text-white'
                        : 'border-border-strong bg-surface-1'
                    }`}
                  >
                    {debt.selected && <CheckCircle2Icon className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">{debt.type}</div>
                    <div className="text-[11px] text-foreground-muted">
                      Dönem: {debt.period} • Son Ödeme: {debt.dueDate}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-foreground">
                    {debt.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </div>
                  {debt.penalty > 0 && (
                    <div className="text-[10px] text-red-500 font-semibold">
                      +{debt.penalty} ₺ gecikme
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Toplam ve Ödeme Butonu */}
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-foreground-muted font-medium">Seçili Borç Toplamı:</span>
              <span className="text-lg font-black text-blue-600">
                {selectedTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </span>
            </div>
            <Link
              to="/odeme"
              state={{ amount: selectedTotal, title: 'Belediye Vergi Borcu Ödemesi' }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all"
            >
              <CreditCardIcon className="w-4 h-4" />
              Güvenli Ödeme Yap (3D Secure)
            </Link>
          </div>
        </div>
      )}

      {/* 2. E-İMAR SÜREÇLERİ */}
      {activeSection === 'imar' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <CompassIcon className="w-4 h-4 text-blue-500" />
              Ada / Parsel ile İmar Durumu Sorgulama
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-foreground-muted font-semibold block mb-1">
                  Mahalle
                </label>
                <select
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="w-full p-2 rounded-xl bg-surface-2 border border-border text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Zuhuratbaba">Zuhuratbaba</option>
                  <option value="Ataköy">Ataköy 1-11</option>
                  <option value="Yeşilköy">Yeşilköy</option>
                  <option value="Yeşilyurt">Yeşilyurt</option>
                  <option value="Florya">Şenlikköy (Florya)</option>
                  <option value="Osmaniye">Osmaniye</option>
                  <option value="Kartaltepe">Kartaltepe</option>
                  <option value="Cevizlik">Cevizlik</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-foreground-muted font-semibold block mb-1">
                  Ada No
                </label>
                <input
                  type="text"
                  value={ada}
                  onChange={(e) => setAda(e.target.value)}
                  className="w-full p-2 rounded-xl bg-surface-2 border border-border text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-foreground-muted font-semibold block mb-1">
                  Parsel No
                </label>
                <input
                  type="text"
                  value={parsel}
                  onChange={(e) => setParsel(e.target.value)}
                  className="w-full p-2 rounded-xl bg-surface-2 border border-border text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => {}}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <SearchIcon className="w-3.5 h-3.5" />
              İmar Durumunu Getir
            </button>
          </div>

          {imarResult && (
            <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border">
                <span className="text-xs font-bold text-foreground">
                  {neighborhood} Mah. Ada: {ada} / Parsel: {parsel}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                  {imarResult.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-foreground-muted block text-[10px]">Plan Fonksiyonu:</span>
                  <span className="font-bold text-foreground">{imarResult.planFunction}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">Maksimum Yükseklik:</span>
                  <span className="font-bold text-foreground">{imarResult.maxHeight}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">TAKS (Taban Alanı):</span>
                  <span className="font-bold text-foreground">{imarResult.taks}</span>
                </div>
                <div>
                  <span className="text-foreground-muted block text-[10px]">KAKS (Emsal):</span>
                  <span className="font-bold text-foreground">{imarResult.kaks}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border flex gap-2">
                <button className="flex-1 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-foreground text-xs font-bold flex items-center justify-center gap-1.5 border border-border">
                  <DownloadIcon className="w-3.5 h-3.5 text-blue-500" />
                  İmar Çapı İndir (PDF)
                </button>
                <Link
                  to="/imar"
                  className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 text-xs font-bold flex items-center justify-center gap-1"
                >
                  Ruhsat Başvurusu
                  <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. GEÇMİŞ TAHSİLATLAR */}
      {activeSection === 'tahsilat' && (
        <div className="space-y-3">
          {receipts.map((rec) => (
            <div
              key={rec.id}
              className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-bold text-foreground">{rec.type}</div>
                <div className="text-[11px] text-foreground-muted">
                  Makbuz: {rec.receiptNo} • {rec.date}
                </div>
                <div className="text-[10px] text-foreground-subtle">{rec.channel}</div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="text-sm font-black text-foreground">
                  {rec.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                </div>
                <button className="mt-1 px-2 py-0.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-[10px] font-bold text-blue-600 flex items-center gap-1 border border-border">
                  <DownloadIcon className="w-3 h-3" />
                  Makbuz
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. ARSA RAYİÇ DEĞERLERİ */}
      {activeSection === 'rayic' && (
        <div className="space-y-4">
          <div className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
            <input
              type="text"
              placeholder="Cadde veya sokak adı yazın..."
              value={streetQuery}
              onChange={(e) => setStreetQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-surface-2 border border-border text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2.5">
            {rayicResults
              .filter((r) =>
                r.street.toLowerCase().includes(streetQuery.toLowerCase()) ||
                r.neighborhood.toLowerCase().includes(streetQuery.toLowerCase())
              )
              .map((r, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-foreground">{r.street}</div>
                    <div className="text-[11px] text-foreground-muted">
                      {r.neighborhood} Mah. • {r.year} Yılı
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-blue-600">{r.value}</div>
                    <div className="text-[9px] text-foreground-subtle">Metrekare Birim Fiyatı</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
