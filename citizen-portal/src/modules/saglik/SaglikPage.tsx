import { useState } from 'react'
import {
  HeartPulseIcon,
  StethoscopeIcon,
  UserCheckIcon,
  CalendarDaysIcon,
  TruckIcon,
  ClockIcon
} from 'lucide-react'
import { AmbulansHastaNakilPortal } from './AmbulansHastaNakilPortal'

export const SaglikPage = () => {
  const [activeTab, setActiveTab] = useState<'poliklinik' | 'hekimler' | 'randevu' | 'evdesaglik' | 'ambulans'>('poliklinik')
  const [successNotice, setSuccessNotice] = useState<string | null>(null)

  const POLIKLINIKLER = [
    { name: 'Dahiliye (İç Hastalıkları)', hours: '08:30 - 16:30', doctor: 'Uzm. Dr. Mehmet Kaya', room: 'Oda 102' },
    { name: 'Göz Hastalıkları', hours: '09:00 - 16:00', doctor: 'Op. Dr. Elif Arslan', room: 'Oda 204' },
    { name: 'Diş Hekimliği & Ağız Sağlığı', hours: '08:30 - 17:00', doctor: 'Dt. Barış Yıldız', room: 'Diş Kliniği 1' },
    { name: 'Kadın Hastalıkları ve Doğum', hours: '09:00 - 15:30', doctor: 'Op. Dr. Sevgi Demir', room: 'Oda 108' },
    { name: 'Çocuk Sağlığı ve Hastalıkları', hours: '08:30 - 16:30', doctor: 'Uzm. Dr. Aylin Güneş', room: 'Oda 115' },
    { name: 'Fizik Tedavi ve Rehabilitasyon', hours: '08:30 - 17:00', doctor: 'Uzm. Dr. Caner Öztürk', room: 'FTR Ünitesi' }
  ]

  const HEKIMLER = [
    { name: 'Uzm. Dr. Mehmet Kaya', title: 'İç Hastalıkları Uzmanı', experience: '18 Yıl Tecrübe', clinic: 'Bakırköy Tıp Merkezi' },
    { name: 'Op. Dr. Elif Arslan', title: 'Göz Hastalıkları Uzmanı', experience: '12 Yıl Tecrübe', clinic: 'Bakırköy Tıp Merkezi' },
    { name: 'Dt. Barış Yıldız', title: 'Diş Hekimi', experience: '9 Yıl Tecrübe', clinic: 'Ağız ve Diş Sağlığı Merkezi' },
    { name: 'Uzm. Dr. Aylin Güneş', title: 'Çocuk Sağlığı Uzmanı', experience: '15 Yıl Tecrübe', clinic: 'Çocuk Polikliniği' }
  ]

  return (
    <div className="min-h-full pb-24 pt-4 px-4 max-w-lg mx-auto space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <span className="bg-gradient-to-r from-red-500 to-rose-600 text-transparent bg-clip-text">
              Sağlık Hizmetleri
            </span>
          </h1>
          <p className="text-xs text-foreground-muted mt-0.5">
            Bakırköy Belediyesi Sağlık İşleri Müdürlüğü & Tıp Merkezi
          </p>
        </div>
        <div className="p-2 rounded-2xl bg-red-500/10 text-red-600 border border-red-500/20">
          <HeartPulseIcon className="w-5 h-5" />
        </div>
      </div>

      {/* Sekmeler (Şartname 3.3.22.1) */}
      <div className="grid grid-cols-5 gap-1 p-1 bg-surface-2 rounded-2xl border border-border">
        <button
          onClick={() => setActiveTab('poliklinik')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'poliklinik' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <StethoscopeIcon className="w-3.5 h-3.5" />
          Klinikler
        </button>
        <button
          onClick={() => setActiveTab('hekimler')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'hekimler' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <UserCheckIcon className="w-3.5 h-3.5" />
          Hekimler
        </button>
        <button
          onClick={() => setActiveTab('randevu')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'randevu' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <CalendarDaysIcon className="w-3.5 h-3.5" />
          Randevu
        </button>
        <button
          onClick={() => setActiveTab('evdesaglik')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'evdesaglik' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <HeartPulseIcon className="w-3.5 h-3.5" />
          Evde Sağlık
        </button>
        <button
          onClick={() => setActiveTab('ambulans')}
          className={`py-2 text-[10px] font-bold rounded-xl transition-all flex flex-col items-center gap-1 ${
            activeTab === 'ambulans' ? 'bg-card text-foreground shadow-sm' : 'text-foreground-muted'
          }`}
        >
          <TruckIcon className="w-3.5 h-3.5" />
          Ambulans
        </button>
      </div>

      {/* 1. POLİKLİNİKLER */}
      {activeTab === 'poliklinik' && (
        <div className="space-y-3">
          {POLIKLINIKLER.map((p, i) => (
            <div key={i} className="p-4 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-foreground">{p.name}</h4>
                <div className="text-[11px] text-foreground-muted mt-0.5">{p.doctor} • {p.room}</div>
                <div className="text-[10px] text-red-500 font-medium mt-1 flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" />
                  {p.hours}
                </div>
              </div>
              <button
                onClick={() => setActiveTab('randevu')}
                className="px-3 py-1.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs"
              >
                Randevu
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 2. HEKİMLER */}
      {activeTab === 'hekimler' && (
        <div className="space-y-3">
          {HEKIMLER.map((h, i) => (
            <div key={i} className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-1">
              <h4 className="text-xs font-bold text-foreground">{h.name}</h4>
              <p className="text-[11px] text-red-600 font-semibold">{h.title}</p>
              <div className="text-[10px] text-foreground-muted flex justify-between pt-1">
                <span>{h.clinic}</span>
                <span>{h.experience}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. POLİKLİNİK RANDEVU */}
      {activeTab === 'randevu' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccessNotice('Poliklinik randevunuz onaylandı! Randevu detayları SMS ile iletilmiştir.')
          }}
          className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">Poliklinik Muayene Randevusu</h3>
          {successNotice ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-bold text-center">
              {successNotice}
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-bold text-foreground-muted block mb-1">Poliklinik</label>
                <select className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
                  {POLIKLINIKLER.map((p, i) => (
                    <option key={i}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-foreground-muted block mb-1">Tarih</label>
                  <input type="date" defaultValue="2026-10-16" className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-foreground-muted block mb-1">Saat</label>
                  <select className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
                    <option>09:30</option>
                    <option>10:15</option>
                    <option>11:00</option>
                    <option>14:00</option>
                    <option>15:30</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md shadow-red-500/20">
                Randevuyu Onayla
              </button>
            </>
          )}
        </form>
      )}

      {/* 4. EVDE SAĞLIK */}
      {activeTab === 'evdesaglik' && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSuccessNotice('Evde sağlık hizmeti başvurunuz alındı. Sağlık personelimiz ön değerlendirme için arayacaktır.')
          }}
          className="p-5 rounded-3xl bg-card border border-border shadow-sm space-y-4"
        >
          <h3 className="text-sm font-bold text-foreground">Evde Sağlık Hizmeti Talebi</h3>
          {successNotice ? (
            <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 text-xs font-bold text-center">
              {successNotice}
            </div>
          ) : (
            <>
              <div>
                <label className="text-[10px] font-bold text-foreground-muted block mb-1">Hizmet Türü</label>
                <select className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground">
                  <option>Evde Pansuman ve Enjeksiyon</option>
                  <option>Kan Alma ve Laboratuvar Tetkiki</option>
                  <option>Doktor Muayenesi (Yatalak Hasta)</option>
                  <option>Fizyoterapi ve Egzersiz Desteği</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-foreground-muted block mb-1">Hastanın Durumu ve Rapor Bilgisi</label>
                <textarea rows={3} placeholder="Engelli veya kronik hastalık raporu detayları..." className="w-full p-2.5 rounded-xl bg-surface-2 border border-border text-xs text-foreground resize-none" />
              </div>
              <button type="submit" className="w-full py-3 rounded-xl bg-red-600 text-white text-xs font-bold shadow-md shadow-red-500/20">
                Evde Sağlık Başvurusunu Tamamla
              </button>
            </>
          )}
        </form>
      )}

      {/* 5. AMBULANS */}
      {activeTab === 'ambulans' && (
        <AmbulansHastaNakilPortal />
      )}
    </div>
  )
}
