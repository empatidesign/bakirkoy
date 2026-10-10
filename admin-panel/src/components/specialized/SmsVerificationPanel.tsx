import { KeyRoundIcon, RefreshCwIcon } from 'lucide-react'
import { Banner, Button } from '@/design-system'
import { OTPInput } from '@/components/specialized/OTPInput'
import type { SmsVerificationState } from '@/hooks/useSmsVerification'

interface Props {
  state: SmsVerificationState
  /** SMS kanalı bu gönderimde kapalıysa doğrulama gerekmez, panel hiç render edilmez. */
  visible: boolean
}

// Kullanıcı isteği (2026-09-19, güncelleme 2026-09-20 iki kez): "SMS gönderiminde ilk
// defada bile doğrulama istensin ... pin şifresini kaldırabilirsin sadece sms doğrulaması
// ile gönderilsin" — bu panel her "Mesaj Gönder" modalında aynı görünüp aynı davranan,
// TEK yöntemli (SMS OTP) zorunlu ikinci faktör alanıdır.
export function SmsVerificationPanel({ state, visible }: Props) {
  if (!visible) return null

  const { otp, setOtp, otpRequested, otpSending, maskedPhone, cooldown, error, requestOtp } = state

  return (
    <div className="rounded-card border border-border bg-surface-1 p-3 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRoundIcon className="h-4 w-4 text-foreground-muted" />
        <p className="type-caption font-semibold text-foreground-default">SMS Gönderim Doğrulaması</p>
      </div>

      {!otpRequested ? (
        <Button type="button" variant="outline" size="sm" onClick={requestOtp} isLoading={otpSending}>
          Doğrulama Kodu Gönder
        </Button>
      ) : (
        <div className="space-y-2">
          <p className="type-caption text-foreground-muted">{maskedPhone} numarasına gönderilen kodu girin.</p>
          <OTPInput value={otp} onChange={setOtp} length={6} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={requestOtp}
            disabled={cooldown > 0 || otpSending}
            iconLeft={<RefreshCwIcon className={`h-3.5 w-3.5 ${otpSending ? 'animate-spin' : ''}`} />}
          >
            {cooldown > 0 ? `Tekrar gönder (${cooldown}s)` : 'Tekrar gönder'}
          </Button>
        </div>
      )}

      {error ? <Banner tone="danger" variant="soft">{error}</Banner> : null}
    </div>
  )
}
