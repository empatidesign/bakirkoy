import { useState } from 'react'
import {
  DogIcon,
  HeartIcon,
  CalendarDaysIcon,
  TruckIcon,
  ClipboardListIcon
} from 'lucide-react'

interface Animal {
  id: string
  name: string
  type: 'Kedi' | 'Köpek'
  age: string
  gender: 'Dişi' | 'Erkek'
  breed: string
  vaccinated: boolean
  neutered: boolean
  desc: string
  imageUrl: string
}

const ANIMALS_FOR_ADOPTION: Animal[] = [
  {
    id: 'a1',
    name: 'Tarçın',
    type: 'Kedi',
    age: '8 Aylık',
    gender: 'Erkek',
    breed: 'Tekir',
    vaccinated: true,
    neutered: true,
    desc: 'Çok oyuncu ve sevecen, ev ortamına alışkın.',
    imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'a2',
    name: 'Gölge',
    type: 'Köpek',
    age: '1.5 Yaşında',
    gender: 'Dişi',
    breed: 'Golden Melezi',
    vaccinated: true,
    neutered: true,
    desc: 'Temel itaat eğitimleri tamamlandı, bahçeli veya geniş eve çok uygun.',
    imageUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=400&auto=format&fit=crop&q=80'
  },
  {
    id: 'a3',
    name: 'Pamuk',
    type: 'Kedi',
    age: '1 Yaşında',
    gender: 'Dişi',
    breed: 'Ankara Kedisi Melezi',
    vaccinated: true,
    neutered: false,
    desc: 'Sakin huylu, kucak seven sevimli bir can dostumuz.',
    imageUrl: 'https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=400&auto=format&fit=crop&q=80'
  }
]

export const VeterinerlikPage = () => {
  const [activeTab, setActiveTab] = useState<'sahiplen' | 'vetbak' | 'kisirlastirma' | 'basvuru'>('sahiplen')
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null)
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  return (
    <div className="min-h-full pb-24 pt-4 px-4 max-w-lg mx-auto space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-gradient-to-r from-emerald-500 to-teal-600 text-transparent bg-clip-text">
              Veterinerlik
            </span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Bakırköy Belediyesi Veteriner İşleri Müdürlüğü
          </p>
        </div>
        <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <DogIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Sekmeler (Şartname 3.3.23.2) */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-surface-2 rounded-2xl border border-border">
        <button
          onClick={() => setActiveTab('sahiplen')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'sahiplen' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <HeartIcon className="w-3.5 h-3.5 text-rose-500" />
          Sahiplen
        </button>
        <button
          onClick={() => setActiveTab('vetbak')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'vetbak' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <TruckIcon className="w-3.5 h-3.5 text-emerald-500" />
          Vetbak
        </button>
        <button
          onClick={() => setActiveTab('kisirlastirma')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'kisirlastirma' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <CalendarDaysIcon className="w-3.5 h-3.5 text-teal-500" />
          Kısırlaştırma
        </button>
        <button
          onClick={() => setActiveTab('basvuru')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'basvuru' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <ClipboardListIcon className="w-3.5 h-3.5 text-blue-500" />
          Başvuru
        </button>
      </div>

      {/* 1. HAYVAN SAHİPLENME */}
      {activeTab === 'sahiplen' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white space-y-1.5 shadow-md">
            <h3 className="text-sm font-bold flex items-center gap-1.5">
              <HeartIcon className="w-4 h-4 text-rose-300" />
              Satın Alma, Sahiplen!
            </h3>
            <p className="text-xs text-emerald-100 leading-relaxed">
              Geçici Hayvan Bakımevimizdeki sevimli dostlarımıza sıcak bir yuva olun. Aşıları ve bakımları belediyemizce ücretsiz yapılmaktadır.
            </p>
          </div>

          <div className="space-y-3">
            {ANIMALS_FOR_ADOPTION.map((animal) => (
              <div
                key={animal.id}
                className="p-3.5 rounded-3xl bg-card border border-border shadow-sm flex items-center gap-3.5"
              >
                <img
                  src={animal.imageUrl}
                  alt={animal.name}
                  className="w-20 h-20 rounded-2xl object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-foreground">{animal.name}</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">
                      {animal.gender} • {animal.age}
                    </span>
                  </div>
                  <p className="text-xs text-foreground-muted mt-0.5 line-clamp-1">{animal.desc}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        setSelectedAnimal(animal)
                        setActiveTab('basvuru')
                      }}
                      className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-sm"
                    >
                      Sahiplenmek İstiyorum
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. VETBAK (MOBİL KLİNİK) */}
      {activeTab === 'vetbak' && (
        <div className="space-y-4">
          <div className="p-4 rounded-3xl bg-card border border-border shadow-sm space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <TruckIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">VETBAK Mobil Klinik Aracı</h3>
                <span className="text-xs text-foreground-muted">Mahallenize gelen ücretsiz veteriner hizmeti</span>
              </div>
            </div>
            <p className="text-xs text-foreground-subtle leading-relaxed">
              VETBAK mobil otobüsümüz sokak hayvanlarının aşılanması, iç-dış parazit uygulamaları ve genel sağlık kontrolleri için haftalık programla ilçemizi gezmektedir.
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-bold text-foreground-muted px-1">Bu Haftaki VETBAK Takvimi</h4>
            {[
              { day: 'Pazartesi', place: 'Zuhuratbaba Meydanı', hours: '10:00 - 15:00' },
              { day: 'Çarşamba', place: 'Ataköy 5. Kısım Parkı Önü', hours: '10:00 - 15:00' },
              { day: 'Cuma', place: 'Yeşilköy Sahil Parkı', hours: '10:00 - 15:00' }
            ].map((v, i) => (
              <div key={i} className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-emerald-600">{v.day}</span>
                  <div className="text-xs font-bold text-foreground mt-0.5">{v.place}</div>
                </div>
                <span className="text-[11px] font-mono text-foreground-muted">{v.hours}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. KEDİ KISIRLAŞTIRMA */}
      {activeTab === 'kisirlastirma' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccessNotice('Kedi kısırlaştırma randevunuz oluşturuldu! Belirtilen saatte sokak kedimizi taşıma kutusuyla merkezimize getirebilirsiniz.')
          }}
          className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">Sokak Kedisi Kısırlaştırma Randevusu</h3>
          {successNotice ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-bold text-center">
              {successNotice}
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-bold text-foreground-muted block mb-1">Bakımevi Birimi</label>
                <select className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
                  <option>Sokak Hayvanları Geçici Bakımevi ve Rehabilitasyon Merkezi</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-foreground-muted block mb-1">Kedi Sayısı</label>
                  <input type="number" min="1" max="2" defaultValue="1" className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-foreground-muted block mb-1">Tarih</label>
                  <input type="date" defaultValue="2026-10-18" className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
                </div>
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20">
                Kısırlaştırma Randevusu Al
              </button>
            </>
          )}
        </form>
      )}

      {/* 4. BAŞVURU FORMU */}
      {activeTab === 'basvuru' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccessNotice('Veterinerlik başvurunuz başarıyla alındı!')
          }}
          className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">
            {selectedAnimal ? `${selectedAnimal.name} İçin Sahiplenme Başvurusu` : 'Genel Veterinerlik Başvuru Formu'}
          </h3>
          {successNotice ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-bold text-center">
              {successNotice}
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-bold text-foreground-muted block mb-1">Başvuru Konusu</label>
                <select className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
                  <option>Hayvan Sahiplenme Talebi</option>
                  <option>Kedi/Köpek Besleme Noktası ve Kulübe Talebi</option>
                  <option>Yaralı Sokak Hayvanı İhbarı</option>
                  <option>Kuduz Aşısı ve Parazit Uygulaması</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-foreground-muted block mb-1">Açıklama / Adres Detayı</label>
                <textarea rows={3} placeholder="Detaylı bilgi veriniz..." className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground resize-none" />
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-500/20">
                Başvuruyu Gönder
              </button>
            </>
          )}
        </form>
      )}
    </div>
  )
}
