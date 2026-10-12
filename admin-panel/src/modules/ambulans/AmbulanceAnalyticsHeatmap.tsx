import {
  TrendingUpIcon,
  MapPinIcon,
  HospitalIcon,
  ClockIcon,
  GaugeIcon,
  ScaleIcon,
} from 'lucide-react'
import { StatCard } from '@/design-system'

export const AmbulanceAnalyticsHeatmap = () => {
  const NEIGHBORHOOD_HEATMAP = [
    { name: 'Zuhuratbaba Mah.', requests: 48, percentage: 28, risk: 'Yüksek' },
    { name: 'Kartaltepe Mah.', requests: 36, percentage: 21, risk: 'Orta-Yüksek' },
    { name: 'Ataköy 7-8-9-10. Kısım', requests: 29, percentage: 17, risk: 'Orta' },
    { name: 'Yeşilköy Mah.', requests: 24, percentage: 14, risk: 'Orta' },
    { name: 'Osmaniye Mah.', requests: 18, percentage: 11, risk: 'Düşük-Orta' },
    { name: 'Yenimahalle / Sakızağacı', requests: 15, percentage: 9, risk: 'Düşük' }
  ]

  const HOSPITAL_DISTRIBUTION = [
    { name: 'Bakırköy Dr. Sadi Konuk EAH', share: 34, trips: 68 },
    { name: 'Başakşehir Çam ve Sakura Şehir Hastanesi', share: 24, trips: 48 },
    { name: 'Bakırköy Dr. Sadi Konuk EAH', share: 18, trips: 36 },
    { name: 'İstanbul Cerrahpaşa Tıp Fakültesi', share: 14, trips: 28 },
    { name: 'İstanbul FTR Eğitim Araştırma Hastanesi', share: 10, trips: 20 }
  ]

  return (
    <div className="space-y-6">
      <div className="pilot-stat-grid">
        <StatCard
          size="compact"
          label="Aylık Toplam Nakil"
          value="248 Hasta"
          icon={TrendingUpIcon}
          accent="green"
          hint="Geçen aya göre +%14"
        />
        <StatCard
          size="compact"
          label="Ortalama Ulaşım Süresi"
          value="22.4 Dakika"
          icon={ClockIcon}
          accent="blue"
          hint="Randevuya zamanında yetişme: %98.6"
        />
        <StatCard
          size="compact"
          label="Boş Kilometre Oranı"
          value="%11.8"
          icon={GaugeIcon}
          accent="neutral"
          hint="Hedef: < %15 (Akıllı Rota Optimizasyonu)"
        />
        <StatCard
          size="compact"
          label="Adil Görev Yükü Sapması"
          value="±%6.2"
          icon={ScaleIcon}
          accent="violet"
          hint="Filo içi dengeli iş dağılımı"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="p-5 rounded-card bg-card border border-border shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="type-section flex items-center gap-2">
              <MapPinIcon className="w-4 h-4 text-danger" />
              Mahalle Bazlı Talep Isı Haritası (Heatmap)
            </h3>
            <span className="type-caption">Son 30 Gün</span>
          </div>

          <div className="space-y-3">
            {NEIGHBORHOOD_HEATMAP.map(item => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between type-body-strong">
                  <span className="text-foreground">{item.name}</span>
                  <span className="text-foreground-muted font-mono">{item.requests} Nakil ({item.percentage}%)</span>
                </div>
                <div className="w-full h-2.5 rounded-pill bg-surface-1 overflow-hidden">
                  <div
                    className="h-full rounded-pill bg-gradient-to-r from-danger to-warning"
                    style={{ width: `${item.percentage * 3}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-card bg-card border border-border shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="type-section flex items-center gap-2">
              <HospitalIcon className="w-4 h-4 text-info" />
              En Sık Nakil Yapılan Sağlık Kuruluşları
            </h3>
            <span className="type-caption">Hedef Hastaneler</span>
          </div>

          <div className="space-y-3">
            {HOSPITAL_DISTRIBUTION.map(h => (
              <div key={h.name} className="space-y-1">
                <div className="flex items-center justify-between type-body-strong">
                  <span className="text-foreground truncate max-w-[260px]">{h.name}</span>
                  <span className="text-info font-mono font-semibold">%{h.share} ({h.trips} Nakil)</span>
                </div>
                <div className="w-full h-2.5 rounded-pill bg-surface-1 overflow-hidden">
                  <div
                    className="h-full rounded-pill bg-info"
                    style={{ width: `${h.share * 2.5}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
