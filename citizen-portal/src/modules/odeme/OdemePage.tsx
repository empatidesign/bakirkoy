import { useState } from 'react'
import {
  CreditCardIcon,
  ShieldCheckIcon,
  CheckCircle2Icon,
  XCircleIcon,
  DownloadIcon,
  LockIcon,
  TicketIcon,
  BuildingIcon,
  TrophyIcon,
  CompassIcon,
  FileCheckIcon
} from 'lucide-react'
import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/framework/auth/AuthContext'
import { ModuleHeader } from '@/design-system'

interface PaymentCategory {
  id: string
  title: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  amount: number
  code: string
}

const PAYMENT_CATEGORIES: PaymentCategory[] = [
  {
    id: 'vergi',
    title: 'Emlak, Çevre ve İşyeri Vergisi',
    subtitle: '2026/1. Dönem bina ve çevre temizlik vergileri',
    icon: BuildingIcon,
    amount: 1770.5,
    code: 'VRG-2026-01'
  },
  {
    id: 'tiyatro',
    title: 'Tiyatro Bileti Ücreti',
    subtitle: 'Leyla Gencer Sahnesi & BBT Oyun Biletleri',
    icon: TicketIcon,
    amount: 150.0,
    code: 'TYT-8821'
  },
  {
    id: 'spor',
    title: 'Spor Hizmeti Ödemesi',
    subtitle: 'Yüzme havuzu, fitness ve tenis kortu seansları',
    icon: TrophyIcon,
    amount: 450.0,
    code: 'SPR-4912'
  },
  {
    id: 'eksper',
    title: 'E-Eksper Hizmet Bedeli',
    subtitle: 'Gayrimenkul ekspertiz ve belediye arşiv inceleme harcı',
    icon: CompassIcon,
    amount: 850.0,
    code: 'EKP-1049'
  },
  {
    id: 'imar',
    title: 'İmar Harcı Ödemesi',
    subtitle: 'Ruhsat ve yapı denetim belediye tasdik harçları',
    icon: FileCheckIcon,
    amount: 3200.0,
    code: 'IMR-6623'
  }
]

export const OdemePage = () => {
  const { state: authState } = useAuth()
  const user = authState.status === 'authenticated' ? authState.user : null
  const location = useLocation()
  const locationState = location.state as { amount?: number; title?: string } | null

  // Adımlar: 1: Seçim/Tutar, 2: Kart Bilgisi, 3: 3D Secure Doğrulama, 4: Sonuç/Dekont
  const [step, setStep] = useState<1 | 2 | 3 | 4>(locationState ? 2 : 1)
  const [selectedCat, setSelectedCat] = useState<PaymentCategory>(
    PAYMENT_CATEGORIES[0]
  )
  const [customAmount, setCustomAmount] = useState<number>(
    locationState?.amount || selectedCat.amount
  )

  // Kart Bilgileri
  const [cardNumber, setCardNumber] = useState('4543 •••• •••• 9812')
  const [cardHolder, setCardHolder] = useState(user?.fullName || 'BAKIRKÖY SAKİNİ')
  const [expiry, setExpiry] = useState('12/28')
  const [cvv, setCvv] = useState('742')

  // 3D Secure SMS Kodu
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(true)
  const [receiptNumber, setReceiptNumber] = useState('')

  const handleSelectCategory = (cat: PaymentCategory) => {
    setSelectedCat(cat)
    setCustomAmount(cat.amount)
    setStep(2)
  }

  const handleProceedTo3D = (e: React.FormEvent) => {
    e.preventDefault()
    setStep(3)
  }

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault()
    if (otpCode.length === 6) {
      setReceiptNumber(`DEKONT-BK-${Date.now().toString().slice(-8)}`)
      setPaymentSuccess(true)
      setStep(4)
    } else {
      setOtpError(true)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <ModuleHeader
        icon={CreditCardIcon}
        title="Ödeme İşlemleri"
        subtitle="Güvenli tahsilat portalı (3D Secure destekli)"
        gradient="linear-gradient(160deg, #1e3a5f 0%, #1e40af 55%, #3b82f6 100%)"
        actions={<ShieldCheckIcon className="h-5 w-5 text-white/70" />}
      />
      <div className="flex-1 overflow-y-auto">
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto space-y-5">
      {/* ADIM 1: ÖDEME BAŞLIĞI SEÇİMİ (Şartname 3.3.14.3) */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-foreground-muted px-1">
            Ödeme Yapmak İstediğiniz Hizmeti Seçin:
          </div>
          <div className="space-y-2.5">
            {PAYMENT_CATEGORIES.map((cat) => {
              const Icon = cat.icon
              return (
                <div
                  key={cat.id}
                  onClick={() => handleSelectCategory(cat)}
                  className="p-4 rounded-2xl bg-card border border-border hover:border-blue-500/40 shadow-sm flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center border border-blue-500/20">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">{cat.title}</div>
                      <div className="text-[11px] text-foreground-muted">{cat.subtitle}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-blue-600">
                      {cat.amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                    </div>
                    <span className="text-[10px] text-foreground-subtle font-mono">{cat.code}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ADIM 2: KREDİ KARTI GİRİŞİ (Şartname 3.3.14.5) */}
      {step === 2 && (
        <form onSubmit={handleProceedTo3D} className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <span className="text-[10px] text-foreground-muted uppercase font-bold">Ödeme Kalemi</span>
              <div className="text-xs font-bold text-foreground">{locationState?.title || selectedCat.title}</div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-foreground-muted uppercase font-bold">Tutar</span>
              <div className="text-base font-black text-blue-600">
                {customAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-foreground-muted block mb-1">
                Kart Numarası
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  placeholder="0000 0000 0000 0000"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-2 border border-border text-xs font-mono text-foreground focus:ring-2 focus:ring-blue-500"
                />
                <CreditCardIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-foreground-muted block mb-1">
                Kart Üzerindeki İsim
              </label>
              <input
                type="text"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                placeholder="AD SOYAD"
                required
                className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-xs uppercase text-foreground focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-foreground-muted block mb-1">
                  Son Kullanma Tarihi
                </label>
                <input
                  type="text"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="AA/YY"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-xs font-mono text-center text-foreground focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-foreground-muted block mb-1">
                  CVV / Güvenlik Kodu
                </label>
                <div className="relative">
                  <input
                    type="password"
                    maxLength={3}
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    placeholder="•••"
                    required
                    className="w-full px-3 py-2.5 rounded-xl bg-surface-2 border border-border text-xs font-mono text-center text-foreground focus:ring-2 focus:ring-blue-500"
                  />
                  <LockIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-foreground-muted" />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
            >
              <LockIcon className="w-4 h-4" />
              3D Secure Onayına İlerle
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full py-2 text-xs text-foreground-muted hover:text-foreground mt-2 font-medium"
            >
              Geri Dön
            </button>
          </div>
        </form>
      )}

      {/* ADIM 3: 3D SECURE ONAYI */}
      {step === 3 && (
        <form onSubmit={handleVerifyOtp} className="p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center mx-auto border border-blue-500/20">
            <ShieldCheckIcon className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">3D Secure Doğrulama</h3>
            <p className="text-xs text-foreground-muted">
              Bankanızda kayıtlı 05•• ••• 48 29 nolu telefonunuza gelen 6 haneli doğrulama kodunu giriniz.
            </p>
          </div>

          <div className="py-2">
            <input
              type="text"
              maxLength={6}
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value)
                setOtpError(false)
              }}
              placeholder="123456"
              className="w-48 mx-auto text-center text-2xl font-mono font-black tracking-widest p-3 rounded-2xl bg-surface-2 border border-border focus:ring-2 focus:ring-blue-500 text-foreground"
            />
            {otpError && (
              <span className="text-[11px] text-red-500 font-semibold block mt-1">
                Lütfen 6 haneli SMS kodunu giriniz.
              </span>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
          >
            Ödemeyi Tamamla ({customAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺)
          </button>
        </form>
      )}

      {/* ADIM 4: SONUÇ VE DEKONT (Şartname 3.3.14.6 & 3.3.14.7) */}
      {step === 4 && (
        <div className="p-6 rounded-3xl bg-card border border-border shadow-sm text-center space-y-4">
          {paymentSuccess ? (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2Icon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-600 px-2 py-0.5 rounded-full bg-emerald-500/10">
                  Ödeme Başarılı
                </span>
                <h3 className="text-lg font-bold text-foreground mt-2">
                  Tahsilat İşlemi Gerçekleşti
                </h3>
                <p className="text-xs text-foreground-muted">
                  Ödemeniz belediye tahsilat sistemine kaydedilmiştir.
                </p>
              </div>

              {/* Dekont Özeti */}
              <div className="p-4 rounded-2xl bg-surface-2 border border-border text-left space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Makbuz / Dekont No:</span>
                  <span className="font-mono font-bold text-foreground">{receiptNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Tarih:</span>
                  <span className="font-bold text-foreground">{new Date().toLocaleDateString('tr-TR')} {new Date().toLocaleTimeString('tr-TR').slice(0, 5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Ödeme Kalemi:</span>
                  <span className="font-bold text-foreground">{selectedCat.title}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="font-bold text-foreground">Ödenen Tutar:</span>
                  <span className="text-sm font-black text-blue-600">
                    {customAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
                  </span>
                </div>
              </div>

              {/* Butonlar */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => alert('Dekont PDF olarak indiriliyor...')}
                  className="w-full py-3 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-blue-500/20"
                >
                  <DownloadIcon className="w-4 h-4" />
                  Makbuz / Dekont İndir (PDF)
                </button>
                <Link
                  to="/e-belediye"
                  className="block w-full py-2.5 rounded-xl bg-surface-2 text-foreground text-xs font-bold border border-border"
                >
                  E-Belediye Menüsüne Dön
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto border border-red-500/20">
                <XCircleIcon className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-foreground">Ödeme Başarısız</h3>
              <p className="text-xs text-foreground-muted">
                Banka işlemi onaylamadı. Lütfen kart limitinizi kontrol edip tekrar deneyiniz.
              </p>
              <button
                onClick={() => setStep(2)}
                className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                Tekrar Dene
              </button>
            </>
          )}
        </div>
      )}
    </div>
      </div>
    </div>
  )
}
