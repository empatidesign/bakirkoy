import { useState } from 'react'
import {
  HeartHandshakeIcon,
  FileTextIcon,
  BadgePercentIcon,
  Building2Icon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  DownloadIcon,
  MapPinIcon,
  PhoneIcon
} from 'lucide-react'

export const NikahPage = () => {
  const [activeTab, setActiveTab] = useState<'salonlar' | 'belgeler' | 'ucretler' | 'randevu'>('salonlar')

  const SALONLAR = [
    {
      id: 's1',
      name: 'Yunus Emre Kültür Merkezi Nikah Salonu',
      address: 'Ataköy 9. Kısım Mimar Sinan Köprüsü Yanı',
      capacity: '450 Kişilik',
      features: ['Merkezi İklimlendirme', 'Geniş Otopark', 'Kokteyl Alanı', 'Canlı Yayın Sistemi'],
      phone: '0212 414 96 00'
    },
    {
      id: 's2',
      name: 'Bakırköy Belediyesi Florya Nikah Salonu',
      address: 'Şenlikköy Mah. Florya Sahil Cad. No:32',
      capacity: '250 Kişilik',
      features: ['Deniz Manzaralı', 'Kır Bahçesi', 'Fotoğraf Stüdyosu', 'Engelsiz Erişim'],
      phone: '0212 414 97 50'
    }
  ]

  const BELGELER = [
    'Çiftlerin fotoğraflı T.C. Kimlik Kartları veya Nüfus Cüzdanları (Asılları ve fotokopileri)',
    'Evlenme Sağlık Raporu (Aile hekimliğinden veya devlet hastanesinden fotoğraflı, imzalı ve kaşeli)',
    'Son 6 ay içinde çekilmiş 4\'er adet vesikalık fotoğraf (Biyometrik fotoğraf kabul edilmez)',
    'İkametgah Belgesi (Çiftlerden en az birinin Bakırköy ilçe sınırlarında ikamet etmesi gerekmektedir)',
    '18 yaşını doldurmamış adaylar için yasal temsilci muvafakatnamesi veya mahkeme kararı'
  ]

  const UCRETLER = [
    { type: 'Hafta İçi Salon Nikahı (Mesai Saatleri)', fee: '1.250 TL', extra: 'Uluslararası Aile Cüzdanı dahil' },
    { type: 'Hafta Sonu Salon Nikahı', fee: '2.500 TL', extra: 'Kokteyl salonu kullanımı ve müzik dahil' },
    { type: 'Dış Mekan / Özel Mekan Nikahı (Hafta Sonu)', fee: '4.800 TL', extra: 'Nikah memuru intikali' },
    { type: 'Uluslararası Aile Cüzdanı Bedeli', fee: '705 TL', extra: 'Maliye Bakanlığı resmi harcı' }
  ]

  return (
    <div className="min-h-full pb-24 pt-4 px-4 max-w-lg mx-auto space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-gradient-to-r from-pink-500 to-rose-600 text-transparent bg-clip-text">
              Nikah İşlemleri
            </span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Bakırköy Belediyesi Evlendirme Memurluğu
          </p>
        </div>
        <div className="p-2 rounded-2xl bg-pink-500/10 text-pink-600 border border-pink-500/20">
          <HeartHandshakeIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Sekmeler (Şartname 3.3.26.1) */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-surface-2 rounded-2xl border border-border">
        <button
          onClick={() => setActiveTab('salonlar')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'salonlar' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <Building2Icon className="w-3.5 h-3.5" />
          Salonlar
        </button>
        <button
          onClick={() => setActiveTab('belgeler')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'belgeler' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <FileTextIcon className="w-3.5 h-3.5" />
          Belgeler
        </button>
        <button
          onClick={() => setActiveTab('ucretler')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'ucretler' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <BadgePercentIcon className="w-3.5 h-3.5" />
          Ücretler
        </button>
        <button
          onClick={() => setActiveTab('randevu')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'randevu' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <CalendarDaysIcon className="w-3.5 h-3.5" />
          Randevu Al
        </button>
      </div>

      {/* 1. Salonlar */}
      {activeTab === 'salonlar' && (
        <div className="space-y-4">
          {SALONLAR.map((salon) => (
            <div key={salon.id} className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground">{salon.name}</h3>
                  <div className="text-xs text-foreground-muted flex items-center gap-1 mt-1">
                    <MapPinIcon className="w-3.5 h-3.5 text-pink-500" />
                    <span>{salon.address}</span>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600">
                  {salon.capacity}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {salon.features.map((f) => (
                  <span key={f} className="text-[10px] px-2 py-0.5 rounded-md bg-surface-2 text-foreground-muted">
                    {f}
                  </span>
                ))}
              </div>
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
                <a href={`tel:${salon.phone.replace(/\s+/g, '')}`} className="font-bold text-pink-600 flex items-center gap-1">
                  <PhoneIcon className="w-3.5 h-3.5" />
                  {salon.phone}
                </a>
                <button
                  onClick={() => setActiveTab('randevu')}
                  className="px-3 py-1.5 rounded-xl bg-pink-500 text-white font-bold text-xs"
                >
                  Tarih Seç
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Gerekli Belgeler */}
      {activeTab === 'belgeler' && (
        <div className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-3">
          <h3 className="text-sm font-bold text-foreground">Nikah Başvurusu İçin Gerekli Evraklar</h3>
          <div className="space-y-2.5">
            {BELGELER.map((b, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground leading-relaxed">
                <CheckCircle2Icon className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span>{b}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => alert('Nikah Başvuru Dilekçesi İndiriliyor...')}
            className="w-full mt-3 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-foreground text-xs font-bold flex items-center justify-center gap-1.5 border border-border"
          >
            <DownloadIcon className="w-4 h-4 text-pink-500" />
            Evlenme Beyannamesi İndir (PDF)
          </button>
        </div>
      )}

      {/* 3. Ücret Tarifesi */}
      {activeTab === 'ucretler' && (
        <div className="space-y-3">
          {UCRETLER.map((u, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground">{u.type}</h4>
                <p className="text-[10px] text-foreground-muted">{u.extra}</p>
              </div>
              <div className="text-sm font-black text-pink-600">{u.fee}</div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Randevu Al */}
      {activeTab === 'randevu' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            alert('Nikah ön başvuru randevunuz oluşturuldu! Belgelerinizle birlikte seçtiğiniz tarihte Yunus Emre Kültür Merkezi Evlendirme Memurluğuna geliniz.')
          }}
          className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">Online Nikah Tarihi ve Ön Kayıt</h3>
          <div>
            <label className="text-[10px] font-bold text-foreground-muted block mb-1">Nikah Salonu</label>
            <select className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
              <option>Yunus Emre Kültür Merkezi Nikah Salonu</option>
              <option>Florya Nikah Salonu</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Damat TCKN</label>
              <input type="text" maxLength={11} placeholder="11 haneli TCKN" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-foreground-muted block mb-1">Gelin TCKN</label>
              <input type="text" maxLength={11} placeholder="11 haneli TCKN" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground font-mono" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-foreground-muted block mb-1">Tercih Edilen Nikah Tarihi</label>
            <input type="date" defaultValue="2026-11-20" required className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
          </div>
          <button type="submit" className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold shadow-md shadow-pink-500/20">
            Nikah Ön Başvurusunu Tamamla
          </button>
        </form>
      )}
    </div>
  )
}
