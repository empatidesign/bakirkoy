import { PrivacyScreen } from '@capacitor-community/privacy-screen'
import { isNativePlatform } from './platform'

// Kullanıcı isteği (2026-10-07): uygulamadaki ekran görüntüsü / ekran kaydı başka bir
// program veya arayüz yazılımıyla alınmaya çalışılırsa engellensin.
//
// Native tarafta (capacitor.config.ts → plugins.PrivacyScreen) uygulama açılır açılmaz,
// JS hiç çalışmadan önce koruma zaten devrededir (Android FLAG_SECURE, iOS secure text
// field tekniği). Burada yapılan: (1) güvenlik için idempotent bir enable() çağrısı —
// plugin config'i bir sebeple devre dışıysa bile korumayı garantiye alır, (2) iOS'ta
// resmi bir engelleme API'si olmadığından, ekran kaydı başlarsa kullanıcıyı bilgilendiren
// bir event dinleyicisi. Web'de (tarayıcıda normal kullanım) plugin desteklenmediği için
// tüm çağrılar sessizce yok sayılır.

let started = false

export const initScreenCaptureProtection = (onScreenRecording?: (active: boolean) => void): void => {
  if (!isNativePlatform() || started) return
  started = true

  PrivacyScreen.enable().catch((err) => {
    console.error('[screenCapture] PrivacyScreen.enable başarısız (yok sayıldı):', err)
  })

  if (onScreenRecording) {
    void PrivacyScreen.addListener('screenRecordingStarted', () => onScreenRecording(true))
    void PrivacyScreen.addListener('screenRecordingStopped', () => onScreenRecording(false))
  }
}
