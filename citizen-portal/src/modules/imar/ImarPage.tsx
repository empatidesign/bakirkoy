import { useState } from 'react'
import {
  BuildingIcon,
  CompassIcon,
  FileCheckIcon,
  LayersIcon
} from 'lucide-react'

export const ImarPage = () => {
  const [activeTab, setActiveTab] = useState<'kotkesit' | 'ruhsat' | 'iskan'>('kotkesit')
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  return (
    <div className="min-h-full pb-24 pt-4 px-4 max-w-lg mx-auto space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-gradient-to-r from-indigo-600 to-blue-600 text-transparent bg-clip-text">
              İmar Hizmetleri
            </span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            İmar Durumu, Ruhsat ve İskân Başvuru Süreçleri
          </p>
        </div>
        <div className="p-2 rounded-2xl bg-indigo-500/10 text-indigo-600 border border-indigo-500/20">
          <BuildingIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Sekmeler (Şartname 3.3.24.1) */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-2 rounded-2xl border border-border">
        <button
          onClick={() => { setActiveTab('kotkesit'); setSuccessNotice(null) }}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'kotkesit' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <CompassIcon className="w-3.5 h-3.5" />
          Kot Kesit / Çap
        </button>
        <button
          onClick={() => { setActiveTab('ruhsat'); setSuccessNotice(null) }}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'ruhsat' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <FileCheckIcon className="w-3.5 h-3.5" />
          İmar Ruhsatı
        </button>
        <button
          onClick={() => { setActiveTab('iskan'); setSuccessNotice(null) }}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'iskan' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <LayersIcon className="w-3.5 h-3.5" />
          İskân Başvurusu
        </button>
      </div>

      {successNotice && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-bold text-center">
          {successNotice}
        </div>
      )}

      {/* 1. KOT KESİT - İSTİKAMET BAŞVURUSU */}
      {activeTab === 'kotkesit' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccessNotice('İmar Durumu & Kot Kesit başvurunuz alındı. Başvuru takip numaranız SMS ile iletilecektir.')
          }}
          className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">İmar Durumu - Kot Kesit - İstikamet Başvurusu</h3>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Mahalle</label>
              <select className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
                <option>Zuhuratbaba</option>
                <option>Ataköy</option>
                <option>Yeşilköy</option>
                <option>Yeşilyurt</option>
                <option>Florya</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Ada</label>
              <input type="text" placeholder="Ada no" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Parsel</label>
              <input type="text" placeholder="Parsel no" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-foreground-muted block mb-1">Tapu Fotokopisi / Belge Yükle</label>
            <input type="file" className="w-full p-2 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20">
            Kot Kesit Başvurusunu Tamamla
          </button>
        </form>
      )}

      {/* 2. İMAR RUHSAT BAŞVURUSU */}
      {activeTab === 'ruhsat' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccessNotice('Yeni Yapı Ruhsatı başvurunuz İmar Müdürlüğü ön inceleme masasına iletildi.')
          }}
          className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">Yeni Yapı / Tadilat Ruhsat Başvurusu</h3>
          <div>
            <label className="text-[10px] font-bold text-foreground-muted block mb-1">Ruhsat Türü</label>
            <select className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
              <option>Yeni Yapı Ruhsatı</option>
              <option>Esaslı Tadilat Ruhsatı</option>
              <option>İlave Kat / Eklenti Ruhsatı</option>
              <option>Yenileme (Ruhsat Temdidi)</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Müellif Mimar/Mühendis</label>
              <input type="text" placeholder="Oda Sicil No" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Yapı Denetim Firması</label>
              <input type="text" placeholder="Firma Adı" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
            </div>
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20">
            Ruhsat Başvurusunu Gönder
          </button>
        </form>
      )}

      {/* 3. İSKÂN (YAPI KULLANMA İZİN BELGESİ) BAŞVURUSU */}
      {activeTab === 'iskan' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccessNotice('İskân ve Yapı Kullanma İzni başvurunuz kaydedildi. Saha denetim randevusu planlanacaktır.')
          }}
          className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">İskân (Yapı Kullanma İzni) Başvurusu</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Ruhsat Numarası</label>
              <input type="text" placeholder="Örn: 2024/148" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Ruhsat Tarihi</label>
              <input type="date" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-foreground-muted block mb-1">SGK İlişiksiz Belgesi & İtfaiye Uygunluk</label>
            <input type="file" className="w-full p-2 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md shadow-indigo-500/20">
            İskân İnceleme Başvurusu Yap
          </button>
        </form>
      )}
    </div>
  )
}
