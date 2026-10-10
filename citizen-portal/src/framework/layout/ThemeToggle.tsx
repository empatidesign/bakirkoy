import { SunIcon, MoonIcon, MonitorIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme, type ThemeMode } from '@/framework/theme/ThemeContext'

const OPTIONS: { value: ThemeMode; icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { value: 'light', icon: SunIcon, label: 'Açık' },
  { value: 'dark', icon: MoonIcon, label: 'Koyu' },
  { value: 'system', icon: MonitorIcon, label: 'Sistem' },
]

export const ThemeToggle = () => {
  const { mode, setMode } = useTheme()
  // Kullanıcı isteği (2026-08-05): "vatandaş portalındaki dark temayı kaldır" — admin panelde
  // daha önce yapılan aynı düzeltme deseni (bkz. admin-panel commit 11d8478): kod SİLİNMEDİ,
  // sadece bu bileşen render edilmiyor (ThemeContext zaten effective'i her koşulda 'light'e
  // sabitledi, dolayısıyla mod seçim butonu artık anlamsız kalıyordu). `(false as boolean)`
  // deseni bilinçli tercih edildi: düz `{false && (...)}` eslint'in no-constant-binary-
  // expression kuralına takılıyor, cast ile hem lint hem tsc temiz kalırken JSX fiziksel
  // olarak korunuyor (dark mode ileride geri açılırsa hazır).
  if (!(false as boolean)) return null
  return (
    <div className="inline-flex items-center gap-0.5 rounded-field bg-surface-2 p-0.5">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          onClick={() => setMode(value)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-[5px] transition-colors',
            mode === value ? 'bg-surface-0 text-primary shadow-sm' : 'text-foreground-muted hover:text-foreground-default',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
