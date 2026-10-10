import { WifiIcon, ShieldIcon, UsersIcon, Building2Icon, AppleIcon, SmartphoneIcon, GlobeIcon } from 'lucide-react'
import { StatCard } from '@/design-system'
import { AreaTrendChart } from '@/design-system/charts'
import { useOnlineUsers } from './useOnlineUsers'

const formatTime = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export const OnlineUsersPanel = () => {
  const { data, loading } = useOnlineUsers(24)

  const chartData = (data?.trend ?? []).map((p) => ({
    time: p.capturedAt,
    total: p.total,
  }))

  return (
    <div className="space-y-4">
      <div className="pilot-stat-grid pilot-stat-grid-4">
        <StatCard
          label="Şu An Online"
          value={data?.total ?? 0}
          icon={WifiIcon}
          accent="green"
          loading={loading}
          hint={`Son 5 dk · Bugünkü zirve ${data?.peakToday ?? 0}`}
        />
        <StatCard
          label="Yönetici"
          value={data?.admin ?? 0}
          icon={ShieldIcon}
          accent="blue"
          loading={loading}
          hint="Panelde aktif yönetici"
        />
        <StatCard
          label="Vatandaş"
          value={data?.citizen ?? 0}
          icon={UsersIcon}
          accent="orange"
          loading={loading}
          hint="Uygulamada aktif vatandaş"
        />
        <StatCard
          label="Firma"
          value={data?.company ?? 0}
          icon={Building2Icon}
          accent="violet"
          loading={loading}
          hint="Aktif firma kullanıcısı"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="Vatandaş · iOS"
          value={data?.citizenIos ?? 0}
          icon={AppleIcon}
          accent="orange"
          loading={loading}
          hint="Mobil uygulama (iPhone/iPad)"
        />
        <StatCard
          label="Vatandaş · Android"
          value={data?.citizenAndroid ?? 0}
          icon={SmartphoneIcon}
          accent="orange"
          loading={loading}
          hint="Mobil uygulama (Android)"
        />
        <StatCard
          label="Vatandaş · Web"
          value={data?.citizenWeb ?? 0}
          icon={GlobeIcon}
          accent="orange"
          loading={loading}
          hint="Tarayıcıdan erişim"
        />
      </div>

      <div className="rounded-card border border-border bg-surface-1 p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-soft">
            <WifiIcon className="h-4 w-4 text-primary" />
          </span>
          <div>
            <p className="type-section text-foreground-strong">Online Kullanıcı Trendi</p>
            <p className="type-caption text-foreground-subtle">Son 24 saat, 5 dakikalık ölçümler</p>
          </div>
        </div>

        {chartData.length > 0 ? (
          <AreaTrendChart
            data={chartData}
            xKey="time"
            series={[{ key: 'total', label: 'Online Kullanıcı' }]}
            height={220}
            formatX={formatTime}
          />
        ) : (
          <p className="py-10 text-center type-desc">
            {loading ? 'Yükleniyor...' : 'Henüz ölçüm kaydı yok. İlk kayıt 5 dakika içinde oluşur.'}
          </p>
        )}
      </div>
    </div>
  )
}
