import { useCallback, useEffect, useRef, useState } from 'react'

// Kullanıcı isteği (2026-09-02): "açıklama/not yazarken sesli yazma özelliği eklensin" —
// saha görevlisi sahada tek elle tablet/telefon kullanırken açıklama alanlarını (talep/
// öneri/şikayet metni, "Diğer" serbest metin kutuları vb.) sesle doldurabilsin.
//
// Web Speech API (SpeechRecognition) tarayıcı yerleşiği kullanılır — ek paket/servis
// gerekmez, sunucuya ses gönderilmez (KVKK: ses verisi hiç ağa çıkmaz, tarayıcı içinde
// işlenir). Chrome/Edge (masaüstü ve Android) ve masaüstü Safari (v14+) destekler;
// Firefox ve iOS Safari (iPhone/iPad — saha anketöründe yaygın) HİÇ DESTEKLEMİYOR.
//
// Hata bulgusu (2026-09-03): desteklenmeyen tarayıcıda `supported=false` dönünce
// çağıran taraf (MicButton) eskiden mikrofon düğmesini tamamen GİZLİYORDU — bu
// tarayıcıyı kullanan anketör butonu hiç göremiyor, özelliğin bozuk olduğunu
// sanıyordu. Artık MicButton bu durumda gri/pasif bir buton gösterip tıklanınca
// "Chrome/Edge kullanın" uyarısı veriyor (bkz. MicButton.tsx).

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}

type SpeechCtor = new () => SpeechRecognitionLike

const getCtor = (): SpeechCtor | null => {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

interface UseSpeechToTextOptions {
  /** Yeni tanınan metin geldiğinde çağrılır (yalnızca kesinleşmiş/`isFinal` parçalar). */
  onResult: (transcript: string) => void
  /**
   * Ek doğrulama (2026-09-03) bulgusu: mikrofon izni tarayıcıda REDDEDİLDİĞİNDE
   * (`not-allowed`/`service-not-allowed`) buton eskiden sessizce eski haline
   * dönüyordu — anketör "kırmızı oldu, sonra sessizce söndü, ne oldu?" yaşıyordu.
   * Artık bu geri arama ile çağıran taraf (MicButton) kullanıcıya açıklayıcı bir
   * uyarı gösterebiliyor. Diğer hatalar (örn. `no-speech`, `aborted`) sessiz
   * kalır çünkü kullanıcı deneyimini bozan gürültülü uyarılar üretirler.
   */
  onPermissionDenied?: () => void
  lang?: string
}

/**
 * Basit push-to-toggle sesli yazma: `listening` true iken mikrofon açık, tanınan her
 * kesin (final) cümle `onResult` ile bildirilir; çağıran taraf bunu metnin sonuna ekler.
 */
export function useSpeechToText({ onResult, onPermissionDenied, lang = 'tr-TR' }: UseSpeechToTextOptions) {
  const [supported] = useState(() => getCtor() !== null)
  const [listening, setListening] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult
  const onPermissionDeniedRef = useRef(onPermissionDenied)
  onPermissionDeniedRef.current = onPermissionDenied

  useEffect(() => () => { recognitionRef.current?.stop() }, [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = false
    rec.onresult = (e) => {
      let text = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) text += r[0].transcript
      }
      if (text.trim()) onResultRef.current(text.trim())
    }
    rec.onerror = (e) => {
      setListening(false)
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        onPermissionDeniedRef.current?.()
      }
    }
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    rec.start()
    setListening(true)
  }, [lang])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { supported, listening, toggle }
}
