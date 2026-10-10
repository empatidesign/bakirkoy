import { useState } from 'react'
import {
  GraduationCapIcon,
  HomeIcon,
  BookOpenIcon,
  ClipboardListIcon,
  UsersIcon,
  WifiIcon,
  CoffeeIcon
} from 'lucide-react'

export const GenclikPage = () => {
  const [activeTab, setActiveTab] = useState<'etut' | 'yurt' | 'etut-form' | 'yurt-form'>('etut')
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  return (
    <div className="min-h-full pb-24 pt-4 px-4 max-w-lg mx-auto space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-transparent bg-clip-text">
              Gençlik Hizmetleri
            </span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Bakırköy Belediyesi Gençlik ve Eğitim Merkezleri
          </p>
        </div>
        <div className="p-2 rounded-2xl bg-purple-500/10 text-purple-600 border border-purple-500/20">
          <GraduationCapIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Sekmeler (Şartname 3.3.21.1) */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-surface-2 rounded-2xl border border-border">
        <button
          onClick={() => { setActiveTab('etut'); setSuccessNotice(null) }}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'etut' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <BookOpenIcon className="w-3.5 h-3.5" />
          Etüt Merkezi
        </button>
        <button
          onClick={() => { setActiveTab('yurt'); setSuccessNotice(null) }}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'yurt' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <HomeIcon className="w-3.5 h-3.5" />
          Kız Yurdu
        </button>
        <button
          onClick={() => { setActiveTab('etut-form'); setSuccessNotice(null) }}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'etut-form' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <ClipboardListIcon className="w-3.5 h-3.5" />
          Etüt Başvurusu
        </button>
        <button
          onClick={() => { setActiveTab('yurt-form'); setSuccessNotice(null) }}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'yurt-form' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <UsersIcon className="w-3.5 h-3.5" />
          Yurt Başvurusu
        </button>
      </div>

      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-bold text-center">
          {successNotice}
        </div>
      )}

      {/* 1. ETÜT MERKEZİ TANITIMI */}
      {activeTab === 'etut' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-foreground">Bakırköy Gençlik Etüt ve Gelişim Merkezi</h3>
            <p className="text-xs text-foreground-muted leading-relaxed">
              YKS ve LGS sınavlarına hazırlanan gençlerimiz için modern sessiz çalışma salonları, birebir soru çözüm odaları, rehberlik servisi ve sınırsız internet desteği.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div className="p-2.5 rounded-xl bg-surface-2 flex items-center gap-2">
                <WifiIcon className="w-4 h-4 text-purple-500" />
                <span>Fiber İnternet</span>
              </div>
              <div className="p-2.5 rounded-xl bg-surface-2 flex items-center gap-2">
                <CoffeeIcon className="w-4 h-4 text-purple-500" />
                <span>Ücretsiz Çay & Çorba</span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('etut-form')}
              className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs"
            >
              Hemen Kayıt Başvurusu Yap
            </button>
          </div>
        </div>
      )}

      {/* 2. KIZ YURDU TANITIMI */}
      {activeTab === 'yurt' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">Bakırköy Yükseköğrenim Kız Öğrenci Yurdu</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600">
                120 Yatak Kapasitesi
              </span>
            </div>
            <p className="text-xs text-foreground-muted leading-relaxed">
              Üniversite eğitimi için İstanbul'a gelen kız öğrencilerimize güvenli, konforlu, metro ve metrobüse yürüme mesafesinde çağdaş barınma imkanı.
            </p>
            <div className="space-y-1.5 text-xs text-foreground-subtle border-t border-border pt-2">
              <div>✓ 24 Saat Güvenlik ve Kartlı Geçiş Sistemi</div>
              <div>✓ Sabah Kahvaltısı ve Akşam Yemeği</div>
              <div>✓ Çamaşırhane ve Ütü Odaları</div>
              <div>✓ Etüt Salonu ve Dinlenme Alanı</div>
            </div>
            <button
              onClick={() => setActiveTab('yurt-form')}
              className="w-full py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs"
            >
              Yurt Ön Başvuru Formunu Doldur
            </button>
          </div>
        </div>
      )}

      {/* 3. ETÜT MERKEZİ BAŞVURU FORMU */}
      {activeTab === 'etut-form' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccessNotice('Etüt Merkezi kayıt başvurunuz alındı. Giriş kartınız hazırlanacaktır.')
          }}
          className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">Etüt Merkezi Ön Kayıt Formu</h3>
          <div>
            <label className="text-[10px] font-bold text-foreground-muted block mb-1">Hedef Sınav / Düzey</label>
            <select className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
              <option>YKS (Üniversiteye Hazırlık)</option>
              <option>LGS (Liseye Geçiş)</option>
              <option>KPSS / DGS</option>
              <option>Üniversite Serbest Çalışma</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-foreground-muted block mb-1">Okul / Mezuniyet Bilgisi</label>
            <input type="text" placeholder="Örn: Bakırköy Anadolu Lisesi (12. Sınıf)" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md shadow-purple-500/20">
            Etüt Kaydını Onayla
          </button>
        </form>
      )}

      {/* 4. KIZ YURDU BAŞVURU FORMU */}
      {activeTab === 'yurt-form' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccessNotice('Kız Öğrenci Yurdu ön başvurunuz kaydedildi. Komisyon değerlendirmesi sonucunda SMS ile bilgilendirileceksiniz.')
          }}
          className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">Kız Yurdu Yeni Dönem Başvuru Formu</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Üniversite</label>
              <input type="text" placeholder="Örn: İstanbul Üniv." required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Bölüm / Sınıf</label>
              <input type="text" placeholder="Örn: Hukuk (1. Sınıf)" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-foreground-muted block mb-1">Öğrenci Belgesi (PDF)</label>
            <input type="file" className="w-full p-2 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-purple-600 text-white text-xs font-bold shadow-md shadow-purple-500/20">
            Yurt Başvurusunu Gönder
          </button>
        </form>
      )}
    </div>
  )
}
